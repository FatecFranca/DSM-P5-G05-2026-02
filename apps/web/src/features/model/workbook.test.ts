import assert from 'node:assert/strict';
import test from 'node:test';
import { MAX_WORKBOOK_BYTES, workbookError } from './workbook.ts';

test('aceita somente planilha Excel não vazia com até 1 MB', () => {
  assert.equal(workbookError({ name: 'turma.XLSX', size: MAX_WORKBOOK_BYTES }), null);
  assert.match(workbookError({ name: 'turma.csv', size: 100 }) ?? '', /\.xlsx/);
  assert.match(workbookError({ name: 'turma.xlsx', size: 0 }) ?? '', /vazia/);
  assert.match(workbookError({ name: 'turma.xlsx', size: MAX_WORKBOOK_BYTES + 1 }) ?? '', /1 MB/);
});
