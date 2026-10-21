import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '@/auth/session';
import { TopBar } from '@/components/top-bar';
import { palette } from '@/constants/design';
import { demoClasses, demoStudents, riskLevel } from '@/demo/data';
import { DemoBanner, StudentRow } from '@/demo/ui';

type RiskFilter = 'Todos' | 'Alto' | 'Médio' | 'Baixo';
type Sort = 'Nome' | 'Média' | 'Risco';

export default function Students() {
  const router = useRouter();
  const { state } = useSession();
  const [search, setSearch] = useState('');
  const [classId, setClassId] = useState('all');
  const [risk, setRisk] = useState<RiskFilter>('Todos');
  const [sort, setSort] = useState<Sort>('Nome');
  const showRisk = state.status === 'signedIn' && state.user.perfil !== 'ALUNO';
  const filtered = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase('pt-BR');
    return demoStudents.filter((student) =>
      (classId === 'all' || student.classId === classId) &&
      (student.name.toLocaleLowerCase('pt-BR').includes(normalized) || student.registration.includes(normalized)) &&
      (!showRisk || risk === 'Todos' || riskLevel(student.prediction.probabilities.Dropout) === risk),
    ).sort((a, b) => sort === 'Média' ? b.academicAverage - a.academicAverage : sort === 'Risco' && showRisk ? b.prediction.probabilities.Dropout - a.prediction.probabilities.Dropout : a.name.localeCompare(b.name, 'pt-BR'));
  }, [classId, risk, search, showRisk, sort]);
  if (state.status !== 'signedIn') return null;
  if (state.user.perfil === 'ALUNO') return <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}><View style={styles.content}><Text style={styles.title}>Estudantes</Text><Text style={styles.empty}>A análise individual estará disponível após o vínculo com sua matrícula na API.</Text></View></SafeAreaView>;
  return <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}><FlatList data={filtered} keyExtractor={(item) => item.id} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" ItemSeparatorComponent={() => <View style={{ height: 9 }} />} ListHeaderComponent={<View style={styles.header}>
    <TopBar />
    <Text style={styles.title}>Estudantes</Text><DemoBanner />
    <TextInput accessibilityLabel="Pesquisar estudantes" placeholder="Buscar nome ou matrícula" placeholderTextColor={palette.muted} value={search} onChangeText={setSearch} style={styles.input} />
    <Text style={styles.label}>Turma</Text><View style={styles.chips}>{[{ id: 'all', name: 'Todas' }, ...demoClasses].map((item) => <Chip key={item.id} label={item.name} active={classId === item.id} onPress={() => setClassId(item.id)} />)}</View>
    {showRisk ? <><Text style={styles.label}>Faixa de risco</Text><View style={styles.chips}>{(['Todos', 'Alto', 'Médio', 'Baixo'] as const).map((item) => <Chip key={item} label={item} active={risk === item} onPress={() => setRisk(item)} />)}</View></> : null}
    <Text style={styles.label}>Ordenar</Text><View style={styles.chips}>{(['Nome', 'Média', ...(showRisk ? ['Risco'] as const : [])] as Sort[]).map((item) => <Chip key={item} label={item} active={sort === item} onPress={() => setSort(item)} />)}</View>
    <Text style={styles.count}>{filtered.length} estudante(s)</Text>
  </View>} ListEmptyComponent={<Text style={styles.empty}>Nenhum estudante corresponde aos filtros.</Text>} renderItem={({ item }) => <StudentRow student={item} showRisk={showRisk} onPress={() => router.push({ pathname: '/students/[id]', params: { id: item.id } })} />} /></SafeAreaView>;
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: active }} onPress={onPress} style={[styles.chip, active && styles.activeChip]}><Text style={[styles.chipText, active && styles.activeText]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.background }, content: { width: '100%', maxWidth: 900, alignSelf: 'center', padding: 16, paddingBottom: 32 }, header: { gap: 13, marginBottom: 14 },
  title: { color: palette.ink, fontSize: 26, fontWeight: '800' }, input: { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, borderRadius: 12, minHeight: 50, paddingHorizontal: 14, color: palette.ink },
  label: { fontSize: 13, color: palette.ink, fontWeight: '700' }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, paddingHorizontal: 12, minHeight: 38, justifyContent: 'center', borderRadius: 99 }, activeChip: { backgroundColor: palette.primary, borderColor: palette.primary },
  chipText: { color: palette.ink, fontSize: 12 }, activeText: { color: palette.surface }, count: { color: palette.muted, fontSize: 12 }, empty: { color: palette.muted, marginTop: 24, textAlign: 'center' },
});
