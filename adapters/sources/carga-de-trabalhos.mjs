import { buscarTexto } from "../../lib/careerops/http.mjs";
import { httpsNoHost, limitar, paraIso, tagTexto, tipoContrato } from "../../lib/careerops/text.mjs";

const HOSTS = ["cargadetrabalhos.pt"];
const FEED = "https://cargadetrabalhos.pt/ofertas/feed/";

export function itensCarga(xml) {
  const blocos = String(xml).match(/<item\b[^>]*>[\s\S]*?<\/item>/gi) ?? [];
  return blocos.map((bloco) => ({
    title: tagTexto(bloco, "title"),
    link: tagTexto(bloco, "link"),
    pubDate: tagTexto(bloco, "pubDate"),
    description: tagTexto(bloco, "content:encoded") || tagTexto(bloco, "description"),
    company: tagTexto(bloco, "job:company") || tagTexto(bloco, "dc:creator"),
    location: tagTexto(bloco, "job:address"),
    type: tagTexto(bloco, "job:type"),
    category: tagTexto(bloco, "job:category"),
  }));
}

export function normalizarCarga(item) {
  if (!item || typeof item.title !== "string" || !item.title.trim()) return null;
  const url = httpsNoHost(item.link, HOSTS);
  if (!url) return null;
  const location = typeof item.location === "string" ? item.location.trim() : "";
  const tipo = typeof item.type === "string" ? item.type.trim() : "";
  const sinais = `${tipo} ${location} ${item.title}`;
  return {
    native_id: null,
    url,
    title: item.title.trim(),
    company: typeof item.company === "string" ? item.company.trim() : "",
    location,
    remote: /remot/i.test(sinais),
    employment_type: tipoContrato(tipo),
    description: limitar(item.description),
    posted_at: paraIso(item.pubDate),
    raw: {
      company: item.company ?? "",
      location,
      type: tipo,
      category: item.category ?? "",
    },
  };
}

export default {
  id: "carga-de-trabalhos",
  profile: ["emprego"],
  hosts: HOSTS,
  async fetch(_params, ctx) {
    const xml = await buscarTexto(FEED, HOSTS, { ...ctx, accept: "application/rss+xml, application/xml, text/xml" });
    return { listings: itensCarga(xml), errors: [] };
  },
  normalize: normalizarCarga,
};
