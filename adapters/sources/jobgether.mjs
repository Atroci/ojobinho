import { buscarJson, pausa } from "../../lib/careerops/http.mjs";
import { httpsNoHost, normalizarChave, paraIso, tipoContrato } from "../../lib/careerops/text.mjs";

const HOSTS = ["jobgether.com"];
const API = "https://jobgether.com/api/v1/jobs";
const CONTRATOS = new Set(["full-time", "part-time", "fixed-term", "freelance", "internships"]);
const LEVER_HOSTS = ["jobs.lever.co", "jobs.eu.lever.co"];

export function contratosJobgether(params = {}) {
  const lista = Array.isArray(params.contract_types) && params.contract_types.length ? params.contract_types : ["freelance"];
  const saida = [];
  for (const item of lista) {
    const texto = String(item ?? "").trim().toLowerCase();
    if (!CONTRATOS.has(texto) || saida.includes(texto)) continue;
    saida.push(texto);
  }
  if (!saida.length) throw new Error("jobgether: contractType inválido");
  return saida;
}

export function locaisJobgether(params = {}) {
  const lista = Array.isArray(params.locations) && params.locations.length ? params.locations : ["portugal", "europe", "anywhere"];
  const saida = [];
  for (const item of lista) {
    const texto = String(item ?? "").trim().toLowerCase();
    if (!/^[a-z0-9-]{2,40}$/.test(texto) || saida.includes(texto)) continue;
    saida.push(texto);
    if (saida.length >= 6) break;
  }
  if (!saida.length) throw new Error("jobgether: localização inválida");
  return saida;
}

export function indiceLever(payload) {
  const mapa = new Map();
  if (!Array.isArray(payload)) return mapa;
  for (const vaga of payload) {
    const title = normalizarChave(vaga?.text);
    const url = httpsNoHost(vaga?.hostedUrl, LEVER_HOSTS);
    const id = typeof vaga?.id === "string" ? vaga.id : "";
    if (!title || !url || !/^[A-Za-z0-9_-]{4,80}$/.test(id)) continue;
    if (!url.includes("/jobgether/")) continue;
    mapa.set(title, { url, id, location: typeof vaga?.categories?.location === "string" ? vaga.categories.location : "" });
  }
  return mapa;
}

export function normalizarJobgether(vaga) {
  const title = typeof vaga?.title === "string" ? vaga.title.trim() : "";
  if (!title) return null;
  const leverUrl = vaga?.lever?.url ? httpsNoHost(vaga.lever.url, LEVER_HOSTS) : "";
  const propria = httpsNoHost(vaga?.url, ["jobgether.com", "www.jobgether.com"]);
  const url = leverUrl || propria;
  if (!url) return null;
  const location = typeof vaga.location === "string" ? vaga.location.trim() : "";
  const remoto = typeof vaga.remote === "string" ? vaga.remote : "";
  const id = typeof vaga.id === "string" && /^[A-Za-z0-9_-]{6,80}$/.test(vaga.id) ? vaga.id : null;
  return {
    native_id: leverUrl && vaga.lever?.id ? `lever:${vaga.lever.id}` : id,
    url,
    title,
    company: typeof vaga.company === "string" ? vaga.company.trim() : "",
    location,
    remote: /remote/i.test(remoto) && !/hybrid/i.test(remoto),
    employment_type: tipoContrato(vaga.contractType),
    posted_at: paraIso(vaga.postedAt),
    description: "",
    raw: {
      id: vaga.id ?? null,
      contractType: vaga.contractType ?? null,
      remote: vaga.remote ?? null,
      lever_id: vaga.lever?.id ?? null,
    },
  };
}

export default {
  id: "jobgether",
  profile: ["freelance"],
  hosts: [...HOSTS, "api.lever.co"],
  async fetch(params, ctx) {
    const tipos = contratosJobgether(params ?? {});
    const locais = locaisJobgether(params ?? {});
    const limite = Math.min(Math.max(Number(params?.limit ?? 25) || 25, 1), 25);
    const paginas = Math.min(Math.max(Number(params?.max_pages ?? 1) || 1, 1), 2);
    const listings = [];
    const errors = [];
    const vistos = new Set();
    for (let pagina = 1; pagina <= paginas; pagina += 1) {
      if (pagina > 1) await pausa(ctx, 400);
      const corpo = { contractType: tipos, locations: locais, limit: limite, page: pagina, sort: "date" };
      try {
        const json = await buscarJson(API, HOSTS, {
          ...ctx,
          method: "POST",
          body: JSON.stringify(corpo),
          headers: { "content-type": "application/json" },
        });
        if (!json || !Array.isArray(json.jobs)) throw new Error("jobgether: resposta sem jobs");
        for (const vaga of json.jobs) {
          if (vaga?.id && vistos.has(vaga.id)) continue;
          if (vaga?.id) vistos.add(vaga.id);
          listings.push(vaga);
        }
        if (!json.pagination?.hasMore) break;
      } catch (erro) {
        errors.push(erro.message);
        break;
      }
    }
    let indice = new Map();
    if (params?.dedupe_lever !== false) {
      try {
        const lever = await buscarJson("https://api.lever.co/v0/postings/jobgether?mode=json", ["api.lever.co"], ctx);
        indice = indiceLever(lever);
      } catch (erro) {
        errors.push(erro.message);
      }
    }
    const comLever = listings.map((vaga) => {
      const empresa = normalizarChave(vaga?.company);
      if (!empresa.includes("jobgether")) return vaga;
      const lever = indice.get(normalizarChave(vaga?.title));
      return lever ? { ...vaga, lever } : vaga;
    });
    return { listings: comLever, errors };
  },
  normalize: normalizarJobgether,
};
