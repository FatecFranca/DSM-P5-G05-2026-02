-- CreateTable
CREATE TABLE "perfil_ml" (
    "matriculaId" UUID NOT NULL,
    "instituicaoId" UUID NOT NULL,
    "features" JSONB NOT NULL,
    "fonte" VARCHAR(200) NOT NULL DEFAULT 'Cadastro institucional',
    "resultado" JSONB,
    "versao" INTEGER NOT NULL DEFAULT 1,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "perfil_ml_pkey" PRIMARY KEY ("matriculaId")
);

-- CreateIndex
CREATE UNIQUE INDEX "perfil_ml_instituicaoId_matriculaId_key" ON "perfil_ml"("instituicaoId", "matriculaId");

-- AddForeignKey
ALTER TABLE "perfil_ml" ADD CONSTRAINT "perfil_ml_instituicaoId_matriculaId_fkey" FOREIGN KEY ("instituicaoId", "matriculaId") REFERENCES "matricula"("instituicaoId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
