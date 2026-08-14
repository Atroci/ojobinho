import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { criarBuscas, identificarPortal } from "../adapters/portais.mjs";
import { diagnosticar, iniciar, main, registrarVaga } from "../ojobinho.mjs";

async function projetoTemporario() {
  const base = await mkdtemp(join(tmpdir(), "ojobinho-"));
  await mkdir(join(base, "config"), { recursive: true });
  await mkdir(join(base, "data"), { recursive: true });
  await writeFile(join(base, "config/perfil.example.md"), "perfil\n");
  await writeFile(join(base, "config/fontes.example.json"), '{"fontes":[]}\n');
  await writeFile(join(base, "curriculo.example.md"), "currículo\n");
  await writeFile(join(base, "tracker.example.csv"), "status\n");
  await writeFile(join(base, "data/pipeline.example.md"), "# Pipeline\n");
  return base;
}

test("iniciar cria dados locais sem sobrescrever arquivos existentes", async () => {
  const base = await projetoTemporario();
  await writeFile(join(base, "curriculo.md"), "meu currículo\n");

  const criados = await iniciar(base);

  assert.deepEqual(criados, ["config/perfil.md", "config/fontes.json", "tracker.csv", "data/pipeline.md"]);
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

test("CLI cria snapshot somente por entrada privada e calcula próximo contato", async () => {
  const base = await projetoTemporario();
  const logs = [];
  const io = { log: (valor) => logs.push(valor) };
  await mkdir(join(base, "data/input"), { recursive: true });
  await writeFile(join(base, "data/input/vaga.json"), JSON.stringify({
    sourceUrl: "https://empresa.com/vagas/123",
    text: "Pessoa desenvolvedora\nRemoto Brasil",
    capturedAt: "2026-08-13T12:00:00Z",
  }));

  await main(["capturar", "data/input/vaga.json"], io, base);
  assert.match(logs[0], /^Snapshot local: vacancy-[a-f0-9]{64}$/);
  const snapshotId = logs[0].split(": ")[1];
  await writeFile(join(base, "data/input/pacote.json"), JSON.stringify({
    sourceSnapshotId: snapshotId,
    tailoredCv: "Currículo revisado",
    message: "Mensagem revisada",
    answers: {},
    attachmentNames: ["curriculo.pdf"],
    revision: 1,
    reuseDecision: "new",
    createdAt: "2026-08-13T13:00:00Z",
  }));
  await main(["pacote", "data/input/pacote.json"], io, base);
  assert.match(logs[1], /^Pacote local: application-[a-f0-9]{64}$/);
  const applicationId = logs[1].split(": ")[1];
  await writeFile(join(base, "data/input/evento.json"), JSON.stringify({ data: "2026-08-13T14:00:00Z", status: "triagem" }));
  await main(["historico", applicationId, "data/input/evento.json"], io, base);
  assert.equal(logs[2], `Evento local registrado: ${applicationId}`);
  await main(["proximo", "candidatura-enviada", "2026-08-14", "0"], io, base);
  assert.equal(logs[3], "2026-08-21");
  await assert.rejects(() => main(["capturar", "../vaga.json"], io, base), /data\/input/);
  await writeFile(join(base, "segredo.json"), JSON.stringify({ sourceUrl: "https://example.com", text: "segredo" }));
  await symlink(join(base, "segredo.json"), join(base, "data/input/link.json"));
  await assert.rejects(() => main(["capturar", "data/input/link.json"], io, base), /arquivo regular/);
});
