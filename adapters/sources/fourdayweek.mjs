import { buscarJson, pausa } from "../../lib/careerops/http.mjs";
import { httpsNoHost, limitar, paraIso, tipoContrato } from "../../lib/careerops/text.mjs";

const HOSTS = ["4dayweek.io"];
const API = "https://4dayweek.io/api/v2/jobs";

function centavos(valor) {
  if (valor == null || valor === "") return null;
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return null;
  return Math.round(numero) / 100;
}

function contrato(valor) {
  const texto = String(valor ?? "").toLowerCase();
  if (texto === "permanent") return "full_time";
  return tipoContrato(texto);
}

export function normalizarFourdayweek(vaga) {
  if (!vaga || typeof vaga !== "object") return null;
  const slug = typeof vaga.slug === "string" ? vaga.slug.trim() : "";
  const publicada = httpsNoHost(vaga.url, HOSTS);
  const url = publicada || ( /^[a-z0-9-]{3,180}$/.test(slug) ? `https://4dayweek.io/job/${slug}` : "");
  if (!url || typeof vaga.title !== "string" || !vaga.title.trim()) return null;
  const locais = Array.isArray(vaga.locations)
    ? vaga.locations.map((item) => (typeof item?.country === "string" ? item.country.trim() : "")).filter(Boolean)
    : [];
  const arranjo = typeof vaga.work_arrangement === "string" ? vaga.work_arrangement : "";
  return {
    native_id: typeof vaga.id === "string" && vaga.id.trim() ? vaga.id.trim() : slug,
    url,
    title: vaga.title.trim(),
    company: typeof vaga.company?.name === "string" ? vaga.company.name.trim() : "",
    location: locais.join(", "),
    remote: arranjo === "remote",
    employment_type: contrato(vaga.contract_type),
    pay_min: centavos(vaga.salary_min),
    pay_max: centavos(vaga.salary_max),
    pay_currency: vaga.salary_currency ? String(vaga.salary_currency).toUpperCase() : null,
    pay_period: vaga.salary_period === "year" ? "year" : (vaga.salary_period === "hour" ? "hour" : vaga.salary_period ?? null),
    posted_at: paraIso(vaga.posted_at),
    description: limitar(vaga.description),
    raw: { id: vaga.id ?? null, slug, category: vaga.category ?? null, schedule_type: vaga.schedule_type ?? null },
  };
}

export default {
  id: "fourdayweek",
  profile: ["emprego", "freelance"],
  hosts: HOSTS,
  async fetch(params, ctx) {
    const limite = Math.min(Math.max(Number(params?.limit ?? 25) || 25, 1), 100);
    const paginas = Math.min(Math.max(Number(params?.max_pages ?? 1) || 1, 1), 2);
    const listings = [];
    const errors = [];
    const vistos = new Set();
    for (let pagina = 1; pagina <= paginas; pagina += 1) {
      if (pagina > 1) await pausa(ctx, 300);
      const url = new URL(API);
      url.searchParams.set("limit", String(limite));
      url.searchParams.set("page", String(pagina));
      if (typeof params?.country === "string" && /^[a-z-]{2,32}$/i.test(params.country)) url.searchParams.set("country", params.country.toLowerCase());
      if (typeof params?.q === "string" && params.q.trim()) url.searchParams.set("q", params.q.trim().slice(0, 80));
      try {
        const json = await buscarJson(url.href, HOSTS, ctx);
        const linhas = json?.data ?? json?.jobs;
        if (!Array.isArray(linhas)) throw new Error("4dayweek: resposta sem data");
        for (const vaga of linhas) {
          const chave = vaga?.id || vaga?.slug;
          if (chave && vistos.has(chave)) continue;
          if (chave) vistos.add(chave);
          listings.push(vaga);
        }
        if (json.has_more === false || linhas.length < limite) break;
      } catch (erro) {
        errors.push(erro.message);
        break;
      }
    }
    return { listings, errors };
  },
  normalize: normalizarFourdayweek,
};
