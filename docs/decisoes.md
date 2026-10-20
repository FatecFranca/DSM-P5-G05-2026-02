# Decisões do backend

## Módulo inicial de ML

- O CSV externo fornecido ao projeto foi validado por SHA-256, esquema de 36 atributos e três classes. O candidato de modelo fica fora do Git e não é publicado automaticamente.
- Treinamento offline em Python e inferência FastAPI são processos separados. O serviço interno só carrega um artefato cujo hash foi aprovado por configuração; o NestJS é a única API pública.
- A API expõe somente o estado do módulo a `ADMIN` nesta etapa. Previsão por aluno depende dos cadastros acadêmicos, mapeamento de atributos e autorização por vínculo; retornar uma previsão antes disso criaria resultados enganosos.
- Dados operacionais do PostgreSQL nunca alimentam o treino. A previsão, quando integrada, usará somente atributos disponíveis na data de corte e persistirá versão e origem para auditoria.

## Base inicial

- O primeiro incremento implementa o início do marco 1 da seção 15 de `CONTEXT.md`: infraestrutura local, schema de instituição/usuário/sessão/auditoria e autenticação. Os módulos acadêmicos seguem nos marcos seguintes.
- A API usa NestJS 11 e Prisma 7. O Prisma 8 ainda é release candidate na data desta decisão; o Prisma 7 tem suporte ativo e permite fixar dependências estáveis para a base do sistema.
- O login recebe `instituicaoId` porque o e-mail é único por instituição e ainda não existe sessão. Nas demais rotas, a instituição é derivada da sessão autenticada.
- Access tokens duram 15 minutos e carregam somente IDs de usuário e sessão. A autorização lê o perfil atual do banco. Refresh tokens aleatórios duram 7 dias, têm apenas hash SHA-256 persistido e são rotacionados em transação. A revogação da sessão invalida imediatamente o access token correspondente.
- A criação do primeiro administrador ocorre por comando operacional com variáveis de ambiente, sem rota pública de cadastro institucional.
