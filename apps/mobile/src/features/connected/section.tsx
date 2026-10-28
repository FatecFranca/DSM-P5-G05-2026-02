import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSession } from '@/auth/session';
import { Screen } from '@/components/primitives';
import { AcademicHeader, Panel, PanelTitle, academicStyles, formatAcademicDate } from '@/demo/academic-ui';
import type { AcademicFile } from '@/services/academic';
import { saveFile } from '@/features/academic/files';
import { DataNotice, RequestState } from './ui';
import { useAcademicOverview, type ClassView } from './overview';

export type AcademicSection = 'Frequência' | 'Notas' | 'Atividades' | 'Materiais';

export function ConnectedSection({ section }: { section: AcademicSection }) {
  const router = useRouter();
  const { state, request } = useSession();
  const overview = useAcademicOverview();
  const [error, setError] = useState('');
  const student = state.status === 'signedIn' && state.user.perfil === 'ALUNO';
  const teacher = state.status === 'signedIn' && state.user.perfil === 'PROFESSOR';
  const title = section === 'Frequência' ? student ? 'Minhas faltas' : 'Chamada' : section;
  async function download(file: AcademicFile) {
    setError('');
    try { await saveFile(file, await request<ArrayBuffer>(`/arquivos/${file.id}`, { binary: true })); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível baixar o material.'); }
  }
  return <Screen><AcademicHeader title={title} subtitle={student ? 'Seus registros acadêmicos' : 'Registros das turmas vinculadas'} />
    <DataNotice>Dados da API, filtrados pelos vínculos da sua conta. Registros não publicados permanecem fora da visão do estudante.</DataNotice>
    <RequestState loading={overview.loading} error={overview.error} onRetry={overview.refresh} />
    {!!error && <Text accessibilityRole="alert" style={academicStyles.meta}>{error}</Text>}
    {overview.data && <>
      {overview.data.classes.length ? overview.data.classes.map((item) => <ClassSection key={item.id} item={item} section={section} student={student} teacher={teacher} onManage={() => router.push({ pathname: '/workspace', params: { turmaId: item.id, instituicaoId: item.snapshot.turmas.find((value) => value.id === item.id)?.instituicaoId, secao: section } })} onDownload={download} />)
        : <Panel><PanelTitle>Nenhuma turma disponível</PanelTitle><Text style={academicStyles.meta}>Confira seus vínculos acadêmicos.</Text></Panel>}
    </>}
  </Screen>;
}

function ClassSection({ item, section, student, teacher, onManage, onDownload }: { item: ClassView; section: AcademicSection; student: boolean; teacher: boolean; onManage: () => void; onDownload: (file: AcademicFile) => void }) {
  const snapshot = item.snapshot;
  const subject = (id: string) => snapshot.disciplinas.find((value) => value.id === id)?.nome ?? 'Disciplina';
  const studentName = (id: string) => snapshot.matriculas.find((value) => value.id === id)?.aluno.nome ?? 'Estudante';
  const count = section === 'Frequência' ? snapshot.aulas.length : section === 'Notas' ? snapshot.avaliacoes.filter((value) => !student || value.publicada).length : section === 'Atividades' ? snapshot.atividades.filter((value) => !student || value.estado === 'PUBLICADA').length : snapshot.materiais.length;
  return <Panel><PanelTitle>{item.name}</PanelTitle><Text style={academicStyles.meta}>{item.course} · {item.period}</Text>
    {section === 'Frequência' && snapshot.aulas.slice(0, 20).map((lesson) => { const records = snapshot.presencas.filter((entry) => entry.aulaId === lesson.id); return <View key={lesson.id} style={academicStyles.stack}><Text style={academicStyles.strong}>{lesson.tema}</Text><Text style={academicStyles.meta}>{subject(lesson.disciplinaId)} · {formatAcademicDate(lesson.data)}</Text>{records.length ? records.map((entry) => <Text key={entry.matriculaId} style={academicStyles.meta}>{student ? '' : `${studentName(entry.matriculaId)} · `}{entry.situacao.replaceAll('_', ' ').toLocaleLowerCase('pt-BR')}</Text>) : <Text style={academicStyles.meta}>Presença ainda não registrada.</Text>}</View>; })}
    {section === 'Notas' && snapshot.avaliacoes.filter((value) => !student || value.publicada).slice(0, 20).map((assessment) => { const grades = snapshot.notas.filter((value) => value.avaliacaoId === assessment.id); return <View key={assessment.id} style={academicStyles.stack}><Text style={academicStyles.strong}>{assessment.titulo}</Text><Text style={academicStyles.meta}>{subject(assessment.disciplinaId)} · {assessment.publicada ? 'Publicada' : 'Rascunho'} · máximo {assessment.notaMaxima}</Text>{grades.length ? grades.map((value) => <Text key={value.matriculaId} style={academicStyles.meta}>{student ? '' : `${studentName(value.matriculaId)} · `}{value.valor.toFixed(1).replace('.', ',')}</Text>) : <Text style={academicStyles.meta}>Nota ainda não lançada.</Text>}</View>; })}
    {section === 'Atividades' && snapshot.atividades.filter((value) => !student || value.estado === 'PUBLICADA').slice(0, 20).map((activity) => <View key={activity.id} style={academicStyles.stack}><Text style={academicStyles.strong}>{activity.titulo}</Text><Text style={academicStyles.meta}>{subject(activity.disciplinaId)} · prazo {formatAcademicDate(activity.prazo)} · {activity.estado.toLocaleLowerCase('pt-BR')}</Text><Text style={academicStyles.meta}>{activity.descricao}</Text></View>)}
    {section === 'Materiais' && snapshot.materiais.slice(0, 20).map((material) => <View key={material.id} style={academicStyles.stack}><Text style={academicStyles.strong}>{material.titulo}</Text><Text style={academicStyles.meta}>{subject(material.disciplinaId)} · {material.arquivo.nome}</Text><Pressable accessibilityRole="button" onPress={() => onDownload(material.arquivo)}><Text style={academicStyles.link}>Baixar material →</Text></Pressable></View>)}
    {!count && <Text style={academicStyles.meta}>Nenhum registro disponível.</Text>}
    {count > 20 && <Text style={academicStyles.meta}>Mostrando os 20 primeiros registros. Abra a gestão acadêmica para ver mais.</Text>}
    <Pressable accessibilityRole="button" onPress={onManage}><Text style={academicStyles.link}>{student ? 'Abrir detalhes e ações' : teacher ? 'Gerenciar registros' : 'Ver registros completos'} →</Text></Pressable>
  </Panel>;
}
