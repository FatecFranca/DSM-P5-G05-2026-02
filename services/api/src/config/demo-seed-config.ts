import { isUUID } from 'class-validator';
import { isPostgresUrl } from './postgres-url';

export const demoUsers = [
  {
    perfil: 'ADMIN',
    nome: 'Administração Demo',
    email: 'admin.demo@sgei.example',
  },
  {
    perfil: 'COORDENACAO',
    nome: 'Coordenação Demo',
    email: 'coordenacao.demo@sgei.example',
  },
  {
    perfil: 'PROFESSOR',
    nome: 'Professor Demo',
    email: 'professor.demo@sgei.example',
  },
  { perfil: 'TUTOR', nome: 'Tutor Demo', email: 'tutor.demo@sgei.example' },
  { perfil: 'ALUNO', nome: 'Estudante Demo', email: 'aluno.demo@sgei.example' },
] as const;

export function readDemoSeedConfig(env: NodeJS.ProcessEnv) {
  const instituicaoId = env.DEMO_INSTITUICAO_ID ?? '';
  const instituicaoNome = (env.DEMO_INSTITUICAO_NOME ?? '').trim();
  const databaseUrl = env.DATABASE_URL ?? '';
  const passwords = demoUsers.map(
    ({ perfil }) => env[`DEMO_${perfil}_PASSWORD`] ?? '',
  );

  if (
    env.NODE_ENV === 'production' ||
    env.DEMO_SEED_ENABLED !== 'true' ||
    !isUUID(instituicaoId) ||
    instituicaoNome.length < 2 ||
    !isPostgresUrl(databaseUrl) ||
    passwords.some(
      (password) => password.length < 12 || password.length > 128,
    ) ||
    new Set(passwords).size !== passwords.length
  ) {
    throw new Error('Configuração da carga demonstrativa inválida');
  }

  return {
    instituicaoId,
    instituicaoNome,
    databaseUrl,
    users: demoUsers.map((user, index) => ({
      ...user,
      senha: passwords[index],
    })),
  };
}
