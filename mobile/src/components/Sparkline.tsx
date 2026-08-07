import Svg, { Polyline } from 'react-native-svg'

type Props = {
  /** Точки за период (~7 дней). Масштабируются по min/max самого ряда. */
  points: number[]
  color: string
  width?: number
  height?: number
}

const PAD = 2 // вертикальное поле, чтобы линия не липла к краям

/**
 * Микро-спарклайн за 7 дней для строки watchlist (§3.4 PairRow).
 * Без осей и подписей — только форма тренда; цвет задаёт направление.
 */
export function Sparkline({ points, color, width = 56, height = 24 }: Props) {
  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1
  const usable = height - PAD * 2

  const coords = points
    .map((v, i) => {
      const x = (i / (points.length - 1)) * width
      const y = height - PAD - ((v - min) / range) * usable
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <Svg width={width} height={height}>
      <Polyline
        points={coords}
        fill="none"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}
