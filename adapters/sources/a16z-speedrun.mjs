import { buscarJson, pausa } from "../../lib/careerops/http.mjs";
import { localCompativel } from "../../lib/careerops/geo.mjs";
import { httpsNoHost, paraIso, tipoContrato } from "../../lib/careerops/text.mjs";

const HOSTS = ["speedrun-talent-network.com"];
const API = "https://speedrun-talent-network.com/api/v1/jobs";

export function manterA16z(vaga) {
  if (!vaga || typeof vaga !== "object") return false;
  const url = String(vaga.url ?? "");
  if (/-ad00000(?:[/?#]|$)/.test(url)) return false;
  return localCompativel(vaga.location);
}

function origemCliente(params = {}) {
  const texto = typeof params.source === "string" && params.source.trim() ? params.source.trim() : "ojobinho";
  if (!/^[a-z0-9][a-z0-9-]{0,40}$/.test(texto)) throw new Error("a16z-speedrun: source inválido");
  return texto;
}

function periodo(valor) {
  const texto = String(valor ?? "").toLowerCase();
  if (texto === "year" || texto === "yearly") return "year";
  if (texto === "month" || texto === "monthly") return "month";
  if (texto === "hour" || texto === "hourly") return "hour";
  return null;
}

function numero(valor) {
  if (valor == null || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

export function normalizarA16z(vaga) {
  if (!manterA16z(vaga)) return null;
  if (typeof vaga.title !== "string" || !vaga.title.trim()) return null;
  const url = httpsNoHost(vaga.url, HOSTS);
  if (!url) return null;
  const location = typeof vaga.location === "string" ? vaga.location.trim() : "";
  const id = typeof vaga.id === "string" && vaga.id.trim() ? vaga.id.trim() : null;
  const arranjo = String(vaga.workplace_type ?? "").toLowerCase();
  return {
    native_id: id,
    url,
    title: vaga.title.trim(),
    company: typeof vaga.company === "string" ? vaga.company.trim() : "",
    location,
    remote: vaga.remote === true || arranjo === "remote",
    employment_type: tipoContrato(vaga.employment_type),
    pay_min: numero(vaga.comp_min),
    pay_max: numero(vaga.comp_max),
    pay_currency: vaga.comp_currency ? String(vaga.comp_currency).toUpperCase() : null,
    pay_period: periodo(vaga.comp_period),
    posted_at: paraIso(vaga.published_at),
    description: "",
    raw: {
      id,
      location,
      workplace_type: vaga.workplace_type ?? null,
      remote: vaga.remote === true,
      url,
    },
  };
}

export default {
  id: "a16z-speedrun",
  profile: ["emprego", "freelance"],
  hosts: HOSTS,
  async fetch(params, ctx) {
    const tamanho = Math.min(Math.max(Number(params?.page_size ?? 50) || 50, 1), 50);
    const paginas = Math.min(Math.max(Number(params?.max_pages ?? 1) || 1, 1), 2);
    const origem = origemCliente(params ?? {});
    const listings = [];
    const errors = [];
    const vistos = new Set();
    for (let pagina = 0; pagina < paginas; pagina += 1) {
      if (pagina > 0) await pausa(ctx, 300);
      const url = new URL(API);
      url.searchParams.set("source", origem);
      url.searchParams.set("page_size", String(tamanho));
      url.searchParams.set("page", String(pagina));
      try {
        const json = await buscarJson(url.href, HOSTS, ctx);
        const linhas = json?.jobs;
        if (!Array.isArray(linhas)) throw new Error("a16z-speedrun: resposta sem jobs");
        for (const vaga of linhas) {
          if (!manterA16z(vaga)) continue;
          const chave = vaga?.id || vaga?.url;
          if (chave && vistos.has(chave)) continue;
          if (chave) vistos.add(chave);
          listings.push(vaga);
        }
        if (json.has_more === false || linhas.length < tamanho) break;
      } catch (erro) {
        errors.push(erro.message);
        break;
      }
    }
    return { listings, errors };
  },
  normalize: normalizarA16z,
};
