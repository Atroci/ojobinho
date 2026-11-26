import { buscarJson, pausa } from "../../lib/careerops/http.mjs";
import { limitar, normalizarChave, paraIso } from "../../lib/careerops/text.mjs";

const PAUSA_MS = 1200;
const LIMITE_PADRAO = 25;
const MAX_PAGINAS = 20;
const MAX_TENANTS = 12;
const MAX_LOCAIS = 8;

const PERMITIDOS = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT",
  "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
  "IS", "LI", "NO",
  "BR",
]);

const NOMES = [
  ["US", ["united states of america", "united states", "usa"]],
  ["CA", ["canada"]],
  ["BR", ["brazil", "brasil"]],
  ["PT", ["portugal"]],
  ["AT", ["austria"]],
  ["BE", ["belgium", "belgica"]],
  ["BG", ["bulgaria"]],
  ["HR", ["croatia", "croacia"]],
  ["CY", ["cyprus", "chipre"]],
  ["CZ", ["czechia", "czech republic", "chequia", "republica checa"]],
  ["DK", ["denmark", "dinamarca"]],
  ["EE", ["estonia"]],
  ["FI", ["finland", "finlandia"]],
  ["FR", ["france", "franca"]],
  ["DE", ["germany", "alemanha"]],
  ["GR", ["greece", "grecia"]],
  ["HU", ["hungary", "hungria"]],
  ["IE", ["ireland", "irlanda"]],
  ["IT", ["italy", "italia"]],
  ["LV", ["latvia", "letonia"]],
  ["LT", ["lithuania", "lituania"]],
  ["LU", ["luxembourg", "luxemburgo"]],
  ["MT", ["malta"]],
  ["NL", ["netherlands", "holanda", "paises baixos"]],
  ["PL", ["poland", "polonia"]],
  ["RO", ["romania", "romenia"]],
  ["SK", ["slovakia", "eslovaquia"]],
  ["SI", ["slovenia", "eslovenia"]],
  ["ES", ["spain", "espanha"]],
  ["SE", ["sweden", "suecia"]],
  ["IS", ["iceland", "islandia"]],
  ["LI", ["liechtenstein"]],
  ["NO", ["norway", "noruega"]],
];

const POR_NOME = new Map();
const FRASES = [];
for (const [iso, nomes] of NOMES) {
  for (const nome of nomes) {
    const chave = normalizarChave(nome);
    if (!chave || POR_NOME.has(chave)) continue;
    POR_NOME.set(chave, iso);
    FRASES.push([chave, iso]);
  }
}
FRASES.push(["u s a", "US"], ["u s", "US"]);
FRASES.sort((a, b) => b[0].length - a[0].length);

const REMOTO = /\b(?:remote|home(?:[-\s]+)based|remoto|teletrabalho)\b/i;
const SITE = /^CX_[A-Za-z0-9]{1,16}$/;
const ID_VAGA = /^[0-9]{1,18}$/;
const LOCAL = /^[\p{L}\p{N}][\p{L}\p{N} .'-]{0,60}$/u;
const EMPRESA = /^[\p{L}\p{N}][\p{L}\p{N} .&'-]{0,80}$/u;

export const HOSTS_ORACLE = [
  "estm.fa.em2.oraclecloud.com",
  "fa-evmr-saasfaprod1.fa.ocs.oraclecloud.com",
  "ecyq.fa.em2.oraclecloud.com",
];

function rotuloHost(valor) {
  if (typeof valor !== "string") return "";
  const texto = valor.trim();
  if (!texto || /[\s@\\#?]/.test(texto) || texto.includes("%")) return "";
  if (texto.includes("://") || texto.startsWith("//")) {
    let url;
    try {
      url = new URL(texto);
    } catch {
      return "";
    }
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.pathname !== "/" || url.search || url.hash) return "";
    return url.hostname.toLowerCase();
  }
  if (texto.includes(":") || texto.includes("/")) return "";
  return texto.toLowerCase();
}

export function hostOraclePermitido(valor) {
  const host = rotuloHost(valor);
  if (!host || !host.endsWith(".oraclecloud.com")) return "";
  if (!/^[a-z0-9.-]+$/.test(host)) return "";
  const rotulos = host.split(".");
  if (rotulos.length < 3) return "";
  if (rotulos.some((rotulo) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(rotulo))) return "";
  return host;
}

export function codigoPaisOracle(valor) {
  if (typeof valor !== "string") return "";
  const texto = valor.trim();
  if (/^[A-Za-z]{2}$/.test(texto)) return texto.toUpperCase();
  return POR_NOME.get(normalizarChave(texto)) ?? "";
}

function secundarios(vaga) {
  return Array.isArray(vaga?.secondaryLocations) ? vaga.secondaryLocations : [];
}

function textoVaga(vaga) {
  const partes = [vaga?.Title, vaga?.PrimaryLocation];
  for (const sec of secundarios(vaga)) partes.push(sec?.Name);
  return partes.filter((item) => typeof item === "string").join(" ");
}

export function codigosPaisOracle(vaga) {
  const achados = [];
  const adicionar = (valor) => {
    const iso = codigoPaisOracle(valor);
    if (iso) achados.push(iso);
  };
  adicionar(vaga?.PrimaryLocationCountry);
  for (const sec of secundarios(vaga)) {
    adicionar(sec?.CountryCode);
    adicionar(sec?.Name);
  }
  const dobrado = ` ${normalizarChave(textoVaga(vaga))} `;
  for (const [frase, iso] of FRASES) {
    if (dobrado.includes(` ${frase} `)) achados.push(iso);
  }
  return [...new Set(achados)];
}

function somenteEuaOuCanada(codigos) {
  return codigos.length > 0 && codigos.every((iso) => iso === "US" || iso === "CA");
}

export function manterOracleHcm(vaga, contexto = {}) {
  if (!vaga || typeof vaga !== "object") return false;
  const codigos = codigosPaisOracle(vaga);
  const doFiltro = codigoPaisOracle(contexto.location);
  if (doFiltro && PERMITIDOS.has(doFiltro)) codigos.push(doFiltro);
  if (codigos.some((iso) => PERMITIDOS.has(iso))) return true;
  if (REMOTO.test(textoVaga(vaga))) return !somenteEuaOuCanada(codigos);
  return false;
}

export function consultasOracle(locations) {
  if (!Array.isArray(locations) || locations.length === 0) return [{ location: "", workplace: "" }];
  return locations.map((local) => (
    /^remote$/i.test(local)
      ? { location: "", workplace: "ORA_REMOTE" }
      : { location: local, workplace: "" }
  ));
}

export function urlVagaOracle(host, siteNumber, id) {
  const hostOk = hostOraclePermitido(host);
  const site = typeof siteNumber === "string" ? siteNumber.trim() : "";
  const nativo = String(id ?? "").trim();
  if (!hostOk || !SITE.test(site) || !ID_VAGA.test(nativo)) return "";
  return `https://${hostOk}/hcmUI/CandidateExperience/en/sites/${site}/job/${nativo}`;
}

function localDaVaga(vaga) {
  const partes = [];
  if (typeof vaga?.PrimaryLocation === "string" && vaga.PrimaryLocation.trim()) partes.push(vaga.PrimaryLocation.trim());
  for (const sec of secundarios(vaga)) {
    if (typeof sec?.Name === "string" && sec.Name.trim()) partes.push(sec.Name.trim());
  }
  return [...new Set(partes)].join("; ");
}

export function normalizarOracleHcm(vaga) {
  if (!vaga || typeof vaga.Title !== "string" || !vaga.Title.trim()) return null;
  const site = typeof vaga.siteNumber === "string" ? vaga.siteNumber.trim() : "";
  const id = String(vaga.Id ?? "").trim();
  const url = urlVagaOracle(vaga.host, site, id);
  if (!url) return null;
  const title = vaga.Title.trim();
  const location = localDaVaga(vaga);
  const codigo = String(vaga.WorkplaceTypeCode ?? "").toUpperCase();
  const company = typeof vaga.company === "string" ? vaga.company.trim() : "";
  return {
    native_id: `${site}:${id}`,
    url,
    title,
    company,
    location,
    remote: codigo === "ORA_REMOTE" || REMOTO.test(`${title} ${location}`),
    posted_at: paraIso(vaga.PostedDate),
    description: limitar(vaga.ShortDescriptionStr),
    raw: {
      id,
      siteNumber: site,
      host: hostOraclePermitido(vaga.host),
      country: codigoPaisOracle(vaga.PrimaryLocationCountry) || null,
      workplaceTypeCode: codigo || null,
      secondaryCountries: [...new Set(secundarios(vaga).map((sec) => codigoPaisOracle(sec?.CountryCode)).filter(Boolean))],
    },
  };
}

function inteiro(valor, padrao, maximo) {
  const numero = Number(valor ?? padrao);
  if (!Number.isFinite(numero)) return padrao;
  return Math.min(Math.max(Math.trunc(numero), 1), maximo);
}

export function tenantsOracle(params = {}) {
  if (!Array.isArray(params?.tenants) || params.tenants.length === 0) {
    throw new Error("oracle-hcm: nenhum tenant na configuração");
  }
  const tenants = [];
  const errors = [];
  for (const item of params.tenants) {
    if (tenants.length >= MAX_TENANTS) {
      errors.push("oracle-hcm: teto de 12 tenants");
      break;
    }
    const company = typeof item?.company === "string" ? item.company.trim() : "";
    const siteNumber = typeof item?.siteNumber === "string" ? item.siteNumber.trim() : "";
    const rotulo = company || "tenant";
    if (!EMPRESA.test(company)) {
      errors.push("oracle-hcm: tenant sem empresa válida");
      continue;
    }
    if (!SITE.test(siteNumber)) {
      errors.push(`oracle-hcm: ${rotulo}: siteNumber inválido`);
      continue;
    }
    const host = hostOraclePermitido(item?.host);
    if (!host) {
      errors.push(`oracle-hcm: ${rotulo}: host fora da lista *.oraclecloud.com`);
      continue;
    }
    const locations = [];
    if (item.locations != null) {
      if (!Array.isArray(item.locations)) {
        errors.push(`oracle-hcm: ${rotulo}: locations inválido`);
        continue;
      }
      let localRuim = false;
      for (const local of item.locations) {
        const texto = typeof local === "string" ? local.trim() : "";
        if (!LOCAL.test(texto)) {
          errors.push(`oracle-hcm: ${rotulo}: localização rejeitada`);
          localRuim = true;
          break;
        }
        if (!locations.includes(texto) && locations.length < MAX_LOCAIS) locations.push(texto);
      }
      if (localRuim) continue;
    }
    tenants.push({ host, siteNumber, company, locations });
  }
  return { tenants, errors };
}

function urlLista(host, siteNumber, { limit, offset, location, workplace }) {
  const partes = [
    `findReqs;siteNumber=${siteNumber}`,
    `limit=${limit}`,
    `offset=${offset}`,
    "sortBy=POSTING_DATES_DESC",
  ];
  if (location) partes.push(`location="${location}"`);
  if (workplace) partes.push(`selectedWorkplaceTypesFacet=${workplace}`);
  const url = new URL(`https://${host}/hcmRestApi/resources/latest/recruitingCEJobRequisitions`);
  url.searchParams.set("onlyData", "true");
  url.searchParams.set("expand", "requisitionList.secondaryLocations,flexFieldsFacet.values");
  url.searchParams.set("finder", partes.join(","));
  return url.href;
}

function listaDe(json) {
  const item = json?.items?.[0];
  if (!item || !Array.isArray(item.requisitionList)) return null;
  const total = Number(item.TotalJobsCount);
  return { lista: item.requisitionList, total: Number.isFinite(total) ? total : Infinity };
}

export default {
  id: "oracle-hcm",
  profile: ["emprego"],
  hosts: HOSTS_ORACLE,
  async fetch(params, ctx) {
    const { tenants, errors } = tenantsOracle(params ?? {});
    const limit = inteiro(params?.limit, LIMITE_PADRAO, LIMITE_PADRAO);
    const maxPaginas = inteiro(params?.max_pages, MAX_PAGINAS, MAX_PAGINAS);
    const listings = [];
    const vistos = new Set();
    let jaPediu = false;
    const intervalo = async () => {
      if (!jaPediu) {
        jaPediu = true;
        return;
      }
      await pausa(ctx, PAUSA_MS);
    };
    for (const tenant of tenants) {
      let paginas = 0;
      for (const consulta of consultasOracle(tenant.locations)) {
        let offset = 0;
        let total = Infinity;
        let falhou = false;
        try {
          while (paginas < maxPaginas) {
            await intervalo();
            paginas += 1;
            const json = await buscarJson(urlLista(tenant.host, tenant.siteNumber, {
              limit,
              offset,
              location: consulta.location,
              workplace: consulta.workplace,
            }), [tenant.host], ctx);
            const pagina = listaDe(json);
            if (!pagina) throw new Error("resposta sem requisitionList");
            total = pagina.total;
            for (const vaga of pagina.lista) {
              if (!manterOracleHcm(vaga, { location: consulta.location })) continue;
              const id = String(vaga?.Id ?? "").trim();
              if (!ID_VAGA.test(id)) continue;
              const chave = `${tenant.siteNumber}:${id}`;
              if (vistos.has(chave)) continue;
              vistos.add(chave);
              listings.push({
                ...vaga,
                company: tenant.company,
                siteNumber: tenant.siteNumber,
                host: tenant.host,
              });
            }
            offset += pagina.lista.length;
            if (!pagina.lista.length || pagina.lista.length < limit || offset >= total) break;
          }
        } catch (erro) {
          falhou = true;
          errors.push(`oracle-hcm: ${tenant.company}: ${erro.message}`);
        }
        if (!falhou && offset < total) {
          const paginaRotulo = maxPaginas === 1 ? "página" : "páginas";
          errors.push(`oracle-hcm: ${tenant.company}: teto de ${maxPaginas} ${paginaRotulo}`);
          break;
        }
      }
    }
    return { listings, errors };
  },
  normalize: normalizarOracleHcm,
};
