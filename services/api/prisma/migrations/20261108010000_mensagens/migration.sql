-- CreateEnum
CREATE TYPE "TipoConversa" AS ENUM ('DIRETA', 'GRUPO');

-- CreateTable
CREATE TABLE "conversa" (
    "id" UUID NOT NULL,
    "instituicaoId" UUID NOT NULL,
    "tipo" "TipoConversa" NOT NULL,
    "titulo" VARCHAR(120),
    "chaveDireta" VARCHAR(80),
    "criadaPorId" UUID NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversa_participante" (
    "instituicaoId" UUID NOT NULL,
    "conversaId" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "entrouEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lidoAte" TIMESTAMP(3),

    CONSTRAINT "conversa_participante_pkey" PRIMARY KEY ("instituicaoId","conversaId","usuarioId")
);

-- CreateTable
CREATE TABLE "mensagem" (
    "id" UUID NOT NULL,
    "instituicaoId" UUID NOT NULL,
    "conversaId" UUID NOT NULL,
    "autorId" UUID NOT NULL,
    "texto" VARCHAR(2000) NOT NULL,
    "arquivoId" UUID,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mensagem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publicacao" (
    "id" UUID NOT NULL,
    "instituicaoId" UUID NOT NULL,
    "turmaId" UUID NOT NULL,
    "disciplinaId" UUID,
    "autorId" UUID NOT NULL,
    "texto" VARCHAR(2000) NOT NULL,
    "importante" BOOLEAN NOT NULL DEFAULT false,
    "arquivoId" UUID,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "publicacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resposta_publicacao" (
    "id" UUID NOT NULL,
    "instituicaoId" UUID NOT NULL,
    "publicacaoId" UUID NOT NULL,
    "autorId" UUID NOT NULL,
    "texto" VARCHAR(2000) NOT NULL,
    "arquivoId" UUID,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resposta_publicacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "curtida_mensagem" (
    "instituicaoId" UUID NOT NULL,
    "mensagemId" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "curtida_mensagem_pkey" PRIMARY KEY ("instituicaoId","mensagemId","usuarioId")
);

-- CreateTable
CREATE TABLE "curtida_publicacao" (
    "instituicaoId" UUID NOT NULL,
    "publicacaoId" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "curtida_publicacao_pkey" PRIMARY KEY ("instituicaoId","publicacaoId","usuarioId")
);

-- CreateTable
CREATE TABLE "curtida_resposta" (
    "instituicaoId" UUID NOT NULL,
    "respostaId" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "curtida_resposta_pkey" PRIMARY KEY ("instituicaoId","respostaId","usuarioId")
);

-- CreateTable
CREATE TABLE "leitura_canal" (
    "instituicaoId" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "canal" VARCHAR(80) NOT NULL,
    "lidoAte" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leitura_canal_pkey" PRIMARY KEY ("instituicaoId","usuarioId","canal")
);

-- CreateTable
CREATE TABLE "leitura_avisos" (
    "instituicaoId" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "lidoAte" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leitura_avisos_pkey" PRIMARY KEY ("instituicaoId","usuarioId")
);

-- CreateIndex
CREATE UNIQUE INDEX "conversa_instituicaoId_id_key" ON "conversa"("instituicaoId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "conversa_instituicaoId_chaveDireta_key" ON "conversa"("instituicaoId", "chaveDireta");

-- CreateIndex
CREATE INDEX "conversa_participante_instituicaoId_usuarioId_idx" ON "conversa_participante"("instituicaoId", "usuarioId");

-- CreateIndex
CREATE INDEX "mensagem_instituicaoId_conversaId_criadaEm_idx" ON "mensagem"("instituicaoId", "conversaId", "criadaEm");

-- CreateIndex
CREATE UNIQUE INDEX "mensagem_instituicaoId_id_key" ON "mensagem"("instituicaoId", "id");

-- CreateIndex
CREATE INDEX "publicacao_instituicaoId_turmaId_disciplinaId_criadaEm_idx" ON "publicacao"("instituicaoId", "turmaId", "disciplinaId", "criadaEm");

-- CreateIndex
CREATE UNIQUE INDEX "publicacao_instituicaoId_id_key" ON "publicacao"("instituicaoId", "id");

-- CreateIndex
CREATE INDEX "resposta_publicacao_instituicaoId_publicacaoId_criadaEm_idx" ON "resposta_publicacao"("instituicaoId", "publicacaoId", "criadaEm");

-- CreateIndex
CREATE UNIQUE INDEX "resposta_publicacao_instituicaoId_id_key" ON "resposta_publicacao"("instituicaoId", "id");

-- CreateIndex
CREATE INDEX "curtida_mensagem_instituicaoId_usuarioId_idx" ON "curtida_mensagem"("instituicaoId", "usuarioId");

-- CreateIndex
CREATE INDEX "curtida_publicacao_instituicaoId_usuarioId_idx" ON "curtida_publicacao"("instituicaoId", "usuarioId");

-- CreateIndex
CREATE INDEX "curtida_resposta_instituicaoId_usuarioId_idx" ON "curtida_resposta"("instituicaoId", "usuarioId");

-- AddForeignKey
ALTER TABLE "conversa" ADD CONSTRAINT "conversa_instituicaoId_criadaPorId_fkey" FOREIGN KEY ("instituicaoId", "criadaPorId") REFERENCES "usuario"("instituicao_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversa_participante" ADD CONSTRAINT "conversa_participante_instituicaoId_conversaId_fkey" FOREIGN KEY ("instituicaoId", "conversaId") REFERENCES "conversa"("instituicaoId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversa_participante" ADD CONSTRAINT "conversa_participante_instituicaoId_usuarioId_fkey" FOREIGN KEY ("instituicaoId", "usuarioId") REFERENCES "usuario"("instituicao_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensagem" ADD CONSTRAINT "mensagem_instituicaoId_conversaId_fkey" FOREIGN KEY ("instituicaoId", "conversaId") REFERENCES "conversa"("instituicaoId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensagem" ADD CONSTRAINT "mensagem_instituicaoId_autorId_fkey" FOREIGN KEY ("instituicaoId", "autorId") REFERENCES "usuario"("instituicao_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensagem" ADD CONSTRAINT "mensagem_instituicaoId_arquivoId_fkey" FOREIGN KEY ("instituicaoId", "arquivoId") REFERENCES "arquivo"("instituicaoId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publicacao" ADD CONSTRAINT "publicacao_instituicaoId_turmaId_fkey" FOREIGN KEY ("instituicaoId", "turmaId") REFERENCES "turma"("instituicaoId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publicacao" ADD CONSTRAINT "publicacao_instituicaoId_disciplinaId_fkey" FOREIGN KEY ("instituicaoId", "disciplinaId") REFERENCES "disciplina"("instituicaoId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publicacao" ADD CONSTRAINT "publicacao_instituicaoId_autorId_fkey" FOREIGN KEY ("instituicaoId", "autorId") REFERENCES "usuario"("instituicao_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publicacao" ADD CONSTRAINT "publicacao_instituicaoId_arquivoId_fkey" FOREIGN KEY ("instituicaoId", "arquivoId") REFERENCES "arquivo"("instituicaoId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resposta_publicacao" ADD CONSTRAINT "resposta_publicacao_instituicaoId_publicacaoId_fkey" FOREIGN KEY ("instituicaoId", "publicacaoId") REFERENCES "publicacao"("instituicaoId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resposta_publicacao" ADD CONSTRAINT "resposta_publicacao_instituicaoId_autorId_fkey" FOREIGN KEY ("instituicaoId", "autorId") REFERENCES "usuario"("instituicao_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resposta_publicacao" ADD CONSTRAINT "resposta_publicacao_instituicaoId_arquivoId_fkey" FOREIGN KEY ("instituicaoId", "arquivoId") REFERENCES "arquivo"("instituicaoId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curtida_mensagem" ADD CONSTRAINT "curtida_mensagem_instituicaoId_mensagemId_fkey" FOREIGN KEY ("instituicaoId", "mensagemId") REFERENCES "mensagem"("instituicaoId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curtida_mensagem" ADD CONSTRAINT "curtida_mensagem_instituicaoId_usuarioId_fkey" FOREIGN KEY ("instituicaoId", "usuarioId") REFERENCES "usuario"("instituicao_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curtida_publicacao" ADD CONSTRAINT "curtida_publicacao_instituicaoId_publicacaoId_fkey" FOREIGN KEY ("instituicaoId", "publicacaoId") REFERENCES "publicacao"("instituicaoId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curtida_publicacao" ADD CONSTRAINT "curtida_publicacao_instituicaoId_usuarioId_fkey" FOREIGN KEY ("instituicaoId", "usuarioId") REFERENCES "usuario"("instituicao_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curtida_resposta" ADD CONSTRAINT "curtida_resposta_instituicaoId_respostaId_fkey" FOREIGN KEY ("instituicaoId", "respostaId") REFERENCES "resposta_publicacao"("instituicaoId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curtida_resposta" ADD CONSTRAINT "curtida_resposta_instituicaoId_usuarioId_fkey" FOREIGN KEY ("instituicaoId", "usuarioId") REFERENCES "usuario"("instituicao_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leitura_canal" ADD CONSTRAINT "leitura_canal_instituicaoId_usuarioId_fkey" FOREIGN KEY ("instituicaoId", "usuarioId") REFERENCES "usuario"("instituicao_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leitura_avisos" ADD CONSTRAINT "leitura_avisos_instituicaoId_usuarioId_fkey" FOREIGN KEY ("instituicaoId", "usuarioId") REFERENCES "usuario"("instituicao_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex

-- RenameIndex

-- Restrições que o Prisma não expressa: toda mensagem tem texto ou anexo; toda publicação tem texto;
-- conversa direta tem chave do par, e grupo tem título.
ALTER TABLE "mensagem" ADD CONSTRAINT "mensagem_texto_ou_anexo_check" CHECK (length(btrim("texto")) > 0 OR "arquivoId" IS NOT NULL);
ALTER TABLE "resposta_publicacao" ADD CONSTRAINT "resposta_texto_ou_anexo_check" CHECK (length(btrim("texto")) > 0 OR "arquivoId" IS NOT NULL);
ALTER TABLE "publicacao" ADD CONSTRAINT "publicacao_texto_check" CHECK (length(btrim("texto")) > 0);
ALTER TABLE "conversa" ADD CONSTRAINT "conversa_tipo_check" CHECK (
  ("tipo" = 'DIRETA' AND "chaveDireta" IS NOT NULL) OR ("tipo" = 'GRUPO' AND "chaveDireta" IS NULL AND "titulo" IS NOT NULL)
);
