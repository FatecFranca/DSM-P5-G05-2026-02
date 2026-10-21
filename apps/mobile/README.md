# SGEI Mobile

Aplicativo Expo SDK 58 para Android, iOS e web. Login real abre a área acadêmica conectada à API NestJS, com turmas, matrículas, frequência, notas, atividades, entregas e materiais. O aplicativo não chama o serviço FastAPI.

## Executar

Use Node.js 22.13 ou superior. Em `apps/mobile`, execute `npm ci` e `npx expo start`. Configure `EXPO_PUBLIC_API_URL` em `.env` para alcançar o backend: o padrão é `http://10.0.2.2:3000` no emulador Android e `http://localhost:3000` no simulador iOS e na web. Em aparelho físico, use um endereço HTTPS acessível ao aparelho. A URL é pública no bundle; não coloque credenciais nela.

Para criar contas demonstrativas dos cinco perfis no Docker, siga `services/api/README.md`. O login exige UUID da instituição, e-mail e senha configurados na carga. Tokens de refresh ficam no SecureStore em Android/iOS e apenas em memória na web.

Em desenvolvimento, a tela de login oferece acesso local aos perfis Admin, Professor e Aluno sem depender da API. Esse seletor não aparece em builds de produção. O modo local não cria token, não consulta usuários reais e não persiste alterações acadêmicas.

## Navegação e dados

No login real, `/workspace` utiliza exclusivamente dados do backend. Admin gerencia estrutura e vínculos; professor lança dados das disciplinas em que está lotado; aluno consulta os próprios registros e envia entregas; coordenação e tutor consultam os dados autorizados. Formulários filtram campos e ações antes de enviar. O servidor autentica e autoriza novamente todas as operações. Documentos são enviados e baixados com autenticação.

As telas abaixo pertencem somente ao modo demonstrativo:

- Admin e Coordenação: Dashboard, Estudantes, Turmas, Simulações e Métricas. Os filtros, gráficos e detalhes existentes usam `src/demo/data.ts`.
- Professor: painel, turmas vinculadas, chamada por aula, avaliações e notas, atividades e correções, materiais. Tutor pode consultar o fluxo, sem editar.
- Aluno: painel individual, disciplinas, notas publicadas, frequência, atividades, entregas, materiais, calendário e avisos locais. O aluno não vê indicadores individuais de evasão.
- As rotas `/professor`, `/student` e administrativas redirecionam perfis sem acesso. As ações demonstrativas também conferem perfil e vínculo no estado local.
- A fonte acadêmica compartilhada fica em `src/demo/academic.ts` e `src/demo/academic-store.tsx`. As alterações vivem apenas em memória até reiniciar o aplicativo. O seletor de documentos guarda somente o nome do arquivo; não há upload ou download real.
- A média de notas do demo usa pesos ilustrativos e escala 0–10. Frequência e justificativas não inferem limite nem regra institucional. As regras definitivas virão da API.

## Verificação

`npm run typecheck`, `npm run lint`, `npm test` e `npx expo export --platform web`.

## Contrato e limites

Consulte `../../docs/academic-api.md` para rotas, permissões, regras e pendências. Na web, adicione `http://localhost:8081` às origens permitidas da API. O refresh token web fica somente em memória, portanto recarregar a página exige novo login. As rotas protegidas não montam as telas acadêmicas sem sessão e não exibem dados demonstrativos em uma sessão real.

Calendário e Avisos da área real consultam a API, com filtros por disciplina e paginação. O calendário mostra aulas, avaliações e prazos; os avisos mostram publicações e correções autorizadas. Histórico de notificações, marcação de leitura/push, eventos institucionais independentes e análises ML individuais ainda não integram a área real. Testes em dispositivo físico continuam necessários para arquivos e ciclo de vida nativo.
