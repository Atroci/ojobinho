# CareerOps

Fila local de vagas. O SQLite `data/ojobinho.db` é a fonte de verdade da coleta. O scan não chama modelo, não faz login e não envia nada.

## Comando da rotina

No computador do operador não há cron. Uma rotina do Grok Bot dispara a varredura de 3 a 6 vezes por dia, com pelo menos 5 minutos entre uma e outra. O tick só executa o processo e lê o JSON.

```bash
node ojobinho.mjs scan --due --json
```

`scan --all --json` ignora o relógio e ainda respeita o teto diário de cada fonte. `scan --source <id> --json` roda uma fonte, mesmo desligada na lista, se a política de acesso permitir rede.

O processo termina sozinho. A saída é um único objeto:

- `new` e `changed`: totais da corrida
- `errors`: quantas fontes devolveram erro
- `sources[]`: `id`, `ok`, `rows`, `new`, `changed`, `error`, `skipped`

`skipped` pode ser `not-due`, `rate-limit` ou `policy`. Isso não é falha. Código 0 se alguma fonte correu ou se nenhuma estava no prazo. Código 2 se todas as tentativas falharam. Código 3 se outra execução segura a trava `data/careerops.lock`.

Sem `--json`, a última linha é `CAREEROPS_SUMMARY` mais o mesmo objeto.

## Agenda

`config/agenda.json` guarda o intervalo mínimo, em minutos, e o teto de corridas por dia no fuso `Europe/Lisbon`. O padrão é 240 minutos, ou seja, no máximo cerca de 6 vezes por dia. Remotive fica em 360 minutos e no máximo 4 corridas por dia. 99Freelas fica em 720 minutos, no máximo 2 corridas, e no máximo 3 páginas da listagem pública.

`node ojobinho.mjs tune --json` lê o rendimento gravado em cada corrida (tentativas, vagas novas, hora da última vaga nova, taxa de erro) e recomenda `faster`, `slower` ou `keep`. A sugestão nunca fica abaixo do piso da fonte nem acima de um dia. `tune --apply` só grava `data/agenda.local.json`, que o Git ignora, e só deve rodar depois de um sim.

`node ojobinho.mjs status --yield --json` mostra a mesma conta junto da saúde das fontes.

## Perfis e filtro

Emprego usa `modes/avaliar.md`. Freelance usa `modes/avaliar-freelance.md`. Os valores reais de preço e portfólio ficam em `config/perfis/*.md` e `config/regras.json`, ambos fora do Git. O repositório só traz `config/regras.example.json`.

Cada termo do filtro é uma palavra ou expressão inteira, com acento e com ponto (`next.js`, `google ads`). `ads` não entra em `leads`, e `web` não entra em `website`. A sigla solta `gtm` continua batendo no texto que diz só "GTM"; não use essa sigla se o que você quer é Google Tag Manager.

Chaves de `config/regras.json`, por perfil (`emprego` e `freelance`):

| Chave | Efeito |
|---|---|
| `include_any` | Se existir, pelo menos um termo precisa aparecer no texto todo (título, empresa, local, descrição e etiquetas). Configuração antiga continua valendo. Se `include_title_any` também existir, esta chave passa a exigir o termo só na descrição. |
| `include_title_any` | Se existir, é obrigatória: pelo menos um termo no título ou nas etiquetas. Menção só na descrição não passa. |
| `exclude` | Qualquer termo no texto todo elimina a vaga. |
| `exclude_title` | Qualquer termo no título elimina a vaga. |
| `sources_allow` | Se existir, só essas fontes entram no perfil. |
| `sources_deny` | Essas fontes ficam de fora. Vale mesmo com `sources_allow`. |
| `locations_allow` | Locais aceitos. Vazio no anúncio não reprova. Remoto passa. |
| `max_age_hours` | Idade máxima em marketplace. |
| `max_proposals` | Teto de propostas. |
| `pay_floor_hourly_usd` | Piso por hora em USD, quando a vaga publica os dois. |
| `pay_floor_fixed` e `pay_floor_currency` | Piso de projeto fechado. |

`evaluate --new` devolve no máximo 15 vagas. `--limit N` muda o teto.

O primeiro scan deixa um acervo antigo na fila. Para marcá-lo como visto, sem modelo:

```bash
node ojobinho.mjs evaluate --baseline --profile emprego --before 2026-11-24T00:00:00.000Z --json
node ojobinho.mjs scan --baseline --before 2026-11-24T00:00:00.000Z --json
```

Cada vaga com `first_seen_at` até essa data ganha avaliação `evaluator: baseline`, `verdict: skip`, motivo `baseline`. `evaluate --new` não a devolve, para nenhum bot. Vaga vista depois, ou cujo texto mude, volta para a fila. Sem `--before`, o corte é o acervo ativo inteiro.

Uma vaga é avaliada uma vez por perfil, avaliador e hash de conteúdo. Mudou o texto que entra na decisão, o hash muda e a vaga volta para `evaluate --new`.

## Sete dias de sombra

Antes de desligar qualquer rotina antiga, rode a varredura por sete dias sem enviar nada. Uma vez por dia:

```bash
node ojobinho.mjs shadow
```

Isso grava `data/shadow/report-YYYY-MM-DD.md` com vagas por fonte, clusters duplicados, falhas seguidas e avaliações já gravadas. O relatório deixa em branco, de propósito, a comparação com os diários dos bots: esses arquivos não estão neste repositório.

Meça, por fonte:

1. Cobertura: o que a rotina antiga viu e o banco não viu, e o inverso entre as que passaram no filtro.
2. Duplicatas: linhas no mesmo `cluster_id`.
3. Qualidade do filtro: parte das vagas que o bot shortlistou e que também passam nas regras (alvo 95% ou mais) e quantas passam por dia (alvo 30 ou menos).
4. Frescor: minutos entre `posted_at` e `first_seen_at` quando a fonte manda data.
5. Saúde: taxa de sucesso, falhas seguidas e duração.
6. Custo: avaliações pedidas ao modelo, que são as que passaram no filtro, contra o volume varrido.

Troque uma rotina antiga só se as faltas ficarem em 5% ou menos do que ela shortlistou, se nenhuma fonte ficar caída por mais de dois dias, e se houver um sim explícito.

## O que não é varrido

Upwork chega por `ingest --source upwork --file ...`, a partir do conector oficial. Workana e Freelanceradar chegam pelo mesmo comando, a partir de alerta de e-mail. Fiverr, Contra e PeoplePerHour são stubs. Wellfound e Computrabajo ficam desligados. A ponte opcional para um checkout do career-ops também fica desligada.
