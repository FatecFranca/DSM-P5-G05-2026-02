# API do SGEI

Base inicial do backend NestJS. Esta etapa cobre autenticação, sessões com rotação de refresh token, perfis, isolamento por instituição para usuários e auditoria de eventos de autenticação e cadastro. A estrutura acadêmica e os demais módulos do `CONTEXT.md` ainda serão implementados nos próximos marcos.

## Requisitos

- Node.js 24 e npm 11
- PostgreSQL 16, ou Docker Compose para o ambiente local

## Configuração local

1. Copie `.env.example` para `.env` e substitua a senha do banco e `JWT_SECRET` por valores locais seguros. Para executar a API fora do Docker, troque `db` por `localhost` em `DATABASE_URL`.
2. Execute `npm ci` e `npm run db:generate` nesta pasta.
3. Inicie o PostgreSQL e aplique `npm run db:migrate`.
4. Execute `npm run build` e `npm run start:prod` (ou `npm run start:dev`).

Na raiz do repositório, `docker compose up --build` inicia PostgreSQL, aplica a migração e sobe a API. O Compose lê `services/api/.env`: defina `POSTGRES_USER`, `POSTGRES_PASSWORD` (não vazia), `POSTGRES_DB` e use os mesmos dados em `DATABASE_URL`, com host `db`. Uma URL com `localhost` serve apenas para executar a API fora do Docker. A porta do banco fica ligada somente a `127.0.0.1` para desenvolvimento.

## Primeiro administrador

Após a migração, defina `BOOTSTRAP_INSTITUICAO_ID` (UUID), `BOOTSTRAP_INSTITUICAO_NOME`, `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_NOME` e `BOOTSTRAP_ADMIN_PASSWORD` (mínimo 12 caracteres) no ambiente do comando. Execute `npm run bootstrap` após o build, ou `docker compose run --rm -e BOOTSTRAP_INSTITUICAO_ID -e BOOTSTRAP_INSTITUICAO_NOME -e BOOTSTRAP_ADMIN_EMAIL -e BOOTSTRAP_ADMIN_NOME -e BOOTSTRAP_ADMIN_PASSWORD migrate node dist/bootstrap.js` com essas variáveis previamente definidas no shell. O script recusa recriar o mesmo administrador e não imprime a senha.

## Contas demonstrativas por perfil

As migrations criam a estrutura do banco. A carga de contas é separada para que nenhuma senha seja gravada em SQL versionado. Para o ambiente Docker local, configure em `services/api/.env` as variáveis `DEMO_INSTITUICAO_ID`, `DEMO_INSTITUICAO_NOME` e as cinco `DEMO_<PERFIL>_PASSWORD` mostradas em `.env.example`. Use UUID próprio e senhas fortes diferentes. Então execute na raiz `docker compose --profile demo up --build -d db api` e `docker compose --profile demo run --rm seed-demo`. A carga é idempotente: preserva senhas de contas existentes e falha se o e-mail já tiver outro perfil. Ela recusa `NODE_ENV=production`.

| Perfil | E-mail fictício |
| --- | --- |
| ADMIN | `admin.demo@sgei.example` |
| COORDENACAO | `coordenacao.demo@sgei.example` |
| PROFESSOR | `professor.demo@sgei.example` |
| TUTOR | `tutor.demo@sgei.example` |
| ALUNO | `aluno.demo@sgei.example` |

Use o mesmo `DEMO_INSTITUICAO_ID` no login do mobile. Os perfis têm login funcional, mas os vínculos acadêmicos ainda não existem no esquema atual; assim, não há dados reais de turma ou estudante para acessar.

## Contrato inicial

| Rota | Acesso | Uso |
| --- | --- | --- |
| `GET /auth/health` | público | verificação de disponibilidade do banco |
| `POST /auth/login` | público | recebe `instituicaoId`, `email`, `senha`; devolve access e refresh token |
| `POST /auth/refresh` | público | recebe `refreshToken`; rotaciona a sessão |
| `POST /auth/logout` | público | recebe `refreshToken`; revoga a sessão |
| `GET /auth/me` | autenticado | devolve identificador, instituição e perfil atuais |
| `GET /usuarios` | ADMIN | lista até 100 usuários da própria instituição |
| `GET /usuarios/:id` | ADMIN | consulta usuário da própria instituição |
| `POST /usuarios` | ADMIN | cria usuário na própria instituição |
| `GET /ml/status` | ADMIN | informa se o serviço interno e um modelo aprovado estão disponíveis |
| `POST /ml/preview` | ADMIN, com `ML_PREVIEW_ENABLED=true` | testa uma inferência com os 36 atributos numéricos completos, sem vínculo acadêmico ou persistência |

Use `Authorization: Bearer <accessToken>` nas rotas protegidas. O servidor resolve o perfil e a instituição a partir da sessão no banco; campos enviados pelo cliente não alteram o escopo. Respostas de usuários não incluem `senhaHash`.

O cliente interno de ML é configurado por `ML_SERVICE_URL`, `ML_SERVICE_TOKEN` e `ML_CLIENT_TIMEOUT_MS`. Ele envia apenas o contrato de 36 atributos, usa timeout e rejeita respostas incompatíveis. A prévia exige `ML_PREVIEW_ENABLED=true` e aceita `{ "features": { ... } }` com todas as 36 colunas de entrada; use somente dados sintéticos ou de teste. Consulte `services/ml/README.md` para treino, aprovação e limites atuais. Não há endpoint de previsão de alunos até que a estrutura acadêmica, o mapeamento dos atributos e as regras de autorização estejam implementados.

## Verificação

`npm run db:validate`, `npm run typecheck`, `npm run lint`, `npm test -- --runInBand` e `npm run build`.

A migração SQL inicial está em `prisma/migrations/20261020000000_init`. A aplicação da migração e os testes com banco real dependem de um PostgreSQL em execução.
