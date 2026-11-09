import { Text, View } from 'react-native';
import { Disclosure, ListRow, Meter, RowList, academicStyles, attendanceBadge, formatAcademicDate, formatAcademicNumber, type AttendanceKind, type BadgeTone } from '@/demo/academic-ui';
import type { AcademicSnapshot, AttendanceStatus } from '@/services/academic';

const kindOf: Record<AttendanceStatus, AttendanceKind> = { PRESENTE: 'present', FALTA: 'absent', FALTA_JUSTIFICADA: 'justified' };
const MAX_ROWS = 20;

const subjectName = (snapshot: AcademicSnapshot, id: string) => snapshot.disciplinas.find((value) => value.id === id)?.nome ?? 'Disciplina';
const byName = (a: { aluno: { nome: string } }, b: { aluno: { nome: string } }) => a.aluno.nome.localeCompare(b.aluno.nome, 'pt-BR');

/**
 * Média e frequência do próprio estudante na turma, como calculadas pela API. Só aparece quando há
 * exatamente uma matrícula no recorte; com várias, um número único enganaria.
 */
export function OwnIndicators({ snapshot, show }: { snapshot: AcademicSnapshot; show: 'media' | 'frequencia' }) {
  const own = snapshot.indicadores.length === 1 ? snapshot.indicadores[0] : null;
  if (!own) return null;
  if (show === 'media' && own.media !== null && snapshot.escala > 0) {
    return <Meter label="Sua média" value={own.media / snapshot.escala} valueLabel={`${formatAcademicNumber(own.media)} de ${snapshot.escala}`} />;
  }
  if (show === 'frequencia' && own.frequencia !== null) {
    return <Meter label="Sua frequência" value={own.frequencia / 100} valueLabel={`${Math.round(own.frequencia)}%`} />;
  }
  return null;
}

/**
 * Estudante: uma linha por avaliação, com a própria nota. Docência e coordenação: cada avaliação
 * expande para a lista de quem tem e quem não tem nota, que é o que se confere ao fechar um período.
 */
export function GradesRecords({ snapshot, student }: { snapshot: AcademicSnapshot; student: boolean }) {
  const assessments = snapshot.avaliacoes.filter((value) => !student || value.publicada).slice(0, MAX_ROWS);
  const missing = snapshot.truncated ? 'Não carregada' : 'Sem nota';
  return <RowList>{assessments.map((assessment) => {
    const grades = snapshot.notas.filter((value) => value.avaliacaoId === assessment.id);
    const where = `${subjectName(snapshot, assessment.disciplinaId)} · ${formatAcademicDate(assessment.data)}`;
    if (student) {
      const own = grades[0];
      return <ListRow
        key={assessment.id}
        title={assessment.titulo}
        meta={`${where} · peso ${assessment.peso} · máx. ${assessment.notaMaxima}`}
        value={own ? formatAcademicNumber(own.valor) : undefined}
        badge={own ? undefined : { text: missing, tone: 'quiet' }} />;
    }
    const count = snapshot.truncated ? `${grades.length} notas carregadas` : `${grades.length} de ${snapshot.matriculas.length} lançadas`;
    return <Disclosure
      key={assessment.id}
      title={assessment.titulo}
      meta={`${where} · ${count}`}
      badge={assessment.publicada ? undefined : { text: 'Rascunho', tone: 'attention' }}>
      <RowList>{[...snapshot.matriculas].sort(byName).map((enrollment) => {
        const grade = grades.find((value) => value.matriculaId === enrollment.id);
        return <ListRow
          key={enrollment.id}
          title={enrollment.aluno.nome}
          meta={`${enrollment.registro} · máx. ${assessment.notaMaxima}`}
          value={grade ? formatAcademicNumber(grade.valor) : undefined}
          badge={grade ? undefined : { text: missing, tone: 'quiet' }} />;
      })}</RowList>
    </Disclosure>;
  })}</RowList>;
}

/**
 * Estudante: uma linha por aula, com a própria presença. Docência e coordenação: cada aula expande
 * para a chamada, e o resumo na linha já diz se houve falta sem precisar abrir.
 */
export function AttendanceRecords({ snapshot, student }: { snapshot: AcademicSnapshot; student: boolean }) {
  const lessons = snapshot.aulas.slice(0, MAX_ROWS);
  return <RowList>{lessons.map((lesson) => {
    const records = snapshot.presencas.filter((entry) => entry.aulaId === lesson.id);
    const where = `${subjectName(snapshot, lesson.disciplinaId)} · ${formatAcademicDate(lesson.data)}`;
    if (student) {
      const own = records[0];
      return <ListRow key={lesson.id} title={lesson.tema} meta={where} badge={attendanceBadge[own ? kindOf[own.situacao] : 'none']} />;
    }
    const absent = records.filter((entry) => entry.situacao === 'FALTA').length;
    const justified = records.filter((entry) => entry.situacao === 'FALTA_JUSTIFICADA').length;
    const summary: { text: string; tone: BadgeTone } = !records.length ? { text: 'Sem registro', tone: 'quiet' }
      : absent ? { text: `${absent} ${absent === 1 ? 'falta' : 'faltas'}`, tone: 'danger' }
        : justified ? { text: `${justified} ${justified === 1 ? 'justificada' : 'justificadas'}`, tone: 'neutral' }
          : { text: 'Sem faltas', tone: 'ok' };
    const people = new Map(snapshot.matriculas.map((enrollment) => [enrollment.id, enrollment.aluno.nome]));
    return <Disclosure key={lesson.id} title={lesson.tema} meta={where} badge={summary}>
      {records.length
        ? <RowList>{[...records].sort((a, b) => (people.get(a.matriculaId) ?? '').localeCompare(people.get(b.matriculaId) ?? '', 'pt-BR')).map((entry) => <ListRow key={entry.matriculaId} title={people.get(entry.matriculaId) ?? 'Estudante'} badge={attendanceBadge[kindOf[entry.situacao]]} />)}</RowList>
        : <View style={academicStyles.stack}><Text style={academicStyles.meta}>Presença ainda não registrada.</Text></View>}
    </Disclosure>;
  })}</RowList>;
}
