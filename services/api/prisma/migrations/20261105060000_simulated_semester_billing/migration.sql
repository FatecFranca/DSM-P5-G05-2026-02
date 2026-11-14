ALTER TABLE "turma" ADD COLUMN "duracaoSemestres" INTEGER NOT NULL DEFAULT 6;
ALTER TABLE "fatura" ADD COLUMN "semestre" INTEGER;
ALTER TABLE "pagamento_fatura" ADD COLUMN "simulado" BOOLEAN NOT NULL DEFAULT false;

UPDATE "fatura" AS f
SET "semestre" = 1 + (
  (EXTRACT(YEAR FROM f."competencia")::int - EXTRACT(YEAR FROM p."inicioCompetencia")::int) * 12
  + EXTRACT(MONTH FROM f."competencia")::int - EXTRACT(MONTH FROM p."inicioCompetencia")::int
) / 6
FROM "plano_mensalidade" AS p
WHERE p."matriculaId" = f."matriculaId"
  AND p."instituicaoId" = f."instituicaoId"
  AND f."competencia" >= p."inicioCompetencia";
