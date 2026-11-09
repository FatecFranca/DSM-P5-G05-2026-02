# SGEI Web

Protótipo web responsivo em React, TypeScript e Vite, baseado no fluxo conectado do aplicativo Expo. Usa a API NestJS da branch `back/prototype`; não chama diretamente o serviço de ML.

## Executar

Requer Node.js 22.12+ e uma API local em `http://localhost:3000`. Para iniciar a API e o banco de dados em outro checkout, siga [Iniciar a versão web](../../README.md#iniciar-a-versão-web) no README da raiz.

```powershell
cd apps/web
npm ci
npm run dev
```

Abra `http://localhost:8082`. O servidor de desenvolvimento encaminha `/api` à API local. A tela de login lista as instituições da API; use uma conta criada pela carga de desenvolvimento do backend. Para produção, configure um proxy HTTPS de mesma origem para `/api` ou defina `VITE_API_URL` com a URL pública da API e inclua a origem web na configuração CORS do backend. Essa variável é pública no bundle e não deve conter credenciais.

## Funcionalidades

- Login por instituição e perfil, atualização de token em memória, logout e troca de senha.
- Painel, turmas, disciplinas, frequência, notas, atividades, materiais e diretório de pessoas conforme o perfil.
- Docente lança frequência e notas nas turmas abertas; coordenação cria turmas.
- Secretaria consulta turmas e pessoas pelos endpoints permitidos para seu perfil.
- Estados de carregamento, erro e vazio; layout adaptado para celular e desktop.

O protótipo usa somente dados da API. A autorização final é sempre aplicada pelo backend. A sessão web fica em memória; recarregar a página exige novo login. Funcionalidades avançadas do aplicativo, como mensagens, importação de planilhas, faturamento, gestão completa de vínculos, envio de atividades e telas de ML, ainda dependem de implementação web específica.

## Verificar

```powershell
npm test
npm run build
npm audit --audit-level=high
```
