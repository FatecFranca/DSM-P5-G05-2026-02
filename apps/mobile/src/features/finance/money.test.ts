import assert from 'node:assert/strict';
import test from 'node:test';
import { parseMoneyToCents } from './money.ts';

test('valor em reais vira centavos sem arredondamento de ponto flutuante', () => {
  assert.equal(parseMoneyToCents('0,01'), 1);
  assert.equal(parseMoneyToCents('1234,50'), 123450);
  assert.equal(parseMoneyToCents('25'), 2500);
  assert.throws(() => parseMoneyToCents('1,999'));
  assert.throws(() => parseMoneyToCents('0'));
  assert.throws(() => parseMoneyToCents('1000000,01'));
});
