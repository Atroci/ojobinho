# Motor determinístico de candidaturas

Código vendorizado de `job-application-agent@3.1.1` (npm, MIT, ver `LICENSE-MIT`) e adaptado ao oJobinho. Zero dependências, Node 20 ou superior. Ele não busca vaga, não abre navegador, não envia nada: recebe fatos já extraídos pelo agente e devolve decisões determinísticas e estado local.

Use pelo CLI do oJobinho:

```bash
npm run motor -- profile check
npm run motor -- score --stdin < data/input/avaliacao.json
```

O estado privado fica em `data/motor/` (ignorado pelo Git; ver `DATA_CONTRACT.md`). A variável `JOB_APPLICATION_AGENT_STATE_DIR` muda o diretório, por exemplo num VPS.

## O que ele faz

| Área | Comandos | O que garante |
|---|---|---|
| `profile` | `set --stdin`, `migrate --stdin`, `check`, `field <campo>` | Perfil estruturado do candidato (JSON), validado, em arquivo 0600 |
| `resume` | `import <pdf>`, `path` | Um currículo canônico; o agente só anexa esse arquivo |
| `score` | `--stdin` | Portões duros antes da nota: elegibilidade, anúncio ativo, modalidade, senioridade, evidência de requisitos, piso salarial. Depois pontuação 0-100 |
| `ledger` | `check --stdin`, `add --stdin`, `outcome --stdin`, `review`, `review-ack --stdin` | Duplicatas por ID da vaga, URL normalizada e empresa+cargo; `applications.ndjson` e `outcomes.ndjson` só crescem |
| `round` | `start --stdin`, `complete --stdin`, `status [id]` | Lote retomável; só conta envio confirmado e registrado no ledger com o mesmo `roundId` |
| `attention` | `add --stdin`, `list`, `resolve --stdin` | Fila do que precisa de pessoa (login, MFA, CAPTCHA, termo legal, salário, julgamento) sem parar o lote |
| `friction` | `record --stdin`, `list` | Falhas gerais reproduzíveis, sem dado do candidato |
| `autonomy` | `status`, `preview`, `revoke` | Sempre desligado aqui; `grant` recusa |

Esquemas de entrada: `referencias/SCHEMAS.md`. Rodadas e filas: `referencias/RUNS.md`. Respostas narrativas: `referencias/APPLICATION_GUIDANCE.md`. Os três ficam em inglês como vieram da origem.

## Nota do motor e rubrica A-G

A rubrica de `modes/avaliar.md` continua sendo a avaliação que o agente escreve no relatório. A pontuação do motor é a checagem determinística por baixo dela, e as duas escalas coincidem: **nota = pontuação / 20**.

| Motor | Rubrica | Decisão |
|---|---|---|
| 80-100 | 4,0-5,0 | recomendar candidatura |
| 70-79 | 3,5-3,9 | considerar após resolver dúvidas |
| abaixo de 70 | abaixo de 3,5 | não recomendar |

Um portão reprovado (`exclude`, `ask`, `skip`) vale mais do que qualquer nota. `autoEligible` é informativo: nada é enviado automaticamente.

## Alterações locais (procure `ponytail:` no código)

- Perfil em Linux: arquivo `profile.json` 0600 no diretório de estado. A origem só aceitava Keychain (macOS) e Credential Manager (Windows) e lançava erro em Linux.
- Telemetria: `telemetry-client.mjs` é um cliente nulo. A origem enviava analytics anônimos por padrão para um worker de terceiros; aqui nada sai da máquina e o comando `telemetry` não existe.
- Envio: `submissionMode` aceita só `review-each`; `autonomy grant` recusa; `approval` de um registro no ledger aceita só `APPROVE SUBMIT`. O candidato revisa e executa o envio, como em `AGENTS.md`.
- Vocabulário: famílias de cargo além de engenharia (`paid-media`, `performance-marketing`, `growth-marketing`, `marketing`, `design`, `sales`, `customer-success`, `product-management`, `project-management`, `operations`, `finance`, `people`); canais e origens `indeed`, `gupy`, `catho`, `infojobs`, `trampos`, `vagas-com-br`, `jobgether`, `discovery-worker`.

Tudo o mais (fórmula da nota, portões, chaves de duplicata, formato dos ledgers) é idêntico à origem. Testes em `test/motor/`.
