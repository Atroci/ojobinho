import { buscarJson } from "../../lib/careerops/http.mjs";
import { httpsAbsoluto, limitar } from "../../lib/careerops/text.mjs";

const HOSTS = ["hn.algolia.com"];
const BUSCA = "https://hn.algolia.com/api/v1/search_by_date?tags=story,author_whoishiring&hitsPerPage=5";

export function normalizarHn(comentario) {
  const texto = String(comentario?.text ?? "").replace(/<[^>]+>/g, " ").trim();
  if (!texto) return null;
  const primeira = texto.split("\n").map((linha) => linha.trim()).find(Boolean) ?? "";
  if (!primeira) return null;
  const link = texto.match(/https:\/\/[^\s)<]+/i)?.[0] ?? "";
  const url = httpsAbsoluto(link) || `https://news.ycombinator.com/item?id=${comentario.id}`;
  const partes = primeira.split("|").map((item) => item.trim());
  return {
    native_id: comentario.id != null ? String(comentario.id) : null,
    url,
    title: (partes[1] || partes[0] || primeira).slice(0, 180),
    company: partes.length > 1 ? partes[0] : "",
    location: partes[2] || "",
    remote: /remote|remoto/i.test(primeira),
    description: limitar(texto),
    posted_at: null,
    raw: { id: comentario.id },
  };
}

export default {
  id: "hackernews",
  profile: ["emprego", "freelance"],
  hosts: HOSTS,
  async fetch(params, ctx) {
    const json = await buscarJson(BUSCA, HOSTS, ctx);
    const hit = (json?.hits ?? []).find((item) => /who is hiring/i.test(item.title ?? ""));
    if (!hit?.objectID) throw new Error("hackernews: thread mensal não encontrada");
    const item = await buscarJson(`https://hn.algolia.com/api/v1/items/${hit.objectID}`, HOSTS, ctx);
    const teto = Math.min(Number(params.max_comments ?? 30) || 30, 40);
    const filhos = Array.isArray(item?.children) ? item.children.slice(0, teto) : [];
    return { listings: filhos, errors: [] };
  },
  normalize: normalizarHn,
};
