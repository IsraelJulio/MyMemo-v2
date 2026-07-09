import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { CreateListFromTranscriptionInput, CreateListMode, CreateTranscriptionJobInput, UpdateTranscriptBlockInput } from "./transcriptions.types.js";

const sourceLanguages = new Set(["auto", "en", "pt", "es"]);
const defaultTargetLanguages = ["pt-BR", "en", "es"];

export class TranscriptionRequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function requestError(status: number, message: string): never {
  throw new TranscriptionRequestError(status, message);
}

export function transcriptionConfig() {
  return {
    maxPendingPerUser: readInt("TRANSCRIPTION_MAX_PENDING_PER_USER", 3),
    maxUrlLength: readInt("TRANSCRIPTION_MAX_URL_LENGTH", 2000),
    allowedTargetLanguages: readCsv("TRANSCRIPTION_ALLOWED_TARGET_LANGUAGES", defaultTargetLanguages),
    createListMaxBlocks: readInt("TRANSCRIPTION_CREATE_LIST_MAX_BLOCKS", 300)
  };
}

export async function validateCreateJobInput(input: CreateTranscriptionJobInput) {
  const config = transcriptionConfig();
  const sourceUrl = await validatePublicSourceUrl(input.url, config.maxUrlLength);
  const sourceLanguage = normalizeSourceLanguage(input.sourceLanguage);
  const targetLanguage = normalizeTargetLanguage(input.targetLanguage, config.allowedTargetLanguages);

  return { sourceUrl, sourceLanguage, targetLanguage };
}

export function validateUpdateBlockInput(input: UpdateTranscriptBlockInput) {
  const data: { originalText?: string; translatedText?: string } = {};

  if (Object.hasOwn(input, "originalText")) data.originalText = normalizeRequiredText(input.originalText, "Texto original");
  if (Object.hasOwn(input, "translatedText")) data.translatedText = normalizeRequiredText(input.translatedText, "Traducao");
  if (!Object.keys(data).length) requestError(400, "Informe o texto original ou a traducao para editar.");

  return data;
}

export function validateCreateListInput(input: CreateListFromTranscriptionInput) {
  const title = normalizeRequiredText(input.title, "Titulo da lista").slice(0, 120);
  const mode = String(input.mode ?? "ORIGINAL_TO_TRANSLATION");

  if (mode !== "ORIGINAL_TO_TRANSLATION" && mode !== "TRANSLATION_TO_ORIGINAL") {
    requestError(400, "Modo de criacao de cards invalido.");
  }

  return { title, mode: mode as CreateListMode };
}

async function validatePublicSourceUrl(value: unknown, maxLength: number) {
  if (typeof value !== "string" || !value.trim()) requestError(400, "Informe uma URL publica de video ou audio.");

  const trimmed = value.trim();
  if (trimmed.length > maxLength) requestError(400, `A URL deve ter no maximo ${maxLength} caracteres.`);

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    requestError(400, "URL invalida.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    requestError(400, "A URL deve usar http ou https.");
  }
  if (parsed.username || parsed.password) {
    requestError(400, "URLs com usuario ou senha nao sao permitidas.");
  }

  const hostname = normalizeHostname(parsed.hostname);
  if (isBlockedHostname(hostname)) requestError(400, "URLs locais nao sao permitidas.");
  if (isPrivateAddress(hostname)) requestError(400, "URLs para IPs privados ou locais nao sao permitidas.");

  if (!isIP(hostname)) {
    const addresses = await resolveHost(hostname);
    if (!addresses.length || addresses.some((address) => isPrivateAddress(address))) {
      requestError(400, "Nao foi possivel validar a URL como um endereco publico.");
    }
  }

  return parsed.href;
}

async function resolveHost(hostname: string) {
  try {
    const records = await lookup(hostname, { all: true, verbatim: true });
    return records.map((record) => normalizeHostname(record.address));
  } catch {
    requestError(400, "Nao foi possivel validar o host da URL.");
  }
}

function normalizeSourceLanguage(value: unknown) {
  const sourceLanguage = String(value ?? "auto").trim().toLowerCase();
  if (!sourceLanguages.has(sourceLanguage)) requestError(400, "Idioma original invalido.");
  return sourceLanguage;
}

function normalizeTargetLanguage(value: unknown, allowedLanguages: string[]) {
  const requested = String(value ?? "pt-BR").trim();
  const match = allowedLanguages.find((language) => language.toLowerCase() === requested.toLowerCase());
  if (!match) requestError(400, `Idioma destino invalido. Permitidos: ${allowedLanguages.join(", ")}.`);
  return match;
}

function normalizeRequiredText(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) requestError(400, `${label} nao pode ficar vazio.`);
  return value.trim();
}

function readInt(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function readCsv(name: string, fallback: string[]) {
  const value = process.env[name];
  if (!value) return fallback;
  const parsed = value.split(",").map((item) => item.trim()).filter(Boolean);
  return parsed.length ? parsed : fallback;
}

function normalizeHostname(hostname: string) {
  return hostname.toLowerCase().replace(/^\[/, "").replace(/\]$/, "").replace(/\.$/, "");
}

function isBlockedHostname(hostname: string) {
  return hostname === "localhost" || hostname.endsWith(".localhost");
}

function isPrivateAddress(address: string) {
  const normalized = normalizeHostname(address);
  const version = isIP(normalized);

  if (version === 4) return isPrivateIpv4(normalized);
  if (version === 6) return isPrivateIpv6(normalized);

  return false;
}

function isPrivateIpv4(address: string) {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return true;

  const [a, b] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isPrivateIpv6(address: string) {
  const normalized = address.toLowerCase();
  if (normalized === "::" || normalized === "::1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (normalized.startsWith("fe80:")) return true;
  if (normalized.startsWith("::ffff:")) return isPrivateIpv4(normalized.replace("::ffff:", ""));
  return false;
}
