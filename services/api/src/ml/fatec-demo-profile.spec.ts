import {
  FATEC_DEMO_REGISTRATIONS,
  fatecDemoProfile,
} from './fatec-demo-profile';
import { ML_FEATURES } from './ml.types';
import { validProfile } from './profile-validation';

describe('perfis sintéticos das Fatecs demonstrativas', () => {
  it('gera os 36 atributos válidos e estáveis, com resultados acadêmicos distintos', () => {
    const profiles = FATEC_DEMO_REGISTRATIONS.map(fatecDemoProfile);
    expect(profiles).toHaveLength(4);
    for (const [index, profile] of profiles.entries()) {
      expect(Object.keys(profile)).toHaveLength(ML_FEATURES.length);
      expect(ML_FEATURES.every((name) => Number.isFinite(profile[name]))).toBe(
        true,
      );
      expect(validProfile(profile)).toBe(true);
      expect(fatecDemoProfile(FATEC_DEMO_REGISTRATIONS[index])).toEqual(
        profile,
      );
      expect(profile.nacionalidade).toBe(41);
    }
    expect(
      new Set(profiles.map((profile) => profile.ucs_2sem_aprovadas)).size,
    ).toBe(4);
  });

  it('recusa geração para uma matrícula fora das quatro contas fictícias', () => {
    expect(() => fatecDemoProfile('MATRICULA-REAL')).toThrow();
  });
});
