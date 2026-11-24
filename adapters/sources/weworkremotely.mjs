import { buscarTexto, pausa } from "../../lib/careerops/http.mjs";
import { httpsNoHost, itensRss, limitar, paraIso, tipoContrato } from "../../lib/careerops/text.mjs";

const HOSTS = ["weworkremotely.com"];
const FEED_PRINCIPAL = "https://weworkremotely.com/remote-jobs.rss";
const FEED_MARKETING = "https://weworkremotely.com/categories/remote-sales-and-marketing-jobs.rss";

export function validarFeedWwr(valor) {
  let url;
  try {
    url = new URL(String(valor ?? "").trim());
  } catch {
    throw new Error("weworkremotely: feed inválido");
  }
  if (url.protocol !== "https:" || url.hostname !== "weworkremotely.com" || url.username || url.password || url.port) {
    throw new Error("weworkremotely: feed fora do host");
  }
  if (!url.pathname.endsWith(".rss") || url.search) throw new Error("weworkremotely: feed precisa ser RSS");
  return url.href;
}

export function resolverFeedsWwr(params = {}) {
  const base = Array.isArray(params.feeds) && params.feeds.length ? params.feeds : [FEED_PRINCIPAL];
  const extras = Array.isArray(params.extra_feeds) ? params.extra_feeds : (Array.isArray(params.feeds) ? [] : [FEED_MARKETING]);
  const vistos = new Set();
  const saida = [];
  for (const item of [...base, ...extras]) {
    const url = validarFeedWwr(item);
    if (vistos.has(url)) continue;
    vistos.add(url);
    saida.push(url);
  }
  if (!saida.length) throw new Error("weworkremotely: nenhum feed");
  if (saida.length > 6) throw new Error("weworkremotely: feeds demais");
  return saida;
}

export function normalizarWwr(item) {
  if (!item || typeof item.title !== "string" || !item.title.trim()) return null;
  const url = httpsNoHost(item.link ?? item.url, HOSTS);
  if (!url) return null;
  const texto = (item.title ?? item.rawTitle ?? "").trim();
  const doisPontos = texto.indexOf(":");
  let company = "We Work Remotely";
  let title = texto;
  if (doisPontos > 0) {
    const esquerda = texto.slice(0, doisPontos).trim();
    const direita = texto.slice(doisPontos + 1).trim();
    if (esquerda && direita) {
      company = esquerda;
      title = direita;
    }
  }
  return {
    native_id: null,
    url,
    title,
    company: item.company || company,
    location: item.location || "",
    remote: true,
    employment_type: tipoContrato(item.type),
    description: limitar(item.description),
    posted_at: paraIso(item.pubDate),
    raw: item,
  };
}

export default {
  id: "weworkremotely",
  profile: ["emprego", "freelance"],
  hosts: HOSTS,
  async fetch(params, ctx) {
    const feeds = resolverFeedsWwr(params ?? {});
    const listings = [];
    const errors = [];
    const vistos = new Set();
    for (const feed of feeds) {
      if (listings.length || errors.length) await pausa(ctx, 200);
      try {
        const xml = await buscarTexto(feed, HOSTS, ctx);
        for (const item of itensRss(xml)) {
          const chave = item.link || item.title;
          if (!chave || vistos.has(chave)) continue;
          vistos.add(chave);
          listings.push(item);
        }
      } catch (erro) {
        errors.push(erro.message);
      }
    }
    return { listings, errors };
  },
  normalize: normalizarWwr,
};
