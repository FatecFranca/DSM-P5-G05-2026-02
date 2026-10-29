# Dados locais de desenvolvimento

Execute `node dev-up.mjs` na raiz da branch `back/prototype`. É necessário ter Node.js e Docker Compose disponíveis. O script cria `services/api/.env` e `services/ml/.env` somente se estiverem ausentes, com segredos aleatórios não versionados. Se `services/api/.env` já existir, configure senhas distintas de pelo menos 12 caracteres nas variáveis `DEMO_ADMIN_PASSWORD`, `DEMO_COORDENACAO_PASSWORD`, `DEMO_PROFESSOR_PASSWORD`, `DEMO_TUTOR_PASSWORD` e `DEMO_ALUNO_PASSWORD`. A carga recusa `NODE_ENV=production` e endereços de banco fora do serviço Docker `db`.

O Compose executa, em ordem: PostgreSQL saudável, `prisma migrate deploy`, carga de desenvolvimento concluída e API. O comando usa um projeto Compose próprio para cada caminho de checkout, sem tocar no volume de outro checkout. O serviço de ML não é iniciado por esse comando; seu modelo só deve ser executado após aprovação.

## Cenário de teste

As migrações mantêm as Fatecs **Franca – Dr. Thomaz Novelino (109)**, **São Paulo (002)**, **Campinas (276)** e **Ribeirão Preto (284)**. A carga usa essas unidades existentes. Ela cria seis contas na Fatec Franca e três nas demais: 15 contas no total, cinco alunos matriculados, uma turma e disciplina demonstrativas por Fatec, vínculos de professor e tutor, uma chamada e uma avaliação com nota por aluno. Os valores são fictícios e identificados como demonstração; não são resultados de ML.

| Fatec | Administrador | Coordenação | Professor | Tutor | Aluno |
| --- | --- | --- | --- | --- | --- |
| Franca (109) | `admin.demo@sgei.example` | `coordenacao.demo@sgei.example` | `professor.demo@sgei.example` | `tutor.demo@sgei.example` | `aluno.demo@sgei.example`, `aluno2.franca@sgei.example` |
| São Paulo (002) | — | — | `professor.002@sgei.example` | `tutor.002@sgei.example` | `aluno.002@sgei.example` |
| Campinas (276) | — | — | `professor.276@sgei.example` | `tutor.276@sgei.example` | `aluno.276@sgei.example` |
| Ribeirão Preto (284) | — | — | `professor.284@sgei.example` | `tutor.284@sgei.example` | `aluno.284@sgei.example` |

Cada perfil usa a senha da variável `DEMO_<PERFIL>_PASSWORD` em `services/api/.env`. A autenticação também requer a Fatec correspondente.

A carga é repetível: reutiliza registros pelos códigos e chaves naturais, preserva senhas, notas, presenças e outros campos já editados e falha se encontrar perfil ou matrícula incompatível. Não elimina dados preexistentes.

## Encerramento e limpeza

- `node dev-up.mjs down`: encerra containers, preserva o volume PostgreSQL e os uploads.
- `node dev-up.mjs reset --yes`: remove os volumes **desse checkout**, incluindo banco e uploads. Use apenas quando quiser perder todos os dados locais desse ambiente.

Para iniciar o mobile, use o checkout `mobile/prototype` e a configuração de API adequada à plataforma. O script acima prepara apenas o backend Docker.
