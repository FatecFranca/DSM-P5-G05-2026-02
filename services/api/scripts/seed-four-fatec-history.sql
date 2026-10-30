-- Fixtures acadêmicas pequenas para as quatro turmas SGEI-DEMO existentes.
-- Não reutilizar como dados de treinamento ou validação de ML.
BEGIN;

CREATE TEMP TABLE history_fixture ON COMMIT DROP AS
SELECT i.id AS instituicao_id, d.id AS disciplina_id, m.id AS matricula_id,
       gen_random_uuid() AS aula_id, gen_random_uuid() AS avaliacao_id
FROM instituicao i
JOIN turma t ON t."instituicaoId" = i.id AND t.nome = 'Turma Demo SGEI'
JOIN disciplina d ON d."turmaId" = t.id AND d.nome = 'Fundamentos de Gestão'
JOIN matricula m ON m."turmaId" = t.id AND m.registro = 'SGEI-DEMO-' || i.codigo_cps
WHERE i.codigo_cps IN ('109', '002', '276', '284');

DO $$
BEGIN
  IF (SELECT count(*) FROM history_fixture) <> 4
     OR EXISTS (SELECT 1 FROM aula WHERE "instituicaoId" IN (SELECT instituicao_id FROM history_fixture))
     OR EXISTS (SELECT 1 FROM avaliacao WHERE "instituicaoId" IN (SELECT instituicao_id FROM history_fixture))
  THEN RAISE EXCEPTION 'Fixtures acadêmicas divergentes: nenhuma alteração aplicada'; END IF;
END $$;

INSERT INTO aula (id, "instituicaoId", "disciplinaId", data, tema)
SELECT aula_id, instituicao_id, disciplina_id, '2026-10-20T14:00:00', 'Aula demonstrativa de fundamentos'
FROM history_fixture;

INSERT INTO presenca ("instituicaoId", "aulaId", "matriculaId", situacao, "atualizadoEm")
SELECT instituicao_id, aula_id, matricula_id, 'PRESENTE', now()
FROM history_fixture;

INSERT INTO avaliacao (id, "instituicaoId", "disciplinaId", titulo, peso, "notaMaxima", data, publicada, "publicadaEm")
SELECT avaliacao_id, instituicao_id, disciplina_id, 'Avaliação demonstrativa', 1, 10,
       '2026-10-21T14:00:00', true, '2026-10-22T14:00:00'
FROM history_fixture;

INSERT INTO nota ("instituicaoId", "avaliacaoId", "matriculaId", valor, "atualizadoEm")
SELECT instituicao_id, avaliacao_id, matricula_id, 8, now()
FROM history_fixture;

COMMIT;
