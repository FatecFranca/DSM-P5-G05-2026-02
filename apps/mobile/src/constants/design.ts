export const palette = {
  background: '#F1F5F3', surface: '#FFFFFF', ink: '#17343D', muted: '#526A70',
  line: '#D5E1DE', primary: '#123E46', secondary: '#086F75', primarySoft: '#E2F0ED',
  teal: '#168F8A', gold: '#E5B65D', goldSoft: '#FFF3DB', success: '#247653',
  danger: '#B94E49', dangerSoft: '#FBE9E5',
} as const;

export const roleLabel: Record<string, string> = {
  ADMIN: 'Administração', COORDENACAO: 'Coordenação', PROFESSOR: 'Docente',
  TUTOR: 'Tutoria', ALUNO: 'Estudante',
};
