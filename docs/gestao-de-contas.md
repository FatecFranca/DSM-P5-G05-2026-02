# Gestão de contas

Cadastro, edição, desativação, redefinição de senha e importação em lote de pessoas. Código em `services/api/src/users`
(`users-admin.service.ts`, `people-import.ts`, `temp-password.ts`).

## Quem pode o quê

| Ação | Coordenação | Secretaria |
| --- | --- | --- |
| Cadastrar uma pessoa (`POST /usuarios`) | qualquer perfil | só estudante |
| Editar nome e e-mail (`PATCH /usuarios/:id`) | qualquer pessoa da instituição | só estudantes |
| Desativar e reativar (`PATCH /usuarios/:id` com `ativo`) | qualquer pessoa | só estudantes |
| Redefinir senha (`POST /usuarios/:id/redefinir-senha`) | qualquer pessoa | só estudantes |
| Importar planilha (`POST /usuarios/importacoes`) | estudantes e professores | só estudantes |

Regras que valem sempre:

- Ninguém administra a **própria** conta por essas rotas: não se desativa nem se redefine a própria senha (a senha própria
  se troca em `POST /auth/trocar-senha`).
- Não se desativa a **última coordenação ativa** da instituição.
- O perfil de uma conta não muda por aqui. O e-mail é guardado em minúsculas e é único por instituição (conflito = 409).
- Pessoa de outra instituição, ou fora do alcance do perfil (secretaria e professor), responde **404**.

## Desativar e redefinir senha derrubam o acesso na hora

O acesso confere a sessão e a conta a cada requisição. Desativar ou redefinir a senha **revoga todas as sessões** da pessoa:
a próxima chamada com o token antigo dá 401 e o login com conta inativa falha. Os registros da pessoa (notas, mensagens,
entregas) são mantidos; desativar não apaga nada.

`POST /usuarios/:id/redefinir-senha` gera uma senha temporária aleatória (14 caracteres, sem caracteres ambíguos) e a
devolve **uma única vez** na resposta. A conta passa a exigir a troca no próximo acesso: até lá, só `/auth/me` e
`/auth/trocar-senha` respondem; o resto dá 403. Conta inativa não tem senha redefinida (409): reative antes.

## Importação em lote

`POST /usuarios/importacoes?perfil=ALUNO|PROFESSOR[&simular=true]`, `multipart/form-data` com o campo `arquivo` (`.xlsx`,
até 1 MB, até **200 linhas** por envio). `GET /usuarios/importacoes/modelo?perfil=…` baixa o modelo.

**Formato.** As colunas são lidas **pelo título** (sem diferenciar acento, maiúsculas ou ordem) e as demais são ignoradas.
Por isso a planilha do importador de previsões (a de 45 colunas) também serve.

| Perfil | Colunas lidas | Obrigatórias |
| --- | --- | --- |
| ALUNO | `Registro (matrícula)`, `Nome do aluno`, `E-mail do aluno`, `Turma`, `Curso da turma`, `Período da turma` | nome, e-mail e a coluna de registro; registro só é exigido quando a linha tem turma |
| PROFESSOR | `Nome do professor`, `E-mail do professor` | as duas |

- Turma, curso e período **juntos** apontam uma turma que já exista e esteja aberta; os três vazios criam só a conta.
- A mesma pessoa pode estar em turmas diferentes (um registro por turma).
- Quem já tem conta (mesmo e-mail **e** mesmo nome) mantém a senha e só ganha a matrícula. E-mail de outro perfil, nome
  diferente ou conta inativa são erros.
- Reenviar a mesma planilha é seguro: nada é duplicado e nenhuma senha nova é gerada.

**Tudo ou nada.** A planilha inteira é validada antes de gravar. Com qualquer problema a resposta é 400 com a lista
`Linha N: …` (até 30 linhas) e **nada** é gravado. Com `simular=true` devolve só a contagem do que seria criado.

**Senhas.** Cada conta nova recebe uma senha temporária própria, devolvida **uma vez** em `credenciais` e com troca
obrigatória no primeiro acesso. O servidor guarda apenas o hash. O app permite salvar as senhas em CSV. Como o sistema não
envia e-mail, a entrega das senhas é responsabilidade de quem importa.

Auditoria: `IMPORTAR_USUARIO` e `MATRICULAR_ALUNO` por registro criado; `ATUALIZAR_USUARIO`, `DESATIVAR_USUARIO`,
`REATIVAR_USUARIO` e `REDEFINIR_SENHA` nas demais ações (as senhas nunca entram na auditoria).

## Gestão pela turma: vincular e desvincular

Conta cadastrada ainda não faz parte de nada. Quem estuda, ensina ou acompanha só aparece onde há vínculo, e o vínculo se
monta **na turma** (app: Turmas → turma → aba Pessoas; secretaria: Cadastro → Turmas).

Ordem: turma → disciplinas → docente em cada disciplina (lotação) → estudantes (matrícula) → tutor por estudante (tutoria).

| Ação | Rota | Quem |
|------|------|------|
| Ver participantes da turma (disciplinas com docentes, estudantes com tutores, `permissoes`) | `GET /turmas/:id/participantes` | coordenação, secretaria; docente e tutor só as turmas e estudantes que acompanham |
| Criar turma / disciplina | `POST /turmas`, `POST /disciplinas` | coordenação |
| Matricular / remover matrícula | `POST /matriculas`, `DELETE /matriculas/:id` | coordenação, secretaria |
| Lotar / desvincular docente | `POST /lotacoes`, `DELETE /lotacoes/:disciplinaId/:professorId` | coordenação |
| Vincular / desvincular tutor | `POST /tutorias`, `DELETE /tutorias/:matriculaId/:tutorId` | coordenação |

Regras:

- **Período fechado trava todo vínculo**, inclusive remoção. `permissoes` na resposta já vem falso e o app esconde as ações.
- **Matrícula só é removida se não tiver registros** (presença, nota, entrega, fatura, plano, bolsa e dados de análise).
  Com registros, a API responde 409 explicando e sugere fechar o período. Ao remover, as tutorias dela saem junto.
- Desvincular docente **não apaga** aulas, avaliações e atividades já lançadas: elas continuam na disciplina.
- Todas as alterações passam por transação serializável e deixam auditoria (`REMOVER_MATRICULA`, `DESVINCULAR_PROFESSOR`,
  `DESVINCULAR_TUTOR`); todas ficam restritas à instituição de quem age.

**Cadastro manual** (`POST /usuarios`) não pede mais senha: o servidor gera uma temporária de 14 caracteres, devolve em
`senhaTemporaria` (uma vez) e exige a troca no primeiro acesso. Quem informar `senha` explicitamente (clientes antigos)
também fica com troca obrigatória. Na turma, "Matricular estudante → Novo estudante" cria a conta e a matrícula de uma vez.

## Atenção: o importador de previsões ainda usa senha fixa

`POST /ml/importacoes` (`ml/imports/imports.service.ts`) cria aluno novo com a senha **`Fatec@123`**, igual para todos, e só
funciona com o serviço de ML no ar. Isso não foi alterado nesta entrega por ser outro fluxo do time. Recomendação:
**cadastrar primeiro pela importação de contas** (que gera senha própria) e usar o importador de previsões depois, quando
as pessoas já existem e nenhuma senha padrão é criada. Vale trocar a senha fixa por uma gerada também ali.

## O que não existe

- **"Esqueci minha senha" por conta própria**: depende de envio de e-mail, que o backend não tem. Hoje a recuperação é
  a redefinição pela coordenação ou secretaria.
- Troca de perfil de uma conta, exclusão definitiva de contas e cadastro de tutoria/lotação em lote.
- Renomear turma ou disciplina, remover disciplina, e situação da matrícula (trancada, concluída, evadida).
- Uma visão que liste as turmas incompletas (sem docente, sem estudantes). Hoje a marca "Sem docente" só aparece dentro da turma.
- Importação de coordenação, secretaria e tutoria (cadastro individual continua disponível).

## Testes

- Unidade: `src/users/people-import.spec.ts` (leitura da planilha) e `temp-password.spec.ts`.
- Integração (Postgres e API reais): `npm run test:integration:users`. Cobre edição, desativação com revogação de sessão,
  redefinição com troca obrigatória, importação (simulação, gravação, idempotência, erros por linha, limites, secretaria,
  isolamento entre instituições) e a limpeza do que criou. Em contêiner de desenvolvimento use `TEST_DB_IN_NETWORK=true`.
- Integração da turma: `npm run test:integration:turmas` (68 verificações). Monta a turma pelas rotas, confere o que cada
  perfil enxerga, desvincula docente e tutor, recusa remover matrícula com registros, trava vínculos em período fechado e
  confere o cadastro manual com senha temporária.
