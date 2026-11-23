import { buscarJson, pausa } from "../../lib/careerops/http.mjs";
import { httpsNoHost, limitar, paraIso } from "../../lib/careerops/text.mjs";

const HOSTS = ["portal.gupy.io"];
const CONFIDENCIAL = /^(?:empresa\s+)?confidencial$/i;

export function normalizarGupyBusca(vaga) {
  if (!vaga || vaga.isConfidentialCareerPage === true || typeof vaga.name !== "string" || !vaga.name.trim()) return null;
  const url = httpsNoHost(vaga.jobUrl, ["gupy.io"]);
  if (!url) return null;
  const company = typeof vaga.careerPageName === "string" ? vaga.careerPageName.trim() : "";
  if (!company || CONFIDENCIAL.test(company)) return null;
  if (typeof vaga.careerPageLogo === "string" && vaga.careerPageLogo.endsWith("/confidencial_logo.png")) return null;
  const tipo = typeof vaga.workplaceType === "string" ? vaga.workplaceType.trim() : "";
  const rotulo = { remote: "Remoto", hybrid: "Híbrido", "on-site": "Presencial" }[tipo] || tipo;
  const partes = [rotulo, vaga.city, vaga.state, vaga.country].filter((item) => typeof item === "string" && item.trim());
  return {
    native_id: vaga.id != null ? String(vaga.id) : null,
    url,
    title: vaga.name.trim(),
    company,
    location: partes.join(", "),
    remote: tipo === "remote" || vaga.isRemoteWork === true,
    description: limitar(vaga.description),
    posted_at: paraIso(vaga.publishedDate),
    raw: vaga,
  };
}

export default {
  id: "gupy",
  profile: ["emprego"],
  hosts: HOSTS,
  async fetch(params, ctx) {
    const palavras = (params.keywords ?? ["wordpress", "seo"]).slice(0, 5);
    const limite = Math.min(Number(params.limit ?? 20) || 20, 50);
    const listings = [];
    const errors = [];
    for (const palavra of palavras) {
      if (listings.length) await pausa(ctx, 200);
      const url = new URL("https://portal.gupy.io/api/job-search/jobs");
      url.searchParams.set("jobName", palavra);
      url.searchParams.set("offset", "0");
      url.searchParams.set("limit", String(limite));
      try {
        const json = await buscarJson(url.href, HOSTS, ctx);
        if (!json || !Array.isArray(json.data)) throw new Error(`gupy: resposta inválida para ${palavra}`);
        listings.push(...json.data);
      } catch (erro) {
        errors.push(erro.message);
      }
    }
    return { listings, errors };
  },
  normalize: normalizarGupyBusca,
};
