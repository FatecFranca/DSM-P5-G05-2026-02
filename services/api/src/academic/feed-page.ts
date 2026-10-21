export interface AcademicEvent {
  id: string;
  recursoId: string;
  tipo:
    | 'AULA'
    | 'AVALIACAO'
    | 'ENTREGA'
    | 'MATERIAL'
    | 'ATIVIDADE'
    | 'NOTAS'
    | 'CORRECAO';
  titulo: string;
  data: Date;
  disciplinaId: string;
  disciplina: string;
}

// Each source supplies at least the first page * size + 1 rows in this order.
export function feedPage(
  rows: AcademicEvent[],
  pagina: number,
  tamanho: number,
  descending = false,
) {
  const direction = descending ? -1 : 1;
  const sorted = rows.sort(
    (a, b) =>
      direction * (a.data.getTime() - b.data.getTime()) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  const hasMore = sorted.length > pagina * tamanho;
  return {
    itens: sorted.slice((pagina - 1) * tamanho, pagina * tamanho),
    pagina,
    tamanho,
    temMais: hasMore && pagina < 100,
    limiteAtingido: hasMore && pagina === 100,
  };
}
