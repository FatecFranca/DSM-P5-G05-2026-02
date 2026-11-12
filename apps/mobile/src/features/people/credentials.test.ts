import assert from 'node:assert/strict';
import test from 'node:test';
import { credentialsCsv, splitProblems, summaryLines, type Credential } from './credentials.ts';

const item = (over: Partial<Credential> = {}): Credential => ({ linha: 2, nome: 'Ana Lima', email: 'ana@escola.edu', registro: 'R1', senhaTemporaria: 'Ab3dEf5hJk7mNp', ...over });

test('CSV: BOM, ponto e vírgula e cabeçalho em português', () => {
  const csv = credentialsCsv([item()]);
  assert.ok(csv.startsWith('﻿Nome;E-mail;Registro;Senha temporária\r\n'));
  assert.ok(csv.includes('Ana Lima;ana@escola.edu;R1;Ab3dEf5hJk7mNp\r\n'));
});

test('CSV: registro ausente vira célula vazia', () => {
  assert.ok(credentialsCsv([item({ registro: null })]).includes('Ana Lima;ana@escola.edu;;Ab3dEf5hJk7mNp'));
});

test('CSV: campos com separador, aspas ou quebra de linha são protegidos', () => {
  const csv = credentialsCsv([item({ nome: 'Lima; "Ana"\nSouza' })]);
  assert.ok(csv.includes('"Lima; ""Ana""\nSouza"'));
});

test('CSV: texto que viraria fórmula no Excel é neutralizado', () => {
  const csv = credentialsCsv([item({ nome: '=HYPERLINK("http://x")', email: '+cmd@x', registro: '@SUM(A1)' })]);
  assert.ok(!/(^|;)=/.test(csv.split('\r\n')[1]));
  assert.ok(csv.includes("\"'=HYPERLINK(\"\"http://x\"\")\""));
  assert.ok(csv.includes(";'+cmd@x;"));
  assert.ok(csv.includes(";'@SUM(A1);"));
});

test('resumo: singular e plural, e matrículas só quando existem', () => {
  const summary = { linhas: 3, usuariosNovos: 1, usuariosExistentes: 2, matriculasNovas: 1, matriculasExistentes: 0 };
  assert.deepEqual(summaryLines(summary, true), [
    '1 conta nova',
    '2 pessoas já cadastradas (mantêm a senha)',
    '1 matrícula nova',
    '0 matrículas já existentes',
  ]);
  assert.deepEqual(summaryLines(summary, false), ['1 conta nova', '2 pessoas já cadastradas (mantêm a senha)']);
});

test('problemas: separa a frase-resumo das linhas com problema', () => {
  const result = splitProblems('A planilha tem 2 problema(s). Nada foi importado.\nLinha 3: e-mail inválido\nLinha 5: turma "X" não existe\n... e mais 4.');
  assert.equal(result.headline, 'A planilha tem 2 problema(s). Nada foi importado.');
  assert.deepEqual(result.items, [
    { where: 'Linha 3', text: 'e-mail inválido' },
    { where: 'Linha 5', text: 'turma "X" não existe' },
    { where: '', text: '... e mais 4.' },
  ]);
});

test('problemas: erro simples vira só a frase; erro de uma linha não vira título', () => {
  assert.deepEqual(splitProblems('Não foi possível conectar à API.'), { headline: 'Não foi possível conectar à API.', items: [] });
  assert.deepEqual(splitProblems('Linha 2: registro repetido'), { headline: '', items: [{ where: 'Linha 2', text: 'registro repetido' }] });
  assert.deepEqual(splitProblems(''), { headline: '', items: [] });
});
