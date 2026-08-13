import { readFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";

import { validateEnvelope } from "./contract.mjs";

export function replay(expected, actual) {
  validateEnvelope(expected, "expected");
  validateEnvelope(actual, "actual");
  const expectedById = new Map(expected.results.map((result) => [result.caseId, result]));
  const actualById = new Map(actual.results.map((result) => [result.caseId, result]));
  const errors = [];

  for (const id of expectedById.keys()) {
    if (!actualById.has(id)) errors.push(`${id}: ausente`);
    else if (!isDeepStrictEqual(actualById.get(id), expectedById.get(id))) errors.push(`${id}: resultado divergente`);
  }
  for (const id of actualById.keys()) if (!expectedById.has(id)) errors.push(`${id}: caso inesperado`);
  return { ok: errors.length === 0, checked: expectedById.size, errors };
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function main() {
  const actualPath = process.argv[2];
  if (!actualPath) {
    console.error("Uso: node evals/replay.mjs <resultados.json>");
    process.exitCode = 2;
    return;
  }
  const expected = await readJson(fileURLToPath(new URL("expected.json", import.meta.url)));
  const result = replay(expected, await readJson(actualPath));
  if (result.ok) console.log(`OK: ${result.checked} casos`);
  else {
    result.errors.forEach((error) => console.error(error));
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
