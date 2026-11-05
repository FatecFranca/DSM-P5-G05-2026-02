CREATE TABLE "bolsa_matricula" (
    "matriculaId" UUID NOT NULL,
    "instituicaoId" UUID NOT NULL,
    "inicio" DATE NOT NULL,
    "fim" DATE,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "estadoAplicado" BOOLEAN NOT NULL DEFAULT false,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "bolsa_matricula_pkey" PRIMARY KEY ("matriculaId"),
    CONSTRAINT "bolsa_matricula_periodo_check" CHECK ("fim" IS NULL OR "fim" >= "inicio")
);

CREATE UNIQUE INDEX "bolsa_matricula_instituicaoId_matriculaId_key"
    ON "bolsa_matricula"("instituicaoId", "matriculaId");
CREATE INDEX "bolsa_matricula_ativa_inicio_fim_idx"
    ON "bolsa_matricula"("ativa", "inicio", "fim");
ALTER TABLE "bolsa_matricula" ADD CONSTRAINT "bolsa_matricula_instituicaoId_matriculaId_fkey"
    FOREIGN KEY ("instituicaoId", "matriculaId") REFERENCES "matricula"("instituicaoId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
