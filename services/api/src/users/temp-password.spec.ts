import { TEMP_PASSWORD_LENGTH, generateTempPassword } from './temp-password';

describe('senha temporária', () => {
  it('tem o tamanho pedido e as três classes de caracteres', () => {
    for (let round = 0; round < 200; round++) {
      const password = generateTempPassword();
      expect(password).toHaveLength(TEMP_PASSWORD_LENGTH);
      expect(password).toMatch(/[a-z]/);
      expect(password).toMatch(/[A-Z]/);
      expect(password).toMatch(/[0-9]/);
    }
  });

  it('não usa caracteres ambíguos', () => {
    for (let round = 0; round < 200; round++) {
      expect(generateTempPassword()).not.toMatch(/[01OIl]/);
    }
  });

  it('nunca repete (80 bits de entropia)', () => {
    const seen = new Set(
      Array.from({ length: 2000 }, () => generateTempPassword()),
    );
    expect(seen.size).toBe(2000);
  });

  it('atende o mínimo do cadastro manual (12 caracteres)', () => {
    expect(TEMP_PASSWORD_LENGTH).toBeGreaterThanOrEqual(12);
  });

  it('recusa tamanho curto demais', () => {
    expect(() => generateTempPassword(6)).toThrow(RangeError);
  });
});
