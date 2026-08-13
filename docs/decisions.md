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

## [2026-08-13] Navegação de portais e limites operacionais

- Doutrina de navegação: navegador real do candidato, perfil persistente próprio, pessoa acompanhando e podendo assumir; headless, WebDriver, CDP para autenticação de plataforma e spoofing de fingerprint ficam fora.
- Falha em sessão de portal para o fluxo e exige ação humana; nunca reinicia sozinha nem degrada silenciosamente.
- Aviso de falha precisa chegar a uma pessoa; linha em log não conta como aviso.
- Leitura em série respeita teto diário, teto por item e intervalo variável; cadência fixa é assinatura de máquina.
- Campo com máscara é conferido pela tela antes do envio, não pelo valor digitado.
- Fase de observação só tem portão de saída se o instrumento que mede o critério for construído primeiro.
- Chamada a modelo usa prazo em tempo absoluto; timeout por leitura não protege contra keep-alive.
- Etapa lenta vai para fila com tentativas limitadas, fora do caminho da requisição.
- oJobinho não adota framework de automação de navegador: o projeto não preenche nem envia, então não há navegador a dirigir.
- Camoufox fica registrado como proposta com plano de avaliação, sem uso nem medição; mudar a base do navegador altera detecção, não altera termos de uso.
- Detalhes, números e origem de cada item em `docs/navegacao-e-limites-de-portais.md`.
