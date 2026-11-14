// Categorias efetivamente aprendidas pelo OneHotEncoder do modelo .pkl ativo.
// Códigos desconhecidos seriam ignorados pelo pipeline e por isso são recusados.
export const ML_CATEGORIES: Record<string, readonly number[]> = {
  estado_civil: [1, 2, 3, 4, 5, 6],
  modo_candidatura: [
    1, 2, 5, 7, 10, 15, 16, 17, 18, 39, 42, 43, 44, 51, 53, 57,
  ],
  curso: [
    33, 171, 8014, 9003, 9070, 9085, 9119, 9130, 9147, 9238, 9254, 9500, 9556,
    9670, 9773, 9853, 9991,
  ],
  periodo_aula: [0, 1],
  qualif_anterior: [1, 2, 3, 4, 6, 9, 10, 12, 14, 19, 38, 39, 40, 42, 43],
  nacionalidade: [1, 2, 6, 11, 17, 21, 22, 24, 25, 26, 41, 62, 100, 105, 109],
  qualif_mae: [
    1, 2, 3, 4, 5, 6, 9, 10, 11, 12, 14, 18, 19, 22, 26, 30, 34, 35, 36, 37, 38,
    39, 40, 41, 42, 43, 44,
  ],
  qualif_pai: [
    1, 2, 3, 4, 5, 6, 9, 10, 11, 12, 13, 14, 18, 19, 22, 26, 27, 29, 30, 31, 34,
    35, 36, 37, 38, 39, 40, 43,
  ],
  ocupacao_mae: [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 90, 99, 123, 125, 134, 141, 143, 144, 151,
    152, 153, 171, 175, 191, 192, 193, 194,
  ],
  ocupacao_pai: [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 90, 99, 101, 103, 112, 114, 123, 124, 141,
    144, 151, 152, 153, 154, 163, 171, 172, 174, 175, 181, 183, 192, 193, 194,
  ],
  deslocado: [0, 1],
  necessidades_especiais: [0, 1],
  devedor: [0, 1],
  mensalidade_em_dia: [0, 1],
  genero: [0, 1],
  bolsista: [0, 1],
  internacional: [0, 1],
};
