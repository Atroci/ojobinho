import { coletaPermitida } from "../lib/careerops/config.mjs";

export const IDS_ADAPTADORES = [
  "remoteok", "remotive", "himalayas", "jobicy", "workingnomads", "weworkremotely",
  "nodesk", "jobspresso", "getonbrd", "landingjobs", "arbeitnow", "manfred",
  "gupy", "greenhouse", "lever", "ashby", "hackernews", "startup-jobs", "remote-com",
  "net-empregos", "99freelas", "upwork", "workana", "fiverr", "contra",
  "freelanceradar", "peopleperhour", "wellfound", "computrabajo",
  "linkedin-email", "freelancer", "ats-dataset", "jobgether", "wordpress-jobs", "fourdayweek",
  "oracle-hcm",
  "careerops-bridge", "manual",
];

function quebrado(id, erro) {
  return {
    id,
    hosts: [],
    async fetch() {
      throw new Error(`adapter ${id} não carregou: ${erro.message}`);
    },
    normalize() {
      return null;
    },
  };
}

export async function carregarAdaptadores() {
  const mapa = new Map();
  for (const id of IDS_ADAPTADORES) {
    try {
      const mod = await import(`./sources/${id}.mjs`);
      if (!mod.default?.id) throw new Error("export default sem id");
      mapa.set(mod.default.id, mod.default);
    } catch (erro) {
      mapa.set(id, quebrado(id, erro));
    }
  }
  return mapa;
}

export async function executarFonte(fonte, adapter, capacidade, ctx) {
  const inicio = Date.now();
  if (!coletaPermitida(capacidade)) {
    return {
      ok: true,
      skipped: "policy",
      rows: 0,
      listings: [],
      errors: [],
      complete: false,
      ms: Date.now() - inicio,
      error: null,
    };
  }
  const timeoutMs = ctx.timeoutMs ?? 90_000;
  let estouro;
  try {
    const resultado = await Promise.race([
      adapter.fetch(fonte.params ?? {}, { ...ctx, source: fonte }),
      new Promise((_, rejeitar) => {
        estouro = setTimeout(() => rejeitar(new Error(`timeout após ${timeoutMs} ms`)), timeoutMs);
      }),
    ]);
    clearTimeout(estouro);
    if (resultado?.skipped) {
      return {
        ok: true,
        skipped: String(resultado.skipped),
        rows: 0,
        listings: [],
        errors: [...(resultado.errors ?? [])],
        complete: false,
        ms: Date.now() - inicio,
        error: null,
      };
    }
    const listings = [];
    const errors = [...(resultado?.errors ?? [])];
    for (const bruto of resultado?.listings ?? []) {
      try {
        const normal = adapter.normalize ? adapter.normalize(bruto) : bruto;
        if (normal) listings.push(normal);
      } catch (erro) {
        errors.push(erro.message);
      }
    }
    return {
      ok: true,
      skipped: null,
      rows: listings.length,
      listings,
      errors,
      complete: errors.length === 0,
      ms: Date.now() - inicio,
      error: null,
    };
  } catch (erro) {
    clearTimeout(estouro);
    return {
      ok: false,
      skipped: null,
      rows: 0,
      listings: [],
      errors: [erro.message],
      complete: false,
      ms: Date.now() - inicio,
      error: String(erro.message ?? erro).slice(0, 500),
    };
  }
}
