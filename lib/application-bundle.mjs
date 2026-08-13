import { createHash } from "node:crypto";
import { basename } from "node:path";

import { assertVacancyId, writePrivateJson } from "./vacancy-snapshot.mjs";

const APPLICATION_ID = /^application-[a-f0-9]{64}$/;
const REUSE_DECISIONS = new Set(["new", "revised", "reused"]);

function requiredText(value, field) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} deve ser texto não vazio.`);
  return value.normalize("NFKC").replace(/\r\n?/g, "\n").trim();
}

function normalizeAnswers(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("answers deve ser um objeto.");
  const entries = Object.entries(value).map(([question, answer]) => [
    requiredText(question, "Pergunta"),
    requiredText(answer, `Resposta para ${question}`),
  ]).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  if (new Set(entries.map(([question]) => question)).size !== entries.length) throw new Error("answers não pode ter perguntas duplicadas.");
  return Object.fromEntries(entries);
}

function normalizeAttachmentNames(value) {
  if (!Array.isArray(value)) throw new Error("attachmentNames deve ser uma lista.");
  const names = value.map((name) => {
    if (typeof name !== "string" || !name || name === "." || name === ".." || basename(name) !== name || /[\\/\0-\x1f]/.test(name)) {
      throw new Error("Nome de anexo inválido; informe somente o nome do arquivo.");
    }
    return name;
  });
  if (new Set(names).size !== names.length) throw new Error("attachmentNames não pode ter duplicatas.");
  return names.sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
}

function createdAt(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("createdAt deve ser uma data válida.");
  return date.toISOString();
}

export function assertApplicationId(value) {
  if (typeof value !== "string" || !APPLICATION_ID.test(value)) throw new Error("ID de bundle de candidatura inválido.");
  return value;
}

export function buildApplicationBundle({
  sourceSnapshotId,
  tailoredCv,
  message,
  answers,
  attachmentNames,
  revision,
  reuseDecision,
  createdAt: creationTime = new Date(),
}) {
  assertVacancyId(sourceSnapshotId);
  if (!Number.isSafeInteger(revision) || revision < 1) throw new Error("revision deve ser inteiro positivo.");
  if (!REUSE_DECISIONS.has(reuseDecision)) throw new Error("reuseDecision deve ser new, revised ou reused.");

  const stableContent = {
    sourceSnapshotId,
    tailoredCv: requiredText(tailoredCv, "tailoredCv"),
    message: requiredText(message, "message"),
    answers: normalizeAnswers(answers),
    attachmentNames: normalizeAttachmentNames(attachmentNames),
    revision,
    reuseDecision,
  };
  const digest = createHash("sha256").update(JSON.stringify(stableContent), "utf8").digest("hex");

  return {
    schemaVersion: 1,
    id: `application-${digest}`,
    createdAt: createdAt(creationTime),
    ...stableContent,
  };
}

export async function saveApplicationBundle(input, { baseDir = process.cwd(), replace = false } = {}) {
  const bundle = buildApplicationBundle(input);
  return writePrivateJson({
    baseDir,
    relativeDirectory: "data/applications",
    id: bundle.id,
    validateId: assertApplicationId,
    value: bundle,
    replace,
  });
}
