-- Preserve users and sessions while consolidating the two institutional roles.
ALTER TYPE "Perfil" RENAME TO "Perfil_old";
CREATE TYPE "Perfil" AS ENUM ('COORDENACAO', 'SECRETARIA', 'PROFESSOR', 'TUTOR', 'ALUNO');
ALTER TABLE "usuario" ALTER COLUMN "perfil" TYPE "Perfil" USING (
  CASE "perfil"::text
    WHEN 'ADMIN' THEN 'COORDENACAO'
    WHEN 'FINANCEIRO' THEN 'SECRETARIA'
    ELSE "perfil"::text
  END
)::"Perfil";
DROP TYPE "Perfil_old";
