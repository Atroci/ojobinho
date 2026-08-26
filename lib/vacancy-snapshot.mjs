import { createHash, randomUUID } from "node:crypto";
import { link, mkdir, realpath, rename, unlink, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";

const VACANCY_ID = /^vacancy-[a-f0-9]{64}$/;

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function isoTime(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("capturedAt deve ser uma data válida.");
  return date.toISOString();
}

export function normalizeVacancyText(value) {
  if (typeof value !== "string") throw new TypeError("text deve ser uma string.");

  const lines = value
    .normalize("NFKC")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim().replace(/[\t\v\f ]+/g, " "));

  while (lines[0] === "") lines.shift();
  while (lines.at(-1) === "") lines.pop();

  const normalized = lines.filter((line, index) => line !== "" || lines[index - 1] !== "").join("\n");
  if (!normalized) throw new Error("text não pode ficar vazio.");
  return normalized;
}

export function canonicalSourceUrl(value) {
  if (typeof value !== "string") throw new Error("sourceUrl deve ser uma URL válida.");
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("sourceUrl deve ser uma URL válida.");
  }
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("sourceUrl deve usar http ou https.");
  if (url.username || url.password) throw new Error("sourceUrl não pode conter credenciais.");
  url.hash = "";
  return url.href;
}

/**
 * Agrupa snapshots com o mesmo conteúdo (mesmo contentSha256) publicados sob
 * URLs canônicas diferentes — sinal de anúncio distribuído em massa. Não é
 * acusação de fraude: apenas descreve como a vaga circula.
 */
export function agruparConteudoDuplicado(snapshots) {
  if (!Array.isArray(snapshots)) throw new TypeError("snapshots deve ser um array.");
  const grupos = new Map();

  for (const snapshot of snapshots) {
    if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
      throw new TypeError("cada snapshot deve ser um objeto.");
    }
    assertVacancyId(snapshot.id);
    const url = canonicalSourceUrl(snapshot.sourceUrl);
    const entradas = grupos.get(snapshot.contentSha256) ?? [];
    entradas.push({ id: snapshot.id, url });
    grupos.set(snapshot.contentSha256, entradas);
  }

  return [...grupos.entries()]
    .filter(([, entradas]) => entradas.length > 1)
    .map(([contentSha256, snapshots]) => ({ contentSha256, snapshots }))
    .sort((a, b) => b.snapshots.length - a.snapshots.length || (a.contentSha256 < b.contentSha256 ? -1 : 1));
}

export function assertVacancyId(value) {
  if (typeof value !== "string" || !VACANCY_ID.test(value)) throw new Error("ID de snapshot de vaga inválido.");
  return value;
}

export function buildVacancySnapshot({ sourceUrl, text, capturedAt = new Date() }) {
  const content = normalizeVacancyText(text);
  const canonicalUrl = canonicalSourceUrl(sourceUrl);
  const contentSha256 = sha256(content);
  const id = `vacancy-${sha256(`${canonicalUrl}\n${content}`)}`;

  return {
    schemaVersion: 1,
    id,
    sourceUrl: canonicalUrl,
    capturedAt: isoTime(capturedAt),
    contentSha256,
    content,
  };
}

async function privateDirectory(baseDir, relativeDirectory) {
  if (typeof baseDir !== "string" || !baseDir) throw new Error("baseDir inválido.");
  const base = await realpath(resolve(baseDir));
  let directory = base;

  for (const part of relativeDirectory.split("/")) {
    directory = resolve(directory, part);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    directory = await realpath(directory);
    const fromBase = relative(base, directory);
    if (fromBase.startsWith("..") || isAbsolute(fromBase)) throw new Error("Diretório privado fora do projeto.");
  }

  return directory;
}

export async function writePrivateJson({ baseDir, relativeDirectory, id, validateId, value, replace = false }) {
  if (!["data/vacancies", "data/applications"].includes(relativeDirectory)) throw new Error("Diretório privado inválido.");
  validateId(id);
  if (typeof replace !== "boolean") throw new TypeError("replace deve ser booleano.");

  const directory = await privateDirectory(baseDir, relativeDirectory);
  const target = join(directory, `${id}.json`);
  const temporary = join(directory, `.${id}.${process.pid}.${randomUUID()}.tmp`);

  try {
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
    if (replace) {
      await rename(temporary, target);
    } else {
      await link(temporary, target);
      await unlink(temporary);
    }
  } catch (error) {
    try {
      await unlink(temporary);
    } catch (cleanupError) {
      if (cleanupError.code !== "ENOENT") throw cleanupError;
    }
    if (error.code === "EEXIST") {
      const existing = new Error(`Arquivo já existe: ${id}.json`, { cause: error });
      existing.code = "EEXIST";
      throw existing;
    }
    throw error;
  }

  return value;
}

export async function saveVacancySnapshot(input, { baseDir = process.cwd(), replace = false } = {}) {
  const snapshot = buildVacancySnapshot(input);
  return writePrivateJson({
    baseDir,
    relativeDirectory: "data/vacancies",
    id: snapshot.id,
    validateId: assertVacancyId,
    value: snapshot,
    replace,
  });
}
