import { Tabs } from 'expo-router'
import { fontFamily, useTheme } from '../../src/theme'
import {
  AlertsTabIcon,
  MoreTabIcon,
  NewsTabIcon,
  OverviewTabIcon,
} from '../../src/components'

/**
 * Нижний таб-бар (бриф §4.2): Обзор · Новости · Алерты · Ещё.
 * Экран пары живёт НЕ здесь, а в корневом Stack (app/pairs/[id]) — он
 * открывается поверх табов на всю высоту, как в макете (без таб-бара).
 * Безопасную зону снизу React Navigation добавляет к таб-бару сам.
 */
export default function TabsLayout() {
  const { colors } = useTheme()

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.textPrimary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: {
          backgroundColor: colors.bgBase,
          borderTopColor: colors.borderSubtle,
          borderTopWidth: 1,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontFamily: fontFamily.semibold, fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Обзор', tabBarIcon: ({ color }) => <OverviewTabIcon color={color} /> }}
      />
      <Tabs.Screen
        name="news"
        options={{ title: 'Новости', tabBarIcon: ({ color }) => <NewsTabIcon color={color} /> }}
      />
      <Tabs.Screen
        name="alerts"
        options={{ title: 'Алерты', tabBarIcon: ({ color }) => <AlertsTabIcon color={color} /> }}
      />
      <Tabs.Screen
        name="more"
        options={{ title: 'Ещё', tabBarIcon: ({ color }) => <MoreTabIcon color={color} /> }}
      />
    </Tabs>
  )
}
