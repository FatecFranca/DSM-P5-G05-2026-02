import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSession } from '@/auth/session';
import { TextButton } from '@/components/primitives';
import { palette, space, type } from '@/constants/design';
import { ActionButton, Avatar, Disclosure, EmptyState, Feedback, FormField, ListRow, Panel, PanelHeader, RowList, SegmentTabs, StatStrip, formatAcademicNumber } from '@/demo/academic-ui';
import type { Credential } from '@/features/people/credentials';
import { countParticipants, isEmptyClass, namesLabel, studentMeta, type ParticipantPermissions, type ParticipantStudent, type ParticipantSubject, type Participants } from '@/features/people/participants-model';
import { CredentialsList } from '@/features/people/people-import';
import { PersonPicker } from '@/features/people/person-picker';
import type { UserSummary } from '@/services/api';
import { RequestState } from './ui';

type Request = ReturnType<typeof useSession>['request'];
export type Indicators = Record<string, { media: number | null; frequencia: number | null }>;

interface Env {
  permissions: ParticipantPermissions;
  request: Request;
  /** Recarrega os participantes (e a tela que contém esta) depois de uma alteração, com a mensagem a mostrar. */
  changed: (message: string) => Promise<void>;
  openPerson?: (userId: string) => void;
  goToPeople?: () => void;
}

const messageOf = (cause: unknown, fallback: string) => (cause instanceof Error ? cause.message : fallback);
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** Uma ação que fala com a API: ocupado enquanto roda, com o erro guardado perto de quem a disparou. */
function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function run(work: () => Promise<void>): Promise<boolean> {
    setBusy(true); setError('');
    try { await work(); return true; }
    catch (cause) { setError(messageOf(cause, 'Não foi possível concluir.')); return false; }
    finally { setBusy(false); }
  }
  return { busy, error, run, clear: () => setError('') };
}

/**
 * Pessoa já vinculada (docente de uma disciplina, tutor de um estudante). Com permissão, "Desvincular" pede
 * confirmação na própria linha, perto do dedo, antes de mexer em qualquer coisa.
 */
function LinkedLine({ name, meta, inactive = false, onOpen, unlink }: {
  name: string;
  meta?: string;
  inactive?: boolean;
  onOpen?: () => void;
  unlink?: { question: string; busy: boolean; run: () => Promise<void> };
}) {
  const [asking, setAsking] = useState(false);
  if (asking && unlink) {
    return <View style={styles.confirm}>
      <Text style={styles.confirmText}>{unlink.question}</Text>
      <View style={styles.inline}>
        <ActionButton compact danger title={unlink.busy ? 'Desvinculando…' : 'Desvincular'} disabled={unlink.busy} onPress={() => void unlink.run().then(() => setAsking(false))} />
        <TextButton flush title="Manter" onPress={() => setAsking(false)} />
      </View>
    </View>;
  }
  const who = <>
    <Avatar name={name} size={36} />
    <View style={styles.lineText}>
      <Text style={[styles.lineName, inactive && styles.lineMuted]}>{name}</Text>
      {meta || inactive ? <Text style={styles.lineMeta}>{[meta, inactive ? 'conta inativa' : ''].filter(Boolean).join(' · ')}</Text> : null}
    </View>
  </>;
  return <View style={styles.line}>
    {onOpen
      ? <Pressable accessibilityRole="button" accessibilityLabel={`Abrir perfil de ${name}`} onPress={onOpen} style={({ pressed }) => [styles.who, pressed && styles.pressed]}>{who}</Pressable>
      : <View style={styles.who}>{who}</View>}
    {unlink ? <TextButton danger title="Desvincular" onPress={() => setAsking(true)} /> : null}
  </View>;
}

/** Uma disciplina e quem a leciona. Aberta, mostra os docentes e deixa vincular outro. */
function SubjectBlock({ subject, env }: { subject: ParticipantSubject; env: Env }) {
  const action = useAction();
  const [picking, setPicking] = useState(false);
  const linked = new Set(subject.docentes.map((teacher) => teacher.id));
  const { openPerson } = env;

  async function link(person: UserSummary) {
    const done = await action.run(async () => { await env.request('/lotacoes', { method: 'POST', body: { disciplinaId: subject.id, professorId: person.id } }); });
    if (done) { setPicking(false); await env.changed(`${person.nome} agora leciona ${subject.nome}.`); }
  }
  async function unlink(teacher: { id: string; nome: string }) {
    const done = await action.run(async () => { await env.request(`/lotacoes/${subject.id}/${teacher.id}`, { method: 'DELETE' }); });
    if (done) await env.changed(`${teacher.nome} não leciona mais ${subject.nome}.`);
  }

  return <Disclosure
    alignValues={false}
    title={subject.nome}
    meta={namesLabel(subject.docentes, 'Nenhum docente vinculado')}
    badge={subject.docentes.length ? undefined : { text: 'Sem docente', tone: 'attention' }}>
    <View style={styles.body}>
      {subject.docentes.length
        ? <RowList>{subject.docentes.map((teacher) => <LinkedLine
          key={teacher.id}
          name={teacher.nome}
          meta={teacher.email}
          inactive={!teacher.ativo}
          onOpen={openPerson ? () => openPerson(teacher.id) : undefined}
          unlink={env.permissions.vincularDocente
            ? { question: `Desvincular ${teacher.nome} de ${subject.nome}? O que já foi lançado (aulas, notas, atividades) continua na disciplina.`, busy: action.busy, run: () => unlink(teacher) }
            : undefined} />)}</RowList>
        : <Text style={styles.empty}>Nenhum docente vinculado a esta disciplina.</Text>}
      {action.error ? <Feedback error message={action.error} /> : null}
      {env.permissions.vincularDocente
        ? picking
          ? <PersonPicker
            perfil="PROFESSOR"
            noun={['docente', 'docentes']}
            exclude={linked}
            busy={action.busy}
            onPick={(person) => void link(person)}
            onCancel={() => setPicking(false)}
            emptyAction={env.goToPeople ? <TextButton flush title="Cadastrar docente em Pessoas" onPress={env.goToPeople} /> : undefined} />
          : <ActionButton compact secondary title="Vincular docente" onPress={() => { action.clear(); setPicking(true); }} />
        : null}
    </View>
  </Disclosure>;
}

/** Um estudante da turma: com permissão, abre para tutoria e remoção; sem ela, é só a pessoa e seu perfil. */
function StudentBlock({ student, indicator, env }: { student: ParticipantStudent; indicator?: Indicators[string]; env: Env }) {
  const action = useAction();
  const [picking, setPicking] = useState(false);
  const [removing, setRemoving] = useState(false);
  const { permissions, openPerson } = env;
  const average = indicator?.media == null ? undefined : formatAcademicNumber(indicator.media);
  const leading = <Avatar name={student.aluno.nome} size={40} />;
  const inactive = !student.aluno.ativo;

  if (!permissions.vincularTutor && !permissions.removerMatricula) {
    return <ListRow
      leading={leading}
      title={student.aluno.nome}
      meta={studentMeta(student)}
      value={average}
      muted={inactive}
      badge={inactive ? { text: 'Inativo', tone: 'danger' } : undefined}
      onPress={openPerson ? () => openPerson(student.aluno.id) : undefined} />;
  }

  const tutors = new Set(student.tutores.map((tutor) => tutor.id));
  async function link(person: UserSummary) {
    const done = await action.run(async () => { await env.request('/tutorias', { method: 'POST', body: { matriculaId: student.matriculaId, tutorId: person.id } }); });
    if (done) { setPicking(false); await env.changed(`${person.nome} agora acompanha ${student.aluno.nome}.`); }
  }
  async function unlink(tutor: { id: string; nome: string }) {
    const done = await action.run(async () => { await env.request(`/tutorias/${student.matriculaId}/${tutor.id}`, { method: 'DELETE' }); });
    if (done) await env.changed(`${tutor.nome} não acompanha mais ${student.aluno.nome}.`);
  }
  async function remove() {
    const done = await action.run(async () => { await env.request(`/matriculas/${student.matriculaId}`, { method: 'DELETE' }); });
    if (done) await env.changed(`${student.aluno.nome} foi removido da turma.`);
    else setRemoving(false);
  }

  return <Disclosure
    alignValues={false}
    leading={leading}
    title={student.aluno.nome}
    meta={studentMeta(student)}
    value={average}
    badge={inactive ? { text: 'Inativo', tone: 'danger' } : undefined}>
    <View style={styles.body}>
      {permissions.vincularTutor ? <>
        <Text style={styles.groupLabel}>Tutoria</Text>
        {student.tutores.length
          ? <RowList>{student.tutores.map((tutor) => <LinkedLine
            key={tutor.id}
            name={tutor.nome}
            onOpen={openPerson ? () => openPerson(tutor.id) : undefined}
            unlink={{ question: `Desvincular ${tutor.nome} da tutoria de ${student.aluno.nome}?`, busy: action.busy, run: () => unlink(tutor) }} />)}</RowList>
          : <Text style={styles.empty}>Nenhum tutor acompanha este estudante.</Text>}
        {picking
          ? <PersonPicker
            perfil="TUTOR"
            noun={['tutor', 'tutores']}
            exclude={tutors}
            busy={action.busy}
            onPick={(person) => void link(person)}
            onCancel={() => setPicking(false)}
            emptyAction={env.goToPeople ? <TextButton flush title="Cadastrar tutor em Pessoas" onPress={env.goToPeople} /> : undefined} />
          : <ActionButton compact secondary title="Vincular tutor" onPress={() => { action.clear(); setPicking(true); }} />}
      </> : null}
      {action.error ? <Feedback error message={action.error} /> : null}
      {removing
        ? <View style={styles.confirm}>
          <Text style={styles.confirmText}>{`Remover ${student.aluno.nome} desta turma? Só é possível enquanto não houver notas, presenças, entregas ou cobranças dele.`}</Text>
          <View style={styles.inline}>
            <ActionButton compact danger title={action.busy ? 'Removendo…' : 'Remover da turma'} disabled={action.busy} onPress={() => void remove()} />
            <TextButton flush title="Manter" onPress={() => setRemoving(false)} />
          </View>
        </View>
        : <View style={styles.inline}>
          {openPerson ? <ActionButton compact secondary title="Ver perfil" onPress={() => openPerson(student.aluno.id)} /> : null}
          {permissions.removerMatricula ? <ActionButton compact secondary danger title="Remover da turma" onPress={() => { action.clear(); setRemoving(true); }} /> : null}
        </View>}
    </View>
  </Disclosure>;
}

/**
 * Matricular na turma: escolher uma conta de estudante que já existe ou cadastrar uma nova e matriculá-la de
 * uma vez. Cadastro novo gera a senha temporária, que aparece uma única vez.
 */
function EnrollForm({ data, env, onClose }: { data: Participants; env: Env; onClose: () => void }) {
  const action = useAction();
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [chosen, setChosen] = useState<UserSummary | null>(null);
  const [registro, setRegistro] = useState('');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [credential, setCredential] = useState<Credential | null>(null);
  const [partial, setPartial] = useState('');
  const enrolled = new Set(data.estudantes.map((student) => student.aluno.id));

  async function enrollExisting() {
    if (!chosen) return;
    if (!registro.trim()) { action.clear(); setPartial('Informe o registro acadêmico do estudante.'); return; }
    setPartial('');
    const done = await action.run(async () => { await env.request('/matriculas', { method: 'POST', body: { turmaId: data.turma.id, alunoId: chosen.id, registro: registro.trim() } }); });
    if (done) { onClose(); await env.changed(`${chosen.nome} foi matriculado em ${data.turma.nome}.`); }
  }

  async function createAndEnroll() {
    setPartial('');
    if (!nome.trim() || !email.trim() || !registro.trim()) { setPartial('Preencha nome, e-mail e registro.'); return; }
    const made: { accountCreated: boolean } = { accountCreated: false };
    const done = await action.run(async () => {
      const created = await env.request<UserSummary & { senhaTemporaria?: string }>('/usuarios', { method: 'POST', body: { nome: nome.trim(), email: email.trim(), perfil: 'ALUNO' } });
      made.accountCreated = true;
      if (created.senhaTemporaria) setCredential({ linha: 0, nome: created.nome, email: created.email, registro: registro.trim(), senhaTemporaria: created.senhaTemporaria });
      await env.request('/matriculas', { method: 'POST', body: { turmaId: data.turma.id, alunoId: created.id, registro: registro.trim() } });
    });
    if (done) await env.changed(`${nome.trim()} foi cadastrado e matriculado em ${data.turma.nome}.`);
    // A conta já existe mesmo que a matrícula tenha falhado: a senha continua na tela e o resto se resolve pela lista.
    else if (made.accountCreated) setPartial('A conta foi criada, mas a matrícula não. Anote a senha e matricule a conta pela aba “Já cadastrado”.');
  }

  if (credential) {
    return <View style={styles.stack}>
      {partial ? <Feedback error message={partial} /> : null}
      {action.error ? <Feedback error message={action.error} /> : null}
      <CredentialsList items={[credential]} fileName="senha-temporaria.csv" onDone={onClose} />
    </View>;
  }

  return <View style={styles.form}>
    <SegmentTabs label="Tipo de matrícula" selected={mode} onSelect={(next) => { setMode(next); action.clear(); setPartial(''); }} items={[{ key: 'existing', label: 'Já cadastrado' }, { key: 'new', label: 'Novo estudante' }]} />
    {mode === 'existing'
      ? chosen
        ? <View style={styles.stack}>
          <RowList><ListRow leading={<Avatar name={chosen.nome} size={36} />} title={chosen.nome} meta={chosen.email} /></RowList>
          <FormField label="Registro acadêmico" value={registro} onChangeText={setRegistro} />
          <View style={styles.inline}>
            <ActionButton compact title={action.busy ? 'Matriculando…' : 'Matricular'} disabled={action.busy} onPress={() => void enrollExisting()} />
            <TextButton flush title="Trocar estudante" onPress={() => { setChosen(null); setPartial(''); action.clear(); }} />
          </View>
        </View>
        : <PersonPicker
          perfil="ALUNO"
          noun={['estudante', 'estudantes']}
          exclude={enrolled}
          onPick={setChosen}
          onCancel={onClose}
          emptyAction={<TextButton flush title="Cadastrar um novo estudante" onPress={() => setMode('new')} />} />
      : <View style={styles.stack}>
        <FormField label="Nome completo" value={nome} onChangeText={setNome} />
        <FormField label="E-mail" value={email} onChangeText={setEmail} />
        <FormField label="Registro acadêmico" value={registro} onChangeText={setRegistro} />
        <Text style={styles.empty}>A senha inicial é gerada e aparece uma vez; o estudante troca no primeiro acesso.</Text>
        <View style={styles.inline}>
          <ActionButton compact title={action.busy ? 'Cadastrando…' : 'Cadastrar e matricular'} disabled={action.busy} onPress={() => void createAndEnroll()} />
          <TextButton flush title="Cancelar" onPress={onClose} />
        </View>
      </View>}
    {partial ? <Feedback error message={partial} /> : null}
    {action.error ? <Feedback error message={action.error} /> : null}
  </View>;
}

/** Nova disciplina na turma: um campo e um botão. */
function SubjectForm({ turmaId, env, onClose }: { turmaId: string; env: Env; onClose: () => void }) {
  const action = useAction();
  const [nome, setNome] = useState('');
  const [hint, setHint] = useState('');
  async function save() {
    if (!nome.trim()) { setHint('Informe o nome da disciplina.'); return; }
    setHint('');
    const done = await action.run(async () => { await env.request('/disciplinas', { method: 'POST', body: { turmaId, nome: nome.trim() } }); });
    if (done) { onClose(); await env.changed(`Disciplina ${nome.trim()} adicionada. Agora vincule o docente.`); }
  }
  return <View style={styles.form}>
    <FormField label="Nome da disciplina" value={nome} onChangeText={setNome} />
    {hint ? <Feedback error message={hint} /> : null}
    {action.error ? <Feedback error message={action.error} /> : null}
    <View style={styles.inline}>
      <ActionButton compact title={action.busy ? 'Salvando…' : 'Adicionar disciplina'} disabled={action.busy} onPress={() => void save()} />
      <TextButton flush title="Cancelar" onPress={onClose} />
    </View>
  </View>;
}

/**
 * Quem faz parte da turma e como cada pessoa se liga a ela: disciplinas com seus docentes, estudantes com
 * seus tutores. É o lugar de montar a turma (coordenação e secretaria) e de saber com quem se trabalha
 * (docente e tutoria). A API devolve `permissoes`; as ações que o perfil não tem simplesmente não aparecem.
 */
export function ClassParticipants({ turmaId, indicators, openPerson, goToPeople, onChanged }: {
  turmaId: string;
  indicators?: Indicators;
  openPerson?: (userId: string) => void;
  goToPeople?: () => void;
  /** Avisa a tela que contém esta que algo mudou, para ela recarregar o que depende dos vínculos. */
  onChanged?: () => void;
}) {
  const { state, request } = useSession();
  const perfil = state.status === 'signedIn' ? state.user.perfil : null;
  const manager = perfil === 'COORDENACAO' || perfil === 'SECRETARIA';
  const [data, setData] = useState<Participants | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [enrolling, setEnrolling] = useState(false);
  const [addingSubject, setAddingSubject] = useState(false);

  const load = useCallback(async () => {
    try { setData(await request<Participants>(`/turmas/${encodeURIComponent(turmaId)}/participantes`)); setError(''); }
    catch (cause) { setError(messageOf(cause, 'Não foi possível carregar as pessoas da turma.')); }
    finally { setLoading(false); }
  }, [request, turmaId]);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  const changed = useCallback(async (message: string) => {
    setNotice(message);
    await load();
    onChanged?.();
  }, [load, onChanged]);

  if (loading || error || !data) {
    return <RequestState loading={loading} error={error} onRetry={() => { setLoading(true); setError(''); void load(); }} />;
  }

  const env: Env = { permissions: data.permissoes, request, changed, openPerson, goToPeople };
  const counts = countParticipants(data);
  const perms = data.permissoes;
  const nothing = isEmptyClass(data);

  return <>
    {notice ? <Feedback message={notice} /> : null}
    {manager && data.turma.fechada ? <Feedback message="Período fechado: os vínculos não podem ser alterados. Reabra o período na área acadêmica para mudar." /> : null}
    {nothing && (perms.criarDisciplina || perms.matricular)
      ? <EmptyState title="Esta turma ainda está vazia" detail="Monte nesta ordem: adicione as disciplinas, vincule o docente de cada uma e matricule os estudantes." />
      : null}
    {!nothing ? <StatStrip items={[
      { label: counts.estudantes === 1 ? 'Estudante' : 'Estudantes', value: String(counts.estudantes) },
      { label: counts.docentes === 1 ? 'Docente' : 'Docentes', value: String(counts.docentes) },
      { label: counts.disciplinas === 1 ? 'Disciplina' : 'Disciplinas', value: String(counts.disciplinas) },
    ]} /> : null}

    <Panel>
      <PanelHeader title="Disciplinas e docentes" />
      {data.disciplinas.length
        ? <RowList>{data.disciplinas.map((subject) => <SubjectBlock key={subject.id} subject={subject} env={env} />)}</RowList>
        : <Text style={styles.empty}>{perms.criarDisciplina ? 'Nenhuma disciplina cadastrada nesta turma.' : 'Esta turma ainda não tem disciplinas.'}</Text>}
      {perms.criarDisciplina
        ? addingSubject
          ? <SubjectForm turmaId={data.turma.id} env={env} onClose={() => setAddingSubject(false)} />
          // O primeiro passo de uma turma vazia é a disciplina: ela é a ação principal até existir uma.
          : <ActionButton compact secondary={data.disciplinas.length > 0} title="Adicionar disciplina" onPress={() => setAddingSubject(true)} />
        : null}
    </Panel>

    <Panel>
      <PanelHeader title={perfil === 'TUTOR' ? 'Estudantes que você acompanha' : 'Estudantes'} />
      {counts.semDocente > 0 && perms.vincularDocente ? <Text style={styles.empty}>{`${plural(counts.semDocente, 'disciplina está', 'disciplinas estão')} sem docente.`}</Text> : null}
      {data.estudantes.length
        ? <RowList>{data.estudantes.map((student) => <StudentBlock key={student.matriculaId} student={student} indicator={indicators?.[student.matriculaId]} env={env} />)}</RowList>
        : <Text style={styles.empty}>{perms.matricular ? 'Nenhum estudante matriculado nesta turma.' : 'Nenhum estudante para mostrar nesta turma.'}</Text>}
      {perms.matricular
        ? enrolling
          ? <EnrollForm data={data} env={env} onClose={() => setEnrolling(false)} />
          : <ActionButton compact secondary={perms.criarDisciplina && data.disciplinas.length === 0} title="Matricular estudante" onPress={() => setEnrolling(true)} />
        : null}
    </Panel>
  </>;
}

const styles = StyleSheet.create({
  body: { gap: space.sm, paddingVertical: space.xs },
  stack: { gap: space.sm },
  form: { gap: space.md },
  inline: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: space.md, rowGap: space.sm },
  empty: { color: palette.muted, ...type.caption },
  groupLabel: { color: palette.muted, ...type.caption, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, minHeight: 52 },
  who: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  lineText: { flex: 1, gap: 1 },
  lineName: { color: palette.ink, ...type.label },
  lineMuted: { color: palette.muted },
  lineMeta: { color: palette.muted, ...type.caption },
  pressed: { opacity: 0.72 },
  confirm: { gap: space.sm, paddingVertical: space.md },
  confirmText: { color: palette.ink, ...type.body },
});
