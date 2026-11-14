import { validProfile } from './profile-validation';
import { demoProfile } from './demo-profiles';

describe('Atributos de matrícula', () => {
  it('aceita perfis demonstrativos completos e cadastros parciais', () => {
    expect(validProfile(demoProfile(0))).toBe(true);
    expect(validProfile(demoProfile(1))).toBe(true);
    expect(validProfile({})).toBe(true);
  });
  it.each([
    { classe: 1 },
    { genero: 2 },
    { pib: null },
    { ucs_1sem_nota: 21 },
    { idade_matricula: 20.5 },
    { nota_admissao: -1 },
  ])('rejeita atributo inválido: %p', (value) => {
    expect(validProfile(value)).toBe(false);
  });
});
