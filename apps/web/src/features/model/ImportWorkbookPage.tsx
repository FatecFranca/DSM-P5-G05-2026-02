import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useSession } from '../../auth/Session';
import { Empty, Metric, Panel } from '../../components/UI';
import type { MlSchema, MlStatus, ModelClass } from './model-report';
import { workbookError, type MlImportedPrediction, type MlImportResult } from './workbook';
import './model.css';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const className: Record<ModelClass, string> = { Dropout: 'Evasão', Enrolled: 'Matriculado', Graduate: 'Conclusão' };
const percent = (value: number) => `${(value * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%`;

export function ImportWorkbookPage() {
  const { session, request } = useSession();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<MlStatus | null>(null);
  const [schema, setSchema] = useState<MlSchema | null>(null);
  const [recent, setRecent] = useState<MlImportedPrediction[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState('');
  const [dataError, setDataError] = useState('');
  const [notice, setNotice] = useState('');
  const [result, setResult] = useState<MlImportResult | null>(null);
  const coordinator = session?.user.perfil === 'COORDENACAO';

  useEffect(() => {
    if (!coordinator) return;
    let active = true;
    setLoading(true);
    void Promise.allSettled([
      request<MlStatus>('/ml/status'),
      request<MlSchema>('/ml/schema'),
      request<MlImportedPrediction[]>('/ml/importacoes'),
    ]).then(([modelStatus, modelSchema, imports]) => {
      if (!active) return;
      setStatus(modelStatus.status === 'fulfilled' ? modelStatus.value : null);
      setSchema(modelSchema.status === 'fulfilled' ? modelSchema.value : null);
      setRecent(imports.status === 'fulfilled' ? imports.value : null);
      const failed = [modelStatus, modelSchema, imports].some((item) => item.status === 'rejected');
      setDataError(failed ? 'Não foi possível carregar todos os dados da importação. Atualize para tentar novamente.' : '');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [coordinator, request, revision]);

  if (!coordinator) return <p className="state-message" role="alert">Área disponível apenas para a coordenação.</p>;
  const ready = Boolean(status?.ready && status.originalInputReady && schema?.previewEnabled);

  async function downloadTemplate() {
    setBusy(true); setError(''); setNotice('');
    try {
      const bytes = await request<ArrayBuffer>('/ml/importacoes/modelo', { binary: true });
      const url = URL.createObjectURL(new Blob([bytes], { type: XLSX_MIME }));
      try {
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'modelo-importacao-ml.xlsx';
        anchor.click();
        setNotice('Modelo Excel enviado para download.');
      } finally { setTimeout(() => URL.revokeObjectURL(url), 60_000); }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível baixar o modelo Excel.');
    } finally { setBusy(false); }
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setNotice(''); setResult(null);
    if (!file) { setError('Selecione a planilha preenchida.'); return; }
    const validationError = workbookError(file);
    if (validationError) { setError(validationError); return; }
    if (!ready) { setError('O modelo de importação não está disponível. Verifique o estado do serviço.'); return; }
    const form = new FormData();
    form.append('arquivo', file, file.name);
    setBusy(true);
    try {
      const imported = await request<MlImportResult>('/ml/importacoes', { method: 'POST', body: form });
      setResult(imported);
      setFile(null);
      if (input.current) input.current.value = '';
      setRevision((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível importar a planilha.');
    } finally { setBusy(false); }
  }

  return <>
    <div className="page-heading"><div><p className="section-label">Coordenação · Análise acadêmica</p><h1>Importar Excel</h1><p>Registre os dados da planilha e calcule as previsões experimentais.</p></div><button type="button" className="secondary-button" onClick={() => setRevision((value) => value + 1)} disabled={busy || loading}>Atualizar</button></div>
    <div className="model-notice">A importação pode criar alunos e matrículas ausentes. Alunos novos recebem senha temporária com troca obrigatória no primeiro acesso. Confira os dados antes de enviar.</div>
    <Panel title="Planilha de dados do modelo">
      <div className="workbook-content">
        <p>Baixe o modelo Excel e preencha a aba <strong>Importacao</strong> com os dados de identificação e os 36 atributos. Turma, período, disciplina e professor precisam estar cadastrados; a API verifica os vínculos.</p>
        <button type="button" className="secondary-button compact" onClick={() => void downloadTemplate()} disabled={busy}>Baixar modelo Excel</button>
        <form className="workbook-form" onSubmit={(event) => void upload(event)}>
          <label htmlFor="ml-workbook">Planilha preenchida (.xlsx, até 1 MB)</label>
          <input id="ml-workbook" ref={input} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={busy} onChange={(event) => { setError(''); setFile(event.currentTarget.files?.[0] ?? null); }} />
          {file && <small>Selecionado: {file.name}</small>}
          <button type="submit" className="primary-button compact" disabled={busy || loading || !file || !ready}>{busy ? 'Processando…' : 'Importar planilha'}</button>
        </form>
        {!loading && !ready && <p className="form-error" role="alert">A importação exige o modelo ativo, entrada original disponível e prévia técnica habilitada.</p>}
        {loading && <p role="status">Consultando o serviço de importação…</p>}
        {dataError && <p className="form-error" role="alert">{dataError}</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
        {notice && <p className="form-success" role="status">{notice}</p>}
      </div>
    </Panel>
    {result && <section aria-labelledby="import-result-heading"><h2 id="import-result-heading">Resultado da importação</h2><p className="model-context">{result.total} linha(s) processadas pelo modelo {result.modelVersion}. Resultado experimental.</p><div className="metrics"><Metric label="Previsões salvas" value={String(result.salvos)} /><Metric label="Alunos criados" value={String(result.usuariosCriados)} /><Metric label="Matrículas criadas" value={String(result.matriculasCriadas)} /><Metric label="Linhas repetidas" value={String(result.repetidos)} /><Metric label="Erros" value={String(result.erros.length)} /></div>{result.erros.length > 0 && <Panel title="Linhas com erro"><ul className="workbook-errors">{result.erros.map((item) => <li key={`${item.linha}-${item.registro}`}>Linha {item.linha} ({item.registro}): {item.motivo}</li>)}</ul></Panel>}</section>}
    <Panel title="Importações recentes">{recent === null ? loading ? <p className="state-message" role="status">Carregando importações…</p> : <Empty title="Consulta indisponível" detail="Atualize para tentar novamente." /> : recent.length ? <div className="model-table-scroll"><table className="model-table"><caption>Até 50 previsões recentes; estimativas para apoio humano</caption><thead><tr><th scope="col">Registro</th><th scope="col">Classe prevista</th><th scope="col">Probabilidade de evasão</th><th scope="col">Perfil</th><th scope="col">Modelo</th></tr></thead><tbody>{recent.map((item) => <tr key={item.id}><th scope="row">{item.registro}</th><td>{className[item.predictedClass]}</td><td>{typeof item.probabilities.Dropout === 'number' ? percent(item.probabilities.Dropout) : '—'}</td><td>{item.atual ? `Atual · v${item.perfilVersao}` : `Alterado · v${item.perfilVersao}`}</td><td>{item.modelVersion}</td></tr>)}</tbody></table></div> : <Empty title="Nenhuma importação" detail="As previsões aparecerão após o envio de uma planilha válida." />}</Panel>
  </>;
}
