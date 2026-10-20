# SGEI Mobile

Protótipo Expo SDK 58 para Android, iOS e web. Login, sessão e consulta de usuários usam a API NestJS. As telas acadêmicas usam dados fictícios identificados como demonstração. O aplicativo não chama o serviço FastAPI.

## Executar

Use Node.js 22.13 ou superior. Em `apps/mobile`, execute `npm ci` e `npx expo start`. Configure `EXPO_PUBLIC_API_URL` em `.env` para alcançar o backend: o padrão é `http://10.0.2.2:3000` no emulador Android e `http://localhost:3000` no simulador iOS e na web. Em aparelho físico, use um endereço HTTPS acessível ao aparelho. A URL é pública no bundle; não coloque credenciais nela.

Para criar contas demonstrativas dos cinco perfis no Docker, siga `services/api/README.md`. O login exige UUID da instituição, e-mail e senha configurados na carga. Tokens de refresh ficam no SecureStore em Android/iOS e apenas em memória na web.

Em desenvolvimento, a tela de login oferece acesso local aos perfis Admin, Professor e Aluno sem depender da API. Esse seletor não aparece em builds de produção. O modo local não cria token, não consulta usuários reais e não persiste alterações acadêmicas.

## Navegação e dados

- Admin e Coordenação: Dashboard, Estudantes, Turmas, Simulações e Métricas. Os filtros, gráficos e detalhes existentes usam `src/demo/data.ts`.
- Professor: painel, turmas vinculadas, chamada por aula, avaliações e notas, atividades e correções, materiais. Tutor pode consultar o fluxo, sem editar.
- Aluno: painel individual, disciplinas, notas publicadas, frequência, atividades, entregas, materiais, calendário e avisos locais. O aluno não vê indicadores individuais de evasão.
- As rotas `/professor`, `/student` e administrativas redirecionam perfis sem acesso. As ações demonstrativas também conferem perfil e vínculo no estado local.
- A fonte acadêmica compartilhada fica em `src/demo/academic.ts` e `src/demo/academic-store.tsx`. As alterações vivem apenas em memória até reiniciar o aplicativo. O seletor de documentos guarda somente o nome do arquivo; não há upload ou download real.
- A média de notas do demo usa pesos ilustrativos e escala 0–10. Frequência e justificativas não inferem limite nem regra institucional. As regras definitivas virão da API.

## Verificação

`npm run typecheck`, `npm run lint`, `npm test` e `npx expo export --platform web`.

## Integração pendente

O NestJS atual oferece autenticação e usuários, mas ainda não possui endpoints acadêmicos ou de análises. Após definir os contratos no backend, substituir os dados de `src/demo/data.ts` e `src/demo/academic.ts` por serviços autenticados via NestJS. O backend deverá validar papel, instituição, matrícula e vínculo docente em cada operação, além de definir escala, pesos, prazos, auditoria e armazenamento privado dos arquivos. A interface não envia arquivos nem dados acadêmicos à API atual. Nunca chamar o FastAPI diretamente do mobile.
