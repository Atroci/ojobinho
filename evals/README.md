# Golden evals offline

Contrato estável: `expected.json`, versão 1. Cada resultado traz fatos, rubrica A–G, nota ponderada, bloqueadores e decisão. `contract.mjs` rejeita campos ausentes/extras, enums desconhecidos e incoerências entre fatos, nota, bloqueadores e decisão.

Replay de saída produzida por qualquer adaptador ou agente:

```sh
node evals/replay.mjs caminho/resultados.json
```

O replay não chama rede nem modelo. Ele valida somente forma e igualdade dos arquivos fornecidos contra casos sintéticos congelados; sozinho, não mede qualidade geral de modelo.
