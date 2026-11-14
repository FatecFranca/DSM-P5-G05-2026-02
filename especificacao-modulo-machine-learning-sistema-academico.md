# Especificação do Módulo de Machine Learning — Sistema Acadêmico

## 1. Objetivo

Implementar um módulo de Machine Learning (ML) integrado ao sistema acadêmico para classificar dados acadêmicos de estudantes usando um modelo previamente treinado.

O backend principal utiliza **NestJS + TypeScript**. A arquitetura recomendada utiliza um **serviço Python separado**, exposto por uma API interna com FastAPI, para carregar o modelo e executar inferências.

### Regra obrigatória

**Os dados dos alunos em produção devem ser utilizados exclusivamente para inferência. Eles não podem ser adicionados automaticamente ao dataset de treinamento nem utilizados para retreinar ou atualizar o modelo.**

O treinamento será um processo separado, controlado e executado apenas com um dataset de treinamento previamente selecionado e autorizado.

---

## 2. Diretrizes para o agente de implementação

1. Antes de alterar o código, inspecione a estrutura existente, o `README`, as dependências, as rotas, a autenticação, o acesso ao banco e o ambiente de execução.
2. Reutilize os padrões e as tecnologias existentes sempre que possível. Não reescreva módulos que já funcionam.
3. Preserve as regras de negócio existentes e limite as alterações ao necessário para a integração.
4. Não invente atributos, classes, métricas, dados ou resultados do modelo. Confirme-os a partir do dataset e dos artefatos disponíveis.
5. Se o dataset ou a definição das classes ainda não estiver disponível, prepare a estrutura e os contratos, mas não finja que o modelo está treinado nem crie previsões reais fictícias.
6. Antes de fazer alterações amplas ou destrutivas, apresente um plano curto e solicite confirmação. Para mudanças pequenas e claramente solicitadas, siga o fluxo normal do projeto.
7. Não inclua dados pessoais ou arquivos sensíveis nos logs, nos testes versionados ou nas respostas da API sem necessidade.
8. Não adicione dependências, infraestrutura ou abstrações desnecessárias.
9. Ao terminar, apresente um resumo objetivo das mudanças, os comandos para executar/testar e as pendências reais.

---

## 3. Arquitetura recomendada

```text
Frontend
   |
   | HTTP
   v
Backend principal — NestJS + TypeScript
   |-- Autenticação e autorização
   |-- Validação e regras de negócio
   |-- Consulta dos dados acadêmicos permitidos
   |-- Persistência do resultado, se necessária
   |
   | HTTP interno, enviando apenas os atributos necessários
   v
Serviço de ML — Python + FastAPI
   |-- Validação do contrato de entrada
   |-- Pré-processamento compatível com o treinamento
   |-- Modelo treinado carregado em memória
   |-- Inferência e resposta padronizada
   |
   v
Classe prevista e metadados do modelo
```

O serviço Python **não deve precisar acessar diretamente o banco de dados acadêmico**. O backend principal é responsável por autorizar o acesso, obter os dados do aluno e enviar ao serviço de ML apenas os atributos necessários.

O serviço de ML não deve estar publicamente exposto. Em desenvolvimento, pode ser acessível apenas pela rede interna do Docker ou pelo ambiente local controlado.

### Tecnologias sugeridas

- Backend existente: NestJS + TypeScript, usando Modules, Controllers, Providers/Services e DTOs conforme os padrões do projeto.
- Comunicação HTTP: preferir a solução já instalada; caso não exista, avaliar `@nestjs/axios`/`HttpModule` antes de adicionar dependências.
- Configuração: reutilizar `ConfigModule`/`ConfigService` se já estiverem configurados para ler `ML_SERVICE_URL` e timeout por ambiente.
- Serviço de inferência: Python + FastAPI.
- ML tabular: scikit-learn, caso seja compatível com o dataset e o algoritmo escolhido.
- Validação Python: Pydantic.
- Serialização do modelo: `joblib` ou outro formato compatível e seguro para o algoritmo adotado.
- Ambiente: Docker Compose, se o projeto já utilizar Docker ou se isso simplificar a execução integrada.
- Testes: framework já utilizado pelo backend e `pytest` para o serviço Python.

Não é obrigatório adotar uma tecnologia nova se o repositório já possuir uma solução equivalente adequada.

---

## 4. Estrutura de pastas proposta

Adaptar esta estrutura ao repositório real. Não duplicar pastas ou criar uma nova estrutura paralela se o projeto já possuir organização equivalente.

```text
academic-system/
├── backend/
│   ├── src/
│   │   ├── app.module.ts
│   │   ├── assessments/
│   │   │   ├── assessments.module.ts
│   │   │   ├── assessments.controller.ts
│   │   │   ├── assessments.service.ts
│   │   │   └── dto/
│   │   │       └── create-assessment.dto.ts
│   │   ├── ml/
│   │   │   ├── ml.module.ts
│   │   │   ├── ml-client.service.ts
│   │   │   ├── ml.types.ts
│   │   │   └── dto/
│   │   │       ├── predict-request.dto.ts
│   │   │       └── predict-response.dto.ts
│   │   ├── config/
│   │   └── ...
│   ├── package.json
│   └── ...
├── ml-service/
│   ├── app/
│   │   ├── main.py
│   │   ├── schemas.py
│   │   ├── predict.py
│   │   ├── model_loader.py
│   │   └── preprocessing.py
│   ├── artifacts/
│   │   ├── model.joblib
│   │   └── metadata.json
│   ├── tests/
│   ├── requirements.txt
│   └── Dockerfile
├── training/
│   ├── datasets/
│   │   └── .gitkeep
│   ├── train.py
│   ├── evaluate.py
│   ├── export_model.py
│   └── requirements.txt
├── compose.yaml
└── .gitignore
```

### Responsabilidades dos arquivos

#### Backend TypeScript

- `assessments.module.ts`: registrar controller e service do módulo de avaliações.
- `assessments.controller.ts`: expor as rotas públicas de avaliação usando os decorators do NestJS.
- `assessments.service.ts`: coordenar as regras de negócio, consultar os atributos autorizados, chamar o módulo de ML e persistir o resultado quando necessário.
- `create-assessment.dto.ts`: validar a entrada pública com `class-validator`/`class-transformer` ou o padrão de validação já usado no projeto.
- `ml.module.ts`: encapsular e exportar o cliente de ML para os módulos que precisarem dele.
- `ml-client.service.ts`: usar o mecanismo HTTP adotado pelo projeto (por exemplo, `HttpModule`/`HttpService` de `@nestjs/axios`) para chamar a API interna, com timeout, tratamento de erros e validação da resposta.
- `ml.types.ts` e DTOs de ML: definir os contratos tipados de entrada e saída. Não confundir tipagem TypeScript com validação em runtime.

#### Serviço Python

- `main.py`: criar a aplicação FastAPI e declarar os endpoints internos.
- `schemas.py`: validar os dados recebidos e as respostas.
- `predict.py`: executar inferência usando o pipeline carregado.
- `model_loader.py`: carregar o artefato uma vez durante a inicialização, verificar sua disponibilidade e expor a versão ativa.
- `preprocessing.py`: implementar apenas as transformações necessárias e consistentes com o treinamento. Preferir carregar um pipeline completo treinado, evitando duplicar transformações.
- `artifacts/model.joblib`: artefato exportado e aprovado para inferência.
- `artifacts/metadata.json`: metadados como versão, algoritmo, atributos esperados, classes e métricas de avaliação, quando conhecidos.

#### Treinamento

- `train.py`: treinar modelos exclusivamente com o dataset autorizado de treinamento.
- `evaluate.py`: avaliar o modelo com dados de validação/teste separados.
- `export_model.py`: exportar o pipeline aprovado e metadados.
- `datasets/`: guardar o dataset de treinamento em ambiente controlado. Não colocar dados pessoais de estudantes em Git ou em imagens de Docker.

Os artefatos reais do modelo podem não existir inicialmente. A estrutura não deve simular que eles existem.

---

## 5. Fluxo de treinamento

O treinamento é offline e independente das requisições normais do sistema.

1. Selecionar e documentar a origem e a autorização de uso do dataset de treinamento.
2. Inspecionar colunas, tipos, valores ausentes, duplicatas, distribuição da classe e possíveis inconsistências.
3. Definir explicitamente a variável-alvo e o significado de cada classe.
4. Separar os conjuntos de treinamento, validação e teste de maneira apropriada ao problema.
5. Evitar vazamento de dados: ajustar imputação, escalonamento, seleção de atributos e outras transformações apenas com o conjunto de treinamento. Usar validação cruzada quando apropriado.
6. Treinar e comparar algoritmos adequados ao dataset. Não escolher um algoritmo apenas por conveniência.
7. Avaliar métricas relevantes, incluindo matriz de confusão, precisão, recall, F1-score e acurácia. Considerar o desbalanceamento de classes.
8. Verificar se o modelo apresenta desempenho aceitável para o objetivo acadêmico e documentar suas limitações.
9. Exportar o pipeline completo aprovado e um arquivo de metadados com versão, atributos, classes, métricas, data e versões das bibliotecas.
10. Promover o artefato aprovado para o ambiente de inferência por um processo controlado.

**Não treinar dentro de um endpoint de inferência. Não retreinar a cada requisição. Não atualizar automaticamente o modelo com dados de alunos.**

Se futuramente for necessário treinar uma nova versão, isso deve ocorrer em uma tarefa independente, com dataset autorizado, avaliação, aprovação e versionamento explícitos.

---

## 6. Fluxo de inferência de um estudante

1. Um usuário autenticado solicita uma avaliação pelo frontend.
2. O backend autentica a requisição e verifica a autorização para acessar os dados acadêmicos envolvidos.
3. O backend consulta os dados necessários e seleciona somente os atributos esperados pelo modelo.
4. O backend valida a presença e o formato dos atributos.
5. O backend chama o serviço Python pela rede interna.
6. O serviço valida a entrada, aplica o pré-processamento treinado e executa a inferência com o modelo carregado em memória.
7. O serviço devolve a classe prevista e metadados pertinentes.
8. O backend valida a resposta, registra a avaliação caso a regra de negócio exija e responde ao frontend.
9. A avaliação não altera o dataset de treinamento nem o artefato do modelo.

O sistema deve definir o comportamento para atributos ausentes, entradas inválidas, modelo indisponível, timeout e respostas malformadas. Não retornar uma classe fictícia quando a inferência falhar.

---

## 7. Contratos de API propostos

Os nomes e campos finais precisam ser adaptados aos atributos reais do dataset e ao modelo treinado. No NestJS, declarar as rotas em controllers e registrar dependências por módulos/providers, seguindo a organização já existente no repositório. Os exemplos abaixo são ilustrativos e não representam o esquema real do dataset.

### API pública do backend

- `POST /api/assessments`: solicitar avaliação de um estudante autorizado.
- `GET /api/assessments/:id`: consultar uma avaliação anterior, respeitando autorização.
- Usar o identificador do estudante na rota conforme os padrões existentes do sistema. Não confiar em identificadores ou atributos fornecidos pelo cliente sem autorização e validação.

O backend deve consultar a fonte de dados autorizada quando possível, em vez de confiar em valores acadêmicos arbitrários enviados pelo frontend.

### API interna do serviço de ML

- `POST /internal/predict`: executar inferência.
- `GET /internal/health`: verificar se a aplicação está operacional.
- `GET /internal/model-info`: retornar metadados não sensíveis da versão ativa.

Exemplo ilustrativo de entrada:

```json
{
  "features": {
    "attribute_1": 0.75,
    "attribute_2": 8.2,
    "attribute_3": 0
  }
}
```

Exemplo ilustrativo de resposta:

```json
{
  "prediction": 1,
  "model_version": "1.0.0"
}
```

Probabilidades por classe podem ser incluídas se o modelo suportar esse recurso. Não afirmar que os valores são probabilidades calibradas sem verificar a calibração.

A semântica de cada classe deve ser definida pelo dataset e documentada. Não assumir que `0` ou `1` significa aprovado, reprovado ou risco acadêmico sem confirmação.

---

## 8. Persistência e rastreabilidade

Se o sistema precisar guardar as avaliações, o backend principal deve ser responsável pela persistência.

Campos possíveis, adaptados ao esquema existente:

- identificador da avaliação;
- referência ao estudante, com controle de acesso;
- classe prevista;
- versão do modelo;
- data e hora da inferência;
- estado da operação;
- probabilidades, somente se produzidas pelo modelo e necessárias;
- metadados mínimos necessários para auditoria.

Não armazenar cópias desnecessárias de dados acadêmicos sensíveis nem incluir esses dados em logs. Definir retenção e acesso conforme a finalidade e as regras de privacidade aplicáveis.

---

## 9. Segurança, privacidade e isolamento

1. Exigir autenticação e autorização no backend público.
2. Restringir o serviço Python à rede interna e não expor o endpoint de inferência diretamente à internet.
3. Validar entradas e saídas nos dois serviços.
4. Configurar timeout e limites de tamanho de requisição.
5. Não registrar senhas, tokens, dados pessoais ou payloads acadêmicos completos nos logs.
6. Usar variáveis de ambiente para configuração e segredos; nunca versionar segredos.
7. Não permitir que o serviço de inferência grave no dataset de treinamento ou substitua o artefato do modelo.
8. Manter os datasets de treinamento fora do repositório, a menos que sejam pequenos, licenciados e explicitamente aprovados para versionamento. Preferir dados sintéticos nos testes.
9. Tratar os artefatos serializados como confiáveis apenas quando produzidos por um processo controlado. Formatos como `joblib`/pickle podem executar código durante o carregamento; não carregar artefatos não confiáveis.
10. Considerar a LGPD, minimização de dados, finalidade, controle de acesso e políticas de retenção.
11. O resultado da classificação deve apoiar a análise acadêmica, não ser tratado automaticamente como decisão definitiva de alto impacto sem validação e supervisão apropriadas.

---

## 10. Resiliência e operação

- Carregar o modelo uma vez durante a inicialização, e não em toda requisição.
- Verificar a disponibilidade do modelo antes de aceitar inferências.
- Configurar timeout no cliente TypeScript.
- Tratar erros de conexão, timeout, validação e falha do modelo com respostas controladas.
- Não usar retries indiscriminados em requisições que possam causar efeitos duplicados. A inferência deve ser sem efeitos colaterais.
- Implementar logs técnicos sem dados sensíveis e métricas de latência, taxa de erro e versão do modelo.
- Usar Docker Compose se adequado ao projeto, mantendo o serviço de ML em uma rede interna.
- Fixar versões de dependências e documentar os passos para reproduzir o ambiente de treinamento.

---

## 11. Testes e critérios de aceite

### Testes do treinamento

- O pipeline pode ser treinado e avaliado com um dataset de teste controlado.
- A separação entre treino, validação e teste é reproduzível.
- As métricas são calculadas e documentadas.
- O pipeline exportado consegue ser carregado e utilizado em inferência.
- O esquema dos atributos e das classes está documentado.

### Testes do serviço de ML

- O endpoint retorna uma previsão válida para uma entrada válida.
- Entradas malformadas ou atributos incompatíveis são rejeitados.
- A falha ou ausência do artefato é detectada e não produz previsões fictícias.
- A versão do modelo é informada corretamente.
- O modelo é carregado uma vez por processo e reutilizado nas inferências.

### Testes de integração do backend

- O backend só chama o ML após autenticar e autorizar a operação.
- O backend envia apenas os atributos necessários.
- Timeout e indisponibilidade do ML são tratados sem expor detalhes internos.
- Resultados são persistidos apenas conforme as regras de negócio.
- Usuários não autorizados não conseguem consultar dados ou avaliações de outros estudantes.

### Teste da regra de não treinamento

- O endpoint de inferência não importa nem executa o código de treinamento.
- A execução de uma ou várias inferências não modifica o dataset de treinamento nem o artefato do modelo.
- Não existe rotina automática que adicione dados de produção ao dataset.
- O treinamento só pode ocorrer por um processo explícito e separado.

### Critérios gerais de conclusão

- A integração utiliza o backend existente sem duplicar regras de negócio.
- A classe prevista corresponde às classes documentadas do dataset.
- O pré-processamento de inferência é idêntico ao usado pelo modelo aprovado.
- Há testes automatizados para os principais fluxos e erros.
- O README documenta instalação, execução, treinamento, avaliação e integração.
- As limitações conhecidas do modelo estão documentadas.

---

## 12. Ordem sugerida de implementação

1. Inspecionar o repositório e identificar padrões, banco, autenticação, rotas e Docker já existentes.
2. Confirmar a disponibilidade do dataset, seus atributos e a variável de classe.
3. Definir o contrato de entrada e saída do modelo com base no dataset real.
4. Implementar e testar o pipeline de treinamento offline.
5. Avaliar o modelo e exportar o artefato aprovado.
6. Implementar o serviço FastAPI com carregamento e inferência.
7. Implementar no NestJS o `MlModule`, o cliente HTTP como provider e o módulo de avaliações com controller/service/DTOs.
8. Adicionar configuração de ambiente e, se necessário, integrar os serviços ao Docker Compose.
9. Implementar testes unitários, de integração, segurança e não retreinamento.
10. Documentar comandos, configuração, métricas, versão do modelo e limitações.

Se o dataset ainda não estiver disponível, iniciar pelos passos 1 e 2 e pela estrutura básica dos contratos. Não fabricar dados, classes ou métricas para simular uma implementação concluída.

---

## 13. Informações que precisam ser confirmadas antes do modelo real

- Localização e formato do dataset autorizado para treinamento.
- Lista real de atributos de entrada.
- Nome e significado da variável de classe.
- Significado de cada valor da classe.
- Algoritmo candidato e métricas mínimas aceitáveis.
- Tratamento de valores ausentes e atributos categóricos, se existirem.
- Necessidade de registrar as avaliações no banco de dados.
- Restrições de acesso, retenção e finalidade dos dados acadêmicos.

Essas definições devem ser obtidas do dataset e dos requisitos reais, e não presumidas pelo agente.

---

## 14. Instrução final ao agente

Implemente esta arquitetura de forma incremental e compatível com o repositório NestJS existente. Primeiro inspecione o projeto e apresente um plano curto com os arquivos que serão criados ou modificados. Preserve a lógica atual, evite refatorações não solicitadas e não crie um modelo fictício. Garanta por código e testes que os dados dos alunos em produção sejam usados apenas para inferência e nunca adicionados automaticamente ao treinamento. Ao concluir, informe o que foi implementado, como executar os testes e quais decisões ou arquivos ainda faltam.
