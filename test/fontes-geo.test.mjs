import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import a16z, { manterA16z, normalizarA16z } from "../adapters/sources/a16z-speedrun.mjs";
import carga, { normalizarCarga } from "../adapters/sources/carga-de-trabalhos.mjs";
import hackernews, { ehSeekingFreelancer, normalizarHn } from "../adapters/sources/hackernews.mjs";
import joonow, { normalizarJoonow } from "../adapters/sources/joonow.mjs";
import { manterRwfa, normalizarRwfa, resolverFeedsRwfa } from "../adapters/sources/realworkfromanywhere.mjs";
import realworkfromanywhere from "../adapters/sources/realworkfromanywhere.mjs";

function jsonResposta(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function fixture(nome) {
  return readFile(new URL(`./fixtures/careerops/${nome}`, import.meta.url), "utf8");
}

test("filtro geográfico do a16z Speedrun fica com remoto mundial, UE e Portugal", () => {
  const fica = [
    "Remote",
    "Worldwide",
    "Anywhere in the World",
    "Europe",
    "EU",
    "Portugal",
    "Lisbon, Portugal",
    "Germany",
    "Ireland",
    "Netherlands - Remote",
    "Paris, France",
    "Spain",
    "Madrid",
    "Remote US or Remote EU",
    "UK & Europe",
    "EMEA",
    "Global",
  ];
  const sai = [
    "",
    "United States",
    "United States - Remote",
    "Remote, USA",
    "Austin, TX",
    "New York",
    "San Francisco Bay Area",
    "Canada",
    "Vancouver, Canada",
    "Remote - US & Canada",
    "London",
    "London, UK",
    "United Kingdom",
    "Northern Ireland",
    "Singapore",
    "India",
    "India | Pune",
    "APAC",
    "Australia",
    "Brazil",
    "São Paulo",
    "Mexico City",
    "Argentina",
    "2 Locations",
    "Remote - Tier 1",
    "Anywhere in the US",
    "Porto Alegre",
  ];
  for (const location of fica) assert.equal(manterA16z({ location, url: "https://speedrun-talent-network.com/jobs/exemplo" }), true, location);
  for (const location of sai) assert.equal(manterA16z({ location, url: "https://speedrun-talent-network.com/jobs/exemplo" }), false, location);
  assert.equal(manterA16z({ location: "Portugal", url: "https://speedrun-talent-network.com/jobs/isca-ad00000" }), false);
  assert.equal(manterA16z({ location: "Portugal", url: "https://speedrun-talent-network.com/jobs/isca-ad00000?utm_source=ojobinho" }), false);
});

test("Carga de Trabalhos lê o RSS público", async () => {
  const xml = await fixture("carga-de-trabalhos.xml");
  const resultado = await carga.fetch({}, {
    fetchImpl: async (url) => {
      assert.equal(String(url), "https://cargadetrabalhos.pt/ofertas/feed/");
      return new Response(xml, { headers: { "content-type": "application/rss+xml" } });
    },
  });
  const vagas = resultado.listings.map(normalizarCarga).filter(Boolean);
  assert.equal(vagas.length, 2);
  assert.equal(vagas[0].title, "Gestor de cliente de exemplo");
  assert.equal(vagas[0].company, "Oficina Exemplo");
  assert.equal(vagas[0].location, "Setúbal");
  assert.equal(vagas[0].employment_type, "full_time");
  assert.equal(vagas[0].remote, false);
  assert.equal(vagas[0].posted_at, "2026-11-25T09:00:00.000Z");
  assert.match(vagas[0].description, /loja de exemplo/);
  assert.equal(vagas[0].url, "https://cargadetrabalhos.pt/ofertas/gestor-de-cliente-de-exemplo/");
  assert.equal(vagas[1].company, "Ateliê Norte");
  assert.equal(vagas[1].remote, true);
  assert.equal(vagas[1].location, "Santa Maria da Feira");
  assert.equal(normalizarCarga({ title: "Fora", link: "https://evil.example/ofertas/x", company: "Evil" }), null);
});

test("Real Work From Anywhere soma a categoria e filtra pelo location", async () => {
  assert.deepEqual(resolverFeedsRwfa({}), [
    "https://www.realworkfromanywhere.com/rss.xml",
    "https://www.realworkfromanywhere.com/remote-sales-and-marketing-jobs/rss.xml",
  ]);
  assert.deepEqual(resolverFeedsRwfa({ extra_feeds: [] }), ["https://www.realworkfromanywhere.com/rss.xml"]);
  assert.throws(() => resolverFeedsRwfa({ extra_feeds: ["https://evil.example/rss.xml"] }), /host/);
  assert.equal(manterRwfa({ location: "Worldwide" }), true);
  assert.equal(manterRwfa({ location: "Europe" }), true);
  assert.equal(manterRwfa({ location: "Portugal" }), true);
  assert.equal(manterRwfa({}), true);
  assert.equal(manterRwfa({ location: "" }), true);
  assert.equal(manterRwfa({ location: "   " }), true);
  assert.equal(manterRwfa({ location: "United States" }), false);
  assert.equal(manterRwfa({ location: "Canada" }), false);
  assert.equal(manterRwfa({ location: "APAC" }), false);
  assert.equal(manterRwfa({ location: "Brazil" }), false);

  const xml = await fixture("realworkfromanywhere.xml");
  const feeds = [];
  const resultado = await realworkfromanywhere.fetch({
    extra_feeds: ["https://www.realworkfromanywhere.com/remote-sales-and-marketing-jobs/rss.xml"],
  }, {
    sleep: async () => {},
    fetchImpl: async (url) => {
      feeds.push(String(url));
      return new Response(xml, { headers: { "content-type": "application/rss+xml" } });
    },
  });
  assert.deepEqual(feeds, [
    "https://www.realworkfromanywhere.com/rss.xml",
    "https://www.realworkfromanywhere.com/remote-sales-and-marketing-jobs/rss.xml",
  ]);
  const vagas = resultado.listings.map(normalizarRwfa).filter(Boolean);
  assert.deepEqual(vagas.map((vaga) => vaga.title), ["SEO de exemplo", "Marketing Europa", "Sem local"]);
  assert.equal(vagas[0].company, "Oficina");
  assert.equal(vagas[0].location, "Worldwide");
  assert.equal(vagas[0].remote, true);
  assert.equal(vagas[1].location, "Europe");
  assert.equal(vagas[2].location, "");
  assert.equal(vagas[2].remote, true);
  assert.equal(vagas[2].company, "Oeste");
  assert.equal(normalizarRwfa({ title: "Ads", link: "https://www.realworkfromanywhere.com/jobs/x", location: "Canada", author: "Norte" }), null);
  assert.equal(normalizarRwfa({ title: "Sem campo", link: "https://www.realworkfromanywhere.com/jobs/sem-campo", author: "Oficina" }).remote, true);
});

test("a16z Speedrun pede source=ojobinho e aplica o filtro", async () => {
  const corpo = JSON.parse(await fixture("a16z-speedrun.json"));
  const urls = [];
  const resultado = await a16z.fetch({ source: "ojobinho", page_size: 50, max_pages: 1 }, {
    fetchImpl: async (url) => {
      urls.push(String(url));
      return jsonResposta(corpo);
    },
  });
  assert.equal(urls.length, 1);
  const pedido = new URL(urls[0]);
  assert.equal(pedido.origin + pedido.pathname, "https://speedrun-talent-network.com/api/v1/jobs");
  assert.equal(pedido.searchParams.get("source"), "ojobinho");
  assert.equal(pedido.searchParams.get("page"), "0");
  assert.equal(resultado.listings.length, 1);
  const vaga = normalizarA16z(resultado.listings[0]);
  assert.equal(vaga.title, "SEO de exemplo");
  assert.equal(vaga.company, "Oficina");
  assert.equal(vaga.location, "Lisbon, Portugal");
  assert.equal(vaga.remote, true);
  assert.equal(vaga.employment_type, "full_time");
  assert.equal(vaga.pay_min, 40000);
  assert.equal(vaga.pay_currency, "EUR");
  assert.equal(vaga.url.includes("utm_"), false);
  assert.equal(normalizarA16z(corpo.jobs[1]), null);
  assert.equal(normalizarA16z(corpo.jobs[2]), null);
});

test("JooNow manda a chave só no cabeçalho, guarda a atribuição e não corta anúncio aberto antigo", async () => {
  const pagina = JSON.parse(await fixture("joonow.json"));
  const pausas = [];
  const hrefs = [];
  const headers = [];
  const resultado = await joonow.fetch({ country: "BR", limit: 20, max_pages: 2 }, {
    env: { JOONOW_API_KEY: "jnk_teste" },
    sleep: async (ms) => { pausas.push(ms); },
    fetchImpl: async (url, init) => {
      const href = String(url);
      hrefs.push(href);
      headers.push(init.headers["x-api-key"] ?? null);
      if (hrefs.length === 1) {
        return jsonResposta({ ...pagina, nextCursor: "cursor-demo" });
      }
      assert.equal(new URL(href).searchParams.get("cursor"), "cursor-demo");
      return jsonResposta({ ...pagina, data: [], nextCursor: null });
    },
  });
  assert.deepEqual(headers, ["jnk_teste", "jnk_teste"]);
  assert.equal(hrefs.some((href) => href.includes("jnk_teste")), false);
  assert.equal(hrefs.some((href) => href.includes("/go/")), false);
  assert.equal(new URL(hrefs[0]).searchParams.get("country"), "BR");
  assert.equal(new URL(hrefs[0]).searchParams.get("sort"), "date");
  assert.deepEqual(pausas, [7000]);
  const vaga = normalizarJoonow(resultado.listings[0]);
  assert.equal(vaga.url, "https://www.joonow.com/pt-br/vaga/analista-de-dados-de-exemplo-demo000001");
  assert.equal(vaga.company, "Oficina Exemplo");
  assert.equal(vaga.location, "Campinas, SP, BR");
  assert.equal(vaga.remote, true);
  assert.equal(vaga.employment_type, "full_time");
  assert.equal(vaga.pay_currency, "BRL");
  assert.equal(vaga.pay_period, "month");
  assert.equal(vaga.posted_at, "2026-11-01T12:00:00.000Z");
  assert.equal(vaga.raw.attribution.text, "Vagas via Joonow");
  assert.equal(vaga.raw.attribution.url, "https://www.joonow.com/pt-br/vagas?q=exemplo");
  assert.equal(vaga.raw.source_url, vaga.raw.attribution.url);
  assert.equal(vaga.raw.applyUrl, "https://www.joonow.com/go/demo000001");
  assert.equal(vaga.raw.url, vaga.url);
  assert.equal(normalizarJoonow(pagina.data[1]), null);

  let semChave = "presente";
  await joonow.fetch({ country: "BR", limit: 20, max_pages: 1 }, {
    env: { JOONOW_API_KEY: "" },
    fetchImpl: async (_url, init) => {
      semChave = init.headers["x-api-key"];
      return jsonResposta(pagina);
    },
  });
  assert.equal(semChave, undefined);
});

test("Hacker News lê SEEKING FREELANCER no topo da thread mensal", async () => {
  const fios = JSON.parse(await fixture("hn-threads.json"));
  assert.equal(ehSeekingFreelancer({ text: "SEEKING FREELANCER | SEO | Lisbon" }), true);
  assert.equal(ehSeekingFreelancer({ text: "<p>SEEKING FREELANCERS | Design</p>" }), true);
  assert.equal(ehSeekingFreelancer({ text: "SEEKING WORK | Dev | Berlin" }), false);
  assert.equal(ehSeekingFreelancer({ text: "Oficina | SEO\nSEEKING FREELANCER no meio do texto" }), false);

  const urls = [];
  const resultado = await hackernews.fetch({ max_comments: 30 }, {
    sleep: async () => {},
    fetchImpl: async (url) => {
      const href = String(url);
      urls.push(href);
      if (href.includes("author_whoishiring")) return jsonResposta(fios.hiringSearch);
      if (href.includes("Seeking%20freelancer") || href.includes("Seeking+freelancer")) return jsonResposta(fios.freelancerSearch);
      if (href.endsWith("/items/101")) return jsonResposta(fios.hiringItem);
      if (href.endsWith("/items/202")) return jsonResposta(fios.freelancerItem);
      throw new Error(`url inesperada ${href}`);
    },
  });
  assert.equal(urls[0].includes("author_whoishiring"), true);
  assert.equal(urls.some((url) => url.includes("Seeking") && url.includes("tags=story") && !url.includes("author_whoishiring")), true);
  assert.deepEqual(resultado.listings.map((item) => item.id), [1001, 1002, 2001]);
  const vagas = resultado.listings.map(normalizarHn);
  assert.equal(vagas[0].title, "SEO de exemplo");
  assert.equal(vagas[0].company, "Oficina");
  assert.equal(vagas[0].employment_type, undefined);
  assert.equal(vagas[2].employment_type, "freelance");
  assert.equal(vagas[2].title, "SEO de exemplo");
  assert.equal(vagas[2].location, "Lisbon");
  assert.equal(vagas[2].company, "Oficina");
  assert.equal(vagas[2].remote, true);
  assert.equal(vagas[2].raw.thread, "seeking-freelancer");
  assert.equal(vagas.some((vaga) => /aninhada|SEEKING WORK/i.test(vaga.title)), false);
});

test("agenda e política das fontes novas", async () => {
  const fontes = JSON.parse(await readFile(new URL("../config/careerops.sources.json", import.meta.url), "utf8"));
  const agenda = JSON.parse(await readFile(new URL("../config/agenda.json", import.meta.url), "utf8"));
  const caps = JSON.parse(await readFile(new URL("../config/source-capabilities.json", import.meta.url), "utf8"));
  for (const id of ["carga-de-trabalhos", "realworkfromanywhere", "a16z-speedrun", "joonow"]) {
    const fonte = fontes.sources.find((item) => item.id === id);
    assert.equal(fonte.enabled, true, id);
    assert.equal(caps.sources[id].access_policy, "approved", id);
    assert.equal(caps.sources[id].discovery, "yes", id);
  }
  assert.equal(agenda.sources["carga-de-trabalhos"].min_interval_minutes, 360);
  assert.equal(agenda.sources.realworkfromanywhere.min_interval_minutes, 360);
  assert.equal(agenda.sources["a16z-speedrun"].min_interval_minutes, 720);
  assert.equal(agenda.sources["a16z-speedrun"].max_runs_per_day, 2);
  assert.equal(agenda.sources.joonow.min_interval_minutes, 720);
  const speedrun = fontes.sources.find((item) => item.id === "a16z-speedrun");
  assert.equal(speedrun.params.source, "ojobinho");
  const rwfa = fontes.sources.find((item) => item.id === "realworkfromanywhere");
  assert.equal(rwfa.params.extra_feeds[0], "https://www.realworkfromanywhere.com/remote-sales-and-marketing-jobs/rss.xml");
});
