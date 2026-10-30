import { useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { BodyText, Chip, Feedback, FormField, Panel, PanelTitle, ActionButton, academicStyles } from '@/demo/academic-ui';
import { palette } from '@/constants/design';
import { parsePartialMlFields, type EnrollmentMl, type MlSchema } from '@/services/ml';
import { ML_FORM_GROUPS, mlFieldHelp, mlInputHint, mlOptions, mlSemesterChoiceLabel } from './ml-form-fields';

type EconomicFields = Record<'desemprego' | 'inflacao' | 'pib', number>;

export function MlProfileForm({ profile, schema, economicPreset, onSave, onCancel }: {
  profile: EnrollmentMl;
  schema: MlSchema;
  economicPreset: EconomicFields | null;
  onSave: (features: Record<string, number>) => Promise<void>;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(schema.features.map((name) => {
    const value = profile.features?.[name];
    return [name, Number.isFinite(value) ? String(value).replace('.', ',') : ''];
  })));
  const [section, setSection] = useState(() => {
    const firstMissing = ML_FORM_GROUPS.findIndex((group) => group.fields.some(([name]) => !Number.isFinite(profile.features?.[name])));
    return firstMissing < 0 ? 0 : firstMissing;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const completed = schema.features.filter((name) => (values[name] ?? '').trim()).length;
  const group = ML_FORM_GROUPS[section];

  function setValue(name: string, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
    setError('');
  }

  async function save() {
    setError('');
    try {
      const features = parsePartialMlFields(values, schema);
      setSaving(true);
      await onSave(features);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar os dados.');
    } finally {
      setSaving(false);
    }
  }

  return <Panel>
    <PanelTitle>Dados para previsão · {profile.aluno}</PanelTitle>
    <BodyText>Este formulário corresponde à base portuguesa do modelo experimental. Preencha apenas valores e categorias com equivalência comprovada; não adapte códigos brasileiros por aproximação.</BodyText>
    <BodyText>{completed} de {schema.features.length} campos preenchidos. Você pode salvar e completar depois.</BodyText>
    <View style={academicStyles.chips}>{ML_FORM_GROUPS.map((item, index) =>
      <Chip key={item.title} label={item.title} selected={section === index} onPress={() => setSection(index)} />
    )}</View>
    <PanelTitle>{group.title}</PanelTitle>
    {(section === 2 || section === 3) && <BodyText>Consulte o histórico acadêmico. Se o semestre ainda não terminou ou o dado não existe, deixe o campo vazio; não use 0 para indicar “não sei”.</BodyText>}
    {section === 4 && economicPreset && <ActionButton secondary title="Reutilizar valores econômicos desta turma" onPress={() => {
      setValues((current) => ({ ...current, desemprego: String(economicPreset.desemprego).replace('.', ','), inflacao: String(economicPreset.inflacao).replace('.', ','), pib: String(economicPreset.pib).replace('.', ',') }));
    }} />}
    {section === 4 && <BodyText>Informe os percentuais do período de referência. Reutilize valores apenas se as matrículas corresponderem ao mesmo período.</BodyText>}
    {group.fields.map(([name, label]) => {
      const options = mlOptions(name, schema);
      const help = mlFieldHelp(name);
      return <View key={name} style={academicStyles.stack}>
        {help ? <MlSemesterNumberField name={name} label={label} help={help} value={values[name] ?? ''} onChange={(value) => setValue(name, value)} /> : options ? (options.length === 2 && name !== 'genero' ? <>
          <Text style={styles.label}>{label}</Text>
          <View style={academicStyles.chips}>{options.map((option) => <Chip key={option.id} label={option.label} selected={values[name] === option.id} onPress={() => setValue(name, values[name] === option.id ? '' : option.id)} />)}</View>
        </> : <MlChoiceField label={label} value={values[name] ?? ''} options={options} onChange={(value) => setValue(name, value)} />) : <>
          <FormField label={label} value={values[name] ?? ''} onChangeText={(value) => setValue(name, value)}
            keyboardType={['desemprego', 'inflacao', 'pib'].includes(name) ? 'default' : name.endsWith('_nota') || name.startsWith('nota_') ? 'decimal-pad' : 'numeric'}
            placeholder={mlInputHint(name)} />
        </>}
      </View>;
    })}
    {!!error && <Feedback error message={error} />}
    <ActionButton title={saving ? 'Salvando…' : 'Salvar informações'} disabled={saving} onPress={() => void save()} />
    <ActionButton secondary title="Voltar à matrícula" disabled={saving} onPress={onCancel} />
  </Panel>;
}

function MlSemesterNumberField({ name, label, help, value, onChange }: {
  name: string;
  label: string;
  help: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState('');
  const [error, setError] = useState('');
  const isGrade = name.endsWith('_nota');
  const presets = Array.from({ length: isGrade ? 21 : 13 }, (_, index) => index);

  function close() {
    setOpen(false);
    setError('');
  }

  function confirmCustom() {
    try {
      const parsed = parsePartialMlFields({ [name]: custom }, { features: [name], classes: [], categories: {} });
      const exact = parsed[name];
      if (exact === undefined) throw new Error('Informe um valor ou escolha “Não sei”.');
      onChange(String(exact).replace('.', ','));
      close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Informe um valor válido.');
    }
  }

  return <>
    <Text style={styles.label}>{label}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${mlSemesterChoiceLabel(name, value)}`} onPress={() => { setCustom(value); setError(''); setOpen(true); }} style={styles.select}>
      <Text style={styles.selectText}>{mlSemesterChoiceLabel(name, value)}</Text><Text style={styles.chevron}>⌄</Text>
    </Pressable>
    <Text style={styles.help}>{help}</Text>
    <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.modalOverlay}><ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.modalTitle}>{label}</Text>
        <Text style={styles.help}>{help}</Text>
        <Text style={styles.help}>Escolha somente um valor confirmado no histórico. O número escolhido será enviado ao modelo sem arredondamento.</Text>
        <View style={styles.numberGrid}>{presets.map((item) =>
          <Pressable key={item} accessibilityRole="button" accessibilityLabel={mlSemesterChoiceLabel(name, String(item))} accessibilityState={{ selected: Number(value.replace(',', '.')) === item && !!value }} onPress={() => { onChange(String(item)); close(); }} style={[styles.numberOption, Number(value.replace(',', '.')) === item && !!value && styles.optionSelected]}><Text style={styles.optionText}>{item}</Text></Pressable>
        )}</View>
        <Text style={styles.label}>Outro valor exato</Text>
        <TextInput accessibilityLabel={`Outro valor para ${label}`} value={custom} onChangeText={(text) => { setCustom(text); setError(''); }} keyboardType={isGrade ? 'decimal-pad' : 'numeric'} placeholder={isGrade ? 'Ex.: 15,5' : 'Ex.: 14'} placeholderTextColor={palette.muted} style={styles.search} />
        {!!error && <Feedback error message={error} />}
        <ActionButton title="Usar este valor" onPress={confirmCustom} />
        <ActionButton secondary title="Não sei / limpar campo" onPress={() => { onChange(''); close(); }} />
        <ActionButton secondary title="Fechar" onPress={close} />
      </ScrollView></View>
    </Modal>
  </>;
}

function MlChoiceField({ label, value, options, onChange }: {
  label: string;
  value: string;
  options: { id: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = options.find((item) => item.id === value);
  const normalized = query.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const filtered = options.filter((item) => `${item.label} ${item.id}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(normalized));
  return <>
    <Text style={styles.label}>{label}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${selected?.label ?? 'Selecionar'}`} onPress={() => setOpen(true)} style={styles.select}>
      <Text style={styles.selectText}>{selected?.label ?? 'Selecionar opção'}</Text><Text style={styles.chevron}>⌄</Text>
    </Pressable>
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <View style={styles.modalOverlay}><View style={styles.modalCard}>
        <Text style={styles.modalTitle}>{label}</Text>
        {options.length > 8 && <TextInput accessibilityLabel={`Buscar em ${label}`} value={query} onChangeText={setQuery} placeholder="Buscar opção ou código" placeholderTextColor={palette.muted} style={styles.search} />}
        <FlatList data={filtered} keyExtractor={(item) => item.id} style={styles.optionList} keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityState={{ selected: item.id === value }} onPress={() => { onChange(item.id); setOpen(false); setQuery(''); }} style={[styles.option, item.id === value && styles.optionSelected]}><Text style={styles.optionText}>{item.label}</Text></Pressable>}
          ListEmptyComponent={<BodyText>Nenhuma opção encontrada.</BodyText>} />
        {!!value && <ActionButton secondary title="Limpar resposta" onPress={() => { onChange(''); setOpen(false); setQuery(''); }} />}
        <ActionButton secondary title="Fechar" onPress={() => { setOpen(false); setQuery(''); }} />
      </View></View>
    </Modal>
  </>;
}

const styles = StyleSheet.create({
  label: { color: palette.ink, fontSize: 12, fontWeight: '700' },
  help: { color: palette.muted, fontSize: 12, lineHeight: 18 },
  select: { minHeight: 45, borderWidth: 1, borderColor: palette.line, borderRadius: 8, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: palette.surface },
  selectText: { color: palette.ink, fontSize: 14, flex: 1 },
  chevron: { color: palette.secondary, fontSize: 22, marginLeft: 8 },
  modalOverlay: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0, 0, 0, 0.45)', padding: 20 },
  modalCard: { backgroundColor: palette.surface, borderRadius: 16, padding: 16, gap: 12, maxHeight: '82%' },
  modalScroll: { backgroundColor: palette.surface, borderRadius: 16, maxHeight: '82%' },
  modalScrollContent: { padding: 16, gap: 12 },
  modalTitle: { color: palette.ink, fontSize: 18, fontWeight: '800' },
  search: { minHeight: 45, borderWidth: 1, borderColor: palette.line, borderRadius: 8, paddingHorizontal: 12, color: palette.ink },
  optionList: { flexGrow: 0 },
  numberGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  numberOption: { width: '23%', minHeight: 40, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: palette.line, borderRadius: 8 },
  option: { minHeight: 46, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: palette.line, paddingHorizontal: 10 },
  optionSelected: { backgroundColor: palette.primarySoft },
  optionText: { color: palette.ink, fontSize: 14 },
});
