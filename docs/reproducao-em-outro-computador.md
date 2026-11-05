# Reproduzir a demonstração em outro computador

## O que entregar

O projeto usa dois checkouts do mesmo repositório: `back/prototype` para API, banco e ML, e `mobile/prototype` para o aplicativo. Entregue as duas branches depois de registrar e enviar suas alterações, ou copie os dois checkouts locais. Arquivos ainda sem commit não aparecem em um `git clone`.

Na branch backend, inclua `services/ml/artifacts/externo-lr-sem-enrolled-v1/model.pkl` e `services/ml/candidates/externo-lr-sem-enrolled-v1.json`. O `.pkl` ativo tem SHA-256 `fbc7d381435551924dc09439da7a203aa02c5592a02d0d4fc963770887a2e5fd`. O `.gitignore` permite somente esse arquivo em `artifacts/`.

O CSV tratado, os modelos antigos, `.env`, `node_modules`, imagens Docker e volumes do PostgreSQL não fazem parte do código distribuído. O CSV é necessário apenas para reproduzir o treinamento offline; sua origem primária e autorização de distribuição ainda precisam ser confirmadas. Para apresentar o aplicativo com registros fictícios, use a carga de demonstração abaixo. Para transportar registros já cadastrados, faça um backup separado do PostgreSQL e dos uploads, sem publicar dados pessoais no Git.

## Preparação

Instale Docker Desktop e Node.js 22.13 ou superior. No checkout backend:

1. Copie `services/api/.env.example` para `services/api/.env` e `services/ml/.env.example` para `services/ml/.env`. Os arquivos `.env` são locais e não devem ser enviados ao Git.
2. Configure `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` e `DATABASE_URL` com os mesmos dados; dentro do Compose, o host do banco é `db`. Defina um `JWT_SECRET` próprio de pelo menos 32 caracteres.
3. Defina o mesmo `ML_SERVICE_TOKEN` próprio, de pelo menos 32 caracteres, nos dois `.env`. Na API, configure `ML_SERVICE_URL=http://ml:8000` e `ML_PREVIEW_ENABLED=true`. No ML, configure `ML_MODEL_APPROVED_SHA256=fbc7d381435551924dc09439da7a203aa02c5592a02d0d4fc963770887a2e5fd` somente depois de conferir o arquivo recebido. Isso habilita a prévia técnica, não o uso do escore para decisões reais.
4. Confira o hash do modelo. No PowerShell, execute `Get-FileHash services/ml/artifacts/externo-lr-sem-enrolled-v1/model.pkl -Algorithm SHA256` na raiz backend. Em Linux/macOS, use `sha256sum` no mesmo caminho.
5. Execute `docker compose up -d --build api ml` na raiz backend. O Compose inicia PostgreSQL, aplica migrations e sobe API e serviço de ML. Verifique com `docker compose ps`.

Para criar dados fictícios, preencha no `.env` da API `DEMO_INSTITUICAO_ID` (UUID), `DEMO_INSTITUICAO_NOME` e as cinco senhas `DEMO_<PERFIL>_PASSWORD` indicadas no modelo, todas distintas e com pelo menos 12 caracteres. Então execute `docker compose run --rm -e DEMO_SEED_ENABLED=true migrate npm run db:seed:ml`. A carga não sobrescreve contas já existentes. Consulte [ML por matrícula](ml-matriculas.md) para os estudantes criados.

No checkout mobile, execute `npm ci` e `npx expo start` dentro de `apps/mobile`. Sem `.env`, o app usa `http://localhost:3000` na web e `http://10.0.2.2:3000` no emulador Android. Se a API estiver em outro endereço, crie `apps/mobile/.env` com `EXPO_PUBLIC_API_URL=<endereço acessível>`. Um aparelho físico não acessa a porta ligada a `127.0.0.1` no Compose; essa apresentação exige configuração de rede e endereço HTTPS próprios.

## Conferência rápida

- `docker compose ps` mostra `db`, `api` e `ml` saudáveis.
- `http://localhost:3000/auth/health` responde pela API no computador que executa o Compose.
- O login usa o UUID da instituição e as credenciais fictícias configuradas na carga.
- Se o modelo não carregar, confira o arquivo, o SHA-256, o token comum e as variáveis de ML antes de modificar código ou dados.
