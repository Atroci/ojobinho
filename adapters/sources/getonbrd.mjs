import { buscarJson, pausa } from "../../lib/careerops/http.mjs";
import { httpsNoHost, paraIso } from "../../lib/careerops/text.mjs";

const HOSTS = ["www.getonbrd.com"];
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function normalizarGetonbrd(vaga) {
  const attr = vaga?.attributes;
  if (!attr || typeof attr.title !== "string" || !attr.title.trim()) return null;
  const url = httpsNoHost(vaga.links?.public_url, HOSTS);
  if (!url) return null;
  let location = "";
  if (attr.remote === true) location = "Remote";
  else if (Array.isArray(attr.countries)) location = attr.countries.filter((item) => typeof item === "string").join(", ");
  else if (typeof attr.countries === "string") location = attr.countries.trim();
  const nome = attr.company?.data?.attributes?.name;
  return {
    native_id: vaga.id != null ? String(vaga.id) : null,
    url,
    title: attr.title.trim(),
    company: typeof nome === "string" && nome.trim() ? nome.trim() : "Get on Board",
    location,
    remote: attr.remote === true,
    posted_at: paraIso(Number.isFinite(attr.published_at) ? attr.published_at : null),
    description: "",
    raw: vaga,
  };
}

export default {
  id: "getonbrd",
  profile: ["emprego"],
  hosts: HOSTS,
  async fetch(params, ctx) {
    const categorias = (params.categories ?? ["programming"]).filter((item) => SLUG.test(item)).slice(0, 4);
    if (!categorias.length) throw new Error("getonbrd: categoria inválida");
    const max = Math.min(Number(params.max_pages ?? 1) || 1, 3);
    const listings = [];
    const errors = [];
    for (const categoria of categorias) {
      for (let pagina = 1; pagina <= max; pagina += 1) {
        if (listings.length) await pausa(ctx, 200);
        const url = `https://www.getonbrd.com/api/v0/categories/${categoria}/jobs?per_page=100&expand[]=company&page=${pagina}`;
        try {
          const json = await buscarJson(url, HOSTS, ctx);
          if (!json || !Array.isArray(json.data)) throw new Error(`getonbrd: resposta inválida em ${categoria}`);
          listings.push(...json.data);
          if (json.data.length < 100) break;
        } catch (erro) {
          errors.push(erro.message);
          break;
        }
      }
    }
    return { listings, errors };
  },
  normalize: normalizarGetonbrd,
};
