import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { useSession } from '@/auth/session';
import { Screen, SectionTitle } from '@/components/primitives';
import { TopBar, useGoBack } from '@/components/top-bar';
import { palette } from '@/constants/design';
import { Card } from '@/demo/ui';
import { StudentBilling } from '@/features/connected/student-billing';
import { RequestState, connectedStyles } from '@/features/connected/ui';
import type { UserDetail } from '@/services/api';

export default function ConnectedBilling() {
  const goBack = useGoBack('/connected');
  const { state, request } = useSession();
  const studentId = state.status === 'signedIn' && state.user.perfil === 'ALUNO' ? state.user.id : null;
  const [enrollments, setEnrollments] = useState<{ id: string; registration: string }[] | null>(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!studentId) return;
    let active = true;
    void request<UserDetail>(`/usuarios/${encodeURIComponent(studentId)}`)
      .then((person) => { if (active) setEnrollments(person.matriculas.map((item) => ({ id: item.id, registration: item.registro }))); })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Não foi possível localizar suas matrículas.'); });
    return () => { active = false; };
  }, [request, revision, studentId]);

  if (state.status === 'signedIn' && state.user.perfil !== 'ALUNO') return <Redirect href="/connected" />;
  return <Screen><TopBar onBack={goBack} /><SectionTitle eyebrow="FINANCEIRO" title="Minhas mensalidades" />
    <RequestState loading={!enrollments && !error} error={error} onRetry={() => { setError(''); setEnrollments(null); setRevision((value) => value + 1); }} />
    {enrollments && (enrollments.length ? <StudentBilling enrollments={enrollments} /> : <Card><Text style={connectedStyles.body}>Nenhuma matrícula vinculada para consultar mensalidades.</Text></Card>)}
    {!!error && <Text style={{ color: palette.muted, fontSize: 12 }}>A consulta pode ser repetida sem registrar pagamento.</Text>}
  </Screen>;
}
