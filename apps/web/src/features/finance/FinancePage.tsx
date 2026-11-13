import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useSession } from '../../auth/Session';
import { Empty, StateMessage } from '../../components/UI';
import { useOverview } from '../academic/overview';
import { money, parseMoney, paymentBody, type Enrollment, type Invoice, type Plan, type Scholarship, type Semester } from './finance';
import './finance.css';

type Action = 'invoice' | 'plan' | 'scholarship' | 'payment' | 'simulate' | 'duration';
interface Account { invoices: Invoice[]; semesters: Semester[]; plan: Plan | null; scholarship: Scholarship | null }
interface Editor { action: Action; invoice?: Invoice }
const titles: Record<Action, string> = { invoice: 'Emitir fatura', plan: 'Plano de mensalidades', scholarship: 'Bolsa institucional', payment: 'Registrar pagamento', simulate: 'Simular pagamento', duration: 'Duração do curso' };
const problem = (cause: unknown) => cause instanceof Error ? cause.message : 'Não foi possível concluir. Tente novamente.';
const date = (value: string) => value.slice(0, 10).split('-').reverse().join('/');

interface EditorProps { editor: Editor; enrollment: Enrollment; account: Account; onSaved: (message: string, duration?: number) => void; onClose: () => void }
function FinanceEditor({ editor, enrollment, account, onSaved, onClose }: EditorProps) {
  const { request } = useSession();
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState('');
  const { action, invoice } = editor;
  const plan = account.plan;
  const scholarship = account.scholarship;
  const balance = invoice ? invoice.valorCentavos - invoice.pagoCentavos : 0;
  const today = new Date().toLocaleDateString('sv-SE');
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (lock.current) return;
    const values = new FormData(event.currentTarget);
    const text = (key: string) => String(values.get(key) ?? '').trim();
    lock.current = true; setBusy(true); setError('');
    try {
      if (action === 'payment' && invoice) await request(`/faturas/${invoice.id}/pagamentos`, { method: 'POST', body: paymentBody(text('valor'), text('referencia'), balance) });
      if (action === 'simulate' && invoice) await request(`/faturas/${invoice.id}/simular-pagamento`, { method: 'POST' });
      if (action === 'invoice') {
        const semestre = Number(text('semestre'));
        if (!plan && (!Number.isInteger(semestre) || semestre < 1 || semestre > enrollment.turma.duracaoSemestres)) throw new Error('Semestre inválido para a duração do curso.');
        await request('/faturas', { method: 'POST', body: { matriculaId: enrollment.id, competencia: text('inicio'), vencimento: text('vencimento'), valorCentavos: parseMoney(text('valor')), ...(!plan ? { semestre } : {}) } });
      }
      if (action === 'plan') {
        if (text('fim') && text('fim') < text('inicio')) throw new Error('A última competência deve ser posterior ou igual à primeira.');
        await request(`/faturas/matriculas/${enrollment.id}/plano`, { method: 'PUT', body: { inicioCompetencia: text('inicio'), ...(text('fim') ? { fimCompetencia: text('fim') } : {}), valorCentavos: parseMoney(text('valor')), diaVencimento: Number(text('dia')), ativo: text('ativo') === 'true' } });
      }
      if (action === 'scholarship') {
        if (text('fim') && text('fim') < text('inicio')) throw new Error('O fim da bolsa deve ser posterior ou igual ao início.');
        await request(`/bolsas/matriculas/${enrollment.id}`, { method: 'PUT', body: { inicio: text('inicio'), ...(text('fim') ? { fim: text('fim') } : {}), ativa: text('ativo') === 'true' } });
      }
      if (action === 'duration') await request(`/turmas/${enrollment.turma.id}/duracao`, { method: 'PUT', body: { duracaoSemestres: Number(text('duracao')) } });
      onSaved(action === 'payment' ? 'Pagamento registrado.' : action === 'simulate' ? 'Pagamento simulado registrado. Nenhum dinheiro foi movimentado.' : 'Dados salvos.', action === 'duration' ? Number(text('duracao')) : undefined);
    } catch (cause) { setError(problem(cause)); }
    finally { lock.current = false; setBusy(false); }
  }
  return <section className="finance-editor" aria-labelledby="finance-editor-title"><div className="finance-section-head"><h2 id="finance-editor-title">{titles[action]}</h2><button type="button" className="text-button" disabled={busy} onClick={onClose}>Cancelar</button></div>
    <p>{enrollment.aluno.nome} — matrícula {enrollment.registro}</p>
    <form onSubmit={(event) => void save(event)}><fieldset disabled={busy}>
      {invoice && <p className="payment-context">Competência {invoice.competencia.slice(0, 7)} · saldo <strong>{money(balance)}</strong></p>}
      {action === 'simulate' && <p>Esta ação quitará o saldo em um ambiente de simulação. Nenhum dinheiro será movimentado.</p>}
      {['invoice', 'plan', 'scholarship'].includes(action) && <label>{action === 'invoice' ? 'Competência' : action === 'plan' ? 'Primeira competência' : 'Início da bolsa'}<input autoFocus name="inicio" required type={action === 'scholarship' ? 'date' : 'month'} defaultValue={action === 'plan' ? plan?.inicioCompetencia.slice(0, 7) ?? today.slice(0, 7) : action === 'scholarship' ? scholarship?.inicio.slice(0, 10) ?? today : today.slice(0, 7)} /></label>}
      {['plan', 'scholarship'].includes(action) && <><label>{action === 'plan' ? 'Última competência (opcional)' : 'Fim da bolsa (opcional)'}<input name="fim" type={action === 'plan' ? 'month' : 'date'} defaultValue={action === 'plan' ? plan?.fimCompetencia?.slice(0, 7) ?? '' : scholarship?.fim?.slice(0, 10) ?? ''} /></label><label>Situação<select name="ativo" defaultValue={String(action === 'plan' ? plan?.ativo ?? true : scholarship?.ativa ?? true)}><option value="true">Ativa</option><option value="false">Inativa</option></select></label></>}
      {['invoice', 'plan', 'payment'].includes(action) && <label>Valor em reais<input name="valor" required inputMode="decimal" placeholder="0,00" defaultValue={action === 'payment' ? (balance / 100).toFixed(2).replace('.', ',') : action === 'plan' && plan ? (plan.valorCentavos / 100).toFixed(2).replace('.', ',') : ''} /></label>}
      {action === 'plan' && <label>Dia de vencimento<input name="dia" required type="number" min="1" max="31" defaultValue={plan?.diaVencimento ?? 10} /></label>}
      {action === 'invoice' && <><label>Vencimento<input name="vencimento" type="date" required defaultValue={today} /></label>{!plan && <label>Semestre do curso<input name="semestre" type="number" min="1" max={enrollment.turma.duracaoSemestres} required defaultValue="1" /></label>}</>}
      {action === 'payment' && <label>Referência única do comprovante<input name="referencia" required minLength={8} maxLength={100} placeholder="Ex.: REC-2026-0001" /><small>Use a mesma referência se precisar repetir uma tentativa após falha de conexão.</small></label>}
      {action === 'duration' && <label>Número de semestres<input name="duracao" type="number" min="1" max="20" required defaultValue={enrollment.turma.duracaoSemestres} /></label>}
    </fieldset>{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button" disabled={busy}>{busy ? 'Salvando…' : action === 'payment' ? 'Confirmar pagamento' : action === 'simulate' ? 'Confirmar simulação' : 'Salvar'}</button></form>
  </section>;
}

export function FinancePage() {
  const { request, session } = useSession();
  const student = session?.user.perfil === 'ALUNO';
  const manager = session?.user.perfil === 'COORDENACAO' || session?.user.perfil === 'SECRETARIA';
  const overview = useOverview(student);
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<Enrollment[]>([]);
  const [selected, setSelected] = useState<Enrollment | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);
  const [filter, setFilter] = useState('pendentes');
  const [editor, setEditor] = useState<Editor | null>(null);
  const searchVersion = useRef(0);

  useEffect(() => {
    if (!student || !overview.data) return;
    const own = overview.data.enrollments.filter((item) => item.userId === session?.user.id).map((item) => ({ id: item.id, registro: item.registration, aluno: { nome: item.name }, turma: { id: item.classId, curso: item.className, duracaoSemestres: 0 } }));
    setMatches(own); setSelected((value) => own.find((item) => item.id === value?.id) ?? own[0] ?? null);
  }, [student, overview.data, session?.user.id]);

  useEffect(() => {
    if (!selected || (!student && !manager)) return;
    let active = true; setLoading(true); setAccount(null); setError('');
    const id = encodeURIComponent(selected.id);
    void Promise.all([
      request<Invoice[]>(`/faturas/matriculas/${id}`), request<Semester[]>(`/faturas/matriculas/${id}/semestres`),
      manager ? request<Plan | null>(`/faturas/matriculas/${id}/plano`) : Promise.resolve(null),
      manager ? request<Scholarship | null>(`/bolsas/matriculas/${id}`) : Promise.resolve(null),
    ]).then(([invoices, semesters, plan, scholarship]) => { if (active) setAccount({ invoices, semesters, plan, scholarship }); })
      .catch((cause: unknown) => { if (active) setError(problem(cause)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [selected, request, revision, student, manager]);

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const version = ++searchVersion.current; setSearching(true); setSearchError('');
    try { const result = await request<Enrollment[]>(`/faturas/matriculas?registro=${encodeURIComponent(query.trim())}`); if (version === searchVersion.current) { setMatches(result); setSearched(true); } }
    catch (cause) { if (version === searchVersion.current) setSearchError(problem(cause)); }
    finally { if (version === searchVersion.current) setSearching(false); }
  }
  if (!student && !manager) return null;
  const invoices = account?.invoices.filter((item) => filter === 'todas' || (filter === 'pendentes' ? item.situacao !== 'QUITADA' : item.situacao === filter)).sort((a, b) => a.vencimento.localeCompare(b.vencimento)) ?? [];
  const total = (pick: (invoice: Invoice) => number) => account?.invoices.reduce((sum, item) => sum + pick(item), 0) ?? 0;
  function choose(item: Enrollment) { setSelected(item); setEditor(null); setNotice(''); setFilter('pendentes'); }
  return <div className="finance-workspace"><div className="page-heading"><div><h1>{student ? 'Minhas mensalidades' : 'Financeiro'}</h1><p>{student ? 'Consulte vencimentos e pagamentos da sua matrícula.' : 'Cobranças e pagamentos por matrícula.'}</p></div></div>
    <div className="finance-layout"><aside className="finance-search"><h2>{student ? 'Matrículas' : 'Localizar estudante'}</h2>{manager && <form onSubmit={(event) => void search(event)}><label>Registro acadêmico<input value={query} onChange={(event) => setQuery(event.target.value)} required minLength={2} maxLength={40} placeholder="Digite o registro" /></label><button className="secondary-button" disabled={searching}>{searching ? 'Buscando…' : 'Buscar matrícula'}</button></form>}
      {student && <StateMessage loading={overview.loading} error={overview.error} retry={overview.refresh} />}{searchError && <p className="form-error" role="alert">{searchError}</p>}
      <div className="enrollment-results">{matches.map((item) => <button type="button" key={item.id} disabled={!!editor} aria-pressed={selected?.id === item.id} onClick={() => choose(item)}><strong>{item.aluno.nome}</strong><span>{item.registro}</span><small>{item.turma.curso}</small></button>)}</div>{searched && !matches.length && <p>Nenhuma matrícula encontrada. Confira o registro.</p>}{matches.length === 20 && <small>Mostrando os primeiros 20 resultados. Refine a busca.</small>}
    </aside><div className="finance-main">{notice && <p className="form-success" role="status">{notice}</p>}{!selected ? <Empty title="Selecione uma matrícula" detail={student ? 'Suas cobranças aparecerão após o vínculo acadêmico.' : 'Busque pelo registro acadêmico para consultar ou emitir cobranças.'} /> : <>
      <header className="finance-account"><div><h2>{selected.aluno.nome}</h2><p>Matrícula {selected.registro} · {selected.turma.curso}</p></div><button type="button" className="text-button" disabled={loading || !!editor} onClick={() => setRevision((value) => value + 1)}>Atualizar</button></header>
      <StateMessage loading={loading} error={error} retry={() => setRevision((value) => value + 1)} />
      {account && <>{editor ? <FinanceEditor key={`${selected.id}:${editor.action}:${editor.invoice?.id ?? ''}`} editor={editor} enrollment={selected} account={account} onClose={() => setEditor(null)} onSaved={(value, duration) => { setEditor(null); setNotice(value); if (duration) setSelected({ ...selected, turma: { ...selected.turma, duracaoSemestres: duration } }); else setRevision((current) => current + 1); }} /> : <>
        <dl className="finance-totals"><div><dt>Saldo emitido</dt><dd>{money(total((item) => item.valorCentavos - item.pagoCentavos))}</dd></div><div><dt>Em atraso</dt><dd className="overdue">{money(total((item) => item.situacao === 'VENCIDA' ? item.valorCentavos - item.pagoCentavos : 0))}</dd></div><div><dt>Pagamentos registrados</dt><dd>{money(total((item) => item.pagoCentavos))}</dd></div></dl>
        <div className="finance-section-head"><h2>Faturas</h2>{manager && <button type="button" className="primary-button" onClick={() => setEditor({ action: 'invoice' })}>Emitir fatura</button>}</div><div className="filter-row" aria-label="Filtrar faturas">{[['pendentes', 'Pendentes'], ['VENCIDA', 'Vencidas'], ['QUITADA', 'Quitadas'], ['todas', 'Todas']].map(([value, label]) => <button type="button" key={value} aria-pressed={filter === value} className={filter === value ? 'filter-active' : ''} onClick={() => setFilter(value)}>{label}</button>)}</div>
        {invoices.length ? <div className="finance-table-scroll"><table className="finance-table"><caption>Faturas da matrícula {selected.registro}</caption><thead><tr><th>Competência</th><th>Vencimento</th><th>Situação</th><th>Valor</th><th>Saldo</th><th>Ação</th></tr></thead><tbody>{invoices.map((invoice) => <tr key={invoice.id}><td>{invoice.competencia.slice(0, 7)}</td><td>{date(invoice.vencimento)}</td><td><span className={`invoice-status status-${invoice.situacao}`}>{invoice.situacao === 'QUITADA' ? 'Quitada' : invoice.situacao === 'VENCIDA' ? 'Vencida' : 'Aberta'}</span></td><td>{money(invoice.valorCentavos)}</td><td>{money(invoice.valorCentavos - invoice.pagoCentavos)}</td><td>{invoice.situacao !== 'QUITADA' && <button type="button" className="text-button" onClick={() => setEditor({ action: student ? 'simulate' : 'payment', invoice })}>{student ? 'Simular pagamento' : 'Registrar pagamento'}</button>}</td></tr>)}</tbody></table></div> : <Empty title={account.invoices.length ? 'Nenhuma fatura neste filtro' : 'Nenhuma fatura emitida'} detail={manager ? 'Configure um plano mensal ou emita uma fatura avulsa.' : 'Quando a instituição emitir cobranças, elas aparecerão aqui.'} />}
        {student && <p className="finance-footnote">Pagamentos nesta área são simulados e não movimentam dinheiro real.</p>}
        {manager && <div className="finance-settings"><section><h3>Plano de mensalidades</h3><p>{account.plan ? `${money(account.plan.valorCentavos)} por mês, vencimento dia ${account.plan.diaVencimento}. ${account.plan.ativo ? 'Ativo' : 'Inativo'}.` : 'Nenhum plano configurado.'}</p>{account.plan && <small>Próxima competência: {account.plan.proximaCompetencia.slice(0, 7)}</small>}<button type="button" className="text-button" onClick={() => setEditor({ action: 'plan' })}>{account.plan ? 'Editar plano' : 'Configurar plano'}</button></section><section><h3>Bolsa institucional</h3><p>{account.scholarship ? account.scholarship.vigente ? 'Bolsa vigente' : account.scholarship.ativa ? 'Agendada ou encerrada' : 'Bolsa inativa' : 'Nenhuma bolsa cadastrada.'}</p><button type="button" className="text-button" onClick={() => setEditor({ action: 'scholarship' })}>Configurar bolsa</button>{session?.user.perfil === 'COORDENACAO' && <button type="button" className="text-button" onClick={() => setEditor({ action: 'duration' })}>Configurar duração do curso</button>}</section></div>}
        <details className="finance-semesters"><summary>Pagamentos por semestre</summary>{account.semesters.map((item) => <p key={item.semestre}>{item.semestre}º semestre — {item.situacao.replaceAll('_', ' ').toLowerCase()}: pago {money(item.pagoCentavos)}, saldo {money(item.saldoCentavos)}</p>)}</details>
      </>}</>}
    </>}</div></div>
  </div>;
}
