ALTER TABLE "matricula"
    ADD COLUMN "macroPais" VARCHAR(2),
    ADD COLUMN "macroAno" INTEGER,
    ADD COLUMN "macroPendente" BOOLEAN NOT NULL DEFAULT false,
    ADD CONSTRAINT "matricula_macro_coorte_check" CHECK (("macroPais" IS NULL) = ("macroAno" IS NULL));

CREATE INDEX "matricula_instituicaoId_macroPais_macroAno_macroPendente_idx"
    ON "matricula"("instituicaoId", "macroPais", "macroAno", "macroPendente");

CREATE TABLE "resumo_semestre_ml" (
    "instituicaoId" UUID NOT NULL,
    "matriculaId" UUID NOT NULL,
    "semestre" INTEGER NOT NULL,
    "creditadas" INTEGER NOT NULL,
    "matriculadas" INTEGER NOT NULL,
    "avaliacoes" INTEGER NOT NULL,
    "aprovadas" INTEGER NOT NULL,
    "nota" DOUBLE PRECISION NOT NULL,
    "semAvaliacao" INTEGER NOT NULL,
    "fonteRef" VARCHAR(200) NOT NULL,
    "revisao" INTEGER NOT NULL DEFAULT 1,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "resumo_semestre_ml_pkey" PRIMARY KEY ("instituicaoId", "matriculaId", "semestre"),
    CONSTRAINT "resumo_semestre_ml_valores_check" CHECK (
      "semestre" IN (1, 2) AND "creditadas" >= 0 AND "matriculadas" >= 0
      AND "avaliacoes" >= 0 AND "aprovadas" >= 0 AND "semAvaliacao" >= 0
      AND "nota" BETWEEN 0 AND 20 AND length(trim("fonteRef")) > 0
    )
);

ALTER TABLE "resumo_semestre_ml" ADD CONSTRAINT "resumo_semestre_ml_instituicaoId_matriculaId_fkey"
    FOREIGN KEY ("instituicaoId", "matriculaId") REFERENCES "matricula"("instituicaoId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "indicador_macro" (
    "instituicaoId" UUID NOT NULL,
    "pais" VARCHAR(2) NOT NULL,
    "ano" INTEGER NOT NULL,
    "desemprego" DOUBLE PRECISION NOT NULL,
    "inflacao" DOUBLE PRECISION NOT NULL,
    "pib" DOUBLE PRECISION NOT NULL,
    "fonteUrl" VARCHAR(500) NOT NULL,
    "versao" INTEGER NOT NULL DEFAULT 1,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "indicador_macro_pkey" PRIMARY KEY ("instituicaoId", "pais", "ano"),
    CONSTRAINT "indicador_macro_valores_check" CHECK (
      "pais" ~ '^[A-Z]{2}$' AND "ano" BETWEEN 1990 AND 2100
      AND "desemprego" BETWEEN 0 AND 100 AND "inflacao" BETWEEN -100 AND 100
      AND "pib" BETWEEN -100 AND 100 AND "fonteUrl" LIKE 'https://%'
    )
);

ALTER TABLE "indicador_macro" ADD CONSTRAINT "indicador_macro_instituicaoId_fkey"
    FOREIGN KEY ("instituicaoId") REFERENCES "instituicao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
