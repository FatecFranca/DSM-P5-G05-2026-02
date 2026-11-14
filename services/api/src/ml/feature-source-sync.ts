import { ConflictException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import {
  recordAttributeChanges,
  type AttributeOrigin,
} from './attribute-events';
import { validProfile } from './profile-validation';
import { ML_FEATURES } from './ml.types';

export async function applySourceFeatures(
  tx: Prisma.TransactionClient,
  input: {
    instituicaoId: string;
    matriculaId: string;
    patch: Record<string, number | undefined>;
    origem: AttributeOrigin;
    autorId?: string;
  },
) {
  const profile = await tx.perfilMl.findUnique({
    where: { matriculaId: input.matriculaId },
    select: { features: true, versao: true },
  });
  const before = (profile?.features ?? {}) as Record<string, number>;
  const after = { ...before };
  for (const [name, value] of Object.entries(input.patch)) {
    if (value === undefined) delete after[name];
    else after[name] = value;
  }
  if (!validProfile(after))
    throw new ConflictException('Fonte incompatível com o modelo');
  if (Object.keys(input.patch).every((name) => before[name] === after[name]))
    return false;
  if (profile) {
    const updated = await tx.perfilMl.updateMany({
      where: {
        matriculaId: input.matriculaId,
        instituicaoId: input.instituicaoId,
        versao: profile.versao,
      },
      data: {
        features: after,
        versao: { increment: 1 },
        resultado: Prisma.DbNull,
      },
    });
    if (updated.count !== 1)
      throw new ConflictException('Perfil alterado durante a atualização');
  } else {
    await tx.perfilMl.create({
      data: {
        instituicaoId: input.instituicaoId,
        matriculaId: input.matriculaId,
        features: after,
        fonte: input.origem,
      },
    });
  }
  await recordAttributeChanges(tx, {
    instituicaoId: input.instituicaoId,
    matriculaId: input.matriculaId,
    before,
    after,
    versaoPerfil: (profile?.versao ?? 0) + 1,
    origem: input.origem,
    autorId: input.autorId,
    atributos: Object.keys(input.patch) as (typeof ML_FEATURES)[number][],
  });
  return true;
}
