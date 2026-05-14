/** @file constants/themes.ts — 테마 프리셋 (vars() 객체). themeStore에서 루트 View에 주입됨 */

import {vars} from 'nativewind';

export type ThemeId = 'basic' | 'dark' | 'strawberry' | 'aqua';

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
  }),
};
