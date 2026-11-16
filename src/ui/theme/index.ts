import { useColorScheme } from 'react-native';
import type { Trend } from '../../domain/format';

export interface Theme {
  dark: boolean;
  colors: {
    background: string;
    card: string;
    text: string;
    muted: string;
    border: string;
    gain: string;
    loss: string;
    accent: string;
    accentText: string;
    chip: string;
    warningBg: string;
    warningText: string;
    danger: string;
    overlay: string;
  };
  spacing: (n: number) => number;
  radius: number;
}

const spacing = (n: number) => n * 4;

export const lightTheme: Theme = {
  dark: false,
  colors: {
    background: '#F4F6F8',
    card: '#FFFFFF',
    text: '#111827',
    muted: '#6B7280',
    border: '#E5E7EB',
    gain: '#0A8F4E',
    loss: '#D32F2F',
    accent: '#3B5BDB',
    accentText: '#FFFFFF',
    chip: '#EEF1F5',
    warningBg: '#FFF4E5',
    warningText: '#8A4B00',
    danger: '#D32F2F',
    overlay: 'rgba(0,0,0,0.45)',
  },
  spacing,
  radius: 12,
};

export const darkTheme: Theme = {
  dark: true,
  colors: {
    background: '#0B0F14',
    card: '#151B23',
    text: '#F3F4F6',
    muted: '#9CA3AF',
    border: '#252D38',
    gain: '#34D399',
    loss: '#F87171',
    accent: '#7C93F6',
    accentText: '#0B0F14',
    chip: '#1F2732',
    warningBg: '#3A2A10',
    warningText: '#FBBF6A',
    danger: '#F87171',
    overlay: 'rgba(0,0,0,0.6)',
  },
  spacing,
  radius: 12,
};

/** Follows the system light/dark setting. Returns one of two constant objects, so it is referentially stable. */
export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? darkTheme : lightTheme;
}

export function trendColor(theme: Theme, trend: Trend): string {
  switch (trend) {
    case 'up':
      return theme.colors.gain;
    case 'down':
      return theme.colors.loss;
    default:
      return theme.colors.muted;
  }
}
