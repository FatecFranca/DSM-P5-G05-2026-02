CREATE TYPE "SituacaoFatura" AS ENUM ('ABERTA', 'VENCIDA', 'QUITADA');

CREATE TABLE "fatura" (
    "id" UUID NOT NULL,
    "instituicaoId" UUID NOT NULL,
    "matriculaId" UUID NOT NULL,
    "competencia" DATE NOT NULL,
    "vencimento" DATE NOT NULL,
    "valorCentavos" INTEGER NOT NULL,
    "pagoCentavos" INTEGER NOT NULL DEFAULT 0,
    "situacao" "SituacaoFatura" NOT NULL DEFAULT 'ABERTA',
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadaEm" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "fatura_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "fatura_valores_validos" CHECK ("valorCentavos" > 0 AND "pagoCentavos" >= 0 AND "pagoCentavos" <= "valorCentavos")
);

CREATE TABLE "pagamento_fatura" (
    "id" UUID NOT NULL,
    "instituicaoId" UUID NOT NULL,
    "faturaId" UUID NOT NULL,
    "referencia" VARCHAR(100) NOT NULL,
    "valorCentavos" INTEGER NOT NULL,
    "recebidoEm" TIMESTAMP(3) NOT NULL,
    "registradoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pagamento_fatura_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "pagamento_fatura_valor_valido" CHECK ("valorCentavos" > 0)
);

CREATE TABLE "plano_mensalidade" (
    "matriculaId" UUID NOT NULL,
    "instituicaoId" UUID NOT NULL,
    "inicioCompetencia" DATE NOT NULL,
    "proximaCompetencia" DATE NOT NULL,
    "fimCompetencia" DATE,
    "valorCentavos" INTEGER NOT NULL,
    "diaVencimento" INTEGER NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "plano_mensalidade_pkey" PRIMARY KEY ("matriculaId"),
    CONSTRAINT "plano_mensalidade_valores_validos" CHECK ("valorCentavos" > 0 AND "diaVencimento" BETWEEN 1 AND 31 AND ("fimCompetencia" IS NULL OR "fimCompetencia" >= "inicioCompetencia"))
);

CREATE UNIQUE INDEX "fatura_instituicaoId_matriculaId_competencia_key" ON "fatura"("instituicaoId", "matriculaId", "competencia");
CREATE UNIQUE INDEX "fatura_instituicaoId_id_key" ON "fatura"("instituicaoId", "id");
CREATE INDEX "fatura_situacao_vencimento_idx" ON "fatura"("situacao", "vencimento");
CREATE UNIQUE INDEX "pagamento_fatura_instituicaoId_referencia_key" ON "pagamento_fatura"("instituicaoId", "referencia");
CREATE INDEX "pagamento_fatura_instituicaoId_faturaId_idx" ON "pagamento_fatura"("instituicaoId", "faturaId");
CREATE UNIQUE INDEX "plano_mensalidade_instituicaoId_matriculaId_key" ON "plano_mensalidade"("instituicaoId", "matriculaId");

ALTER TABLE "fatura" ADD CONSTRAINT "fatura_instituicaoId_matriculaId_fkey" FOREIGN KEY ("instituicaoId", "matriculaId") REFERENCES "matricula"("instituicaoId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pagamento_fatura" ADD CONSTRAINT "pagamento_fatura_instituicaoId_faturaId_fkey" FOREIGN KEY ("instituicaoId", "faturaId") REFERENCES "fatura"("instituicaoId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "plano_mensalidade" ADD CONSTRAINT "plano_mensalidade_instituicaoId_matriculaId_fkey" FOREIGN KEY ("instituicaoId", "matriculaId") REFERENCES "matricula"("instituicaoId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
