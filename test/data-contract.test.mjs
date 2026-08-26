import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { buildApplicationBundle, saveApplicationBundle } from "../lib/application-bundle.mjs";
import { agruparConteudoDuplicado, buildVacancySnapshot, saveVacancySnapshot } from "../lib/vacancy-snapshot.mjs";

const VACANCY = {
  sourceUrl: "HTTPS://EXAMPLE.COM:443/jobs/42#apply",
  text: "  Pessoa Desenvolvedora\r\n\r\n\tNode.js  20  \r\n",
};

function application(snapshotId, createdAt = "2026-08-13T13:00:00Z") {
  return {
    sourceSnapshotId: snapshotId,
    tailoredCv: "Currículo adaptado\n",
    message: "Olá, segue minha candidatura.\n",
    answers: { Disponibilidade: "Imediata", Pretensão: "A combinar" },
    attachmentNames: ["portfolio.pdf", "curriculo.pdf"],
    revision: 1,
    reuseDecision: "new",
    createdAt,
  };
}

test("snapshot normaliza conteúdo e mantém ID determinístico", () => {
  const first = buildVacancySnapshot({ ...VACANCY, capturedAt: "2026-08-13T10:00:00-03:00" });
  const second = buildVacancySnapshot({ ...VACANCY, capturedAt: "2026-08-14T10:00:00Z" });

  assert.equal(first.id, second.id);
  assert.equal(first.contentSha256, second.contentSha256);
  assert.equal(first.sourceUrl, "https://example.com/jobs/42");
  assert.equal(first.capturedAt, "2026-08-13T13:00:00.000Z");
  assert.equal(first.content, "Pessoa Desenvolvedora\n\nNode.js 20");
});

test("snapshot rejeita URL inválida ou não web", () => {
  assert.throws(() => buildVacancySnapshot({ ...VACANCY, sourceUrl: "file:///etc/passwd" }), /http ou https/);
  assert.throws(() => buildVacancySnapshot({ ...VACANCY, sourceUrl: "não é URL" }), /URL válida/);
  assert.throws(() => buildVacancySnapshot({ ...VACANCY, sourceUrl: "https://user:secret@example.com/job" }), /credenciais/);
});

test("bundle tem ID estável e rejeita IDs e caminhos maliciosos", () => {
  const snapshot = buildVacancySnapshot({ ...VACANCY, capturedAt: "2026-08-13T13:00:00Z" });
  const first = buildApplicationBundle(application(snapshot.id));
  const reordered = application(snapshot.id, "2026-08-14T13:00:00Z");
  reordered.answers = { Pretensão: "A combinar", Disponibilidade: "Imediata" };
  reordered.attachmentNames.reverse();

  assert.equal(first.id, buildApplicationBundle(reordered).id);
  assert.throws(() => buildApplicationBundle(application("../../vacancy-deadbeef")), /snapshot de vaga inválido/);
  assert.throws(() => buildApplicationBundle({ ...application(snapshot.id), attachmentNames: ["../curriculo.pdf"] }), /anexo inválido/);
  assert.throws(() => buildApplicationBundle({ ...application(snapshot.id), attachmentNames: ["pasta\\curriculo.pdf"] }), /anexo inválido/);
});

test("grava somente em diretórios privados e não sobrescreve sem replace", async () => {
  const baseDir = await mkdtemp(join(tmpdir(), "ojobinho-data-"));
  const snapshot = await saveVacancySnapshot({ ...VACANCY, capturedAt: "2026-08-13T13:00:00Z" }, { baseDir });
  const bundle = await saveApplicationBundle(application(snapshot.id), { baseDir });

  const savedSnapshot = JSON.parse(await readFile(join(baseDir, "data/vacancies", `${snapshot.id}.json`), "utf8"));
  const savedBundle = JSON.parse(await readFile(join(baseDir, "data/applications", `${bundle.id}.json`), "utf8"));
  assert.equal(savedSnapshot.id, snapshot.id);
  assert.equal(savedBundle.sourceSnapshotId, snapshot.id);

  await assert.rejects(() => saveApplicationBundle(application(snapshot.id), { baseDir }), /já existe/);
  await saveApplicationBundle(application(snapshot.id, "2026-08-15T13:00:00Z"), { baseDir, replace: true });
  const replaced = JSON.parse(await readFile(join(baseDir, "data/applications", `${bundle.id}.json`), "utf8"));
  assert.equal(replaced.createdAt, "2026-08-15T13:00:00.000Z");
});

test("agrupa a mesma descrição publicada sob URLs diferentes", () => {
  const sp = buildVacancySnapshot({ ...VACANCY, sourceUrl: "https://empresa.com/vagas/1", capturedAt: "2026-08-13T13:00:00Z" });
  const rj = buildVacancySnapshot({ ...VACANCY, sourceUrl: "https://empresa.com/vagas/2#detalhes", capturedAt: "2026-08-14T13:00:00Z" });
  const outra = buildVacancySnapshot({
    ...VACANCY,
    text: `${VACANCY.text}\nPessoa Analista de Dados`,
    sourceUrl: "https://empresa.com/vagas/3",
    capturedAt: "2026-08-15T13:00:00Z",
  });

  assert.notEqual(sp.id, rj.id);
  const grupos = agruparConteudoDuplicado([sp, rj, outra]);
  assert.equal(grupos.length, 1);
  assert.equal(grupos[0].contentSha256, sp.contentSha256);
  assert.deepEqual(grupos[0].snapshots.map((s) => s.url), ["https://empresa.com/vagas/1", "https://empresa.com/vagas/2"]);

  assert.deepEqual(agruparConteudoDuplicado([sp, outra]), []);
  assert.throws(() => agruparConteudoDuplicado("não é array"), /array/);
  assert.throws(() => agruparConteudoDuplicado([{ id: "vacancy-x", contentSha256: "ab", sourceUrl: "https://ok.com" }]), /snapshot de vaga inválido/);
});

test("gitignore cobre todos os caminhos privados do contrato", async () => {
  const gitignore = await readFile(new URL("../.gitignore", import.meta.url), "utf8");
  for (const path of [
    "config/perfil.md",
    "curriculo.md",
    "tracker.csv",
    "data/*",
    "!data/pipeline.example.md",
    "reports/*",
    "output/*",
  ]) assert.ok(gitignore.split("\n").includes(path), `Falta no .gitignore: ${path}`);
});
