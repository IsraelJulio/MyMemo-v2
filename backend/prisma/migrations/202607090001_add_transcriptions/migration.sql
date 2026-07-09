CREATE TYPE "TranscriptionStatus" AS ENUM (
  'PENDING',
  'DOWNLOADING',
  'CONVERTING',
  'TRANSCRIBING',
  'SEGMENTING',
  'TRANSLATING',
  'COMPLETED',
  'FAILED',
  'CANCELED'
);

CREATE TABLE "TranscriptionJob" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "sourceUrl" TEXT NOT NULL,
  "sourceUrlHash" TEXT NOT NULL,
  "sourceTitle" TEXT,
  "sourceLanguage" TEXT,
  "detectedLanguage" TEXT,
  "targetLanguage" TEXT NOT NULL DEFAULT 'pt-BR',
  "status" "TranscriptionStatus" NOT NULL DEFAULT 'PENDING',
  "progress" INTEGER NOT NULL DEFAULT 0,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  CONSTRAINT "TranscriptionJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TranscriptBlock" (
  "id" TEXT NOT NULL,
  "transcriptionJobId" TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  "startMs" INTEGER,
  "endMs" INTEGER,
  "originalText" TEXT NOT NULL,
  "translatedText" TEXT,
  "confidence" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TranscriptBlock_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TranscriptionJob_userId_idx" ON "TranscriptionJob"("userId");
CREATE INDEX "TranscriptionJob_status_idx" ON "TranscriptionJob"("status");
CREATE INDEX "TranscriptionJob_sourceUrlHash_idx" ON "TranscriptionJob"("sourceUrlHash");
CREATE INDEX "TranscriptionJob_createdAt_idx" ON "TranscriptionJob"("createdAt");
CREATE INDEX "TranscriptBlock_transcriptionJobId_idx" ON "TranscriptBlock"("transcriptionJobId");
CREATE UNIQUE INDEX "TranscriptBlock_transcriptionJobId_order_key" ON "TranscriptBlock"("transcriptionJobId", "order");

ALTER TABLE "TranscriptionJob" ADD CONSTRAINT "TranscriptionJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TranscriptBlock" ADD CONSTRAINT "TranscriptBlock_transcriptionJobId_fkey" FOREIGN KEY ("transcriptionJobId") REFERENCES "TranscriptionJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
