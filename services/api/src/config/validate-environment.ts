import { isPostgresUrl } from './postgres-url';

export function validateEnvironment(values: Record<string, unknown>) {
  const databaseUrl =
    typeof values.DATABASE_URL === 'string' ? values.DATABASE_URL : '';
  const jwtSecret =
    typeof values.JWT_SECRET === 'string' ? values.JWT_SECRET : '';
  const port = Number(values.PORT ?? 3000);

  if (!isPostgresUrl(databaseUrl)) {
    throw new Error('DATABASE_URL deve ser uma URL PostgreSQL');
  }
  if (jwtSecret.length < 32) {
    throw new Error('JWT_SECRET deve ter pelo menos 32 caracteres');
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT inválida');
  }

  return {
    ...values,
    DATABASE_URL: databaseUrl,
    JWT_SECRET: jwtSecret,
    PORT: port,
  };
}
