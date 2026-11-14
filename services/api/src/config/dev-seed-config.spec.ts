import { readDevSeedConfig } from './dev-seed-config';

const env = {
  NODE_ENV: 'development',
  DEMO_SEED_ENABLED: 'true',
  DATABASE_URL: 'postgresql://sgei:senha@db:5432/sgei',
  DEMO_COORDENACAO_PASSWORD: 'senha-distinta-coordenacao',
  DEMO_SECRETARIA_PASSWORD: 'senha-distinta-secretaria',
  DEMO_PROFESSOR_PASSWORD: 'senha-distinta-professor',
  DEMO_TUTOR_PASSWORD: 'senha-distinta-tutor',
  DEMO_ALUNO_PASSWORD: 'senha-distinta-aluno',
};

describe('readDevSeedConfig', () => {
  it('aceita somente a configuração do banco Docker local', () => {
    expect(readDevSeedConfig(env).passwords.ALUNO).toBe(
      env.DEMO_ALUNO_PASSWORD,
    );
  });

  it.each([
    { NODE_ENV: 'production' },
    { DEMO_SEED_ENABLED: 'false' },
    { DATABASE_URL: 'postgresql://sgei:senha@externo:5432/sgei' },
    { DEMO_COORDENACAO_PASSWORD: 'curta' },
    { DEMO_COORDENACAO_PASSWORD: env.DEMO_ALUNO_PASSWORD },
  ])('recusa configuração inadequada: %p', (override) => {
    expect(() => readDevSeedConfig({ ...env, ...override })).toThrow(
      'Configuração da carga de desenvolvimento inválida',
    );
  });
});
