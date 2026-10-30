# Integração acadêmica — contrato inicial

## Autenticação e escopo

Todas as rotas abaixo exigem `Authorization: Bearer <accessToken>`. O backend recupera perfil, instituição e sessão do banco. O corpo não aceita `instituicaoId`, perfil ou identidade do autor. UUIDs, tipos, limites e campos extras são validados por DTOs. Alterações acadêmicas e auditoria são gravadas na mesma transação.

O mobile usa o perfil retornado por `/auth/me` para filtrar a navegação e as solicitações. Isso é conveniência de interface: requisições forjadas continuam sujeitas às regras do backend. Refresh tokens são rotacionados; respostas de sessões encerradas são descartadas pelo aplicativo.

Nesta demonstração, `/auth/instituicoes` mostra somente Fatec Franca (109), São Paulo (002), Campinas (276) e Ribeirão Preto (284). `ADMIN` pode consultar e cadastrar usuários e estrutura acadêmica nessas quatro Fatecs. A instituição de cada usuário e vínculo permanece gravada e validada no servidor. `COORDENACAO` continua limitada à própria Fatec; professor, tutor e aluno só consultam pessoas e dados vinculados. Auditorias de ações administrativas entre Fatecs são registradas na instituição de origem do administrador.

| Perfil | Leitura | Escrita |
| --- | --- | --- |
| ADMIN | Instituição | Usuários, turmas, disciplinas, matrículas, lotações, tutorias e fechamento/reabertura |
| COORDENACAO | Instituição | Nenhuma neste módulo |
| PROFESSOR | Disciplinas com lotação e respectivas matrículas | Aulas, frequência, avaliações, notas, atividades, correções e materiais dessas disciplinas |
| TUTOR | Matrículas vinculadas; notas publicadas; sem materiais | Nenhuma neste módulo |
| ALUNO | Próprias matrículas; notas e atividades publicadas | Arquivos e entrega de atividades abertas de suas turmas |

## Rotas

| Método e rota | Corpo / resultado |
| --- | --- |
| GET `/academico/resumo?turmaId=<uuid>` | Turmas acessíveis e dados da turma selecionada, filtrados por vínculo e publicação |
| GET `/academico/calendario` | `inicio` e `fim` ISO obrigatórios; filtros opcionais `turmaId`, `disciplinaId`, `pagina` e `tamanho` |
| GET `/academico/avisos` | Publicações e correções acessíveis; filtros opcionais `turmaId`, `disciplinaId`, `pagina` e `tamanho` |
| GET `/turmas` | Turmas acessíveis |
| GET `/usuarios?instituicaoId=&perfil=&busca=` | Pessoas no escopo do perfil; até 500, ordenadas por nome |
| GET `/usuarios?pagina=1&tamanho=50&instituicaoId=&perfil=&busca=` | Mesmo escopo e filtros; retorno `{ itens, total, pagina, tamanho }`, com `tamanho` de 1 a 100 |
| GET `/usuarios/:id` | Detalhes e matrículas visíveis no escopo do perfil |
| POST `/usuarios` | ADMIN; aceita `instituicaoId` de uma das quatro Fatecs, além de nome, e-mail, perfil e senha |
| POST `/turmas` | `nome`, `curso`, `periodo` |
| POST `/disciplinas` | `turmaId`, `nome` |
| POST `/matriculas` | `turmaId`, `alunoId`, `registro` |
| POST `/lotacoes` | `disciplinaId`, `professorId` |
| POST `/tutorias` | `matriculaId`, `tutorId` |
| PATCH `/turmas/:id/fechamento` | `fechada`: boolean |
| POST `/aulas` | `disciplinaId`, `data`: ISO, `tema` |
| PUT `/aulas/:id/frequencia` | `itens`: array de `{ matriculaId, situacao }`; PRESENTE, FALTA ou FALTA_JUSTIFICADA |
| POST `/avaliacoes` | `disciplinaId`, `titulo`, `peso`, `notaMaxima`, `data`: ISO |
| PUT `/avaliacoes/:id/notas` | `itens`: array de `{ matriculaId, valor }` |
| POST `/avaliacoes/:id/publicar` | Sem corpo; exige notas para todos os matriculados |
| POST `/atividades` | `disciplinaId`, `titulo`, `descricao`, `prazo`: ISO, `notaMaxima`, `estado`: RASCUNHO ou PUBLICADA |
| POST `/atividades/:id/publicar` | Sem corpo; publica rascunho ainda no prazo |
| PUT `/atividades/:id/entrega` | `arquivoId`; matrícula derivada do aluno autenticado |
| PUT `/atividades/:id/entregas/:matriculaId/correcao` | `nota`, `feedback` |
| POST `/materiais` | `disciplinaId`, `arquivoId`, `titulo`, `descricao` |
| POST `/arquivos` | Multipart, campo único `arquivo` |
| GET `/arquivos/:id` | Download autenticado e autorizado por autor/vínculo |

Criações retornam 201; consultas e PUT/PATCH retornam 200. Erros: 400 validação/regra, 401 sessão inválida, 403 perfil/prazo/período, 404 recurso fora do escopo ou inexistente, 409 duplicidade/conflito concorrente, 413 limite de upload, 429 limite de requisições.

## Regras desta versão

- Calendário consulta aulas, avaliações e prazos em intervalo `[inicio, fim)` de até 93 dias. Rascunhos ficam ocultos para aluno e tutor. A interface navega por mês.
- Avisos derivam de materiais, atividades publicadas, notas publicadas e correções, em ordem de ocorrência. Correções respeitam a matrícula autorizada; tutor não recebe avisos de materiais. Não há push nem marcação de leitura nesta versão.
- Calendário e avisos possuem paginação no servidor: `pagina` de 1 a 100, `tamanho` de 1 a 50 (padrão 20), retorno `{ itens, pagina, tamanho, temMais, limiteAtingido }`. Não dependem do limite do resumo. Empates de data são resolvidos pelo ID do evento. Novas publicações durante a navegação podem deslocar páginas; atualizar reinicia a consulta.
- A migração de datas de publicação é aditiva. Publicações antigas sem data conhecida não geram avisos de publicação; continuam disponíveis nas consultas acadêmicas. Republicar notas já publicadas preserva a data conhecida. Avisos refletem o estado atual, sem histórico separado.

- Turma identifica curso e período por texto. O fechamento bloqueia escrita acadêmica; reabertura é administrativa.
- Frequência pode ser lançada até sete dias após a aula. Aulas futuras não aceitam chamada. Frequência = presenças / registros; justificadas não contam como presença. Registros ausentes não são presumidos como presença ou falta.
- Notas são normalizadas para escala 0–10, ponderadas por avaliação e depois agregadas pela média das disciplinas com notas publicadas. Ausência de dados retorna `null`.
- Correção de entrega fica visível imediatamente. Entrega corrigida não pode ser substituída. Prazo e período são verificados novamente no servidor.
- PDF, DOCX, PPTX e ODT: até 10 MB por arquivo, 100 MB por usuário; formato detectado pelo conteúdo. Metadados e hash ficam no banco; bytes ficam em volume privado `sgei_uploads`, com nomes UUID. Nenhum diretório é servido estaticamente. Arquivos devem pertencer ao autor antes de serem vinculados a materiais/entregas.
- Resumo possui limite de 2.000 registros por coleção. `truncated: true` sinaliza resultado incompleto e suprime indicadores. A interface pagina os registros recebidos em grupos de 20. Paginação no servidor e filtros adicionais ainda são necessários para instituições maiores.
- Não há exclusão/retenção automática de uploads sem vínculo nesta versão. Isso requer política de retenção e coleta de arquivos órfãos antes de uso prolongado.
- Não são produzidas previsões individuais com os dados acadêmicos deste contrato. O modelo atual utiliza 36 atributos externos; o mapeamento para registros operacionais requer definição e validação. Risco e probabilidades nunca são enviados ao aluno.
- `GET/PUT /ml/matriculas/:id/autodeclaracao` permitem ao aluno consultar e informar **idade ao ingressar** e **turno** de sua própria matrícula. O servidor aplica o mapeamento `fatec-v1` (idade inteira; diurno → 1; noturno → 0), preserva os demais atributos já cadastrados e não retorna códigos ou risco. Estas respostas não completam o modelo por si só.
- A análise operacional retorna `INSUFICIENTE` com `impedimentos` enquanto não houver validação de população, equivalência das categorias e revisão de vieses para as Fatecs. O artefato técnico candidato permanece disponível apenas para testes separados; não deve ser usado para orientar decisões institucionais.

## Dados locais de demonstração

A migração `20261029010000_limit_fatec_catalog` mantém somente Franca, São Paulo, Campinas e Ribeirão Preto no diretório CPS. Se alguma das demais unidades tiver usuários, sessões, auditoria ou turmas vinculados, a migração falha sem apagar instituições; dados de outras instituições sem código CPS também permanecem preservados. O histórico acadêmico sintético usado nos testes locais foi criado manualmente e não faz parte das migrations ou da entrega versionada. Suas notas não servem para validação ou treinamento de ML.

## Execução e verificação

Na raiz: `docker compose up -d --build api`. O serviço `migrate` aplica a migração aditiva antes de iniciar a API. O volume de uploads é persistente. Configure as origens web exatas em `ALLOWED_ORIGINS`; para Expo local, `http://localhost:8081`.

Em `services/api`: `npm run db:generate`, `npm run db:validate`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm test -- --runInBand`.

Com PostgreSQL e API locais ativos, execute `npm run test:integration:academic`. O teste usa as Fatecs Franca (109) e São Paulo (002) já cadastradas, verifica isolamento, perfis, publicação, frequência, notas, uploads, downloads e revogação, e remove somente os usuários, turmas e demais registros criados na execução. Requer Docker para limpar os arquivos enviados ao volume. O limite de cinco logins por minuto permanece ativo; aguarde a janela antes de repetir esse teste.

No mobile: `npm run typecheck`, `npm run lint`, `npm test`, `npx expo export --platform web`. Após criar rotas, `npx expo start` regenera os tipos do Expo Router. Validação em aparelho Android/iOS continua necessária para o seletor e compartilhamento nativos.

## Continuidade

Este bloco entrega o fluxo acadêmico básico persistido, calendário derivado e avisos consultados no servidor. Permanecem fora dele histórico de notificações/marcação de leitura/push, calendário institucional independente, ocorrências de tutoria, edição/exclusão de cadastros, configuração institucional de escalas/justificativas, paginação completa do resumo, publicação separada das correções e uso operacional das análises ML. As telas antigas de demonstração permanecem locais e só aparecem mediante entrada explícita no modo demo.
