# API de mensagens

Conversas (1:1 e grupo), canais das turmas, publicações com respostas, curtidas e não lidas por pessoa.
Todas as rotas exigem autenticação e valem dentro da instituição (Fatec) da sessão. Código em `services/api/src/messages`.

## Perfis

| Perfil | Conversas | Lê canais | Publica em canal | Responde publicação | Curte |
| --- | --- | --- | --- | --- | --- |
| ALUNO | sim | sim | não | sim | sim |
| PROFESSOR | sim | sim | sim | sim | sim |
| TUTOR | não | sim (somente leitura) | não | não | não |
| COORDENACAO, SECRETARIA | não | não | não | não | não |

O estudante vê os canais das turmas em que está matriculado; o tutor, os das turmas dos tutorados; o docente, o canal **Geral** das turmas em que leciona e o canal de **cada disciplina que leciona** (não os das colegas).

## Rotas

| Método e rota | O que faz |
| --- | --- |
| `GET /mensagens/resumo` | Total de não lidas (canais + conversas) para o selo da aba. |
| `GET /mensagens/contatos?q=` | Pessoas com quem se pode conversar: quem divide uma turma com você (até 100). |
| `GET /mensagens/conversas` | Conversas da pessoa, da mais recente para a mais antiga, com última mensagem e `naoLidas`. |
| `POST /mensagens/conversas` | Cria conversa: `{ participanteIds: uuid[], titulo? }`. Um participante = direta; mais = grupo (título obrigatório). A direta é **idempotente**: o mesmo par recebe sempre a mesma conversa, mesmo com criação simultânea. |
| `GET /mensagens/conversas/:id` | Uma conversa (cabeçalho). |
| `GET /mensagens/conversas/:id/mensagens?limite=&antes=` | Mensagens em ordem cronológica. `limite` 1–100 (padrão 50); `antes` é o **id** da mensagem mais antiga já carregada. Resposta: `{ itens, temMais }`. |
| `POST /mensagens/conversas/:id/mensagens` | `{ texto?, arquivoId? }` — texto ou anexo. |
| `PUT /mensagens/conversas/:id/leitura` | Marca a conversa como lida. |
| `GET /mensagens/canais` | Canais visíveis, com última atividade, `naoLidas` e `podePublicar`. O id do canal é `turmaId:geral` ou `turmaId:disciplinaId`. |
| `GET /mensagens/canais/:canal/publicacoes?limite=&antes=` | Publicações do canal (mesma paginação por id). Inclui `podePublicar` e `podeResponder`. |
| `POST /mensagens/canais/:canal/publicacoes` | `{ texto, importante?, arquivoId? }` — só PROFESSOR com acesso ao canal. |
| `PUT /mensagens/canais/:canal/leitura` | Marca o canal como lido. |
| `GET /mensagens/publicacoes/:id` | Publicação com as respostas (até 500). |
| `POST /mensagens/publicacoes/:id/respostas` | `{ texto?, arquivoId? }`. |
| `POST /mensagens/curtidas` | `{ tipo: MENSAGEM \| PUBLICACAO \| RESPOSTA, id }` — alterna a curtida e devolve `{ curtidas, curtidaPorMim }`. |

Relacionadas, fora de `/mensagens`:

- `GET /academico/avisos` agora traz `turmaId` em cada evento.
- `GET` e `PUT /academico/avisos/leitura` guardam "visto até" da aba Atividade **por pessoa**. O `PUT` aceita `{ ate? }` (data do aviso mais recente exibido); o servidor nunca recua o valor nem aceita instante futuro.

## Não lidas

- Sem registro de leitura, só contam mensagens dos últimos **30 dias**; ninguém recebe um número gigante por histórico antigo.
- O que a própria pessoa escreveu nunca conta como não lido para ela.
- No canal, conta publicação **e** resposta de outra pessoa depois da última leitura do canal.
- Abrir uma conversa, um canal ou o fio de uma publicação marca como lido (o app chama `PUT …/leitura`).

## Anexos

Enviam-se antes por `POST /arquivos` (PDF, DOCX, PPTX ou ODT, até 10 MB) e referenciam-se por `arquivoId`; só se anexa um arquivo **enviado pela própria pessoa**. `GET /arquivos/:id` passou a liberar o anexo para quem vê a mensagem: participantes da conversa, ou quem enxerga o canal da publicação. Docente sem lotação na disciplina não vê os anexos do canal dela.

## Decisões de produto adotadas por padrão — confirmar com o time

Estão em `messages.policy.ts`, num só lugar, para mudar sem mexer no resto.

1. Quem conversa com quem: ALUNO e PROFESSOR, desde que compartilhem **uma turma em andamento**. Tutoria, coordenação e secretaria ficam de fora.
2. Só o docente publica nos canais; estudante e docente respondem.
3. **Turma fechada**: canais viram somente leitura e não se abrem conversas novas; conversas já existentes continuam recebendo mensagens.
4. Limites: 2.000 caracteres por mensagem, grupos de até 20 pessoas.
5. Sem edição nem exclusão de mensagens, sem moderação e sem retenção/expurgo automático.
6. Auditoria registra apenas criar conversa e publicar em canal (mensagens comuns não são auditadas).

## Banco

Migração aditiva `20261108010000_mensagens`: `conversa`, `conversa_participante`, `mensagem`, `publicacao`, `resposta_publicacao`, `curtida_mensagem`, `curtida_publicacao`, `curtida_resposta`, `leitura_canal` e `leitura_avisos`. Chaves compostas `(instituicaoId, id)` impedem misturar instituições. `CHECK`s garantem que toda mensagem tenha texto ou anexo, toda publicação tenha texto, e que conversa direta tenha a chave do par (grupo, o título).

## O que não existe (de propósito)

- **Notificação push.** Exige credenciais do Expo/FCM e aparelhos; o app consulta por *polling* (resumo a cada 30 s; telas abertas a cada 8–15 s, só enquanto em foco). O limitador é de 60 requisições/min por rota e por IP.
- Tempo real (WebSocket), busca no texto das mensagens, edição/exclusão, "digitando…", confirmação de leitura por pessoa.

## Testes

- Unidade (regras puras): `npm test` — `src/messages/messages.policy.spec.ts`.
- Integração (Postgres e API reais): `npm run test:integration:messages` com a API no ar e o banco local. Cobre permissões por perfil, isolamento entre instituições, idempotência e concorrência, paginação, não lidas, anexos, turma fechada, leitura de avisos e as restrições do banco. Cria contas e dados próprios e remove só o que criou. O login limita 5/min, então o teste espera cerca de um minuto no início.
- Contêiner de desenvolvimento: defina `TEST_DB_IN_NETWORK=true` (banco acessado como `db`) e `TEST_UPLOAD_DIR` (pasta de uploads da API) quando o teste rodar na mesma rede da API.
