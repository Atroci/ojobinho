import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { validateEnvelope } from "../evals/contract.mjs";
import { replay } from "../evals/replay.mjs";

const fixtures = JSON.parse(await readFile(new URL("../evals/fixtures.json", import.meta.url)));
const expected = JSON.parse(await readFile(new URL("../evals/expected.json", import.meta.url)));

test("goldens cobrem fatos brasileiros congelados", () => {
  validateEnvelope(expected);
  assert.equal(fixtures.synthetic, true);
  assert.deepEqual(fixtures.cases.map(({ id }) => id), expected.results.map(({ caseId }) => caseId));
  const byId = Object.fromEntries(expected.results.map((result) => [result.caseId, result]));
  assert.equal(byId["clt-salario-aberto"].facts.contract, "CLT");
  assert.equal(byId["pj-mei-ambiguo"].facts.mei, "AMBIGUOUS");
  assert.equal(byId["salario-oculto"].facts.salary.visibility, "HIDDEN");
  assert.deepEqual(byId["remoto-territorio-restrito"].blockers, ["TERRITORY"]);
  assert.deepEqual(byId["autorizacao-trabalho-ausente"].blockers, ["AUTHORIZATION"]);
  assert.deepEqual(byId["registro-profissional-ausente"].blockers, ["REGULATION"]);
  assert.deepEqual(byId["sinais-fraude-recrutamento"].blockers, ["LEGITIMACY"]);
});

test("replay aceita golden e detecta fato divergente", () => {
  assert.deepEqual(replay(expected, structuredClone(expected)), { ok: true, checked: 7, errors: [] });
  const wrong = structuredClone(expected);
  wrong.results[0].facts.salary.amount = 5300;
  assert.deepEqual(replay(expected, wrong).errors, ["clt-salario-aberto: resultado divergente"]);
});

test("validador detecta drift de schema", () => {
  const drifted = structuredClone(expected);
  drifted.results[0].facts.newField = true;
  assert.throws(() => validateEnvelope(drifted), /campos esperados/);
});

test("replay CLI funciona sem rede", () => {
  const run = spawnSync(process.execPath, ["evals/replay.mjs", "evals/expected.json"], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stdout, "OK: 7 casos\n");
});
