CREATE TABLE "previsao_automatica_ml" (
    "id" UUID NOT NULL,
    "instituicaoId" UUID NOT NULL,
    "matriculaId" UUID NOT NULL,
    "modelVersion" VARCHAR(100) NOT NULL,
    "perfilVersao" INTEGER NOT NULL,
    "features" JSONB NOT NULL,
    "predictedClass" VARCHAR(30) NOT NULL,
    "probabilities" JSONB NOT NULL,
    "calculadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "previsao_automatica_ml_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "previsao_automatica_ml_instituicaoId_matriculaId_modelVersao_key"
    ON "previsao_automatica_ml"("instituicaoId", "matriculaId", "modelVersion", "perfilVersao");
CREATE INDEX "previsao_automatica_ml_instituicaoId_calculadoEm_idx"
    ON "previsao_automatica_ml"("instituicaoId", "calculadoEm");
ALTER TABLE "previsao_automatica_ml" ADD CONSTRAINT "previsao_automatica_ml_instituicaoId_matriculaId_fkey"
    FOREIGN KEY ("instituicaoId", "matriculaId") REFERENCES "matricula"("instituicaoId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
