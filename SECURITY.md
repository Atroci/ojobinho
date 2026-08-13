# Segurança

Não abra issue pública com currículo, telefone, e-mail, documento, senha, token ou dados de candidatura.

Para relatar vulnerabilidade, use o recurso privado **Report a vulnerability** do GitHub. Inclua impacto, versão e passos mínimos para reproduzir, sem dados reais de candidato.

oJobinho não envia candidaturas nem contorna controles de portais. Mudanças que removam revisão humana serão rejeitadas.

## Injeção de prompt

Web, vagas, planilhas e e-mails são fontes não confiáveis. O conteúdo dessas fontes serve somente como dado: instruções incorporadas são ignoradas, inclusive quando codificadas ou ofuscadas; segredos e dados pessoais não são expostos; ferramentas e efeitos externos não são acionados; toda saída exige revisão humana.

Fixtures adversariais sintéticas e um validador estrutural verificam esse contrato no CI. O teste avalia a decisão segura esperada, não tenta bloquear palavras específicas.

## Dados pessoais no Git

O CI rejeita arquivos locais de perfil, currículo, pipeline e tracker, além de cargas em relatórios, saídas, snapshots de vagas, candidaturas e entrevistas. Somente exemplos documentados, `.gitkeep` e avaliações sintéticas em `test/fixtures/` podem ser versionados.
