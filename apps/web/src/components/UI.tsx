import type { ReactNode } from 'react';

export function Panel({ title, action, children, className = '' }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`panel ${className}`}>
    {title && <div className="panel-heading"><h2>{title}</h2>{action}</div>}
    {children}
  </section>;
}

export function Empty({ title, detail }: { title: string; detail: string }) {
  return <div className="empty"><strong>{title}</strong><p>{detail}</p></div>;
}

export function StateMessage({ loading, error, retry }: { loading: boolean; error: string; retry: () => void }) {
  if (loading) return <p className="state-message" role="status">Carregando dados acadêmicos…</p>;
  if (error) return <div className="state-message error" role="alert"><p>{error}</p><button type="button" className="text-button" onClick={retry}>Tentar novamente</button></div>;
  return null;
}

export function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</div>;
}

export const formatNumber = (value: number | null, decimals = 1) => value === null ? '—' : value.toLocaleString('pt-BR', { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
export const formatDate = (value: string) => Number.isNaN(Date.parse(value)) ? '—' : new Date(value).toLocaleDateString('pt-BR');
