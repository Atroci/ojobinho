import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { analisarListagem, urlsPaginas } from "../adapters/sources/99freelas.mjs";
import { normalizarArbeitnow } from "../adapters/sources/arbeitnow.mjs";
import { normalizarAshby } from "../adapters/sources/ashby.mjs";
import { normalizarGetonbrd } from "../adapters/sources/getonbrd.mjs";
import { normalizarGupyBusca } from "../adapters/sources/gupy.mjs";
import { normalizarHimalayas } from "../adapters/sources/himalayas.mjs";
import { normalizarJobicy } from "../adapters/sources/jobicy.mjs";
import { normalizarJobspresso } from "../adapters/sources/jobspresso.mjs";
import { normalizarLanding } from "../adapters/sources/landingjobs.mjs";
import { normalizarManfred } from "../adapters/sources/manfred.mjs";
import { analisarPagina, classificarWeb, CONSULTAS, urlBusca } from "../adapters/sources/net-empregos.mjs";
import { normalizarNodesk } from "../adapters/sources/nodesk.mjs";
import { normalizarRemoteOk } from "../adapters/sources/remoteok.mjs";
import { normalizarRemotive } from "../adapters/sources/remotive.mjs";
import { normalizarWwr } from "../adapters/sources/weworkremotely.mjs";
import { normalizarWorkingNomads } from "../adapters/sources/workingnomads.mjs";
import { carregarAdaptadores, IDS_ADAPTADORES } from "../adapters/registry.mjs";
import { abrirBanco } from "../lib/db/index.mjs";
import { hashConteudo, ingerirVaga } from "../lib/ingest.mjs";
import { aplicarRegras } from "../lib/rules.mjs";
import { recomendarIntervalo } from "../lib/careerops/schedule.mjs";
import { adquirirTrava } from "../lib/careerops/lock.mjs";
import { carregarCapacidades, carregarFontes } from "../lib/careerops/config.mjs";
import { despachar, validarRegistro } from "../lib/careerops/commands.mjs";
import { lerStdin, main } from "../ojobinho.mjs";

const raiz = fileURLToPath(new URL("..", import.meta.url));
const agora = new Date("2026-11-23T10:00:00.000Z");
const agenda = { timezone: "Europe/Lisbon", default_min_interval_minutes: 240, floor_minutes: 180, ceiling_minutes: 1440, sources: {} };
const regras = { emprego: { include_any: ["wordpress"] }, freelance: { include_any: ["wordpress"], max_proposals: 40, max_age_hours: 72, pay_floor_hourly_usd: 25 } };

function ioDe() {
  const linhas = [];
  return { linhas, log: (valor) => linhas.push(String(valor)), error: (valor) => linhas.push(String(valor)) };
}

async function baseVazia() {
  return mkdtemp(join(tmpdir(), "careerops-"));
}

function fonteBoa(id = "remoteok") {
  return { id, adapter: id, enabled: true, profile: ["emprego"], params: {} };
}

function adaptador(id, fetch) {
  return {
    id,
    async fetch(_params, ctx) {
      return fetch(ctx);
    },
    normalize(vaga) {
      return vaga?.title ? vaga : null;
    },
  };
}

test("adaptadores carregam e a configuração pública só liga fontes aprovadas", async () => {
  const mapa = await carregarAdaptadores();
  assert.equal(mapa.size, IDS_ADAPTADORES.length);
  for (const id of IDS_ADAPTADORES) assert.equal(mapa.get(id).id, id);
  const fontes = await carregarFontes(raiz);
  const caps = await carregarCapacidades(raiz);
  const ligadas = fontes.filter((fonte) => fonte.enabled);
  assert.ok(ligadas.some((fonte) => fonte.id === "net-empregos"));
  assert.ok(ligadas.some((fonte) => fonte.id === "99freelas"));
  assert.ok(ligadas.length >= 16);
  for (const fonte of ligadas) {
    const cap = caps.sources[fonte.adapter];
    assert.equal(cap.access_policy, "approved", fonte.id);
    assert.equal(cap.discovery, "yes", fonte.id);
  }
  assert.equal(caps.sources.workana.discovery, "no");
  assert.equal(caps.sources.upwork.discovery, "manual");
  assert.equal(caps.sources["99freelas"].application_actions, "no");
});

test("normalize de feeds públicos é estável", () => {
  const remote = normalizarRemoteOk({ id: 7, position: "Dev WordPress", company: "Acme", url: "https://remoteok.com/remote-jobs/7", date: "2026-11-01T00:00:00Z", description: "<p>WordPress</p>", location: "Worldwide" });
  assert.equal(remote.native_id, "7");
  assert.equal(remote.title, "Dev WordPress");
  assert.match(remote.description, /WordPress/);
  assert.equal(normalizarRemoteOk({ legal: true }), null);

  const remotive = normalizarRemotive({ id: 3, title: "Analista SEO", company_name: "Beta", url: "https://remotive.com/remote-jobs/3", publication_date: "2026-11-01T12:00:00", candidate_required_location: "Portugal", job_type: "full_time", description: "seo" });
  assert.equal(remotive.posted_at, "2026-11-01T12:00:00.000Z");
  assert.equal(remotive.employment_type, "full_time");

  assert.equal(normalizarHimalayas({ title: "Dev", companyName: "C", applicationLink: "https://himalayas.app/companies/c/jobs/dev", locationRestrictions: [], employmentType: "Full Time", pubDate: 1700000000 }).remote, true);
  assert.equal(normalizarJobicy({ id: "j1", jobTitle: "Zone &#038; Co", url: "https://jobicy.com/jobs/1", companyName: "Jobicy", jobGeo: "Anywhere" }).title, "Zone & Co");
  assert.equal(normalizarWorkingNomads({ title: "Dev", url: "https://www.workingnomads.com/jobs/1", company_name: "N", pub_date: "2026-11-01T00:00:00Z" }).company, "N");
  assert.equal(normalizarWwr({ title: "Acme: WordPress", link: "https://weworkremotely.com/remote-jobs/1", region: "Anywhere", type: "Contract" }).employment_type, "contract");
  assert.equal(normalizarNodesk({ title: "Designer at Studio", link: "https://nodesk.co/remote-jobs/studio" }).company, "Studio");
  assert.equal(normalizarJobspresso({ title: "Dev", link: "https://jobspresso.co/job/1", company: "JP", description: "<p>web</p>" }).company, "JP");
  assert.equal(normalizarGetonbrd({ id: "9", attributes: { title: "Dev", remote: true, published_at: 1700000000, company: { data: { attributes: { name: "Lat" } } } }, links: { public_url: "https://www.getonbrd.com/jobs/dev" } }).company, "Lat");
  assert.equal(normalizarLanding({ id: 4, title: "Dev", url: "https://landing.jobs/at/acme-labs/dev", remote: true, gross_salary_low: 30000, gross_salary_high: 40000, currency_code: "eur" }).pay_currency, "EUR");
  assert.equal(normalizarArbeitnow({ title: "Dev", slug: "dev", url: "https://www.arbeitnow.com/jobs/dev", company_name: "A", remote: true, created_at: 1700000000 }).remote, true);
  assert.equal(normalizarManfred({ status: "ACTIVE", id: 12, slug: "dev", position: "Dev", company: { name: "M" }, remotePercentage: 100, salaryFrom: 40000, currency: "€" }).pay_currency, "EUR");
  assert.equal(normalizarManfred({ status: "CLOSED", id: 1, slug: "x", position: "X" }), null);
  assert.equal(normalizarGupyBusca({ id: 5, name: "Dev", jobUrl: "https://acme.gupy.io/jobs/5", careerPageName: "Acme", workplaceType: "remote", description: "web" }).remote, true);
  assert.equal(normalizarGupyBusca({ id: 6, name: "Secreta", jobUrl: "https://acme.gupy.io/jobs/6", careerPageName: "Confidencial", isConfidentialCareerPage: true }), null);
  assert.equal(normalizarAshby({ id: "abc", title: "Dev", jobUrl: "https://jobs.ashbyhq.com/acme/abc", company: "Acme", isRemote: true }).native_id, "abc");
  assert.equal(hashConteudo(remote), hashConteudo({ ...remote }));
});

test("Net-Empregos usa as mesmas páginas do scan.py e o 99Freelas fica na listagem pública", async () => {
  const scanner = await readFile(new URL("../adapters/net-empregos/scan.py", import.meta.url), "utf8");
  const consultasPy = scanner.match(/QUERIES=\[(.*?)\]/s)[1].match(/"([^"]+)"/g).map((item) => item.slice(1, -1));
  assert.deepEqual(consultasPy, CONSULTAS);
  const url = new URL(urlBusca("wordpress", 2));
  assert.equal(url.pathname, "/pesquisa-empregos.asp");
  assert.equal(url.searchParams.get("chaves"), "wordpress");
  assert.equal(url.searchParams.get("page"), "2");
  assert.equal(url.searchParams.get("categoria"), "0");
  const html = `<div class="job-item media"><a href="/1234567/dev-wordpress/">Dev WordPress</a><ul><li>01-11-2026</li><li>Lisboa</li><li>Informática</li><li>Acme</li></ul></div>`;
  const item = analisarPagina(html)[0];
  assert.equal(item.id, "1234567");
  assert.equal(item.meta[3], "Acme");
  assert.equal(classificarWeb("manutenção de websites", ""), true);
  assert.deepEqual(urlsPaginas(9), [
    "https://www.99freelas.com.br/projects?page=1",
    "https://www.99freelas.com.br/projects?page=2",
    "https://www.99freelas.com.br/projects?page=3",
  ]);
  const cartao = `<div class="with-flag result-item"><h1 class="title"><a href="/project/site-wordpress-42">Site WordPress</a></h1><p class="item-text information">Propostas: 3</p><div class="item-text description formatted-text" data-content="Loja WordPress"></div><b class="datetime" cp-datetime="1762012800000"></b><p class="item-text client">Cliente: Ana</p></div>`;
  const projeto = analisarListagem(cartao)[0];
  assert.equal(projeto.id, "42");
  assert.equal(projeto.url, "https://www.99freelas.com.br/project/site-wordpress-42");
  assert.equal(projeto.proposals, 3);
  assert.equal(projeto.title, "Site WordPress");
  assert.doesNotMatch(projeto.url, /login|fs=/);
});

test("ingestão deduplica, versiona mudança e agrupa o mesmo anúncio", () => {
  const db = abrirBanco(raiz, { memory: true });
  const bruto = { native_id: "1", url: "https://exemplo.test/vaga/1?utm_source=a", title: "Dev WordPress", company: "Acme", location: "Remoto", description: "wordpress" };
  const primeira = ingerirVaga(db, "remoteok", bruto, "2026-11-23T10:00:00.000Z");
  const segunda = ingerirVaga(db, "remoteok", bruto, "2026-11-23T11:00:00.000Z");
  assert.equal(primeira.acao, "new");
  assert.equal(segunda.acao, "same");
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM listings").get().n, 1);
  assert.equal(db.prepare("SELECT canonical_url FROM listings").get().canonical_url, "https://exemplo.test/vaga/1");
  const mudou = ingerirVaga(db, "remoteok", { ...bruto, description: "wordpress e seo" }, "2026-11-23T12:00:00.000Z");
  assert.equal(mudou.acao, "changed");
  assert.equal(mudou.version, 2);
  const outra = ingerirVaga(db, "remotive", { native_id: "9", url: "https://outro.test/9", title: "Dev WordPress", company: "Acme", description: "outro texto" }, "2026-11-23T12:00:00.000Z");
  assert.equal(db.prepare("SELECT cluster_id FROM listings WHERE id = ?").get(outra.id).cluster_id, primeira.id);
  db.close();
});

test("scan isola falha, grava resumo e o modo due respeita o intervalo", async () => {
  const base = await baseVazia();
  const saida = ioDe();
  const adaptadores = new Map([
    ["boa", adaptador("boa", async () => ({ listings: [{ native_id: "1", title: "Dev WordPress", url: "https://exemplo.test/1", company: "Acme", description: "wordpress", remote: true }], errors: [] }))],
    ["ruim", adaptador("ruim", async () => { throw new Error("fonte caiu"); })],
  ]);
  const fontes = [fonteBoa("boa"), { ...fonteBoa("ruim"), adapter: "ruim" }];
  const capacidades = { sources: { boa: { access_policy: "approved", discovery: "yes" }, ruim: { access_policy: "approved", discovery: "yes" } } };
  const codigo = await despachar("scan", ["--all", "--json"], saida, base, { fontes, adaptadores, capacidades, agenda, regras, now: agora });
  const resumo = JSON.parse(saida.linhas.at(-1));
  assert.equal(codigo, 0);
  assert.equal(resumo.new, 1);
  assert.equal(resumo.sources.find((fonte) => fonte.id === "ruim").ok, false);
  const deNovo = ioDe();
  await despachar("scan", ["--all", "--json"], deNovo, base, { fontes: [fonteBoa("boa")], adaptadores, capacidades, agenda, regras, now: new Date("2026-11-23T10:05:00.000Z") });
  assert.equal(JSON.parse(deNovo.linhas.at(-1)).new, 0);
  const devido = ioDe();
  await despachar("scan", ["--due", "--json"], devido, base, { fontes: [fonteBoa("boa")], adaptadores, capacidades, agenda, regras, now: new Date("2026-11-23T10:10:00.000Z") });
  assert.equal(JSON.parse(devido.linhas.at(-1)).sources[0].skipped, "not-due");
  const soRuim = ioDe();
  const falha = await despachar("scan", ["--source", "ruim", "--json"], soRuim, base, { fontes, adaptadores, capacidades, agenda, regras, now: new Date("2026-11-23T18:00:00.000Z") });
  assert.equal(falha, 2);
});

test("fonte sem política aprovada não é buscada", async () => {
  const base = await baseVazia();
  let chamadas = 0;
  const adaptadores = new Map([["workana", adaptador("workana", async () => { chamadas += 1; return { listings: [], errors: [] }; })]]);
  const saida = ioDe();
  await despachar("scan", ["--source", "workana", "--json"], saida, base, {
    fontes: [{ id: "workana", adapter: "workana", enabled: true, profile: ["freelance"], params: {} }],
    adaptadores,
    capacidades: { sources: { workana: { access_policy: "denied", discovery: "no" } } },
    agenda,
    regras,
    now: agora,
  });
  assert.equal(chamadas, 0);
  assert.equal(JSON.parse(saida.linhas.at(-1)).sources[0].skipped, "policy");
});

test("avaliação é por hash e perfil, e a fila vazia não grava chamada de modelo", async () => {
  const base = await baseVazia();
  const adaptadores = new Map([["boa", adaptador("boa", async () => ({ listings: [{ native_id: "1", title: "Dev WordPress", url: "https://exemplo.test/1", company: "Acme", description: "wordpress", remote: true }], errors: [] }))]]);
  await despachar("scan", ["--all", "--json"], ioDe(), base, {
    fontes: [fonteBoa("boa")],
    adaptadores,
    capacidades: { sources: { boa: { access_policy: "approved", discovery: "yes" } } },
    agenda,
    regras,
    now: agora,
  });
  const primeira = ioDe();
  await despachar("evaluate", ["--new", "--profile", "emprego", "--bot", "grok", "--json"], primeira, base, { regras, now: agora });
  const fila = JSON.parse(primeira.linhas.at(-1));
  assert.equal(fila.count, 1);
  const db = abrirBanco(base);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM model_calls").get().n, 0);
  db.close();
  const registro = ioDe();
  await despachar("evaluate", ["--record"], registro, base, {
    regras,
    now: agora,
    entrada: JSON.stringify({ listing_id: fila.items[0].id, profile_id: "emprego", evaluator: "grok", verdict: "maybe", fit_score: 3, model: "grok-test", prompt_version: "avaliar@1", tokens: 12, json: { reasons: ["exemplo"] } }),
  });
  const repetida = ioDe();
  await despachar("evaluate", ["--new", "--profile", "emprego", "--bot", "grok", "--json"], repetida, base, { regras, now: agora });
  assert.equal(JSON.parse(repetida.linhas.at(-1)).count, 0);
  const db2 = abrirBanco(base);
  assert.equal(db2.prepare("SELECT COUNT(*) AS n FROM evaluations").get().n, 1);
  assert.equal(db2.prepare("SELECT COUNT(*) AS n FROM model_calls").get().n, 1);
  db2.close();
  adaptadores.get("boa").fetch = async () => ({ listings: [{ native_id: "1", title: "Dev WordPress", url: "https://exemplo.test/1", company: "Acme", description: "wordpress e loja", remote: true }], errors: [] });
  await despachar("scan", ["--all", "--json"], ioDe(), base, {
    fontes: [fonteBoa("boa")],
    adaptadores,
    capacidades: { sources: { boa: { access_policy: "approved", discovery: "yes" } } },
    agenda,
    regras,
    now: new Date("2026-11-23T18:00:00.000Z"),
  });
  const mudou = ioDe();
  await despachar("evaluate", ["--new", "--profile", "emprego", "--bot", "grok", "--json"], mudou, base, { regras, now: new Date("2026-11-23T18:00:00.000Z") });
  assert.equal(JSON.parse(mudou.linhas.at(-1)).count, 1);
  const outraVez = ioDe();
  await despachar("evaluate", ["--new", "--profile", "emprego", "--bot", "grok", "--reavaliar", "--json"], outraVez, base, { regras, now: agora });
  assert.equal(JSON.parse(outraVez.linhas.at(-1)).count, 1);
  const freelance = ioDe();
  await despachar("evaluate", ["--new", "--profile", "freelance", "--bot", "grok", "--json"], freelance, base, { regras, now: agora });
  assert.equal(JSON.parse(freelance.linhas.at(-1)).count, 1);
  assert.throws(() => validarRegistro({ listing_id: "x", profile_id: "freelance", evaluator: "grok", verdict: "apply", json: {} }, { id: "x", content_hash: "a" }), /verdict/);
});

test("vaga fechada só some depois de uma coleta completa, e zero suspeito não apaga na primeira vez", async () => {
  const base = await baseVazia();
  const listar = (ids) => ({ listings: ids.map((id) => ({ native_id: id, title: `Dev WordPress ${id}`, url: `https://exemplo.test/${id}`, company: "Acme", description: "wordpress" })), errors: [] });
  let atual = ["1", "2"];
  const adaptadores = new Map([["boa", adaptador("boa", async () => listar(atual))]]);
  const extras = { fontes: [fonteBoa("boa")], adaptadores, capacidades: { sources: { boa: { access_policy: "approved", discovery: "yes" } } }, agenda, regras };
  await despachar("scan", ["--all", "--json"], ioDe(), base, { ...extras, now: agora });
  atual = ["1"];
  await despachar("scan", ["--all", "--json"], ioDe(), base, { ...extras, now: new Date("2026-11-23T16:00:00.000Z") });
  const db = abrirBanco(base);
  assert.equal(db.prepare("SELECT status FROM listings WHERE native_id = '2'").get().status, "gone");
  db.prepare("UPDATE listings SET status = 'active'").run();
  db.prepare("UPDATE sources SET last_rows = 2, suspect_streak = 0").run();
  db.close();
  atual = [];
  await despachar("scan", ["--all", "--json"], ioDe(), base, { ...extras, now: new Date("2026-11-23T20:00:00.000Z") });
  const meio = abrirBanco(base);
  assert.equal(meio.prepare("SELECT COUNT(*) AS n FROM listings WHERE status = 'active'").get().n, 2);
  assert.equal(meio.prepare("SELECT suspect_streak FROM sources WHERE id = 'boa'").get().suspect_streak, 1);
  meio.close();
});

test("prepare não envia, ingest manual entra na mesma fila e o tune recomenda intervalo", async () => {
  const base = await baseVazia();
  const adaptadores = new Map([["manual", adaptador("manual", async () => ({ listings: [], errors: [] }))]]);
  await writeFile(join(base, "upwork.json"), JSON.stringify({ listings: [{ native_id: "u1", title: "Loja WordPress", url: "https://www.upwork.com/jobs/~u1", company: "Cliente", description: "wordpress", pay_min: 40, pay_max: 40, pay_currency: "USD", pay_period: "hour" }] }));
  await despachar("ingest", ["--source", "upwork", "--file", "upwork.json", "--json"], ioDe(), base, { adaptadores, now: agora });
  const fila = ioDe();
  await despachar("evaluate", ["--new", "--profile", "freelance", "--json"], fila, base, { regras, now: agora });
  const item = JSON.parse(fila.linhas.at(-1)).items[0];
  assert.equal(item.source, "upwork");
  assert.equal(aplicarRegras({ ...item, pay_period: "hour", pay_currency: "USD", pay_max: 20, tags: "wordpress", description: "wordpress" }, regras.freelance).passed, false);
  const preparado = ioDe();
  await despachar("prepare", ["--id", item.id, "--profile", "freelance", "--json"], preparado, base, { now: agora });
  const pacote = JSON.parse(preparado.linhas.at(-1));
  assert.equal(pacote.submitted, false);
  assert.equal(pacote.status, "draft");
  const rendimento = recomendarIntervalo({ runs: 4, runs_ok: 4, runs_failed: 0, new_listings: 0 }, { min_interval_minutes: 240, floor_minutes: 180, ceiling_minutes: 1440 });
  assert.equal(rendimento.action, "slower");
  const rapido = recomendarIntervalo({ runs: 4, runs_ok: 4, runs_failed: 0, new_listings: 20 }, { min_interval_minutes: 240, floor_minutes: 180, ceiling_minutes: 1440 });
  assert.equal(rapido.action, "faster");
  assert.ok(rapido.suggested_minutes >= 180);
});

test("trava impede corrida simultânea e recupera pid morto", async () => {
  const base = await baseVazia();
  const soltar = await adquirirTrava(base, agora);
  await assert.rejects(() => adquirirTrava(base, agora), /andamento/);
  await soltar();
  await writeFile(join(base, "data/careerops.lock"), JSON.stringify({ pid: 999999, started_at: agora.toISOString() }));
  const deNovo = await adquirirTrava(base, agora);
  await deNovo();
});

test("o caminho de scan não importa SDK de modelo e a skill não manda enviar", async () => {
  const arquivos = [];
  async function andar(diretorio) {
    for (const entrada of await readdir(diretorio, { withFileTypes: true })) {
      const caminho = join(diretorio, entrada.name);
      if (entrada.isDirectory()) await andar(caminho);
      else if (entrada.name.endsWith(".mjs")) arquivos.push(caminho);
    }
  }
  await andar(join(raiz, "lib/careerops"));
  await andar(join(raiz, "lib/db"));
  await andar(join(raiz, "adapters/sources"));
  arquivos.push(join(raiz, "lib/ingest.mjs"), join(raiz, "lib/rules.mjs"), join(raiz, "adapters/registry.mjs"));
  const proibido = /from ["'](?:openai|@anthropic-ai|anthropic|@ai-sdk|langchain|groq-sdk|cohere)/;
  for (const arquivo of arquivos) {
    const texto = await readFile(arquivo, "utf8");
    assert.doesNotMatch(texto, proibido, arquivo);
  }
  const skill = await readFile(join(raiz, "docs/skills/ojobinho/SKILL.md"), "utf8");
  assert.match(skill, /Nunca envie/);
  assert.match(skill, /scan --due --json/);
  assert.doesNotMatch(skill, /clique em Enviar/i);
});

test("CLI scan --json sai pelo ojobinho e o digest cabe numa resposta de chat", async () => {
  const base = await baseVazia();
  const saida = ioDe();
  await main(["digest", "--today", "--json"], saida, base);
  const json = JSON.parse(saida.linhas.at(-1));
  assert.equal(json.command, "digest");
  assert.equal(json.count, 0);
});

function executarCli(base, args, entrada = "") {
  const cli = fileURLToPath(new URL("../ojobinho.mjs", import.meta.url));
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--disable-warning=ExperimentalWarning", cli, ...args], {
      cwd: base,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (parte) => { stdout += parte; });
    child.stderr.on("data", (parte) => { stderr += parte; });
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("CLI não terminou"));
    }, 10000);
    child.on("error", (erro) => {
      clearTimeout(timer);
      reject(erro);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
    child.stdin.end(entrada);
  });
}

test("evaluate --record lê o JSON encaminhado no stdin do processo", async () => {
  await assert.rejects(() => lerStdin({ isTTY: true }), /pipe/);
  await assert.rejects(() => lerStdin({ isTTY: false, async *[Symbol.asyncIterator]() {} }), /stdin vazio/);

  const base = await baseVazia();
  const db = abrirBanco(base);
  const criada = ingerirVaga(db, "remoteok", {
    native_id: "1",
    url: "https://exemplo.test/1",
    title: "Dev WordPress",
    company: "Acme",
    description: "wordpress",
  }, agora.toISOString());
  db.close();
  const corpo = {
    listing_id: criada.id,
    profile_id: "emprego",
    evaluator: "grok",
    verdict: "maybe",
    fit_score: 3,
    model: "grok-test",
    prompt_version: "avaliar@1",
    tokens: 4,
    json: { reasons: ["exemplo"] },
  };
  const ok = await executarCli(base, ["evaluate", "--record"], JSON.stringify(corpo));
  assert.equal(ok.code, 0, ok.stderr);
  assert.equal(JSON.parse(ok.stdout).recorded, criada.id);
  const gravado = abrirBanco(base);
  assert.equal(gravado.prepare("SELECT COUNT(*) AS n FROM evaluations").get().n, 1);
  gravado.close();

  const vazio = await executarCli(base, ["evaluate", "--record"], "");
  assert.notEqual(vazio.code, 0);
  assert.match(vazio.stderr, /stdin vazio/);
  assert.doesNotMatch(`${vazio.stderr}\n${vazio.stdout}`, /Unexpected end of JSON input/);
});

test("status --json conta quem ainda não foi avaliado neste perfil e content_hash", async () => {
  const base = await baseVazia();
  const regrasFila = {
    emprego: { include_any: ["wordpress"] },
    freelance: { include_any: ["loja"], max_age_hours: 72, pay_floor_hourly_usd: 25 },
  };
  const db = abrirBanco(base);
  const quando = agora.toISOString();
  ingerirVaga(db, "remoteok", { native_id: "1", url: "https://exemplo.test/1", title: "Dev WordPress", company: "Acme", description: "wordpress", location: "Remoto" }, quando);
  ingerirVaga(db, "remoteok", { native_id: "2", url: "https://exemplo.test/2", title: "Dev WordPress 2", company: "Acme", description: "wordpress", location: "Remoto" }, quando);
  ingerirVaga(db, "remoteok", { native_id: "3", url: "https://exemplo.test/3", title: "Dev WordPress antiga", company: "Acme", description: "wordpress", location: "Remoto" }, quando);
  ingerirVaga(db, "remoteok", { native_id: "4", url: "https://exemplo.test/4", title: "Contador", company: "Acme", description: "planilhas", location: "Remoto" }, quando);
  ingerirVaga(db, "upwork", {
    native_id: "u1",
    url: "https://www.upwork.com/jobs/~u1",
    title: "Loja virtual",
    company: "Cliente",
    description: "loja",
    location: "Remoto",
    pay_min: 40,
    pay_max: 40,
    pay_currency: "USD",
    pay_period: "hour",
    posted_at: quando,
  }, quando);
  db.prepare("UPDATE listings SET status = 'gone' WHERE native_id = '3'").run();
  db.close();

  const extras = { regras: regrasFila, agenda, now: agora };
  const emprego = ioDe();
  await despachar("evaluate", ["--new", "--profile", "emprego", "--bot", "grok", "--json"], emprego, base, extras);
  const filaEmprego = JSON.parse(emprego.linhas.at(-1));
  const freelance = ioDe();
  await despachar("evaluate", ["--new", "--profile", "freelance", "--bot", "grok", "--json"], freelance, base, extras);
  const filaFreelance = JSON.parse(freelance.linhas.at(-1));
  assert.equal(filaEmprego.count, 2);
  assert.equal(filaFreelance.count, 1);

  const antes = ioDe();
  await despachar("status", ["--json"], antes, base, extras);
  assert.deepEqual(JSON.parse(antes.linhas.at(-1)).queue, { emprego: filaEmprego.count, freelance: filaFreelance.count });

  for (const item of filaEmprego.items) {
    await despachar("evaluate", ["--record"], ioDe(), base, {
      ...extras,
      entrada: JSON.stringify({ listing_id: item.id, profile_id: "emprego", evaluator: "grok", verdict: "skip", fit_score: 1, json: {} }),
    });
  }
  const soEmprego = ioDe();
  await despachar("status", ["--json"], soEmprego, base, extras);
  assert.deepEqual(JSON.parse(soEmprego.linhas.at(-1)).queue, { emprego: 0, freelance: 1 });

  for (const item of filaFreelance.items) {
    await despachar("evaluate", ["--record"], ioDe(), base, {
      ...extras,
      entrada: JSON.stringify({
        listing_id: item.id,
        profile_id: "freelance",
        evaluator: "grok",
        verdict: "skip",
        fit_score: 1,
        json: { recommendation: "skip", reasons: ["teste"] },
      }),
    });
  }
  const empregoZero = ioDe();
  await despachar("evaluate", ["--new", "--profile", "emprego", "--bot", "grok", "--json"], empregoZero, base, extras);
  const freelanceZero = ioDe();
  await despachar("evaluate", ["--new", "--profile", "freelance", "--bot", "grok", "--json"], freelanceZero, base, extras);
  assert.equal(JSON.parse(empregoZero.linhas.at(-1)).count, 0);
  assert.equal(JSON.parse(freelanceZero.linhas.at(-1)).count, 0);
  const depois = ioDe();
  await despachar("status", ["--json"], depois, base, extras);
  assert.deepEqual(JSON.parse(depois.linhas.at(-1)).queue, { emprego: 0, freelance: 0 });
  const conferido = abrirBanco(base);
  assert.ok(conferido.prepare("SELECT COUNT(*) AS n FROM rule_results WHERE profile_id = 'emprego' AND passed = 1").get().n >= 2);
  conferido.close();

  const db2 = abrirBanco(base);
  ingerirVaga(db2, "remoteok", { native_id: "1", url: "https://exemplo.test/1", title: "Dev WordPress", company: "Acme", description: "wordpress e seo", location: "Remoto" }, "2026-11-23T18:00:00.000Z");
  db2.close();
  const mudouQuando = new Date("2026-11-23T18:00:00.000Z");
  const mudou = ioDe();
  await despachar("status", ["--json"], mudou, base, { ...extras, now: mudouQuando });
  assert.deepEqual(JSON.parse(mudou.linhas.at(-1)).queue, { emprego: 1, freelance: 0 });
  const filaMudou = ioDe();
  await despachar("evaluate", ["--new", "--profile", "emprego", "--bot", "grok", "--json"], filaMudou, base, { ...extras, now: mudouQuando });
  assert.equal(JSON.parse(filaMudou.linhas.at(-1)).count, 1);
});
