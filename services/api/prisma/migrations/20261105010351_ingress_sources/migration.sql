-- CreateTable
CREATE TABLE "declaracao_ingresso_ml" (
    "matriculaId" UUID NOT NULL,
    "instituicaoId" UUID NOT NULL,
    "dados" JSONB NOT NULL,
    "revisao" INTEGER NOT NULL DEFAULT 1,
    "pendente" BOOLEAN NOT NULL DEFAULT true,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "declaracao_ingresso_ml_pkey" PRIMARY KEY ("matriculaId")
);

-- CreateTable
CREATE TABLE "fonte_ingresso_ml" (
    "matriculaId" UUID NOT NULL,
    "instituicaoId" UUID NOT NULL,
    "features" JSONB NOT NULL,
    "fonteRef" VARCHAR(200) NOT NULL,
    "revisao" INTEGER NOT NULL DEFAULT 1,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fonte_ingresso_ml_pkey" PRIMARY KEY ("matriculaId")
);

-- CreateIndex
CREATE INDEX "declaracao_ingresso_ml_instituicaoId_pendente_idx" ON "declaracao_ingresso_ml"("instituicaoId", "pendente");

-- CreateIndex
CREATE UNIQUE INDEX "declaracao_ingresso_ml_instituicaoId_matriculaId_key" ON "declaracao_ingresso_ml"("instituicaoId", "matriculaId");

-- CreateIndex
CREATE UNIQUE INDEX "fonte_ingresso_ml_instituicaoId_matriculaId_key" ON "fonte_ingresso_ml"("instituicaoId", "matriculaId");

-- AddForeignKey
ALTER TABLE "declaracao_ingresso_ml" ADD CONSTRAINT "declaracao_ingresso_ml_instituicaoId_matriculaId_fkey" FOREIGN KEY ("instituicaoId", "matriculaId") REFERENCES "matricula"("instituicaoId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fonte_ingresso_ml" ADD CONSTRAINT "fonte_ingresso_ml_instituicaoId_matriculaId_fkey" FOREIGN KEY ("instituicaoId", "matriculaId") REFERENCES "matricula"("instituicaoId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "atributo_ml_evento_instituicaoId_matriculaId_atributo_versaoPer" RENAME TO "atributo_ml_evento_instituicaoId_matriculaId_atributo_versa_idx";

-- CreateTable
CREATE TABLE "previsao_importada_ml" (
    "id" UUID NOT NULL,
    "instituicaoId" UUID NOT NULL,
    "matriculaId" UUID NOT NULL,
    "arquivoSha256" VARCHAR(64) NOT NULL,
    "linha" INTEGER NOT NULL,
    "modelVersion" VARCHAR(100) NOT NULL,
    "perfilVersao" INTEGER NOT NULL,
    "features" JSONB NOT NULL,
    "predictedClass" VARCHAR(30) NOT NULL,
    "probabilities" JSONB NOT NULL,
    "calculadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "autorId" UUID NOT NULL,
    CONSTRAINT "previsao_importada_ml_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "previsao_importada_ml_instituicaoId_matriculaId_arquivoSha2_key" ON "previsao_importada_ml"("instituicaoId", "matriculaId", "arquivoSha256", "modelVersion");
CREATE INDEX "previsao_importada_ml_instituicaoId_matriculaId_calculad_idx" ON "previsao_importada_ml"("instituicaoId", "matriculaId", "calculadoEm");
ALTER TABLE "previsao_importada_ml" ADD CONSTRAINT "previsao_importada_ml_instituicaoId_matriculaId_fkey" FOREIGN KEY ("instituicaoId", "matriculaId") REFERENCES "matricula"("instituicaoId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
