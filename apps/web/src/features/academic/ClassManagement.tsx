import { useEffect, useState, type FormEvent } from 'react';
import { useSession } from '../../auth/Session';
import { Empty, Panel, StateMessage } from '../../components/UI';
import type { User } from '../../services/contracts';

interface Person { id: string; nome: string; email: string; ativo: boolean }
interface Participants {
  turma: { id: string; nome: string; fechada: boolean };
  disciplinas: { id: string; nome: string; docentes: Person[] }[];
  estudantes: { matriculaId: string; registro: string; aluno: Person; tutores: Person[] }[];
  permissoes: { criarDisciplina: boolean; vincularDocente: boolean; vincularTutor: boolean; matricular: boolean; removerMatricula: boolean };
}

interface Props { turmaId: string; onChanged?: () => void }
const message = (error: unknown) => error instanceof Error ? error.message : 'Não foi possível concluir a operação.';

export function ClassManagement({ turmaId, onChanged }: Props) {
  const { request, session } = useSession();
  const [data, setData] = useState<Participants | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [subjectName, setSubjectName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [registration, setRegistration] = useState('');
  const [newRegistration, setNewRegistration] = useState('');
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [credential, setCredential] = useState<{ email: string; password: string } | null>(null);
  const [pending, setPending] = useState<{ label: string; path: string } | null>(null);
  const manager = session?.user.perfil === 'COORDENACAO';

  useEffect(() => {
    let active = true;
    setLoading(true); setData(null);
    void Promise.all([
      request<Participants>(`/turmas/${encodeURIComponent(turmaId)}/participantes`),
      request<User[]>('/usuarios').catch(() => []),
    ]).then(([participants, people]) => {
      if (!active) return;
      setData(participants); setUsers(people); setError('');
    }).catch((cause: unknown) => { if (active) setError(message(cause)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [request, turmaId, revision]);

  async function run(work: () => Promise<unknown>, success: string) {
    setBusy(true); setError(''); setNotice('');
    try { await work(); setNotice(success); setRevision((value) => value + 1); onChanged?.(); return true; }
    catch (cause) { setError(message(cause)); return false; }
    finally { setBusy(false); }
  }

  const candidates = (perfil: User['perfil'], linked: string[]) => users.filter((person) => person.perfil === perfil && person.ativo && !linked.includes(person.id));
  if (loading && !data) return <StateMessage loading error="" retry={() => setRevision((value) => value + 1)} />;
  if (!data) return <StateMessage loading={false} error={error || 'Turma indisponível.'} retry={() => setRevision((value) => value + 1)} />;
  const can = data.permissoes;

  async function addStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const done = await run(() => request('/matriculas', { method: 'POST', body: { turmaId, alunoId: studentId, registro: registration.trim() } }), 'Estudante matriculado.');
    if (done) { setStudentId(''); setRegistration(''); }
  }

  async function createStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setNotice(''); setCredential(null);
    try {
      const created = await request<User & { senhaTemporaria?: string }>('/usuarios', { method: 'POST', body: { nome: newName.trim(), email: newEmail.trim(), perfil: 'ALUNO' } });
      if (created.senhaTemporaria) setCredential({ email: created.email, password: created.senhaTemporaria });
      try {
        await request('/matriculas', { method: 'POST', body: { turmaId, alunoId: created.id, registro: newRegistration.trim() } });
        setNotice('Conta criada e estudante matriculado.'); setNewName(''); setNewEmail(''); setNewRegistration('');
      } catch (cause) { setError(`Conta criada, mas a matrícula falhou: ${message(cause)}. A conta pode ser matriculada pelo formulário acima.`); }
      setRevision((value) => value + 1); onChanged?.();
    } catch (cause) { setError(message(cause)); }
    finally { setBusy(false); }
  }

  return <>
    {error && <p className="form-error" role="alert">{error}</p>}
    {notice && <p className="form-success" role="status">{notice}</p>}
    {credential && <div className="credential" role="status"><strong>Senha temporária de {credential.email}</strong><p>Guarde e entregue à pessoa agora. Ela não será exibida novamente.</p><code>{credential.password}</code><button type="button" className="text-button" onClick={() => setCredential(null)}>Já guardei</button></div>}
    {pending && <div className="confirm-box" role="group" aria-label="Confirmar desvinculação"><p>{pending.label}</p><button type="button" className="danger-button" disabled={busy} onClick={() => void run(() => request(pending.path, { method: 'DELETE' }), 'Vínculo removido.').then((done) => { if (done) setPending(null); })}>Confirmar remoção</button><button type="button" className="secondary-button" onClick={() => setPending(null)}>Cancelar</button></div>}
    <Panel title="Disciplinas e docentes">
      {data.disciplinas.length ? <div className="rows">{data.disciplinas.map((subject) => <div className="management-row" key={subject.id}>
        <strong>{subject.nome}</strong><small>{subject.docentes.map((person) => person.nome).join(', ') || 'Nenhum docente vinculado'}</small>
        {can.vincularDocente && <><div className="inline-actions">{subject.docentes.map((person) => <button key={person.id} type="button" className="text-button" onClick={() => setPending({ label: `Desvincular ${person.nome} de ${subject.nome}? Os registros já lançados serão mantidos.`, path: `/lotacoes/${subject.id}/${person.id}` })}>Desvincular {person.nome}</button>)}</div><form className="action-form" onSubmit={(event) => { event.preventDefault(); const select = event.currentTarget.elements.namedItem('professorId') as HTMLSelectElement; void run(() => request('/lotacoes', { method: 'POST', body: { disciplinaId: subject.id, professorId: select.value } }), 'Docente vinculado.'); }}><label>Vincular docente<select name="professorId" required defaultValue=""><option value="">Selecione</option>{candidates('PROFESSOR', subject.docentes.map((person) => person.id)).map((person) => <option key={person.id} value={person.id}>{person.nome}</option>)}</select></label><button className="secondary-button" disabled={busy}>Vincular</button></form></>}
      </div>)}</div> : <Empty title="Nenhuma disciplina" detail="Adicione uma disciplina antes de vincular docentes." />}
      {can.criarDisciplina && <form className="inline-form" onSubmit={(event) => { event.preventDefault(); void run(() => request('/disciplinas', { method: 'POST', body: { turmaId, nome: subjectName.trim() } }), 'Disciplina criada.').then((done) => { if (done) setSubjectName(''); }); }}><label>Nova disciplina<input required maxLength={120} value={subjectName} onChange={(event) => setSubjectName(event.target.value)} /></label><button className="primary-button" disabled={busy}>Adicionar disciplina</button></form>}
    </Panel>
    <Panel title="Estudantes e tutoria">
      {data.estudantes.length ? <div className="rows">{data.estudantes.map((student) => <div className="management-row" key={student.matriculaId}>
        <strong>{student.aluno.nome}</strong><small>Registro {student.registro} · Tutoria: {student.tutores.map((person) => person.nome).join(', ') || 'não vinculada'}</small>
        {can.vincularTutor && <><div className="inline-actions">{student.tutores.map((person) => <button key={person.id} type="button" className="text-button" onClick={() => setPending({ label: `Desvincular ${person.nome} da tutoria de ${student.aluno.nome}?`, path: `/tutorias/${student.matriculaId}/${person.id}` })}>Desvincular {person.nome}</button>)}</div><form className="action-form" onSubmit={(event) => { event.preventDefault(); const select = event.currentTarget.elements.namedItem('tutorId') as HTMLSelectElement; void run(() => request('/tutorias', { method: 'POST', body: { matriculaId: student.matriculaId, tutorId: select.value } }), 'Tutor vinculado.'); }}><label>Vincular tutor<select name="tutorId" required defaultValue=""><option value="">Selecione</option>{candidates('TUTOR', student.tutores.map((person) => person.id)).map((person) => <option key={person.id} value={person.id}>{person.nome}</option>)}</select></label><button className="secondary-button" disabled={busy}>Vincular</button></form></>}
        {can.removerMatricula && <button type="button" className="text-button danger-text" onClick={() => setPending({ label: `Remover ${student.aluno.nome} da turma? A API só permite a remoção se não houver registros acadêmicos ou cobranças.`, path: `/matriculas/${student.matriculaId}` })}>Remover da turma</button>}
      </div>)}</div> : <Empty title="Nenhum estudante matriculado" detail="Matricule uma conta existente ou cadastre um novo estudante." />}
      {can.matricular && <div className="management-forms"><form className="inline-form" onSubmit={(event) => void addStudent(event)}><h3>Matricular pessoa cadastrada</h3><label>Estudante<select required value={studentId} onChange={(event) => setStudentId(event.target.value)}><option value="">Selecione</option>{candidates('ALUNO', data.estudantes.map((item) => item.aluno.id)).map((person) => <option key={person.id} value={person.id}>{person.nome} · {person.email}</option>)}</select></label><label>Registro acadêmico<input required maxLength={60} value={registration} onChange={(event) => setRegistration(event.target.value)} /></label><button className="primary-button" disabled={busy}>Matricular</button></form><form className="inline-form" onSubmit={(event) => void createStudent(event)}><h3>Cadastrar e matricular</h3><label>Nome<input required maxLength={120} value={newName} onChange={(event) => setNewName(event.target.value)} /></label><label>E-mail<input required type="email" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} /></label><label>Registro acadêmico<input required maxLength={60} value={newRegistration} onChange={(event) => setNewRegistration(event.target.value)} /></label><button className="secondary-button" disabled={busy}>Cadastrar e matricular</button></form></div>}
    </Panel>
    {manager && <Panel title="Período letivo"><div className="panel-body"><p>{data.turma.fechada ? 'O período está fechado para alterações acadêmicas.' : 'Fechar o período bloqueia alterações de notas e frequência.'}</p><button type="button" className="secondary-button" disabled={busy} onClick={() => { if (window.confirm(data.turma.fechada ? 'Reabrir o período desta turma?' : 'Fechar o período desta turma?')) void run(() => request(`/turmas/${turmaId}/fechamento`, { method: 'PATCH', body: { fechada: !data.turma.fechada } }), data.turma.fechada ? 'Período reaberto.' : 'Período fechado.'); }}>{data.turma.fechada ? 'Reabrir período' : 'Fechar período'}</button></div></Panel>}
  </>;
}
