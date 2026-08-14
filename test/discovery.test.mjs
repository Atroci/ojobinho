import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { descobrir } from "../lib/discovery.mjs";

async function baseTemporaria() {
  const base = await mkdtemp(join(tmpdir(), "ojobinho-discovery-"));
  await mkdir(join(base, "config"), { recursive: true });
  await writeFile(join(base, "config/fontes.json"), JSON.stringify({ fontes: [{ provider: "gupy", id: "acme", company: "Acme Brasil" }] }));
  return base;
}

function fetchGupy(jobs) {
  const payload = { props: { pageProps: { jobs } } };
  return async () => new Response(`<script id="__NEXT_DATA__">${JSON.stringify(payload)}</script>`, { headers: { "content-type": "text/html" } });
}

const vaga = {
  id: 10,
  title: "Pessoa Desenvolvedora",
  department: "Tecnologia",
  type: "vacancy_type_effective",
  workplace: { workplaceType: "remote", address: { country: "Brasil" } },
};

test("descoberta persiste, deduplica e marca vaga ausente sem apagar histórico", async () => {
  const baseDir = await baseTemporaria();
  const first = await descobrir({ baseDir, fetchImpl: fetchGupy([vaga]), now: () => new Date("2026-08-14T00:00:00Z") });
  assert.equal(first.encontradas, 1);
  assert.equal(first.vagas[0].status, "ativa");
  assert.equal(first.vagas[0].firstSeen, "2026-08-14T00:00:00.000Z");

  const second = await descobrir({ baseDir, fetchImpl: fetchGupy([vaga]), now: () => new Date("2026-08-14T06:00:00Z") });
  assert.equal(second.encontradas, 0);
  assert.equal(second.vagas[0].firstSeen, "2026-08-14T00:00:00.000Z");
  assert.equal(second.vagas[0].lastSeen, "2026-08-14T06:00:00.000Z");

  const third = await descobrir({ baseDir, fetchImpl: fetchGupy([]), now: () => new Date("2026-08-14T12:00:00Z") });
  assert.equal(third.vagas[0].status, "indisponivel");
  assert.equal(JSON.parse(await readFile(join(baseDir, "data/descobertas.json"), "utf8")).length, 1);
});

test("falha de fonte fica visível e não desativa vaga anterior", async () => {
  const baseDir = await baseTemporaria();
  await descobrir({ baseDir, fetchImpl: fetchGupy([vaga]), now: () => new Date("2026-08-14T00:00:00Z") });
  const resultado = await descobrir({ baseDir, fetchImpl: async () => new Response("erro", { status: 500 }), now: () => new Date("2026-08-14T06:00:00Z") });
  assert.equal(resultado.erros.length, 1);
  assert.equal(resultado.fontesOk, 0);
  assert.equal(resultado.vagas[0].status, "ativa");
});
