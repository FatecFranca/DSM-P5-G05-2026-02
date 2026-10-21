import { feedPage, type AcademicEvent } from './feed-page';

function item(id: string, date: string): AcademicEvent {
  return {
    id,
    recursoId: id,
    tipo: 'AULA',
    titulo: id,
    data: new Date(date),
    disciplinaId: 'disciplina',
    disciplina: 'Matemática',
  };
}

describe('paginação dos feeds acadêmicos', () => {
  it('ordena datas e desempata IDs sem duplicar eventos entre páginas', () => {
    const rows = [
      item('c', '2026-10-02'),
      item('b', '2026-10-01'),
      item('a', '2026-10-01'),
    ];
    const first = feedPage([...rows], 1, 2);
    const second = feedPage([...rows], 2, 2);
    expect(first.itens.map((i) => i.id)).toEqual(['a', 'b']);
    expect(first.temMais).toBe(true);
    expect(second.itens.map((i) => i.id)).toEqual(['c']);
    expect(second.temMais).toBe(false);
  });
  it('avisos mostram os eventos mais recentes primeiro', () => {
    const result = feedPage(
      [item('b', '2026-10-01'), item('a', '2026-10-02')],
      1,
      20,
      true,
    );
    expect(result.itens.map((i) => i.id)).toEqual(['a', 'b']);
  });
  it('sinaliza o limite de navegação sem oferecer uma página inválida', () => {
    const result = feedPage(
      Array.from({ length: 101 }, (_, i) =>
        item(String(i).padStart(3, '0'), '2026-10-01'),
      ),
      100,
      1,
    );
    expect(result.temMais).toBe(false);
    expect(result.limiteAtingido).toBe(true);
  });
});
