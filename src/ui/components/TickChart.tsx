import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { formatINR } from '../../domain/format';
import { priceStore } from '../../app/services';
import { trendColor, useTheme } from '../theme';

const MAX_POINTS = 300;
const HEIGHT = 140;

/** Builds an SVG path for the points, scaled to the box. Pure, so it is easy to test and reason about. */
export function buildPath(points: readonly number[], width: number, height: number): string {
  if (points.length < 2 || width <= 0) {
    return '';
  }
  let min = Infinity;
  let max = -Infinity;
  for (const p of points) {
    min = Math.min(min, p);
    max = Math.max(max, p);
  }
  const range = max - min || 1;
  const stepX = width / (points.length - 1);
  return points
    .map((p, i) => {
      const x = i * stepX;
      const y = height - ((p - min) / range) * (height - 8) - 4;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

/** Line of the prices received since this screen opened (last 300 kept). */
export function TickChart({ symbol }: { symbol: string }) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const [points, setPoints] = useState<number[]>(() => {
    const ltp = priceStore.getQuote(symbol)?.ltp;
    return ltp == null ? [] : [ltp];
  });

  useEffect(() => {
    return priceStore.subscribe(symbol, () => {
      const ltp = priceStore.getQuote(symbol)?.ltp;
      if (ltp == null) {
        return;
      }
      setPoints(prev => (prev[prev.length - 1] === ltp ? prev : [...prev.slice(-(MAX_POINTS - 1)), ltp]));
    });
  }, [symbol]);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const first = points[0];
  const last = points[points.length - 1];
  const color =
    first === undefined || last === undefined ? theme.colors.muted : trendColor(theme, last >= first ? 'up' : 'down');

  return (
    <View style={[styles.box, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.muted }]}>Since you opened this screen</Text>
        <Text style={[styles.title, { color: theme.colors.muted }]}>{points.length} ticks</Text>
      </View>
      <View style={styles.chart} onLayout={onLayout}>
        {points.length < 2 ? (
          <Text style={[styles.waiting, { color: theme.colors.muted }]}>
            {points.length === 0 ? 'No price for this symbol' : `Waiting for ticks… ${formatINR(last ?? null)}`}
          </Text>
        ) : (
          <Svg width={width} height={HEIGHT}>
            <Path d={buildPath(points, width, HEIGHT)} stroke={color} strokeWidth={2} fill="none" />
          </Svg>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  title: { fontSize: 12 },
  chart: { height: HEIGHT, justifyContent: 'center' },
  waiting: { textAlign: 'center', fontSize: 13 },
});
