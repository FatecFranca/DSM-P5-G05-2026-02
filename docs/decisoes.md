# Decisões do backend

## Base inicial

- O primeiro incremento implementa o início do marco 1 da seção 15 de `CONTEXT.md`: infraestrutura local, schema de instituição/usuário/sessão/auditoria e autenticação. Os módulos acadêmicos seguem nos marcos seguintes.
- A API usa NestJS 11 e Prisma 7. O Prisma 8 ainda é release candidate na data desta decisão; o Prisma 7 tem suporte ativo e permite fixar dependências estáveis para a base do sistema.
- O login recebe `instituicaoId` porque o e-mail é único por instituição e ainda não existe sessão. Nas demais rotas, a instituição é derivada da sessão autenticada.
- Access tokens duram 15 minutos e carregam somente IDs de usuário e sessão. A autorização lê o perfil atual do banco. Refresh tokens aleatórios duram 7 dias, têm apenas hash SHA-256 persistido e são rotacionados em transação. A revogação da sessão invalida imediatamente o access token correspondente.
- A criação do primeiro administrador ocorre por comando operacional com variáveis de ambiente, sem rota pública de cadastro institucional.
