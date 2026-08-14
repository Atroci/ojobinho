# Descoberta contínua de vagas no Brasil

Este fluxo procura vagas públicas, organiza evidência e entrega uma fila local para revisão. Não cria conta, não reutiliza sessão autenticada, não envia currículo e não se candidata.

## O que roda hoje

`npm run descobrir` lê `config/fontes.json`, consulta cada fonte de forma independente e grava `data/descobertas.json`.

Fontes implementadas:

- Gupy: HTML público do tenant e `__NEXT_DATA__`, sem login;
- Greenhouse: API pública do board;
- Lever: API pública global ou europeia.

O arquivo inicial inclui seis tenants Gupy verificados: Conexa Saúde, Grupo Boticário, Memed, Asaas, PagBank e Riachuelo. Edite sua cópia local de `config/fontes.json` para trocar ou acrescentar empresas:

```json
{
  "fontes": [
    { "provider": "gupy", "id": "empresa", "company": "Empresa" },
    { "provider": "greenhouse", "id": "board", "company": "Empresa" },
    { "provider": "lever", "id": "site", "company": "Empresa", "instance": "global" }
  ]
}
```

Use `npm run descobrir -- --dry-run` para testar acesso sem gravar estado.

## Ciclo de seis horas

Cada ciclo executa a mesma sequência:

1. Carrega lista de fontes aprovada pelo operador.
2. Consulta somente hosts HTTPS derivados de identificadores validados.
3. Limita duração e tamanho de cada resposta; redirecionamento é recusado.
4. Normaliza vaga para um contrato comum.
5. Deduplica por provedor, tenant e ID da vaga.
6. Atualiza `firstSeen`, `lastSeen` e `lastCheckedAt`.
7. Marca como `indisponivel` uma vaga que sumiu de uma fonte consultada com sucesso.
8. Mantém último estado conhecido se a fonte falhou; erro aparece no resumo.
9. Grava estado por troca atômica de arquivo.

Se todas as fontes falharem, o comando termina com erro para o systemd registrar a falha. Uma falha parcial preserva resultados úteis e continua visível no resumo.

Não use `seen_urls` como bloqueio permanente. URL já vista precisa continuar sendo rechecada; caso contrário, vaga encerrada fica ativa para sempre.

Exemplo de unidade VPS:

```ini
# /etc/systemd/system/ojobinho-discovery.service
[Unit]
Description=oJobinho - descoberta pública de vagas
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
User=ojobinho
Group=ojobinho
WorkingDirectory=/opt/ojobinho
ExecStart=/usr/bin/npm run descobrir
TimeoutStartSec=30min
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=true
ReadWritePaths=/opt/ojobinho/data
```

```ini
# /etc/systemd/system/ojobinho-discovery.timer
[Unit]
Description=Atualizar vagas do oJobinho a cada 6 horas

[Timer]
OnBootSec=15min
OnUnitActiveSec=6h
RandomizedDelaySec=10min
Persistent=true

[Install]
WantedBy=timers.target
```

Depois de instalar, rode `systemctl daemon-reload`, `systemctl enable --now ojobinho-discovery.timer` e confira `systemctl list-timers ojobinho-discovery.timer`.

## Contrato mínimo de uma vaga

Campos coletados hoje:

- `discoveryId`, `providerId`, `source`, `sourceKey` e `sourceUrl`;
- `company`, `title`, `location`, `description` e `url`;
- `contract` e `workplaceType` quando a fonte informa;
- `capturedAt`, `firstSeen`, `lastSeen`, `lastCheckedAt` e `status`.

Campos brasileiros que devem permanecer separados quando forem adicionados:

- contrato: CLT, PJ, estágio, temporário, cooperado ou freelancer;
- remuneração: moeda, mínimo, máximo, período, bruto/líquido, fixo/variável e benefícios;
- localização: cidade, UF, remoto/híbrido/presencial e fuso exigido;
- elegibilidade: residência no Brasil, CNPJ/MEI, conselho profissional e autorização de trabalho;
- evidência: URL da fonte e instante de recuperação para cada afirmação importante;
- fricção: login, conta obrigatória, candidatura no site da empresa ou agregador;
- legitimidade: domínio, identidade da empresa, coleta precoce de documento e pedido de pagamento.

Campo ausente continua ausente. “Remoto” não implica contratação internacional; “PJ” não implica que qualquer pessoa possa prestar serviço do exterior; anúncio de salário não diz se o valor é bruto ou líquido.

## Ordem de enriquecimento sem Outscraper

Enriqueça só depois de descobrir e deduplicar:

1. Payload estruturado da própria fonte: título, local, contrato e modalidade.
2. Página oficial da vaga: descrição completa, data e requisitos.
3. Página de carreiras da empresa: domínio e identidade da organização.
4. Fontes públicas oficiais: CNPJ e dados cadastrais somente quando necessários para validar empresa ou contrato.
5. Pesquisa de contato: apenas para vaga de alta compatibilidade e sempre como rascunho para revisão.

Cada etapa precisa registrar fonte e data. Interrompa a cascata quando a vaga já estiver encerrada, fora do perfil ou sem empresa verificável. Isso economiza consultas e reduz coleta desnecessária.

## Hierarquia de fontes BR

Prioridade operacional:

1. ATS e página oficial estruturada: Gupy, Greenhouse, Lever e APIs equivalentes.
2. Sitemap ou JSON-LD público: exemplo típico, página oficial com `JobPosting`.
3. Agregador público: útil para descoberta, mas a URL oficial deve substituir a cópia quando existir.
4. Busca pública: gera candidatos para revisão; não transforma snippet em fato confirmado.
5. Portal autenticado e rede social: handoff humano, sem coleta automatizada neste projeto.

Catho, InfoJobs, Trampos, Vagas.com.br, LinkedIn e Indeed já têm handoff de busca, mas ainda não entram no coletor contínuo público. Adicione uma fonte somente depois de validar termos, robots.txt, estabilidade do formato, limite de requisições e um teste offline do parser.

## Planilha e Hermes

`data/descobertas.json` é estado técnico local. Planilha é projeção de revisão, não fonte de verdade. Um sincronizador pode publicar somente campos não sensíveis, de forma idempotente, depois que credenciais forem provisionadas fora do repositório.

Hermes pode executar o comando no agendamento, resumir novas vagas e preparar avaliação. Não deve alterar fonte aprovada, classificar falha como vaga encerrada, publicar dados pessoais nem executar candidatura. Novas fontes sugeridas entram numa fila para aprovação humana; nunca são ativadas pelo modelo sozinho.

## Próximos incrementos medidos

Só avance quando os dados justificarem:

- parser JSON-LD para páginas oficiais com fixtures reais e host allowlist;
- Trampos via sitemap, se os termos e estabilidade continuarem adequados;
- pontuação determinística de aderência antes de qualquer uso de modelo;
- rechecagem escalonada: novas/fortes a cada 6h, antigas/baixas diariamente;
- projeção Google Sheets idempotente, sem chave no repositório;
- alerta apenas para novas vagas acima do limiar escolhido pelo candidato.

Autoaplicação, login automático, CAPTCHA bypass, compra de dados pessoais e scraping de portal bloqueado ficam fora do produto.
