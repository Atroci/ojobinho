import { obterJson, obterTexto } from "../../providers/transport.mjs";

export const USER_AGENT = "ojobinho/careerops (+https://github.com/Atroci/ojobinho)";

function opcoes(hosts, ctx = {}) {
  return {
    hostsPermitidos: hosts,
    fetchImpl: ctx.fetchImpl,
    timeoutMs: ctx.timeoutMs ?? 20_000,
    maxBytes: ctx.maxBytes ?? 8_000_000,
    userAgent: ctx.userAgent ?? USER_AGENT,
  };
}

export function buscarJson(url, hosts, ctx) {
  return obterJson(url, opcoes(hosts, ctx));
}

export function buscarTexto(url, hosts, ctx) {
  return obterTexto(url, opcoes(hosts, ctx));
}

export async function pausa(ctx, ms) {
  if (typeof ctx?.sleep === "function") return ctx.sleep(ms);
  if (ctx?.fetchImpl && ctx.fetchImpl !== globalThis.fetch) return;
  await new Promise((resolver) => setTimeout(resolver, ms));
}
