import type { TextStyle } from "react-native";

/**
 * Отступы и радиусы — из брифа §3.3. Базовая единица 4.
 * Именуем по шкале, а не по значению, чтобы код читался семантически
 * (spacing.lg вместо магической 16).
 */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 8, // бейджи, чипы, табы
  md: 12, // кнопки, инпуты
  lg: 16, // карточки
  xl: 24, // bottom sheet
  full: 999, // пилюли, круглые кнопки
} as const;

/**
 * Имена шрифтовых файлов Inter, как их регистрирует @expo-google-fonts/inter.
 * Загрузка — в app/_layout.tsx. Если шрифт не загрузился, RN откатится
 * на системный, но верстка не сломается.
 */
export const fontFamily = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
} as const;

/**
 * Типографическая шкала из брифа §3.2. Каждый стиль — размер, интерлиньяж,
 * начертание. Цвет НЕ здесь: он зависит от темы и задаётся в компоненте Text.
 */
export const typography = {
  display: { fontFamily: fontFamily.semibold, fontSize: 40, lineHeight: 44 },
  h1: { fontFamily: fontFamily.semibold, fontSize: 28, lineHeight: 34 },
  h2: { fontFamily: fontFamily.semibold, fontSize: 20, lineHeight: 26 },
  title: { fontFamily: fontFamily.semibold, fontSize: 17, lineHeight: 22 },
  body: { fontFamily: fontFamily.regular, fontSize: 15, lineHeight: 22 },
  label: { fontFamily: fontFamily.medium, fontSize: 13, lineHeight: 18 },
  caption: {
    fontFamily: fontFamily.medium,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0.3,
  },
  monoNum: { fontFamily: fontFamily.medium, fontSize: 15, lineHeight: 20 },
} satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;
