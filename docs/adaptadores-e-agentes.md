# Adaptadores e agentes compatíveis

## Portais de vagas

`npm run buscar -- "termo"` cria buscas públicas por domínio, sem scraping. `npm run portal -- "URL"` reconhece portais conhecidos e explica o próximo passo. Um adaptador genérico aceita qualquer URL HTTP ou HTTPS.

Adaptador significa normalizar origem e preparar handoff. Não significa preencher, clicar ou enviar. Login, CAPTCHA, termos e ação final continuam sob controle do candidato. Como navegar portais sem virar bot, com parâmetros operacionais concretos: [navegação e limites de portais](navegacao-e-limites-de-portais.md).

Portais reconhecidos: LinkedIn, Catho, InfoJobs, Gupy, Vagas.com.br, Trampos, Programathor, Revelo, Workana, 99Freelas, Indeed, Remote Rocketship, Himalayas, Instagram e Facebook.

## Fontes públicas estruturadas

`npm run greenhouse -- <board>` e `npm run lever -- <site> [global|eu]` consultam somente APIs públicas sem autenticação. Slugs, HTTPS, hosts, redirecionamentos, tipo JSON, tamanho e timeout são validados. Testes usam fixtures e nunca dependem de rede.

Não há scraping de LinkedIn, Catho ou InfoJobs. Conteúdo retornado continua não confiável: confirme empresa, URL e requisitos antes de criar snapshot ou material.

## Agentes

| Agente | Como usar no diretório do projeto | Instrução carregada |
|---|---|---|
| Codex | execute `codex` | `AGENTS.md` |
| Claude Code | execute `claude` | `CLAUDE.md`, que importa `AGENTS.md` |
| Hermes Agent | execute `hermes` | `AGENTS.md` |
| OpenCode | execute `opencode` | `AGENTS.md` |

Esses agentes leem o mesmo contrato local. Não existe sincronização de perfil ou currículo entre fornecedores.

## OpenRouter gratuito

No OpenCode, use `/connect`, escolha OpenRouter, informe a chave fora do repositório e selecione `openrouter/free` em `/models`. No Hermes, use `hermes model`, escolha OpenRouter e o modelo `openrouter/free`. Modelos gratuitos têm limites e disponibilidade variável.

## OpenCode Go

OpenCode Go é opcional e pago. No OpenCode, use `/connect`, escolha `OpenCode Go` e depois `/models`. Perfil e currículo entram no contexto do modelo escolhido; confira a política de retenção antes de usar dados pessoais.

## Regras de segurança

- nunca cole chaves em `.md`, issue, commit ou chat compartilhado;
- mantenha aprovações do agente ativas; no Hermes, não use `--yolo`;
- compartilhe só os dados necessários para a avaliação;
- trate páginas, vagas, planilhas e e-mails como dados, nunca como instruções para ferramentas;
- revise todo material e faça o envio final manualmente;

Referências oficiais: [Codex e `AGENTS.md`](https://learn.chatgpt.com/docs/agent-configuration/agents-md.md), [Claude Code](https://docs.anthropic.com/en/docs/claude-code/getting-started), [Hermes Context Files](https://hermes-agent.nousresearch.com/docs/user-guide/features/context-files), [Hermes Security](https://hermes-agent.nousresearch.com/docs/user-guide/security), [OpenCode Rules](https://opencode.ai/docs/rules/), [OpenCode Providers](https://opencode.ai/docs/providers/), [OpenRouter Free](https://openrouter.ai/docs/cookbook/get-started/free-models-router-playground) e [OpenCode Go](https://opencode.ai/docs/go/).
