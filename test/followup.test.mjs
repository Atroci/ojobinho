import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { calcularProximoFollowUp, registrarEvento } from "../lib/followup.mjs";

test("cadência usa dias úteis, limita follow-ups e para em status terminal", () => {
  assert.equal(
    calcularProximoFollowUp({ status: "candidatura-enviada", dataReferencia: "2026-08-14", followUps: 0 }),
    "2026-08-21",
  );
  assert.equal(calcularProximoFollowUp({ status: "entrevista", dataReferencia: "2026-08-13", followUps: 1 }), "2026-08-20");
  assert.equal(calcularProximoFollowUp({ status: "candidatura-enviada", dataReferencia: "2026-08-13", followUps: 2 }), null);
  assert.equal(calcularProximoFollowUp({ status: "reprovado", dataReferencia: "2026-08-13" }), null);
});

test("histórico local valida entrada e grava JSONL sem executar ação externa", async () => {
  const base = await mkdtemp(join(tmpdir(), "ojobinho-history-"));
  await registrarEvento("acme-dev-123", { data: "2026-08-13T12:00:00Z", status: "entrevista", observacao: "Conversa marcada" }, base);

  const linha = JSON.parse(await readFile(join(base, "data/history/acme-dev-123.jsonl"), "utf8"));
  assert.deepEqual(linha, { data: "2026-08-13T12:00:00.000Z", status: "entrevista", observacao: "Conversa marcada" });
  await assert.rejects(() => registrarEvento("../segredo", { data: "2026-08-13", status: "triagem" }, base), /ID/);
  await assert.rejects(() => registrarEvento("acme", { data: "2026-08-13", status: "enviado-automaticamente" }, base), /Status/);
});
