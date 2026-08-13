# Decisões

## [2026-08-13] Produto clean-room e brasileiro

- Nome público e interno: oJobinho.
- Node.js sem dependências para reduzir instalação e superfície de risco.
- Arquivos Markdown/CSV como fonte de verdade local.
- Dados pessoais ignorados pelo Git.
- Candidatura, mensagem e formulário sempre terminam em revisão e ação humana.
- SelfProxy e UNEIA reconhecidos como patrocinadores; apoio não interfere em avaliações.
- Licença pública Apache-2.0, com aviso de atribuição em `NOTICE`.
- CI valida sintaxe, testes e inicialização mínima no Node.js 20.
- Portais usam registro local, busca pública por domínio e handoff manual; URLs desconhecidas recebem fallback web genérico.
- Codex, Claude Code, Hermes e OpenCode compartilham o contrato existente em `AGENTS.md`; provedores e segredos permanecem fora do projeto.

## [2026-08-13] Dados auditáveis e ingestão segura

- Todo conteúdo sob `data/` é privado; somente `data/pipeline.example.md` pode ser versionado.
- Vagas são capturadas por texto fornecido, sem fetch implícito, com URL canônica, data, hash e ID estável.
- Greenhouse e Lever usam apenas endpoints públicos, hosts fixos e transporte fail-closed; portais protegidos ficam em handoff humano.
- Conteúdo externo é dado não confiável e nunca instrui agente ou ferramenta.
- Golden evals são sintéticos e offline; validam contrato e regressão, não qualidade geral de um modelo.
- Follow-up calcula datas e registra fatos localmente; não envia mensagens.
