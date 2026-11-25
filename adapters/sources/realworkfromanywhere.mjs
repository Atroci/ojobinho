import { buscarTexto, pausa } from "../../lib/careerops/http.mjs";
import { localCompativel } from "../../lib/careerops/geo.mjs";
import { httpsNoHost, limitar, paraIso, tagTexto } from "../../lib/careerops/text.mjs";

const HOSTS = ["www.realworkfromanywhere.com"];
const FEED_PRINCIPAL = "https://www.realworkfromanywhere.com/rss.xml";
const FEED_MARKETING = "https://www.realworkfromanywhere.com/remote-sales-and-marketing-jobs/rss.xml";

export function validarFeedRwfa(valor) {
  let url;
  try {
    url = new URL(String(valor ?? "").trim());
  } catch {
    throw new Error("realworkfromanywhere: feed inválido");
  }
  if (url.protocol !== "https:" || !HOSTS.includes(url.hostname) || url.username || url.password || url.port) {
    throw new Error("realworkfromanywhere: feed fora do host");
  }
  if (url.search || url.hash) throw new Error("realworkfromanywhere: feed precisa ser RSS");
  if (url.pathname !== "/rss.xml" && !url.pathname.endsWith("/rss.xml")) {
    throw new Error("realworkfromanywhere: feed precisa ser RSS");
  }
  return url.href;
}

export function resolverFeedsRwfa(params = {}) {
  const base = Array.isArray(params.feeds) && params.feeds.length ? params.feeds : [FEED_PRINCIPAL];
  const extras = Array.isArray(params.extra_feeds) ? params.extra_feeds : (Array.isArray(params.feeds) ? [] : [FEED_MARKETING]);
  const vistos = new Set();
  const saida = [];
  for (const item of [...base, ...extras]) {
    const url = validarFeedRwfa(item);
    if (vistos.has(url)) continue;
    vistos.add(url);
    saida.push(url);
  }
  if (!saida.length) throw new Error("realworkfromanywhere: nenhum feed");
  if (saida.length > 6) throw new Error("realworkfromanywhere: feeds demais");
  return saida;
}

export function itensRwfa(xml) {
  const blocos = String(xml).match(/<item\b[^>]*>[\s\S]*?<\/item>/gi) ?? [];
  return blocos.map((bloco) => {
    const locais = ["location", "job:location", "region", "country", "city"]
      .map((tag) => tagTexto(bloco, tag))
      .filter(Boolean);
    return {
      title: tagTexto(bloco, "title"),
      link: tagTexto(bloco, "link"),
      pubDate: tagTexto(bloco, "pubDate"),
      description: tagTexto(bloco, "description"),
      author: tagTexto(bloco, "author"),
      location: locais.join(", "),
    };
  });
}

export function manterRwfa(item) {
  const location = typeof item?.location === "string" ? item.location.trim() : "";
  if (!location) return true;
  return localCompativel(location);
}

export function normalizarRwfa(item) {
  if (!item || typeof item.title !== "string" || !item.title.trim()) return null;
  const location = typeof item.location === "string" ? item.location.trim() : "";
  if (!manterRwfa({ location })) return null;
  const url = httpsNoHost(item.link ?? item.url, HOSTS);
  if (!url) return null;
  const author = typeof item.author === "string" ? item.author.trim() : "";
  let title = item.title.trim();
  let company = author;
  const indice = title.toLowerCase().lastIndexOf(" at ");
  if (indice > 0) {
    const esquerda = title.slice(0, indice).trim();
    const direita = title.slice(indice + 4).trim();
    if (esquerda && direita) {
      title = esquerda;
      if (!company) company = direita;
    }
  }
  return {
    native_id: null,
    url,
    title,
    company,
    location,
    remote: !location || /remote|remoto|anywhere|worldwide|world|global|europe|europa/i.test(`${location} ${title}`),
    description: limitar(item.description),
    posted_at: paraIso(item.pubDate),
    raw: { location, author },
  };
}

export default {
  id: "realworkfromanywhere",
  profile: ["emprego", "freelance"],
  hosts: HOSTS,
  async fetch(params, ctx) {
    const feeds = resolverFeedsRwfa(params ?? {});
    const listings = [];
    const errors = [];
    const vistos = new Set();
    for (const feed of feeds) {
      if (listings.length || errors.length) await pausa(ctx, 200);
      try {
        const xml = await buscarTexto(feed, HOSTS, { ...ctx, accept: "application/rss+xml, application/xml, text/xml" });
        for (const item of itensRwfa(xml)) {
          const chave = item.link || item.title;
          if (!chave || vistos.has(chave)) continue;
          vistos.add(chave);
          if (!manterRwfa(item)) continue;
          listings.push(item);
        }
      } catch (erro) {
        errors.push(erro.message);
      }
    }
    return { listings, errors };
  },
  normalize: normalizarRwfa,
};
