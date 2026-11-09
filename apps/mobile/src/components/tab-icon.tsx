import type { ColorValue } from 'react-native';

import { Icon, type IconName } from './icons';

/** Ícone da barra de abas: um desenho por destino, na cor do estado (ativo/inativo). */
export function TabIcon({ name, color }: { name: IconName; color: ColorValue }) {
  return <Icon name={name} color={color} size={22} />;
}
