import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AddSymbolScreen } from '../screens/AddSymbolScreen';
import { PortfolioScreen } from '../screens/PortfolioScreen';
import { StockDetailScreen } from '../screens/StockDetailScreen';
import { TradeSheet } from '../screens/TradeSheet';
import { WatchlistScreen } from '../screens/WatchlistScreen';
import type { RootStackParamList, TabParamList } from './types';

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

const tabIcon = (glyph: string) =>
  function TabIcon({ color }: { color: string }) {
    return <Text style={[styles.icon, { color }]}>{glyph}</Text>;
  };

function Tabs() {
  return (
    <Tab.Navigator>
      <Tab.Screen name="Portfolio" component={PortfolioScreen} options={{ tabBarIcon: tabIcon('₹') }} />
      <Tab.Screen name="Watchlist" component={WatchlistScreen} options={{ tabBarIcon: tabIcon('☆') }} />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
      <Stack.Screen name="StockDetail" component={StockDetailScreen} options={({ route }) => ({ title: route.params.symbol })} />
      <Stack.Screen name="AddSymbol" component={AddSymbolScreen} options={{ title: 'Add to watchlist', presentation: 'modal' }} />
      <Stack.Screen
        name="Trade"
        component={TradeSheet}
        options={{ headerShown: false, presentation: 'transparentModal', animation: 'slide_from_bottom' }}
      />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({ icon: { fontSize: 18 } });
