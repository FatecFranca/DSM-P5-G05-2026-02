import { StyleSheet, View, type ColorValue, type ViewStyle } from 'react-native';

export type IconName =
  | 'home' | 'users' | 'user' | 'grid' | 'sliders' | 'chart' | 'check'
  | 'calendar' | 'doc' | 'list' | 'folder' | 'chevronRight' | 'chevronLeft' | 'chevronDown' | 'bell' | 'message' | 'plus' | 'arrowLeft';

const GRID = 24;
const STROKE = 2;

/** Posiciona uma forma na grade de 24. Tudo é desenhado ali e depois escalado para `size`. */
function box(left: number, top: number, width: number, height: number, color: ColorValue, extra?: ViewStyle): ViewStyle {
  return { position: 'absolute', left, top, width, height, borderColor: color, ...extra };
}

function glyph(name: IconName, c: ColorValue) {
  const outline = { borderWidth: STROKE } as const;
  const fill = { backgroundColor: c } as const;
  switch (name) {
    case 'home': return <>
      <View style={box(6, 4, 12, 12, c, { borderLeftWidth: STROKE, borderTopWidth: STROKE, borderTopLeftRadius: 2, transform: [{ rotate: '45deg' }] })} />
      <View style={box(5, 10, 14, 11, c, { ...outline, borderTopWidth: 0, borderBottomLeftRadius: 3, borderBottomRightRadius: 3 })} />
      <View style={box(10, 15, 4, 6, c, { borderLeftWidth: STROKE, borderRightWidth: STROKE, borderTopWidth: STROKE, borderTopLeftRadius: 2, borderTopRightRadius: 2 })} />
    </>;
    case 'user': return <>
      <View style={box(8, 3, 8, 8, c, { ...outline, borderRadius: 4 })} />
      <View style={box(4, 14, 16, 8, c, { ...outline, borderBottomWidth: 0, borderTopLeftRadius: 8, borderTopRightRadius: 8 })} />
    </>;
    case 'users': return <>
      <View style={box(3, 4, 7, 7, c, { ...outline, borderRadius: 4 })} />
      <View style={box(1, 14, 11, 8, c, { ...outline, borderBottomWidth: 0, borderTopLeftRadius: 6, borderTopRightRadius: 6 })} />
      <View style={box(14, 4, 7, 7, c, { ...outline, borderRadius: 4 })} />
      <View style={box(12, 14, 11, 8, c, { ...outline, borderBottomWidth: 0, borderTopLeftRadius: 6, borderTopRightRadius: 6 })} />
    </>;
    case 'grid': return <>
      {[[3, 3], [13, 3], [3, 13], [13, 13]].map(([x, y]) => <View key={`${x}-${y}`} style={box(x, y, 8, 8, c, { ...outline, borderRadius: 2 })} />)}
    </>;
    case 'sliders': return <>
      {[{ y: 5, x: 15 }, { y: 12, x: 7 }, { y: 19, x: 12 }].map(({ y, x }) => <View key={y}>
        <View style={box(3, y - 1, 18, STROKE, c, fill)} />
        <View style={box(x - 3, y - 3, 6, 6, c, { ...fill, borderRadius: 3 })} />
      </View>)}
    </>;
    case 'chart': return <>
      <View style={box(4, 12, 4, 9, c, { ...fill, borderRadius: 1 })} />
      <View style={box(10, 4, 4, 17, c, { ...fill, borderRadius: 1 })} />
      <View style={box(16, 9, 4, 12, c, { ...fill, borderRadius: 1 })} />
    </>;
    case 'check': return <>
      <View style={box(2, 2, 20, 20, c, { ...outline, borderRadius: 10 })} />
      <View style={box(7, 7, 10, 6, c, { borderLeftWidth: STROKE, borderBottomWidth: STROKE, transform: [{ rotate: '-45deg' }] })} />
    </>;
    case 'calendar': return <>
      <View style={box(3, 5, 18, 16, c, { ...outline, borderRadius: 3 })} />
      <View style={box(3, 5, 18, 5, c, { ...fill, borderTopLeftRadius: 3, borderTopRightRadius: 3 })} />
      <View style={box(7, 2, STROKE, 5, c, fill)} />
      <View style={box(15, 2, STROKE, 5, c, fill)} />
    </>;
    case 'doc': return <>
      <View style={box(4, 2, 16, 20, c, { ...outline, borderRadius: 3 })} />
      <View style={box(8, 8, 8, STROKE, c, fill)} />
      <View style={box(8, 12, 8, STROKE, c, fill)} />
      <View style={box(8, 16, 5, STROKE, c, fill)} />
    </>;
    case 'list': return <>
      {[5, 11, 17].map((y) => <View key={y}>
        <View style={box(3, y, 3, 3, c, { ...fill, borderRadius: 2 })} />
        <View style={box(9, y + 0.5, 12, STROKE, c, fill)} />
      </View>)}
    </>;
    case 'folder': return <>
      <View style={box(2, 4, 9, 5, c, { ...outline, borderBottomWidth: 0, borderTopLeftRadius: 3, borderTopRightRadius: 3 })} />
      <View style={box(2, 8, 20, 13, c, { ...outline, borderRadius: 3 })} />
    </>;
    case 'bell': return <>
      <View style={box(11, 1, 2, 3, c, fill)} />
      <View style={box(5, 3, 14, 13, c, { ...outline, borderBottomWidth: 0, borderTopLeftRadius: 7, borderTopRightRadius: 7 })} />
      <View style={box(3, 16, 18, STROKE, c, { ...fill, borderRadius: 1 })} />
      <View style={box(9, 19, 6, 3, c, { ...fill, borderBottomLeftRadius: 3, borderBottomRightRadius: 3 })} />
    </>;
    case 'message': return <>
      <View style={box(2, 3, 20, 14, c, { ...outline, borderRadius: 4 })} />
      <View style={box(6, 14, 6, 6, c, { borderRightWidth: STROKE, borderBottomWidth: STROKE, transform: [{ rotate: '45deg' }] })} />
    </>;
    case 'plus': return <>
      <View style={box(11, 4, STROKE, 16, c, fill)} />
      <View style={box(4, 11, 16, STROKE, c, fill)} />
    </>;
    case 'arrowLeft': return <>
      <View style={box(5, 11, 15, STROKE, c, fill)} />
      <View style={box(5.5, 7.5, 9, 9, c, { borderLeftWidth: STROKE, borderBottomWidth: STROKE, transform: [{ rotate: '45deg' }] })} />
    </>;
    case 'chevronRight': return <View style={box(5, 8, 8, 8, c, { borderRightWidth: STROKE, borderTopWidth: STROKE, transform: [{ rotate: '45deg' }] })} />;
    case 'chevronDown': return <View style={box(8, 5, 8, 8, c, { borderRightWidth: STROKE, borderBottomWidth: STROKE, transform: [{ rotate: '45deg' }] })} />;
    case 'chevronLeft': return <View style={box(11, 8, 8, 8, c, { borderLeftWidth: STROKE, borderBottomWidth: STROKE, transform: [{ rotate: '45deg' }] })} />;
  }
}

/**
 * Ícone de traço único (2 na grade de 24), na cor do texto ao redor. Fica fora da árvore de
 * acessibilidade: quem usa deve rotular o controle, nunca confiar só no desenho.
 */
export function Icon({ name, color, size = 22 }: { name: IconName; color: ColorValue; size?: number }) {
  return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size }}>
    <View style={[styles.grid, { transform: [{ scale: size / GRID }] }]}>{glyph(name, color)}</View>
  </View>;
}

const styles = StyleSheet.create({
  // Escala a partir do canto superior esquerdo para a grade de 24 ocupar exatamente `size`.
  grid: { width: GRID, height: GRID, transformOrigin: 'top left' },
});
