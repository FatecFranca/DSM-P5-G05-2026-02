import { ML_FEATURES } from './ml.types';
import { ML_CATEGORIES } from './input-categories';

export function validProfile(value: unknown): value is Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.entries(value).every(([name, item]) => {
    if (
      !ML_FEATURES.includes(name as (typeof ML_FEATURES)[number]) ||
      typeof item !== 'number' ||
      !Number.isFinite(item)
    )
      return false;
    if (ML_CATEGORIES[name] && !ML_CATEGORIES[name].includes(item))
      return false;
    if (
      (name.startsWith('ucs_') && !name.endsWith('_nota')) ||
      ['idade_matricula', 'ordem_candidatura'].includes(name)
    ) {
      if (!Number.isSafeInteger(item) || item < 0) return false;
    }
    if (
      ['nota_admissao', 'nota_qual_anterior'].includes(name) &&
      (item < 0 || item > 200)
    )
      return false;
    if (
      ['ucs_1sem_nota', 'ucs_2sem_nota'].includes(name) &&
      (item < 0 || item > 20)
    )
      return false;
    return true;
  });
}
