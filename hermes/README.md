# oJobinho no Hermes Agent

`SKILL.md` é a skill que o [Hermes Agent](https://hermes-agent.nousresearch.com/) carrega para usar o oJobinho a partir de um VPS. O repositório é a única fonte; o VPS só clona e puxa.

## Instalar (uma vez)

No VPS, como o usuário que roda o Hermes:

```bash
# 1. clone dentro da home do sandbox (o sandbox enxerga como /root/ojobinho)
git clone https://github.com/Atroci/ojobinho.git ~/.hermes/sandboxes/docker/default/home/ojobinho

# 2. registre a skill (cópia, não symlink: o diretório de skills é montado no sandbox)
mkdir -p ~/.hermes/skills/job-search/ojobinho
cp ~/.hermes/sandboxes/docker/default/home/ojobinho/hermes/SKILL.md ~/.hermes/skills/job-search/ojobinho/SKILL.md

# 3. confira
hermes skills list | grep ojobinho
```

Depois, dentro do sandbox, preencha perfil e currículo do motor (`npm run motor -- profile set --stdin`, `npm run motor -- resume import <pdf>`). Esses arquivos ficam em `data/motor/` e nunca entram no Git.

## Atualizar

```bash
git -C ~/.hermes/sandboxes/docker/default/home/ojobinho pull --ff-only
cp ~/.hermes/sandboxes/docker/default/home/ojobinho/hermes/SKILL.md ~/.hermes/skills/job-search/ojobinho/SKILL.md
```

Ou peça ao próprio Hermes: "atualize o oJobinho" executa o `git pull` dentro do sandbox (a cópia da skill continua manual).

## Limites

Os mesmos de `AGENTS.md`: o Hermes prepara, o candidato envia. O navegador do Hermes não é caminho de envio. Nada de credenciais no repositório nem no sandbox.
