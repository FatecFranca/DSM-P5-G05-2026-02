# Serviço interno de ML

O NestJS continua sendo a única API pública. Este serviço FastAPI recebe lotes de **36 atributos numéricos** identificados apenas pelo UUID da matrícula e devolve `Dropout`, `Enrolled` ou `Graduate` com as probabilidades produzidas pelo pipeline. Não consulta o banco acadêmico, não recebe nomes ou e-mails e não executa treinamento durante requisições.

## Treinamento offline

O CSV externo deve ter exatamente as 36 colunas descritas em `CONTEXT.md`, seguidas de `classe`. O dataset selecionado está disponível localmente em `datasets/dados_preprocessados.csv` (4.152 registros; SHA-256 `48b6a0c4417f5f52b5a5d332e2a7e1cfa34b2f62a74fe35d97fb2373a06fe085`). A origem conhecida é o arquivo fornecido para o projeto; a fonte primária e a licença ainda precisam ser documentadas antes de distribuir o dataset. `datasets/` é ignorado pelo Git: mantenha o arquivo no ambiente controlado de treinamento, sem versioná-lo ou incluí-lo na imagem Docker. O comando exige o SHA-256 conferido e rejeita divergências.

```powershell
cd services/ml
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m training.train --dataset datasets/dados_preprocessados.csv --approved-sha256 48b6a0c4417f5f52b5a5d332e2a7e1cfa34b2f62a74fe35d97fb2373a06fe085 --source "CSV fornecido para o projeto SGEI" --version evasao-baseline-v2 --output artifacts/evasao-baseline-v2
.\.venv\Scripts\python.exe -m pytest -q
```

O treino separa treino/validação/teste em 70/15/15 por classe, ajusta o pré-processamento somente no treino e compara regressão logística com floresta aleatória por macro F1 de validação. O teste permanece fora da escolha. O artefato e `metadata.json` ficam ignorados pelo Git, marcados `CANDIDATE`. O relatório contém métricas por classe, matriz de confusão e Brier para `Dropout`; `calibrated=false` até avaliação de calibração. Métricas não equivalem a aprovação para uso com estudantes reais.

## Publicação e operação

Copie `.env.example` para `services/ml/.env`. O serviço só carrega um artefato `joblib` quando `ML_MODEL_APPROVED_SHA256` coincide com o hash do arquivo e dos metadados. Esta variável representa a aprovação explícita de uma versão revisada. `joblib` usa pickle e **nunca** deve carregar arquivos de origem não confiável. Defina também `ML_SERVICE_TOKEN` com ao menos 32 caracteres e configure o mesmo valor em `services/api/.env`, junto de `ML_SERVICE_URL=http://ml:8000`. O serviço de ML recebe apenas suas próprias variáveis, sem credenciais do NestJS ou do banco. Em Compose, o diretório `artifacts/` é montado somente para leitura e a porta 8000 não é publicada no host.

O treino local `evasao-baseline-v2` produziu o artefato SHA-256 `7cd97ce79675511c083d855c136632b61946f92a3920465f1b369be43a62c7e4`. O `docker-compose.yml` aponta para esta versão. Para testar a integração localmente, configure o hash em `ML_MODEL_APPROVED_SHA256` no `.env` privado do ML, use o mesmo token nos dois serviços e habilite `ML_PREVIEW_ENABLED=true` no `.env` da API. Isso permite a prévia técnica; o candidato permanece `CANDIDATE` e não autoriza previsões para decisões sobre estudantes reais.

- `GET /health`: processo ativo, mesmo sem modelo.
- `GET /ready`: `503` enquanto não houver modelo aprovado.
- `GET /internal/models/{version}`: metadados não sensíveis, exige token.
- `POST /internal/predict-batch`: contrato da seção 12.3 de `CONTEXT.md`, exige token; rejeita atributos faltantes/extras, valores não finitos, versão divergente e lotes com mais de 100 itens.
- `GET /ml/status` na API NestJS: estado do serviço, restrito a `ADMIN`.

O NestJS já possui um cliente interno tipado e valida a resposta do Python, mas ainda não há rota pública de previsão de alunos: faltam matrícula, dados acadêmicos, mapeamento dos códigos do CSV e autorização por vínculo. Também não há persistência de previsões nem retreinamento automático. Nenhum dado operacional entra no pipeline de treinamento.

O candidato treinado com o CSV fornecido ao projeto teve macro F1 de teste de aproximadamente **0,718** e recall de `Dropout` de **0,746**. A classe `Enrolled` ficou em F1 de **0,523**. Estes resultados exigem validação institucional, análise de viés e calibração antes de qualquer publicação.
