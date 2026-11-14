import * as argon2 from 'argon2';
import type { PrismaClient } from './generated/prisma/client';
import { Perfil } from './generated/prisma/enums';
import type { readDemoSeedConfig } from './config/demo-seed-config';

type DemoConfig = ReturnType<typeof readDemoSeedConfig>;

export async function seedDemoUsers(prisma: PrismaClient, config: DemoConfig) {
  await prisma.$transaction(async (tx) => {
    await tx.instituicao.upsert({
      where: { id: config.instituicaoId },
      create: { id: config.instituicaoId, nome: config.instituicaoNome },
      update: {},
    });
    for (const user of config.users) {
      const existing = await tx.usuario.findUnique({
        where: {
          instituicaoId_email: {
            instituicaoId: config.instituicaoId,
            email: user.email,
          },
        },
        select: { perfil: true },
      });
      if (existing) {
        if (existing.perfil !== user.perfil) {
          throw new Error(`Perfil divergente para ${user.email}`);
        }
        continue;
      }
      await tx.usuario.create({
        data: {
          instituicaoId: config.instituicaoId,
          email: user.email,
          nome: user.nome,
          perfil: Perfil[user.perfil],
          senhaHash: await argon2.hash(user.senha, { type: argon2.argon2id }),
        },
      });
    }
  });
}
