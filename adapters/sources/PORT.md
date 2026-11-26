# Coletores portados

O mapeamento de cada feed público (URL, campos e trava de host) foi reescrito no transporte fail-closed do oJobinho a partir do career-ops, commit `9d61e5a`, licença MIT. Não é cópia do runtime de lá: sem undici, sem js-yaml, sem o guard de IP.

Fontes com coleta nesta versão: remoteok, remotive, himalayas, jobicy, workingnomads, weworkremotely, nodesk, jobspresso, getonbrd, landingjobs, arbeitnow, manfred, gupy (busca pública), greenhouse, lever, ashby, hackernews, startup-jobs, remote-com, net-empregos, 99freelas e oracle-hcm.

Wellfound e Computrabajo ficam desligados. Wellfound passou na auditoria de 2026-11-23, mas o site depende de Cloudflare. Computrabajo MX/AR responderam com teto de rastreio; o host BR falhou. Upwork, Workana, Freelanceradar, Fiverr, Contra e PeoplePerHour não são raspados.

Feeds extras e fontes novas desta leva não vêm do career-ops: RSS de marketing do We Work Remotely, busca do Himalayas, categoria `digital-marketing` do Get on Board, API do Freelancer.com, snapshot Parquet do ats-scrapers, API do Jobgether, RSS de jobs.wordpress.net, API do 4dayweek.io e o JSON público do Oracle Recruiting Cloud (`oracle-hcm`). A Oracle trata esses endpoints como uso interno; o adaptador fica allowlisted, lento e só em JSON. Alertas do LinkedIn entram só por arquivo local.
