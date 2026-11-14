import assert from 'node:assert/strict';
import test from 'node:test';
import { buildOverview, average } from './overview-model.ts';
import type { AcademicSnapshot } from '../../services/contracts.ts';

const empty = (id: string): AcademicSnapshot => ({ turmaId: id, turmas: [], disciplinas: [], matriculas: [], aulas: [], presencas: [], avaliacoes: [], notas: [], atividades: [], entregas: [], materiais: [], indicadores: [], escala: 10, truncated: false });

test('agrega matrículas com os indicadores calculados pela API', () => {
  const first = empty('turma-1');
  first.turmas = [{ id: 'turma-1', instituicaoId: 'instituicao-1', nome: 'DSM 1', curso: 'DSM', periodo: '2026/2', fechada: false }];
  first.matriculas = [{ id: 'matricula-1', alunoId: 'aluno-1', registro: 'A1', aluno: { nome: 'Estudante Exemplo' } }];
  first.indicadores = [{ matriculaId: 'matricula-1', media: 8, frequencia: 90 }];
  const result = buildOverview(first, [first]);
  assert.equal(result.classes[0].name, 'DSM 1');
  assert.deepEqual(result.enrollments.map(({ average, attendance }) => [average, attendance]), [[8, 90]]);
  assert.equal(average([8, null, 6]), 7);
});

test('rejeita resposta truncada ou de outra turma antes de exibir indicadores', () => {
  const first = empty('turma-1');
  first.turmas = [{ id: 'turma-1', instituicaoId: 'instituicao-1', nome: 'DSM 1', curso: 'DSM', periodo: '2026/2', fechada: false }];
  assert.throws(() => buildOverview(first, [{ ...first, truncated: true }]), /incompleta/);
  assert.throws(() => buildOverview(first, [empty('turma-2')]), /não corresponde/);
});
