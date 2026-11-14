import { randomInt } from 'node:crypto';

// Senha temporária entregue uma única vez a quem administra a conta; a pessoa é obrigada a trocá-la no
// primeiro acesso. Sem caracteres ambíguos (0/O, 1/l/I) para facilitar a digitação no celular.
const LOWER = 'abcdefghijkmnpqrstuvwxyz';
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGITS = '23456789';
const ALL = LOWER + UPPER + DIGITS;

export const TEMP_PASSWORD_LENGTH = 14;

export function generateTempPassword(length = TEMP_PASSWORD_LENGTH): string {
  if (length < 8) throw new RangeError('Senha temporária curta demais');
  const pick = (set: string) => set[randomInt(set.length)];
  const chars = [pick(LOWER), pick(UPPER), pick(DIGITS)];
  while (chars.length < length) chars.push(pick(ALL));
  // Embaralha, para as três classes obrigatórias não ficarem sempre no começo.
  for (let index = chars.length - 1; index > 0; index--) {
    const other = randomInt(index + 1);
    [chars[index], chars[other]] = [chars[other], chars[index]];
  }
  return chars.join('');
}
