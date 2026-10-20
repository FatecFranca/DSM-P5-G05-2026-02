import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { readDemoSeedConfig } from './config/demo-seed-config';
import { PrismaClient } from './generated/prisma/client';
import { seedDemoUsers } from './demo-seed';

async function seedDemo() {
  const { instituicaoId, instituicaoNome, databaseUrl, users } =
    readDemoSeedConfig(process.env);
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });
  try {
    await seedDemoUsers(prisma, {
      instituicaoId,
      instituicaoNome,
      databaseUrl,
      users,
    });
    process.stdout.write(
      `Contas demonstrativas prontas para instituição ${instituicaoId}\n`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

void seedDemo().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : 'Falha na carga demonstrativa'}\n`,
  );
  process.exitCode = 1;
});
