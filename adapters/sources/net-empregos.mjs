import { buscarTexto, pausa } from "../../lib/careerops/http.mjs";
import { decodificarEntidades, htmlParaTexto } from "../../lib/careerops/text.mjs";

const HOSTS = ["www.net-empregos.com"];
const BASE = "https://www.net-empregos.com";

export const CONSULTAS = [
  "manutenção website",
  "manutenção websites",
  "manutenção sites",
  "desenvolvimento websites",
  "desenvolvimento web",
  "web developer",
  "wordpress",
  "criação de websites",
  "programador web",
  "web designer",
  "loja online",
  "front-end",
];

const WEB = /(web ?sites?|sites?\b|p[áa]ginas? web|wordpress|woocommerce|shopify|loja(s)? online|e-?commerce|front-?end|full[ -]?stack|web)/i;
const ACAO = /(manuten[çc][ãa]o|desenvolv\w*|cria[çc][ãa]o|programa\w*|developer|design\w*|atualiza\w*|gest[ãa]o)/i;

export function urlBusca(consulta, pagina) {
  const url = new URL("/pesquisa-empregos.asp", BASE);
  url.searchParams.set("page", String(pagina));
  url.searchParams.set("chaves", consulta);
  url.searchParams.set("categoria", "0");
  url.searchParams.set("zona", "0");
  url.searchParams.set("tipo", "0");
  return url.href;
}

export function analisarPagina(html) {
  const saida = [];
  for (const bloco of String(html).split('<div class="job-item media">').slice(1)) {
    const match = bloco.match(/href=\/?"?\/(\d{6,})\/([^/"> ]+)\/"?>([^<]+)<\/a>/);
    if (!match) continue;
    const meta = [...bloco.matchAll(/<li[^>]*>(.*?)<\/li>/gis)].map((item) => htmlParaTexto(item[1]).trim()).filter(Boolean);
    saida.push({
      id: match[1],
      url: `${BASE}/${match[1]}/${match[2]}/`,
      title: decodificarEntidades(match[3]).trim(),
      meta,
    });
  }
  return saida;
}

export function classificarWeb(titulo, descricao = "") {
  const texto = `${titulo} ${descricao}`.toLowerCase();
  const forte = texto.match(/(manuten[çc][ãa]o|desenvolv\w*|cria[çc][ãa]o)\s+(de\s+|do\s+|dos\s+)?(web ?sites?|sites?|p[áa]ginas web|lojas? online|wordpress)/i);
  const perto = texto.match(new RegExp(`${ACAO.source}.{0,60}${WEB.source}`, "i")) || texto.match(new RegExp(`${WEB.source}.{0,60}${ACAO.source}`, "i"));
  if (forte || (perto && WEB.test(titulo))) return true;
  return false;
}

export function normalizarNetEmpregos(item) {
  if (!item?.id || !item?.title || !item?.url) return null;
  const meta = item.meta ?? [];
  const tags = ["web"];
  if (classificarWeb(item.title, item.description ?? "")) tags.push("web");
  return {
    native_id: String(item.id),
    url: item.url,
    title: item.title,
    company: meta[3] || "",
    location: meta[1] || "",
    description: item.description || "",
    posted_at: null,
    tags,
    raw: item,
  };
}

export default {
  id: "net-empregos",
  profile: ["emprego"],
  hosts: HOSTS,
  async fetch(params, ctx) {
    const consultas = params.queries ?? CONSULTAS;
    const paginas = Math.min(Number(params.pages ?? 3) || 3, 3);
    const porId = new Map();
    const errors = [];
    let primeira = true;
    for (const consulta of consultas) {
      for (let pagina = 1; pagina <= paginas; pagina += 1) {
        if (!primeira) await pausa(ctx, 700);
        primeira = false;
        const url = urlBusca(consulta, pagina);
        try {
          const html = await buscarTexto(url, HOSTS, ctx);
          for (const item of analisarPagina(html)) {
            if (!porId.has(item.id)) porId.set(item.id, { ...item, query: consulta });
          }
        } catch (erro) {
          errors.push(`${url}: ${erro.message}`);
        }
      }
    }
    return { listings: [...porId.values()], errors };
  },
  normalize: normalizarNetEmpregos,
};
