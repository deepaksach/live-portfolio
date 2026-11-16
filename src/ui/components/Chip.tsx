import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useTheme } from '../theme';

interface Props {
  label: string;
  selected?: boolean;
  onPress: () => void;
}

export const Chip = React.memo(function ChipView({ label, selected = false, onPress }: Props) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[styles.chip, { backgroundColor: selected ? theme.colors.accent : theme.colors.chip }]}>
      <Text style={[styles.label, { color: selected ? theme.colors.accentText : theme.colors.text }]}>{label}</Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  label: { fontSize: 13, fontWeight: '600' },
});
