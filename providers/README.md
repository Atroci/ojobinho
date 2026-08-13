# Fontes públicas estruturadas

Adaptadores disponíveis:

- Greenhouse: `https://boards-api.greenhouse.io/v1/boards/<board>/jobs?content=true`.
- Lever global: `https://api.lever.co/v0/postings/<site>?mode=json`.
- Lever EU: `https://api.eu.lever.co/v0/postings/<site>?mode=json`, com `instance: "eu"`.

Os adaptadores recebem apenas o slug do board/site, aceitam letras ASCII, números, `_` e `-` (1–64 caracteres, sem pontuação nas extremidades) e constroem a URL. Transporte aceita somente HTTPS, porta padrão e hosts fixos; recusa redirecionamento, resposta sem JSON, payload malformado, timeout e corpo acima do limite. URLs de vaga ficam restritas a `boards.greenhouse.io`, `job-boards.greenhouse.io`, `jobs.lever.co` e `jobs.eu.lever.co`. `fetchImpl` pode ser injetado para testes sem rede.

Cada vaga usa o mesmo schema: `id`, `providerId`, `source`, `sourceUrl`, `capturedAt`, `title`, `location`, `description` e `url`. `description` preserva o texto fornecido pela API e deve ser tratado como dado não confiável.

## Limites

Somente endpoints públicos e sem autenticação de Greenhouse e Lever estão cobertos. Não há scraping de LinkedIn, Catho ou InfoJobs, uso de login, resolução de CAPTCHA, contorno de bloqueios, descoberta automática de empresas nem envio de candidatura. O candidato sempre abre a URL pública, revisa os dados e executa qualquer ação final.
