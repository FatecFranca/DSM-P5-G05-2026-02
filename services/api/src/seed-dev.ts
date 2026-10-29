import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { readDevSeedConfig } from './config/dev-seed-config';
import { seedDevelopment } from './dev-seed';
import { PrismaClient } from './generated/prisma/client';

async function main() {
  const config = readDevSeedConfig(process.env);
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: config.databaseUrl }),
  });
  try {
    await seedDevelopment(prisma, config);
    process.stdout.write('Dados demonstrativos das quatro Fatecs prontos.\n');
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch(() => {
  process.stderr.write(
    'Falha na carga de desenvolvimento; confira a configuração e as migrações.\n',
  );
  process.exitCode = 1;
});
