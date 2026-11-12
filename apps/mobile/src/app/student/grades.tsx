import { Text } from 'react-native';
import { Screen } from '@/components/primitives';
import { demoStudentId, demoStudentSubjects, gradeAverage } from '@/demo/academic';
import { useAcademicDemo } from '@/demo/academic-store';
import { AcademicDemoNotice, AcademicHeader, Disclosure, EmptyState, ListRow, Panel, PanelHeader, RowList, StatStrip, academicStyles, formatAcademicDate, formatAcademicNumber } from '@/demo/academic-ui';

export default function StudentGrades() {
  const { data } = useAcademicDemo();
  const published = data.assessments.filter((item) => demoStudentSubjects.some((subject) => subject.id === item.subjectId) && item.published);
  const gradeOf = (assessmentId: string) => data.grades.find((item) => item.assessmentId === assessmentId && item.studentId === demoStudentId);
  const withGrade = published.filter((item) => gradeOf(item.id)).length;

  return <Screen>
    <AcademicHeader back fallbackHref="/student" title="Minhas notas" subtitle="Somente avaliações publicadas das disciplinas matriculadas." />
    <AcademicDemoNotice />
    {demoStudentSubjects.length ? <>
      <StatStrip items={[
        { label: 'Média publicada', value: formatAcademicNumber(gradeAverage(published, data.grades, demoStudentId)) },
        { label: 'Avaliações com nota', value: `${withGrade} de ${published.length}` },
      ]} />
      <Panel>
        <PanelHeader title="Por disciplina" />
        <RowList>{demoStudentSubjects.map((subject, index) => {
          const assessments = published.filter((item) => item.subjectId === subject.id);
          return <Disclosure
            key={subject.id}
            title={subject.title}
            meta={assessments.length ? `Média ponderada · ${assessments.length} ${assessments.length === 1 ? 'avaliação publicada' : 'avaliações publicadas'}` : 'Nenhuma avaliação publicada'}
            value={formatAcademicNumber(gradeAverage(assessments, data.grades, demoStudentId))}
            defaultExpanded={index === 0}>
            {assessments.length
              ? <RowList>{assessments.map((assessment) => {
                const grade = gradeOf(assessment.id);
                return <ListRow
                  key={assessment.id}
                  title={assessment.title}
                  meta={`${formatAcademicDate(assessment.date)} · peso ${assessment.weight} · máx. ${assessment.maxScore}`}
                  value={grade ? formatAcademicNumber(grade.score) : undefined}
                  badge={grade ? undefined : { text: 'Sem lançamento', tone: 'quiet' }} />;
              })}</RowList>
              : <Text style={academicStyles.meta}>Ainda não há notas publicadas.</Text>}
          </Disclosure>;
        })}</RowList>
      </Panel>
    </> : <EmptyState title="Sem disciplinas" detail="A matrícula demonstrativa não possui disciplinas." />}
    <Text style={academicStyles.meta}>Média na escala demonstrativa de 0 a 10. Notas em rascunho não aparecem aqui. Regras reais de peso, escala e publicação dependem do backend.</Text>
  </Screen>;
}
