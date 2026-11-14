-- CreateEnum
CREATE TYPE "SituacaoPresenca" AS ENUM ('PRESENTE', 'FALTA', 'FALTA_JUSTIFICADA');

-- CreateEnum
CREATE TYPE "EstadoAtividade" AS ENUM ('RASCUNHO', 'PUBLICADA', 'ENCERRADA');

-- CreateTable
CREATE TABLE "turma" (
    "id" UUID NOT NULL,
    "instituicaoId" UUID NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "curso" VARCHAR(120) NOT NULL,
    "periodo" VARCHAR(40) NOT NULL,
    "fechada" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "turma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disciplina" (
    "id" UUID NOT NULL,
    "instituicaoId" UUID NOT NULL,
    "turmaId" UUID NOT NULL,
    "nome" VARCHAR(120) NOT NULL,

    CONSTRAINT "disciplina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matricula" (
    "id" UUID NOT NULL,
    "instituicaoId" UUID NOT NULL,
    "turmaId" UUID NOT NULL,
    "alunoId" UUID NOT NULL,
    "registro" VARCHAR(40) NOT NULL,

    CONSTRAINT "matricula_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lotacao" (
    "instituicaoId" UUID NOT NULL,
    "disciplinaId" UUID NOT NULL,
    "professorId" UUID NOT NULL,

    CONSTRAINT "lotacao_pkey" PRIMARY KEY ("instituicaoId","disciplinaId","professorId")
);

-- CreateTable
CREATE TABLE "tutoria" (
    "instituicaoId" UUID NOT NULL,
    "matriculaId" UUID NOT NULL,
    "tutorId" UUID NOT NULL,

    CONSTRAINT "tutoria_pkey" PRIMARY KEY ("instituicaoId","matriculaId","tutorId")
);

-- CreateTable
CREATE TABLE "aula" (
    "id" UUID NOT NULL,
    "instituicaoId" UUID NOT NULL,
    "disciplinaId" UUID NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "tema" VARCHAR(200) NOT NULL,

    CONSTRAINT "aula_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "presenca" (
    "instituicaoId" UUID NOT NULL,
    "aulaId" UUID NOT NULL,
    "matriculaId" UUID NOT NULL,
    "situacao" "SituacaoPresenca" NOT NULL,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "presenca_pkey" PRIMARY KEY ("instituicaoId","aulaId","matriculaId")
);

-- CreateTable
CREATE TABLE "avaliacao" (
    "id" UUID NOT NULL,
    "instituicaoId" UUID NOT NULL,
    "disciplinaId" UUID NOT NULL,
    "titulo" VARCHAR(160) NOT NULL,
    "peso" DOUBLE PRECISION NOT NULL,
    "notaMaxima" DOUBLE PRECISION NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "publicada" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "avaliacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nota" (
    "instituicaoId" UUID NOT NULL,
    "avaliacaoId" UUID NOT NULL,
    "matriculaId" UUID NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nota_pkey" PRIMARY KEY ("instituicaoId","avaliacaoId","matriculaId")
);

-- CreateTable
CREATE TABLE "atividade" (
    "id" UUID NOT NULL,
    "instituicaoId" UUID NOT NULL,
    "disciplinaId" UUID NOT NULL,
    "titulo" VARCHAR(160) NOT NULL,
    "descricao" VARCHAR(4000) NOT NULL,
    "prazo" TIMESTAMP(3) NOT NULL,
    "notaMaxima" DOUBLE PRECISION NOT NULL,
    "estado" "EstadoAtividade" NOT NULL DEFAULT 'RASCUNHO',

    CONSTRAINT "atividade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arquivo" (
    "id" UUID NOT NULL,
    "instituicaoId" UUID NOT NULL,
    "autorId" UUID NOT NULL,
    "nome" VARCHAR(200) NOT NULL,
    "mime" VARCHAR(100) NOT NULL,
    "tamanho" INTEGER NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "arquivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entrega" (
    "instituicaoId" UUID NOT NULL,
    "atividadeId" UUID NOT NULL,
    "matriculaId" UUID NOT NULL,
    "arquivoId" UUID NOT NULL,
    "enviadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nota" DOUBLE PRECISION,
    "feedback" VARCHAR(4000),
    "corrigidaEm" TIMESTAMP(3),

    CONSTRAINT "entrega_pkey" PRIMARY KEY ("instituicaoId","atividadeId","matriculaId")
);

-- CreateTable
CREATE TABLE "material" (
    "id" UUID NOT NULL,
    "instituicaoId" UUID NOT NULL,
    "disciplinaId" UUID NOT NULL,
    "titulo" VARCHAR(160) NOT NULL,
    "descricao" VARCHAR(4000) NOT NULL,
    "arquivoId" UUID NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "material_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "turma_instituicaoId_id_key" ON "turma"("instituicaoId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "turma_instituicaoId_nome_periodo_key" ON "turma"("instituicaoId", "nome", "periodo");

-- CreateIndex
CREATE UNIQUE INDEX "disciplina_instituicaoId_id_key" ON "disciplina"("instituicaoId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "disciplina_instituicaoId_turmaId_nome_key" ON "disciplina"("instituicaoId", "turmaId", "nome");

-- CreateIndex
CREATE UNIQUE INDEX "matricula_instituicaoId_id_key" ON "matricula"("instituicaoId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "matricula_instituicaoId_turmaId_alunoId_key" ON "matricula"("instituicaoId", "turmaId", "alunoId");

-- CreateIndex
CREATE UNIQUE INDEX "matricula_instituicaoId_registro_key" ON "matricula"("instituicaoId", "registro");

-- CreateIndex
CREATE INDEX "lotacao_instituicaoId_professorId_idx" ON "lotacao"("instituicaoId", "professorId");

-- CreateIndex
CREATE INDEX "tutoria_instituicaoId_tutorId_idx" ON "tutoria"("instituicaoId", "tutorId");

-- CreateIndex
CREATE INDEX "aula_instituicaoId_disciplinaId_data_idx" ON "aula"("instituicaoId", "disciplinaId", "data");

-- CreateIndex
CREATE UNIQUE INDEX "aula_instituicaoId_id_key" ON "aula"("instituicaoId", "id");

-- CreateIndex
CREATE INDEX "avaliacao_instituicaoId_disciplinaId_idx" ON "avaliacao"("instituicaoId", "disciplinaId");

-- CreateIndex
CREATE UNIQUE INDEX "avaliacao_instituicaoId_id_key" ON "avaliacao"("instituicaoId", "id");

-- CreateIndex
CREATE INDEX "atividade_instituicaoId_disciplinaId_idx" ON "atividade"("instituicaoId", "disciplinaId");

-- CreateIndex
CREATE UNIQUE INDEX "atividade_instituicaoId_id_key" ON "atividade"("instituicaoId", "id");

-- CreateIndex
CREATE INDEX "arquivo_instituicaoId_autorId_idx" ON "arquivo"("instituicaoId", "autorId");

-- CreateIndex
CREATE UNIQUE INDEX "arquivo_instituicaoId_id_key" ON "arquivo"("instituicaoId", "id");

-- CreateIndex
CREATE INDEX "material_instituicaoId_disciplinaId_idx" ON "material"("instituicaoId", "disciplinaId");

-- CreateIndex
CREATE UNIQUE INDEX "material_instituicaoId_id_key" ON "material"("instituicaoId", "id");

-- AddForeignKey
ALTER TABLE "turma" ADD CONSTRAINT "turma_instituicaoId_fkey" FOREIGN KEY ("instituicaoId") REFERENCES "instituicao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disciplina" ADD CONSTRAINT "disciplina_instituicaoId_turmaId_fkey" FOREIGN KEY ("instituicaoId", "turmaId") REFERENCES "turma"("instituicaoId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matricula" ADD CONSTRAINT "matricula_instituicaoId_turmaId_fkey" FOREIGN KEY ("instituicaoId", "turmaId") REFERENCES "turma"("instituicaoId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matricula" ADD CONSTRAINT "matricula_instituicaoId_alunoId_fkey" FOREIGN KEY ("instituicaoId", "alunoId") REFERENCES "usuario"("instituicao_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lotacao" ADD CONSTRAINT "lotacao_instituicaoId_disciplinaId_fkey" FOREIGN KEY ("instituicaoId", "disciplinaId") REFERENCES "disciplina"("instituicaoId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lotacao" ADD CONSTRAINT "lotacao_instituicaoId_professorId_fkey" FOREIGN KEY ("instituicaoId", "professorId") REFERENCES "usuario"("instituicao_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutoria" ADD CONSTRAINT "tutoria_instituicaoId_matriculaId_fkey" FOREIGN KEY ("instituicaoId", "matriculaId") REFERENCES "matricula"("instituicaoId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutoria" ADD CONSTRAINT "tutoria_instituicaoId_tutorId_fkey" FOREIGN KEY ("instituicaoId", "tutorId") REFERENCES "usuario"("instituicao_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aula" ADD CONSTRAINT "aula_instituicaoId_disciplinaId_fkey" FOREIGN KEY ("instituicaoId", "disciplinaId") REFERENCES "disciplina"("instituicaoId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presenca" ADD CONSTRAINT "presenca_instituicaoId_aulaId_fkey" FOREIGN KEY ("instituicaoId", "aulaId") REFERENCES "aula"("instituicaoId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presenca" ADD CONSTRAINT "presenca_instituicaoId_matriculaId_fkey" FOREIGN KEY ("instituicaoId", "matriculaId") REFERENCES "matricula"("instituicaoId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avaliacao" ADD CONSTRAINT "avaliacao_instituicaoId_disciplinaId_fkey" FOREIGN KEY ("instituicaoId", "disciplinaId") REFERENCES "disciplina"("instituicaoId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nota" ADD CONSTRAINT "nota_instituicaoId_avaliacaoId_fkey" FOREIGN KEY ("instituicaoId", "avaliacaoId") REFERENCES "avaliacao"("instituicaoId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nota" ADD CONSTRAINT "nota_instituicaoId_matriculaId_fkey" FOREIGN KEY ("instituicaoId", "matriculaId") REFERENCES "matricula"("instituicaoId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atividade" ADD CONSTRAINT "atividade_instituicaoId_disciplinaId_fkey" FOREIGN KEY ("instituicaoId", "disciplinaId") REFERENCES "disciplina"("instituicaoId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arquivo" ADD CONSTRAINT "arquivo_instituicaoId_autorId_fkey" FOREIGN KEY ("instituicaoId", "autorId") REFERENCES "usuario"("instituicao_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entrega" ADD CONSTRAINT "entrega_instituicaoId_atividadeId_fkey" FOREIGN KEY ("instituicaoId", "atividadeId") REFERENCES "atividade"("instituicaoId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entrega" ADD CONSTRAINT "entrega_instituicaoId_matriculaId_fkey" FOREIGN KEY ("instituicaoId", "matriculaId") REFERENCES "matricula"("instituicaoId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entrega" ADD CONSTRAINT "entrega_instituicaoId_arquivoId_fkey" FOREIGN KEY ("instituicaoId", "arquivoId") REFERENCES "arquivo"("instituicaoId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material" ADD CONSTRAINT "material_instituicaoId_disciplinaId_fkey" FOREIGN KEY ("instituicaoId", "disciplinaId") REFERENCES "disciplina"("instituicaoId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material" ADD CONSTRAINT "material_instituicaoId_arquivoId_fkey" FOREIGN KEY ("instituicaoId", "arquivoId") REFERENCES "arquivo"("instituicaoId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
