import { StyleSheet, View } from 'react-native'
import { fontFamily, radius, spacing, useTheme } from '../theme'
import { Text } from './Text'
import type { NewsArticle } from '../types'

type Props = {
  article: NewsArticle
  /** Первая новость в списке — без верхней границы. */
  first?: boolean
}

/**
 * Новость по паре: источник + время, заголовок, бейдж влияния.
 * Заголовок в 2 строки (бриф §3.4) — обрезаем троеточием, чтобы список
 * не «прыгал» по высоте.
 */
export function NewsItem({ article, first }: Props) {
  const { colors } = useTheme()

  return (
    <View
      style={[styles.item, !first && { borderTopWidth: 1, borderTopColor: colors.borderSubtle }]}
    >
      <View style={styles.meta}>
        <Text variant="caption" color={colors.textTertiary}>
          {article.source}
        </Text>
        <Text variant="caption" color={colors.textTertiary}>
          {article.time}
        </Text>
      </View>
      <Text numberOfLines={2} style={styles.title}>
        {article.title}
      </Text>
      <View style={[styles.tag, { backgroundColor: colors.bgSurfaceRaised }]}>
        <Text variant="caption" color={colors.textSecondary}>
          {article.tag}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  item: {
    paddingVertical: spacing.sm + 2, // 10
  },
  meta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  title: {
    fontFamily: fontFamily.medium,
    fontSize: 15,
    lineHeight: 20,
  },
  tag: {
    alignSelf: 'flex-start',
    marginTop: 6,
    borderRadius: radius.sm - 2, // 6
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
})
