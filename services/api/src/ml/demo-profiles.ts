import type { MlFeatures } from './ml.types';

// Dados criados exclusivamente para a carga demonstrativa autorizada.
// Agregados representam os dois semestres concluídos, notas na escala 0–20.
export function demoProfile(index: number): MlFeatures {
  const completed = index === 0;
  return {
    estado_civil: 1,
    modo_candidatura: 1,
    ordem_candidatura: 1,
    curso: 9238,
    periodo_aula: 1,
    qualif_anterior: 1,
    nota_qual_anterior: completed ? 150 : 110,
    nacionalidade: 1,
    qualif_mae: 1,
    qualif_pai: 1,
    ocupacao_mae: 4,
    ocupacao_pai: 4,
    nota_admissao: completed ? 150 : 110,
    deslocado: 0,
    necessidades_especiais: 0,
    devedor: completed ? 0 : 1,
    mensalidade_em_dia: completed ? 1 : 0,
    genero: 0,
    bolsista: 0,
    idade_matricula: 20,
    internacional: 0,
    ucs_1sem_creditadas: 0,
    ucs_1sem_matriculadas: 6,
    ucs_1sem_avaliacoes: 6,
    ucs_1sem_aprovadas: completed ? 6 : 2,
    ucs_1sem_nota: completed ? 16 : 11,
    ucs_1sem_sem_aval: 0,
    ucs_2sem_creditadas: 0,
    ucs_2sem_matriculadas: 6,
    ucs_2sem_avaliacoes: 6,
    ucs_2sem_aprovadas: completed ? 6 : 0,
    ucs_2sem_nota: completed ? 16 : 0,
    ucs_2sem_sem_aval: 0,
    desemprego: 10.8,
    inflacao: 1.4,
    pib: 1.74,
  };
}
