import { readDemoSeedConfig, demoUsers } from './demo-seed-config';

const validEnv = {
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

describe('readDemoSeedConfig', () => {
  it('configura exatamente um usuário por perfil', () => {
    const result = readDemoSeedConfig(validEnv);
    expect(result.users.map(({ perfil }) => perfil)).toEqual(
      demoUsers.map(({ perfil }) => perfil),
    );
  });

  it.each([
    [{ DEMO_SEED_ENABLED: 'false' }],
    [{ NODE_ENV: 'production' }],
    [{ DEMO_ADMIN_PASSWORD: 'curta' }],
    [{ DEMO_ADMIN_PASSWORD: 'senha-forte-1-para-demo' }],
  ])('recusa configuração insegura', (override) => {
    expect(() => readDemoSeedConfig({ ...validEnv, ...override })).toThrow();
  });
});
