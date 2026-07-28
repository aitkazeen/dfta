import { useTheme } from '../theme'
import { Text } from './Text'

/**
 * Единые юридические формулировки (бриф §7). Не менять по месту:
 * текст согласован и обязателен на каждом экране прогноза.
 */
export const LEGAL_DISCLAIMER_FULL =
  'Информационный сервис. Не является индивидуальной инвестиционной рекомендацией. Прошлые результаты не гарантируют будущих.'

export const LEGAL_DISCLAIMER_SHORT =
  'Информационный сервис. Не является индивидуальной инвестиционной рекомендацией.'

type Props = {
  /** Короткая формулировка (для подвала экрана) вместо полной. */
  short?: boolean
  center?: boolean
}

export function Disclaimer({ short, center }: Props) {
  const { colors } = useTheme()
  return (
    <Text variant="caption" color={colors.textTertiary} center={center}>
      {short ? LEGAL_DISCLAIMER_SHORT : LEGAL_DISCLAIMER_FULL}
    </Text>
  )
}
