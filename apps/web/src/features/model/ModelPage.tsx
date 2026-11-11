import { useEffect, useState } from 'react';
import { useSession } from '../../auth/Session';
import { Empty, Metric, Panel } from '../../components/UI';
import { evaluationDetails, modelReport, summarizeRecent, type MlPredictionRecord, type MlSchema, type MlStatus, type ModelClass } from './model-report';
import './model.css';

interface ModelData {
  status: MlStatus | null;
  schema: MlSchema | null;
  imported: MlPredictionRecord[] | null;
  automatic: MlPredictionRecord[] | null;
  errors: string[];
}

const labels: Record<ModelClass, string> = { Dropout: 'Evasão', Enrolled: 'Matriculado', Graduate: 'Conclusão' };
const percent = (value: number) => `${(value * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const number = (value: number) => value.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
const decimal = (value: number) => value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const signedPoints = (value: number) => `${value > 0 ? '+' : ''}${(value * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} p.p.`;
const dateTime = (value: string | null) => value && !Number.isNaN(Date.parse(value)) ? new Date(value).toLocaleString('pt-BR') : '—';
const details = evaluationDetails(modelReport.confusionMatrix);

export function ModelPage({ onImport }: { onImport: () => void }) {
  const { session, request } = useSession();
  const [data, setData] = useState<ModelData | null>(null);
  const [revision, setRevision] = useState(0);
  const coordinator = session?.user.perfil === 'COORDENACAO';

  useEffect(() => {
    if (!coordinator) return;
    let active = true;
    setData(null);
    void Promise.allSettled([
      request<MlStatus>('/ml/status'),
      request<MlSchema>('/ml/schema'),
      request<MlPredictionRecord[]>('/ml/importacoes'),
      request<MlPredictionRecord[]>('/ml/previsoes-automaticas'),
    ]).then(([status, schema, imported, automatic]) => {
      if (!active) return;
      const results = [status, schema, imported, automatic];
      const names = ['Estado do serviço', 'Esquema', 'Importações', 'Previsões automáticas'];
      setData({
        status: status.status === 'fulfilled' ? status.value : null,
        schema: schema.status === 'fulfilled' ? schema.value : null,
        imported: imported.status === 'fulfilled' ? imported.value : null,
        automatic: automatic.status === 'fulfilled' ? automatic.value : null,
        errors: results.flatMap((result, index) => result.status === 'rejected' ? [`${names[index]}: ${result.reason instanceof Error ? result.reason.message : 'consulta indisponível'}`] : []),
      });
    });
    return () => { active = false; };
  }, [coordinator, request, revision]);

  if (!coordinator) return <p className="state-message" role="alert">Área disponível apenas para a coordenação.</p>;
  const status = data?.status;
  const activeVersion = status?.ready ? status.modelVersion : undefined;
  const reportMatches = activeVersion === modelReport.version;
  return <>
    <div className="page-heading"><div><p className="section-label">Análise acadêmica</p><h1>Modelo de evasão</h1><p>Estado, validação e resultados recentes do modelo ativo.</p></div><div className="model-heading-actions"><button type="button" className="primary-button compact" onClick={onImport}>Importar Excel</button><button type="button" className="secondary-button" onClick={() => setRevision((value) => value + 1)} disabled={!data}>Atualizar</button></div></div>
    <div className="model-notice">As previsões são estimativas para apoio à avaliação humana. As métricas de validação vêm de dados externos; não medem acertos entre estudantes da instituição.</div>
    {!data && <p className="state-message" role="status">Carregando estatísticas do modelo…</p>}
    {data && <>
      {data.errors.length > 0 && <div className="form-error" role="alert">{data.errors.map((error) => <p key={error}>{error}</p>)}</div>}
      <section className="model-hero" aria-labelledby="model-state-title"><div><span id="model-state-title">Modelo em uso</span><strong>{status?.modelVersion ?? 'Versão indisponível'}</strong><p>{!status ? 'Não foi possível consultar a API.' : status.ready ? 'Serviço de inferência disponível' : status.configured ? 'Serviço de inferência indisponível' : 'Serviço não configurado'}</p></div><div className="model-hero-side"><span>Contrato de entrada</span><strong>{data.schema?.features.length ?? (reportMatches ? modelReport.features : '—')} atributos</strong><small>{status?.originalInputReady ? 'Entrada em escala original disponível' : 'Entrada original indisponível'}</small></div></section>
      <div className="model-two-columns">
        <Panel title="Escopo do modelo"><dl className="model-facts"><dt>Classes</dt><dd>{status?.classes?.map((value) => labels[value]).join(' e ') ?? data.schema?.classes.map((value) => labels[value]).join(' e ') ?? 'Não informado pela API'}</dd><dt>Esquema</dt><dd>{data.schema?.features.length ?? '—'} atributos informados pela API</dd><dt>Versão ativa</dt><dd>{status?.modelVersion ?? 'Não disponível'}</dd><dt>Estado</dt><dd>{status?.ready ? 'Pronto para inferência' : 'Sem inferência disponível'}</dd></dl></Panel>
        <Panel title="Leitura responsável"><p className="model-panel-copy">O modelo ativo pode ter duas classes. Nesse caso, <strong>Matriculado</strong> não recebe probabilidade. A classe prevista não equivale a um desfecho acadêmico observado.</p><p className="model-panel-copy">Fatores associados às previsões não indicam causa. Nenhuma previsão gera decisão automática sobre estudantes.</p></Panel>
      </div>
      <section aria-labelledby="validation-heading"><div className="model-section-heading"><div><p className="section-label">Avaliação externa</p><h2 id="validation-heading">Desempenho de validação</h2></div></div>
        {reportMatches ? <>
          <p className="model-context">Relatório versionado do artefato <strong>{modelReport.version}</strong>. Divisão estratificada 80/20, semente 7; {modelReport.trainingAfterOutliers.toLocaleString('pt-BR')} registros de treino após remoção de outliers e {modelReport.validationSamples.toLocaleString('pt-BR')} registros de validação.</p>
          <div className="metrics model-metrics"><Metric label="Acurácia" value={percent(modelReport.accuracy)} detail="acertos no conjunto externo" /><Metric label="F1 macro" value={percent(modelReport.macroF1)} detail="média das duas classes" /><Metric label="Acurácia balanceada" value={percent(details.balancedAccuracy)} detail="calculada da matriz" /><Metric label="Recall de evasão" value={percent(details.perClass[0].recall)} detail="evasões identificadas" /><Metric label="Brier de evasão" value={number(modelReport.dropoutBrier)} detail="menor é melhor; sem calibração aprovada" /></div>
          <div className="model-two-columns">
            <Panel title="Métricas por classe"><div className="model-table-scroll"><table className="model-table"><caption>Resultados derivados da matriz de confusão</caption><thead><tr><th scope="col">Classe</th><th scope="col">Precisão</th><th scope="col">Recall</th><th scope="col">F1</th><th scope="col">Amostras</th></tr></thead><tbody>{details.perClass.map((item) => <tr key={item.label}><th scope="row">{labels[item.label]}</th><td>{percent(item.precision)}</td><td>{percent(item.recall)}</td><td>{percent(item.f1)}</td><td>{item.support}</td></tr>)}</tbody></table></div></Panel>
            <Panel title="Matriz de confusão"><div className="model-table-scroll"><table className="model-table matrix-table"><caption>Linhas: classe real. Colunas: classe prevista</caption><thead><tr><th scope="col">Real ↓ / prevista →</th><th scope="col">Evasão</th><th scope="col">Conclusão</th></tr></thead><tbody><tr><th scope="row">Evasão</th><td>{modelReport.confusionMatrix[0][0]}</td><td>{modelReport.confusionMatrix[0][1]}</td></tr><tr><th scope="row">Conclusão</th><td>{modelReport.confusionMatrix[1][0]}</td><td>{modelReport.confusionMatrix[1][1]}</td></tr></tbody></table></div></Panel>
          </div>
          <Panel title="Calibração no conjunto externo">
            <p className="model-panel-copy">Em {modelReport.calibrationAssessment.sampleSize} casos, a probabilidade média de evasão foi {percent(modelReport.calibrationAssessment.meanProbability)} e a frequência observada foi {percent(modelReport.calibrationAssessment.observedRate)}. Nesse conjunto, o modelo superestimou a evasão.</p>
            <dl className="model-facts"><dt>Evasões previstas</dt><dd>{decimal(modelReport.calibrationAssessment.expectedDropoutCount)} (soma das probabilidades)</dd><dt>Evasões observadas</dt><dd>{modelReport.calibrationAssessment.observedDropoutCount}</dd><dt>Observado − previsto</dt><dd>{signedPoints(modelReport.calibrationAssessment.observedMinusPredicted)}</dd><dt>Intervalo bootstrap de 95%</dt><dd>{modelReport.calibrationAssessment.observedMinusPredicted95Ci.map(signedPoints).join(' a ')}</dd><dt>Erro médio de calibração</dt><dd>{signedPoints(modelReport.calibrationAssessment.expectedCalibrationError)}</dd></dl>
            <p className="model-panel-copy">O erro médio usa dez faixas de probabilidade. Esta avaliação usa dados externos e não valida a calibração para estudantes da instituição.</p>
          </Panel>
          <Panel title="Proveniência e limites"><dl className="model-facts"><dt>Algoritmo</dt><dd>{modelReport.algorithm}</dd><dt>Entrada</dt><dd>{modelReport.features} atributos em {modelReport.inputScale.toLowerCase()}</dd><dt>Biblioteca</dt><dd>scikit-learn {modelReport.sklearnVersion}</dd><dt>Calibração</dt><dd>{modelReport.calibrated ? 'Validada' : 'Avaliada em dados externos; validação institucional pendente'}</dd><dt>SHA-256 do artefato</dt><dd className="model-hash">{modelReport.artifactSha256}</dd><dt>SHA-256 do conjunto de reavaliação</dt><dd className="model-hash">{modelReport.validationDatasetSha256}</dd></dl><p className="model-panel-copy">A origem e o processo de treino do arquivo externo não estão completamente documentados. A avaliação não substitui validação local nem análise de vieses. Não some probabilidades de estudantes para estimar a evasão institucional.</p></Panel>
        </> : <Panel><Empty title="Métricas indisponíveis para a versão ativa" detail={activeVersion ? `O relatório web documenta apenas ${modelReport.version}; a API informou ${activeVersion}.` : 'Quando a API confirmar uma versão ativa com relatório validado, suas métricas aparecerão aqui.'} /></Panel>}
      </section>
      <section aria-labelledby="recent-heading"><div className="model-section-heading"><div><p className="section-label">Dados da instituição</p><h2 id="recent-heading">Previsões recentes</h2></div></div><p className="model-context">Cada endpoint retorna até 50 registros recentes. As contagens abaixo incluem apenas perfis atuais da versão ativa; não representam toda a instituição nem desfechos reais.</p>
        <div className="model-two-columns"><PredictionSummary title="Importações da planilha" records={data.imported} version={activeVersion} classes={status?.classes ?? data.schema?.classes} /><PredictionSummary title="Recálculos automáticos" records={data.automatic} version={activeVersion} classes={status?.classes ?? data.schema?.classes} /></div>
      </section>
    </>}
  </>;
}

interface PredictionSummaryProps { title: string; records: MlPredictionRecord[] | null; version?: string; classes?: ModelClass[] }

function PredictionSummary({ title, records, version, classes }: PredictionSummaryProps) {
  if (!records) return <Panel title={title}><Empty title="Consulta indisponível" detail="Atualize a página para tentar novamente." /></Panel>;
  if (!version) return <Panel title={title}><Empty title="Versão ativa indisponível" detail="Não é possível comparar as previsões com o modelo em uso." /></Panel>;
  const summary = summarizeRecent(records, version);
  const order = (['Dropout', 'Enrolled', 'Graduate'] as ModelClass[]).filter((label) => !classes || classes.includes(label) || summary.counts[label] > 0);
  return <Panel title={title} className="prediction-panel"><div className="prediction-overview"><strong>{summary.current}</strong><span>previsões atuais da versão ativa</span></div>{summary.current ? <div className="distribution-list">{order.map((label) => <div className="distribution-row" key={label}><div><strong>{labels[label]}</strong><span>{summary.counts[label]} de {summary.current}</span></div><div className="distribution-track"><span className={`distribution-fill distribution-${label.toLowerCase()}`} style={{ width: `${summary.counts[label] / summary.current * 100}%` }} /></div></div>)}</div> : <p className="muted">Nenhuma previsão atual da versão ativa entre os registros recentes.</p>}<div className="prediction-foot"><span>{summary.stale} resultado(s) de perfis alterados</span><span>{summary.otherVersions} de outras versões</span><span>Última análise desta versão: {dateTime(summary.latestAt)}</span></div></Panel>;
}
