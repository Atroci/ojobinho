import { buscarJson } from "../../lib/careerops/http.mjs";
import { limitar, paraIso } from "../../lib/careerops/text.mjs";

const HOSTS = ["www.freelancer.com"];
const API = "https://www.freelancer.com/api/projects/0.1/projects/active/";

export const OFICIOS_PADRAO = [38, 2356, 298, 69, 1026, 1023];

export function tokenFreelancer(ctx) {
  const bruto = ctx?.env?.FREELANCER_TOKEN ?? process.env.FREELANCER_TOKEN;
  if (typeof bruto !== "string") return "";
  const token = bruto.trim();
  if (!token || token.length > 4096 || /[\r\n]/.test(token)) return "";
  return token;
}

export function oficiosFreelancer(params = {}) {
  const lista = Array.isArray(params.job_ids) && params.job_ids.length ? params.job_ids : OFICIOS_PADRAO;
  const ids = [];
  for (const item of lista) {
    const numero = Number(item);
    if (!Number.isInteger(numero) || numero <= 0 || numero >= 100000) continue;
    if (!ids.includes(numero)) ids.push(numero);
    if (ids.length >= 8) break;
  }
  if (!ids.length) throw new Error("freelancer: nenhum ofício");
  return ids;
}

export function dentroDoPiso(projeto, params = {}) {
  if (params.min_budget == null || params.min_budget === "") return true;
  const piso = Number(params.min_budget);
  if (!Number.isFinite(piso)) return true;
  const maximo = Number(projeto?.budget?.maximum ?? projeto?.budget?.minimum);
  if (!Number.isFinite(maximo)) return false;
  const pedido = params.min_budget_currency ? String(params.min_budget_currency).toUpperCase() : "";
  const moeda = projeto?.currency?.code ? String(projeto.currency.code).toUpperCase() : "";
  if (pedido && moeda && moeda !== pedido) return false;
  return maximo >= piso;
}

export function normalizarFreelancer(projeto) {
  if (!projeto || typeof projeto !== "object" || projeto.deleted === true) return null;
  if (projeto.status && projeto.status !== "active") return null;
  if (projeto.frontend_project_status && projeto.frontend_project_status !== "open") return null;
  const id = String(projeto.id ?? "");
  if (!/^\d{1,12}$/.test(id)) return null;
  const seo = typeof projeto.seo_url === "string" ? projeto.seo_url.trim() : "";
  if (!/^[\w.-]+(?:\/[\w.-]+)+$/.test(seo) || seo.includes("..")) return null;
  const title = typeof projeto.title === "string" ? projeto.title.trim() : "";
  if (!title) return null;
  const moeda = projeto.currency?.code ? String(projeto.currency.code).toUpperCase() : null;
  const periodo = projeto.type === "hourly" ? "hour" : (projeto.type === "fixed" ? "fixed" : null);
  const propostas = Number(projeto.bid_stats?.bid_count);
  return {
    native_id: id,
    url: `https://www.freelancer.com/projects/${seo}`,
    title,
    company: "",
    location: projeto.local === false ? "Remote" : (projeto.location?.country?.name || ""),
    remote: projeto.local === false,
    employment_type: "freelance",
    pay_min: numero(projeto.budget?.minimum),
    pay_max: numero(projeto.budget?.maximum),
    pay_currency: moeda,
    pay_period: periodo,
    posted_at: paraIso(projeto.time_submitted),
    description: limitar(projeto.description || projeto.preview_description || ""),
    proposals: Number.isInteger(propostas) ? propostas : null,
    raw: {
      id: projeto.id,
      seo_url: seo,
      type: projeto.type ?? null,
      jobs: Array.isArray(projeto.jobs) ? projeto.jobs.map((item) => item?.id).filter((item) => item != null) : [],
    },
  };
}

function numero(valor) {
  if (valor == null || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

export default {
  id: "freelancer",
  profile: ["freelance"],
  hosts: HOSTS,
  async fetch(params, ctx) {
    const token = tokenFreelancer(ctx);
    const ids = oficiosFreelancer(params ?? {});
    const limite = Math.min(Math.max(Number(params?.limit ?? 20) || 20, 1), 30);
    const url = new URL(API);
    for (const id of ids) url.searchParams.append("jobs[]", String(id));
    url.searchParams.set("limit", String(limite));
    url.searchParams.set("job_details", "true");
    url.searchParams.set("full_description", "true");
    const opcoes = token ? { ...ctx, headers: { "freelancer-oauth-v1": token } } : ctx;
    let json;
    try {
      json = await buscarJson(url.href, HOSTS, opcoes);
    } catch (erro) {
      if (!token && /HTTP 40[13]/.test(String(erro?.message ?? ""))) {
        return { listings: [], errors: [], skipped: "no-token" };
      }
      throw erro;
    }
    const projetos = json?.result?.projects;
    if (!Array.isArray(projetos)) throw new Error("freelancer: resposta sem projects");
    return { listings: projetos.filter((projeto) => dentroDoPiso(projeto, params ?? {})), errors: [] };
  },
  normalize: normalizarFreelancer,
};
