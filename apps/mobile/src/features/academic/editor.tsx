import { useState } from 'react';
import { View } from 'react-native';
import { ActionButton, Chip, Feedback, FormField, Panel, PanelTitle, academicStyles } from '@/demo/academic-ui';

export interface Field {
  key: string; label: string; type?: 'number' | 'date' | 'password'; optional?: boolean;
  options?: { id: string; label: string }[]; initial?: string;
}
export interface EditorConfig { title: string; fields: Field[]; submit: (values: Record<string, string>) => Promise<void> }
export function Editor({ config, close }: { config: EditorConfig; close: () => void }) {
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(config.fields.map((f) => [f.key, f.initial ?? ''])));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function save() {
    setError('');
    for (const field of config.fields) {
      const value = (values[field.key] ?? '').trim();
      if (!value && !field.optional) { setError(`Preencha ${field.label}.`); return; }
      if (field.type === 'number' && (!Number.isFinite(Number(value.replace(',', '.'))) || Number(value.replace(',', '.')) < 0)) { setError(`Valor inválido: ${field.label}.`); return; }
      if (field.type === 'date' && Number.isNaN(Date.parse(value))) { setError(`Data inválida: ${field.label}. Use AAAA-MM-DD.`); return; }
      if (field.options && !field.options.some((option) => option.id === value)) { setError(`Selecione ${field.label}.`); return; }
    }
    setBusy(true);
    try { await config.submit(values); close(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível salvar.'); } finally { setBusy(false); }
  }
  return <Panel><PanelTitle>{config.title}</PanelTitle>
    {config.fields.map((field) => <View key={field.key} style={academicStyles.stack}>
      {field.options ? <><PanelTitle>{field.label}</PanelTitle><View style={academicStyles.chips}>{field.options.map((option) => <Chip key={option.id} label={option.label} selected={values[field.key] === option.id} onPress={() => { if (!busy) setValues((v) => ({ ...v, [field.key]: option.id })); }} />)}</View></> :
        <FormField label={field.label} value={values[field.key] ?? ''} onChangeText={(value) => { if (!busy) setValues((v) => ({ ...v, [field.key]: value })); }} keyboardType={field.type === 'number' ? 'decimal-pad' : 'default'} placeholder={field.type === 'date' ? 'AAAA-MM-DD' : undefined} secureTextEntry={field.type === 'password'} />}
    </View>)}
    {!!error && <Feedback error message={error} />}
    <ActionButton title={busy ? 'Salvando…' : 'Salvar'} disabled={busy} onPress={() => void save()} />
    <ActionButton secondary title="Cancelar" disabled={busy} onPress={close} />
  </Panel>;
}
