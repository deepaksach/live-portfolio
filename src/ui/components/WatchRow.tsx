import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { formatINR, formatPercent, trendOf } from '../../domain/format';
import { dayChange } from '../../domain/ticks';
import { useQuote } from '../../state/hooks';
import { trendColor, useTheme } from '../theme';

interface Props {
  symbol: string;
  onPress: (symbol: string) => void;
  onRemove: (symbol: string) => void;
}

export const WatchRow = React.memo(function WatchRowView({ symbol, onPress, onRemove }: Props) {
  const theme = useTheme();
  const quote = useQuote(symbol);
  const change = dayChange(quote);
  const color = trendColor(theme, trendOf(change.abs));

  const renderRightActions = useCallback(
    () => (
      <View style={[styles.action, { backgroundColor: theme.colors.danger }]}>
        <Text style={styles.actionText}>Remove</Text>
      </View>
    ),
    [theme],
  );

  return (
    <ReanimatedSwipeable
      friction={2}
      rightThreshold={60}
      renderRightActions={renderRightActions}
      onSwipeableOpen={() => onRemove(symbol)}>
      <Pressable
        onPress={() => onPress(symbol)}
        accessibilityRole="button"
        accessibilityHint="Swipe left to remove from watchlist"
        style={[styles.row, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <Text style={[styles.symbol, { color: theme.colors.text }]}>{symbol}</Text>
        <View style={styles.right}>
          <Text style={[styles.ltp, { color: theme.colors.text }]}>{formatINR(quote?.ltp ?? null)}</Text>
          <Text style={[styles.change, { color }]}>
            {formatINR(change.abs, { showPlus: true })} ({formatPercent(change.pct)})
          </Text>
        </View>
      </Pressable>
    </ReanimatedSwipeable>
  );
});

const styles = StyleSheet.create({
  row: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  symbol: { flex: 1, fontSize: 15, fontWeight: '700' },
  right: { alignItems: 'flex-end' },
  ltp: { fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
  change: { fontSize: 12, fontVariant: ['tabular-nums'] },
  action: { justifyContent: 'center', alignItems: 'flex-end', paddingHorizontal: 20, width: 120 },
  actionText: { color: '#FFFFFF', fontWeight: '700' },
});
