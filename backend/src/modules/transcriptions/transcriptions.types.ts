import type { TranscriptionStatus } from "@prisma/client";

export type CreateTranscriptionJobInput = {
  url?: unknown;
  sourceLanguage?: unknown;
  targetLanguage?: unknown;
};

export type UpdateTranscriptBlockInput = {
  originalText?: unknown;
  translatedText?: unknown;
};

export type CreateListMode = "ORIGINAL_TO_TRANSLATION" | "TRANSLATION_TO_ORIGINAL";

export type CreateListFromTranscriptionInput = {
  title?: unknown;
  mode?: unknown;
};

export const activeTranscriptionStatuses: TranscriptionStatus[] = [
  "PENDING",
  "DOWNLOADING",
  "CONVERTING",
  "TRANSCRIBING",
  "SEGMENTING",
  "TRANSLATING"
];
