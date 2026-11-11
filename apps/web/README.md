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
- Navegação e página inicial próprias para coordenação, secretaria, professor, tutor e estudante. URLs de outras áreas mostram falta de acesso, além da autorização aplicada pela API.
- Coordenação vê indicadores da instituição, turmas, pessoas e modelo; secretaria consulta a estrutura acadêmica e pessoas.
- Professor acessa chamada, notas e atividades das turmas vinculadas, com lançamento de frequência e notas nas turmas abertas. Tutor consulta esses registros sem ações de lançamento.
- Estudante vê apenas os próprios indicadores, notas publicadas, presenças e entregas, além de atividades e materiais de suas turmas.
- Coordenação baixa o modelo Excel, envia a planilha `.xlsx` de até 1 MB em **Cenários** e consulta o resultado por linha e as importações recentes. O backend valida os dados e pode criar alunos e matrículas ausentes.
- Coordenação consulta a tela **Modelo**, com estado da inferência, métricas de validação e calibração externa do artefato ativo, matriz de confusão, desempenho por classe, proveniência e distribuição das previsões recentes.
- Estados de carregamento, erro e vazio; layout adaptado para celular e desktop.

O protótipo usa dados da API para informações acadêmicas e previsões recentes. A tela Modelo usa os relatórios versionados de `back/prototype:services/ml/candidates/externo-lr-sem-enrolled-v1.json` e `externo-lr-sem-enrolled-v1.calibration.json` para as métricas externas e só os exibe quando a API confirma essa versão como ativa. A calibração institucional permanece pendente; a soma das probabilidades dos estudantes não deve ser apresentada como evasão esperada. A autorização final é sempre aplicada pelo backend. A sessão web fica em memória; recarregar a página exige novo login. Funcionalidades avançadas do aplicativo, como mensagens, importação em lote de pessoas, faturamento, gestão completa de vínculos, envio de atividades e edição de dados de ML, ainda dependem de implementação web específica.

## Verificar

```powershell
npm test
npm run build
npm audit --audit-level=high
```
