import React, { useEffect, useMemo } from 'react';
import { AppState, StatusBar, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DarkTheme, DefaultTheme, NavigationContainer, type Theme as NavTheme } from '@react-navigation/native';
import { market } from './src/app/services';
import { RootNavigator } from './src/navigation/RootNavigator';
import { useTheme } from './src/ui/theme';

export default function App() {
  const theme = useTheme();

  useEffect(() => {
    market.start();
    // Stop ticking in the background, resume on return. A real socket would disconnect here too.
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        market.resume();
      } else if (state === 'background') {
        market.pause();
      }
    });
    return () => sub.remove();
  }, []);

  const navTheme = useMemo<NavTheme>(() => {
    const base = theme.dark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: theme.colors.accent,
        background: theme.colors.background,
        card: theme.colors.card,
        text: theme.colors.text,
        border: theme.colors.border,
      },
    };
  }, [theme]);

  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <StatusBar barStyle={theme.dark ? 'light-content' : 'dark-content'} />
        <NavigationContainer theme={navTheme}>
          <RootNavigator />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
