import { darkColors } from './colors.dark'

export * from './tokens'
export { darkColors }
export type { ColorTokens } from './colors.dark'

/**
 * Единая точка доступа к цветам темы.
 *
 * Сейчас всегда возвращает dark. Компоненты обязаны брать цвета
 * ТОЛЬКО отсюда (const { colors } = useTheme()), а не импортом darkColors —
 * тогда переход на две темы сведётся к правке этого хука:
 * читаем useColorScheme() + контекст, отдаём нужный набор.
 */
export function useTheme() {
  return { colors: darkColors }
}
