import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fontFamily, radius, spacing, useTheme } from "../src/theme";
import {
  Card,
  LEGAL_ACCURACY,
  LEGAL_AI_DISCLOSURE,
  LEGAL_DISCLAIMER_FULL,
  Text,
} from "../src/components";
import { useOnboardingStore } from "../src/store/onboarding";

/**
 * Онбординг (roadmap §8) — первый экран при первом запуске, до входа. Несёт
 * обязательные юридические блоки: информационный характер (не инвест-совет),
 * честная точность и раскрытие использования ИИ + согласие на передачу данных
 * третьим сторонам. Согласие фиксируется явным нажатием «Принимаю».
 *
 * Гейтится в app/_layout.tsx (Stack.Protected по useOnboardingStore) — после
 * complete() статус становится "done" и Stack сам показывает login/(tabs).
 */
export default function OnboardingScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const complete = useOnboardingStore((s) => s.complete);
  const [accepting, setAccepting] = useState(false);

  async function handleAccept() {
    setAccepting(true);
    await complete();
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.bgBase }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + spacing.xxl,
          paddingBottom: insets.bottom + spacing.lg,
          paddingHorizontal: spacing.xl,
          gap: spacing.xl,
        }}
      >
        <View style={styles.intro}>
          <Text variant="display" center>
            KursWise
          </Text>
          <Text variant="body" color={colors.textSecondary} center>
            Технический анализ графиков и новостной фон по валютным парам к
            тенге — прогноз направления и push, когда рынок двигается.
          </Text>
        </View>

        <Card style={styles.card}>
          <Text variant="title">Что вы получаете</Text>
          <Feature text="Вероятное направление пары, диапазон и горизонт" />
          <Feature text="Три причины за каждым прогнозом — коротко и понятно" />
          <Feature text="Push, когда курс двигается или выходит важная новость" />
        </Card>

        <Card style={styles.card}>
          <Text variant="title">Важно понимать</Text>
          <Text variant="body" color={colors.textSecondary}>
            {LEGAL_DISCLAIMER_FULL}
          </Text>
          <Text variant="body" color={colors.textSecondary}>
            {LEGAL_ACCURACY}
          </Text>
        </Card>

        <Card style={styles.card}>
          <Text variant="title">Искусственный интеллект и данные</Text>
          <Text variant="body" color={colors.textSecondary}>
            {LEGAL_AI_DISCLOSURE}
          </Text>
        </Card>

        <Pressable
          onPress={handleAccept}
          disabled={accepting}
          accessibilityRole="button"
          style={[
            styles.accept,
            { backgroundColor: colors.accent, opacity: accepting ? 0.5 : 1 },
          ]}
        >
          <Text
            variant="title"
            color={colors.onAccent}
            style={{ fontFamily: fontFamily.semibold }}
          >
            Принимаю — продолжить
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function Feature({ text }: { text: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.feature}>
      <View style={[styles.dot, { backgroundColor: colors.accent }]} />
      <Text
        variant="body"
        color={colors.textSecondary}
        style={styles.featureText}
      >
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  intro: { gap: spacing.sm },
  card: { gap: spacing.sm },
  feature: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  dot: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
    marginTop: 8,
  },
  featureText: { flex: 1 },
  accept: {
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
});
