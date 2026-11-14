import assert from 'node:assert/strict';
import test from 'node:test';
import { assignmentState, daySeparator, deliverySummary, formatFileSize, groupByDay, initials, isDueSoon, listTimeLabel, relativeDay, unreadItems } from './collaboration.ts';

// Quarta-feira, 12h no horário local: evita cruzar a virada do dia nos casos de borda.
const now = new Date(2026, 10, 11, 12, 0, 0).getTime();
const at = (days: number, hour = 12) => new Date(2026, 10, 11 + days, hour, 0, 0).toISOString();

test('situação da tarefa: atribuída, atrasada, enviada e corrigida', () => {
  const open = { estado: 'PUBLICADA' as const, prazo: at(2) };
  const past = { estado: 'PUBLICADA' as const, prazo: at(-1) };
  assert.equal(assignmentState(open, undefined, now), 'assigned');
  assert.equal(assignmentState(past, undefined, now), 'late');
  assert.equal(assignmentState(open, { corrigidaEm: null }, now), 'submitted');
  assert.equal(assignmentState(past, { corrigidaEm: at(-1) }, now), 'graded');
  // Entregar antes do prazo e atrasar depois não pode virar "atrasada".
  assert.equal(assignmentState(past, { corrigidaEm: null }, now), 'submitted');
  assert.equal(assignmentState({ estado: 'ENCERRADA', prazo: at(5) }, undefined, now), 'late');
});

test('dia relativo usa dias de calendário, não janelas de 24 horas', () => {
  assert.equal(relativeDay(at(0, 23), now), 'hoje');
  assert.equal(relativeDay(at(1, 0), now), 'amanhã');
  assert.equal(relativeDay(at(-1, 23), now), 'ontem');
  assert.equal(relativeDay(at(3), now), 'em 3 dias');
  assert.equal(relativeDay(at(-4), now), 'há 4 dias');
  assert.equal(isDueSoon(at(1), now), true);
  assert.equal(isDueSoon(at(2), now), false);
  assert.equal(isDueSoon(at(-1), now), false);
});

test('agrupa por dia, ordena dentro do grupo e omite grupos vazios', () => {
  const items = [
    { id: 'a', data: at(-10) }, { id: 'b', data: at(0, 9) }, { id: 'c', data: at(-1) },
    { id: 'd', data: at(0, 11) }, { id: 'e', data: at(-3) }, { id: 'f', data: at(4) }, { id: 'g', data: at(2) },
  ];
  const groups = groupByDay(items, now);
  assert.deepEqual(groups.map((group) => group.label), ['Próximos', 'Hoje', 'Ontem', 'Esta semana', 'Mais antigas']);
  assert.deepEqual(groups[0].items.map((item) => item.id), ['g', 'f'], 'o prazo mais próximo vem primeiro');
  assert.deepEqual(groups[1].items.map((item) => item.id), ['d', 'b'], 'no passado, o mais recente vem primeiro');
  assert.deepEqual(groupByDay([{ data: at(0) }], now).map((group) => group.key), ['today']);
  assert.deepEqual(groupByDay([], now), []);
});

test('não lidos: só passado depois da última visita, e sem visita não há contagem', () => {
  const items = [{ id: 'novo', data: at(0, 8) }, { id: 'velho', data: at(-2) }, { id: 'prazo', data: at(3) }];
  assert.deepEqual(unreadItems(items, at(-1), now).map((item) => item.id), ['novo']);
  assert.deepEqual(unreadItems(items, at(-5), now).map((item) => item.id), ['novo', 'velho'], 'prazos futuros nunca contam');
  assert.deepEqual(unreadItems(items, null, now), []);
  assert.deepEqual(unreadItems(items, 'data inválida', now), []);
});

test('resumo de entregas conta só a atividade pedida', () => {
  const deliveries = [
    { atividadeId: 'x', corrigidaEm: null }, { atividadeId: 'x', corrigidaEm: at(-1) },
    { atividadeId: 'y', corrigidaEm: null },
  ];
  assert.deepEqual(deliverySummary(deliveries, 'x', 30), { delivered: 2, total: 30, toGrade: 1 });
  assert.deepEqual(deliverySummary(deliveries, 'z', 30), { delivered: 0, total: 30, toGrade: 0 });
});

test('iniciais usam a primeira e a última palavra', () => {
  assert.equal(initials('Ana Beatriz Oliveira'), 'AO');
  assert.equal(initials('  marta  '), 'M');
  assert.equal(initials('élia de Souza'), 'ÉS');
  assert.equal(initials('   '), '?');
  assert.equal(initials('Profa. Helena Duarte'), 'HD', 'tratamento não vira inicial');
  assert.equal(initials('Dr. Silva'), 'S');
  assert.equal(initials('Dra.'), 'D', 'só tratamento: usa o que houver');
});

test('tamanho de arquivo legível e seguro para valores inválidos', () => {
  assert.equal(formatFileSize(850), '850 B');
  assert.equal(formatFileSize(120_000), '117 KB');
  assert.equal(formatFileSize(1_572_864), '1,5 MB');
  assert.equal(formatFileSize(-1), '');
  assert.equal(formatFileSize(Number.NaN), '');
});

test('horário da lista: hora hoje, "Ontem", dia da semana e dd/mm', () => {
  assert.match(listTimeLabel(at(0, 9), now), /^\d{2}:\d{2}$/);
  assert.equal(listTimeLabel(at(-1, 23), now), 'Ontem');
  assert.match(listTimeLabel(at(-3), now), /^[a-zç]{3,}$/i, 'dentro de uma semana vira o dia da semana, sem ponto');
  assert.match(listTimeLabel(at(-10), now), /^\d{2}\/\d{2}$/);
  assert.match(listTimeLabel(at(5), now), /^\d{2}\/\d{2}$/, 'futuro vira data');
});

test('separador de dia da conversa', () => {
  assert.equal(daySeparator(at(0, 8), now), 'Hoje');
  assert.equal(daySeparator(at(-1, 20), now), 'Ontem');
  assert.match(daySeparator(at(-5), now), /\d/, 'antes de ontem traz a data');
});
