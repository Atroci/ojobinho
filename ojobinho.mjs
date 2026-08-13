#!/usr/bin/env node

import { appendFile, copyFile, mkdir, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { criarBuscas, identificarPortal, validarUrlWeb } from "./adapters/portais.mjs";

export const LISTA_VAGAS = "https://docs.google.com/spreadsheets/d/1lMBYP_qev6Q1bKcxW_cngyjuoKEqPz4PGyp0V2Vfu4M/edit?gid=2034983413#gid=2034983413";

const ARQUIVOS_INICIAIS = [
  ["config/perfil.example.md", "config/perfil.md"],
  ["curriculo.example.md", "curriculo.md"],
  ["tracker.example.csv", "tracker.csv"],
  ["data/pipeline.example.md", "data/pipeline.md"],
];

async function existe(caminho) {
  try {
    await stat(caminho);
    return true;
  } catch (erro) {
    if (erro.code === "ENOENT") return false;
    throw erro;
  }
}

export async function iniciar(base = process.cwd()) {
  const criados = [];

  for (const [origem, destino] of ARQUIVOS_INICIAIS) {
    const caminhoDestino = resolve(base, destino);
    if (await existe(caminhoDestino)) continue;
    await mkdir(dirname(caminhoDestino), { recursive: true });
    await copyFile(resolve(base, origem), caminhoDestino);
    criados.push(destino);
  }

  return criados;
}

export async function diagnosticar(base = process.cwd()) {
  const faltando = [];
  for (const [, destino] of ARQUIVOS_INICIAIS) {
    if (!(await existe(resolve(base, destino)))) faltando.push(destino);
  }
  return faltando;
}

export async function registrarVaga(valor, base = process.cwd(), agora = new Date()) {
  const url = validarUrlWeb(valor, "Informe uma URL válida da vaga.");

  const pipeline = resolve(base, "data/pipeline.md");
  await mkdir(dirname(pipeline), { recursive: true });
  if (!(await existe(pipeline))) {
    await copyFile(resolve(base, "data/pipeline.example.md"), pipeline);
  }
  await appendFile(pipeline, `\n- [ ] ${agora.toISOString().slice(0, 10)} | ${url.href}\n`, "utf8");
  return url.href;
}

export async function main(args = process.argv.slice(2), io = console, base = process.cwd()) {
  const [comando = "ajuda", ...valores] = args;
  const valor = valores.join(" ");

  if (comando === "iniciar") {
    const criados = await iniciar(base);
    io.log(criados.length ? `Criados: ${criados.join(", ")}` : "Configuração já existe. Nada sobrescrito.");
    return;
  }

  if (comando === "doctor") {
    const faltando = await diagnosticar(base);
    if (faltando.length) throw new Error(`Execute npm run init. Faltando: ${faltando.join(", ")}`);
    io.log("oJobinho pronto. Perfil, currículo, tracker e pipeline encontrados.");
    return;
  }

  if (comando === "vagas") {
    io.log(LISTA_VAGAS);
    return;
  }

  if (comando === "vaga") {
    if (!valor) throw new Error('Uso: npm run vaga -- "https://empresa.com/vaga"');
    io.log(`Vaga adicionada: ${await registrarVaga(valor, base)}`);
    return;
  }

  if (comando === "buscar") {
    for (const busca of criarBuscas(valor)) io.log(`${busca.nome}: ${busca.url}`);
    return;
  }

  if (comando === "portal") {
    const portal = identificarPortal(valor);
    io.log(`Portal: ${portal.nome}`);
    io.log(`URL: ${portal.url}`);
    io.log(`Próximo passo: ${portal.orientacao}`);
    io.log("Limite: oJobinho prepara; você revisa e envia.");
    return;
  }

  io.log("Comandos: iniciar | doctor | vagas | vaga <url> | buscar <termo> | portal <url>");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((erro) => {
    console.error(erro.message);
    process.exitCode = 1;
  });
}
