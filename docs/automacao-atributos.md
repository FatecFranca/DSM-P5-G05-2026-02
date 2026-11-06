# Fonte e gatilho dos 36 atributos do modelo

O treinamento reproduzível usa como referência o **CSV tratado** `dados_preprocessados.csv`. A prévia técnica atual usa o `.pkl` binário fornecido, com os mesmos 36 atributos na escala original. A cada mudança de um atributo válido, a previsão anterior é invalidada. Perfis sintéticos completos recebem prévia demonstrativa; matrículas reais importadas pelo COORDENACAO recebem recálculo **experimental** automático quando seus atributos continuam completos. O uso operacional para alunos reais permanece `INSUFICIENTE` até validação institucional. Os nomes Fatec são apresentação da demonstração e não definem as regras acadêmicas ou financeiras.

| Atributo | Responsável pela fonte | Gatilho e ação pretendida |
| --- | --- | --- |
| `estado_civil` | Aluno declara; secretaria valida correções | Aceitar mudança declarada, guardar origem e invalidar análise. |
| `modo_candidatura` | Secretaria/admissões | Fixar no ingresso; correção do cadastro invalida análise. |
| `ordem_candidatura` | Secretaria/admissões | Fixar no ingresso; correção invalida análise. |
| `curso` | Secretaria | Usar mapeamento versionado entre curso local e código do dataset; transferência exige novo enquadramento e análise. |
| `periodo_aula` | Secretaria, com confirmação do aluno | Mudança de turno validada atualiza o perfil e invalida análise. |
| `qualif_anterior` | Aluno entrega documento; secretaria valida | Registrar no ingresso; correção documentada invalida análise. |
| `nota_qual_anterior` | Secretaria/admissões | Importar da documentação, preservar escala 0–200; correção invalida análise. |
| `nacionalidade` | Aluno declara; secretaria valida | Correção de cadastro invalida análise; não presumir pelo endereço. |
| `qualif_mae` | Aluno declara, se disponível | Atualizar somente com declaração voluntária e código compatível; ausência mantém `INSUFICIENTE`. |
| `qualif_pai` | Aluno declara, se disponível | Mesma regra de `qualif_mae`. |
| `ocupacao_mae` | Aluno declara, se disponível | Mesma regra; não inferir de renda ou profissão do aluno. |
| `ocupacao_pai` | Aluno declara, se disponível | Mesma regra; não inferir de renda ou profissão do aluno. |
| `nota_admissao` | Secretaria/admissões | Fixar no ingresso com escala 0–200; correção invalida análise. |
| `deslocado` | Aluno declara; secretaria valida critério | Mudança validada invalida análise; requer definição institucional compatível com o dataset. |
| `necessidades_especiais` | Aluno declara em fluxo restrito | Só incluir com finalidade, acesso e equivalência definidos; não gerar intervenção adversa. |
| `devedor` | Financeiro, a partir de faturas | **Implementado:** vencimento ou quitação atualiza 1/0 e invalida análise. |
| `mensalidade_em_dia` | Financeiro, a partir de faturas | **Implementado:** vencimento ou quitação atualiza 0/1 e invalida análise. |
| `genero` | Aluno declara; secretaria valida correções | Atualizar somente por declaração, preservar privacidade e invalidar análise. |
| `bolsista` | Financeiro/bolsas | **Implementado:** vigência cadastrada, suspensão e término formal atualizam 1/0, invalidam análise e registram origem `BOLSA`. |
| `idade_matricula` | Secretaria, a partir da data no ingresso | Fixar no ingresso; não envelhecer a cada aniversário. O aluno pode corrigir sua declaração inicial. |
| `internacional` | Secretaria/admissões | Atualizar após validação do vínculo internacional; não inferir só por nacionalidade. |
| `ucs_1sem_creditadas` | Secretaria acadêmica | Homologação do resumo oficial do 1º semestre atualiza e invalida análise. |
| `ucs_1sem_matriculadas` | Secretaria acadêmica | Mesmo evento do resumo oficial do 1º semestre. |
| `ucs_1sem_avaliacoes` | Secretaria acadêmica | Mesmo evento do resumo oficial do 1º semestre. |
| `ucs_1sem_aprovadas` | Secretaria acadêmica | Mesmo evento do resumo oficial do 1º semestre. |
| `ucs_1sem_nota` | Secretaria acadêmica | Mesmo evento, nota oficial na escala 0–20. |
| `ucs_1sem_sem_aval` | Secretaria acadêmica | Mesmo evento do resumo oficial do 1º semestre. |
| `ucs_2sem_creditadas` | Secretaria acadêmica | Homologação do resumo oficial do 2º semestre atualiza e invalida análise. |
| `ucs_2sem_matriculadas` | Secretaria acadêmica | Mesmo evento do resumo oficial do 2º semestre. |
| `ucs_2sem_avaliacoes` | Secretaria acadêmica | Mesmo evento do resumo oficial do 2º semestre. |
| `ucs_2sem_aprovadas` | Secretaria acadêmica | Mesmo evento do resumo oficial do 2º semestre. |
| `ucs_2sem_nota` | Secretaria acadêmica | Mesmo evento, nota oficial na escala 0–20. |
| `ucs_2sem_sem_aval` | Secretaria acadêmica | Mesmo evento do resumo oficial do 2º semestre. |
| `desemprego` | Fonte macroeconômica institucional versionada | Publicação por país e ano reconcilia automaticamente a coorte correspondente. |
| `inflacao` | Fonte macroeconômica institucional versionada | Mesmo evento da fonte macroeconômica. |
| `pib` | Fonte macroeconômica institucional versionada | Mesmo evento da fonte macroeconômica. |

As contagens e médias semestrais são recebidas por um resumo homologado da secretaria, com referência da fonte e revisão otimista. A API atualiza o perfil automaticamente quando esse resumo muda. Ainda não há equivalência explícita entre as disciplinas locais e as unidades curriculares do dataset; portanto, notas locais não preenchem o resumo por aproximação. A secretaria precisa obter o resumo de uma fonte oficial. A publicação macroeconômica exige país, ano e URL da fonte; só alcança matrículas vinculadas à mesma coorte. A publicação não consulta automaticamente o INE nem verifica o conteúdo da URL.

**Proveniência implementada:** cada alteração efetiva nos atributos gera, na mesma transação do perfil, um evento com matrícula, instituição, atributo, valores anterior e atual, origem, autor quando houver, versão do perfil e instante de registro. As origens incluem `FINANCEIRO`, `BOLSA`, `ACADEMICO_OFICIAL` e `MACRO_OFICIAL`. A migração marca os valores preexistentes como `LEGADO` na versão e data conhecidas do perfil; ela não inventa a data da alteração original. O histórico é consultável apenas por COORDENACAO da instituição via `GET /ml/matriculas/:id/atributos/historico`, com paginação. Eventos sem mudança de valor não são criados.
