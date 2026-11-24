import { buscarTexto, pausa } from "../../lib/careerops/http.mjs";
import { decodificarEntidades, htmlParaTexto, paraIso } from "../../lib/careerops/text.mjs";

const HOSTS = ["www.99freelas.com.br"];
const TETO_PAGINAS = 3;

export function urlsPaginas(paginas) {
  const total = Math.min(Math.max(Number(paginas) || 1, 1), TETO_PAGINAS);
  return Array.from({ length: total }, (_, indice) => `https://www.99freelas.com.br/projects?page=${indice + 1}`);
}

export function analisarListagem(html) {
  const blocos = String(html).split("result-item").slice(1);
  const saida = [];
  for (const bloco of blocos) {
    const link = bloco.match(/href="(\/project\/[^"?#]+)/);
    if (!link) continue;
    const slug = link[1].replace(/^\/project\//, "");
    const id = slug.match(/-(\d+)$/)?.[1] ?? slug;
    const titulo = bloco.match(/<h1 class="title">[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i)?.[1] ?? "";
    const descricao = bloco.match(/data-content="([^"]*)"/)?.[1] ?? "";
    const propostas = bloco.match(/Propostas:\s*(\d+)/i)?.[1];
    const cliente = bloco.match(/class="item-text client"[^>]*>([\s\S]*?)<\//i)?.[1] ?? "";
    const publicado = bloco.match(/<b class="datetime"[^>]*cp-datetime="(\d+)"/i)?.[1];
    saida.push({
      id,
      slug,
      title: decodificarEntidades(htmlParaTexto(titulo)),
      url: `https://www.99freelas.com.br/project/${slug}`,
      description: decodificarEntidades(descricao),
      proposals: propostas ? Number(propostas) : null,
      client: htmlParaTexto(cliente).replace(/^Cliente:\s*/, ""),
      posted_at: publicado ? paraIso(Number(publicado)) : null,
    });
  }
  return saida;
}

export function normalizar99Freelas(item) {
  if (!item?.title || !item?.url || !item?.id) return null;
  return {
    native_id: String(item.id),
    url: item.url,
    title: item.title,
    company: item.client || "",
    location: "",
    remote: true,
    description: item.description || "",
    proposals: item.proposals,
    posted_at: item.posted_at ?? null,
    employment_type: "freelance",
    raw: { id: item.id, client: item.client || "" },
  };
}

export default {
  id: "99freelas",
  profile: ["freelance"],
  hosts: HOSTS,
  async fetch(params, ctx) {
    const urls = urlsPaginas(params.pages ?? params.max_pages ?? 1);
    const listings = [];
    const errors = [];
    for (let indice = 0; indice < urls.length; indice += 1) {
      if (indice > 0) await pausa(ctx, 500);
      try {
        const html = await buscarTexto(urls[indice], HOSTS, ctx);
        listings.push(...analisarListagem(html));
      } catch (erro) {
        errors.push(erro.message);
        break;
      }
    }
    return { listings, errors };
  },
  normalize: normalizar99Freelas,
};
