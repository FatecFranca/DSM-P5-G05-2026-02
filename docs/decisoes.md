# Decisões do backend

## Módulo inicial de ML

- O CSV externo fornecido ao projeto foi validado por SHA-256, esquema de 36 atributos e três classes. O candidato de modelo fica fora do Git e não é publicado automaticamente.
- Treinamento offline em Python e inferência FastAPI são processos separados. O serviço interno só carrega um artefato cujo hash foi aprovado por configuração; o NestJS é a única API pública.
- A API expõe somente o estado do módulo a `ADMIN` nesta etapa. Previsão por aluno depende dos cadastros acadêmicos, mapeamento de atributos e autorização por vínculo; retornar uma previsão antes disso criaria resultados enganosos.
- Dados operacionais do PostgreSQL nunca alimentam o treino. A previsão, quando integrada, usará somente atributos disponíveis na data de corte e persistirá versão e origem para auditoria.

## Base inicial

- O primeiro incremento implementa o início do marco 1 da seção 15 de `CONTEXT.md`: infraestrutura local, schema de instituição/usuário/sessão/auditoria e autenticação. Os módulos acadêmicos seguem nos marcos seguintes.
- A API usa NestJS 11 e Prisma 7. O Prisma 8 ainda é release candidate na data desta decisão; o Prisma 7 tem suporte ativo e permite fixar dependências estáveis para a base do sistema.
- O NestJS 11.2.7 fixa `multer` 2.4.0; por isso o `package.json` substitui essa dependência transitiva por 2.5.0 e `body-parser` por 2.4.0, versões corrigidas para os avisos de negação de serviço. A remoção dos overrides deve ser reavaliada quando o NestJS for atualizado, com teste de upload e `npm audit --omit=dev`.
- Antes do login, `GET /auth/instituicoes` lista somente `id` e `nome` das instituições ativas. O app permite buscar pelo nome e envia o `instituicaoId` selecionado em `POST /auth/login`, pois o e-mail é único por instituição. Nas demais rotas, a instituição é derivada da sessão autenticada.
- A migração histórica `20261028010000_fatec_directory` cadastrou 84 Fatecs conforme o [diretório oficial do CPS](https://dados.cps.sp.gov.br/onde-estudar-fatecs/). Como ela pode já ter sido aplicada, `20261029010000_limit_fatec_catalog` remove as 80 unidades excedentes sem vínculos e mantém apenas Franca (109), São Paulo (002), Campinas (276) e Ribeirão Preto (284). A migração interrompe a remoção se encontrar dados vinculados.
- Access tokens duram 15 minutos e carregam somente IDs de usuário e sessão. A autorização lê o perfil atual do banco. Refresh tokens aleatórios duram 7 dias, têm apenas hash SHA-256 persistido e são rotacionados em transação. A revogação da sessão invalida imediatamente o access token correspondente.
- A criação do primeiro administrador ocorre por comando operacional com variáveis de ambiente, sem rota pública de cadastro institucional.
