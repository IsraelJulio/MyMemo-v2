from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import psycopg
from psycopg.rows import dict_row


ACTIVE_STATUSES = {
    "PENDING",
    "DOWNLOADING",
    "CONVERTING",
    "TRANSCRIBING",
    "SEGMENTING",
    "TRANSLATING",
}


def connect() -> psycopg.Connection:
    database_url = os.environ["DATABASE_URL"]
    return psycopg.connect(_normalize_database_url(database_url), row_factory=dict_row)


def fetch_next_job(conn: psycopg.Connection) -> dict[str, Any] | None:
    with conn.transaction():
        row = conn.execute(
            """
            WITH next_job AS (
              SELECT id
              FROM "TranscriptionJob"
              WHERE status = 'PENDING'::"TranscriptionStatus"
              ORDER BY "createdAt" ASC
              FOR UPDATE SKIP LOCKED
              LIMIT 1
            )
            UPDATE "TranscriptionJob" job
            SET status = 'DOWNLOADING'::"TranscriptionStatus",
                "startedAt" = COALESCE(job."startedAt", NOW()),
                progress = 5,
                "errorMessage" = NULL
            FROM next_job
            WHERE job.id = next_job.id
            RETURNING job.id,
                      job."sourceUrl",
                      job."sourceLanguage",
                      job."targetLanguage"
            """
        ).fetchone()
    return dict(row) if row else None


def update_job_state(conn: psycopg.Connection, job_id: str, status: str, progress: int) -> None:
    if status not in ACTIVE_STATUSES and status not in {"COMPLETED", "FAILED", "CANCELED"}:
        raise ValueError(f"Invalid status: {status}")

    with conn.transaction():
        conn.execute(
            """
            UPDATE "TranscriptionJob"
            SET status = %s::"TranscriptionStatus",
                progress = %s
            WHERE id = %s
            """,
            (status, progress, job_id),
        )


def update_job_metadata(
    conn: psycopg.Connection,
    job_id: str,
    *,
    source_title: str | None = None,
    detected_language: str | None = None,
) -> None:
    if source_title is None and detected_language is None:
        return

    assignments = []
    params: list[Any] = []
    if source_title is not None:
        assignments.append('"sourceTitle" = %s')
        params.append(source_title[:500])
    if detected_language is not None:
        assignments.append('"detectedLanguage" = %s')
        params.append(detected_language[:32])
    params.append(job_id)

    with conn.transaction():
        conn.execute(
            f'UPDATE "TranscriptionJob" SET {", ".join(assignments)} WHERE id = %s',
            params,
        )


def replace_blocks(conn: psycopg.Connection, job_id: str, blocks: list[dict[str, Any]]) -> None:
    now = datetime.now(timezone.utc)
    with conn.transaction():
        conn.execute('DELETE FROM "TranscriptBlock" WHERE "transcriptionJobId" = %s', (job_id,))
        if not blocks:
            return

        rows = [
            (
                f"tb_{uuid.uuid4().hex}",
                job_id,
                block["order"],
                block.get("startMs"),
                block.get("endMs"),
                block["originalText"],
                block.get("translatedText"),
                block.get("confidence"),
                now,
            )
            for block in blocks
        ]
        with conn.cursor() as cur:
            cur.executemany(
                """
                INSERT INTO "TranscriptBlock" (
                  id,
                  "transcriptionJobId",
                  "order",
                  "startMs",
                  "endMs",
                  "originalText",
                  "translatedText",
                  confidence,
                  "updatedAt"
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                rows,
            )


def complete_job(conn: psycopg.Connection, job_id: str) -> None:
    with conn.transaction():
        conn.execute(
            """
            UPDATE "TranscriptionJob"
            SET status = 'COMPLETED'::"TranscriptionStatus",
                progress = 100,
                "finishedAt" = NOW(),
                "errorMessage" = NULL
            WHERE id = %s
            """,
            (job_id,),
        )


def fail_job(conn: psycopg.Connection, job_id: str, message: str) -> None:
    with conn.transaction():
        conn.execute(
            """
            UPDATE "TranscriptionJob"
            SET status = 'FAILED'::"TranscriptionStatus",
                "errorMessage" = %s,
                "finishedAt" = NOW()
            WHERE id = %s
            """,
            (message[:1000], job_id),
        )


def _normalize_database_url(database_url: str) -> str:
    parts = urlsplit(database_url)
    query = parse_qsl(parts.query, keep_blank_values=True)
    schema = None
    filtered = []

    for key, value in query:
        if key == "schema":
            schema = value
        else:
            filtered.append((key, value))

    if schema and not any(key == "options" for key, _ in filtered):
        filtered.append(("options", f"-csearch_path={schema}"))

    return urlunsplit((parts.scheme, parts.netloc, parts.path, parts.query and urlencode(filtered), parts.fragment))
