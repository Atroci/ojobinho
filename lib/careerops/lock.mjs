import { mkdir, open, readFile, rm, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const MAX_IDADE_MS = 2 * 60 * 60 * 1000;

export function caminhoTrava(base) {
  return resolve(base, "data/careerops.lock");
}

function processoVivo(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (erro) {
    return erro.code === "EPERM";
  }
}

export async function adquirirTrava(base, agora = new Date()) {
  const caminho = caminhoTrava(base);
  await mkdir(dirname(caminho), { recursive: true });
  const payload = JSON.stringify({ pid: process.pid, started_at: agora.toISOString() });
  try {
    const arquivo = await open(caminho, "wx");
    await arquivo.writeFile(payload);
    await arquivo.close();
  } catch (erro) {
    if (erro.code !== "EEXIST") throw erro;
    const atual = await lerTrava(caminho);
    const idade = atual?.started_at ? agora.getTime() - Date.parse(atual.started_at) : MAX_IDADE_MS + 1;
    const velha = !Number.isFinite(idade) || idade > MAX_IDADE_MS;
    if (atual && processoVivo(atual.pid) && !velha) {
      const ocupada = new Error(`outra execução está em andamento (pid ${atual.pid})`);
      ocupada.exitCode = 3;
      throw ocupada;
    }
    await rm(caminho, { force: true });
    const arquivo = await open(caminho, "wx");
    await arquivo.writeFile(payload);
    await arquivo.close();
  }
  return async () => {
    await rm(caminho, { force: true });
  };
}

async function lerTrava(caminho) {
  try {
    const item = await stat(caminho);
    if (!item.isFile()) return null;
    return JSON.parse(await readFile(caminho, "utf8"));
  } catch {
    return null;
  }
}
