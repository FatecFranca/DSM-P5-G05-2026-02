import { useState } from 'react';
import { Redirect } from 'expo-router';
import { useSession } from '@/auth/session';
import { Screen, SectionTitle } from '@/components/primitives';
import { TopBar, useGoBack } from '@/components/top-bar';
import { Chip } from '@/demo/academic-ui';
import { Card } from '@/demo/ui';
import { MlEnrollments } from '@/features/academic/ml-enrollment';
import { DataNotice, InstitutionPicker, RequestState, connectedStyles } from './ui';
import { useAcademicOverview } from './overview';
import { Text, View } from 'react-native';

export function ConnectedScenarios() {
  const { state } = useSession();
  const goBack = useGoBack('/connected');
  const overview = useAcademicOverview();
  const [classId, setClassId] = useState<string | null>(null);
  const selected = overview.data?.classes.find((item) => item.id === classId) ?? overview.data?.classes[0];
  const enrollments = overview.data?.enrollments.filter((item) => item.classId === selected?.id) ?? [];
  if (state.status === 'signedIn' && state.user.perfil === 'ALUNO') return <Redirect href="/connected/report" />;
  return <Screen><TopBar onBack={goBack} /><SectionTitle eyebrow="LABORATÓRIO ACADÊMICO" title="Cenários" />
    <DataNotice>O modelo português ainda não foi validado para os alunos desta instituição. Esta tela verifica a disponibilidade da análise com registros reais.</DataNotice>
    <InstitutionPicker institutions={overview.institutions} selected={overview.institutionId} onSelect={(id) => { setClassId(null); overview.selectInstitution(id); }} />
    <RequestState loading={overview.loading} error={overview.error} onRetry={overview.refresh} />
    {overview.data && <>
      <Card><Text style={connectedStyles.heading}>Selecione uma turma</Text><View style={connectedStyles.chips}>{overview.data.classes.map((item) => <Chip key={item.id} label={item.name} selected={item.id === selected?.id} onPress={() => setClassId(item.id)} />)}</View>
        {!overview.data.classes.length && <Text style={connectedStyles.body}>Nenhuma turma acessível.</Text>}
      </Card>
      <MlEnrollments key={selected?.id ?? 'sem-turma'} matriculas={enrollments.map((item) => ({ id: item.id, label: `${item.name} · ${item.registration}` }))} onImported={overview.refresh} />
    </>}
  </Screen>;
}
