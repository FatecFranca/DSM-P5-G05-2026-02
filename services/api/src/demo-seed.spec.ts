import * as argon2 from 'argon2';
import type { PrismaClient } from './generated/prisma/client';
import { readDemoSeedConfig, demoUsers } from './config/demo-seed-config';
import { seedDemoUsers } from './demo-seed';

const env = {
  DEMO_SEED_ENABLED: 'true',
  DEMO_INSTITUICAO_ID: 'b9f8ef92-f5c1-4cb0-9d5d-035112dd75b1',
  DEMO_INSTITUICAO_NOME: 'Instituição Demo',
  DATABASE_URL: 'postgresql://sgei:senha@localhost:5432/sgei',
  ...Object.fromEntries(
    demoUsers.map(({ perfil }, index) => [
      `DEMO_${perfil}_PASSWORD`,
      `senha-forte-${index}-para-demo`,
    ]),
  ),
};

describe('seedDemoUsers', () => {
  it('cria um login por perfil com Argon2id e preserva senhas na reexecução', async () => {
    const config = readDemoSeedConfig(env);
    const stored = new Map<string, { perfil: string; senhaHash: string }>();
    const tx = {
      instituicao: { upsert: jest.fn().mockResolvedValue({}) },
      usuario: {
        findUnique: jest
          .fn()
          .mockImplementation(
            ({
              where,
            }: {
              where: { instituicaoId_email: { email: string } };
            }) => stored.get(where.instituicaoId_email.email) ?? null,
          ),
        create: jest
          .fn()
          .mockImplementation(
            ({
              data,
            }: {
              data: { email: string; perfil: string; senhaHash: string };
            }) => {
              stored.set(data.email, {
                perfil: data.perfil,
                senhaHash: data.senhaHash,
              });
              return data;
            },
          ),
      },
    };
    const prisma = {
      $transaction: (callback: (client: typeof tx) => Promise<void>) =>
        callback(tx),
    } as unknown as PrismaClient;

    await seedDemoUsers(prisma, config);
    expect(stored.size).toBe(5);
    for (const user of config.users) {
      const account = stored.get(user.email);
      expect(account?.perfil).toBe(user.perfil);
      expect(await argon2.verify(account!.senhaHash, user.senha)).toBe(true);
    }
    await seedDemoUsers(prisma, config);
    expect(tx.usuario.create).toHaveBeenCalledTimes(5);
  });
});
