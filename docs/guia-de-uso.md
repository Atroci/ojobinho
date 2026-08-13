# Guia de uso

## 1. Prepare o projeto

```bash
git clone https://github.com/Atroci/ojobinho.git
cd ojobinho
npm run init
npm run doctor
```

Preencha `config/perfil.md` e `curriculo.md`. Esses arquivos ficam fora do Git.

## 2. Escolha uma vaga

Abra a [lista pública de oportunidades](https://docs.google.com/spreadsheets/d/1lMBYP_qev6Q1bKcxW_cngyjuoKEqPz4PGyp0V2Vfu4M/edit?gid=2034983413#gid=2034983413) ou use outra fonte confiável. Registre o link:

```bash
npm run vaga -- "https://empresa.com/vaga/123"
```

Para pesquisar vários portais sem scraping e reconhecer o fluxo de um anúncio:

```bash
npm run buscar -- "designer remoto Brasil"
npm run portal -- "https://empresa.com/vaga/123"
```

## 3. Avalie e prepare

Peça ao agente compatível com `AGENTS.md` para avaliar a vaga. Revise nota, sinais de legitimidade, currículo e mensagem gerados. Nunca aceite experiência inventada.

## 4. Envie e acompanhe

Você realiza o envio no canal oficial da empresa. Depois, atualize `tracker.csv` com status e próxima ação.

Veja [adaptadores e agentes compatíveis](adaptadores-e-agentes.md) para Codex, Claude Code, Hermes, OpenCode, OpenRouter e OpenCode Go.
