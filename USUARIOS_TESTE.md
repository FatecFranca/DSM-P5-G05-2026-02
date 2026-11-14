# Logins de teste

São **cinco contas**, uma por perfil, criadas pela carga de desenvolvimento em `docker compose up` ou `node dev-up.mjs`. No aplicativo, selecione **Fatec Franca – Dr. Thomaz Novelino (109)** para todas elas.

| Perfil | Usuário | E-mail de login | Senha local |
| --- | --- | --- | --- |
| COORDENACAO | Coordenação Demo | `coordenacao.demo@sgei.example` | `DEMO_COORDENACAO_PASSWORD` |
| SECRETARIA | Secretaria Demo | `secretaria.demo@sgei.example` | `DEMO_SECRETARIA_PASSWORD` |
| PROFESSOR | Professor Demo | `professor.demo@sgei.example` | `DEMO_PROFESSOR_PASSWORD` |
| TUTOR | Tutor Demo | `tutor.demo@sgei.example` | `DEMO_TUTOR_PASSWORD` |
| ALUNO | Estudante Demo 1 | `aluno.demo@sgei.example` | `DEMO_ALUNO_PASSWORD` |

O valor de cada senha está na variável indicada em `services/api/.env.seed` (ou em um `.env` legado), criado localmente e ignorado pelo Git. O login exige **instituição, e-mail e senha**. A senha de uma conta que já existia é preservada pela carga; se ela tiver sido alterada no banco, o valor atual do arquivo pode não coincidir.

Para preparar essas contas em um banco novo, execute `node dev-up.mjs` para gerar os `.env` locais e subir o Compose, ou `docker compose up --build` se os arquivos já estiverem configurados. A carga recusa produção e preserva usuários preexistentes. Contas antigas de ADMIN e FINANCEIRO são migradas, respectivamente, para COORDENACAO e SECRETARIA; suas senhas não mudam. Veja [docs/dev-setup.md](docs/dev-setup.md).
