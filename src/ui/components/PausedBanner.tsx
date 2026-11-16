import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useMarketStore } from '../../state/market';
import { useFeedStatus } from '../../state/hooks';
import { useTheme } from '../theme';

/** Shown on every screen when ticks stop arriving, and when a refresh fails. */
export function PausedBanner() {
  const theme = useTheme();
  const { status } = useFeedStatus();
  const loaded = useMarketStore(s => s.status === 'ready');
  const refreshError = useMarketStore(s => s.refreshError);

  let text: string | null = null;
  if (loaded && status === 'paused') {
    text = '⏸  Prices paused: no live updates. Showing last known prices.';
  } else if (refreshError) {
    text = `Refresh failed: ${refreshError}. Showing last known prices.`;
  }
  if (text === null) {
    return null;
  }
  return (
    <View style={[styles.banner, { backgroundColor: theme.colors.warningBg }]} accessibilityLiveRegion="polite">
      <Text style={[styles.text, { color: theme.colors.warningText }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { paddingHorizontal: 16, paddingVertical: 8 },
  text: { fontSize: 13, fontWeight: '600' },
});
