import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { urlManfred } from "../adapters/sources/manfred.mjs";
import { abrirBanco } from "../lib/db/index.mjs";
import { ingerirVaga } from "../lib/ingest.mjs";
import { aplicarRegras, termoPresente } from "../lib/rules.mjs";
import { despachar } from "../lib/careerops/commands.mjs";

const agora = new Date("2026-11-24T02:00:00.000Z");

function ioDe() {
  const linhas = [];
  return { linhas, log: (valor) => linhas.push(String(valor)) };
}

test("termo casa palavra inteira, acento, ponto e expressão", () => {
  assert.equal(termoPresente("generate leads for the team", "ads"), false);
  assert.equal(termoPresente("Google Ads specialist", "google ads"), true);
  assert.equal(termoPresente("website maintenance", "web"), false);
  assert.equal(termoPresente("web developer", "web"), true);
  assert.equal(termoPresente("Build it with Next.js", "next.js"), true);
  assert.equal(termoPresente("nextjs role", "next.js"), false);
  assert.equal(termoPresente("Next.js and node", "js"), false);
  assert.equal(termoPresente("go-to-market lead", "gtm"), false);
  assert.equal(termoPresente("GTM setup", "gtm"), true);
  assert.equal(termoPresente("Não remunerado", "não"), true);
});

test("título obrigatório, exclusão de título e fonte por perfil", () => {
  const diretor = {
    title: "Account Director",
    description: "The team uses WordPress and google ads in the stack.",
    tags: "",
    source: "remoteok",
  };
  assert.equal(aplicarRegras(diretor, { include_any: ["wordpress"] }).passed, true);
  assert.equal(aplicarRegras(diretor, { include_title_any: ["wordpress", "google ads"] }).passed, false);
  assert.equal(aplicarRegras({ ...diretor, title: "WordPress developer" }, { include_title_any: ["wordpress"] }).passed, true);
  assert.equal(aplicarRegras(
    { title: "Senior Data Engineer", description: "Mentions WordPress once.", source: "jobicy", tags: "wordpress" },
    { include_title_any: ["wordpress"], exclude_title: ["senior data engineer", "account director"] },
  ).passed, false);
  assert.equal(aplicarRegras({ title: "Loja WordPress", source: "99freelas", description: "" }, { sources_deny: ["99freelas"], include_any: ["wordpress"] }).passed, false);
  assert.equal(aplicarRegras({ title: "Loja WordPress", source: "remoteok", description: "" }, { sources_allow: ["99freelas", "upwork"], include_title_any: ["wordpress"] }).passed, false);
  assert.equal(aplicarRegras({ title: "Loja WordPress", source: "upwork", description: "wordpress" }, {
    sources_allow: ["99freelas", "upwork"],
    include_title_any: ["wordpress"],
    include_any: ["wordpress"],
  }).passed, true);
});

test("baseline marca o acervo e evaluate --new respeita o limite", async () => {
  const base = await mkdtemp(join(tmpdir(), "careerops-rules-"));
  const db = abrirBanco(base);
  ingerirVaga(db, "remoteok", { native_id: "velha", url: "https://exemplo.test/velha", title: "Dev WordPress", company: "Acme", description: "wordpress" }, "2026-11-23T10:00:00.000Z", { first_seen_at: "2026-11-23T10:00:00.000Z" });
  ingerirVaga(db, "remoteok", { native_id: "nova", url: "https://exemplo.test/nova", title: "Loja WordPress", company: "Acme", description: "wordpress" }, "2026-11-24T03:00:00.000Z", { first_seen_at: "2026-11-24T03:00:00.000Z" });
  for (let i = 0; i < 16; i += 1) {
    ingerirVaga(db, "remoteok", { native_id: `extra-${i}`, url: `https://exemplo.test/extra-${i}`, title: `Vaga WordPress ${i}`, company: "Acme", description: "wordpress" }, "2026-11-24T04:00:00.000Z", { first_seen_at: "2026-11-24T04:00:00.000Z" });
  }
  db.close();
  const regras = { emprego: { include_any: ["wordpress"] }, freelance: { include_any: ["wordpress"], sources_allow: ["99freelas"] } };
  const marcado = ioDe();
  await despachar("evaluate", ["--baseline", "--profile", "emprego", "--before", "2026-11-24T00:00:00.000Z", "--json"], marcado, base, { regras, now: agora });
  const baseline = JSON.parse(marcado.linhas.at(-1));
  assert.equal(baseline.baseline, 1);
  assert.equal(baseline.evaluator, "baseline");
  const fila = ioDe();
  await despachar("evaluate", ["--new", "--profile", "emprego", "--json"], fila, base, { regras, now: agora });
  const padrao = JSON.parse(fila.linhas.at(-1));
  assert.equal(padrao.count, 15);
  assert.equal(padrao.items.some((item) => item.id.endsWith(":velha")), false);
  const curto = ioDe();
  await despachar("evaluate", ["--new", "--profile", "emprego", "--limit", "2", "--json"], curto, base, { regras, now: agora });
  assert.equal(JSON.parse(curto.linhas.at(-1)).count, 2);
  const conferido = abrirBanco(base);
  const linha = conferido.prepare("SELECT evaluator, verdict, json FROM evaluations WHERE evaluator = 'baseline'").get();
  assert.equal(linha.verdict, "skip");
  assert.deepEqual(JSON.parse(linha.json).reasons, ["baseline"]);
  assert.equal(conferido.prepare("SELECT COUNT(*) AS n FROM model_calls").get().n, 0);
  conferido.close();
});

test("getManfred pede lang em maiúsculas", async () => {
  assert.equal(urlManfred({ lang: "es" }), "https://www.getmanfred.com/api/v2/public/offers?lang=ES");
  assert.equal(urlManfred({}), "https://www.getmanfred.com/api/v2/public/offers?lang=ES");
  assert.throws(() => urlManfred({ lang: "pt" }), /EN ou ES/);
  let pedido = "";
  const { default: manfred } = await import("../adapters/sources/manfred.mjs");
  await manfred.fetch({ lang: "es" }, {
    fetchImpl: async (url) => {
      pedido = url;
      return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
    },
  });
  assert.equal(pedido, "https://www.getmanfred.com/api/v2/public/offers?lang=ES");
});
