# Pré-processamento e integração do modelo

Conferência em 21/10/2026 do notebook `Pre_processamento_dataset.ipynb`, fornecido pelo usuário, contra os dois CSVs locais. O notebook foi lido como referência; suas células não foram executadas automaticamente.

## Resultado verificado

- Fonte com valores originais: `dataProcessada.csv`, 4.424 linhas e 37 colunas.
- Duplicatas e inconsistências: nenhuma linha removida nessa fonte.
- IQR sequencial de 1,5: 4.245 linhas após `nota_qual_anterior` e 4.152 após `nota_admissao`.
- As três classes permanecem: Dropout, Enrolled e Graduate.
- 19 atributos numéricos: `(valor - média) / desvio`, com desvio amostral (`ddof=1`). Os outros 17 atributos não são padronizados.
- Comparação de todas as linhas, atributos e classes com o CSV usado no modelo: erro absoluto máximo **0,0**. SHA-256 do CSV tratado: `48b6a0c4417f5f52b5a5d332e2a7e1cfa34b2f62a74fe35d97fb2373a06fe085`.

Os parâmetros agregados e hashes das fontes estão em `services/ml/app/preprocessing/notebook-zscore-v1.json`. Esse arquivo não contém registros individuais. O script `training/recover_preprocessing.py` reproduz apenas as etapas auditadas, compara o resultado e exporta os parâmetros. Não treina nem substitui o artefato existente.

## Inferência

`POST /ml/preview` aceita `{ features, inputFormat }`, autenticado e restrito a COORDENACAO. `features` exige exatamente os 36 atributos numéricos finitos. `inputFormat` aceita `preprocessed` ou `original` (padrão atual).

- `preprocessed`: encaminha os atributos tratados apenas quando a versão ativa foi treinada para essa escala.
- `original`: no modelo binário atual, valida os códigos efetivamente aprendidos pelo `OneHotEncoder` do `.pkl` e as escalas, e entrega um DataFrame de 36 colunas ao pré-processamento interno do próprio artefato. O candidato v2 permanece somente para análise histórica de treinamento. `GET /ml/status` informa `originalInputReady` e as duas classes do modelo ativo.
- Os códigos de categorias devem pertencer ao conjunto suportado. As notas de ingresso usam escala 0–200; médias semestrais usam 0–20. Não converter automaticamente notas de outra instituição sem um mapeamento definido.
- Não há ajuste das médias/desvios, exclusão de novos alunos por IQR, imputação usando a classe ou treinamento durante consultas. Dados ausentes são rejeitados.
- As previsões por matrícula usam atributos persistidos em PerfilMl. Consulte [ML integrado às matrículas](ml-matriculas.md) para cadastro, seed e rotas operacionais.

## Limitação de avaliação preservada

O notebook calculou médias/desvios e filtros antes da divisão de treino/teste. Isso deve constar na interpretação das métricas do candidato v2. O novo `.pkl` não inclui protocolo de avaliação verificável nem dataset de origem identificado. Ambos continuam sem aprovação para decisões sobre alunos reais.

Essa avaliação separada pode usar o modo experimental `--input-format raw` do treinamento offline. Ele mantém todas as transformações aprendidas no conjunto de treino e produz outro artefato `CANDIDATE`, com categorias de entrada próprias. O treinamento reprodutível do projeto ainda prioriza o CSV tratado; a prévia técnica foi alterada para o `.pkl` binário por solicitação posterior.

## Validação local

Execute `python -m pytest -q` em `services/ml`. Para repetir a conferência completa, execute `python -m training.recover_preprocessing --raw <CSV-original> --processed <CSV-tratado> --notebook <notebook> --output <JSON-temporário>`.

Com API, banco e ML locais atualizados, execute o teste acadêmico com `TEST_ML=true`. No modelo binário, ele valida a inferência com entrada original e a rejeição de dados já padronizados; no v2, compara ambos os formatos. Também verifica autenticação, autorização e entradas inválidas, usando registros temporários nas Fatecs Franca e São Paulo, removidos ao final.
