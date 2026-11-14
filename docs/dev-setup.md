# Dados locais de desenvolvimento

Execute `node dev-up.mjs` na raiz da branch `back/prototype`. É necessário ter Node.js e Docker Compose disponíveis. O script cria `services/api/.env`, `services/api/.env.seed` e `services/ml/.env` somente quando faltarem, com segredos aleatórios não versionados. O arquivo `.env.seed` é lido apenas pelo job de carga; a API não recebe as senhas de demonstração. Arquivos `.env` antigos com as cinco variáveis `DEMO_<PERFIL>_PASSWORD` continuam aceitos. Com os arquivos configurados, `docker compose up --build` executa a mesma carga. A carga recusa `NODE_ENV=production` e endereços de banco fora do serviço Docker `db`.

O Compose executa, em ordem: PostgreSQL saudável, `prisma migrate deploy`, carga de desenvolvimento concluída e API. O comando usa um projeto Compose próprio para cada caminho de checkout, sem tocar no volume de outro checkout. O serviço de ML não é iniciado por esse comando; seu modelo só deve ser executado após aprovação.

## Cenário de teste

As migrações mantêm as Fatecs **Franca – Dr. Thomaz Novelino (109)**, **São Paulo (002)**, **Campinas (276)** e **Ribeirão Preto (284)**. A carga de desenvolvimento cria cinco contas, uma por perfil, na Fatec Franca: um aluno matriculado, turma e disciplina demonstrativas, vínculos de professor e tutor, chamada e avaliação com nota. Os valores são fictícios e identificados como demonstração; não são resultados de ML.

Veja os cinco logins em [USUARIOS_TESTE.md](../USUARIOS_TESTE.md).

Cada perfil usa a senha da variável `DEMO_<PERFIL>_PASSWORD` em `services/api/.env.seed` (ou no `.env` legado). A autenticação também requer a Fatec correspondente.

A carga é repetível: reutiliza registros pelos códigos e chaves naturais, preserva senhas, notas, presenças e outros campos já editados e falha se encontrar perfil ou matrícula incompatível. Não elimina dados preexistentes, inclusive contas de cargas anteriores.

## Encerramento e limpeza

- `node dev-up.mjs down`: encerra containers, preserva o volume PostgreSQL e os uploads.
- `node dev-up.mjs reset --yes`: remove os volumes **desse checkout**, incluindo banco e uploads. Use apenas quando quiser perder todos os dados locais desse ambiente.

Para iniciar o mobile, use o checkout `mobile/prototype` e a configuração de API adequada à plataforma. O script acima prepara apenas o backend Docker.
