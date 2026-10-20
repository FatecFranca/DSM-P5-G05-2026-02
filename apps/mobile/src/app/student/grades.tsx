import { Text } from 'react-native';
import { Screen } from '@/components/primitives';
import { demoStudentId, demoStudentSubjects, gradeAverage } from '@/demo/academic';
import { useAcademicDemo } from '@/demo/academic-store';
import { AcademicDemoNotice, AcademicHeader, EmptyState, Panel, PanelTitle, academicStyles, formatAcademicDate, formatAcademicNumber } from '@/demo/academic-ui';

export default function StudentGrades() {
  const { data } = useAcademicDemo();
  return <Screen><AcademicHeader title="Minhas notas" subtitle="Somente avaliações publicadas das disciplinas matriculadas." /><AcademicDemoNotice />
    {demoStudentSubjects.map((subject) => {
      const assessments = data.assessments.filter((item) => item.subjectId === subject.id && item.published);
      const average = gradeAverage(assessments, data.grades, demoStudentId);
      return <Panel key={subject.id}><PanelTitle>{subject.title}</PanelTitle><Text style={academicStyles.meta}>Média ponderada demonstrativa: {formatAcademicNumber(average)} · escala 0–10</Text>
        {assessments.length ? assessments.map((assessment) => { const grade = data.grades.find((item) => item.assessmentId === assessment.id && item.studentId === demoStudentId); return <Text key={assessment.id} style={academicStyles.strong}>{assessment.title}: {grade ? formatAcademicNumber(grade.score) : 'sem lançamento'} / {assessment.maxScore} · peso {assessment.weight} · {formatAcademicDate(assessment.date)}</Text>; }) : <Text style={academicStyles.meta}>Ainda não há notas publicadas.</Text>}
      </Panel>;
    })}
    {!demoStudentSubjects.length ? <EmptyState title="Sem disciplinas" detail="A matrícula demonstrativa não possui disciplinas." /> : null}
    <Text style={academicStyles.meta}>Notas em rascunho não aparecem aqui. Regras reais de peso, escala e publicação dependem do backend.</Text>
  </Screen>;
}
