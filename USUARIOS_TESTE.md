# Logins de teste

São **sete contas**, uma por perfil, criadas pela carga de desenvolvimento `node dev-up.mjs`. No aplicativo, selecione **Fatec Franca – Dr. Thomaz Novelino (109)** para todas elas.

| Perfil | Usuário | E-mail de login | Senha local |
| --- | --- | --- | --- |
| ADMIN | Administração Demo | `admin.demo@sgei.example` | `DEMO_ADMIN_PASSWORD` |
| COORDENACAO | Coordenação Demo | `coordenacao.demo@sgei.example` | `DEMO_COORDENACAO_PASSWORD` |
| SECRETARIA | Secretaria Demo | `secretaria.demo@sgei.example` | `DEMO_SECRETARIA_PASSWORD` |
| FINANCEIRO | Financeiro Demo | `financeiro.demo@sgei.example` | `DEMO_FINANCEIRO_PASSWORD` |
| PROFESSOR | Professor Demo | `professor.demo@sgei.example` | `DEMO_PROFESSOR_PASSWORD` |
| TUTOR | Tutor Demo | `tutor.demo@sgei.example` | `DEMO_TUTOR_PASSWORD` |
| ALUNO | Estudante Demo 1 | `aluno.demo@sgei.example` | `DEMO_ALUNO_PASSWORD` |

O valor de cada senha está na variável indicada em `services/api/.env`, criado localmente pelo script e ignorado pelo Git. O login exige **instituição, e-mail e senha**. A senha de uma conta que já existia é preservada pela carga; se ela tiver sido alterada no banco, o valor atual do `.env` pode não coincidir.

Para preparar essas contas em um banco novo, execute `node dev-up.mjs` na raiz da branch `back/prototype`. A carga recusa produção. Ela não apaga usuários preexistentes. Veja [docs/dev-setup.md](docs/dev-setup.md) para os requisitos do ambiente.
