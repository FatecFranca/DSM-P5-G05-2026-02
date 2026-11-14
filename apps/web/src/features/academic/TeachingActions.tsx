import { useState, type FormEvent } from 'react';
import { useSession } from '../../auth/Session';
import type { AcademicFile, AcademicSnapshot } from '../../services/contracts';

interface Props { snapshot: AcademicSnapshot; kind: 'frequencia' | 'notas' | 'atividades' | 'materiais'; onChanged: () => void }
const errorText = (cause: unknown) => cause instanceof Error ? cause.message : 'Não foi possível salvar.';

export function TeachingActions({ snapshot, kind, onChanged }: Props) {
  const { request } = useSession();
  const [subject, setSubject] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [weight, setWeight] = useState('1');
  const [maximum, setMaximum] = useState('10');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const label = { frequencia: 'Registrar aula', notas: 'Criar avaliação', atividades: 'Criar atividade', materiais: 'Publicar material' }[kind];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const formElement = event.currentTarget; setBusy(true); setError(''); setNotice('');
    try {
      if (!subject) throw new Error('Selecione uma disciplina.');
      if (kind === 'frequencia') {
        await request('/aulas', { method: 'POST', body: { disciplinaId: subject, tema: title.trim(), data: new Date(`${date}T12:00:00`).toISOString() } });
      } else if (kind === 'notas') {
        const peso = Number(weight); const notaMaxima = Number(maximum);
        if (!Number.isFinite(peso) || peso <= 0 || !Number.isFinite(notaMaxima) || notaMaxima <= 0) throw new Error('Peso e nota máxima precisam ser maiores que zero.');
        await request('/avaliacoes', { method: 'POST', body: { disciplinaId: subject, titulo: title.trim(), peso, notaMaxima, data: new Date(`${date}T12:00:00`).toISOString() } });
      } else if (kind === 'atividades') {
        const notaMaxima = Number(maximum);
        if (!Number.isFinite(notaMaxima) || notaMaxima <= 0) throw new Error('A nota máxima precisa ser maior que zero.');
        await request('/atividades', { method: 'POST', body: { disciplinaId: subject, titulo: title.trim(), descricao: description.trim(), prazo: new Date(`${date}T23:59:59`).toISOString(), notaMaxima, estado: 'RASCUNHO' } });
      } else {
        if (!file) throw new Error('Selecione um arquivo.');
        const form = new FormData(); form.append('arquivo', file, file.name);
        const uploaded = await request<AcademicFile>('/arquivos', { method: 'POST', body: form });
        await request('/materiais', { method: 'POST', body: { disciplinaId: subject, titulo: title.trim(), descricao: description.trim(), arquivoId: uploaded.id } });
      }
      setTitle(''); setDescription(''); setDate(''); setFile(null); formElement.reset();
      setNotice(`${label} concluído.`); onChanged();
    } catch (cause) { setError(errorText(cause)); }
    finally { setBusy(false); }
  }

  return <details className="panel teaching-panel" aria-label={label}>
    <summary>{label}</summary>
    <form className="inline-form" onSubmit={(event) => void submit(event)}>
      <label>Disciplina<select required value={subject} onChange={(event) => setSubject(event.target.value)}><option value="">Selecione</option>{snapshot.disciplinas.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label>
      <label>{kind === 'frequencia' ? 'Tema da aula' : kind === 'materiais' ? 'Título do material' : 'Título'}<input required maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} /></label>
      {kind === 'atividades' || kind === 'materiais' ? <label>Descrição<textarea required={kind === 'atividades'} maxLength={2000} value={description} onChange={(event) => setDescription(event.target.value)} /></label> : null}
      {kind !== 'materiais' && <label>{kind === 'atividades' ? 'Prazo' : 'Data'}<input required type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>}
      {kind === 'notas' && <label>Peso<input required type="number" min="0.01" step="any" value={weight} onChange={(event) => setWeight(event.target.value)} /></label>}
      {(kind === 'notas' || kind === 'atividades') && <label>Nota máxima<input required type="number" min="0.01" step="any" value={maximum} onChange={(event) => setMaximum(event.target.value)} /></label>}
      {kind === 'materiais' && <label>Arquivo<input required type="file" accept=".pdf,.docx,.odt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.oasis.opendocument.text" onChange={(event) => setFile(event.currentTarget.files?.[0] ?? null)} /></label>}
      <button className="primary-button compact" disabled={busy || !snapshot.disciplinas.length}>{busy ? 'Salvando…' : label}</button>
      {error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="form-success" role="status">{notice}</p>}
    </form>
  </details>;
}
