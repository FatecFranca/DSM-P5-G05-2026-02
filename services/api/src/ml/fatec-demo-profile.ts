import { createHash } from 'node:crypto';
import { FATEC_CODES } from '../fatecs';
import type { MlFeatures } from './ml.types';

export const FATEC_DEMO_ML_SOURCE =
  'Demo SGEI: atributos sintéticos do modelo português';

export const FATEC_DEMO_REGISTRATIONS = FATEC_CODES.map(
  (code) => `SGEI-DEMO-${code}`,
);

// Valores estáveis por matrícula: repetir a carga não troca os dados fictícios.
export function fatecDemoProfile(registration: string): MlFeatures {
  const variant = FATEC_DEMO_REGISTRATIONS.indexOf(registration);
  if (variant < 0) throw new Error('Matrícula fora da carga demonstrativa');
  const bytes = createHash('sha256').update(registration).digest();
  const pick = (offset: number, values: readonly number[]) =>
    values[bytes[offset] % values.length];
  const enrolledFirst = 5 + (bytes[0] % 3);
  const enrolledSecond = 5 + (bytes[1] % 3);
  const approvedFirst = [enrolledFirst, enrolledFirst - 1, 2, 1][variant];
  const approvedSecond = [enrolledSecond, enrolledSecond - 2, 1, 0][variant];
  const evaluatedSecond = variant === 3 ? 0 : enrolledSecond + (bytes[2] % 3);
  const debtor = variant === 3 ? 1 : 0;

  return {
    estado_civil: pick(3, [1, 1, 2]),
    modo_candidatura: pick(4, [1, 17, 42]),
    ordem_candidatura: bytes[5] % 4,
    curso: pick(6, [9147, 9119, 9070, 9254]),
    periodo_aula: bytes[7] % 2,
    qualif_anterior: pick(8, [1, 1, 2]),
    nota_qual_anterior: 110 + (bytes[9] % 61),
    nacionalidade: 41,
    qualif_mae: pick(10, [1, 2, 3, 34]),
    qualif_pai: pick(11, [1, 2, 3, 34]),
    ocupacao_mae: pick(12, [1, 4, 5, 9]),
    ocupacao_pai: pick(13, [1, 4, 5, 9]),
    nota_admissao: 110 + (bytes[14] % 61),
    deslocado: bytes[15] % 2,
    necessidades_especiais: 0,
    devedor: debtor,
    mensalidade_em_dia: 1 - debtor,
    genero: bytes[16] % 2,
    bolsista: bytes[17] % 2,
    idade_matricula: 18 + (bytes[18] % 18),
    internacional: 0,
    ucs_1sem_creditadas: bytes[19] % 2,
    ucs_1sem_matriculadas: enrolledFirst,
    ucs_1sem_avaliacoes: enrolledFirst + (bytes[20] % 3),
    ucs_1sem_aprovadas: approvedFirst,
    ucs_1sem_nota: [16.5, 13.5, 9.5, 6.5][variant],
    ucs_1sem_sem_aval: variant >= 2 ? 1 : 0,
    ucs_2sem_creditadas: bytes[21] % 2,
    ucs_2sem_matriculadas: enrolledSecond,
    ucs_2sem_avaliacoes: evaluatedSecond,
    ucs_2sem_aprovadas: approvedSecond,
    ucs_2sem_nota: [17, 12.5, 8, 0][variant],
    ucs_2sem_sem_aval: variant === 3 ? enrolledSecond : 0,
    desemprego: 10.8,
    inflacao: 1.4,
    pib: 1.74,
  };
}
