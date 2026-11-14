# Análise das funcionalidades: quem comanda e quem participa

Feita em 08/11/2026 a partir do código do backend (`services/api`) e do app (`apps/mobile`), não de suposição. A pergunta que guiou tudo: **para cada coisa do sistema, quem a comanda, quem participa dela e onde isso aparece para essas pessoas?**

## 1. Papéis

| Perfil | Em uma frase |
| --- | --- |
| **Coordenação** | Monta a estrutura (turmas, disciplinas, vínculos), cuida de todas as contas, acompanha indicadores e o modelo de previsão. |
| **Secretaria** | Matricula e cadastra estudantes, cuida do financeiro (mensalidades, bolsas) e do ingresso (dados oficiais). Não vê notas nem o diário. |
| **Docente** | Comanda o dia a dia das disciplinas em que está lotado: aulas, frequência, notas, atividades, materiais e o canal da turma. |
| **Tutoria** | Acompanha em leitura os estudantes que lhe foram atribuídos. |
| **Estudante** | Participa: entrega, vê notas e frequência, conversa, paga mensalidade. Não comanda nada além do próprio perfil. |

## 2. Cadeia de dependência (o que precisa existir antes do quê)

```
Fatec (catálogo fixo) → Contas → Turma → Disciplina → Docente lotado na disciplina
                                   └→ Matrícula do estudante (com registro) → (Tutor atribuído)
```

Só depois disso funcionam aula, frequência, nota, atividade, publicação no canal e conversa. **Sem docente lotado e sem matrícula, o docente e o estudante entram no app e não veem nada**, e as mensagens não têm com quem acontecer (a regra de conversa exige uma turma em comum). Por isso o vínculo é o ponto mais crítico do sistema.

## 3. Recurso por recurso

"Comanda" é quem cria e altera. "Participa" é quem usa ou lê. "Onde" é o caminho no app. "Lacuna" é o que falta hoje.

| Recurso | Comanda | Participa | Onde no app | Lacuna |
| --- | --- | --- | --- | --- |
| **Conta** | Coordenação (qualquer); secretaria (estudantes) | a própria pessoa troca a senha | Pessoas → ficha | Cadastro manual não força troca de senha (só importação e redefinição forçam). |
| **Turma** | Coordenação (criar, duração, fechar período) | todos os perfis veem as suas | Turmas | **Não há editar nem excluir.** Criar turma só existe na tela "Área acadêmica", escondida num texto no fim de Turmas. |
| **Disciplina** | Coordenação | docente lotado, estudantes | Área acadêmica | Sem editar/remover. Não aparece dentro da turma como estrutura. |
| **Docente ↔ disciplina** (lotação) | Coordenação | docente | Área acadêmica ("Vincular professor") | **Invisível na turma** (o app nem recebe quem leciona) e **sem desvincular**. |
| **Estudante ↔ turma** (matrícula, com registro) | Coordenação e secretaria | estudante, docente, tutor | Secretaria → Cadastro; Área acadêmica; importação por planilha | A página da turma lista só os matriculados, sem ação. **Sem cancelar nem transferir.** Sem situação da matrícula (ativa, trancada, concluída, evadida), o que importa para um sistema de evasão. |
| **Tutor ↔ estudante** (tutoria) | Coordenação | tutor | Área acadêmica | Invisível; sem desvincular. |
| **Aula e frequência** | Docente lotado | estudante (vê), tutor (lê) | Chamada | OK. |
| **Avaliação e notas** | Docente lotado (publicar) | estudante vê só o publicado | Turma → Notas | OK. |
| **Atividade, entrega, correção** | Docente publica e corrige; estudante entrega | tutor lê | Tarefas; Turma → Tarefas | Verificado só contra API simulada (falta teste de ponta a ponta com arquivo). |
| **Material** | Docente | estudantes baixam | Turma → Arquivos | OK. |
| **Publicações e conversas** | Docente publica nos canais; estudante e docente conversam | tutor lê canais | Mensagens | Sem push, sem baixar anexo no app. |
| **Atividade (feed) e calendário** | derivado dos registros | todos (menos secretaria) | Atividade | OK. |
| **Financeiro** (plano, faturas, pagamentos, bolsas) | Coordenação e secretaria | estudante vê e simula pagamento | Secretaria; **coordenação só pelo menu da conta** | Entrada da coordenação escondida. |
| **Ingresso** (declaração e dados oficiais) | Secretaria homologa | estudante declara; coordenação analisa | Secretaria → Ingresso | Fluxo existe; faltou ensaio de ponta a ponta. |
| **Previsões (modelo)** | Coordenação | docente e tutor leem | Modelo; ficha do estudante | Depende do serviço de ML e do modelo aprovado. |
| **Importações** | Coordenação (contas, previsões, fontes); secretaria (contas de estudantes, fontes semestrais) | — | Pessoas; Secretaria; Cenários | A de previsões ainda usa a senha fixa `Fatec@123`. |

## 4. Achados, do mais grave ao menos

**P0 — impedem usar o sistema de verdade**

1. **A turma não é o centro da gestão, mas deveria ser.** Quem comanda a estrutura precisa abrir uma turma e ver, no mesmo lugar, as disciplinas com seus docentes, os estudantes com seus tutores, e agir ali (matricular, lotar, atribuir tutor). Hoje esses vínculos estão numa tela separada, sem contexto, e o app **nem recebe** a lista de docentes e tutores da turma (o resumo acadêmico não traz lotações nem tutorias).
2. **Vínculo sem desfazer.** Não existe remover matrícula, lotação ou tutoria, nem editar nome de turma ou disciplina. Um erro de digitação ou uma troca de docente só se corrige no banco.
3. **Seta de voltar.** A tela de Pessoas perdeu o "Voltar" no redesenho anterior e várias telas de gestão (Turmas, Painel, Secretaria, Financeiro) não têm uma seta visível e coerente.

**P1 — atrapalham o dia a dia**

4. Cadastro manual de pessoa não obriga a troca da senha digitada pelo administrador.
5. Financeiro da coordenação só aparece pelo menu da conta.
6. A coordenação não enxerga o que está incompleto: turma sem docente, disciplina sem docente, turma sem estudantes.
7. A secretaria não vê estrutura nenhuma: para matricular escolhe a turma por um chip, sem ver quem já está nela.

**P2 — modelo de dados**

8. `curso` é texto solto dentro da turma (sem entidade Curso) e a turma é única por (nome, período). Semestre não é uma entidade.
9. Matrícula não tem situação. Sem isso, "evasão" não tem onde ser registrada.

**P3**

10. Notificação push, baixar anexo de mensagem no app, "esqueci minha senha" por e-mail.

## 5. O que esta rodada resolve

Situação dos itens (verificada no navegador contra a API real, com contas temporárias já removidas):

| # | Item | Situação |
|---|------|----------|
| 1 | Turma como centro da gestão | **Feito.** A aba Pessoas da turma (`/connected/class/:id`) mostra disciplinas com docentes e estudantes com tutores, e a coordenação vincula, desvincula e matricula ali. Turma nova abre direto nessa aba. |
| 2 | Desfazer vínculo | **Feito** para matrícula, docente e tutor (3 rotas `DELETE`, com confirmação na linha). Matrícula só sai se não tiver registros; a API explica o motivo. **Não feito:** renomear turma ou disciplina. |
| 3 | Seta de voltar | **Feito.** "← Voltar" (seta grande + texto, 44 pt) em Pessoas, Turmas, Atividade, Tarefas, Financeiro e na turma. A Secretaria e o Painel são telas-raiz do perfil e não têm voltar. |
| 4 | Troca de senha no cadastro manual | **Feito.** Cadastro manual não pede mais senha: o servidor gera a temporária, mostrada uma vez, e a troca é obrigatória. |
| 5 | Financeiro da coordenação | **Feito.** Link no Painel (além do menu da conta). |
| 6 | O que está incompleto | **Parcial.** Dentro da turma: marca "Sem docente" na disciplina e o roteiro de turma vazia. **Falta** uma visão agregada ("quais turmas estão incompletas") no Painel. |
| 7 | Secretaria sem estrutura | **Feito.** Em Cadastro, escolhe a turma, vê quem já está nela e matricula (conta existente ou nova) ou remove matrícula. |
| 8–10 | Entidade Curso, situação da matrícula, push e e-mail | **Abertos.** Dependem de decisão de produto ou de infraestrutura. |

## Apêndice: quem pode o quê no backend

Extraído dos `@Roles` de cada rota. "Todos" significa os cinco perfis, exceto onde a secretaria é barrada por padrão.

| Rota | Perfis |
| --- | --- |
| `POST /turmas`, `PUT /turmas/:id/duracao`, `PATCH /turmas/:id/fechamento` | Coordenação |
| `POST /disciplinas`, `POST /lotacoes`, `POST /tutorias` | Coordenação |
| `POST /matriculas` | Coordenação, secretaria |
| `GET /turmas` | todos |
| `POST /aulas`, `PUT /aulas/:id/frequencia` | Docente |
| `POST /avaliacoes`, `PUT /avaliacoes/:id/notas`, `POST /avaliacoes/:id/publicar` | Docente |
| `POST /atividades`, `POST /atividades/:id/publicar`, `PUT …/correcao`, `POST /materiais` | Docente |
| `PUT /atividades/:id/entrega` | Estudante |
| `POST /usuarios`, `PATCH /usuarios/:id`, `POST /usuarios/:id/redefinir-senha`, importações | Coordenação, secretaria (estudantes) |
| `/faturas/*`, `/bolsas/*` | Coordenação, secretaria; estudante lê e simula pagamento |
| `/mensagens/*` | Estudante e docente conversam; tutor lê canais |
| `/ml/*` | Coordenação; secretaria (ingresso, fontes); estudante (declaração); docente e tutor leem previsões |
