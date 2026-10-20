-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Perfil" AS ENUM ('ADMIN', 'COORDENACAO', 'PROFESSOR', 'TUTOR', 'ALUNO');

-- CreateTable
CREATE TABLE "instituicao" (
    "id" UUID NOT NULL,
    "nome" VARCHAR(160) NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criada_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "instituicao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario" (
    "id" UUID NOT NULL,
    "instituicao_id" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "nome" VARCHAR(160) NOT NULL,
    "senha_hash" VARCHAR(255) NOT NULL,
    "perfil" "Perfil" NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessao" (
    "id" UUID NOT NULL,
    "instituicao_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "expira_em" TIMESTAMP(3) NOT NULL,
    "revogada_em" TIMESTAMP(3),
    "criada_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auditoria" (
    "id" UUID NOT NULL,
    "instituicao_id" UUID NOT NULL,
    "autor_id" UUID,
    "acao" VARCHAR(80) NOT NULL,
    "recurso" VARCHAR(80) NOT NULL,
    "recurso_id" UUID,
    "criada_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuario_instituicao_id_email_key" ON "usuario"("instituicao_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_instituicao_id_id_key" ON "usuario"("instituicao_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "sessao_token_hash_key" ON "sessao"("token_hash");

-- CreateIndex
CREATE INDEX "sessao_usuario_id_revogada_em_idx" ON "sessao"("usuario_id", "revogada_em");

-- CreateIndex
CREATE INDEX "auditoria_instituicao_id_criada_em_idx" ON "auditoria"("instituicao_id", "criada_em");

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessao" ADD CONSTRAINT "sessao_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessao" ADD CONSTRAINT "sessao_instituicao_id_usuario_id_fkey" FOREIGN KEY ("instituicao_id", "usuario_id") REFERENCES "usuario"("instituicao_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_instituicao_id_autor_id_fkey" FOREIGN KEY ("instituicao_id", "autor_id") REFERENCES "usuario"("instituicao_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
