import assert from 'node:assert/strict';
import test from 'node:test';
import type { AcademicSnapshot } from '../../services/academic.ts';
import { studentSubjectData } from './student-subject.ts';

const snapshot: AcademicSnapshot = {
  turmaId: 'turma', turmas: [], disciplinas: [], matriculas: [], materiais: [], indicadores: [], escala: 10, truncated: false,
  aulas: [
    { id: 'a1', disciplinaId: 'materia', data: '2026-11-01', tema: 'Aula 1' },
    { id: 'a2', disciplinaId: 'materia', data: '2026-11-02', tema: 'Aula 2' },
    { id: 'a3', disciplinaId: 'outra', data: '2026-11-03', tema: 'Outra' },
  ],
  presencas: [
    { aulaId: 'a1', matriculaId: 'minha', situacao: 'PRESENTE' },
    { aulaId: 'a2', matriculaId: 'minha', situacao: 'FALTA' },
    { aulaId: 'a1', matriculaId: 'colega', situacao: 'FALTA' },
  ],
  avaliacoes: [
    { id: 'p1', disciplinaId: 'materia', titulo: 'Publicada', peso: 2, notaMaxima: 20, data: '2026-11-01', publicada: true },
    { id: 'r1', disciplinaId: 'materia', titulo: 'Rascunho', peso: 3, notaMaxima: 20, data: '2026-11-02', publicada: false },
  ],
  notas: [{ avaliacaoId: 'p1', matriculaId: 'minha', valor: 16 }, { avaliacaoId: 'p1', matriculaId: 'colega', valor: 20 }],
  atividades: [
    { id: 't1', disciplinaId: 'materia', titulo: 'Trabalho', descricao: '', prazo: '2026-11-10', notaMaxima: 10, estado: 'PUBLICADA' },
    { id: 't2', disciplinaId: 'materia', titulo: 'Rascunho', descricao: '', prazo: '2026-11-10', notaMaxima: 10, estado: 'RASCUNHO' },
  ],
  entregas: [],
};

test('detalhe da disciplina usa apenas registros da matrícula e conteúdo publicado', () => {
  const result = studentSubjectData(snapshot, 'materia', 'minha');
  assert.equal(result.present, 1);
  assert.equal(result.absent, 1);
  assert.equal(result.frequency, 50);
  assert.equal(result.average, 8);
  assert.deepEqual(result.assessments.map((item) => item.assessment.id), ['p1']);
  assert.deepEqual(result.activities.map((item) => item.activity.id), ['t1']);
});
