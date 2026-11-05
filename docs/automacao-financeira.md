# Automação financeira inicial

Implementação na branch `back/prototype`. O dataset tratado `dados_preprocessados.csv` é referência de pesquisa; a inferência técnica usa o `.pkl` `externo-lr-sem-enrolled-v1`. A rotina financeira atualiza somente os atributos de inferência; dados operacionais nunca entram no treinamento.

O mapa das fontes e gatilhos dos 36 atributos está em [automação dos atributos](automacao-atributos.md).

## Eventos e responsabilidades

| Evento | Origem | Efeito automático |
| --- | --- | --- |
| Configuração da mensalidade | `ADMIN` ou `FINANCEIRO`, uma vez por matrícula ou quando o contrato muda | Define valor, competência inicial/final e dia de vencimento. |
| Geração da fatura mensal | Varredura no início do processo e a cada 15 minutos | Gera as competências pendentes sem duplicação, ajustando dias 29–31 ao último dia do mês. |
| Criação manual de fatura | `ADMIN` ou `FINANCEIRO`, para exceções | Garante uma fatura por matrícula e competência; recalcula os indicadores financeiros. |
| Vencimento | Varredura no início do processo e a cada 15 minutos | Marca a fatura aberta como vencida e recalcula os indicadores financeiros. |
| Registro de pagamento | `ADMIN` ou `FINANCEIRO`, após confirmação financeira externa | Impede pagamento acima do saldo e referência repetida; atualiza o saldo e recalcula os indicadores. |
| Pagamento simulado | Próprio `ALUNO`, somente em sua fatura | Quita o saldo em uma operação fictícia, identifica o lançamento como simulado e atualiza os indicadores. Não há transferência de dinheiro. |

`devedor = 1` e `mensalidade_em_dia = 0` quando existe alguma fatura vencida e não quitada. Caso contrário, os valores são `0` e `1`. O cálculo usa a data civil de `America/Sao_Paulo`. Cada mudança desses atributos incrementa a versão do perfil, invalida a previsão anterior e registra um evento de proveniência `FINANCEIRO` por atributo alterado; atualizações sem mudança no indicador não geram uma nova versão. O histórico financeiro fica nas faturas, pagamentos, eventos de atributos e auditoria.

Se o ADMIN já importou a matrícula para análise experimental e o perfil permanece completo, o worker de ML salva um novo recálculo para a versão atual do perfil. A previsão anterior permanece no histórico. Isso não libera escore operacional para o aluno.

Com faturas registradas, o cadastro manual do perfil de ML preserva esses dois indicadores calculados e rejeita valores conflitantes enviados por `ADMIN` ou `COORDENACAO`.

## API

| Rota | Acesso | Conteúdo |
| --- | --- | --- |
| `PUT /faturas/matriculas/:id/plano` | ADMIN ou FINANCEIRO | `inicioCompetencia`, `fimCompetencia` opcional, `valorCentavos`, `diaVencimento` (1–31), `ativo` |
| `GET /faturas/matriculas/:id/plano` | ADMIN ou FINANCEIRO | Configuração vigente do plano, ou `null` se ausente |
| `GET /faturas/matriculas?registro=...` | ADMIN ou FINANCEIRO | Busca até 20 matrículas da própria instituição por prefixo de registro, com no mínimo dois caracteres |
| `POST /faturas` | ADMIN ou FINANCEIRO | `matriculaId`, `competencia` (`AAAA-MM`), `vencimento` (`AAAA-MM-DD`), `valorCentavos` |
| `POST /faturas/:id/pagamentos` | ADMIN ou FINANCEIRO | `referencia` única da confirmação, `valorCentavos` |
| `POST /faturas/:id/simular-pagamento` | Próprio ALUNO | Quita o saldo de sua fatura em modo simulado; sem corpo |
| `GET /faturas/matriculas/:id/semestres` | ADMIN, FINANCEIRO ou próprio ALUNO | Totais pagos, saldo emitido e situação de cada semestre do curso |
| `PUT /turmas/:id/duracao` | ADMIN | Define `duracaoSemestres` (1–20) antes de configurar cobranças |
| `GET /faturas/matriculas/:id` | ADMIN, FINANCEIRO ou próprio ALUNO | Faturas e saldos, sem previsão de evasão |
| `PUT /bolsas/matriculas/:id` | ADMIN ou FINANCEIRO | `inicio` e `fim` (`AAAA-MM-DD`), `ativa`; atualiza `bolsista` e a versão do perfil |
| `GET /bolsas/matriculas/:id` | ADMIN, FINANCEIRO ou próprio ALUNO | Vigência da bolsa, limitada à própria matrícula para ALUNO |

A instituição é determinada pela sessão, não pelo corpo da requisição. O plano avança a próxima competência em transação; faturas já cadastradas não são recriadas. Cada ciclo processa até 36 competências atrasadas por plano e retoma no próximo ciclo se necessário. Cursos novos têm seis semestres por padrão; ADMIN pode ajustar a duração antes de configurar cobranças. Novos planos terminam até o último mês da duração configurada. Cada fatura gerada guarda o número do semestre e cada pagamento guarda o lançamento correspondente; o resumo por semestre é calculado desses registros. Faturas legadas sem plano podem permanecer sem semestre. Planos existentes não foram encerrados automaticamente pela migração. O botão do aluno gera uma operação **simulada**, sem banco ou cobrança real, somente quando `SIMULATED_PAYMENTS_ENABLED=true`; o Compose local de demonstração habilita essa opção. O perfil `FINANCEIRO` não acessa rotas acadêmicas ou de ML.

A bolsa exige cadastro de vigência por matrícula. Concessão e suspensão atualizam `bolsista` imediatamente; uma varredura no início do processo e a cada 15 minutos ativa e encerra vigências sem intervenção. Sem cadastro de bolsa, o atributo permanece ausente. O cadastro manual do perfil de ML não pode contrariar uma vigência registrada. Não há integração com um provedor externo de bolsas.

## Prévia automática demonstrativa e limite atual

Quando `ML_PREVIEW_ENABLED=true`, o backend verifica a cada minuto perfis elegíveis de demonstração ou importados pelo ADMIN com resultado invalidado. Se os atributos exigidos pelo contrato ativo estiverem completos, calcula e grava uma **prévia experimental** com o `.pkl` ativo. A gravação verifica a versão do perfil para descartar uma previsão feita sobre dados que mudaram durante a inferência. O resultado fica restrito aos profissionais autorizados; o aluno não vê o risco.

A inferência operacional permanece `INSUFICIENTE` para matrículas reais, porque o modelo externo ainda não foi validado para essa população. Resumos acadêmicos, ingresso homologado e indicadores macroeconômicos publicados ou importados atualizam os respectivos atributos. APIs externas específicas dependem da identificação dos provedores e seus contratos. Nenhuma ação adversa ao aluno deve ser tomada apenas por um escore.

## Verificação da etapa

Com PostgreSQL e API locais disponíveis, aplique as migrations da API e execute `npm run build` em `services/api`. Depois rode `TEST_BILLING=true npm run test:integration:billing` (PowerShell: `$env:TEST_BILLING='true'; npm run test:integration:billing`). O teste aceita apenas banco e API em `localhost`/`127.0.0.1`, cria dados temporários próprios e verifica geração mensal idempotente, vencimento, pagamento parcial e integral, atualização do perfil, autenticação e isolamento entre instituições e alunos.

Em 04/11/2026, a migration `20261104010000_billing_events` foi aplicada ao PostgreSQL local e o teste de integração passou. A validação não publica o modelo para matrículas reais.
