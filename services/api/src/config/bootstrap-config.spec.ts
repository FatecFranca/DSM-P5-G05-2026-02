import { randomUUID } from 'node:crypto';
import { readBootstrapConfig } from './bootstrap-config';

describe('readBootstrapConfig', () => {
  const valid = {
    BOOTSTRAP_INSTITUICAO_ID: randomUUID(),
    BOOTSTRAP_INSTITUICAO_NOME: ' Universidade Exemplo ',
    BOOTSTRAP_ADMIN_EMAIL: ' ADMIN@EXEMPLO.COM ',
    BOOTSTRAP_ADMIN_NOME: ' Administrador ',
    BOOTSTRAP_ADMIN_PASSWORD: 'senha-segura-de-teste',
    DATABASE_URL: 'postgresql://sgei:senha@localhost:5432/sgei',
  };

  it('normaliza os dados do primeiro administrador', () => {
    expect(readBootstrapConfig(valid)).toEqual(
      expect.objectContaining({
        instituicaoNome: 'Universidade Exemplo',
        email: 'admin@exemplo.com',
        nome: 'Administrador',
      }),
    );
  });

  it.each([
    { BOOTSTRAP_INSTITUICAO_ID: 'inválido' },
    { BOOTSTRAP_ADMIN_EMAIL: 'inválido' },
    { BOOTSTRAP_ADMIN_PASSWORD: 'curta' },
    { DATABASE_URL: 'https://outro-servico' },
  ])('rejeita configuração inválida: %j', (invalid) => {
    expect(() => readBootstrapConfig({ ...valid, ...invalid })).toThrow(
      'Variáveis BOOTSTRAP_* ou DATABASE_URL inválidas',
    );
  });
});
