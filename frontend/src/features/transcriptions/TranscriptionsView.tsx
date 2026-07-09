import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Check, Edit3, FileText, Languages, Plus, RefreshCw, Save, Wand2, X } from "lucide-react";
import { request, type Player } from "../../api";
import type { CreateListMode, TranscriptBlock, TranscriptionJob, TranscriptionStatus } from "./types";

const statusLabels: Record<TranscriptionStatus, string> = {
  PENDING: "Na fila",
  DOWNLOADING: "Baixando mídia",
  CONVERTING: "Convertendo áudio",
  TRANSCRIBING: "Transcrevendo",
  SEGMENTING: "Organizando blocos",
  TRANSLATING: "Traduzindo",
  COMPLETED: "Concluído",
  FAILED: "Falhou",
  CANCELED: "Cancelado"
};

const terminalStatuses = new Set<TranscriptionStatus>(["COMPLETED", "FAILED", "CANCELED"]);

type TranscriptionsViewProps = {
  player: Player;
  refresh: () => Promise<void>;
  celebrate: (message: string) => void;
};

type EditingBlock = {
  id: string;
  originalText: string;
  translatedText: string;
};

export function TranscriptionsView({ player, refresh, celebrate }: TranscriptionsViewProps) {
  const [url, setUrl] = useState("");
  const [sourceLanguage, setSourceLanguage] = useState("auto");
  const [targetLanguage, setTargetLanguage] = useState("pt-BR");
  const [jobs, setJobs] = useState<TranscriptionJob[]>([]);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [blocks, setBlocks] = useState<TranscriptBlock[]>([]);
  const [editingBlock, setEditingBlock] = useState<EditingBlock | null>(null);
  const [listTitle, setListTitle] = useState("");
  const [mode, setMode] = useState<CreateListMode>("ORIGINAL_TO_TRANSLATION");
  const [loading, setLoading] = useState(false);
  const [creatingJob, setCreatingJob] = useState(false);
  const [savingBlockId, setSavingBlockId] = useState("");
  const [creatingList, setCreatingList] = useState(false);
  const [error, setError] = useState("");

  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === selectedJobId) ?? jobs[0] ?? null,
    [jobs, selectedJobId]
  );
  const selectedJobForBlocks = selectedJob?.id ?? "";
  const selectedJobStatus = selectedJob?.status;
  const hasActiveJobs = jobs.some((job) => !terminalStatuses.has(job.status));

  const loadJobs = useCallback(async (preferredJobId?: string) => {
    setLoading(true);
    try {
      const nextJobs = await request<TranscriptionJob[]>("/transcription-jobs", {}, player);
      setJobs(nextJobs);
      setSelectedJobId((current) => {
        if (preferredJobId) return preferredJobId;
        if (current && nextJobs.some((job) => job.id === current)) return current;
        return nextJobs[0]?.id ?? "";
      });
    } finally {
      setLoading(false);
    }
  }, [player]);

  const loadBlocks = useCallback(async (jobId: string) => {
    const nextBlocks = await request<TranscriptBlock[]>(`/transcription-jobs/${jobId}/blocks`, {}, player);
    setBlocks(nextBlocks);
  }, [player]);

  useEffect(() => {
    loadJobs().catch((err: Error) => setError(err.message));
  }, [loadJobs]);

  useEffect(() => {
    if (!hasActiveJobs) return;

    const interval = window.setInterval(() => {
      loadJobs().catch((err: Error) => setError(err.message));
    }, 2500);

    return () => window.clearInterval(interval);
  }, [hasActiveJobs, loadJobs]);

  useEffect(() => {
    setEditingBlock(null);
    if (!selectedJobForBlocks) {
      setBlocks([]);
      return;
    }
    if (selectedJobStatus === "COMPLETED") {
      loadBlocks(selectedJobForBlocks).catch((err: Error) => setError(err.message));
      return;
    }
    setBlocks([]);
  }, [loadBlocks, selectedJobForBlocks, selectedJobStatus]);

  async function createJob(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setCreatingJob(true);
    try {
      const job = await request<TranscriptionJob>("/transcription-jobs", {
        method: "POST",
        body: JSON.stringify({ url, sourceLanguage, targetLanguage })
      }, player);
      setUrl("");
      setBlocks([]);
      await loadJobs(job.id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreatingJob(false);
    }
  }

  function startEditing(block: TranscriptBlock) {
    setEditingBlock({
      id: block.id,
      originalText: block.originalText,
      translatedText: block.translatedText ?? ""
    });
  }

  async function saveBlock() {
    if (!editingBlock) return;
    setError("");
    setSavingBlockId(editingBlock.id);
    try {
      const saved = await request<TranscriptBlock>(`/transcription-blocks/${editingBlock.id}`, {
        method: "PUT",
        body: JSON.stringify({
          originalText: editingBlock.originalText,
          translatedText: editingBlock.translatedText
        })
      }, player);
      setBlocks((current) => current.map((block) => block.id === saved.id ? saved : block));
      setEditingBlock(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingBlockId("");
    }
  }

  async function createList() {
    if (!selectedJob) return;
    setError("");
    setCreatingList(true);
    try {
      const result = await request<{ cardCount: number; list: { id: string; title: string } }>(`/transcription-jobs/${selectedJob.id}/create-list`, {
        method: "POST",
        body: JSON.stringify({ title: listTitle, mode })
      }, player);
      setListTitle("");
      await refresh();
      celebrate(`${result.cardCount} cards criados em ${result.list.title}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreatingList(false);
    }
  }

  return (
    <section className="transcriptions-view">
      <form className="tools transcription-create" onSubmit={createJob}>
        <div className="panel-title">
          <div>
            <strong>Transcrições</strong>
            <small>URL pública de vídeo ou áudio</small>
          </div>
          <Wand2 />
        </div>
        <input
          aria-label="URL publica de video ou audio"
          placeholder="https://..."
          value={url}
          onChange={(event) => setUrl(event.target.value)}
        />
        <div className="transcription-selects">
          <label>
            Idioma original
            <select value={sourceLanguage} onChange={(event) => setSourceLanguage(event.target.value)}>
              <option value="auto">auto</option>
              <option value="en">en</option>
              <option value="pt">pt</option>
              <option value="es">es</option>
            </select>
          </label>
          <label>
            Idioma destino
            <select value={targetLanguage} onChange={(event) => setTargetLanguage(event.target.value)}>
              <option value="pt-BR">pt-BR</option>
              <option value="en">en</option>
              <option value="es">es</option>
            </select>
          </label>
        </div>
        <button className="primary" disabled={creatingJob || !url.trim()}>
          <FileText /> {creatingJob ? "Criando..." : "Gerar transcrição"}
        </button>
        <p>O processamento pode demorar alguns minutos dependendo do tamanho do vídeo.</p>
        <p>Use apenas conteúdos públicos ou que você tenha direito de processar.</p>
      </form>

      <div className="transcription-workspace">
        {error && <div className="transcription-alert"><X /> {error}</div>}

        <section className="panel transcription-jobs">
          <div className="panel-title">
            <div>
              <strong>Jobs recentes</strong>
              <small>{loading ? "Atualizando..." : `${jobs.length} encontrados`}</small>
            </div>
            <button className="icon" type="button" title="Atualizar jobs" onClick={() => loadJobs().catch((err: Error) => setError(err.message))}>
              <RefreshCw />
            </button>
          </div>
          <div className="job-list">
            {jobs.length === 0 && <div className="empty transcription-empty"><FileText /> Nenhuma transcrição criada ainda.</div>}
            {jobs.map((job) => (
              <button
                type="button"
                key={job.id}
                className={selectedJob?.id === job.id ? "job-item active" : "job-item"}
                onClick={() => setSelectedJobId(job.id)}
              >
                <span>{job.sourceTitle || compactUrl(job.sourceUrl)}</span>
                <small>{statusLabels[job.status]} · {job.progress}% · {new Date(job.createdAt).toLocaleString()}</small>
              </button>
            ))}
          </div>
        </section>

        <section className="panel transcription-detail">
          {!selectedJob && <div className="empty transcription-empty"><Languages /> Crie ou selecione uma transcrição.</div>}
          {selectedJob && (
            <>
              <div className="transcription-status-head">
                <div>
                  <strong>{selectedJob.sourceTitle || "Transcrição em processamento"}</strong>
                  <small>{compactUrl(selectedJob.sourceUrl)}</small>
                </div>
                <span className={`status-pill status-${selectedJob.status.toLowerCase()}`}>{statusLabels[selectedJob.status]}</span>
              </div>

              <div className="progress-track" aria-label={`Progresso ${selectedJob.progress}%`}>
                <div style={{ width: `${Math.max(0, Math.min(100, selectedJob.progress))}%` }} />
              </div>

              <div className="transcription-meta">
                <span>Destino: {selectedJob.targetLanguage}</span>
                {selectedJob.detectedLanguage && <span>Detectado: {selectedJob.detectedLanguage}</span>}
                <span>{selectedJob._count?.blocks ?? blocks.length} blocos</span>
              </div>

              {selectedJob.errorMessage && <div className="transcription-alert"><X /> {selectedJob.errorMessage}</div>}
              {selectedJob.status === "COMPLETED" && (
                <>
                  <p className="review-note">Transcrição gerada automaticamente. Revise antes de estudar.</p>
                  <CreateListPanel
                    listTitle={listTitle}
                    mode={mode}
                    disabled={creatingList || blocks.length === 0}
                    onTitleChange={setListTitle}
                    onModeChange={setMode}
                    onCreate={createList}
                  />
                  <div className="transcript-blocks">
                    {blocks.map((block) => (
                      <article className="transcript-block" key={block.id}>
                        <div className="block-head">
                          <strong>Bloco {block.order}</strong>
                          {formatRange(block) && <small>{formatRange(block)}</small>}
                        </div>
                        {editingBlock?.id === block.id ? (
                          <div className="block-editor">
                            <textarea value={editingBlock.originalText} onChange={(event) => setEditingBlock({ ...editingBlock, originalText: event.target.value })} />
                            <textarea value={editingBlock.translatedText} onChange={(event) => setEditingBlock({ ...editingBlock, translatedText: event.target.value })} />
                            <div className="block-actions">
                              <button type="button" className="ghost" onClick={() => setEditingBlock(null)}><X /> Cancelar</button>
                              <button type="button" disabled={savingBlockId === block.id} onClick={saveBlock}><Save /> Salvar</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p>{block.originalText}</p>
                            <p className="translation"><Languages /> {block.translatedText || "Sem tradução"}</p>
                            <button type="button" className="ghost edit-block" onClick={() => startEditing(block)}><Edit3 /> Editar</button>
                          </>
                        )}
                      </article>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </section>
      </div>
    </section>
  );
}

function CreateListPanel({
  listTitle,
  mode,
  disabled,
  onTitleChange,
  onModeChange,
  onCreate
}: {
  listTitle: string;
  mode: CreateListMode;
  disabled: boolean;
  onTitleChange: (value: string) => void;
  onModeChange: (value: CreateListMode) => void;
  onCreate: () => void;
}) {
  return (
    <div className="create-list-panel">
      <input placeholder="Nome da lista" value={listTitle} onChange={(event) => onTitleChange(event.target.value)} />
      <select value={mode} onChange={(event) => onModeChange(event.target.value as CreateListMode)}>
        <option value="ORIGINAL_TO_TRANSLATION">Original → Tradução</option>
        <option value="TRANSLATION_TO_ORIGINAL">Tradução → Original</option>
      </select>
      <button type="button" disabled={disabled || !listTitle.trim()} onClick={onCreate}>
        <Plus /> Criar lista de cards
      </button>
    </div>
  );
}

function compactUrl(value: string) {
  try {
    const url = new URL(value);
    return `${url.hostname}${url.pathname === "/" ? "" : url.pathname}`;
  } catch {
    return value;
  }
}

function formatRange(block: TranscriptBlock) {
  if (block.startMs == null && block.endMs == null) return "";
  return `${formatTime(block.startMs)} - ${formatTime(block.endMs)}`;
}

function formatTime(ms?: number | null) {
  if (ms == null) return "--:--";
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  const rest = String(seconds % 60).padStart(2, "0");
  return `${minutes}:${rest}`;
}
