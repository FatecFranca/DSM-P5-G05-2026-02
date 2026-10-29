import { isPostgresUrl } from './postgres-url';

export function readDevSeedConfig(env: NodeJS.ProcessEnv) {
  const databaseUrl = env.DATABASE_URL ?? '';
  const passwords = {
    ADMIN: env.DEMO_ADMIN_PASSWORD ?? '',
    COORDENACAO: env.DEMO_COORDENACAO_PASSWORD ?? '',
    PROFESSOR: env.DEMO_PROFESSOR_PASSWORD ?? '',
    TUTOR: env.DEMO_TUTOR_PASSWORD ?? '',
    ALUNO: env.DEMO_ALUNO_PASSWORD ?? '',
  };
  const values = Object.values(passwords);

  if (
    env.NODE_ENV === 'production' ||
    env.DEMO_SEED_ENABLED !== 'true' ||
    !isPostgresUrl(databaseUrl) ||
    new URL(databaseUrl).hostname !== 'db' ||
    values.some((password) => password.length < 12 || password.length > 128) ||
    new Set(values).size !== values.length
  ) {
    throw new Error('Configuração da carga de desenvolvimento inválida');
  }

  return { databaseUrl, passwords };
}
