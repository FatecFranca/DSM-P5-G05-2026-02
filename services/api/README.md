# API do SGEI

Backend NestJS com autenticação, sessões com rotação de refresh token, perfis, isolamento por instituição, registros acadêmicos, faturas e auditoria. A análise de evasão operacional permanece condicionada à validação institucional do modelo.

## Requisitos

- Node.js 24 e npm 11
- PostgreSQL 16, ou Docker Compose para o ambiente local

## Configuração local

1. Copie `.env.example` para `.env` e substitua a senha do banco e `JWT_SECRET` por valores locais seguros. Para executar a API fora do Docker, troque `db` por `localhost` em `DATABASE_URL`.
2. Execute `npm ci` e `npm run db:generate` nesta pasta.
3. Inicie o PostgreSQL e aplique `npm run db:migrate`.
4. Execute `npm run build` e `npm run start:prod` (ou `npm run start:dev`).

Na raiz do repositório, `docker compose up --build` inicia PostgreSQL, aplica as migrações, cria as cinco contas demonstrativas e sobe a API. Defina `POSTGRES_USER`, `POSTGRES_PASSWORD` (não vazia), `POSTGRES_DB` e `DATABASE_URL` com host `db` em `services/api/.env`. As cinco senhas `DEMO_<PERFIL>_PASSWORD` distintas ficam em `services/api/.env.seed`, lido apenas pela seed; consulte `.env.seed.example`. O `.env` antigo com essas variáveis ainda é aceito para migração. Para gerar os arquivos locais, use `node dev-up.mjs`. Uma URL com `localhost` serve apenas para executar a API fora do Docker. A porta do banco fica ligada somente a `127.0.0.1` para desenvolvimento.

## Primeira conta de coordenação

Em uma instituição fora da carga local, após a migração, defina `BOOTSTRAP_INSTITUICAO_ID` (UUID), `BOOTSTRAP_INSTITUICAO_NOME`, `BOOTSTRAP_COORDENACAO_EMAIL`, `BOOTSTRAP_COORDENACAO_NOME` e `BOOTSTRAP_COORDENACAO_PASSWORD` (mínimo 12 caracteres) no ambiente do comando. Execute `npm run bootstrap` após o build. O script recusa recriar a mesma conta e não imprime a senha.

## Contas demonstrativas por perfil

As migrations criam a estrutura do banco. A carga local usa `seed-dev`, após `migrate` e antes da API, sem senhas em SQL versionado. Cria contas de COORDENACAO, SECRETARIA, PROFESSOR, TUTOR e ALUNO na Fatec Franca. A carga é idempotente: preserva senhas de contas existentes e falha se um e-mail já tiver outro perfil. Recusa `NODE_ENV=production`. A migração converte contas legadas de ADMIN para COORDENACAO e de FINANCEIRO para SECRETARIA, sem excluir contas.

| Perfil | E-mail fictício |
| --- | --- |
| COORDENACAO | `coordenacao.demo@sgei.example` |
| SECRETARIA | `secretaria.demo@sgei.example` |
| PROFESSOR | `professor.demo@sgei.example` |
| TUTOR | `tutor.demo@sgei.example` |
| ALUNO | `aluno.demo@sgei.example` |

Selecione Fatec Franca (109) no login do mobile. Os vínculos acadêmicos e perfis de ML podem ser criados pela seed documentada em [ML por matrícula](../../docs/ml-matriculas.md).

## Contrato inicial

| Rota | Acesso | Uso |
| --- | --- | --- |
| `GET /auth/health` | público | verificação de disponibilidade do banco |
| `POST /auth/login` | público | recebe `instituicaoId`, `email`, `senha`; devolve access e refresh token |
| `POST /auth/refresh` | público | recebe `refreshToken`; rotaciona a sessão |
| `POST /auth/logout` | público | recebe `refreshToken`; revoga a sessão |
| `GET /auth/me` | autenticado | devolve identificador, instituição e perfil atuais |
| `GET /usuarios` | COORDENACAO, SECRETARIA e perfis acadêmicos vinculados | lista usuários permitidos da própria instituição |
| `GET /usuarios/:id` | COORDENACAO, SECRETARIA e perfis acadêmicos vinculados | consulta usuário permitido da própria instituição |
| `POST /usuarios` | COORDENACAO ou SECRETARIA | cria usuário na própria instituição; SECRETARIA cria somente ALUNO |
| `POST /matriculas` | COORDENACAO ou SECRETARIA | matricula aluno em turma da própria instituição |
| `PUT /faturas/matriculas/:id/plano`, `POST /faturas`, `POST /faturas/:id/pagamentos` | COORDENACAO ou SECRETARIA | configura mensalidades e registra pagamentos confirmados |
| `GET /faturas/matriculas/:id` | COORDENACAO, SECRETARIA ou próprio ALUNO | consulta faturas e saldos |
| `PUT /bolsas/matriculas/:id`, `GET /bolsas/matriculas/:id` | COORDENACAO ou SECRETARIA; GET também para o próprio ALUNO | configura e consulta a vigência da bolsa |
| `GET /ml/matriculas/:id/atributos/historico` | COORDENACAO | consulta alterações por atributo com origem, versão e instante, em páginas |
| `GET/PUT /ml/matriculas/:id/semestres/:numero` | COORDENACAO ou SECRETARIA | consulta e homologa os seis indicadores de cada semestre |
| `GET/PUT /ml/matriculas/:id/coorte-macro` | COORDENACAO ou SECRETARIA | vincula a matrícula ao país e ano dos indicadores macroeconômicos |
| `GET/PUT /ml/fontes/macro/:pais/:ano` | GET COORDENACAO/SECRETARIA; PUT COORDENACAO | publica e consulta indicadores com referência da fonte |
| `GET /ml/status` | COORDENACAO | informa se o serviço interno e um modelo aprovado estão disponíveis |
| `POST /ml/preview` | COORDENACAO, com `ML_PREVIEW_ENABLED=true` | testa uma inferência com os 36 atributos numéricos completos, sem vínculo acadêmico ou persistência |

Use `Authorization: Bearer <accessToken>` nas rotas protegidas. O servidor resolve o perfil e a instituição a partir da sessão no banco; campos enviados pelo cliente não alteram o escopo. Respostas de usuários não incluem `senhaHash`.

O cliente interno de ML é configurado por `ML_SERVICE_URL`, `ML_SERVICE_TOKEN` e `ML_CLIENT_TIMEOUT_MS`. Ele envia apenas o contrato de 36 atributos, usa timeout e rejeita respostas incompatíveis. A prévia exige `ML_PREVIEW_ENABLED=true` e aceita `{ "features": { ... } }` com todas as 36 colunas de entrada; use somente dados sintéticos ou de teste. Consulte `services/ml/README.md` para treino, aprovação e limites atuais. A análise persistida por matrícula está disponível em `POST /ml/matriculas/:id/analisar`; consulte [contrato e seed](../../docs/ml-matriculas.md).

## Verificação

`npm run db:validate`, `npm run typecheck`, `npm run lint`, `npm test -- --runInBand` e `npm run build`.

A migração SQL inicial está em `prisma/migrations/20261020000000_init`. A aplicação da migração e os testes com banco real dependem de um PostgreSQL em execução.
