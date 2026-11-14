import type { InstituicaoOption } from '../services/api';

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function filterInstituicoes(options: InstituicaoOption[], query: string): InstituicaoOption[] {
  const normalizedQuery = normalize(query.trim());
  return options.filter(({ nome }) => normalize(nome).includes(normalizedQuery)).slice(0, 8);
}
