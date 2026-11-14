import { isEmail, isUUID } from 'class-validator';
import { isPostgresUrl } from './postgres-url';

export function readBootstrapConfig(env: NodeJS.ProcessEnv) {
  const instituicaoId = env.BOOTSTRAP_INSTITUICAO_ID ?? '';
  const instituicaoNome = (env.BOOTSTRAP_INSTITUICAO_NOME ?? '').trim();
  const email = (env.BOOTSTRAP_COORDENACAO_EMAIL ?? '').trim().toLowerCase();
  const nome = (env.BOOTSTRAP_COORDENACAO_NOME ?? '').trim();
  const senha = env.BOOTSTRAP_COORDENACAO_PASSWORD ?? '';
  const databaseUrl = env.DATABASE_URL ?? '';

  if (
    !isUUID(instituicaoId) ||
    instituicaoNome.length < 2 ||
    !isEmail(email) ||
    nome.length < 2 ||
    senha.length < 12 ||
    !isPostgresUrl(databaseUrl)
  ) {
    throw new Error('Variáveis BOOTSTRAP_* ou DATABASE_URL inválidas');
  }

  return { instituicaoId, instituicaoNome, email, nome, senha, databaseUrl };
}
