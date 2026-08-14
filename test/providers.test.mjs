import assert from "node:assert/strict";
import test from "node:test";

import { buscarVagasGreenhouse } from "../providers/greenhouse.mjs";
import { buscarVagasGupy } from "../providers/gupy.mjs";
import { buscarVagasLever } from "../providers/lever.mjs";
import { obterHtml, obterJson } from "../providers/transport.mjs";

const CAPTURED_AT = "2026-08-13T12:00:00.000Z";
const greenhouseFixture = {
  jobs: [
    {
      id: 123,
      title: "Product Designer",
      content: "<p>Design de produto</p>",
      location: { name: "Remoto - Brasil" },
      absolute_url: "https://job-boards.greenhouse.io/acme/jobs/123",
    },
  ],
};
const leverFixture = [
  {
    id: "abc-123",
    text: "Senior Designer",
    descriptionPlain: "Design de produto",
    categories: { location: "Brazil (Remote)" },
    hostedUrl: "https://jobs.lever.co/acme/abc-123",
  },
];
const gupyFixture = {
  props: {
    pageProps: {
      jobs: [
        {
          id: 456,
          title: "Analista de Mídia Paga",
          department: "Marketing",
          type: "vacancy_type_effective",
          workplace: { workplaceType: "remote", address: { country: "Brasil", stateShortName: "SP", city: "São Paulo" } },
        },
      ],
    },
  },
};

function fetchFixture(payload, { status = 200, contentType = "application/json", inspect } = {}) {
  return async (url, init) => {
    inspect?.(url, init);
    return new Response(JSON.stringify(payload), { status, headers: { "content-type": contentType } });
  };
}

function fetchHtml(payload, options = {}) {
  const html = `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(payload)}</script></html>`;
  return async (url, init) => {
    options.inspect?.(url, init);
    return new Response(html, { status: options.status ?? 200, headers: { "content-type": options.contentType ?? "text/html; charset=utf-8" } });
  };
}

test("Greenhouse usa endpoint fixo e normaliza fixture", async () => {
  const vagas = await buscarVagasGreenhouse("acme", {
    fetchImpl: fetchFixture(greenhouseFixture, {
      inspect(url, init) {
        assert.equal(url, "https://boards-api.greenhouse.io/v1/boards/acme/jobs?content=true");
        assert.equal(init.redirect, "error");
        assert.equal(init.headers.accept, "application/json");
      },
    }),
    now: () => new Date(CAPTURED_AT),
  });

  assert.deepEqual(vagas, [
    {
      id: "greenhouse:123",
      providerId: "123",
      source: "greenhouse",
      sourceUrl: "https://boards-api.greenhouse.io/v1/boards/acme/jobs?content=true",
      capturedAt: CAPTURED_AT,
      title: "Product Designer",
      location: "Remoto - Brasil",
      description: "<p>Design de produto</p>",
      url: "https://job-boards.greenhouse.io/acme/jobs/123",
    },
  ]);
});

test("Lever usa endpoint fixo e normaliza fixture", async () => {
  const vagas = await buscarVagasLever("acme", {
    fetchImpl: fetchFixture(leverFixture),
    now: () => new Date(CAPTURED_AT),
  });

  assert.deepEqual(vagas, [
    {
      id: "lever:abc-123",
      providerId: "abc-123",
      source: "lever",
      sourceUrl: "https://api.lever.co/v0/postings/acme?mode=json",
      capturedAt: CAPTURED_AT,
      title: "Senior Designer",
      location: "Brazil (Remote)",
      description: "Design de produto",
      url: "https://jobs.lever.co/acme/abc-123",
    },
  ]);
});

test("Lever EU usa somente hosts fixos da instância", async () => {
  const fixture = [{ ...leverFixture[0], hostedUrl: "https://jobs.eu.lever.co/acme/abc-123" }];
  const vagas = await buscarVagasLever("acme", {
    instance: "eu",
    fetchImpl: fetchFixture(fixture, {
      inspect(url) {
        assert.equal(url, "https://api.eu.lever.co/v0/postings/acme?mode=json");
      },
    }),
    now: () => new Date(CAPTURED_AT),
  });

  assert.equal(vagas[0].url, "https://jobs.eu.lever.co/acme/abc-123");
  await assert.rejects(() => buscarVagasLever("acme", { instance: "outro" }), /Instância Lever inválida/);
});

test("Gupy usa somente o tenant informado e normaliza __NEXT_DATA__ público", async () => {
  const vagas = await buscarVagasGupy("acme", {
    fetchImpl: fetchHtml(gupyFixture, {
      inspect(url, init) {
        assert.equal(url, "https://acme.gupy.io/");
        assert.equal(init.redirect, "error");
        assert.equal(init.headers.accept, "text/html");
      },
    }),
    now: () => new Date(CAPTURED_AT),
  });

  assert.deepEqual(vagas, [
    {
      id: "gupy:456",
      providerId: "456",
      source: "gupy",
      sourceUrl: "https://acme.gupy.io/",
      capturedAt: CAPTURED_AT,
      title: "Analista de Mídia Paga",
      location: "São Paulo / SP / Brasil",
      description: "Marketing",
      contract: "vacancy_type_effective",
      workplaceType: "remote",
      url: "https://acme.gupy.io/jobs/456",
    },
  ]);
});

test("slugs e URLs fora das listas fixas são rejeitados antes da rede", async () => {
  const nunca = () => assert.fail("fetch não deveria ser chamado");

  await assert.rejects(() => buscarVagasGreenhouse("acme.com", { fetchImpl: nunca }), /Board Greenhouse inválido/);
  await assert.rejects(() => buscarVagasLever("../acme", { fetchImpl: nunca }), /Site Lever inválido/);
  await assert.rejects(() => buscarVagasGupy("acme.com", { fetchImpl: nunca }), /Tenant Gupy inválido/);
  await assert.rejects(() => buscarVagasGupy("acme_test", { fetchImpl: nunca }), /Tenant Gupy inválido/);
  await assert.rejects(
    () => obterJson("http://api.lever.co/v0/postings/acme", { hostsPermitidos: ["api.lever.co"], fetchImpl: nunca }),
    /fora da lista HTTPS/,
  );
  await assert.rejects(
    () => obterJson("https://example.com/jobs", { hostsPermitidos: ["api.lever.co"], fetchImpl: nunca }),
    /fora da lista HTTPS/,
  );
});

test("transporte recusa redirecionamento, tipo incorreto, excesso e timeout", async () => {
  const options = { hostsPermitidos: ["api.lever.co"] };

  await assert.rejects(
    () => obterJson("https://api.lever.co/jobs", { ...options, fetchImpl: async () => new Response(null, { status: 302 }) }),
    /Redirecionamento não permitido/,
  );
  await assert.rejects(
    () => obterJson("https://api.lever.co/jobs", { ...options, fetchImpl: fetchFixture({}, { contentType: "text/html" }) }),
    /não respondeu com JSON/,
  );
  await assert.rejects(
    () => obterHtml("https://api.lever.co/jobs", { ...options, fetchImpl: fetchFixture({}, { contentType: "application/json" }) }),
    /não respondeu com HTML/,
  );
  await assert.rejects(
    () =>
      obterJson("https://api.lever.co/jobs", {
        ...options,
        fetchImpl: async () => new Response("{", { headers: { "content-type": "application/json" } }),
      }),
    /JSON inválido/,
  );
  await assert.rejects(
    () => obterJson("https://api.lever.co/jobs", { ...options, fetchImpl: fetchFixture({ longo: "123456" }), maxBytes: 5 }),
    /excede o limite/,
  );
  await assert.rejects(
    () =>
      obterJson("https://api.lever.co/jobs", {
        ...options,
        timeoutMs: 5,
        fetchImpl: (_url, { signal }) =>
          new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true })),
      }),
    /excedeu timeout/,
  );
});

test("payloads malformados e URLs de vaga inesperadas são rejeitados", async () => {
  await assert.rejects(
    () => buscarVagasGreenhouse("acme", { fetchImpl: fetchFixture({ jobs: [{ ...greenhouseFixture.jobs[0], id: "123" }] }) }),
    /Payload Greenhouse malformado/,
  );
  await assert.rejects(
    () =>
      buscarVagasLever("acme", {
        fetchImpl: fetchFixture([{ ...leverFixture[0], hostedUrl: "https://example.com/acme/abc-123" }]),
      }),
    /fora da lista HTTPS/,
  );
  await assert.rejects(() => buscarVagasGupy("acme", { fetchImpl: fetchHtml({ props: {} }) }), /Payload Gupy malformado/);
});
