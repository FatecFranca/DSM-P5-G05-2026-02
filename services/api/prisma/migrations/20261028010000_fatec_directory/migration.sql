-- Catálogo inicial das quatro Fatecs usadas no SGEI.
ALTER TABLE "instituicao" ADD COLUMN "codigo_cps" VARCHAR(3);
CREATE UNIQUE INDEX "instituicao_codigo_cps_key" ON "instituicao"("codigo_cps");

INSERT INTO "instituicao" ("id", "nome", "codigo_cps") VALUES
  (gen_random_uuid(), 'Fatec Franca – Dr. Thomaz Novelino', '109'),
  (gen_random_uuid(), 'Fatec São Paulo', '002'),
  (gen_random_uuid(), 'Fatec Campinas', '276'),
  (gen_random_uuid(), 'Fatec Ribeirão Preto', '284')
ON CONFLICT ("codigo_cps") DO UPDATE SET "nome" = EXCLUDED."nome";
