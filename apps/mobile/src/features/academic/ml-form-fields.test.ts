import assert from 'node:assert/strict';
import test from 'node:test';
import { ML_FORM_GROUPS, mlOptions, mlSemesterChoiceLabel } from './ml-form-fields.ts';

test('formulário apresenta cada um dos 36 atributos uma vez', () => {
  const names = ML_FORM_GROUPS.flatMap((group) => group.fields.map(([name]) => name));
  assert.equal(names.length, 36);
  assert.equal(new Set(names).size, 36);
  assert.deepEqual(names.slice(-3), ['desemprego', 'inflacao', 'pib']);
});

test('opções legíveis preservam os códigos aceitos pela API', () => {
  const schema = { features: [], classes: [], categories: { nacionalidade: [1, 41], curso: [9238], genero: [0, 1], bolsista: [0, 1] } };
  assert.deepEqual(mlOptions('nacionalidade', schema), [{ id: '1', label: 'Portuguesa' }, { id: '41', label: 'Brasileira' }]);
  assert.deepEqual(mlOptions('curso', schema), [{ id: '9238', label: 'Serviço Social' }]);
  assert.deepEqual(mlOptions('genero', schema), [{ id: '0', label: 'Feminino' }, { id: '1', label: 'Masculino' }]);
  assert.deepEqual(mlOptions('bolsista', schema), [{ id: '0', label: 'Não' }, { id: '1', label: 'Sim' }]);
  assert.equal(mlOptions('pib', schema), null);
});

test('seleção semestral mostra uma máscara legível sem alterar o valor exato', () => {
  assert.equal(mlSemesterChoiceLabel('ucs_1sem_matriculadas', ''), 'Selecionar valor');
  assert.equal(mlSemesterChoiceLabel('ucs_1sem_matriculadas', '0'), '0 disciplinas');
  assert.equal(mlSemesterChoiceLabel('ucs_2sem_aprovadas', '1'), '1 disciplina');
  assert.equal(mlSemesterChoiceLabel('ucs_1sem_avaliacoes', '2'), '2 avaliações');
  assert.equal(mlSemesterChoiceLabel('ucs_2sem_nota', '15,5'), '15,5 de 20');
});
