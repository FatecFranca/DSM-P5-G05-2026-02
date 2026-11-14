# Serviço interno de ML

O NestJS continua sendo a única API pública. Este serviço FastAPI recebe lotes de **36 atributos numéricos** identificados apenas pelo UUID da matrícula e devolve as probabilidades das classes do modelo ativo. O modelo binário atual retorna `Dropout` e `Graduate`; `Enrolled` não recebe probabilidade. Não consulta o banco acadêmico, não recebe nomes ou e-mails e não executa treinamento durante requisições.

## Treinamento offline

O CSV externo deve ter exatamente as 36 colunas descritas em `CONTEXT.md`, seguidas de `classe`. O dataset selecionado está disponível localmente em `datasets/dados_preprocessados.csv` (4.152 registros; SHA-256 `48b6a0c4417f5f52b5a5d332e2a7e1cfa34b2f62a74fe35d97fb2373a06fe085`). A fonte primária é o conjunto *Predict Students' Dropout and Academic Success* (UCI Machine Learning Repository, id 697, DOI 10.24432/C5MC89; Realinho, Martins, Machado e Baptista, 2021), licenciado sob CC BY 4.0, que exige atribuição. O `data.csv` da UCI tem SHA-256 `3ef126de5cefff26eb11fbb4237f1a1401cb64b488e2f1d598c23cedeb4c45ae`, o mesmo `raw_sha256` de `app/preprocessing/notebook-zscore-v1.json`. O CSV tratado é obtido dele pelas etapas de `docs/ml-preprocessing.md` (duplicatas, IQR em `nota_qual_anterior` e `nota_admissao` e z-score com `ddof=1` em 19 atributos) e reproduz o SHA-256 aprovado acima. `datasets/` é ignorado pelo Git: mantenha o arquivo no ambiente controlado de treinamento, sem versioná-lo ou incluí-lo na imagem Docker. O comando exige o SHA-256 conferido e rejeita divergências.

```powershell
cd services/ml
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m training.train --dataset datasets/dados_preprocessados.csv --approved-sha256 48b6a0c4417f5f52b5a5d332e2a7e1cfa34b2f62a74fe35d97fb2373a06fe085 --source "CSV fornecido para o projeto SGEI" --version evasao-baseline-v2 --output artifacts/evasao-baseline-v2
.\.venv\Scripts\python.exe -m pytest -q
```

O treino separa treino/validação/teste em 70/15/15 por classe, ajusta o pré-processamento somente no treino e compara regressão logística com floresta aleatória por macro F1 de validação. O teste permanece fora da escolha. O artefato e `metadata.json` ficam ignorados pelo Git, marcados `CANDIDATE`. O relatório contém métricas por classe, matriz de confusão e Brier para `Dropout`; `calibrated=false` até avaliação de calibração. Métricas não equivalem a aprovação para uso com estudantes reais.

O treinamento reproduzível do projeto continua usando o CSV **tratado** e mantém o candidato `evasao-baseline-v2`. Há um modo experimental `--input-format raw` para comparar a metodologia com o CSV original externo. Como o CSV tratado já foi filtrado e padronizado antes da divisão, suas métricas não eliminam esse risco de vazamento metodológico.

### Modelo externo binário recebido

O arquivo `modelo_lr_balanceada_sem_enrolled.pkl` foi copiado para `artifacts/externo-lr-sem-enrolled-v1/model.pkl` (SHA-256 `fbc7d381435551924dc09439da7a203aa02c5592a02d0d4fc963770887a2e5fd`). Por solicitação do projeto para reproduzir a demonstração em outro computador, **somente esse modelo ativo** foi liberado para versionamento; os modelos anteriores e o CSV tratado continuam ignorados. O manifesto em `candidates/externo-lr-sem-enrolled-v1.json` acompanha o artefato.

A inspeção controlada identificou um pipeline de regressão logística balanceada com as mesmas 36 colunas, mas somente as classes `Dropout` e `Graduate`. O `StandardScaler` interno tem média 23,16 para idade e 125,98 para nota de admissão, enquanto essas colunas têm média aproximadamente zero no CSV tratado. Isso indica entrada na escala original: a API deve enviar `input_format=original`. O ambiente foi fixado em scikit-learn 1.8.0 e pandas 2.3.3 para carregá-lo. O serviço verifica SHA-256, versão da biblioteca, 36 colunas e as duas classes, além de restringir os tipos aceitos pelo desserializador. Em outra instalação, confirme o hash do arquivo recebido antes de ativá-lo. `Graduate` é o rótulo da segunda classe treinada; não garante conclusão para um aluno em curso.

A avaliação do próprio `.pkl` foi reconstruída com `dataProcessada.csv` (SHA-256 `3ef126de5cefff26eb11fbb4237f1a1401cb64b488e2f1d598c23cedeb4c45ae`): excluir `Enrolled`, dividir 80/20 estratificado com semente 7 e remover outliers de `nota_qual_anterior` e `nota_admissao` apenas do treino. As 2.730 linhas restantes, as médias e os desvios do `StandardScaler` coincidiram com o artefato. Nos 726 registros separados, a acurácia foi **90,77%**, F1 macro **90,22%** e recall de `Dropout` **85,56%**. O relatório consta no manifesto do candidato. Reproduza com `python -m training.evaluate_binary_candidate --dataset <CSV> --model artifacts/externo-lr-sem-enrolled-v1/model.pkl --dataset-sha256 <SHA-256 acima> --model-sha256 <SHA-256 do artefato acima>`. Esses números medem o CSV externo, não os dez alunos da planilha sem desfechos.

### Avaliação de calibração do modelo ativo

O mesmo comando agora calcula a frequência observada de evasão em dez faixas fixas de probabilidade, com intervalos de Wilson de 95%, erro médio de calibração ponderado (ECE) e diferença entre frequência observada e probabilidade média, com intervalo bootstrap de 95% (2.000 reamostragens, semente 7). A saída completa, sem dados individuais, está em `candidates/externo-lr-sem-enrolled-v1.calibration.json`.

Nos 726 registros externos, a probabilidade média foi **41,64%** (302,29 evasões esperadas), enquanto a frequência observada foi **39,12%** (284 evasões). A diferença observada menos prevista foi **−2,52 pontos percentuais**, com intervalo bootstrap de **−4,43 a −0,60 pontos**; o ECE foi **2,81 pontos**. Há faixas com poucas amostras, e a maior diferença entre faixas (29,51 pontos) ocorreu numa faixa com apenas nove registros. Esses resultados indicam superestimação nesse conjunto externo. O intervalo bootstrap descreve a incerteza amostral condicionada a esse conjunto; não mede a transferência para estudantes da instituição.

O indicador `calibrated` permanece `false`: não há validação de calibração com desfechos institucionais, e o modelo binário exclui `Enrolled`. Não apresente a soma de probabilidades dos estudantes como evasão esperada. Antes de rever esse estado, é necessário definir desfecho e horizonte temporal, reunir uma coorte representativa com autorização, avaliar calibração e vieses nela e, se houver ajuste, usar dados separados para calibrar e testar sem reutilizar o teste para escolher o método. Dados operacionais recebidos pela aplicação não entram automaticamente no treinamento ou na calibração.

Também foi ajustado um **candidato experimental** por calibração sigmoide sobre 363 registros da validação externa, mantendo outros 363 para teste independente do calibrador. O modelo base ficou congelado durante o ajuste. No teste, o Brier passou de **0,06856** para **0,06678** e o ECE de **3,77** para **2,28 pontos percentuais**. A melhora de Brier foi **0,00178**, com intervalo bootstrap de 95% de **−0,00044 a 0,00408**; esse intervalo inclui zero. O relatório reproduzível está em `candidates/externo-lr-sem-enrolled-v1.sigmoid-experiment.json`. Execute `python -m training.calibrate_binary_candidate` com os mesmos quatro argumentos (`--dataset`, `--model`, `--dataset-sha256`, `--model-sha256`) do comando de avaliação acima. O candidato não foi publicado nem usado na inferência: a amostra é externa, a melhora é incerta e não há validação na população institucional.

## Publicação e operação

Copie `.env.example` para `services/ml/.env`. O serviço só carrega o `.pkl` binário ativo quando `ML_MODEL_APPROVED_SHA256` coincide com o hash do arquivo e dos metadados; também verifica a versão do scikit-learn, a ordem das 36 entradas, as duas classes e as categorias aprendidas. Essa variável aprova o artefato técnico específico, sem aprovar seu uso institucional. O formato pickle **nunca** deve receber arquivos de origem não confiável. Defina também `ML_SERVICE_TOKEN` com ao menos 32 caracteres e configure o mesmo valor em `services/api/.env`, junto de `ML_SERVICE_URL=http://ml:8000`. O serviço de ML recebe apenas suas próprias variáveis, sem credenciais do NestJS ou do banco. Em Compose, o diretório `artifacts/` é montado somente para leitura e a porta 8000 não é publicada no host.

O treino local `evasao-baseline-v2` produziu o artefato SHA-256 `7cd97ce79675511c083d855c136632b61946f92a3920465f1b369be43a62c7e4` e permanece disponível como histórico. Retreiná-lo com o mesmo CSV aprovado reproduz as métricas, mas o `model.joblib` não sai idêntico byte a byte. O `docker-compose.yml` e o carregador aceitam somente o modelo binário externo. Para usar a integração local, configure o hash do artefato em `ML_MODEL_APPROVED_SHA256` no `.env` privado do ML e o mesmo token nos dois serviços. A API calcula previsões para matrículas com os 36 atributos completos, inclusive os importados da planilha, sem exigir validação com dados de uma Fatec. Os resultados mantêm a versão do modelo e do perfil para auditoria.

- `GET /health`: processo ativo, mesmo sem modelo.
- `GET /ready`: `503` enquanto não houver modelo aprovado.
- `GET /internal/models/{version}`: metadados não sensíveis, exige token.
- `POST /internal/predict-batch`: contrato da seção 12.3 de `CONTEXT.md`, exige token; rejeita atributos faltantes/extras, valores não finitos, versão divergente e lotes com mais de 100 itens.
- `GET /ml/status` na API NestJS: estado do serviço, restrito a `ADMIN`.

O NestJS possui cliente interno tipado e valida a resposta do Python. A rota por matrícula retorna `INSUFICIENTE` quando faltarem atributos; perfis completos podem ser analisados. Nenhum dado operacional entra no pipeline de treinamento.

O candidato histórico v2 treinado com o CSV fornecido ao projeto teve macro F1 de teste de aproximadamente **0,718** e recall de `Dropout` de **0,746**. A classe `Enrolled` ficou em F1 de **0,523**. Essas métricas não se aplicam ao `.pkl` binário ativo; sua avaliação separada está documentada acima.
