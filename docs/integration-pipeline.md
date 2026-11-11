# Esteira de integração e deploy

A branch `integration-ci-deploy` contém a API e o ML de `back/prototype`. O workflow em `.github/workflows/integration.yml` faz checkout **separado** do commit `9e2c9ad9305bcccb61314e33613a2cb5f20188c6` de `mobile/prototype`. Nenhuma branch é mesclada. Para integrar uma nova revisão mobile, atualize os dois campos `ref` do workflow após revisar o contrato de API e rode a CI novamente.

## Etapas

Em push e PR para a branch de integração, a CI instala dependências, executa lint, typecheck, testes, build/export e auditoria npm dos componentes aplicáveis. Em seguida, constrói três imagens Docker (API, job de migração e ML) e bloqueia a publicação se o Trivy detectar vulnerabilidades altas ou críticas. Em push, publica no GHCR as mesmas imagens verificadas, com tag do commit do backend. O modelo `.pkl` versionado entra na imagem de ML; o serviço ainda exige o SHA-256 aprovado em tempo de execução.

O deploy só inicia em push quando a variável de repositório `DEPLOY_ENABLED` é `true`. Os dois jobs usam o ambiente GitHub `production`; configure revisão obrigatória nesse ambiente antes de habilitar a variável. O deploy da VM usa as imagens já verificadas. Depois que a API fica saudável, o EAS gera um APK Android de distribuição interna a partir do commit mobile fixado. A esteira não envia o aplicativo à Play Store.

## Configuração da VM

Instale Docker Engine e Compose, configure o usuário de deploy com acesso ao Docker e crie `/opt/sgei` com permissão de escrita para ele. Configure HTTPS em um proxy reverso que encaminhe para `127.0.0.1:3000`; o PostgreSQL e o serviço ML não publicam portas. A VM precisa conseguir ler os pacotes GHCR, com login persistente de uma credencial `read:packages` se o pacote for privado.

Crie fora do Git, em `/opt/sgei`, os arquivos `db.env`, `api.env` e `ml.env`, com permissões `600`:

- `db.env`: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`.
- `api.env`: `DATABASE_URL` apontando para `db`, `JWT_SECRET` com pelo menos 32 caracteres, `NODE_ENV=production`, `PORT=3000`, `ALLOWED_ORIGINS` com as origens HTTPS necessárias e, se o ML for habilitado, `ML_SERVICE_URL=http://ml:8000` e `ML_SERVICE_TOKEN`.
- `ml.env`: o mesmo `ML_SERVICE_TOKEN` e, somente após aprovação do artefato, `ML_MODEL_APPROVED_SHA256` igual ao hash validado do modelo.

O workflow copia `compose.production.yml` e `release.env` para `/opt/sgei`, baixa as imagens, aplica as migrations e aguarda a API ficar saudável. Ele não executa a carga de dados demonstrativos. O volume do banco e o de uploads persistem entre releases. Configure backups antes do primeiro deploy de dados reais.

No GitHub, configure no ambiente `production` os secrets `VM_HOST`, `VM_USER`, `VM_SSH_KEY` e `VM_KNOWN_HOSTS`. `VM_KNOWN_HOSTS` deve conter a linha verificada da chave pública SSH do host; a esteira mantém a checagem da identidade da VM ativa.

## Configuração do EAS

Crie e vincule o projeto Expo e faça um primeiro build Android interativo para configurar o keystore, conforme a [documentação do Expo](https://docs.expo.dev/build/building-on-ci/). Configure o token de acesso `EXPO_TOKEN` como secret no ambiente `production`, e as variáveis `EAS_PROJECT_ID` e `ANDROID_PACKAGE` (identificador Android do app). No ambiente `preview` do projeto EAS, configure `EXPO_PUBLIC_API_URL` com o endereço HTTPS público da API. Essa URL entra no bundle do aplicativo e não deve conter credenciais.

Depois de validar todos os pré-requisitos, defina `DEPLOY_ENABLED=true` nas variáveis do repositório. Sem essa variável, a CI e a publicação das imagens executam, mas os dois deploys não iniciam.
