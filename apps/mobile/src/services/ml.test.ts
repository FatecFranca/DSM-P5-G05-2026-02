import assert from 'node:assert/strict';
import test from 'node:test';
import { canReadMl, canEditMl, parsePartialMlFields, parseMlFeatures, parseOriginalMlFields } from './ml.ts';

test('formulário ML preserva zero, decimais e negativos sem preencher ausências', () => {
  assert.deepEqual(parseOriginalMlFields({ pib: '-1,2', ucs_1sem_creditadas: '0' }, ['pib', 'ucs_1sem_creditadas']), { pib: -1.2, ucs_1sem_creditadas: 0 });
  for (const value of ['', ' ', 'Infinity', 'NaN', '1,2,3', '0x10']) {
    assert.throws(() => parseOriginalMlFields({ pib: value }, ['pib']));
  }
  assert.throws(() => parseOriginalMlFields({}, ['pib']));
});

test('JSON tratado preserva escala e rejeita target, campos extras e valores inválidos', () => {
  assert.deepEqual(parseMlFeatures('{"idade_matricula":-0.5}', ['idade_matricula']), { idade_matricula: -0.5 });
  for (const value of ['{}', '[]', 'null', '{"pib":"1"}', '{"pib":null}', '{"pib":1,"classe":"Dropout"}']) {
    assert.throws(() => parseMlFeatures(value, ['pib']));
  }
});

test('cadastro parcial omite ausências, preserva zero e valida categorias', () => {
  const schema = { features: ['pib', 'genero'], categories: { genero: [0, 1] }, classes: [] };
  assert.deepEqual(parsePartialMlFields({ genero: '0', pib: '' }, schema), { genero: 0 });
  assert.throws(() => parsePartialMlFields({ genero: '3' }, schema));
  assert.deepEqual(parsePartialMlFields({ pib: '-1,2' }, schema), { pib: -1.2 });
  for (const [name, value] of [['idade_matricula', '20,5'], ['ucs_1sem_aprovadas', '-1'], ['nota_admissao', '201'], ['ucs_2sem_nota', '21']]) {
    assert.throws(() => parsePartialMlFields({ [name]: value }, { ...schema, features: [name] }));
  }
});

test('interface filtra acesso ao ML sem substituir autorização do servidor', () => {
  assert.equal(canReadMl('ALUNO'), false);
  assert.equal(canReadMl(null), false);
  for (const role of ['ADMIN', 'COORDENACAO', 'PROFESSOR', 'TUTOR']) assert.equal(canReadMl(role), true);
  assert.equal(canEditMl('PROFESSOR'), false);
  assert.equal(canEditMl('TUTOR'), false);
  assert.equal(canEditMl('ADMIN'), true);
  assert.equal(canEditMl('COORDENACAO'), true);
});
