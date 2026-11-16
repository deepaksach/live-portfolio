import React, { useCallback, useLayoutEffect } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useNavigation, type CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { market } from '../app/services';
import { useMarketStore } from '../state/market';
import { usePortfolioHydrated } from '../state/hooks';
import { usePortfolioStore } from '../state/portfolioStore';
import { PausedBanner } from '../ui/components/PausedBanner';
import { StateView } from '../ui/components/StateView';
import { WatchRow } from '../ui/components/WatchRow';
import { useTheme } from '../ui/theme';
import type { RootStackParamList, TabParamList } from '../navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Watchlist'>,
  NativeStackScreenProps<RootStackParamList>
>;

export function WatchlistScreen({ navigation }: Props) {
  const theme = useTheme();
  const hydrated = usePortfolioHydrated();
  const status = useMarketStore(s => s.status);
  const error = useMarketStore(s => s.error);
  const watchlist = usePortfolioStore(s => s.watchlist);
  const remove = usePortfolioStore(s => s.removeFromWatchlist);

  const openAdd = useCallback(() => navigation.navigate('AddSymbol'), [navigation]);

  useLayoutEffect(() => {
    navigation.setOptions({ headerRight: AddButton });
  }, [navigation]);

  const openDetail = useCallback((symbol: string) => navigation.navigate('StockDetail', { symbol }), [navigation]);
  const renderItem = useCallback(
    ({ item }: { item: string }) => <WatchRow symbol={item} onPress={openDetail} onRemove={remove} />,
    [openDetail, remove],
  );

  if (!hydrated || status === 'idle' || status === 'loading') {
    return <StateView kind="loading" title="Loading prices…" />;
  }
  if (status === 'error') {
    return <StateView kind="error" title="Couldn't load prices" message={error ?? undefined} onAction={market.retry} />;
  }

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <PausedBanner />
      {/* A plain FlatList (≤ 25 rows) avoids swipe state leaking into recycled rows. */}
      <FlatList
        data={watchlist}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={watchlist.length === 0 ? styles.flex : undefined}
        ListEmptyComponent={
          <StateView kind="empty" title="Your watchlist is empty" message="Add symbols to follow their prices." actionLabel="Add symbol" onAction={openAdd} />
        }
        ListFooterComponent={
          watchlist.length > 0 ? (
            <Text style={[styles.hint, { color: theme.colors.muted }]}>Swipe a row left to remove it</Text>
          ) : undefined
        }
      />
    </View>
  );
}

const keyExtractor = (symbol: string) => symbol;

function AddButton() {
  const theme = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <Pressable onPress={() => navigation.navigate('AddSymbol')} accessibilityRole="button" hitSlop={12} style={styles.headerButton}>
      <Text style={[styles.headerButtonText, { color: theme.colors.accent }]}>+ Add</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerButton: { paddingHorizontal: 16 },
  headerButtonText: { fontSize: 15, fontWeight: '600' },
  hint: { textAlign: 'center', fontSize: 12, padding: 16 },
});
