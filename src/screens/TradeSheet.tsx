import React, { useState } from 'react';
import { KeyboardAvoidingView, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { formatCount, formatINR } from '../domain/format';
import { validateOrderQty } from '../domain/portfolio';
import type { Order, OrderSide } from '../domain/types';
import { priceStore } from '../app/services';
import { useQuote } from '../state/hooks';
import { selectHolding, usePortfolioStore } from '../state/portfolioStore';
import { Chip } from '../ui/components/Chip';
import { PausedBanner } from '../ui/components/PausedBanner';
import { useTheme } from '../ui/theme';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Trade'>;

/** Local-only order ticket. Fills at the last price at the moment of confirming. */
export function TradeSheet({ route, navigation }: Props) {
  const { symbol } = route.params;
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const quote = useQuote(symbol);
  const holding = usePortfolioStore(selectHolding(symbol));
  const placeOrder = usePortfolioStore(s => s.placeOrder);

  const [side, setSide] = useState<OrderSide>(route.params.side);
  const [qtyText, setQtyText] = useState('');
  const [touched, setTouched] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [filled, setFilled] = useState<Order | null>(null);

  const held = holding?.qty ?? 0;
  const validation = validateOrderQty(qtyText, side, held);
  const ltp = quote?.ltp ?? null;
  const estimate = validation.ok && ltp !== null ? validation.qty * ltp : null;
  const canSubmit = validation.ok && ltp !== null;
  const accent = side === 'buy' ? theme.colors.gain : theme.colors.loss;

  const confirm = () => {
    setTouched(true);
    if (!validation.ok) {
      return;
    }
    // Read the price at the moment of confirming, not the one rendered a frame ago.
    const fill = priceStore.getQuote(symbol)?.ltp ?? null;
    if (fill === null) {
      setSubmitError('No live price right now. Try again in a moment.');
      return;
    }
    try {
      setFilled(placeOrder(symbol, side, validation.qty, fill));
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Order failed');
    }
  };

  return (
    <View style={styles.root}>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.overlay }]} onPress={navigation.goBack} accessibilityLabel="Close" />
      <KeyboardAvoidingView behavior="padding">
        <View style={[styles.sheet, { backgroundColor: theme.colors.card, paddingBottom: insets.bottom + 16 }]}>
          <PausedBanner />
          {filled ? (
            <>
              <Text style={[styles.title, { color: theme.colors.text }]}>Order filled</Text>
              <Text style={[styles.body, { color: theme.colors.text }]}>
                {filled.side === 'buy' ? 'Bought' : 'Sold'} {formatCount(filled.qty)} {filled.symbol} at {formatINR(filled.pricePaise)}
              </Text>
              <Text style={[styles.body, { color: theme.colors.muted }]}>
                Total {formatINR(filled.qty * filled.pricePaise)}. Simulated order, nothing was sent to an exchange.
              </Text>
              <Pressable style={[styles.primary, { backgroundColor: theme.colors.accent }]} onPress={navigation.goBack} accessibilityRole="button">
                <Text style={[styles.primaryText, { color: theme.colors.accentText }]}>Done</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={[styles.title, { color: theme.colors.text }]}>{symbol}</Text>
              <View style={styles.sides}>
                <Chip label="Buy" selected={side === 'buy'} onPress={() => setSide('buy')} />
                <Chip label="Sell" selected={side === 'sell'} onPress={() => setSide('sell')} />
                <Text style={[styles.held, { color: theme.colors.muted }]}>You hold {formatCount(held)}</Text>
              </View>

              <Text style={[styles.label, { color: theme.colors.muted }]}>Quantity</Text>
              <TextInput
                value={qtyText}
                onChangeText={t => {
                  setQtyText(t);
                  setSubmitError(null);
                }}
                onBlur={() => setTouched(true)}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={theme.colors.muted}
                autoFocus
                style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border }]}
              />
              {(touched || qtyText !== '') && !validation.ok ? (
                <Text style={[styles.error, { color: theme.colors.danger }]}>{validation.error}</Text>
              ) : null}

              <View style={styles.summaryRow}>
                <Text style={{ color: theme.colors.muted }}>Market price</Text>
                <Text style={[styles.value, { color: theme.colors.text }]}>{formatINR(ltp)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={{ color: theme.colors.muted }}>Estimated value</Text>
                <Text style={[styles.value, { color: theme.colors.text }]}>{formatINR(estimate)}</Text>
              </View>
              {submitError ? <Text style={[styles.error, { color: theme.colors.danger }]}>{submitError}</Text> : null}

              <Pressable
                onPress={confirm}
                disabled={!canSubmit}
                accessibilityRole="button"
                accessibilityState={{ disabled: !canSubmit }}
                style={[styles.primary, { backgroundColor: accent }, !canSubmit && styles.disabled]}>
                <Text style={styles.primaryTextLight}>
                  {side === 'buy' ? 'Buy' : 'Sell'} {validation.ok ? formatCount(validation.qty) : ''} at market
                </Text>
              </Pressable>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 10 },
  title: { fontSize: 20, fontWeight: '700' },
  body: { fontSize: 15 },
  sides: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  held: { marginLeft: 'auto', fontSize: 13 },
  label: { fontSize: 12, marginTop: 6 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 20, fontVariant: ['tabular-nums'] },
  error: { fontSize: 13 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  value: { fontWeight: '600', fontVariant: ['tabular-nums'] },
  disabled: { opacity: 0.4 },
  primary: { marginTop: 8, alignItems: 'center', paddingVertical: 14, borderRadius: 10 },
  primaryText: { fontWeight: '700', fontSize: 16 },
  primaryTextLight: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
});
