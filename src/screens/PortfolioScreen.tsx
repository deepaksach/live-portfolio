import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SortDir, SortKey } from '../domain/portfolio';
import { market } from '../app/services';
import { useMarketStore } from '../state/market';
import { usePortfolioHydrated, useSortedSymbols } from '../state/hooks';
import { usePortfolioStore } from '../state/portfolioStore';
import { Chip } from '../ui/components/Chip';
import { HoldingRow } from '../ui/components/HoldingRow';
import { PausedBanner } from '../ui/components/PausedBanner';
import { StateView } from '../ui/components/StateView';
import { SummaryCard } from '../ui/components/SummaryCard';
import { useTheme } from '../ui/theme';
import type { RootStackParamList, TabParamList } from '../navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Portfolio'>,
  NativeStackScreenProps<RootStackParamList>
>;

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'value', label: 'Value' },
  { key: 'pnl', label: 'P&L' },
];

export function PortfolioScreen({ navigation }: Props) {
  const theme = useTheme();
  const hydrated = usePortfolioHydrated();
  const status = useMarketStore(s => s.status);
  const error = useMarketStore(s => s.error);
  const refreshing = useMarketStore(s => s.refreshing);
  const holdings = usePortfolioStore(s => s.holdings);

  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [filter, setFilter] = useState('');
  const symbols = useSortedSymbols(holdings, sortKey, sortDir, filter);

  const onSort = useCallback(
    (key: SortKey) => {
      if (key === sortKey) {
        setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortKey(key);
        setSortDir(key === 'name' ? 'asc' : 'desc');
      }
    },
    [sortKey],
  );

  // Stable callbacks so memoised rows never re-render because of the parent.
  const openDetail = useCallback((symbol: string) => navigation.navigate('StockDetail', { symbol }), [navigation]);
  const renderItem = useCallback(
    ({ item }: { item: string }) => <HoldingRow symbol={item} onPress={openDetail} />,
    [openDetail],
  );

  if (!hydrated || status === 'idle' || status === 'loading') {
    return <StateView kind="loading" title="Loading prices…" />;
  }
  if (status === 'error') {
    return <StateView kind="error" title="Couldn't load prices" message={error ?? undefined} onAction={market.retry} />;
  }

  const arrow = sortDir === 'asc' ? ' ↑' : ' ↓';
  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <PausedBanner />
      <SummaryCard />
      <View style={styles.controls}>
        <TextInput
          value={filter}
          onChangeText={setFilter}
          placeholder="Filter by symbol"
          placeholderTextColor={theme.colors.muted}
          autoCapitalize="characters"
          autoCorrect={false}
          style={[styles.search, { color: theme.colors.text, backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
        />
        <View style={styles.chips}>
          <Text style={[styles.sortLabel, { color: theme.colors.muted }]}>Sort</Text>
          {SORTS.map(s => (
            <Chip
              key={s.key}
              label={s.label + (s.key === sortKey ? arrow : '')}
              selected={s.key === sortKey}
              onPress={() => onSort(s.key)}
            />
          ))}
        </View>
      </View>
      <FlashList
        data={symbols}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        refreshing={refreshing}
        onRefresh={market.refresh}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          holdings.length === 0 ? (
            <StateView kind="empty" title="No holdings yet" message="Buy a stock from its detail screen to see it here." />
          ) : (
            <StateView kind="empty" title={`No holdings match "${filter.trim()}"`} actionLabel="Clear filter" onAction={() => setFilter('')} />
          )
        }
      />
    </View>
  );
}

const keyExtractor = (symbol: string) => symbol;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  controls: { paddingHorizontal: 12, paddingBottom: 8, gap: 8 },
  search: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 15 },
  chips: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sortLabel: { fontSize: 13 },
});
