import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { formatINR, formatPercent, trendOf } from '../../domain/format';
import { summarize } from '../../domain/portfolio';
import { priceStore } from '../../app/services';
import { useThrottledPriceVersion } from '../../state/hooks';
import { usePortfolioStore } from '../../state/portfolioStore';
import { trendColor, useTheme } from '../theme';

/** Depends on every price, so it re-computes at most 4x per second instead of on every tick. */
export const SummaryCard = React.memo(function SummaryCardView() {
  const theme = useTheme();
  const holdings = usePortfolioStore(s => s.holdings);
  const version = useThrottledPriceVersion(250);
  const s = useMemo(
    () => summarize(holdings, priceStore.getQuote),
    // version: recompute against the latest prices
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [holdings, version],
  );
  const pnlColor = trendColor(theme, trendOf(s.pnlPaise));
  const dayColor = trendColor(theme, trendOf(s.dayPnlPaise));
  const noPrices = s.pricedCount === 0;

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
      <Text style={[styles.label, { color: theme.colors.muted }]}>Current value</Text>
      <Text style={[styles.big, { color: theme.colors.text }]}>{noPrices ? '--' : formatINR(s.currentValuePaise)}</Text>

      <View style={styles.row}>
        <Metric label="Invested" value={noPrices ? '--' : formatINR(s.investedPaise)} color={theme.colors.text} muted={theme.colors.muted} />
        <Metric
          label="Total P&L"
          value={noPrices ? '--' : formatINR(s.pnlPaise, { showPlus: true })}
          sub={formatPercent(s.pnlPct)}
          color={pnlColor}
          muted={theme.colors.muted}
        />
        <Metric
          label="Today's P&L"
          value={formatINR(s.dayPnlPaise, { showPlus: true })}
          sub={formatPercent(s.dayPnlPct)}
          color={dayColor}
          muted={theme.colors.muted}
        />
      </View>

      {s.unpriced.length > 0 ? (
        <Text style={[styles.note, { color: theme.colors.warningText, backgroundColor: theme.colors.warningBg }]}>
          {s.unpriced.length === 1 ? '1 holding' : `${s.unpriced.length} holdings`} not included, no price:{' '}
          {s.unpriced.map(u => `${u.symbol} (${formatINR(u.investedPaise)} invested)`).join(', ')}
        </Text>
      ) : null}
    </View>
  );
});

function Metric(props: { label: string; value: string; sub?: string; color: string; muted: string }) {
  return (
    <View style={styles.metric}>
      <Text style={[styles.label, { color: props.muted }]}>{props.label}</Text>
      <Text style={[styles.value, { color: props.color }]} numberOfLines={1} adjustsFontSizeToFit>
        {props.value}
      </Text>
      {props.sub !== undefined ? <Text style={[styles.sub, { color: props.color }]}>{props.sub}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { margin: 12, padding: 16, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, gap: 4 },
  label: { fontSize: 12 },
  big: { fontSize: 26, fontWeight: '700', fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', marginTop: 10, gap: 8 },
  metric: { flex: 1 },
  value: { fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] },
  sub: { fontSize: 12, fontVariant: ['tabular-nums'] },
  note: { marginTop: 10, fontSize: 12, padding: 8, borderRadius: 8 },
});
