-- A migração anterior é preservada porque pode já estar aplicada em outros bancos.
-- Removemos apenas unidades do diretório CPS fora das quatro Fatecs usadas no SGEI.
BEGIN;

DO $$
BEGIN
  IF (
    SELECT COUNT(*)
    FROM "instituicao"
    WHERE "codigo_cps" IN ('109', '002', '276', '284')
  ) <> 4 THEN
    RAISE EXCEPTION 'As quatro Fatecs necessárias não estão cadastradas';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "instituicao" AS i
    WHERE i."codigo_cps" IS NOT NULL
      AND i."codigo_cps" NOT IN ('109', '002', '276', '284')
      AND (
        EXISTS (SELECT 1 FROM "usuario" AS u WHERE u."instituicao_id" = i."id")
        OR EXISTS (SELECT 1 FROM "sessao" AS s WHERE s."instituicao_id" = i."id")
        OR EXISTS (SELECT 1 FROM "auditoria" AS a WHERE a."instituicao_id" = i."id")
        OR EXISTS (SELECT 1 FROM "turma" AS t WHERE t."instituicaoId" = i."id")
      )
  ) THEN
    RAISE EXCEPTION 'Uma Fatec excedente possui dados vinculados; nenhuma instituição foi removida';
  END IF;
END $$;

DELETE FROM "instituicao"
WHERE "codigo_cps" IS NOT NULL
  AND "codigo_cps" NOT IN ('109', '002', '276', '284');

COMMIT;
