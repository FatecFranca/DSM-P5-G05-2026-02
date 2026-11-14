import 'dotenv/config';
import * as argon2 from 'argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { readBootstrapConfig } from './config/bootstrap-config';
import { Perfil } from './generated/prisma/enums';
import { PrismaClient } from './generated/prisma/client';

async function bootstrap() {
  const { instituicaoId, instituicaoNome, email, nome, senha, databaseUrl } =
    readBootstrapConfig(process.env);

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });
  try {
    const existing = await prisma.usuario.findUnique({
      where: { instituicaoId_email: { instituicaoId, email } },
      select: { id: true },
    });
    if (existing) {
      throw new Error('Conta de coordenação já existe nesta instituição');
    }
    const senhaHash = await argon2.hash(senha, { type: argon2.argon2id });
    const coordenador = await prisma.$transaction(async (tx) => {
      await tx.instituicao.upsert({
        where: { id: instituicaoId },
        create: { id: instituicaoId, nome: instituicaoNome },
        update: {},
      });
      const created = await tx.usuario.create({
        data: {
          instituicaoId,
          email,
          nome,
          senhaHash,
          perfil: Perfil.COORDENACAO,
        },
        select: { id: true },
      });
      await tx.auditoria.create({
        data: {
          instituicaoId,
          autorId: created.id,
          acao: 'BOOTSTRAP',
          recurso: 'USUARIO',
          recursoId: created.id,
        },
      });
      return created;
    });
    process.stdout.write(
      `Instituição ${instituicaoId}; coordenação ${coordenador.id}\n`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

void bootstrap().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : 'Falha no bootstrap'}\n`,
  );
  process.exitCode = 1;
});
