import assert from 'node:assert/strict';
import test from 'node:test';
import { ML_FIELD_LABELS, ML_SYNTHETIC_EXAMPLE, parseMlFeatures, parseOriginalMlFields } from './ml.ts';

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

test('exemplo fictício fornece os 36 campos identificados, sem classe nem dados pessoais', () => {
  const names = Object.keys(ML_FIELD_LABELS);
  assert.equal(names.length, 36);
  assert.deepEqual(parseMlFeatures(JSON.stringify(ML_SYNTHETIC_EXAMPLE), names), ML_SYNTHETIC_EXAMPLE);
});
