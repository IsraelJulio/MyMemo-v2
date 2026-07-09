import { createHash } from "node:crypto";
import { prisma } from "../../prisma.js";
import { activeTranscriptionStatuses, type CreateListFromTranscriptionInput, type CreateTranscriptionJobInput, type UpdateTranscriptBlockInput } from "./transcriptions.types.js";
import { requestError, transcriptionConfig, validateCreateJobInput, validateCreateListInput, validateUpdateBlockInput } from "./transcriptions.validation.js";

const jobSelect = {
  id: true,
  userId: true,
  sourceUrl: true,
  sourceTitle: true,
  sourceLanguage: true,
  detectedLanguage: true,
  targetLanguage: true,
  status: true,
  progress: true,
  errorMessage: true,
  createdAt: true,
  startedAt: true,
  finishedAt: true,
  _count: { select: { blocks: true } }
} as const;

export async function createTranscriptionJob(userId: string, input: CreateTranscriptionJobInput) {
  const { sourceUrl, sourceLanguage, targetLanguage } = await validateCreateJobInput(input);
  const config = transcriptionConfig();
  const activeJobs = await prisma.transcriptionJob.count({
    where: { userId, status: { in: activeTranscriptionStatuses } }
  });

  if (activeJobs >= config.maxPendingPerUser) {
    requestError(429, `Voce ja possui ${activeJobs} transcricoes pendentes ou em processamento.`);
  }

  return prisma.transcriptionJob.create({
    data: {
      userId,
      sourceUrl,
      sourceUrlHash: createHash("sha256").update(sourceUrl).digest("hex"),
      sourceLanguage,
      targetLanguage,
      status: "PENDING",
      progress: 0
    },
    select: jobSelect
  });
}

export async function listTranscriptionJobs(userId: string) {
  return prisma.transcriptionJob.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: jobSelect
  });
}

export async function getTranscriptionJob(userId: string, jobId: string) {
  const job = await prisma.transcriptionJob.findFirst({
    where: { id: jobId, userId },
    select: jobSelect
  });

  if (!job) requestError(404, "Transcricao nao encontrada.");
  return job;
}

export async function listTranscriptBlocks(userId: string, jobId: string) {
  await getTranscriptionJob(userId, jobId);

  return prisma.transcriptBlock.findMany({
    where: { transcriptionJobId: jobId },
    orderBy: { order: "asc" }
  });
}

export async function updateTranscriptBlock(userId: string, blockId: string, input: UpdateTranscriptBlockInput) {
  const data = validateUpdateBlockInput(input);
  const block = await prisma.transcriptBlock.findFirst({
    where: { id: blockId, job: { userId } },
    select: { id: true }
  });

  if (!block) requestError(404, "Bloco de transcricao nao encontrado.");

  return prisma.transcriptBlock.update({
    where: { id: block.id },
    data
  });
}

export async function createListFromTranscription(userId: string, jobId: string, input: CreateListFromTranscriptionInput) {
  const { title, mode } = validateCreateListInput(input);
  const { createListMaxBlocks } = transcriptionConfig();

  return prisma.$transaction(async (tx) => {
    const job = await tx.transcriptionJob.findFirst({
      where: { id: jobId, userId },
      include: { blocks: { orderBy: { order: "asc" }, take: createListMaxBlocks + 1 } }
    });

    if (!job) requestError(404, "Transcricao nao encontrada.");
    if (job.status !== "COMPLETED") requestError(409, "A transcricao precisa estar concluida para criar cards.");

    const blocks = job.blocks
      .map((block) => ({
        originalText: block.originalText.trim(),
        translatedText: block.translatedText?.trim() ?? ""
      }))
      .filter((block) => block.originalText && block.translatedText);

    if (!blocks.length) requestError(400, "Nao ha blocos com texto original e traducao para criar cards.");
    if (blocks.length > createListMaxBlocks) requestError(400, `Selecione no maximo ${createListMaxBlocks} blocos para criar cards.`);

    const list = await tx.studyList.create({
      data: {
        title,
        color: "#0ea5e9",
        cards: {
          create: blocks.map((block) => (
            mode === "ORIGINAL_TO_TRANSLATION"
              ? { front: block.originalText, back: block.translatedText }
              : { front: block.translatedText, back: block.originalText }
          ))
        }
      },
      include: { cards: true, _count: { select: { cards: true } } }
    });

    return { list, cardCount: blocks.length };
  });
}
