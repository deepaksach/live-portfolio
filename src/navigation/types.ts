import type { NavigatorScreenParams } from '@react-navigation/native';
import type { OrderSide } from '../domain/types';

export type TabParamList = {
  Portfolio: undefined;
  Watchlist: undefined;
};

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList>;
  StockDetail: { symbol: string };
  Trade: { symbol: string; side: OrderSide };
  AddSymbol: undefined;
};
