import Svg, { Path } from 'react-native-svg'

type IconProps = {
  color: string
  size?: number
}

/** Шеврон «назад» в шапке. Пути — из хендофф-макета. */
export function ChevronLeftIcon({ color }: IconProps) {
  return (
    <Svg width={10} height={16} viewBox="0 0 10 16">
      <Path
        d="M8.5 1L1.5 8l7 7"
        stroke={color}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

/** Колокольчик — быстрое создание алерта по паре. Пути — из макета. */
export function BellIcon({ color }: IconProps) {
  return (
    <Svg width={15} height={16} viewBox="0 0 15 16">
      <Path
        d="M7.5 1.2c-2.5 0-4.4 2-4.4 4.6v2.9c0 .9-.3 1.7-.9 2.4l-.6.7c-.5.6-.1 1.5.7 1.5h10.4c.8 0 1.2-.9.7-1.5l-.6-.7c-.6-.7-.9-1.5-.9-2.4V5.8c0-2.6-1.9-4.6-4.4-4.6z"
        fill="none"
        stroke={color}
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
      <Path
        d="M5.7 15c.3.6 1 1 1.8 1s1.5-.4 1.8-1"
        fill="none"
        stroke={color}
        strokeWidth={1.4}
        strokeLinecap="round"
      />
    </Svg>
  )
}

/** Шеврон-«галочка» вниз для заголовков аккордеонов. */
export function ChevronDownIcon({ color, size = 12 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 12 12">
      <Path
        d="M2.5 4.5L6 8l3.5-3.5"
        stroke={color}
        strokeWidth={1.6}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

/** Линейная иконка «техника» (тренд вверх) для DriverChip. */
export function TrendIcon({ color, size = 14 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 14 14">
      <Path
        d="M1 10l4-4 3 3 5-6"
        stroke={color}
        strokeWidth={1.5}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M10 3h3v3"
        stroke={color}
        strokeWidth={1.5}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

/** Линейная иконка «новость» (газета) для DriverChip. */
export function NewsIcon({ color, size = 14 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 14 14">
      <Path
        d="M2 2.5h8v9H3a1 1 0 01-1-1v-8z"
        stroke={color}
        strokeWidth={1.3}
        fill="none"
        strokeLinejoin="round"
      />
      <Path
        d="M10 5h2v5.5a1 1 0 01-1 1"
        stroke={color}
        strokeWidth={1.3}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M4 5h4M4 7.5h4M4 10h2.5" stroke={color} strokeWidth={1.3} strokeLinecap="round" />
    </Svg>
  )
}

/** Линейная иконка «регулятор» (здание с колоннами) для DriverChip. */
export function BankIcon({ color, size = 14 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 14 14">
      <Path
        d="M7 1.5l5.5 3H1.5L7 1.5z"
        stroke={color}
        strokeWidth={1.3}
        fill="none"
        strokeLinejoin="round"
      />
      <Path
        d="M3 6v4M5.5 6v4M8.5 6v4M11 6v4M1.5 12.5h11"
        stroke={color}
        strokeWidth={1.3}
        strokeLinecap="round"
      />
    </Svg>
  )
}
