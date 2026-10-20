import { Text, View } from 'react-native';
import { Screen } from '@/components/primitives';
import { attendanceSummary, demoStudentId, demoStudentSubjects } from '@/demo/academic';
import { useAcademicDemo } from '@/demo/academic-store';
import { AcademicDemoNotice, AcademicHeader, EmptyState, Panel, PanelTitle, Stat, academicStyles, formatAcademicDate } from '@/demo/academic-ui';
import { Bar } from '@/demo/ui';

const statusLabel = { PRESENT: 'Presente', ABSENT: 'Falta', JUSTIFIED: 'Justificada' } as const;

export default function StudentAttendance() {
  const { data } = useAcademicDemo();
  const ownLessons = data.lessons.filter((lesson) => demoStudentSubjects.some((subject) => subject.id === lesson.subjectId));
  const overall = attendanceSummary(ownLessons, data.attendance, demoStudentId);
  return <Screen><AcademicHeader title="Minha frequência" subtitle="Presenças e faltas nas aulas com chamada registrada." /><AcademicDemoNotice />
    <View style={academicStyles.grid}><Stat label="Presenças" value={String(overall.present)} /><Stat label="Faltas" value={String(overall.absent)} /><Stat label="Justificadas" value={String(overall.justified)} /><Stat label="Frequência demonstrativa" value={overall.percent === null ? '—' : `${Math.round(overall.percent)}%`} /></View>
    {demoStudentSubjects.map((subject) => {
      const lessons = data.lessons.filter((item) => item.subjectId === subject.id);
      const result = attendanceSummary(lessons, data.attendance, demoStudentId);
      return <Panel key={subject.id}><PanelTitle>{subject.title}</PanelTitle><Bar label="Presença registrada" value={result.percent === null ? 0 : result.percent / 100} /><Text style={academicStyles.meta}>{result.present} presenças · {result.absent} faltas · {result.justified} justificadas</Text>
        {lessons.map((lesson) => { const record = data.attendance.find((item) => item.lessonId === lesson.id && item.studentId === demoStudentId); return <View key={lesson.id} style={academicStyles.row}><Text style={academicStyles.strong}>{formatAcademicDate(lesson.date)}</Text><Text style={academicStyles.meta}>{record ? statusLabel[record.status] : 'Chamada não registrada'}</Text></View>; })}
      </Panel>;
    })}
    {!demoStudentSubjects.length ? <EmptyState title="Sem frequência" detail="Nenhuma disciplina vinculada à matrícula demonstrativa." /> : null}
    <Text style={academicStyles.meta}>A justificativa não altera automaticamente o percentual. O limite e a regra institucional de frequência virão da API.</Text>
  </Screen>;
}
