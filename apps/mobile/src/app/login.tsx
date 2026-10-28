import * as SecureStore from 'expo-secure-store';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions, type TextInputInstance } from 'react-native';

import { useSession } from '@/auth/session';
import { filterInstituicoes } from '@/auth/instituicoes';
import { BrandMark, PrimaryButton, Screen, TextButton } from '@/components/primitives';
import { palette } from '@/constants/design';
import { ApiError, type InstituicaoOption } from '@/services/api';
import { api } from '@/services/api-config';

const INSTITUICAO_KEY = 'sgei.instituicaoId';

async function readSavedInstituicao() {
  return Platform.OS === 'web' ? window.localStorage.getItem(INSTITUICAO_KEY) : SecureStore.getItemAsync(INSTITUICAO_KEY);
}

async function saveInstituicao(id: string) {
  if (Platform.OS === 'web') window.localStorage.setItem(INSTITUICAO_KEY, id);
  else await SecureStore.setItemAsync(INSTITUICAO_KEY, id);
}

export default function LoginScreen() {
  const { width } = useWindowDimensions();
  const { state, signIn, demoSignIn, retryRestore } = useSession();
  const [instituicaoId, setInstituicaoId] = useState('');
  const [instituicaoQuery, setInstituicaoQuery] = useState('');
  const [instituicoes, setInstituicoes] = useState<InstituicaoOption[]>([]);
  const [showInstituicoes, setShowInstituicoes] = useState(false);
  const [instituicoesLoading, setInstituicoesLoading] = useState(true);
  const [instituicoesError, setInstituicoesError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const emailRef = useRef<TextInputInstance>(null);
  const senhaRef = useRef<TextInputInstance>(null);

  useEffect(() => {
    let mounted = true;
    void Promise.all([api.listInstituicoes(), readSavedInstituicao().catch(() => null)])
      .then(([options, savedId]) => {
        if (!mounted) return;
        setInstituicoes(options);
        const saved = options.find(({ id }) => id === savedId);
        if (saved) {
          setInstituicaoId(saved.id);
          setInstituicaoQuery(saved.nome);
        } else {
          const principal = options.find(({ codigoCps }) => codigoCps === '109');
          if (principal) {
            setInstituicaoId(principal.id);
            setInstituicaoQuery(principal.nome);
          }
        }
      })
      .catch(() => {
        if (mounted) setInstituicoesError('Não foi possível carregar as instituições.');
      })
      .finally(() => {
        if (mounted) setInstituicoesLoading(false);
      });
    return () => { mounted = false; };
  }, [loadAttempt]);

  const matches = filterInstituicoes(instituicoes, instituicaoQuery);

  // Com a sessão aberta, o guard do layout raiz troca esta tela pela área do perfil.
  if (state.status === 'signedIn') return null;

  async function submit() {
    if (!instituicaoId) {
      setError('Selecione sua instituição na lista.');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Informe um e-mail válido.');
      return;
    }
    if (!senha) {
      setError('Informe sua senha.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      await signIn(instituicaoId, email, senha);
      void saveInstituicao(instituicaoId).catch(() => undefined);
    } catch (cause: unknown) {
      setError(cause instanceof ApiError ? cause.message : 'Não foi possível entrar. Tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  async function enterDemo(role: 'ADMIN' | 'PROFESSOR' | 'ALUNO') {
    setError('');
    setBusy(true);
    try {
      await demoSignIn(role);
    } catch {
      setError('Não foi possível abrir a demonstração local.');
    } finally {
      setBusy(false);
    }
  }

  return (
      <Screen>
        <View style={[styles.layout, width >= 760 && styles.layoutWide]}>
        <View style={styles.hero}>
          <View style={styles.brandRow}>
            <BrandMark compact />
            <View>
              <Text style={styles.brandName}>SGEI</Text>
              <Text style={styles.brandCaption}>Observatório acadêmico</Text>
            </View>
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.kicker}>Dados para acompanhar pessoas</Text>
            <Text style={styles.heroTitle}>Ensino em{'\n'}perspectiva.</Text>
            <Text style={styles.heroDescription}>Acompanhe turmas, estudantes e indicadores em um único espaço de trabalho.</Text>
          </View>
          <View style={styles.art} accessible accessibilityLabel="Ilustração abstrata de progresso acadêmico">
            <View style={[styles.artCard, styles.artCardBack]} />
            <View style={[styles.artCard, styles.artCardFront]}>
              <View style={styles.artLineShort} />
              <View style={styles.artLineLong} />
              <View style={styles.artChart}>
                <View style={[styles.artBar, { height: 22 }]} />
                <View style={[styles.artBar, { height: 38 }]} />
                <View style={[styles.artBar, { height: 54, backgroundColor: palette.gold }]} />
                <View style={[styles.artBar, { height: 68 }]} />
              </View>
            </View>
          </View>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Acesse sua conta</Text>
          <Text style={styles.formDescription}>Entre com as credenciais da sua instituição.</Text>
          {state.status === 'signedOut' && state.restoreError ? (
            <View style={styles.notice}>
              <Text style={styles.noticeText}>{state.restoreError}</Text>
              <TextButton title="Tentar novamente" onPress={() => void retryRestore()} />
            </View>
          ) : null}
          <Text style={styles.label}>Instituição</Text>
          <TextInput accessibilityLabel="Pesquisar instituição" autoCapitalize="none" autoCorrect={false} placeholder={instituicoesLoading ? 'Carregando instituições...' : 'Digite o nome da Fatec'} placeholderTextColor={palette.muted} editable={!instituicoesLoading && !instituicoesError} value={instituicaoQuery} onFocus={() => setShowInstituicoes(true)} onChangeText={(value) => { setInstituicaoQuery(value); setInstituicaoId(''); setError(''); setShowInstituicoes(true); }} style={styles.input} />
          {instituicoesError ? <View style={styles.notice}><Text accessibilityRole="alert" style={styles.noticeText}>{instituicoesError}</Text><TextButton title="Tentar novamente" onPress={() => { setInstituicoesLoading(true); setInstituicoesError(''); setLoadAttempt((attempt) => attempt + 1); }} /></View> : null}
          {showInstituicoes && !instituicoesLoading && !instituicoesError ? (
            <View style={styles.instituicoesList}>
              {matches.length ? matches.map((option) => (
                <Pressable key={option.id} accessibilityRole="button" accessibilityLabel={`Selecionar ${option.nome}`} onPress={() => { setInstituicaoId(option.id); setInstituicaoQuery(option.nome); setError(''); setShowInstituicoes(false); emailRef.current?.focus(); }} style={styles.instituicaoOption}>
                  <Text style={styles.instituicaoOptionText}>{option.nome}</Text>
                </Pressable>
              )) : <Text style={styles.instituicoesHint}>Nenhuma instituição encontrada.</Text>}
              {matches.length === 8 ? <Text style={styles.instituicoesHint}>Digite mais letras para refinar a busca.</Text> : null}
            </View>
          ) : null}
          {instituicaoId && !showInstituicoes ? <View style={styles.selectedInstitutionRow}><Text style={styles.selectedInstitution}>Instituição selecionada</Text><TextButton title="Trocar instituição" onPress={() => { setInstituicaoId(''); setInstituicaoQuery(''); setShowInstituicoes(true); }} /></View> : null}
          <Text style={styles.label}>E-mail institucional</Text>
          <TextInput ref={emailRef} accessibilityLabel="E-mail institucional" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress" keyboardType="email-address" returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => senhaRef.current?.focus()} placeholder="voce@instituicao.edu" placeholderTextColor={palette.muted} value={email} onChangeText={setEmail} style={styles.input} />
          <Text style={styles.label}>Senha</Text>
          <TextInput ref={senhaRef} accessibilityLabel="Senha" autoComplete="current-password" textContentType="password" secureTextEntry returnKeyType="go" onSubmitEditing={() => void submit()} placeholder="Sua senha" placeholderTextColor={palette.muted} value={senha} onChangeText={setSenha} style={styles.input} />
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          <PrimaryButton title="Entrar" onPress={() => void submit()} loading={busy} disabled={state.status === 'loading' || instituicoesLoading || !!instituicoesError} />
        </View>
        </View>
        {__DEV__ ? <View style={styles.demoCard}>
          <Text style={styles.demoTitle}>Explorar a demonstração</Text>
          <Text style={styles.formDescription}>Exploração visual sem conexão. Para consultar alunos do banco e calcular previsões de ML, use o formulário de login acima.</Text>
          <View style={styles.demoActions}>{(['ADMIN', 'PROFESSOR', 'ALUNO'] as const).map((role) => <Pressable key={role} accessibilityRole="button" disabled={busy || state.status === 'loading'} onPress={() => void enterDemo(role)} style={styles.demoButton}><Text style={styles.demoButtonText}>{role === 'ADMIN' ? 'Admin' : role === 'PROFESSOR' ? 'Professor' : 'Aluno'}</Text></Pressable>)}</View>
        </View> : null}
        <Text style={styles.footer}>Seus dados acadêmicos são acessados conforme seu perfil e sua instituição.</Text>
      </Screen>
  );
}

const styles = StyleSheet.create({
  layout: { gap: 18 },
  layoutWide: { flexDirection: 'row', alignItems: 'stretch' },
  hero: { flex: 1, backgroundColor: palette.primary, borderRadius: 15, overflow: 'hidden', padding: 27, gap: 32, minHeight: 360 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  brandName: { color: palette.surface, fontSize: 21, fontWeight: '800', letterSpacing: 0.2 },
  brandCaption: { color: '#B8D7D4', fontSize: 11, fontWeight: '600' },
  heroCopy: { gap: 9, zIndex: 1 },
  kicker: { color: palette.gold, fontSize: 12, fontWeight: '700' },
  heroTitle: { color: palette.surface, fontSize: 37, lineHeight: 42, fontWeight: '800', letterSpacing: -1.4 },
  heroDescription: { color: '#CEE3DF', fontSize: 14, lineHeight: 21, maxWidth: 310 },
  art: { height: 118, alignItems: 'flex-end', justifyContent: 'flex-end' },
  artCard: { position: 'absolute', width: 192, height: 118, borderRadius: 11 },
  artCardBack: { right: 70, top: 18, backgroundColor: '#28747A', transform: [{ rotate: '-8deg' }] },
  artCardFront: { right: 0, top: 0, backgroundColor: palette.surface, padding: 18, gap: 10 },
  artLineShort: { width: 44, height: 7, borderRadius: 4, backgroundColor: palette.gold },
  artLineLong: { width: 105, height: 7, borderRadius: 4, backgroundColor: palette.line },
  artChart: { flexDirection: 'row', alignItems: 'flex-end', height: 68, gap: 12 },
  artBar: { width: 21, borderRadius: 6, backgroundColor: palette.teal },
  formCard: { flex: 1, backgroundColor: palette.surface, borderRadius: 15, padding: 27, gap: 10, borderWidth: 1, borderColor: palette.line, justifyContent: 'center' },
  formTitle: { color: palette.ink, fontSize: 25, fontWeight: '800', letterSpacing: -0.6 },
  formDescription: { color: palette.muted, fontSize: 14, marginBottom: 8 },
  label: { color: palette.ink, fontSize: 13, fontWeight: '700', marginTop: 4 },
  input: { minHeight: 52, borderWidth: 1, borderColor: palette.line, borderRadius: 9, backgroundColor: palette.surface, color: palette.ink, paddingHorizontal: 15, fontSize: 15 },
  instituicoesList: { borderWidth: 1, borderColor: palette.line, borderRadius: 9, overflow: 'hidden' },
  instituicaoOption: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 15, borderBottomWidth: 1, borderBottomColor: palette.line },
  instituicaoOptionText: { color: palette.ink, fontSize: 14 },
  instituicoesHint: { color: palette.muted, fontSize: 12, padding: 12 },
  selectedInstitution: { color: palette.primary, fontSize: 12 },
  selectedInstitutionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' },
  error: { color: palette.danger, fontSize: 13, lineHeight: 18, marginVertical: 4 },
  notice: { backgroundColor: palette.goldSoft, borderRadius: 14, padding: 12 },
  noticeText: { color: palette.ink, fontSize: 13 },
  footer: { color: palette.muted, fontSize: 12, textAlign: 'center', lineHeight: 18 },
  demoCard: { backgroundColor: palette.primarySoft, borderRadius: 12, padding: 18, gap: 8 },
  demoTitle: { color: palette.ink, fontSize: 16, fontWeight: '800' },
  demoActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  demoButton: { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 11, minHeight: 44, justifyContent: 'center' },
  demoButtonText: { color: palette.primary, fontWeight: '700', fontSize: 13 },
});
