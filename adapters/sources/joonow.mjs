import { buscarJson, pausa } from "../../lib/careerops/http.mjs";
import { httpsNoHost, paraIso, tipoContrato } from "../../lib/careerops/text.mjs";

const HOSTS = ["www.joonow.com"];
const API = "https://www.joonow.com/api/v1/jobs";
const PAUSA_MS = 7000;
const ATRIBUICAO_PADRAO = { text: "Vagas via Joonow", url: "https://www.joonow.com" };

export function chaveJoonow(ctx) {
  const bruto = ctx?.env?.JOONOW_API_KEY ?? process.env.JOONOW_API_KEY;
  if (typeof bruto !== "string") return "";
  const chave = bruto.trim();
  if (!chave || chave.length > 256 || /[\r\n]/.test(chave)) return "";
  return chave;
}

export function atribuicaoJoonow(valor) {
  const text = typeof valor?.text === "string" && valor.text.trim() ? valor.text.trim().slice(0, 200) : ATRIBUICAO_PADRAO.text;
  const url = httpsNoHost(valor?.url, HOSTS) || ATRIBUICAO_PADRAO.url;
  return { text, url };
}

function periodo(valor) {
  const texto = String(valor ?? "").toLowerCase();
  if (texto === "month" || texto === "monthly") return "month";
  if (texto === "year" || texto === "yearly") return "year";
  if (texto === "hour" || texto === "hourly") return "hour";
  if (texto === "week" || texto === "weekly") return "week";
  return null;
}

function numero(valor) {
  if (valor == null || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

function localDe(valor) {
  if (typeof valor === "string") return valor.trim();
  if (!valor || typeof valor !== "object") return "";
  return [valor.city, valor.region, valor.country].filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim()).join(", ");
}

export function normalizarJoonow(vaga) {
  if (!vaga || typeof vaga !== "object") return null;
  if (typeof vaga.title !== "string" || !vaga.title.trim()) return null;
  const url = httpsNoHost(vaga.url, HOSTS);
  if (!url) return null;
  const id = typeof vaga.id === "string" && vaga.id.trim() ? vaga.id.trim() : null;
  const location = localDe(vaga.location);
  const modelo = String(vaga.workModel ?? "");
  const atribuicao = atribuicaoJoonow(vaga.attribution);
  const applyUrl = httpsNoHost(vaga.applyUrl, HOSTS) || null;
  const empresa = vaga.company;
  const company = typeof empresa === "string" ? empresa.trim() : (typeof empresa?.name === "string" ? empresa.name.trim() : "");
  return {
    native_id: id,
    url,
    title: vaga.title.trim(),
    company,
    location,
    remote: /^(remote|anywhere)$/i.test(modelo),
    employment_type: tipoContrato(vaga.employmentType),
    pay_min: numero(vaga.salary?.min),
    pay_max: numero(vaga.salary?.max),
    pay_currency: vaga.salary?.currency ? String(vaga.salary.currency).toUpperCase() : null,
    pay_period: periodo(vaga.salary?.period),
    posted_at: paraIso(vaga.postedAt),
    description: "",
    raw: {
      id,
      url,
      applyUrl,
      attribution: atribuicao,
      source_url: atribuicao.url,
    },
  };
}

function pais(params = {}) {
  const texto = typeof params.country === "string" ? params.country.trim().toUpperCase() : "";
  if (!texto) return "";
  if (!/^[A-Z]{2}$/.test(texto)) throw new Error("joonow: country inválido");
  return texto;
}

export default {
  id: "joonow",
  profile: ["emprego"],
  hosts: HOSTS,
  async fetch(params, ctx) {
    const limite = Math.min(Math.max(Number(params?.limit ?? 20) || 20, 1), 50);
    const paginas = Math.min(Math.max(Number(params?.max_pages ?? 1) || 1, 1), 3);
    const country = pais(params ?? {});
    const chave = chaveJoonow(ctx);
    const opcoes = chave ? { ...ctx, headers: { "X-Api-Key": chave } } : ctx;
    const listings = [];
    const errors = [];
    const vistos = new Set();
    let cursor = "";
    for (let pagina = 0; pagina < paginas; pagina += 1) {
      if (pagina > 0) await pausa(ctx, PAUSA_MS);
      const url = new URL(API);
      url.searchParams.set("sort", "date");
      url.searchParams.set("limit", String(limite));
      if (country) url.searchParams.set("country", country);
      if (cursor) url.searchParams.set("cursor", cursor);
      try {
        const json = await buscarJson(url.href, HOSTS, opcoes);
        const linhas = json?.data;
        if (!Array.isArray(linhas)) throw new Error("joonow: resposta sem data");
        const atribuicao = atribuicaoJoonow(json.attribution);
        for (const vaga of linhas) {
          const id = vaga?.id;
          if (id && vistos.has(id)) continue;
          if (id) vistos.add(id);
          listings.push({ ...vaga, attribution: atribuicao });
        }
        if (typeof json.nextCursor !== "string" || !json.nextCursor.trim()) break;
        cursor = json.nextCursor.trim();
      } catch (erro) {
        errors.push(erro.message);
        break;
      }
    }
    return { listings, errors };
  },
  normalize: normalizarJoonow,
};
