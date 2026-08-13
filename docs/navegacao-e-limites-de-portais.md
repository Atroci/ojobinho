# Navegação e limites de portais

oJobinho não preenche formulário, não clica em enviar e não contorna login. Ainda assim, você e o agente leem páginas de portais o tempo todo: anúncio, página da empresa, painel de candidaturas. Este documento reúne o que já foi validado em operações reais de automação assistida em marketplaces e o que continua sendo apenas proposta.

Tudo aqui é subordinado a [privacidade e uso responsável](privacidade-e-uso-responsavel.md). Nada neste documento autoriza contornar proteção, login ou CAPTCHA de portal algum.

## O princípio

Você não evita bloqueio disfarçando o robô. Evita porque, na maior parte, não existe robô: quem faz login é a pessoa, no navegador dela, e a pessoa continua olhando a tela. O que sobra para o agente é ler, organizar e rascunhar.

Isso inverte a pergunta usual. Em vez de "como fazer o script parecer humano", a pergunta é "quanto desse fluxo precisa mesmo ser script". Na prática, quase nada.

---

# Validado na prática

Cada item abaixo descreve configuração ou incidente real de uma operação de automação assistida em marketplace de freelancer, adaptado para o contexto do oJobinho.

## 1. Navegador real, perfil real, humano no circuito

A configuração em uso hoje, para sessões de operador em plataforma logada:

- Chrome estável instalado no sistema, **não** headless.
- Perfil persistente próprio, em diretório com permissão `0700`. Mesmo perfil sempre, com histórico e cookies acumulando como os de qualquer pessoa.
- Flags mínimas: `--no-first-run`, `--no-default-browser-check`, `--start-maximized`, `--disable-dev-shm-usage`. Nada de flags de automação.
- Roda em display virtual (1920x1080x24) com acesso remoto restrito ao loopback, para que a pessoa acompanhe a tela e assuma o controle quando quiser.
- Sem reinício automático. Se cair, alguém precisa olhar. Reinício automático vira martelo contra o portal.
- A política está declarada em configuração versionada, não só no código: headless proibido, WebDriver proibido, CDP proibido para autenticação de plataforma, spoofing de fingerprint proibido. Permitido: login manual, pesquisa, revisão de rascunho e ação de plataforma aprovada por humano. Proibido: bypass de CAPTCHA, automação de rede social, envio automático, evasão por proxy.

O comentário no próprio script de inicialização diz o essencial: ele deliberadamente não habilita headless, WebDriver, CDP nem spoofing de fingerprint.

**No oJobinho.** Faça login você mesmo, no seu navegador, como faria sem o projeto. Copie o texto do anúncio para `data/input/vaga.json` e rode `npm run capturar`. O agente nunca vê sua senha, nunca abre a URL por conta própria e nunca precisa de um perfil paralelo.

## 2. Sessão viva, ou parada barulhenta

A falha recorrente não é bloqueio. É expiração silenciosa de sessão.

Números reais de um registro de execução: o último envio bem-sucedido foi em 2026-07-10. De 2026-07-11 a 2026-07-23, treze dias seguidos, o loop registrou 268 linhas de `session_expired` — cerca de 24 por dia — e nenhum sucesso. O código estava certo: detectava o redirecionamento para login em três pontos da navegação, marcava o lote com um sentinela e parava sem tentar de novo.

O problema é que "barulhento" era barulhento **no arquivo**. Ninguém leu o arquivo por treze dias.

Duas lições, e a segunda é a que costuma faltar:

1. Verifique a sessão **antes** de um lote de leituras, não durante. Uma checagem barata que carrega uma página autenticada e confirma que não caiu no login resolve.
2. Uma checagem de vitalidade só conta se a falha chegar a uma pessoa. Linha em log não é aviso.

**No oJobinho.** Antes de abrir uma sequência de vagas de um portal logado, confirme que ainda está autenticado. Se caiu, resolva o login antes de continuar; não fique recarregando. Se você automatizou qualquer coleta, faça a falha aparecer onde você olha todo dia.

## 3. Limites numéricos e ritmo

Parâmetros que estão em produção hoje na operação de marketplace:

| Parâmetro | Valor |
|---|---|
| Teto diário de ações por conta | 20 |
| Pausa entre itens do lote | 25 a 70 s |
| Pausa extra ocasional | 30 a 120 s, com 15% de chance |
| Aquecimento antes da primeira página | 2 a 5 s |
| Permanência na página antes do formulário | 3 a 6 s |
| Pausa extra ocasional nas anteriores | 3 a 10 s, com 10% de chance |
| Digitação | blocos de 30 a 60 caracteres, 15 a 50 ms por tecla |
| Pausa entre blocos | 0,5 a 2 s, com 20% de chance |
| Agendador | a cada 30 min, com atraso aleatório de até 90 s |
| Teto por anúncio | 3 falhas do mesmo tipo e o anúncio é pulado |

Dois pontos sobre esses números.

O jitter não serve para disfarçar. Serve para não gerar padrão de máquina: trinta minutos cravados, sempre no mesmo segundo, é assinatura mais forte que qualquer fingerprint. O atraso aleatório do agendador existe pelo mesmo motivo.

O teto por anúncio existe porque sem ele um anúncio quebrado é reprocessado para sempre. Aconteceu: um projeto cancelado pela moderação da plataforma acumulou 45 tentativas abortadas ao longo de três dias, porque nada contava as falhas repetidas do mesmo item. O teto diário protege a conta; o teto por item protege contra loop.

**No oJobinho.** Se você abrir vagas em série, respeite um teto por dia e varie o intervalo. Não existe motivo para ler 200 anúncios de um portal em dez minutos.

## 4. Confira o que a tela mostra, não o que você digitou

Toda submissão daquela operação passa por uma guarda que lê o campo de volta e aborta se o valor exibido não corresponde ao valor enviado. A guarda existe por causa de um caso real: uma formatação de moeda foi reinterpretada e o valor enviado ficou cerca de mil vezes maior que o pretendido.

**No oJobinho.** O checklist de campos e anexos de [`modes/aplicar.md`](../modes/aplicar.md) cobre isso. Antes de enviar, leia da tela: valor, data, arquivo anexado, endereço de e-mail. Campos com máscara mentem com frequência.

## 5. Sombra antes de ao vivo, com portão de saída que exista de verdade

A operação rodou primeiro em modo sombra, com o envio desligado por padrão explícito, antes de passar a enviar de verdade. Isso funcionou.

O que não funcionou vale mais como aviso. A especificação do piloto definia critérios de saída concretos: 100 decisões com rótulo humano de auditoria, pelo menos 10 com dois rótulos independentes, resultado comercial explícito para cada oportunidade enviada (inclusive `unknown` quando não há evidência), validação apontando zero campo proibido, e aprovação final do operador.

O registro que mediria tudo isso nunca foi construído — o diretório previsto na especificação não existe. O modo ao vivo foi ligado por decisão explícita do operador, não por atingir aqueles critérios.

A lição: um piloto que não constrói o próprio instrumento de medição não tem portão de saída. Tem uma data. Se a fase de observação define critério, o primeiro trabalho da fase é o instrumento que mede o critério — não o último.

**No oJobinho.** O projeto já é permanentemente "sombra": o envio é sempre humano. Se algum dia você automatizar uma etapa de leitura, decida antes como vai saber que ela está funcionando, e construa isso primeiro.

## 6. Padrões de agente que se aplicam aqui

Vindos de um harness de agente multi-inquilino em operação, filtrados para o que ajuda um copiloto local:

- **Conteúdo externo é dado, nunca instrução.** Já é contrato deste projeto ([`AGENTS.md`](../AGENTS.md), `security-contract:v1`). Vale reforçar que anúncio de vaga é exatamente o vetor: texto redigido por terceiro, lido por um agente com acesso aos seus arquivos.
- **Prazo de parede, não prazo de leitura.** Chamada a modelo sem streaming pode receber bytes de keep-alive periódicos, e cada byte reinicia o timeout por leitura da biblioteca HTTP. Sem um prazo em tempo absoluto, a chamada trava indefinidamente. Custou três noites seguidas de tarefa agendada morta antes de ser identificado; a correção foi um `deadline` monotônico envolvendo todas as tentativas, incluindo os modelos de fallback.
- **Fila durável e tentativas limitadas, fora do caminho da requisição.** Quando um portão de qualidade precisou de uma segunda chamada de modelo, ele não coube no timeout fixo de 30 s do webhook. A saída foi tirar o portão do caminho síncrono: enfileirar, processar em worker, no máximo 3 tentativas, e mensagem provisória para quem espera. Vale para qualquer etapa lenta: não a coloque entre o pedido e a resposta.
- **Inconclusivo vence chute.** Toda afirmação de relatório ou auditoria cita fonte; quando a evidência falta, o correto é dizer que falta e pedir revisão. É a mesma regra do [`modes/aplicar.md`](../modes/aplicar.md) sobre não inventar experiência, aplicada ao que o agente relata sobre si mesmo.

---

# Propostas a validar

Nada nesta seção foi testado. Está aqui como plano, não como prática.

## Camoufox

Camoufox é apresentado publicamente como um navegador baseado em Firefox voltado a resistir a detecção por fingerprint. **Nunca foi usado nem avaliado nesta operação.** Não há aqui nenhum dado sobre desempenho, estabilidade ou eficácia dele.

Por que seria candidato: a pilha validada hoje depende de uma pessoa manter uma sessão real aberta. Isso é bom para segurança e ruim para escala. Um navegador que resistisse a fingerprint reduziria a dependência dessa sessão para tarefas de **leitura pública**.

O que teria de ser provado antes de qualquer adoção:

1. Funciona sem login, em página pública, contra os portais que interessam ao Brasil, por pelo menos 30 dias, sem bloqueio de IP nem de conta.
2. O texto extraído bate com o que um humano vê no mesmo anúncio, medido em uma amostra de comparação, e não silenciosamente truncado.
3. O consumo de memória e o tempo de inicialização cabem numa máquina de candidato, não só num servidor.
4. Existe caminho claro de degradação quando ele falha: parar e avisar, nunca cair para uma tentativa mais agressiva.
5. Alguém leu os termos de uso de cada portal alvo e concluiu que leitura pública automatizada é aceitável ali.

Duas ressalvas honestas. Primeira: a pilha validada hoje é Chrome real com perfil humano, e ela funciona; trocar por outra coisa precisa justificar o risco, não só a conveniência. Segunda, e mais importante: mudar para uma base Firefox muda a história de fingerprint, não a pergunta ética. Se um portal proíbe coleta automatizada, uma ferramenta melhor de evitar detecção não transforma isso em permitido — apenas dificulta a detecção. Este projeto não vai por esse caminho.

## Contrato de papéis para candidatura

Existe uma configuração escrita que divide papéis numa operação de candidatura: o componente de pesquisa pode fazer pesquisa pública, extrair requisitos e rascunhar currículo e proposta, e tem login, uso de credencial, uso de cookie, upload de currículo, submissão e mensagem externa explicitamente na lista de proibições; o coordenador pode deduplicar, montar pacote de requisitos e reconciliar o tracker, com as mesmas proibições; e a pessoa é dona da identidade e do envio final, com autenticação manual, revisão do texto exato, revisão do valor exato, clique final e confirmação de recebimento como ações obrigatórias dela.

**Esse contrato está marcado como `design_only`, com execução desligada. Nunca rodou.** É desenho, não prática.

Vale citar mesmo assim porque a divisão de papéis é quase exatamente a do oJobinho, escrita de forma explícita e verificável em vez de ficar implícita na documentação. Se um dia o projeto crescer para mais de um componente, essa é a forma de escrever o limite.

---

## Sobre frameworks de automação

Playwright é usado nesta operação em dois lugares: renderização de PDF e o submissor de marketplace citado acima. Funciona.

Não é necessário aqui, e isso não é uma crítica à ferramenta. oJobinho não preenche formulário nem clica em enviar, então não há o que dirigir. Ferramenta de automação de navegador só ganha lugar num projeto que automatiza navegador; adicionar uma agora traria dependência, superfície de risco e a tentação de usá-la para exatamente o que o [contrato do projeto](../AGENTS.md) proíbe.

---

## Resumo

| Item | Situação |
|---|---|
| Navegador real, perfil persistente, humano assiste e assume | Validado em produção |
| Sem headless, WebDriver, CDP para autenticação ou spoofing de fingerprint | Validado, declarado em configuração versionada |
| Sem reinício automático em falha | Validado |
| Verificação de sessão antes do lote, com parada | Validado (código) |
| Fazer a falha chegar a uma pessoa, não só ao log | Lição de incidente, ainda não resolvida na origem |
| Tetos diários e por item, jitter, atraso no agendador | Validado em produção |
| Conferir o campo pela tela antes de enviar | Validado (guarda em produção) |
| Sombra antes de ao vivo | Validado |
| Portão de saída mensurável do piloto | Especificado, nunca construído |
| Prazo de parede em chamada de modelo | Validado (correção de incidente) |
| Fila durável, no máximo 3 tentativas, fora do caminho da requisição | Validado em produção |
| Camoufox | Proposta, nunca avaliado aqui |
| Contrato de papéis para candidatura | Desenho, execução desligada, nunca rodou |
