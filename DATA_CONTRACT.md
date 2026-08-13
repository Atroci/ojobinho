# Contrato de dados

## Conteúdo versionado

O repositório aceita somente sistema, documentação, exemplos sem dados reais (`*.example.*`) e fixtures sintéticas de teste. Exemplos e fixtures não podem ser derivados de currículo, perfil, vaga privada ou candidatura de uma pessoa.

## Conteúdo privado e local

Os caminhos abaixo são dados do candidato e ficam ignorados pelo Git:

- `config/perfil.md`
- `curriculo.md`
- `tracker.csv`
- `data/pipeline.md`
- todo conteúdo de `data/`, exceto `data/pipeline.example.md`
- `reports/` exceto `.gitkeep`
- `output/` exceto `.gitkeep`

`data/vacancies/<vacancy-id>.json` guarda texto fornecido localmente, URL HTTP(S) canônica, instante ISO 8601 da captura, SHA-256 do texto normalizado e ID determinístico. O módulo não busca a URL.

`data/applications/<application-id>.json` referencia o snapshot por ID e guarda currículo adaptado, mensagem, respostas, nomes de anexos, revisão e decisão de reutilização (`new`, `revised` ou `reused`). O módulo apenas grava o bundle; não envia candidatura, mensagem, formulário ou arquivo.

`data/history/` guarda eventos locais de status; `data/interview/` guarda histórias e anotações privadas; `data/input/` recebe JSON temporário usado pelos comandos locais.

IDs e nomes de anexos não aceitam caminhos. Gravações recusam arquivo existente, salvo quando o chamador passa explicitamente `replace: true`.

## Limite de publicação

Antes de commit ou publicação, execute `git status --short` e confirme que nenhum dado real aparece. CPF, RG, endereço residencial, credenciais, tokens e dados bancários não pertencem ao projeto, nem mesmo nos diretórios ignorados.
