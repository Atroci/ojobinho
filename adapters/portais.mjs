const ORIENTACOES = {
  portal: "Abra o anúncio oficial, autentique-se se necessário, revise campos e anexos e envie manualmente.",
  social: "Confirme empresa e contato, siga apenas o canal indicado no anúncio e nunca envie dinheiro ou documentos precocemente.",
  agregador: "Prefira o anúncio no site da empresa; se não existir, valide a empresa antes de seguir o fluxo do agregador.",
};

export const PORTAIS = [
  ["linkedin", "LinkedIn Jobs", ["linkedin.com"], "portal"],
  ["catho", "Catho", ["catho.com.br"], "portal"],
  ["infojobs", "InfoJobs", ["infojobs.com.br"], "portal"],
  ["gupy", "Gupy", ["gupy.io"], "portal"],
  ["vagas", "Vagas.com.br", ["vagas.com.br"], "portal"],
  ["trampos", "Trampos", ["trampos.co"], "portal"],
  ["programathor", "Programathor", ["programathor.com.br"], "portal"],
  ["revelo", "Revelo", ["revelo.com.br"], "portal"],
  ["workana", "Workana", ["workana.com"], "portal"],
  ["99freelas", "99Freelas", ["99freelas.com.br"], "portal"],
  ["indeed", "Indeed", ["indeed.com", "indeed.com.br"], "agregador"],
  ["remote-rocketship", "Remote Rocketship", ["remoterocketship.com"], "agregador"],
  ["himalayas", "Himalayas", ["himalayas.app"], "agregador"],
  ["instagram", "Instagram", ["instagram.com"], "social"],
  ["facebook", "Facebook", ["facebook.com"], "social"],
].map(([id, nome, dominios, tipo]) => ({ id, nome, dominios, tipo }));

export function validarUrlWeb(valor, mensagem = "Informe uma URL válida.") {
  let url;
  try {
    url = new URL(valor);
  } catch {
    throw new Error(mensagem);
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("A URL precisa usar http ou https.");
  }
  return url;
}

function corresponde(host, dominio) {
  return host === dominio || host.endsWith(`.${dominio}`);
}

export function identificarPortal(valor) {
  const url = validarUrlWeb(valor, "Informe uma URL válida do anúncio.");
  const portal = PORTAIS.find((item) => item.dominios.some((dominio) => corresponde(url.hostname, dominio)));

  if (!portal) {
    return {
      id: "generico",
      nome: url.hostname,
      url: url.href,
      conhecido: false,
      orientacao: ORIENTACOES.portal,
    };
  }

  return { ...portal, url: url.href, conhecido: true, orientacao: ORIENTACOES[portal.tipo] };
}

export function criarBuscas(termo) {
  const consulta = termo.trim();
  if (!consulta) throw new Error("Informe cargo, competência ou localização para buscar.");
  if (consulta.length > 200) throw new Error("A busca deve ter até 200 caracteres.");

  return PORTAIS.map((portal) => {
    const url = new URL("https://www.google.com/search");
    url.searchParams.set("q", `site:${portal.dominios[0]} ${consulta}`);
    return { id: portal.id, nome: portal.nome, url: url.href };
  });
}
