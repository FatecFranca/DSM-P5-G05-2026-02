export interface AcademicFile { id: string; nome: string; mime: string; tamanho: number }
export type AttendanceStatus = 'PRESENTE' | 'FALTA' | 'FALTA_JUSTIFICADA';
export interface AcademicSnapshot {
  turmaId: string | null;
  turmas: { id: string; nome: string; curso: string; periodo: string; fechada: boolean }[];
  disciplinas: { id: string; turmaId: string; nome: string }[];
  matriculas: { id: string; alunoId: string; registro: string; aluno: { nome: string } }[];
  aulas: { id: string; disciplinaId: string; data: string; tema: string }[];
  presencas: { aulaId: string; matriculaId: string; situacao: AttendanceStatus }[];
  avaliacoes: { id: string; disciplinaId: string; titulo: string; peso: number; notaMaxima: number; data: string; publicada: boolean }[];
  notas: { avaliacaoId: string; matriculaId: string; valor: number }[];
  atividades: { id: string; disciplinaId: string; titulo: string; descricao: string; prazo: string; notaMaxima: number; estado: 'RASCUNHO' | 'PUBLICADA' | 'ENCERRADA' }[];
  entregas: { atividadeId: string; matriculaId: string; arquivo: AcademicFile; enviadaEm: string; nota: number | null; feedback: string | null; corrigidaEm: string | null }[];
  materiais: { id: string; disciplinaId: string; titulo: string; descricao: string; arquivo: AcademicFile }[];
  indicadores: { matriculaId: string; media: number | null; frequencia: number | null }[];
  escala: number;
  truncated: boolean;
}
