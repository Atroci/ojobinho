import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { criarBuscas, identificarPortal } from "../adapters/portais.mjs";
import { diagnosticar, iniciar, registrarVaga } from "../ojobinho.mjs";

async function projetoTemporario() {
  const base = await mkdtemp(join(tmpdir(), "ojobinho-"));
  await mkdir(join(base, "config"), { recursive: true });
  await mkdir(join(base, "data"), { recursive: true });
  await writeFile(join(base, "config/perfil.example.md"), "perfil\n");
  await writeFile(join(base, "curriculo.example.md"), "currículo\n");
  await writeFile(join(base, "tracker.example.csv"), "status\n");
  await writeFile(join(base, "data/pipeline.example.md"), "# Pipeline\n");
  return base;
}

test("iniciar cria dados locais sem sobrescrever arquivos existentes", async () => {
  const base = await projetoTemporario();
  await writeFile(join(base, "curriculo.md"), "meu currículo\n");

  const criados = await iniciar(base);

  assert.deepEqual(criados, ["config/perfil.md", "tracker.csv", "data/pipeline.md"]);
  assert.equal(await readFile(join(base, "curriculo.md"), "utf8"), "meu currículo\n");
  assert.deepEqual(await diagnosticar(base), []);
});

test("registrarVaga aceita web, rejeita outros protocolos e deixa prova no pipeline", async () => {
  const base = await projetoTemporario();
  await iniciar(base);

  await registrarVaga("https://empresa.com/vagas/123", base, new Date("2026-08-13T12:00:00Z"));
  const pipeline = await readFile(join(base, "data/pipeline.md"), "utf8");

  assert.match(pipeline, /2026-08-13 \| https:\/\/empresa\.com\/vagas\/123/);
  await assert.rejects(() => registrarVaga("file:///etc/passwd", base), /http ou https/);
  await assert.rejects(() => registrarVaga("não é link", base), /URL válida/);
});

test("adaptadores reconhecem portais, buscam sem scraping e mantêm envio humano", () => {
  const linkedin = identificarPortal("https://br.linkedin.com/jobs/view/123");
  assert.equal(linkedin.id, "linkedin");
  assert.match(linkedin.orientacao, /envie manualmente/);

  const generico = identificarPortal("https://carreiras.empresa.com/vaga/123");
  assert.equal(generico.id, "generico");
  assert.equal(generico.conhecido, false);
  assert.equal(identificarPortal("https://linkedin.com.exemplo.net/vaga").id, "generico");
  assert.throws(() => identificarPortal("file:///etc/passwd"), /http ou https/);

  const buscas = criarBuscas("designer remoto Brasil");
  assert.ok(buscas.length >= 10);
  assert.equal(new URL(buscas[0].url).searchParams.get("q"), "site:linkedin.com designer remoto Brasil");
  assert.throws(() => criarBuscas(" "), /Informe cargo/);
});
