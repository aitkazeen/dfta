import { View, type ViewProps } from 'react-native'
import { radius, spacing, useTheme } from '../theme'

type Props = ViewProps & {
  /** Внутренний отступ 16 (бриф §3.3). Выключить для карточек-аккордеонов,
   *  где padding задают сами секции. */
  padded?: boolean
}

/**
 * Базовая карточка: поверхность surface, обводка border/subtle, радиус lg.
 * Теней нет — в dark-теме глубина строится обводкой и surface-raised (бриф §3.3).
 */
export function Card({ style, padded = true, ...rest }: Props) {
  const { colors } = useTheme()
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: colors.bgSurface,
          borderColor: colors.borderSubtle,
          borderWidth: 1,
          borderRadius: radius.lg,
        },
        padded && { padding: spacing.lg },
        style,
      ]}
    />
  )
}
