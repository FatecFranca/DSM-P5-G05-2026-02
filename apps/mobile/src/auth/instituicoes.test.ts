import assert from 'node:assert/strict';
import { test } from 'node:test';
import { filterInstituicoes } from './instituicoes.ts';

test('busca instituição por nome sem exigir acentos ou caixa exata', () => {
  const options = [
    { id: '1', nome: 'Fatec São Paulo' },
    { id: '2', nome: 'Fatec Praia Grande' },
  ];
  assert.deepEqual(filterInstituicoes(options, '  SAO paulo '), [options[0]]);
  assert.deepEqual(filterInstituicoes(options, 'inexistente'), []);
});

test('limita sugestões para manter a lista de login utilizável', () => {
  const options = Array.from({ length: 12 }, (_, index) => ({ id: String(index), nome: `Fatec ${index}` }));
  assert.equal(filterInstituicoes(options, 'Fatec').length, 8);
});
