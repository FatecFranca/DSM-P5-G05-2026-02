import { useEffect, useState, type FormEvent } from 'react';
import { useSession } from '../../auth/Session';
import { Empty, Panel, StateMessage } from '../../components/UI';
import type { Perfil, User } from '../../services/contracts';

const roleNames: Record<Perfil, string> = { COORDENACAO: 'Coordenação', SECRETARIA: 'Secretaria', PROFESSOR: 'Docente', TUTOR: 'Tutoria', ALUNO: 'Estudante' };
const roles: Perfil[] = ['ALUNO', 'PROFESSOR', 'TUTOR', 'COORDENACAO', 'SECRETARIA'];
type Credential = { nome: string; email: string; registro?: string | null; senhaTemporaria: string };
interface ImportResult { simulacao: boolean; resumo: { linhas: number; usuariosNovos: number; usuariosExistentes: number; matriculasNovas: number; matriculasExistentes: number }; credenciais: Credential[] }
const message = (cause: unknown) => cause instanceof Error ? cause.message : 'Não foi possível concluir a operação.';
const csvCell = (value: string) => { const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value; return /[;"\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe; };

function Credentials({ items, onDone }: { items: Credential[]; onDone: () => void }) {
  function save() {
    const rows = [['Nome', 'E-mail', 'Registro', 'Senha temporária'], ...items.map((item) => [item.nome, item.email, item.registro ?? '', item.senhaTemporaria])];
    const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(';')).join('\r\n')}\r\n`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'senhas-temporarias.csv'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
  return <Panel title="Senhas temporárias"><div className="panel-body"><p>Salve e entregue estas senhas agora. Elas não serão exibidas novamente e cada pessoa deve trocá-las no primeiro acesso.</p>{items.map((item) => <div className="credential" key={item.email}><strong>{item.nome} · {item.email}</strong><code>{item.senhaTemporaria}</code></div>)}<div className="inline-actions"><button type="button" className="primary-button" onClick={save}>Salvar CSV</button><button type="button" className="secondary-button" onClick={onDone}>Já salvei, concluir</button></div></div></Panel>;
}

export function PeoplePage() {
  const { request, session } = useSession();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<Perfil | 'TODOS'>('TODOS');
  const [selectedId, setSelectedId] = useState('');
  const [mode, setMode] = useState<'list' | 'create' | 'edit' | 'import'>('list');
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [newRole, setNewRole] = useState<Perfil>('ALUNO');
  const [credential, setCredential] = useState<Credential[]>([]);
  const [importRole, setImportRole] = useState<'ALUNO' | 'PROFESSOR'>('ALUNO');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const canManage = session?.user.perfil === 'COORDENACAO';
  const secretary = session?.user.perfil === 'SECRETARIA';

  useEffect(() => {
    let active = true; setLoading(true);
    void request<User[]>('/usuarios').then((value) => { if (active) { setUsers(value); setError(''); } })
      .catch((cause: unknown) => { if (active) setError(message(cause)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [request, revision]);

  if (!canManage && !secretary) return <p className="state-message" role="alert">Área indisponível para este perfil.</p>;
  const selected = users.find((item) => item.id === selectedId);
  const visible = users.filter((item) => (role === 'TODOS' || item.perfil === role) && `${item.nome} ${item.email}`.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR'))).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const close = () => { setMode('list'); setSelectedId(''); setPreview(null); setImportResult(null); setFile(null); setError(''); };
  const refresh = () => setRevision((value) => value + 1);

  async function run(work: () => Promise<unknown>, success: string) {
    setBusy(true); setError(''); setNotice('');
    try { await work(); setNotice(success); refresh(); return true; }
    catch (cause) { setError(message(cause)); return false; }
    finally { setBusy(false); }
  }

  async function savePerson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mode === 'create') {
      let created: User & { senhaTemporaria?: string } | null = null;
      const done = await run(async () => { created = await request<User & { senhaTemporaria?: string }>('/usuarios', { method: 'POST', body: { nome: name.trim(), email: email.trim(), perfil: newRole } }); }, 'Pessoa cadastrada.');
      if (done && created) {
        const person: User & { senhaTemporaria?: string } = created;
        if (person.senhaTemporaria) setCredential([{ nome: person.nome, email: person.email, senhaTemporaria: person.senhaTemporaria }]);
        setMode('list'); setName(''); setEmail('');
      }
    } else if (selected) {
      const done = await run(() => request(`/usuarios/${selected.id}`, { method: 'PATCH', body: { nome: name.trim(), email: email.trim() } }), 'Pessoa atualizada.');
      if (done) setMode('list');
    }
  }

  async function resetPassword() {
    if (!selected || !window.confirm(`Gerar uma nova senha temporária para ${selected.nome}? O acesso atual será encerrado.`)) return;
    let result: { nome: string; email: string; senhaTemporaria: string } | null = null;
    const done = await run(async () => { result = await request<{ nome: string; email: string; senhaTemporaria: string }>(`/usuarios/${selected.id}/redefinir-senha`, { method: 'POST' }); }, 'Senha redefinida.');
    if (done && result) setCredential([result]);
  }

  async function downloadTemplate() {
    setBusy(true); setError('');
    try {
      const bytes = await request<ArrayBuffer>(`/usuarios/importacoes/modelo?perfil=${importRole}`, { binary: true });
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      const link = document.createElement('a'); link.href = url; link.download = `modelo-${importRole.toLowerCase()}.xlsx`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (cause) { setError(message(cause)); }
    finally { setBusy(false); }
  }

  async function importPeople(simulate: boolean) {
    if (!file) { setError('Selecione a planilha Excel.'); return; }
    setBusy(true); setError('');
    try {
      const form = new FormData(); form.append('arquivo', file, file.name);
      const result = await request<ImportResult>(`/usuarios/importacoes?perfil=${importRole}${simulate ? '&simular=true' : ''}`, { method: 'POST', body: form });
      if (simulate) setPreview(result);
      else { setImportResult(result); setCredential(result.credenciais); setPreview(null); refresh(); }
    } catch (cause) { setError(message(cause)); }
    finally { setBusy(false); }
  }

  return <>
    <div className="page-heading"><div><p className="section-label">Comunidade acadêmica</p><h1>Pessoas</h1><p>Cadastros da instituição e vínculos acadêmicos.</p></div>{canManage && mode === 'list' && !credential.length && <div className="inline-actions"><button type="button" className="secondary-button" onClick={() => { setMode('import'); setError(''); }}>Importar planilha</button><button type="button" className="primary-button" onClick={() => { setMode('create'); setName(''); setEmail(''); setError(''); }}>Cadastrar pessoa</button></div>}</div>
    {error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="form-success" role="status">{notice}</p>}
    {credential.length > 0 && <Credentials items={credential} onDone={() => { setCredential([]); if (importResult) close(); }} />}
    {mode === 'create' || mode === 'edit' ? <Panel title={mode === 'create' ? 'Cadastrar pessoa' : 'Editar dados'}><form className="inline-form" onSubmit={(event) => void savePerson(event)}><label>Nome<input required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} /></label><label>E-mail<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>{mode === 'create' && <label>Perfil<select value={newRole} onChange={(event) => setNewRole(event.target.value as Perfil)}>{roles.map((item) => <option key={item} value={item}>{roleNames[item]}</option>)}</select></label>}<button className="primary-button" disabled={busy}>{busy ? 'Salvando…' : 'Salvar'}</button><button type="button" className="text-button" onClick={close}>Cancelar</button></form></Panel> : null}
    {mode === 'import' && <Panel title="Importar pessoas"><div className="panel-body"><p>Confira a planilha antes de confirmar. A simulação não grava dados.</p><div className="inline-actions"><label>Perfil<select value={importRole} onChange={(event) => { setImportRole(event.target.value as 'ALUNO' | 'PROFESSOR'); setPreview(null); }}><option value="ALUNO">Estudantes</option><option value="PROFESSOR">Docentes</option></select></label><button type="button" className="secondary-button" disabled={busy} onClick={() => void downloadTemplate()}>Baixar modelo</button></div><label>Planilha Excel<input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => { setFile(event.currentTarget.files?.[0] ?? null); setPreview(null); }} /></label><div className="inline-actions"><button type="button" className="secondary-button" disabled={busy || !file} onClick={() => void importPeople(true)}>Conferir planilha</button><button type="button" className="text-button" onClick={close}>Fechar</button></div>{preview && <div className="import-preview" role="status"><strong>{preview.resumo.linhas} linhas conferidas</strong><p>{preview.resumo.usuariosNovos} contas novas · {preview.resumo.usuariosExistentes} já cadastradas · {preview.resumo.matriculasNovas} matrículas novas</p><button type="button" className="primary-button" disabled={busy || preview.resumo.usuariosNovos + preview.resumo.matriculasNovas === 0} onClick={() => void importPeople(false)}>Confirmar importação</button></div>}{importResult && !credential.length && <p className="form-success" role="status">Importação concluída: {importResult.resumo.usuariosNovos} contas novas.</p>}</div></Panel>}
    {mode === 'list' && <div className="two-columns"><Panel title="Diretório" action={<input className="search-input" aria-label="Buscar pessoa" placeholder="Buscar nome ou e-mail" value={query} onChange={(event) => setQuery(event.target.value)} />}><div className="filter-row" role="group" aria-label="Filtrar por perfil"><button type="button" className={role === 'TODOS' ? 'filter-active' : ''} onClick={() => setRole('TODOS')}>Todos</button>{roles.map((item) => <button type="button" key={item} className={role === item ? 'filter-active' : ''} onClick={() => setRole(item)}>{roleNames[item]}</button>)}</div><StateMessage loading={loading} error={error} retry={refresh} />{!loading && !error && (visible.length ? <div className="rows">{visible.map((person) => <button type="button" className="row-button" key={person.id} onClick={() => setSelectedId(person.id)}><span className="person-avatar">{person.nome.slice(0, 1).toUpperCase()}</span><span className="row-copy"><strong>{person.nome}</strong><small>{person.email}</small></span><span className="status">{roleNames[person.perfil]}</span></button>)}</div> : <Empty title="Nenhuma pessoa encontrada" detail="Revise o filtro ou cadastre uma pessoa." />)}</Panel><Panel title="Perfil">{selected ? <div className="panel-body"><h2>{selected.nome}</h2><p>{selected.email}</p><p>{roleNames[selected.perfil]} · {selected.ativo ? 'Conta ativa' : 'Conta desativada'}</p>{canManage && selected.id !== session?.user.id && <div className="inline-actions"><button type="button" className="secondary-button" onClick={() => { setName(selected.nome); setEmail(selected.email); setMode('edit'); }}>Editar dados</button><button type="button" className="secondary-button" disabled={busy} onClick={() => void resetPassword()}>Redefinir senha</button><button type="button" className={selected.ativo ? 'danger-button' : 'secondary-button'} disabled={busy} onClick={() => { if (window.confirm(selected.ativo ? `Desativar ${selected.nome}? A pessoa perderá o acesso imediatamente.` : `Reativar a conta de ${selected.nome}?`)) void run(() => request(`/usuarios/${selected.id}`, { method: 'PATCH', body: { ativo: !selected.ativo } }), selected.ativo ? 'Conta desativada.' : 'Conta reativada.'); }}>{selected.ativo ? 'Desativar conta' : 'Reativar conta'}</button></div>}</div> : <Empty title="Selecione uma pessoa" detail="Abra um cadastro para ver os detalhes." />}</Panel></div>}
  </>;
}
