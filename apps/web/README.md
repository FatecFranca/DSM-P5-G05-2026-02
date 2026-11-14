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
- Coordenação vê indicadores da instituição, cria turmas, monta disciplinas e vínculos, fecha ou reabre períodos e gerencia contas. Secretaria pode abrir os participantes da turma e matricular estudantes conforme as permissões da API.
- A área Pessoas permite cadastro, edição, redefinição de senha, ativação de contas e importação em lote com conferência prévia. Senhas temporárias aparecem uma vez e podem ser salvas em CSV.
- Professor registra aulas, avaliações, notas, atividades e materiais nas turmas abertas, além de corrigir entregas. Tutor consulta os registros autorizados sem ações de lançamento.
- Estudante vê os próprios indicadores, notas publicadas e presenças, envia atividades e consulta o retorno do professor. Turmas incluem calendário e avisos da API.
- Coordenação, professor e tutor consultam a prontidão e o resultado da análise por matrícula e podem solicitar o cálculo conforme a autorização da API.
- Coordenação baixa o modelo Excel, envia a planilha `.xlsx` de até 1 MB em **Cenários** e consulta o resultado por linha e as importações recentes. O backend valida os dados e pode criar alunos e matrículas ausentes.
- Coordenação consulta a tela **Modelo**, com estado da inferência, métricas de validação e calibração externa do artefato ativo, matriz de confusão, desempenho por classe, proveniência e distribuição das previsões recentes.
- Estados de carregamento, erro e vazio; layout adaptado para celular e desktop.
- Financeiro para coordenação e secretaria: busca por matrícula, filtros de faturas, plano mensal, emissão avulsa, pagamentos com referência de comprovante, bolsas e duração do curso. Estudantes consultam suas mensalidades e podem solicitar pagamento simulado, sujeito à autorização da API.
- Interface de trabalho com navegação discreta, extrato financeiro ao lado da matrícula e formulários acadêmicos recolhidos até serem necessários. A identidade verde-petróleo do SGEI é mantida.

O protótipo usa dados da API para informações acadêmicas e previsões recentes. A tela Modelo usa os relatórios versionados de `back/prototype:services/ml/candidates/externo-lr-sem-enrolled-v1.json` e `externo-lr-sem-enrolled-v1.calibration.json` para as métricas externas e só os exibe quando a API confirma essa versão como ativa. A calibração institucional permanece pendente; a soma das probabilidades dos estudantes não deve ser apresentada como evasão esperada. A autorização final é sempre aplicada pelo backend. A sessão web fica em memória; recarregar a página exige novo login. Mensagens e os formulários de autodeclaração e homologação dos dados de ML ainda não integram a web.

## Verificar

```powershell
npm test
npm run build
npm audit --audit-level=high
```
