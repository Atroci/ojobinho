import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  arquivosPessoaisRastreados,
  SAFE_HANDLING,
  validarContrato,
  validarTratamento,
} from "../scripts/security/validate.mjs";

const base = fileURLToPath(new URL("..", import.meta.url));

test("fixtures adversariais exigem o mesmo tratamento seguro", async () => {
  const pasta = join(base, "test/fixtures/untrusted");
  const nomes = (await readdir(pasta)).filter((nome) => nome.endsWith(".json"));

  assert.equal(nomes.length, 4);
  for (const nome of nomes) {
    const fixture = JSON.parse(await readFile(join(pasta, nome), "utf8"));
    assert.doesNotThrow(() => validarTratamento(fixture));
    assert.deepEqual(fixture.tratamentoEsperado, SAFE_HANDLING);
  }
  assert.throws(
    () =>
      validarTratamento({
        id: "decisao-insegura",
        categoria: "uso-de-ferramentas",
        origem: "web",
        conteudo: "conteúdo externo",
        tratamentoEsperado: { ...SAFE_HANDLING, executarFerramentasOuEfeitosExternos: true },
      }),
    /não preserva o contrato seguro/,
  );
  await validarContrato(base);
});

test("guard rejeita dados locais e permite somente artefatos sintéticos", () => {
  const rastreados = [
    "config/perfil.md",
    "curriculo.md",
    "tracker.csv",
    "data/pipeline.md",
    "reports/2026-08-13-empresa-cargo.md",
    "output/empresa-cargo-curriculo.md",
    "data/vagas/empresa.json",
    "applications/empresa/formulario.md",
    "entrevistas/empresa/notas.md",
    "data/vacancy-snapshot-empresa.json",
    "interview-notes-empresa.md",
    "config/perfil.example.md",
    "curriculo.example.md",
    "data/pipeline.example.md",
    "tracker.example.csv",
    "reports/.gitkeep",
    "test/fixtures/untrusted/email.json",
  ];

  assert.deepEqual(arquivosPessoaisRastreados(rastreados), rastreados.slice(0, 11));
});
