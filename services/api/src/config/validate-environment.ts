import { isPostgresUrl } from './postgres-url';

export function validateEnvironment(values: Record<string, unknown>) {
  const databaseUrl =
    typeof values.DATABASE_URL === 'string' ? values.DATABASE_URL : '';
  const jwtSecret =
    typeof values.JWT_SECRET === 'string' ? values.JWT_SECRET : '';
  const port = Number(values.PORT ?? 3000);
  const mlServiceUrl =
    typeof values.ML_SERVICE_URL === 'string' ? values.ML_SERVICE_URL : '';
  const mlServiceToken =
    typeof values.ML_SERVICE_TOKEN === 'string' ? values.ML_SERVICE_TOKEN : '';
  const mlTimeout = Number(values.ML_CLIENT_TIMEOUT_MS ?? 3000);

  if (!isPostgresUrl(databaseUrl)) {
    throw new Error('DATABASE_URL deve ser uma URL PostgreSQL');
  }
  if (jwtSecret.length < 32) {
    throw new Error('JWT_SECRET deve ter pelo menos 32 caracteres');
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT inválida');
  }
  if (mlServiceUrl) {
    let url: URL;
    try {
      url = new URL(mlServiceUrl);
    } catch {
      throw new Error('ML_SERVICE_URL inválida');
    }
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash ||
      mlServiceToken.length < 32
    ) {
      throw new Error('Configuração do serviço de ML inválida');
    }
  }
  if (!Number.isInteger(mlTimeout) || mlTimeout < 100 || mlTimeout > 30000) {
    throw new Error('ML_CLIENT_TIMEOUT_MS inválido');
  }

  return {
    ...values,
    DATABASE_URL: databaseUrl,
    JWT_SECRET: jwtSecret,
    PORT: port,
    ML_SERVICE_URL: mlServiceUrl,
    ML_SERVICE_TOKEN: mlServiceToken,
    ML_CLIENT_TIMEOUT_MS: mlTimeout,
  };
}
