import { useSession } from '../../auth/Session';
import { Empty, Metric, Panel, formatDate, formatNumber } from '../../components/UI';
import { average, type Overview } from './overview-model';

interface RoleHomeProps { data: Overview; navigate: (path: string) => void }

function ClassList({ data, navigate }: RoleHomeProps) {
  return data.classes.length ? <div className="rows">{data.classes.slice(0, 5).map((item) => <button type="button" className="row-button" key={item.id} onClick={() => navigate(`/turmas/${item.id}`)}><span className="row-symbol">{item.name.slice(0, 2).toUpperCase()}</span><span className="row-copy"><strong>{item.name}</strong><small>{item.course} · {item.period}</small></span><span className="row-end">Abrir</span></button>)}</div> : <Empty title="Nenhuma turma disponível" detail="Confira os vínculos acadêmicos da sua conta." />;
}

function QuickLinks({ items, navigate }: { items: { label: string; detail: string; path: string }[]; navigate: (path: string) => void }) {
  return <div className="rows">{items.map((item) => <button type="button" className="row-button" key={item.path} onClick={() => navigate(item.path)}><span className="row-copy"><strong>{item.label}</strong><small>{item.detail}</small></span><span className="row-end">Abrir</span></button>)}</div>;
}

function CoordinationHome({ data, navigate }: RoleHomeProps) {
  const withoutGrade = data.enrollments.filter((item) => item.average === null);
  const meanGrade = average(data.enrollments.map((item) => item.average));
  const meanAttendance = average(data.enrollments.map((item) => item.attendance));
  return <>
    <div className="page-heading"><div><p className="section-label">Coordenação</p><h1>Painel da instituição</h1><p>Indicadores acadêmicos das turmas disponíveis.</p></div></div>
    <div className="metrics"><Metric label="Turmas" value={String(data.classes.length)} /><Metric label="Estudantes" value={String(data.enrollments.length)} /><Metric label="Sem nota registrada" value={String(withoutGrade.length)} /><Metric label="Média registrada" value={formatNumber(meanGrade)} /><Metric label="Frequência média" value={meanAttendance === null ? '—' : `${formatNumber(meanAttendance, 0)}%`} /></div>
    <div className="two-columns"><Panel title="Turmas"><ClassList data={data} navigate={navigate} /></Panel><Panel title="Gestão e análise"><QuickLinks navigate={navigate} items={[{ label: 'Pessoas', detail: 'Consulte os usuários da instituição', path: '/pessoas' }, { label: 'Importar Excel', detail: 'Registre os 36 atributos e calcule previsões experimentais', path: '/cenarios' }, { label: 'Modelo de evasão', detail: 'Estado, métricas e limites do modelo ativo', path: '/modelo' }]} /></Panel></div>
  </>;
}

function ProfessorHome({ data, navigate }: RoleHomeProps) {
  const drafts = data.classes.reduce((count, item) => count + item.snapshot.avaliacoes.filter((value) => !value.publicada).length, 0);
  const corrections = data.classes.reduce((count, item) => count + item.snapshot.entregas.filter((value) => !value.corrigidaEm).length, 0);
  return <>
    <div className="page-heading"><div><p className="section-label">Docência</p><h1>Painel do professor</h1><p>Chamadas, avaliações e atividades das suas turmas.</p></div></div>
    <div className="metrics"><Metric label="Minhas turmas" value={String(data.classes.length)} /><Metric label="Estudantes" value={String(data.enrollments.length)} /><Metric label="Avaliações não publicadas" value={String(drafts)} /><Metric label="Entregas para corrigir" value={String(corrections)} /></div>
    <div className="two-columns"><Panel title="Ações de ensino"><QuickLinks navigate={navigate} items={[{ label: 'Chamada', detail: 'Consulte e registre frequência', path: '/chamada' }, { label: 'Notas', detail: 'Consulte, lance e publique avaliações', path: '/notas' }, { label: 'Atividades', detail: 'Acompanhe as entregas das turmas', path: '/atividades' }]} /></Panel><Panel title="Minhas turmas"><ClassList data={data} navigate={navigate} /></Panel></div>
  </>;
}

function TutorHome({ data, navigate }: RoleHomeProps) {
  const attendance = average(data.enrollments.map((item) => item.attendance));
  return <>
    <div className="page-heading"><div><p className="section-label">Tutoria</p><h1>Acompanhamento</h1><p>Consulte os registros acadêmicos dos estudantes vinculados.</p></div></div>
    <div className="metrics"><Metric label="Turmas vinculadas" value={String(data.classes.length)} /><Metric label="Estudantes acompanhados" value={String(data.enrollments.length)} /><Metric label="Frequência média" value={attendance === null ? '—' : `${formatNumber(attendance, 0)}%`} /></div>
    <div className="two-columns"><Panel title="Consultar registros"><QuickLinks navigate={navigate} items={[{ label: 'Frequência', detail: 'Presenças e faltas dos vinculados', path: '/frequencia' }, { label: 'Notas', detail: 'Avaliações dos vinculados', path: '/notas' }, { label: 'Atividades', detail: 'Prazos das turmas vinculadas', path: '/atividades' }]} /></Panel><Panel title="Turmas vinculadas"><ClassList data={data} navigate={navigate} /></Panel></div>
  </>;
}

function StudentHome({ data, navigate, userId }: RoleHomeProps & { userId: string }) {
  const own = data.enrollments.filter((item) => item.userId === userId);
  const ownIds = new Set(own.map((item) => item.id));
  const pending = data.classes.flatMap((item) => item.snapshot.atividades.filter((activity) => activity.estado === 'PUBLICADA' && Date.parse(activity.prazo) >= Date.now() && !item.snapshot.entregas.some((delivery) => delivery.atividadeId === activity.id && ownIds.has(delivery.matriculaId))).map((activity) => ({ ...activity, className: item.name, classId: item.id }))).sort((a, b) => Date.parse(a.prazo) - Date.parse(b.prazo));
  const meanGrade = average(own.map((item) => item.average));
  const meanAttendance = average(own.map((item) => item.attendance));
  return <>
    <div className="page-heading"><div><p className="section-label">Área do estudante</p><h1>Meu desempenho</h1><p>Suas notas, frequência e próximas atividades.</p></div></div>
    <div className="metrics"><Metric label="Minhas turmas" value={String(data.classes.length)} /><Metric label="Minha média" value={formatNumber(meanGrade)} /><Metric label="Minha frequência" value={meanAttendance === null ? '—' : `${formatNumber(meanAttendance, 0)}%`} /><Metric label="Próximas entregas" value={String(pending.length)} /></div>
    <div className="two-columns"><Panel title="Próximas entregas">{pending.length ? <div className="rows">{pending.slice(0, 4).map((item) => <button type="button" className="row-button" key={item.id} onClick={() => navigate(`/turmas/${item.classId}`)}><span className="row-copy"><strong>{item.titulo}</strong><small>{item.className} · prazo {formatDate(item.prazo)}</small></span><span className="row-end">Ver turma</span></button>)}</div> : <Empty title="Nenhuma entrega pendente" detail="As atividades publicadas aparecem aqui." />}</Panel><Panel title="Minhas turmas"><ClassList data={data} navigate={navigate} /></Panel></div>
    <Panel title="Meus registros"><QuickLinks navigate={navigate} items={[{ label: 'Minhas notas', detail: 'Avaliações publicadas', path: '/notas' }, { label: 'Minha frequência', detail: 'Presenças e faltas registradas', path: '/frequencia' }]} /></Panel>
  </>;
}

export function RoleHomePage({ data, navigate }: RoleHomeProps) {
  const { session } = useSession();
  const role = session!.user.perfil;
  if (role === 'COORDENACAO') return <CoordinationHome data={data} navigate={navigate} />;
  if (role === 'PROFESSOR') return <ProfessorHome data={data} navigate={navigate} />;
  if (role === 'TUTOR') return <TutorHome data={data} navigate={navigate} />;
  return <StudentHome data={data} navigate={navigate} userId={session!.user.id} />;
}
