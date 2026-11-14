CREATE TABLE "atributo_ml_evento" (
    "id" UUID NOT NULL,
    "instituicaoId" UUID NOT NULL,
    "matriculaId" UUID NOT NULL,
    "atributo" VARCHAR(40) NOT NULL,
    "valorAnterior" DOUBLE PRECISION,
    "valorAtual" DOUBLE PRECISION,
    "origem" VARCHAR(40) NOT NULL,
    "autorId" UUID,
    "versaoPerfil" INTEGER NOT NULL,
    "registradoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "atributo_ml_evento_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "atributo_ml_evento_valor_check" CHECK ("valorAnterior" IS NOT NULL OR "valorAtual" IS NOT NULL),
    CONSTRAINT "atributo_ml_evento_versao_check" CHECK ("versaoPerfil" > 0)
);

CREATE INDEX "atributo_ml_evento_instituicaoId_matriculaId_versaoPerfil_idx"
    ON "atributo_ml_evento"("instituicaoId", "matriculaId", "versaoPerfil");
CREATE INDEX "atributo_ml_evento_instituicaoId_matriculaId_atributo_versaoPerfil_idx"
    ON "atributo_ml_evento"("instituicaoId", "matriculaId", "atributo", "versaoPerfil");

ALTER TABLE "atributo_ml_evento" ADD CONSTRAINT "atributo_ml_evento_instituicaoId_matriculaId_fkey"
    FOREIGN KEY ("instituicaoId", "matriculaId") REFERENCES "matricula"("instituicaoId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A versão e a data existentes descrevem o estado conhecido, não uma alteração histórica reconstruída.
INSERT INTO "atributo_ml_evento" (
    "id", "instituicaoId", "matriculaId", "atributo", "valorAtual", "origem", "versaoPerfil", "registradoEm"
)
SELECT gen_random_uuid(), p."instituicaoId", p."matriculaId", f.key,
       (f.value #>> '{}')::double precision, 'LEGADO', p."versao", p."atualizadoEm"
FROM "perfil_ml" AS p
CROSS JOIN LATERAL jsonb_each(
    CASE WHEN jsonb_typeof(p."features") = 'object' THEN p."features" ELSE '{}'::jsonb END
) AS f(key, value)
WHERE jsonb_typeof(f.value) = 'number'
  AND f.key IN (
    'estado_civil', 'modo_candidatura', 'ordem_candidatura', 'curso', 'periodo_aula',
    'qualif_anterior', 'nota_qual_anterior', 'nacionalidade', 'qualif_mae', 'qualif_pai',
    'ocupacao_mae', 'ocupacao_pai', 'nota_admissao', 'deslocado', 'necessidades_especiais',
    'devedor', 'mensalidade_em_dia', 'genero', 'bolsista', 'idade_matricula',
    'internacional', 'ucs_1sem_creditadas', 'ucs_1sem_matriculadas', 'ucs_1sem_avaliacoes',
    'ucs_1sem_aprovadas', 'ucs_1sem_nota', 'ucs_1sem_sem_aval', 'ucs_2sem_creditadas',
    'ucs_2sem_matriculadas', 'ucs_2sem_avaliacoes', 'ucs_2sem_aprovadas', 'ucs_2sem_nota',
    'ucs_2sem_sem_aval', 'desemprego', 'inflacao', 'pib'
  );
