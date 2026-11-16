import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatCount, formatINR, formatPercent, trendOf } from '../../domain/format';
import { positionMetrics } from '../../domain/portfolio';
import { useQuote } from '../../state/hooks';
import { selectHolding, usePortfolioStore } from '../../state/portfolioStore';
import { trendColor, useTheme } from '../theme';

interface Props {
  symbol: string;
  onPress: (symbol: string) => void;
}

/**
 * Receives only the symbol. It subscribes to its own quote and holding, so a tick for another
 * symbol never re-renders it, and the parent list never re-renders on ticks at all.
 */
export const HoldingRow = React.memo(function HoldingRowView({ symbol, onPress }: Props) {
  const theme = useTheme();
  const quote = useQuote(symbol);
  const holding = usePortfolioStore(selectHolding(symbol));
  if (!holding) {
    return null;
  }
  const m = positionMetrics(holding, quote);
  const color = trendColor(theme, trendOf(m.pnlPaise));

  return (
    <Pressable
      onPress={() => onPress(symbol)}
      accessibilityRole="button"
      accessibilityLabel={`${symbol}, profit and loss ${formatINR(m.pnlPaise)}`}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? theme.colors.chip : theme.colors.card, borderColor: theme.colors.border },
      ]}>
      <View style={styles.left}>
        <Text style={[styles.symbol, { color: theme.colors.text }]}>{symbol}</Text>
        <Text style={[styles.sub, { color: theme.colors.muted }]}>
          {formatCount(m.qty)} × {formatINR(m.avgPricePaise)}
        </Text>
        {m.ltpPaise === null ? <Text style={[styles.badge, { color: theme.colors.warningText }]}>No price</Text> : null}
      </View>
      <View style={styles.right}>
        <Text style={[styles.ltp, { color: theme.colors.text }]}>{formatINR(m.ltpPaise)}</Text>
        <Text style={[styles.pnl, { color }]}>{formatINR(m.pnlPaise, { showPlus: true })}</Text>
        <Text style={[styles.sub, { color }]}>{formatPercent(m.pnlPct)}</Text>
      </View>
    </Pressable>
  );
});

export const HOLDING_ROW_HEIGHT = 76;

const styles = StyleSheet.create({
  row: {
    height: HOLDING_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  left: { flex: 1, gap: 2 },
  right: { alignItems: 'flex-end', gap: 1 },
  symbol: { fontSize: 15, fontWeight: '700' },
  sub: { fontSize: 12, fontVariant: ['tabular-nums'] },
  badge: { fontSize: 11, fontWeight: '600' },
  ltp: { fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
  pnl: { fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
