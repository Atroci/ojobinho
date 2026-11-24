import { buscarTexto } from "../../lib/careerops/http.mjs";
import { htmlParaTexto, httpsNoHost, limitar, paraIso, tagTexto } from "../../lib/careerops/text.mjs";

const HOSTS = ["jobs.wordpress.net"];
const FEED = "https://jobs.wordpress.net/feed/";

export function itensWordpress(xml) {
  const blocos = String(xml).match(/<item\b[^>]*>[\s\S]*?<\/item>/gi) ?? [];
  return blocos.map((bloco) => ({
    title: tagTexto(bloco, "title"),
    link: tagTexto(bloco, "link"),
    pubDate: tagTexto(bloco, "pubDate"),
    description: tagTexto(bloco, "content:encoded") || tagTexto(bloco, "description"),
    creator: tagTexto(bloco, "dc:creator"),
    categories: [...bloco.matchAll(/<category\b[^>]*>([\s\S]*?)<\/category>/gi)].map((match) => htmlParaTexto(match[1])).filter(Boolean),
  }));
}

export function normalizarWordpress(item) {
  if (!item || typeof item.title !== "string" || !item.title.trim()) return null;
  const url = httpsNoHost(item.link, HOSTS);
  if (!url) return null;
  const categorias = Array.isArray(item.categories) ? item.categories : [];
  const local = categorias.filter((categoria) => /remote|remoto|portugal|lisboa|europe|worldwide|anywhere/i.test(categoria));
  const location = local.join(", ");
  return {
    native_id: null,
    url,
    title: item.title.trim(),
    company: typeof item.creator === "string" ? item.creator.trim() : "",
    location,
    remote: /remote|remoto|worldwide|anywhere/i.test(`${location} ${item.title}`),
    posted_at: paraIso(item.pubDate),
    description: limitar(item.description),
    raw: { categories: categorias },
  };
}

export default {
  id: "wordpress-jobs",
  profile: ["emprego", "freelance"],
  hosts: HOSTS,
  async fetch(_params, ctx) {
    const xml = await buscarTexto(FEED, HOSTS, { ...ctx, accept: "application/rss+xml, application/xml, text/xml" });
    return { listings: itensWordpress(xml), errors: [] };
  },
  normalize: normalizarWordpress,
};
