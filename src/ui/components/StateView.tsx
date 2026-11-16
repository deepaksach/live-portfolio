import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';

interface Props {
  kind: 'loading' | 'error' | 'empty';
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** Shared loading / empty / error state. Errors always offer a retry. */
export function StateView({ kind, title, message, actionLabel, onAction }: Props) {
  const theme = useTheme();
  return (
    <View style={styles.container} accessibilityRole={kind === 'error' ? 'alert' : undefined}>
      {kind === 'loading' && <ActivityIndicator size="large" color={theme.colors.accent} />}
      <Text style={[styles.title, { color: kind === 'error' ? theme.colors.danger : theme.colors.text }]}>{title}</Text>
      {message ? <Text style={[styles.message, { color: theme.colors.muted }]}>{message}</Text> : null}
      {onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          style={({ pressed }) => [styles.button, { backgroundColor: theme.colors.accent, opacity: pressed ? 0.8 : 1 }]}>
          <Text style={[styles.buttonText, { color: theme.colors.accentText }]}>
            {actionLabel ?? (kind === 'error' ? 'Retry' : 'OK')}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  title: { fontSize: 17, fontWeight: '600', textAlign: 'center' },
  message: { fontSize: 14, textAlign: 'center' },
  button: { marginTop: 8, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 999 },
  buttonText: { fontWeight: '600', fontSize: 15 },
});
