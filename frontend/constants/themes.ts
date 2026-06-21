import {vars} from 'nativewind';

export type ThemeId = 'basic' | 'dark' | 'strawberry' | 'aqua';

export type ThemeColors = {
  tealBg: string;
  teal: string;
  tealDark: string;
  tealAccent: string;
  primary: string;
  medium: string;
  secondary: string;
  tertiary: string;
  surface: string;
  line: string;
  btnBg: string;
  btnText: string;
};

export const THEME_VALUES: Record<ThemeId, ThemeColors> = {
  basic: {
    tealBg: '#E6F0F1', teal: '#D8E6E8', tealDark: '#A0B4B8', tealAccent: '#7BBFD4',
    primary: '#191F28', medium: '#374151', secondary: '#6b7280', tertiary: '#9ca3af',
    surface: '#F6F6F6', line: '#e5e7eb',
    btnBg: '#191F28', btnText: '#FFFFFF',
  },
  dark: {
    tealBg: '#1a2628', teal: '#2e3e40', tealDark: '#4a6a70', tealAccent: '#4a9eba',
    primary: '#FFFFFF', medium: '#b0b8c1', secondary: '#8a9ba8', tertiary: '#6a7d8a',
    surface: '#1e1e1e', line: '#374151',
    btnBg: '#4a9eba', btnText: '#FFFFFF',
  },
  strawberry: {
    tealBg: '#FFE4EC', teal: '#FBCFE8', tealDark: '#F9A8D4', tealAccent: '#F472B6',
    primary: '#3D1A24', medium: '#6B3045', secondary: '#9B5A6E', tertiary: '#C48A9A',
    surface: '#FFF0F3', line: '#FBCFE8',
    btnBg: '#3D1A24', btnText: '#FFFFFF',
  },
  aqua: {
    tealBg: '#E0F4FF', teal: '#BAE6FD', tealDark: '#7DD3FC', tealAccent: '#38BDF8',
    primary: '#0C3547', medium: '#1B5E7A', secondary: '#4A90A4', tertiary: '#7AB8C8',
    surface: '#F0FAFF', line: '#BAE6FD',
    btnBg: '#0C3547', btnText: '#FFFFFF',
  },
};

export const THEMES: Record<ThemeId, ReturnType<typeof vars>> = {
  basic: vars({
    '--color-teal-bg':    '#E6F0F1',
    '--color-teal':       '#D8E6E8',
    '--color-teal-dark':  '#A0B4B8',
    '--color-teal-accent':'#7BBFD4',
    '--color-primary':    '#191F28',
    '--color-medium':     '#374151',
    '--color-secondary':  '#6b7280',
    '--color-tertiary':   '#9ca3af',
    '--color-surface':    '#F6F6F6',
    '--color-line':       '#e5e7eb',
    '--color-btn-bg':     '#191F28',
    '--color-btn-text':   '#FFFFFF',
  }),
  dark: vars({
    '--color-teal-bg':    '#1a2628',
    '--color-teal':       '#2e3e40',
    '--color-teal-dark':  '#4a6a70',
    '--color-teal-accent':'#4a9eba',
    '--color-primary':    '#FFFFFF',
    '--color-medium':     '#b0b8c1',
    '--color-secondary':  '#8a9ba8',
    '--color-tertiary':   '#6a7d8a',
    '--color-surface':    '#1e1e1e',
    '--color-line':       '#374151',
    '--color-btn-bg':     '#4a9eba',
    '--color-btn-text':   '#FFFFFF',
  }),
  strawberry: vars({
    '--color-teal-bg':    '#FFE4EC',
    '--color-teal':       '#FBCFE8',
    '--color-teal-dark':  '#F9A8D4',
    '--color-teal-accent':'#F472B6',
    '--color-primary':    '#3D1A24',
    '--color-medium':     '#6B3045',
    '--color-secondary':  '#9B5A6E',
    '--color-tertiary':   '#C48A9A',
    '--color-surface':    '#FFF0F3',
    '--color-line':       '#FBCFE8',
    '--color-btn-bg':     '#3D1A24',
    '--color-btn-text':   '#FFFFFF',
  }),
  aqua: vars({
    '--color-teal-bg':    '#E0F4FF',
    '--color-teal':       '#BAE6FD',
    '--color-teal-dark':  '#7DD3FC',
    '--color-teal-accent':'#38BDF8',
    '--color-primary':    '#0C3547',
    '--color-medium':     '#1B5E7A',
    '--color-secondary':  '#4A90A4',
    '--color-tertiary':   '#7AB8C8',
    '--color-surface':    '#F0FAFF',
    '--color-line':       '#BAE6FD',
    '--color-btn-bg':     '#0C3547',
    '--color-btn-text':   '#FFFFFF',
  }),
};
