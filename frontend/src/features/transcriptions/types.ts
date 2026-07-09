export type TranscriptionStatus =
  | "PENDING"
  | "DOWNLOADING"
  | "CONVERTING"
  | "TRANSCRIBING"
  | "SEGMENTING"
  | "TRANSLATING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELED";

export type TranscriptionJob = {
  id: string;
  sourceUrl: string;
  sourceTitle?: string | null;
  sourceLanguage?: string | null;
  detectedLanguage?: string | null;
  targetLanguage: string;
  status: TranscriptionStatus;
  progress: number;
  errorMessage?: string | null;
  createdAt: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  _count?: { blocks: number };
};

export type TranscriptBlock = {
  id: string;
  transcriptionJobId: string;
  order: number;
  startMs?: number | null;
  endMs?: number | null;
  originalText: string;
  translatedText?: string | null;
  confidence?: number | null;
};

export type CreateListMode = "ORIGINAL_TO_TRANSLATION" | "TRANSLATION_TO_ORIGINAL";
