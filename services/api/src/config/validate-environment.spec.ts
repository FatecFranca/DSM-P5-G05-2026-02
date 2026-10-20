import { validateEnvironment } from './validate-environment';

describe('validateEnvironment', () => {
  const valid = {
    DATABASE_URL: 'postgresql://sgei:senha@localhost:5432/sgei',
    JWT_SECRET: 's'.repeat(32),
    PORT: '3001',
  };

  it('normaliza a porta e preserva configurações adicionais', () => {
    expect(
      validateEnvironment({ ...valid, ALLOWED_ORIGINS: 'http://localhost' }),
    ).toEqual(
      expect.objectContaining({
        PORT: 3001,
        ALLOWED_ORIGINS: 'http://localhost',
      }),
    );
  });

  it.each([
    'postgresql://',
    'https://localhost/sgei',
    'postgresql://localhost',
  ])('rejeita URL de banco inválida: %s', (databaseUrl) => {
    expect(() =>
      validateEnvironment({ ...valid, DATABASE_URL: databaseUrl }),
    ).toThrow('DATABASE_URL');
  });

  it('rejeita segredo JWT curto', () => {
    expect(() =>
      validateEnvironment({ ...valid, JWT_SECRET: 'curto' }),
    ).toThrow('JWT_SECRET');
  });

  it.each(['0', '65536', '3.5', 'texto'])(
    'rejeita porta inválida: %s',
    (port) => {
      expect(() => validateEnvironment({ ...valid, PORT: port })).toThrow(
        'PORT',
      );
    },
  );
});
