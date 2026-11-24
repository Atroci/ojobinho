import { zstdDecompressSync, brotliDecompressSync, gunzipSync } from "node:zlib";

import { parquetMetadataAsync, parquetReadObjects } from "../../lib/vendor/hyparquet/src/index.js";
import { USER_AGENT, buscarJson, pausa } from "../../lib/careerops/http.mjs";
import { httpsAbsoluto, paraIso, tipoContrato } from "../../lib/careerops/text.mjs";
import { validarUrlHttps } from "../../providers/transport.mjs";

const MANIFESTO = "https://storage.stapply.ai/jobs/v1/manifest.json";
const HOST = "storage.stapply.ai";
export const ATS_PERMITIDOS = ["greenhouse", "lever", "ashby", "workable", "recruitee", "teamtailor", "smartrecruiters"];
const UE = new Set(["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE", "IS", "LI", "NO"]);
const HOSTS_FORA = ["linkedin.com", "indeed.com", "upwork.com", "workana.com", "freelanceradar.com"];
const COLUNAS = [
  "global_id", "url", "title", "company", "ats_type", "ats_id", "location", "country_iso", "region",
  "is_remote", "workplace_type", "employment_type", "posted_at", "is_stale",
  "salary_min", "salary_max", "salary_currency", "salary_period",
];

function descomprimir(fn) {
  return (entrada, tamanho) => {
    const saida = fn(entrada);
    const bytes = saida instanceof Uint8Array ? saida : new Uint8Array(saida);
    if (bytes.byteLength !== tamanho) {
      throw new Error(`ats-dataset: descompressão devolveu ${bytes.byteLength}, o parquet pedia ${tamanho}`);
    }
    return bytes;
  };
}

const COMPRESSORES = {
  ZSTD: descomprimir(zstdDecompressSync),
  GZIP: descomprimir(gunzipSync),
  BROTLI: descomprimir(brotliDecompressSync),
};

export function urlDataset(valor, ats) {
  let url;
  try {
    url = new URL(String(valor));
  } catch {
    return "";
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port || url.search || url.hash) return "";
  if (url.hostname !== HOST) return "";
  const partes = url.pathname.split("/");
  if (partes.length !== 5 || partes[1] !== "jobs" || partes[2] !== "v1" || partes[3] !== ats || partes[4] !== "jobs.parquet") return "";
  if (!ATS_PERMITIDOS.includes(ats)) return "";
  return url.href;
}

function texto(valor) {
  if (valor == null) return "";
  return String(valor).trim();
}

function remoto(linha) {
  if (linha?.is_remote === true || linha?.is_remote === 1 || linha?.is_remote === "true") return true;
  return /\b(remote|remoto)\b/i.test(`${texto(linha?.workplace_type)} ${texto(linha?.location)}`);
}

function portugal(linha) {
  if (texto(linha?.country_iso).toUpperCase() === "PT") return true;
  return /\b(portugal|lisboa|lisbon)\b/i.test(`${texto(linha?.location)} ${texto(linha?.region)}`);
}

function remotoEuOuMundo(linha) {
  if (!remoto(linha)) return false;
  const iso = texto(linha?.country_iso).toUpperCase();
  const lugar = `${texto(linha?.location)} ${texto(linha?.region)}`.toLowerCase();
  if (/\b(worldwide|anywhere|global|europe|european union|eu|eea|emea)\b/.test(lugar)) return true;
  if (UE.has(iso)) return true;
  if (!iso && (!lugar || /^(remote|remoto)$/.test(lugar))) return true;
  return false;
}

export function manterAts(linha) {
  const tipo = texto(linha?.ats_type).toLowerCase();
  if (!ATS_PERMITIDOS.includes(tipo)) return false;
  if (tipo.includes("google") || tipo.includes("jungle") || tipo.includes("wttj")) return false;
  if (linha?.is_stale === true || linha?.is_stale === "true") return false;
  if (portugal(linha)) return true;
  return remotoEuOuMundo(linha);
}

function hostProibido(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return HOSTS_FORA.some((item) => host === item || host.endsWith(`.${item}`));
  } catch {
    return true;
  }
}

function dataDe(valor) {
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor.toISOString();
  if (typeof valor === "bigint") {
    const numero = Number(valor);
    if (!Number.isFinite(numero)) return null;
    if (numero > 1e14) return paraIso(Math.round(numero / 1000));
    return paraIso(numero);
  }
  return paraIso(valor);
}

function dinheiro(valor) {
  if (valor == null || valor === "") return null;
  const numero = typeof valor === "bigint" ? Number(valor) : Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

function periodo(valor) {
  const textoPeriodo = texto(valor).toLowerCase();
  if (!textoPeriodo) return null;
  if (textoPeriodo.startsWith("hour")) return "hour";
  if (textoPeriodo.startsWith("year") || textoPeriodo.startsWith("annual")) return "year";
  if (textoPeriodo.startsWith("month")) return "month";
  if (textoPeriodo.startsWith("week")) return "week";
  return null;
}

export function normalizarAts(linha) {
  if (!manterAts(linha)) return null;
  const title = texto(linha.title);
  const url = httpsAbsoluto(linha.url);
  if (!title || !url || hostProibido(url)) return null;
  const tipo = texto(linha.ats_type).toLowerCase();
  const nativo = texto(linha.ats_id) || texto(linha.global_id);
  return {
    native_id: nativo || null,
    url,
    title,
    company: texto(linha.company),
    location: texto(linha.location) || texto(linha.region) || texto(linha.country_iso),
    remote: remoto(linha),
    employment_type: tipoContrato(linha.employment_type),
    pay_min: dinheiro(linha.salary_min),
    pay_max: dinheiro(linha.salary_max),
    pay_currency: texto(linha.salary_currency).toUpperCase() || null,
    pay_period: periodo(linha.salary_period),
    posted_at: dataDe(linha.posted_at),
    description: "",
    raw: { global_id: texto(linha.global_id), ats_type: tipo, ats_id: texto(linha.ats_id) },
  };
}

function criarLimite(maximo) {
  let ativos = 0;
  const espera = [];
  return {
    async entrar() {
      if (ativos < maximo) {
        ativos += 1;
        return;
      }
      await new Promise((resolver) => espera.push(resolver));
    },
    sair() {
      const proximo = espera.shift();
      if (proximo) proximo();
      else ativos -= 1;
    },
  };
}

async function fetchSeguro(url, ctx, headersExtras) {
  const alvo = validarUrlHttps(url, [HOST], "URL do dataset");
  const fetchImpl = ctx.fetchImpl ?? globalThis.fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ctx.timeoutMs ?? 20_000);
  try {
    const headers = { accept: "application/octet-stream", "user-agent": ctx.userAgent ?? USER_AGENT, ...headersExtras };
    const resposta = await fetchImpl(alvo.href, { headers, redirect: "error", signal: controller.signal });
    if (resposta.redirected || (resposta.status >= 300 && resposta.status < 400)) {
      await resposta.body?.cancel();
      throw new Error("Redirecionamento não permitido.");
    }
    const tipo = resposta.headers.get("content-type") || "";
    if (/text\/html/i.test(tipo)) {
      await resposta.body?.cancel();
      throw new Error("ats-dataset: resposta HTML");
    }
    return resposta;
  } catch (erro) {
    if (controller.signal.aborted) throw new Error("ats-dataset: timeout no dataset");
    throw erro;
  } finally {
    clearTimeout(timer);
  }
}

export async function bufferIntervalo(url, ctx, maxBytes) {
  const sonda = await fetchSeguro(url, ctx, { Range: "bytes=0-0" });
  const faixa = sonda.headers.get("content-range") || "";
  const total = Number(/\/(\d+)\s*$/.exec(faixa)?.[1]);
  await sonda.body?.cancel();
  if (!Number.isInteger(total) || total <= 0) throw new Error("ats-dataset: tamanho do parquet desconhecido");
  let lidos = 0;
  const fila = criarLimite(4);
  return {
    byteLength: total,
    async slice(inicio, fim = total) {
      if (fim <= inicio) return new ArrayBuffer(0);
      const pedido = fim - inicio;
      if (lidos + pedido > maxBytes) throw new Error(`ats-dataset: teto de ${maxBytes} bytes`);
      lidos += pedido;
      await fila.entrar();
      try {
        const resposta = await fetchSeguro(url, ctx, { Range: `bytes=${inicio}-${fim - 1}` });
        if (resposta.status !== 206) {
          await resposta.body?.cancel();
          throw new Error(`ats-dataset: intervalo HTTP ${resposta.status}`);
        }
        const buf = await resposta.arrayBuffer();
        if (buf.byteLength < pedido) throw new Error("ats-dataset: intervalo curto");
        return buf.byteLength === pedido ? buf : buf.slice(0, pedido);
      } finally {
        fila.sair();
      }
    },
  };
}

async function lerFatia(url, ctx, maxBytes, maxRows) {
  const file = await bufferIntervalo(url, ctx, maxBytes);
  const metadata = await parquetMetadataAsync(file);
  const saida = [];
  let cursor = 0;
  let truncado = false;
  for (const grupo of metadata.row_groups ?? []) {
    const n = Number(grupo.num_rows);
    if (!Number.isFinite(n) || n < 0) break;
    const linhas = await parquetReadObjects({
      file,
      metadata,
      columns: COLUNAS,
      rowStart: cursor,
      rowEnd: cursor + n,
      compressors: COMPRESSORES,
    });
    for (const linha of linhas) {
      if (!manterAts(linha)) continue;
      saida.push(linha);
      if (saida.length >= maxRows) {
        truncado = true;
        break;
      }
    }
    cursor += n;
    if (truncado) break;
  }
  return { linhas: saida, truncado };
}

export default {
  id: "ats-dataset",
  profile: ["emprego"],
  hosts: [HOST],
  async fetch(params, ctx) {
    const pedido = Array.isArray(params?.ats) && params.ats.length ? params.ats : ATS_PERMITIDOS;
    const ats = [];
    for (const item of pedido) {
      const nome = String(item ?? "").trim().toLowerCase();
      if (!ATS_PERMITIDOS.includes(nome) || ats.includes(nome)) continue;
      ats.push(nome);
    }
    if (!ats.length) throw new Error("ats-dataset: nenhum ATS permitido");
    const maxRows = Math.min(Math.max(Number(params?.max_rows ?? 2500) || 2500, 1), 5000);
    const maxBytes = Math.min(Math.max(Number(params?.max_bytes ?? 24_000_000) || 24_000_000, 1_000_000), 80_000_000);
    const manifestoUrl = typeof params?.manifest === "string" && params.manifest.startsWith("https://storage.stapply.ai/jobs/v1/")
      ? params.manifest
      : MANIFESTO;
    const manifesto = await buscarJson(manifestoUrl, [HOST], ctx);
    const porAts = manifesto?.by_ats;
    if (!porAts || typeof porAts !== "object") throw new Error("ats-dataset: manifesto sem by_ats");
    const listings = [];
    const errors = [];
    const vistos = new Set();
    for (const nome of ats) {
      if (listings.length || errors.length) await pausa(ctx, 300);
      const url = urlDataset(porAts[nome]?.parquet, nome);
      if (!url) {
        errors.push(`ats-dataset: parquet de ${nome} ausente ou fora do host`);
        continue;
      }
      try {
        const lido = await lerFatia(url, ctx, maxBytes, maxRows - listings.length);
        for (const linha of lido.linhas) {
          const chave = httpsAbsoluto(linha.url);
          if (!chave || vistos.has(chave)) continue;
          vistos.add(chave);
          listings.push(linha);
        }
        if (lido.truncado) errors.push(`ats-dataset: ${nome} truncado no teto de linhas`);
      } catch (erro) {
        errors.push(erro.message);
      }
      if (listings.length >= maxRows) break;
    }
    return { listings, errors };
  },
  normalize: normalizarAts,
};
