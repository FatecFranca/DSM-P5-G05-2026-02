import { useEffect, useState } from 'react';
import { useSession } from '@/auth/session';
import type { MlImportedPrediction } from '@/services/ml';
import { currentPredictions } from './predictions';

export function useImportedPredictions(enabled: boolean) {
  const { request } = useSession();
  const [items, setItems] = useState<MlImportedPrediction[] | null>(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void request<MlImportedPrediction[]>('/ml/importacoes')
      .then((result) => { if (active) { setItems(result); setError(''); } })
      .catch(() => { if (active) { setItems(null); setError('Não foi possível consultar as análises.'); } });
    return () => { active = false; };
  }, [enabled, request, revision]);

  return { items, predictions: currentPredictions(items ?? []), loading: enabled && !items && !error, error,
    refresh: () => { setItems(null); setError(''); setRevision((value) => value + 1); } };
}
