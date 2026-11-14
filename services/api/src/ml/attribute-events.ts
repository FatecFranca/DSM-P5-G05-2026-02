import type { Prisma } from '../generated/prisma/client';
import { ML_FEATURES } from './ml.types';

export type AttributeOrigin =
  | 'CADASTRO_INSTITUCIONAL'
  | 'AUTODECLARACAO'
  | 'FINANCEIRO'
  | 'BOLSA'
  | 'ACADEMICO_OFICIAL'
  | 'MACRO_OFICIAL'
  | 'INGRESSO_OFICIAL'
  | 'SEMENTE_DEMO';

type AttributeName = (typeof ML_FEATURES)[number];

interface AttributeChange {
  instituicaoId: string;
  matriculaId: string;
  before: Record<string, number>;
  after: Record<string, number>;
  versaoPerfil: number;
  origem: AttributeOrigin;
  autorId?: string;
  atributos?: readonly AttributeName[];
}

export async function recordAttributeChanges(
  tx: Prisma.TransactionClient,
  change: AttributeChange,
) {
  const data = (change.atributos ?? ML_FEATURES)
    .filter((atributo) => change.before[atributo] !== change.after[atributo])
    .map((atributo) => ({
      instituicaoId: change.instituicaoId,
      matriculaId: change.matriculaId,
      atributo,
      valorAnterior: change.before[atributo] ?? null,
      valorAtual: change.after[atributo] ?? null,
      origem: change.origem,
      autorId: change.autorId ?? null,
      versaoPerfil: change.versaoPerfil,
    }));
  if (data.length) await tx.atributoMlEvento.createMany({ data });
  return data.length;
}
