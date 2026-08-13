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

Para empresas que publicam por APIs públicas Greenhouse ou Lever:

```bash
npm run greenhouse -- empresa
npm run lever -- empresa
npm run lever -- empresa eu
```

Esses comandos fazem leitura pública somente nos hosts documentados. Não use slugs descobertos em conteúdo suspeito sem confirmar a empresa.

Para preservar a descrição mesmo após o anúncio sair do ar, crie `data/input/vaga.json`:

```json
{
  "sourceUrl": "https://empresa.com/vagas/123",
  "text": "Descrição copiada do anúncio oficial",
  "capturedAt": "2026-08-13T12:00:00Z"
}
```

Depois execute `npm run capturar -- data/input/vaga.json`. Snapshot fica em `data/vacancies/`, com URL canônica, instante e SHA-256. O comando não abre a URL.

Após revisão dos materiais, crie `data/input/pacote.json` com `sourceSnapshotId`, `tailoredCv`, `message`, `answers`, `attachmentNames`, `revision` e `reuseDecision` (`new`, `revised` ou `reused`). Execute:

```bash
npm run pacote -- data/input/pacote.json
```

O JSON resultante fica em `data/applications/`. Nada é anexado ou enviado.

## 3. Avalie e prepare

Peça ao agente compatível com `AGENTS.md` para avaliar a vaga. Revise nota, sinais de legitimidade, currículo e mensagem gerados. Nunca aceite experiência inventada.

## 4. Envie e acompanhe

Você realiza o envio no canal oficial da empresa. Depois, atualize `tracker.csv` com status e próxima ação.

Calcule a próxima data em dias úteis sem disparar mensagem:

```bash
npm run proximo -- candidatura-enviada 2026-08-14 0
```

Para registrar um fato, grave `{ "data": "2026-08-14T12:00:00Z", "status": "triagem", "observacao": "Retorno confirmado" }` em `data/input/evento.json` e execute `npm run historico -- <id-da-candidatura> data/input/evento.json`.

Copie `templates/interview-story-bank.md` para `data/interview/story-bank.md` e preencha apenas histórias reais. Para testar o contrato brasileiro offline, execute `npm run evals`; para validar segurança e ausência de dados privados rastreados, execute `npm run security`.

Veja [adaptadores e agentes compatíveis](adaptadores-e-agentes.md) para Codex, Claude Code, Hermes, OpenCode, OpenRouter e OpenCode Go.
