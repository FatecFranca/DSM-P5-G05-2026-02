# ML integrado às matrículas

Desenvolvimento: `back/prototype` contém API, banco, ML e infraestrutura; `mobile/prototype` contém o aplicativo. `main` é preservada. Não criar branches de integração separadas.

## Fluxo

1. Entrar no mobile com autenticação da API, selecionar a turma e abrir **ML**.
2. Selecionar uma matrícula. O backend lê seu `PerfilMl` no PostgreSQL.
3. Se faltarem atributos, a tela lista os campos a cadastrar. ADMIN/COORDENACAO podem salvar o cadastro parcial ou completo.
4. **Calcular previsão** envia somente a matrícula à API. A API busca os 36 atributos persistidos, aplica no serviço ML o pré-processamento fixo do notebook e executa o Random Forest já treinado.
5. Gravar o resultado com versão do modelo, versão do perfil, data e snapshot dos atributos. O mobile apresenta P(Dropout), classe estimada e demais probabilidades. Alterar o perfil invalida a previsão anterior; executar novamente para atualizar.

O modelo não é retreinado com dados do banco. A coluna `classe` nunca é enviada. Não há resultado predefinido no mobile nem preenchimento automático de atributos ausentes.

**Estado atual da integração operacional:** o artefato v2 está marcado `CANDIDATE` e foi avaliado apenas no dataset externo. A API não calcula previsões para matrículas das Fatecs; responde `INSUFICIENTE` e informa a falta de validação local, equivalência de categorias e revisão de vieses. O fluxo técnico de prévia continua separado. O aluno pode declarar sua idade no ingresso e turno em linguagem comum; o mapeamento versionado `fatec-v1` acontece no backend. Os demais atributos, inclusive agregados semestrais e indicadores macroeconômicos, não são inferidos de notas, frequência ou valores presumidos.

## Rotas

| Rota | Contrato |
| --- | --- |
| `GET /ml/matriculas/:id` | Matrícula, nome, registro, origem, faltantes, versão e última previsão; atributos apenas para ADMIN/COORDENACAO |
| `PUT /ml/matriculas/:id` | `{ versao, features }`; substitui os atributos, aceita cadastro parcial, rejeita códigos/escalas inválidos e conflitos de versão (409) |
| `POST /ml/matriculas/:id/analisar` | Sem atributos no corpo; retorna `CALCULADO` ou `INSUFICIENTE`; indisponibilidade do serviço retorna 503 sem gravar sucesso |

ADMIN/COORDENACAO acessam a instituição; PROFESSOR/TUTOR consultam e calculam somente alunos vinculados. ALUNO não acessa risco nem atributos. Autenticação, instituição e vínculos são verificados no servidor. A inferência operacional independe de `ML_PREVIEW_ENABLED`; a prévia técnica permanece opcional e fora do fluxo mobile.

## Dados e seed

Após configurar as variáveis `DEMO_*` em `services/api/.env`, na branch backend:

```powershell
docker compose up -d --build api ml
docker compose run --rm -e DEMO_SEED_ENABLED=true migrate npm run db:seed:ml
```

A seed recusa produção e cria dois alunos identificados como demonstração, turma **ML — Demonstração integrada**, matrículas `ML-DEMO-1` e `ML-DEMO-2`, 12 disciplinas/avaliações, notas, vínculos do professor/tutor demo e os 36 atributos completos. Não altera cadastros preexistentes nem restaura perfis já editados. Os valores são criados para desenvolvimento, autorizados pelo usuário; as previsões são sempre calculadas pelo modelo, nunca simuladas. Os alunos usam a senha configurada em `DEMO_ALUNO_PASSWORD` e os e-mails `ml.estudante1@sgei.example` e `ml.estudante2@sgei.example`.

Os perfis representam um recorte dos dois primeiros semestres concluídos. Os agregados acadêmicos são cadastrados no perfil de ML: não se deve interpretar a média geral de uma turma como a média de um semestre do dataset. Notas lançadas nas telas acadêmicas não recalculam esse recorte automaticamente; atualizar o perfil quando seus agregados mudarem. Cadastros sem perfil permanecem com dados insuficientes.

Escalas: ingresso 0–200; médias das unidades curriculares aprovadas 0–20; contagens inteiras não negativas. Códigos categóricos pertencem ao dataset e não são IDs locais. Macroeconomia exige valores compatíveis com país/período da fonte. O schema expõe os códigos aceitos. O modelo não está calibrado para decisões institucionais; os escores são estimativas e não consequências automáticas para o aluno.

## Verificação

`npm test -- --runInBand`, `npm run lint`, `npm run typecheck`, `npm run build` na API. Com os serviços locais ativos, `$env:TEST_ML='true'; npm run test:integration:academic` verifica inferência real, persistência, isolamento institucional, autorização, campos ausentes e invalidação após edição, usando registros temporários nas Fatecs Franca e São Paulo, removidos ao final.
