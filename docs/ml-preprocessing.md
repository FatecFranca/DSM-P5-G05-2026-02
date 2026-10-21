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

`POST /ml/preview` aceita `{ features, inputFormat }`, autenticado e restrito a ADMIN. `features` exige exatamente os 36 atributos numéricos finitos. `inputFormat` aceita `preprocessed` (padrão compatível com o contrato anterior) ou `original`.

- `preprocessed`: encaminha os atributos tratados ao modelo, sem repetir a transformação externa do notebook.
- `original`: o serviço ML aplica os parâmetros fixos antes de chamar o pipeline treinado. A transformação só fica disponível se o hash do dataset registrado no modelo corresponder ao hash verificado. `GET /ml/status` informa `originalInputReady`.
- Os códigos de categorias devem pertencer ao conjunto suportado. As notas de ingresso usam escala 0–200; médias semestrais usam 0–20. Não converter automaticamente notas de outra instituição sem um mapeamento definido.
- Não há ajuste das médias/desvios, exclusão de novos alunos por IQR, imputação usando a classe ou treinamento durante consultas. Dados ausentes são rejeitados.
- Os cadastros acadêmicos ainda não contêm todos os atributos. Esta etapa oferece entrada explícita para prévia, sem vincular automaticamente previsões às matrículas.

## Limitação de avaliação preservada

O notebook calculou médias/desvios e filtros antes da divisão de treino/teste. Isso deve constar na interpretação das métricas do modelo existente. O candidato continua sem aprovação para decisões sobre alunos reais. A integração preserva o CSV tratado e o artefato escolhido; uma avaliação metodológica nova é uma etapa separada.

## Validação local

Execute `python -m pytest -q` em `services/ml`. Para repetir a conferência completa, execute `python -m training.recover_preprocessing --raw <CSV-original> --processed <CSV-tratado> --notebook <notebook> --output <JSON-temporário>`.

Com API, banco e ML locais atualizados, execute o teste acadêmico com `TEST_ML=true`. Ele compara previsões reais nos dois formatos, verifica autenticação/autorização e rejeição de entradas inválidas, usando instituições temporárias removidas no final.
