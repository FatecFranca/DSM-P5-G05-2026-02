import assert from 'node:assert/strict';
import test from 'node:test';
import { parseMoney, paymentBody } from './finance.ts';
test('converte reais em centavos sem arredondamento silencioso', () => {
  assert.equal(parseMoney('12,39'), 1239); assert.equal(parseMoney('0.01'), 1);
  for (const value of ['1.999', '-2', '0', '1e3', '1.000,00', '1000000.01']) assert.throws(() => parseMoney(value));
});
test('pagamento exige referência e respeita saldo restante', () => {
  assert.deepEqual(paymentBody('20,50', ' REC-2026-01 ', 2050), { valorCentavos: 2050, referencia: 'REC-2026-01' });
  assert.throws(() => paymentBody('20,51', 'REC-2026-01', 2050));
  assert.throws(() => paymentBody('20', 'abc', 2050));
});
