import { Text, type ColorValue } from 'react-native';

export function TabIcon({ symbol, color }: { symbol: string; color: ColorValue }) {
  return <Text accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ color, fontSize: 19, lineHeight: 23 }}>{symbol}</Text>;
}
