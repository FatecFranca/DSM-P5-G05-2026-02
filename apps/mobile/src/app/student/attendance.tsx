import { Text } from 'react-native';
import { Screen } from '@/components/primitives';
import { attendanceSummary, demoStudentId, demoStudentSubjects } from '@/demo/academic';
import { useAcademicDemo } from '@/demo/academic-store';
import { AcademicDemoNotice, AcademicHeader, Disclosure, EmptyState, ListRow, Meter, Panel, PanelHeader, RowList, StatStrip, academicStyles, attendanceBadge, formatAcademicDate, type AttendanceKind } from '@/demo/academic-ui';

const kindOf: Record<'PRESENT' | 'ABSENT' | 'JUSTIFIED', AttendanceKind> = { PRESENT: 'present', ABSENT: 'absent', JUSTIFIED: 'justified' };

export default function StudentAttendance() {
  const { data } = useAcademicDemo();
  const ownLessons = data.lessons.filter((lesson) => demoStudentSubjects.some((subject) => subject.id === lesson.subjectId));
  const overall = attendanceSummary(ownLessons, data.attendance, demoStudentId);

  return <Screen>
    <AcademicHeader back fallbackHref="/student" title="Minha frequência" subtitle="Presenças e faltas nas aulas com chamada registrada." />
    <AcademicDemoNotice />
    {demoStudentSubjects.length ? <>
      <StatStrip items={[
        { label: 'Presenças', value: String(overall.present) },
        { label: 'Faltas', value: String(overall.absent) },
        { label: 'Justificadas', value: String(overall.justified) },
        { label: 'Frequência demonstrativa', value: overall.percent === null ? '—' : `${Math.round(overall.percent)}%` },
      ]} />
      <Panel>
        <PanelHeader title="Por disciplina" />
        <RowList>{demoStudentSubjects.map((subject, index) => {
          const lessons = data.lessons.filter((item) => item.subjectId === subject.id).sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
          const result = attendanceSummary(lessons, data.attendance, demoStudentId);
          return <Disclosure
            key={subject.id}
            title={subject.title}
            meta={`${result.present} presenças · ${result.absent} faltas · ${result.justified} justificadas`}
            summary={<Meter label="Presença registrada" value={result.percent === null ? 0 : result.percent / 100} valueLabel={result.percent === null ? '—' : `${Math.round(result.percent)}%`} />}
            defaultExpanded={index === 0}>
            <RowList>{lessons.map((lesson) => {
              const record = data.attendance.find((item) => item.lessonId === lesson.id && item.studentId === demoStudentId);
              return <ListRow key={lesson.id} title={formatAcademicDate(lesson.date)} meta={lesson.topic} badge={attendanceBadge[record ? kindOf[record.status] : 'none']} />;
            })}</RowList>
          </Disclosure>;
        })}</RowList>
      </Panel>
    </> : <EmptyState title="Sem frequência" detail="Nenhuma disciplina vinculada à matrícula demonstrativa." />}
    <Text style={academicStyles.meta}>A justificativa não altera automaticamente o percentual. O limite e a regra institucional de frequência virão da API.</Text>
  </Screen>;
}
