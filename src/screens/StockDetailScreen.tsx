import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { formatCount, formatINR, formatPercent, trendOf } from '../domain/format';
import { positionMetrics } from '../domain/portfolio';
import { dayChange } from '../domain/ticks';
import type { OrderSide } from '../domain/types';
import { market } from '../app/services';
import { useMarketStore } from '../state/market';
import { useQuote } from '../state/hooks';
import { selectHolding, usePortfolioStore } from '../state/portfolioStore';
import { PausedBanner } from '../ui/components/PausedBanner';
import { StateView } from '../ui/components/StateView';
import { TickChart } from '../ui/components/TickChart';
import { trendColor, useTheme } from '../ui/theme';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'StockDetail'>;

export function StockDetailScreen({ route, navigation }: Props) {
  const { symbol } = route.params;
  const theme = useTheme();
  const status = useMarketStore(s => s.status);
  const error = useMarketStore(s => s.error);
  const quote = useQuote(symbol);
  const holding = usePortfolioStore(selectHolding(symbol));

  if (status === 'error') {
    return <StateView kind="error" title="Couldn't load prices" message={error ?? undefined} onAction={market.retry} />;
  }
  if (status !== 'ready') {
    return <StateView kind="loading" title="Loading prices…" />;
  }

  const change = dayChange(quote);
  const changeColor = trendColor(theme, trendOf(change.abs));
  const position = holding ? positionMetrics(holding, quote) : null;
  const canTrade = quote?.ltp != null;
  const trade = (side: OrderSide) => navigation.navigate('Trade', { symbol, side });

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <PausedBanner />
      <ScrollView contentContainerStyle={styles.content}>
        <View>
          <Text style={[styles.price, { color: theme.colors.text }]}>{formatINR(quote?.ltp ?? null)}</Text>
          <Text style={[styles.change, { color: changeColor }]}>
            {formatINR(change.abs, { showPlus: true })} ({formatPercent(change.pct)}) today
          </Text>
          {!quote ? (
            <Text style={[styles.warning, { color: theme.colors.warningText, backgroundColor: theme.colors.warningBg }]}>
              The price server returned no data for {symbol}. Values are shown as -- and it is left out of totals.
            </Text>
          ) : null}
        </View>

        <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <Field label="Open" value={formatINR(quote?.open ?? null)} />
          <Field label="High" value={formatINR(quote?.high ?? null)} />
          <Field label="Low" value={formatINR(quote?.low ?? null)} />
          <Field label="Prev. close" value={formatINR(quote?.prevClose ?? null)} />
          <Field label="Volume" value={formatCount(quote?.volume ?? null)} last />
        </View>

        <TickChart symbol={symbol} />

        <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Your position</Text>
          {position ? (
            <>
              <Field label="Quantity" value={formatCount(position.qty)} />
              <Field label="Avg. price" value={formatINR(position.avgPricePaise)} />
              <Field label="Invested" value={formatINR(position.investedPaise)} />
              <Field label="Current value" value={formatINR(position.valuePaise)} />
              <Field
                label="P&L"
                value={`${formatINR(position.pnlPaise, { showPlus: true })} (${formatPercent(position.pnlPct)})`}
                color={trendColor(theme, trendOf(position.pnlPaise))}
                last
              />
            </>
          ) : (
            <Text style={{ color: theme.colors.muted }}>You don't hold {symbol}.</Text>
          )}
        </View>
      </ScrollView>

      <View style={[styles.actions, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
        <TradeButton label="Buy" color={theme.colors.gain} disabled={!canTrade} onPress={() => trade('buy')} />
        <TradeButton label="Sell" color={theme.colors.loss} disabled={!canTrade || !holding} onPress={() => trade('sell')} />
      </View>
    </View>
  );
}

function Field({ label, value, color, last }: { label: string; value: string; color?: string; last?: boolean }) {
  const theme = useTheme();
  return (
    <View style={[styles.field, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.border }]}>
      <Text style={{ color: theme.colors.muted }}>{label}</Text>
      <Text style={[styles.fieldValue, { color: color ?? theme.colors.text }]}>{value}</Text>
    </View>
  );
}

function TradeButton(props: { label: string; color: string; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={props.onPress}
      disabled={props.disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: props.disabled }}
      style={({ pressed }) => [
        styles.tradeButton,
        { backgroundColor: props.color, opacity: props.disabled ? 0.35 : pressed ? 0.8 : 1 },
      ]}>
      <Text style={styles.tradeText}>{props.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 16 },
  price: { fontSize: 32, fontWeight: '700', fontVariant: ['tabular-nums'] },
  change: { fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
  warning: { marginTop: 8, padding: 8, borderRadius: 8, fontSize: 13 },
  card: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingVertical: 4 },
  cardTitle: { fontWeight: '700', fontSize: 15, paddingVertical: 8 },
  field: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 },
  fieldValue: { fontWeight: '600', fontVariant: ['tabular-nums'] },
  actions: { flexDirection: 'row', gap: 12, padding: 12, borderTopWidth: StyleSheet.hairlineWidth },
  tradeButton: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 10 },
  tradeText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
});
