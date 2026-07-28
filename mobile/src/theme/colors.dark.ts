/**
 * Цветовые токены тёмной темы. Значения — из дизайн-брифа §3.1.
 *
 * Пока это единственная тема. Когда добавим light, рядом ляжет
 * colors.light.ts с тем же набором ключей, а useTheme() (см. ./index.ts)
 * начнёт выбирать нужный набор — компоненты трогать не придётся,
 * они уже читают цвета через useTheme(), а не импортом отсюда.
 */
export const darkColors = {
  // Поверхности
  bgBase: '#0B0F14',
  bgSurface: '#141A22',
  bgSurfaceRaised: '#1C242E',
  borderSubtle: '#26303B',

  // Текст
  textPrimary: '#EDF1F5',
  textSecondary: '#94A3B2',
  textTertiary: '#5D6B7A',

  // Акцент и сигналы направления
  accent: '#4C8DFF',
  up: '#3DD68C',
  down: '#F26D6D',
  flat: '#94A3B2',
  upBg: 'rgba(61,214,140,0.12)',
  downBg: 'rgba(242,109,109,0.12)',
  warn: '#F5B544',

  // Текст поверх акцентной заливки
  onAccent: '#FFFFFF',
} as const

export type ColorTokens = typeof darkColors
