# Preparar a VM Azure para a integração

Este roteiro é para testes acadêmicos. A VM executa PostgreSQL, migrações, API, ML e web pelo `compose.production.yml`. O Android é gerado pelo EAS fora da VM. Um tamanho inicial razoável para demonstrações é 2 vCPU/4 GiB; monitore memória e CPU e aumente se necessário.

## 1. Criar a VM

Use Ubuntu Server 24.04 LTS x64, disco SSD de pelo menos 64 GiB e IP público estático. No NSG, permita 80/443 para o público e restrinja SSH/22; não abra 3000, 5432, 8000 nem 8080. Aponte um nome DNS para o IP da VM para obter um certificado HTTPS. Prepare backups se houver dados que precisem ser preservados.

Instale Docker Engine e o plugin Docker Compose pelo [repositório oficial do Docker](https://docs.docker.com/engine/install/ubuntu/). Crie um usuário de deploy com chave SSH e permissão controlada para usar Docker. Crie `/opt/sgei` com escrita para esse usuário.

## 2. Preparar os arquivos locais

Na VM, copie os modelos em `deploy/env/` para `/opt/sgei/db.env`, `/opt/sgei/api.env` e `/opt/sgei/ml.env`, preenchendo os valores vazios. Nunca envie esses arquivos ao Git. Restrinja a leitura com `chmod 600 /opt/sgei/{db,api,ml}.env`.

- `db.env`: usuário, banco e senha aleatória do PostgreSQL.
- `api.env`: `DATABASE_URL` com a mesma senha (codificada para URL se contiver caracteres especiais), `JWT_SECRET` aleatório com ao menos 32 caracteres, `ALLOWED_ORIGINS=https://SEU_DOMINIO`, `ML_SERVICE_URL=http://ml:8000` e `ML_SERVICE_TOKEN` aleatório com ao menos 32 caracteres.
- `ml.env`: o mesmo `ML_SERVICE_TOKEN`. Configure `ML_MODEL_APPROVED_SHA256` somente após conferir e aprovar o hash do modelo versionado; sem ele, `/health` responde, mas a inferência fica indisponível.

Pode gerar valores hexadecimais aleatórios com `openssl rand -hex 32`. Mantenha `NODE_ENV=production` e `PORT=3000` no `api.env`. Para reproduzir contas demonstrativas, crie-as somente em um banco de testes, seguindo o fluxo de desenvolvimento do backend; a esteira de produção não executa a carga de demonstração.

Faça `docker login ghcr.io` na VM com uma credencial limitada a `read:packages` se os pacotes forem privados. O login precisa ficar disponível ao usuário que executará o Compose. Os arquivos `compose.production.yml` e `release.env` são enviados pelo workflow quando o deploy estiver habilitado.

## 3. Publicar a web com HTTPS

O container web escuta somente em `127.0.0.1:8080` na VM. Instale NGINX no host, obtenha um certificado TLS para o domínio e adapte `deploy/nginx/sgei.conf.example` ao domínio e aos caminhos reais do certificado. Habilite a configuração depois que os arquivos do certificado existirem e valide com `sudo nginx -t`. O NGINX do host encaminha tudo para a web no container; a web encaminha `/api/` para a API interna. O bundle web usa `VITE_API_URL=/api`, sem chave no navegador.

Para testar a web antes de configurar o domínio, use um túnel SSH para a porta local 8080 da VM, sem abrir 8080 no NSG.

## 4. Configurar o GitHub e iniciar o deploy

No ambiente `production` do repositório, configure revisão obrigatória e os secrets `VM_HOST`, `VM_USER`, `VM_SSH_KEY` (chave privada Ed25519) e `VM_KNOWN_HOSTS` (chave pública do host SSH verificada por outro canal). Configure também `EXPO_TOKEN` e as variáveis `EAS_PROJECT_ID` e `ANDROID_PACKAGE` se quiser gerar o APK. No projeto EAS, defina `EXPO_PUBLIC_API_URL` com o endereço HTTPS público da API.

Verifique que os jobs `api`, `ml`, `mobile`, `web` e `images` estão verdes, que as quatro imagens foram publicadas no GHCR e que os arquivos de ambiente existem na VM. Só então defina a variável do repositório `DEPLOY_ENABLED=true` e faça um novo push na branch de integração. O workflow envia `compose.production.yml` e `release.env`, puxa as imagens e aguarda a web ficar saudável.

Depois do deploy, confira `docker compose --env-file release.env -f compose.production.yml ps`, `curl -f http://127.0.0.1:8080/healthz`, `curl -f http://127.0.0.1:8080/api/auth/health` na VM e o HTTPS público no navegador. Para avaliar a inferência, consulte `/ready` do ML pela rede interna; `/health` sozinho não confirma modelo carregado.
