import Svg, { Circle, Path, Rect } from "react-native-svg";

type IconProps = {
  color: string;
  size?: number;
};

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
  );
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
  );
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
  );
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
  );
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
      <Path
        d="M4 5h4M4 7.5h4M4 10h2.5"
        stroke={color}
        strokeWidth={1.3}
        strokeLinecap="round"
      />
    </Svg>
  );
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
  );
}

/** Линейная иконка «мировой фон» (глобус) для DriverChip / DriverCard. */
export function GlobeIcon({ color, size = 14 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 14 14">
      <Circle
        cx={7}
        cy={7}
        r={5.5}
        fill="none"
        stroke={color}
        strokeWidth={1.3}
      />
      <Path
        d="M1.5 7h11M7 1.5c1.8 1.5 2.8 3.5 2.8 5.5S8.8 12.5 7 14M7 1.5c-1.8 1.5-2.8 3.5-2.8 5.5S5.2 12.5 7 14"
        stroke={color}
        strokeWidth={1.3}
        fill="none"
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Значок «ⓘ» — раскрыть объяснение уверенности на 4.4. */
export function InfoIcon({ color, size = 13 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 13 13">
      <Circle
        cx={6.5}
        cy={6.5}
        r={5.5}
        fill="none"
        stroke={color}
        strokeWidth={1.2}
      />
      <Circle cx={6.5} cy={3.9} r={0.75} fill={color} stroke="none" />
      <Path
        d="M6.5 6v3.4"
        stroke={color}
        strokeWidth={1.2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Шестерёнка настроек в шапке watchlist. Пути — из макета. */
export function GearIcon({ color, size = 17 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 17 17">
      <Circle
        cx={8.5}
        cy={8.5}
        r={2.4}
        fill="none"
        stroke={color}
        strokeWidth={1.4}
      />
      <Path
        d="M8.5 1.2v2M8.5 13.8v2M1.2 8.5h2M13.8 8.5h2M3.4 3.4l1.4 1.4M12.2 12.2l1.4 1.4M13.6 3.4l-1.4 1.4M4.8 12.2l-1.4 1.4"
        stroke={color}
        strokeWidth={1.4}
        strokeLinecap="round"
      />
    </Svg>
  );
}

// --- Иконки нижнего таб-бара (24×24, stroke 1.8) ---

/** «Обзор» — столбики. */
export function OverviewTabIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Rect x={3} y={12} width={4} height={8} rx={1} />
      <Rect x={10} y={7} width={4} height={13} rx={1} />
      <Rect x={17} y={3} width={4} height={17} rx={1} />
    </Svg>
  );
}

/** «Новости» — газета. */
export function NewsTabIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Rect x={3} y={4} width={14} height={16} rx={1.5} />
      <Path d="M17 8h4v10a2 2 0 0 1-2 2h-2" />
      <Path d="M6.5 8h7M6.5 11.5h7M6.5 15h4" />
    </Svg>
  );
}

/** «Алерты» — колокольчик. */
export function AlertsTabIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M6 10a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 14 6 10Z" />
      <Path d="M10 19a2 2 0 0 0 4 0" />
    </Svg>
  );
}

/** «Ещё» — круг с тремя точками. */
export function MoreTabIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Circle cx={12} cy={12} r={9} />
      <Circle cx={8.2} cy={12} r={1.15} fill={color} stroke="none" />
      <Circle cx={12} cy={12} r={1.15} fill={color} stroke="none" />
      <Circle cx={15.8} cy={12} r={1.15} fill={color} stroke="none" />
    </Svg>
  );
}
