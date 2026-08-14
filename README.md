<p align="center">
  <img src="assets/ojobinho-banner.svg" alt="oJobinho, seu copiloto de candidaturas no Brasil" width="880">
</p>

<p align="center">
  <a href="LICENSE"><img alt="Licença Apache 2.0" src="https://img.shields.io/badge/licen%C3%A7a-Apache--2.0-147A3D"></a>
  <a href="https://github.com/Atroci/ojobinho/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/Atroci/ojobinho/actions/workflows/ci.yml/badge.svg"></a>
  <img alt="Node 20 ou superior" src="https://img.shields.io/badge/Node.js-20%2B-147A3D">
  <img alt="Português do Brasil" src="https://img.shields.io/badge/idioma-PT--BR-FFCC29">
  <img alt="Revisão humana obrigatória" src="https://img.shields.io/badge/envio-revis%C3%A3o_humana-002776">
</p>

<p align="center">
  <strong>Achar vaga é trabalho. oJobinho organiza o trabalho.</strong><br>
  Avalie oportunidades, adapte seu currículo e acompanhe candidaturas sem entregar seus dados a outro serviço.
</p>

<p align="center">
  <a href="#comece-em-dois-minutos">Começar</a> ·
  <a href="#lista-pública-de-oportunidades">Vagas para testar</a> ·
  <a href="#feito-para-o-mercado-brasileiro">Mercado brasileiro</a> ·
  <a href="#documentação">Documentação</a> ·
  <a href="#patrocinadores">Patrocinadores</a>
</p>

## Comece em dois minutos

```bash
git clone https://github.com/Atroci/ojobinho.git
cd ojobinho
npm run init
```

Preencha `config/perfil.md` e `curriculo.md`. Depois abra Codex, Claude Code ou outro agente compatível com `AGENTS.md` e diga:

```text
Avalie esta vaga com oJobinho: https://empresa.com/vaga/123
```

| Quero... | Faça... |
|---|---|
| Encontrar vagas para testar | `npm run vagas` |
| Buscar em portais | `npm run buscar -- "designer remoto Brasil"` |
| Atualizar fontes públicas configuradas | `npm run descobrir` |
| Reconhecer fluxo do portal | `npm run portal -- "URL"` |
| Colocar uma vaga na fila | `npm run vaga -- "URL"` |
| Capturar descrição auditável | `npm run capturar -- data/input/vaga.json` |
| Criar pacote de candidatura | `npm run pacote -- data/input/pacote.json` |
| Calcular próximo contato | `npm run proximo -- candidatura-enviada 2026-08-14 0` |
| Consultar Greenhouse público | `npm run greenhouse -- empresa` |
| Consultar Lever público | `npm run lever -- empresa` |
| Validar segurança | `npm run security` |
| Conferir configuração | `npm run doctor` |
| Rodar testes | `npm test` |

![Da busca confusa a uma candidatura revisada e focada](assets/readme/da-vaga-a-candidatura.png)

<p align="center"><em>Menos volume. Mais foco em vagas que fazem sentido para você.</em></p>

## Lista pública de oportunidades

A comunidade pode testar o fluxo usando a [lista de vagas remotas de Design, Branding e Social no Brasil e na América Latina](https://docs.google.com/spreadsheets/d/1lMBYP_qev6Q1bKcxW_cngyjuoKEqPz4PGyp0V2Vfu4M/edit?gid=2034983413#gid=2034983413), atualizada com apoio da UNEIA.

A planilha tem acesso de visualização. Você pode abrir a vaga original, copiar o link e adicionar ao seu pipeline. Para filtrar ou anotar, faça uma cópia para sua conta.

## O que oJobinho faz

- Avalia compatibilidade em uma rubrica A-G com nota de 1,0 a 5,0.
- Separa requisitos, salário, contrato, localização, interesse e legitimidade.
- Entende CLT, PJ, estágio, temporário e freelancer.
- Adapta currículo e mensagem sem inventar experiência.
- Guarda snapshots com URL, data e hash; organiza materiais em bundles versionados.
- Calcula lembretes em dias úteis e registra histórico local sem enviar mensagens.
- Mantém pipeline e tracker locais, em arquivos legíveis.
- Funciona dentro do agente de IA que você já usa.

## O que ele não faz

- Não envia candidatura, e-mail ou mensagem.
- Não clica em “Enviar” nem preenche portal sem você.
- Não guarda CPF, RG, senha, token ou dados bancários.
- Não contorna CAPTCHA, login ou bloqueio de plataforma.
- Não transforma falta de experiência em palavra-chave falsa.

Você escolhe a vaga, revisa os materiais e realiza a ação final.

![Dados locais e decisões humanas durante todo o fluxo](assets/readme/local-e-humano.png)

<p align="center"><em>Seus dados ficam locais. Toda candidatura passa por você.</em></p>

## Fluxo

```text
vaga ou linha da planilha
        ↓
snapshot local com hash
        ↓
avaliação A-G + sinais de golpe
        ↓
decisão humana
        ↓
currículo + mensagem adaptados
        ↓
revisão e envio pelo candidato
        ↓
tracker local
```

## Feito para o mercado brasileiro

| Tema | Tratamento |
|---|---|
| Contrato | CLT, PJ, estágio, temporário e freelancer não são tratados como equivalentes |
| Remuneração | Mensal/anual, bruto/líquido, fixo/variável e benefícios ficam separados |
| Localização | Cidade, UF, remoto, híbrido, presencial e horário de Brasília entram na decisão |
| PJ | CNPJ ou MEI vira pergunta, nunca suposição |
| Segurança | Domínio, empresa, contato, pagamento antecipado e coleta precoce de documentos são verificados |
| Privacidade | Perfil, currículo e tracker ficam na sua máquina |

## Portais e agentes

Adaptadores de handoff cobrem LinkedIn, Catho, InfoJobs, Gupy, Vagas.com.br, Trampos, Programathor, Revelo, Workana, 99Freelas, Indeed, Remote Rocketship, Himalayas, Instagram e Facebook. Qualquer outro endereço HTTP ou HTTPS recebe handoff genérico seguro. Gupy, Greenhouse e Lever têm leitura opcional de fontes públicas estruturadas, com hosts fixos, limite de resposta, timeout e testes sem rede.

| Função | O que acontece |
|---|---|
| Buscar | Gera consultas públicas por domínio; não raspa páginas |
| Importar | Lê somente fontes públicas Gupy/Greenhouse/Lever; nunca páginas protegidas |
| Descobrir | Reconsulta Gupy/Greenhouse/Lever configurados, deduplica e mantém histórico local |
| Preparar | Identifica portal e entrega checklist de handoff |
| Enviar | Sempre feito pelo candidato no canal oficial |

O mesmo `AGENTS.md` funciona com Codex, Hermes e OpenCode. `CLAUDE.md` conecta Claude Code ao mesmo contrato. OpenRouter gratuito e OpenCode Go entram pelo provedor do agente, sem chave salva no repositório. Veja [adaptadores e agentes compatíveis](docs/adaptadores-e-agentes.md).

## Estrutura

```text
AGENTS.md                 regras para o agente
adapters/portais.mjs      busca e handoff por portal
providers/                Gupy/Greenhouse/Lever públicos e transporte seguro
lib/                      descoberta, snapshots, bundles e acompanhamento local
evals/                    casos brasileiros sintéticos e replay offline
config/perfil.md          suas preferências, ignoradas pelo Git
curriculo.md              currículo mestre, ignorado pelo Git
data/                     fila, snapshots, histórico e entrevista privados
modes/avaliar.md          rubrica brasileira
modes/aplicar.md          preparação com revisão humana
modes/entrevista.md       preparo de entrevista sem inventar fatos
tracker.csv               estado das candidaturas
reports/                  avaliações geradas
output/                   materiais adaptados
```

## Documentação

- [Guia de uso](docs/guia-de-uso.md): instalação, avaliação e acompanhamento.
- [Adaptadores e agentes](docs/adaptadores-e-agentes.md): portais, Codex, Claude, Hermes, OpenRouter e OpenCode.
- [Descoberta contínua no Brasil](docs/descoberta-brasil.md): fontes, dados, enriquecimento e agendamento a cada 6 horas.
- [Privacidade e uso responsável](docs/privacidade-e-uso-responsavel.md): dados locais, revisão humana e limites.
- [Navegação e limites de portais](docs/navegacao-e-limites-de-portais.md): como ler portais sem virar bot, tetos e ritmo, propostas ainda não validadas.
- [Contrato de dados](DATA_CONTRACT.md): o que pode ser versionado e o que permanece privado.
- [Segurança](SECURITY.md): prompt injection, dados pessoais e relato privado de vulnerabilidades.
- [Como contribuir](CONTRIBUTING.md) e [Código de Conduta](CODE_OF_CONDUCT.md).

## Patrocinadores

Projetos que ajudam o oJobinho a chegar a mais brasileiros:

<table>
  <tr>
    <td align="center" width="50%">
      <a href="https://selfproxy.app">
        <img src="assets/sponsors/selfproxy.png" alt="SelfProxy" width="360">
      </a><br>
      <strong>SelfProxy</strong><br>
      Proxy móvel HTTP e SOCKS5 usando o Android e o IP da própria operadora.
    </td>
    <td align="center" width="50%">
      <a href="https://uneia.com.br/">
        <img src="assets/sponsors/uneia.png" alt="UNEIA" width="220">
      </a><br>
      <strong>UNEIA</strong><br>
      Formação prática e gratuita em IA, projetos de portfólio e comunidade de oportunidades.
    </td>
  </tr>
</table>

### Como a SelfProxy ajuda

A [SelfProxy](https://selfproxy.app) transforma um Android autorizado em proxy móvel 4G/5G, com HTTP, SOCKS5, credencial por dispositivo e rotação sob demanda. Isso pode ajudar mantenedores a testar, com permissão, acesso e comportamento de páginas públicas de recrutamento em uma conexão móvel real. Não serve para enviar candidaturas, burlar bloqueios, CAPTCHA ou termos de plataformas.

### Agradecimento especial à UNEIA

Obrigado à [UNEIA](https://uneia.com.br/) por manter e compartilhar a lista pública de vagas usada nos testes e por oferecer cursos gratuitos de IA, dados e tecnologia com projetos práticos. A comunidade aproxima aprendizado, portfólio e oportunidades sem prometer contratação.

Patrocínio dá visibilidade e apoio ao projeto. Não altera nota de vaga, recomendação ou ordem de oportunidades.

## Contribua

Encontrou um portal brasileiro, risco de golpe ou diferença regional que falta? Leia [Como contribuir](CONTRIBUTING.md) e abra uma issue com exemplo verificável. Não publique currículo, e-mail, telefone ou documento pessoal.

## Licença

Apache 2.0. Veja [LICENSE](LICENSE) e [NOTICE](NOTICE).
