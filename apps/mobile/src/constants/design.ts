import type { TextStyle } from 'react-native';

export const palette = {
  background: '#F1F5F3', surface: '#FFFFFF', ink: '#17343D', muted: '#526A70',
  line: '#D5E1DE', primary: '#123E46', secondary: '#086F75', primarySoft: '#E2F0ED',
  teal: '#168F8A', gold: '#E5B65D', goldSoft: '#FFF3DB', success: '#247653',
  danger: '#B94E49', dangerSoft: '#FBE9E5',
  // Tons para texto sobre fundo suave (contraste ≥ 4,5:1): `gold` e `danger` puros não atingem isso.
  warning: '#9A5200', successSoft: '#DDF3E7', dangerStrong: '#A63F3A',
  // Sobre o azul-petróleo `primary`: texto de apoio, filete e barras de gráfico sem destaque.
  onPrimaryMuted: '#C3DCDA', onPrimaryRule: '#4F7075', tealSoft: '#A8CCC7',
} as const;

/** Escala de espaçamento. Use estes degraus em vez de números soltos. */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;

/** Raios: `sm` para controles, `md` para contêineres, `lg` para o destaque da tela, `pill` para marcas. */
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

const style = (value: TextStyle): TextStyle => value;

/**
 * Estilos de texto. A hierarquia vem do tamanho e do peso, não de tudo em negrito:
 * só `title` e `figure` passam de 20 pt. `figure` usa algarismos tabulares para que
 * números em colunas e listas alinhem.
 */
export const type = {
  title: style({ fontSize: 26, lineHeight: 32, fontWeight: '700', letterSpacing: -0.6 }),
  heading: style({ fontSize: 16, lineHeight: 22, fontWeight: '700' }),
  body: style({ fontSize: 14, lineHeight: 20, fontWeight: '400' }),
  label: style({ fontSize: 14, lineHeight: 19, fontWeight: '600' }),
  caption: style({ fontSize: 12, lineHeight: 17, fontWeight: '400' }),
  figure: style({ fontSize: 26, lineHeight: 30, fontWeight: '700', letterSpacing: -0.6, fontVariant: ['tabular-nums'] }),
  figureSmall: style({ fontSize: 16, lineHeight: 20, fontWeight: '700', fontVariant: ['tabular-nums'] }),
} as const;

export const roleLabel: Record<string, string> = {
  COORDENACAO: 'Coordenação', PROFESSOR: 'Docente',
  TUTOR: 'Tutoria', ALUNO: 'Estudante', SECRETARIA: 'Secretaria',
};
