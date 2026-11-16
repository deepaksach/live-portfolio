import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SYMBOLS } from '../data/symbols';
import { usePortfolioStore } from '../state/portfolioStore';
import { StateView } from '../ui/components/StateView';
import { useTheme } from '../ui/theme';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'AddSymbol'>;

export function AddSymbolScreen({ navigation }: Props) {
  const theme = useTheme();
  const watchlist = usePortfolioStore(s => s.watchlist);
  const add = usePortfolioStore(s => s.addToWatchlist);
  const [query, setQuery] = useState('');

  const available = useMemo(() => {
    const q = query.trim().toUpperCase();
    return SYMBOLS.filter(s => !watchlist.includes(s) && s.includes(q));
  }, [watchlist, query]);

  const allAdded = SYMBOLS.every(s => watchlist.includes(s));

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search symbols"
        placeholderTextColor={theme.colors.muted}
        autoCapitalize="characters"
        autoCorrect={false}
        autoFocus
        style={[styles.search, { color: theme.colors.text, backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
      />
      <FlatList
        data={available}
        keyExtractor={s => s}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={available.length === 0 ? styles.flex : undefined}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              add(item);
              navigation.goBack();
            }}
            style={({ pressed }) => [
              styles.row,
              { backgroundColor: pressed ? theme.colors.chip : theme.colors.card, borderColor: theme.colors.border },
            ]}>
            <Text style={[styles.symbol, { color: theme.colors.text }]}>{item}</Text>
            <Text style={{ color: theme.colors.accent }}>Add</Text>
          </Pressable>
        )}
        ListEmptyComponent={
          <StateView kind="empty" title={allAdded ? 'All symbols are already in your watchlist' : 'No symbols match'} />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  search: { margin: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 15 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  symbol: { fontSize: 15, fontWeight: '600' },
});
