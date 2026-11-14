import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useSession } from '@/auth/session';
import { ActionButton, BodyText, Chip, Feedback, FormField, Panel, PanelTitle, academicStyles } from '@/demo/academic-ui';

type DeclarationData = {
  estadoCivil?: string;
  nacionalidade?: string;
  qualificacaoAnterior?: string;
  qualificacaoMae?: string;
  qualificacaoPai?: string;
  ocupacaoMae?: string;
  ocupacaoPai?: string;
  deslocado?: boolean;
  necessidadesEspeciais?: boolean;
  genero?: string;
};
type Declaration = { revisao: number; pendente: boolean; dados: DeclarationData };
type Field = keyof DeclarationData;

const TEXT_FIELDS: { key: Field; label: string; hint?: string }[] = [
  { key: 'nacionalidade', label: 'Nacionalidade (código de país com 2 letras)', hint: 'Ex.: BR ou PT' },
  { key: 'qualificacaoAnterior', label: 'Sua qualificação antes deste curso' },
  { key: 'qualificacaoMae', label: 'Qualificação da mãe (opcional)' },
  { key: 'qualificacaoPai', label: 'Qualificação do pai (opcional)' },
  { key: 'ocupacaoMae', label: 'Ocupação da mãe (opcional)' },
  { key: 'ocupacaoPai', label: 'Ocupação do pai (opcional)' },
];
const CIVIL = [
  ['SOLTEIRO', 'Solteiro(a)'], ['CASADO', 'Casado(a)'], ['UNIAO', 'União'],
  ['DIVORCIADO', 'Divorciado(a)'], ['VIUVO', 'Viúvo(a)'], ['OUTRO', 'Outro'],
] as const;
const GENDER = [
  ['FEMININO', 'Feminino'], ['MASCULINO', 'Masculino'],
  ['OUTRO', 'Outro'], ['NAO_INFORMAR', 'Prefiro não informar'],
] as const;

export function IngressDeclaration({ matriculaId }: { matriculaId: string }) {
  const { request } = useSession();
  const [declaration, setDeclaration] = useState<Declaration | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const path = `/ml/matriculas/${encodeURIComponent(matriculaId)}/declaracao-ingresso`;

  useEffect(() => {
    let active = true;
    void request<Declaration>(path).then((value) => {
      if (!active) return;
      setDeclaration(value);
      setFields(Object.fromEntries(Object.entries(value.dados).map(([key, item]) => [key, typeof item === 'boolean' ? item ? 'SIM' : 'NAO' : item])));
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : 'Não foi possível carregar os dados de ingresso.');
    });
    return () => { active = false; };
  }, [path, request]);

  function set(name: Field, value: string) {
    setFields((current) => ({ ...current, [name]: value }));
  }

  async function save() {
    if (!declaration) return;
    const dados: DeclarationData = {};
    for (const { key } of TEXT_FIELDS) {
      const value = (fields[key] ?? '').trim();
      if (value) (dados as Record<string, string>)[key] = key === 'nacionalidade' ? value.toUpperCase() : value;
    }
    if (fields.estadoCivil) dados.estadoCivil = fields.estadoCivil;
    if (fields.genero) dados.genero = fields.genero;
    if (fields.deslocado) dados.deslocado = fields.deslocado === 'SIM';
    if (fields.necessidadesEspeciais) dados.necessidadesEspeciais = fields.necessidadesEspeciais === 'SIM';
    setBusy(true); setError(''); setNotice('');
    try {
      const next = await request<Declaration>(path, { method: 'PUT', body: { versao: declaration.revisao, dados } });
      setDeclaration(next);
      setNotice(Object.keys(dados).length ? 'Declaração enviada à secretaria para conferência.' : 'Declaração limpa nesta matrícula.');
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível enviar a declaração.');
    } finally { setBusy(false); }
  }

  return <Panel>
    <PanelTitle>Dados pessoais de ingresso</PanelTitle>
    <BodyText>Você pode informar ou corrigir estes dados. A secretaria confere os documentos e registra os códigos do modelo; sua declaração não gera previsão automaticamente.</BodyText>
    {!declaration && !error && <BodyText>Carregando declaração…</BodyText>}
    {!!error && <Feedback error message={error} />}
    {!!notice && <Feedback message={notice} />}
    {declaration && <>
      <BodyText>{declaration.pendente ? 'Aguardando conferência da secretaria.' : declaration.revisao ? 'Última declaração conferida ou sem dados pendentes.' : 'Nenhuma declaração enviada.'}</BodyText>
      <BodyText>Estado civil (opcional)</BodyText>
      <View style={academicStyles.chips}>
        {CIVIL.map(([value, label]) => <Chip key={value} label={label} selected={fields.estadoCivil === value} onPress={() => set('estadoCivil', value)} />)}
        <Chip label="Não informar estado civil" selected={!fields.estadoCivil} onPress={() => set('estadoCivil', '')} />
      </View>
      {TEXT_FIELDS.map(({ key, label, hint }) => <FormField key={key} label={label} placeholder={hint} value={fields[key] ?? ''} onChangeText={(value) => set(key, value)} />)}
      <BodyText>Gênero (opcional)</BodyText>
      <View style={academicStyles.chips}>
        {GENDER.map(([value, label]) => <Chip key={value} label={label} selected={fields.genero === value} onPress={() => set('genero', value)} />)}
        <Chip label="Limpar gênero" selected={!fields.genero} onPress={() => set('genero', '')} />
      </View>
      {(['deslocado', 'necessidadesEspeciais'] as const).map((name) => <View key={name} style={academicStyles.stack}>
        <BodyText>{name === 'deslocado' ? 'Você se mudou de cidade para estudar?' : 'Você quer declarar necessidades especiais?'}</BodyText>
        <View style={academicStyles.chips}>
          <Chip label="Sim" selected={fields[name] === 'SIM'} onPress={() => set(name, 'SIM')} />
          <Chip label="Não" selected={fields[name] === 'NAO'} onPress={() => set(name, 'NAO')} />
          <Chip label="Não informar" selected={!fields[name]} onPress={() => set(name, '')} />
        </View>
      </View>)}
      <ActionButton title={busy ? 'Enviando…' : 'Enviar declaração'} disabled={busy} onPress={() => void save()} />
    </>}
  </Panel>;
}
