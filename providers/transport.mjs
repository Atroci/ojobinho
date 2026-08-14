const JSON_CONTENT_TYPE = /^application\/(?:[a-z0-9!#$&^_.+-]+\+)?json$/i;

function validarInteiroPositivo(valor, nome) {
  if (!Number.isInteger(valor) || valor <= 0) throw new TypeError(`${nome} deve ser um inteiro positivo.`);
}

export function validarSlug(valor, nome) {
  const slug = typeof valor === "string" ? valor : "";
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9_-]{0,62}[A-Za-z0-9])?$/.test(slug)) {
    throw new TypeError(`${nome} inválido.`);
  }
  return slug;
}

export function validarUrlHttps(valor, hostsPermitidos, nome = "URL") {
  let url;
  try {
    url = new URL(valor);
  } catch {
    throw new TypeError(`${nome} inválida.`);
  }

  const hosts = new Set(hostsPermitidos);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    !hosts.has(url.hostname)
  ) {
    throw new TypeError(`${nome} fora da lista HTTPS permitida.`);
  }
  return url;
}

async function lerCorpoLimitado(response, maxBytes) {
  const tamanhoDeclarado = Number(response.headers.get("content-length"));
  if (Number.isFinite(tamanhoDeclarado) && tamanhoDeclarado > maxBytes) {
    throw new Error(`Resposta excede o limite de ${maxBytes} bytes.`);
  }
  if (!response.body) throw new Error("Resposta JSON sem corpo.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let tamanho = 0;
  let texto = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      tamanho += value.byteLength;
      if (tamanho > maxBytes) {
        await reader.cancel();
        throw new Error(`Resposta excede o limite de ${maxBytes} bytes.`);
      }
      texto += decoder.decode(value, { stream: true });
    }
    return texto + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

async function obterCorpo(
  valorUrl,
  {
    hostsPermitidos,
    fetchImpl = globalThis.fetch,
    timeoutMs = 10_000,
    maxBytes = 1_000_000,
    accept,
    tipoPermitido,
    mensagemTipo,
  } = {},
) {
  if (!Array.isArray(hostsPermitidos) || hostsPermitidos.length === 0) {
    throw new TypeError("hostsPermitidos deve conter ao menos um host.");
  }
  if (typeof fetchImpl !== "function") throw new TypeError("fetch indisponível.");
  validarInteiroPositivo(timeoutMs, "timeoutMs");
  validarInteiroPositivo(maxBytes, "maxBytes");

  const url = validarUrlHttps(valorUrl, hostsPermitidos, "URL da fonte");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url.href, {
      headers: { accept },
      redirect: "error",
      signal: controller.signal,
    });

    if (response.redirected || (response.status >= 300 && response.status < 400)) {
      throw new Error("Redirecionamento não permitido.");
    }
    if (!response.ok) throw new Error(`Fonte respondeu HTTP ${response.status}.`);

    const contentType = response.headers.get("content-type")?.split(";", 1)[0].trim();
    if (!contentType || !tipoPermitido.test(contentType)) {
      throw new Error(mensagemTipo);
    }

    return await lerCorpoLimitado(response, maxBytes);
  } catch (erro) {
    if (controller.signal.aborted) throw new Error(`Fonte excedeu timeout de ${timeoutMs} ms.`);
    throw erro;
  } finally {
    clearTimeout(timer);
  }
}

export async function obterJson(valorUrl, options = {}) {
  const texto = await obterCorpo(valorUrl, {
    ...options,
    accept: "application/json",
    tipoPermitido: JSON_CONTENT_TYPE,
    mensagemTipo: "Fonte não respondeu com JSON.",
  });
  try {
    return JSON.parse(texto);
  } catch {
    throw new Error("Fonte retornou JSON inválido.");
  }
}

export function obterHtml(valorUrl, options = {}) {
  return obterCorpo(valorUrl, {
    ...options,
    accept: "text/html",
    tipoPermitido: /^text\/html$/i,
    mensagemTipo: "Fonte não respondeu com HTML.",
  });
}
