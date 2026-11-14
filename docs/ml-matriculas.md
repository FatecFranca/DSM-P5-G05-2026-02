# ML integrado às matrículas

Desenvolvimento: `back/prototype` contém API, banco, ML e infraestrutura; `mobile/prototype` contém o aplicativo. `main` é preservada. Não criar branches de integração separadas.

## Fluxo

1. Entrar no mobile com autenticação da API, selecionar a turma e abrir **ML**.
2. Selecionar uma matrícula. O backend lê seu `PerfilMl` no PostgreSQL.
3. Se faltarem atributos, a tela informa a quantidade pendente. A coordenação preenche os 36 atributos pela planilha Excel.
4. Para matrículas reais, **Verificar disponibilidade** retorna `INSUFICIENTE` até a validação institucional. COORDENACAO pode calcular uma prévia técnica dos atributos completos.
5. A coordenação importa uma planilha Excel com aluno, turma, disciplina, professor e atributos. A API valida os vínculos existentes, cria usuário e matrícula quando necessários, salva o perfil e calcula a previsão experimental. A resposta contém P(Dropout) e P(Graduate), sem P(Enrolled). Alterar o perfil marca a previsão importada como histórica; se a matrícula já foi importada e continua com todos os atributos válidos, o serviço cria um novo recálculo experimental em segundo plano, sem sobrescrever o resultado anterior.

O modelo não é retreinado com dados do banco. A coluna `classe` nunca é enviada. Não há resultado predefinido no mobile nem preenchimento automático de atributos ausentes.

No aplicativo conectado, `ALUNO` declara dados de ingresso e consulta suas faturas; `SECRETARIA` cadastra alunos e matrículas, homologa dados acadêmicos e opera planos mensais, faturas, pagamentos e bolsas; `COORDENACAO` acessa esses fluxos, publica indicadores macroeconômicos e importa o Excel para prévias experimentais. A API verifica novamente cada permissão e o vínculo institucional.

**Estado atual da integração operacional:** o `.pkl` binário está marcado `CANDIDATE`; sua procedência e métricas não foram verificadas nesta aplicação. A API não calcula previsões para matrículas reais; responde `INSUFICIENTE` e informa a falta de validação da população institucional, equivalência de categorias e revisão de vieses. O fluxo técnico de prévia continua separado. O aluno pode declarar sua idade no ingresso e turno em linguagem comum; o mapeamento versionado `uci-portugal-v1` acontece no backend. Registros históricos com a origem `fatec-v1` permanecem identificados para rastreabilidade. Agregados semestrais vêm do resumo homologado; indicadores macroeconômicos vêm de publicação institucional com país e ano. Nenhum dos dois é inferido de notas, frequência ou valores presumidos.

**Automação demonstrativa inicial:** faturas mensais e pagamentos atualizam `devedor` e `mensalidade_em_dia`, invalidando o resultado anterior. Com `ML_PREVIEW_ENABLED=true`, um processamento em segundo plano recalcula automaticamente perfis sintéticos completos com o `.pkl` ativo, inclusive quando a versão do modelo muda. O resultado aparece identificado como demonstração apenas para profissionais autorizados. Consulte [automação financeira](automacao-financeira.md). Esse fluxo não libera previsão operacional para alunos reais.

**Recálculo experimental após importação:** a primeira importação pela COORDENACAO habilita o acompanhamento técnico daquela matrícula. Uma rotina de 60 segundos consulta perfis completos e válidos, compara versão do perfil e do `.pkl` e salva uma nova previsão imutável na tabela `previsao_automatica_ml` quando houver mudança. Cada registro contém snapshot dos atributos, versão e instante, e aparece somente em `GET /ml/previsoes-automaticas` para COORDENACAO da mesma instituição. Perfis incompletos aguardam novos dados. O processo não muda pesos, não disponibiliza o escore ao aluno e não substitui validação institucional.

## Rotas

| Rota | Contrato |
| --- | --- |
| `GET /ml/matriculas/:id` | Matrícula, nome, registro, origem, faltantes, versão e última previsão; atributos apenas para COORDENACAO |
| `GET /ml/matriculas/:id/atributos/historico?pagina=1&tamanho=50` | COORDENACAO: eventos de mudança por atributo, origem, autor, versão e instante; `tamanho` até 100 |
| `GET/PUT /ml/matriculas/:id/semestres/:numero` | COORDENACAO/SECRETARIA: resumo homologado do 1º ou 2º semestre, com seis indicadores e `fonteRef`; PUT usa `versao` para evitar sobrescrita concorrente |
| `GET/PUT /ml/matriculas/:id/coorte-macro` | COORDENACAO/SECRETARIA: país e ano de referência da matrícula; reconcilia os três indicadores se houver fonte publicada |
| `GET/PUT /ml/fontes/macro/:pais/:ano` | GET COORDENACAO/SECRETARIA, PUT COORDENACAO: desemprego, inflação, PIB e `fonteUrl` HTTPS; publicação marca a coorte para reconciliação automática |
| `GET/POST /ml/fontes/importacoes/semestres[/modelo]` | COORDENACAO/SECRETARIA: baixar modelo XLSX ou importar até 100 resumos semestrais com `fonteRef`; atualiza o perfil e evita repetição idêntica |
| `GET/POST /ml/fontes/importacoes/macro[/modelo]` | COORDENACAO: baixar modelo XLSX ou importar até 100 indicadores por país/ano com `fonteUrl` HTTPS; reconcilia as coortes vinculadas |
| `PUT /ml/matriculas/:id` | `{ versao, features }`; substitui os atributos, aceita cadastro parcial, rejeita códigos/escalas inválidos e conflitos de versão (409) |
| `POST /ml/matriculas/:id/analisar` | Sem atributos no corpo; retorna `CALCULADO` ou `INSUFICIENTE`; indisponibilidade do serviço retorna 503 sem gravar sucesso |
| `GET/PUT /ml/matriculas/:id/declaracao-ingresso` | ALUNO: declara ou corrige dados pessoais em linguagem comum; versão otimista e fila de conferência |
| `GET/PUT /ml/matriculas/:id/ingresso` | COORDENACAO/SECRETARIA: homologa os códigos de ingresso e registra a referência da fonte; atualiza os atributos e limpa a pendência da declaração |
| `GET /ml/ingressos/pendentes` | COORDENACAO/SECRETARIA: até 50 declarações pendentes da própria instituição, ordenadas pela data de atualização |
| `GET /ml/ingressos/matriculas?registro=...` | COORDENACAO/SECRETARIA: busca até 20 matrículas por prefixo de registro, com no mínimo dois caracteres |
| `GET /ml/importacoes/modelo` | COORDENACAO: gera Excel com identidade, turma, disciplina, professor, 36 atributos e instruções |
| `POST /ml/importacoes` | COORDENACAO: envia XLSX multipart (`arquivo`), até 1 MB e 100 matrículas; valida turma, disciplina e lotação docente existentes, cria aluno/matrícula quando necessário e calcula a previsão experimental; retorna contagens e erros por linha |
| `GET /ml/importacoes` | COORDENACAO: últimas 50 previsões importadas, com probabilidade, versão e indicador `atual` |
| `GET /ml/previsoes-automaticas` | COORDENACAO: últimos 50 recálculos experimentais após importação, com versão do perfil, probabilidade e indicador `atual` |

COORDENACAO acessam a instituição; PROFESSOR/TUTOR consultam somente alunos vinculados. ALUNO não acessa risco nem atributos. Autenticação, instituição e vínculos são verificados no servidor. A inferência operacional permanece bloqueada pela elegibilidade do modelo; a prévia técnica depende de `ML_PREVIEW_ENABLED`.

Na aba `Importacao`, cada linha contém `registro`, `alunoNome`, `alunoEmail`, `turmaNome`, `turmaCurso`, `turmaPeriodo`, `disciplinaNome`, `professorEmail`, `versaoPerfil` e os 36 campos do contrato na ordem do `.pkl`, em escala original. Turma, disciplina e professor precisam existir na instituição; o professor deve estar lotado na disciplina. A matrícula na turma expõe ao aluno os trabalhos já publicados nas disciplinas dessa turma. `versaoPerfil` é 0 para perfil novo ou a versão atual indicada no cadastro. Alunos novos recebem a senha temporária `Fatec@123` e só acessam dados acadêmicos após trocá-la. Reenviar o mesmo arquivo com o mesmo perfil e modelo não duplica a previsão. Se a gravação da previsão falhar depois da criação da matrícula ou atualização do perfil, o mesmo arquivo pode ser reenviado para concluir a linha. A importação rejeita códigos que o `OneHotEncoder` do `.pkl` não aprendeu. Indicadores já homologados por faturas, bolsas, semestres, macroeconomia ou ingresso não podem ser contraditos pela planilha.

O `.pkl` é o único artefato aceito pelo carregador em execução. O candidato treinado anteriormente permanece apenas como histórico de treinamento; ele não é escolhido pela API. Somente o `.pkl` ativo foi liberado para versionamento a fim de reproduzir a demonstração; o serviço continua exigindo o SHA-256 do manifesto antes de carregá-lo.

## Dados e seed

Após configurar as cinco senhas e, para esta carga opcional, `DEMO_INSTITUICAO_ID` e `DEMO_INSTITUICAO_NOME` em `services/api/.env.seed`, na branch backend:

```powershell
docker compose up -d --build api ml
docker compose run --rm --env-from-file services/api/.env.seed -e DEMO_SEED_ENABLED=true migrate npm run db:seed:ml
```

A seed recusa produção e cria dois alunos identificados como demonstração, turma **ML — Demonstração integrada**, matrículas `ML-DEMO-1` e `ML-DEMO-2`, 12 disciplinas/avaliações, notas, vínculos do professor/tutor demo e os 36 atributos completos. Não altera cadastros preexistentes nem restaura perfis já editados. Os valores são criados para desenvolvimento, autorizados pelo usuário; as previsões são sempre calculadas pelo modelo, nunca simuladas. Os alunos usam a senha configurada em `DEMO_ALUNO_PASSWORD` e os e-mails `ml.estudante1@sgei.example` e `ml.estudante2@sgei.example`.

Os perfis representam um recorte dos dois primeiros semestres concluídos. Os agregados acadêmicos são cadastrados no perfil de ML: não se deve interpretar a média geral de uma turma como a média de um semestre do dataset. Notas lançadas nas telas acadêmicas não recalculam esse recorte automaticamente; atualizar o perfil quando seus agregados mudarem. Cadastros sem perfil permanecem com dados insuficientes.

Escalas: ingresso 0–200; médias das unidades curriculares aprovadas 0–20; contagens inteiras não negativas. Códigos categóricos pertencem ao dataset e não são IDs locais. Macroeconomia exige valores compatíveis com país/período da fonte. O schema expõe os códigos aceitos. O modelo não está calibrado para decisões institucionais; os escores são estimativas e não consequências automáticas para o aluno.

## Verificação

`npm test -- --runInBand`, `npm run lint`, `npm run typecheck`, `npm run build` na API. Com os serviços locais ativos, `$env:TEST_ML='true'; npm run test:integration:academic` verifica a prévia técnica real, o bloqueio da previsão operacional, isolamento institucional, autorização, campos ausentes e invalidação após edição, usando registros temporários nas Fatecs Franca e São Paulo, removidos ao final.

Com o PostgreSQL local migrado, `$env:TEST_AUTO_ML='true'; npm run test:integration:auto-ml` verifica seleção de perfis previamente importados, histórico por versão, deduplicação e suspensão do cálculo quando faltam atributos. O teste usa um cliente ML controlado e remove seus registros temporários; a inferência real do `.pkl` é coberta pelos testes do serviço ML e pelo fluxo de importação.
