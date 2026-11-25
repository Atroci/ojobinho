import { buscarJson, pausa } from "../../lib/careerops/http.mjs";
import { httpsAbsoluto, limitar } from "../../lib/careerops/text.mjs";

const HOSTS = ["hn.algolia.com"];
const BUSCA_CONTRATACAO = "https://hn.algolia.com/api/v1/search_by_date?tags=story,author_whoishiring&hitsPerPage=5";
const BUSCA_FREELANCER = "https://hn.algolia.com/api/v1/search_by_date?query=Ask%20HN%3A%20Freelancer%3F%20Seeking%20freelancer%3F&tags=story&hitsPerPage=5";

function textoComentario(comentario) {
  return String(comentario?.text ?? "").replace(/<[^>]+>/g, " ").trim();
}

function primeiraLinha(texto) {
  return texto.split("\n").map((linha) => linha.trim()).find(Boolean) ?? "";
}

export function ehSeekingFreelancer(comentario) {
  const primeira = primeiraLinha(textoComentario(comentario));
  return /^seeking freelancers?\b/i.test(primeira);
}

function idNumerico(valor) {
  const texto = String(valor ?? "");
  return /^\d{1,12}$/.test(texto) ? texto : "";
}

export function normalizarHn(comentario) {
  const texto = textoComentario(comentario);
  if (!texto) return null;
  const primeira = primeiraLinha(texto);
  if (!primeira) return null;
  const link = texto.match(/https:\/\/[^\s)<]+/i)?.[0] ?? "";
  const url = httpsAbsoluto(link) || `https://news.ycombinator.com/item?id=${comentario.id}`;
  if (ehSeekingFreelancer(comentario)) {
    const partes = primeira.split("|").map((item) => item.trim()).filter(Boolean);
    const resto = partes.filter((item) => !/^seeking freelancers?\b/i.test(item));
    return {
      native_id: comentario.id != null ? String(comentario.id) : null,
      url,
      title: (resto[0] || primeira).slice(0, 180),
      company: resto[2] || "",
      location: resto[1] || "",
      remote: /remote|remoto/i.test(primeira),
      employment_type: "freelance",
      description: limitar(texto),
      posted_at: null,
      raw: { id: comentario.id, thread: "seeking-freelancer" },
    };
  }
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

async function comentarios(objectID, ctx) {
  const id = idNumerico(objectID);
  if (!id) throw new Error("hackernews: id da thread inválido");
  return buscarJson(`https://hn.algolia.com/api/v1/items/${id}`, HOSTS, ctx);
}

export default {
  id: "hackernews",
  profile: ["emprego", "freelance"],
  hosts: HOSTS,
  async fetch(params, ctx) {
    const teto = Math.min(Number(params.max_comments ?? 30) || 30, 40);
    const json = await buscarJson(BUSCA_CONTRATACAO, HOSTS, ctx);
    const hit = (json?.hits ?? []).find((item) => /who is hiring/i.test(item.title ?? ""));
    if (!hit?.objectID) throw new Error("hackernews: thread mensal não encontrada");
    const item = await comentarios(hit.objectID, ctx);
    const filhos = Array.isArray(item?.children) ? item.children.slice(0, teto) : [];
    const listings = [...filhos];
    const errors = [];
    await pausa(ctx, 200);
    try {
      const busca = await buscarJson(BUSCA_FREELANCER, HOSTS, ctx);
      const thread = (busca?.hits ?? []).find((entrada) => /freelancer\?\s*seeking freelancer\?/i.test(entrada.title ?? ""));
      if (!thread?.objectID) {
        errors.push("hackernews: thread seeking freelancer não encontrada");
      } else {
        await pausa(ctx, 200);
        const fio = await comentarios(thread.objectID, ctx);
        const tops = (Array.isArray(fio?.children) ? fio.children : []).filter(ehSeekingFreelancer).slice(0, teto);
        listings.push(...tops);
      }
    } catch (erro) {
      errors.push(erro.message);
    }
    return { listings, errors };
  },
  normalize: normalizarHn,
};
