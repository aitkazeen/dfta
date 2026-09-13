import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fontFamily, radius, spacing, useTheme } from "../../src/theme";
import {
  createAlert,
  deleteAlert,
  getAlerts,
  getPairs,
  updateAlert,
  type AlertType,
  type ApiAlertRule,
  type ApiPair,
  type QuietHours,
} from "../../src/api";
import { useAuthStore } from "../../src/store/auth";
import { Card, Text } from "../../src/components";

/**
 * Алерты (этап 5, roadmap §7) — CRUD правил уведомлений поверх
 * GET/POST/PATCH/DELETE /v1/me/alerts. Форма params под каждый тип триггера
 * повторяет то, что читает server/.../notifications/evaluate.ts.
 *
 * Экран за Stack.Protected (app/_layout.tsx) — сюда попадают только
 * авторизованные, поэтому status "signedOut" тут не обрабатываем, а запросы
 * гоняем через callAuthorized (retry-on-401).
 *
 * NB: сами правила «выстрелят» пушем только когда устройство зарегистрирует
 * push-токен (registerDevice → /v1/me/devices). Интеграция expo-notifications —
 * отдельный шаг, ещё не сделан; здесь настраиваются только сами правила.
 */

const TYPE_LABEL: Record<AlertType, string> = {
  daily: "Ежедневный",
  threshold: "Порог",
  movement: "Движение",
  news: "Новость",
};

const TYPE_HINT: Record<AlertType, string> = {
  daily: "Утренний прогноз по паре — раз в сутки.",
  threshold: "Когда курс пересечёт заданное значение.",
  movement: "Когда дневное движение превысит N×ATR.",
  news: "Когда выйдет новость с impact-score не ниже порога.",
};

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Человекочитаемое описание правила для карточки в списке. */
function describeRule(rule: ApiAlertRule): string {
  const p = rule.params;
  switch (rule.type) {
    case "daily":
      return "Утренний прогноз";
    case "threshold": {
      const dir = p.direction === "below" ? "ниже" : "выше";
      return `Курс ${dir} ${p.value ?? "?"}`;
    }
    case "movement": {
      const mult = typeof p.atrMultiplier === "number" ? p.atrMultiplier : 2;
      return `Движение больше ${mult}×ATR за день`;
    }
    case "news":
      return `Важная новость (impact ≥ ${p.minImpactScore ?? "?"})`;
  }
}

export default function AlertsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const callAuthorized = useAuthStore((s) => s.callAuthorized);

  const [pairs, setPairs] = useState<ApiPair[]>([]);
  const [rules, setRules] = useState<ApiAlertRule[]>([]);
  const [loading, setLoading] = useState(true);

  // --- Черновик нового правила ---
  const [pairId, setPairId] = useState<string | null>(null);
  const [type, setType] = useState<AlertType>("daily");
  const [thresholdValue, setThresholdValue] = useState("");
  const [thresholdDir, setThresholdDir] = useState<"above" | "below">("above");
  const [movementMult, setMovementMult] = useState("");
  const [newsImpact, setNewsImpact] = useState("");
  const [quietEnabled, setQuietEnabled] = useState(false);
  const [quietStart, setQuietStart] = useState("22:00");
  const [quietEnd, setQuietEnd] = useState("08:00");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [pairList, ruleList] = await Promise.all([
        getPairs(),
        callAuthorized((t) => getAlerts(t)),
      ]);
      if (cancelled) return;
      setPairs(pairList);
      setRules(ruleList);
      setPairId((prev) => prev ?? pairList[0]?.id ?? null);
      setLoading(false);
    }
    load().catch((err) => {
      console.error("[alerts] не удалось загрузить правила", err);
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [callAuthorized]);

  const pairLabel = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of pairs) map[p.id] = `${p.base}/${p.quote}`;
    return map;
  }, [pairs]);

  /** Собирает params под выбранный тип; null + текст ошибки, если ввод плох. */
  function buildParams():
    | { ok: true; params: Record<string, unknown> }
    | { ok: false; error: string } {
    switch (type) {
      case "daily":
        return { ok: true, params: {} };
      case "threshold": {
        const value = Number(thresholdValue.replace(",", "."));
        if (thresholdValue.trim() === "" || !Number.isFinite(value)) {
          return { ok: false, error: "Введите числовое значение курса." };
        }
        return { ok: true, params: { value, direction: thresholdDir } };
      }
      case "movement": {
        if (movementMult.trim() === "") {
          return { ok: true, params: {} }; // бэкенд подставит 2×ATR по умолчанию
        }
        const atrMultiplier = Number(movementMult.replace(",", "."));
        if (!Number.isFinite(atrMultiplier) || atrMultiplier <= 0) {
          return { ok: false, error: "Кратность ATR — положительное число." };
        }
        return { ok: true, params: { atrMultiplier } };
      }
      case "news": {
        const minImpactScore = Number(newsImpact.replace(",", "."));
        if (newsImpact.trim() === "" || !Number.isFinite(minImpactScore)) {
          return { ok: false, error: "Введите порог impact-score." };
        }
        return { ok: true, params: { minImpactScore } };
      }
    }
  }

  async function handleCreate() {
    if (!pairId) return;
    const built = buildParams();
    if (!built.ok) {
      setFormError(built.error);
      return;
    }
    let quietHours: QuietHours | undefined;
    if (quietEnabled) {
      if (!HHMM.test(quietStart) || !HHMM.test(quietEnd)) {
        setFormError("Тихие часы — в формате ЧЧ:ММ (напр. 22:00).");
        return;
      }
      quietHours = { start: quietStart, end: quietEnd };
    }

    setFormError(null);
    setSubmitting(true);
    try {
      const rule = await callAuthorized((t) =>
        createAlert(t, { pairId, type, params: built.params, quietHours }),
      );
      setRules((prev) => [...prev, rule]);
      // Сбрасываем только поля значений — пару и тип оставляем, чтобы удобно
      // было добавить несколько похожих правил подряд.
      setThresholdValue("");
      setMovementMult("");
      setNewsImpact("");
      setQuietEnabled(false);
    } catch (err) {
      console.error("[alerts] не удалось создать правило", err);
      setFormError("Не удалось создать правило. Попробуйте ещё раз.");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(rule: ApiAlertRule) {
    try {
      const updated = await callAuthorized((t) =>
        updateAlert(t, rule.id, { isActive: !rule.isActive }),
      );
      setRules((prev) => prev.map((r) => (r.id === rule.id ? updated : r)));
    } catch (err) {
      console.error("[alerts] не удалось переключить правило", err);
    }
  }

  function confirmDelete(rule: ApiAlertRule) {
    Alert.alert("Удалить правило?", describeRule(rule), [
      { text: "Отмена", style: "cancel" },
      {
        text: "Удалить",
        style: "destructive",
        onPress: async () => {
          try {
            await callAuthorized((t) => deleteAlert(t, rule.id));
            setRules((prev) => prev.filter((r) => r.id !== rule.id));
          } catch (err) {
            console.error("[alerts] не удалось удалить правило", err);
          }
        },
      },
    ]);
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.bgBase }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + spacing.sm,
            borderBottomColor: colors.borderSubtle,
          },
        ]}
      >
        <Text variant="title">Алерты</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: insets.bottom + spacing.xxxl,
          gap: spacing.lg,
        }}
      >
        {loading ? (
          <Text
            variant="body"
            color={colors.textTertiary}
            center
            style={styles.state}
          >
            Загрузка правил…
          </Text>
        ) : (
          <>
            {/* --- Список правил --- */}
            {rules.length === 0 ? (
              <Text
                variant="body"
                color={colors.textTertiary}
                center
                style={styles.state}
              >
                Пока нет ни одного правила. Добавьте первое ниже.
              </Text>
            ) : (
              <Card padded={false} style={styles.list}>
                {rules.map((rule, i) => (
                  <View
                    key={rule.id}
                    style={[
                      styles.ruleRow,
                      i > 0 && {
                        borderTopWidth: 1,
                        borderTopColor: colors.borderSubtle,
                      },
                    ]}
                  >
                    <View style={styles.ruleText}>
                      <Text variant="caption" color={colors.textTertiary}>
                        {pairLabel[rule.pairId] ?? rule.pairId} ·{" "}
                        {TYPE_LABEL[rule.type]}
                      </Text>
                      <Text variant="body" style={{ marginTop: 2 }}>
                        {describeRule(rule)}
                      </Text>
                      {rule.quietHours && (
                        <Text
                          variant="caption"
                          color={colors.textTertiary}
                          style={{ marginTop: 2 }}
                        >
                          Тихо {rule.quietHours.start}–{rule.quietHours.end}
                        </Text>
                      )}
                    </View>
                    <Switch
                      value={rule.isActive}
                      onValueChange={() => toggleActive(rule)}
                      trackColor={{
                        false: colors.borderSubtle,
                        true: colors.accent,
                      }}
                    />
                    <Pressable
                      onPress={() => confirmDelete(rule)}
                      accessibilityRole="button"
                      accessibilityLabel="Удалить правило"
                      hitSlop={8}
                      style={styles.deleteBtn}
                    >
                      <Text variant="body" color={colors.down}>
                        ✕
                      </Text>
                    </Pressable>
                  </View>
                ))}
              </Card>
            )}

            {/* --- Форма создания --- */}
            <Card style={{ gap: spacing.md }}>
              <Text variant="title">Новое правило</Text>

              <FieldLabel text="Пара" />
              <ChipRow>
                {pairs.map((p) => (
                  <Chip
                    key={p.id}
                    label={`${p.base}/${p.quote}`}
                    active={pairId === p.id}
                    onPress={() => setPairId(p.id)}
                  />
                ))}
              </ChipRow>

              <FieldLabel text="Тип" />
              <ChipRow>
                {(Object.keys(TYPE_LABEL) as AlertType[]).map((t) => (
                  <Chip
                    key={t}
                    label={TYPE_LABEL[t]}
                    active={type === t}
                    onPress={() => setType(t)}
                  />
                ))}
              </ChipRow>
              <Text variant="caption" color={colors.textTertiary}>
                {TYPE_HINT[type]}
              </Text>

              {/* Поля под конкретный тип */}
              {type === "threshold" && (
                <>
                  <FieldLabel text="Значение курса" />
                  <NumInput
                    value={thresholdValue}
                    onChangeText={setThresholdValue}
                    placeholder="напр. 510"
                  />
                  <ChipRow>
                    <Chip
                      label="Выше"
                      active={thresholdDir === "above"}
                      onPress={() => setThresholdDir("above")}
                    />
                    <Chip
                      label="Ниже"
                      active={thresholdDir === "below"}
                      onPress={() => setThresholdDir("below")}
                    />
                  </ChipRow>
                </>
              )}

              {type === "movement" && (
                <>
                  <FieldLabel text="Кратность ATR (необязательно)" />
                  <NumInput
                    value={movementMult}
                    onChangeText={setMovementMult}
                    placeholder="по умолчанию 2"
                  />
                </>
              )}

              {type === "news" && (
                <>
                  <FieldLabel text="Минимальный impact-score" />
                  <NumInput
                    value={newsImpact}
                    onChangeText={setNewsImpact}
                    placeholder="напр. 0.5"
                  />
                </>
              )}

              {/* Тихие часы — опционально */}
              <View style={styles.quietHeader}>
                <FieldLabel text="Тихие часы" />
                <Switch
                  value={quietEnabled}
                  onValueChange={setQuietEnabled}
                  trackColor={{
                    false: colors.borderSubtle,
                    true: colors.accent,
                  }}
                />
              </View>
              {quietEnabled && (
                <View style={styles.quietRow}>
                  <NumInput
                    value={quietStart}
                    onChangeText={setQuietStart}
                    placeholder="22:00"
                    keyboardType="default"
                    style={styles.quietInput}
                  />
                  <Text variant="body" color={colors.textTertiary}>
                    –
                  </Text>
                  <NumInput
                    value={quietEnd}
                    onChangeText={setQuietEnd}
                    placeholder="08:00"
                    keyboardType="default"
                    style={styles.quietInput}
                  />
                </View>
              )}

              {formError && (
                <Text variant="label" color={colors.down}>
                  {formError}
                </Text>
              )}

              <Pressable
                onPress={handleCreate}
                disabled={submitting || !pairId}
                accessibilityRole="button"
                style={[
                  styles.submit,
                  {
                    backgroundColor: colors.accent,
                    opacity: submitting || !pairId ? 0.5 : 1,
                  },
                ]}
              >
                <Text
                  variant="title"
                  color={colors.onAccent}
                  style={{ fontFamily: fontFamily.semibold }}
                >
                  {submitting ? "Создаём…" : "Создать правило"}
                </Text>
              </Pressable>
            </Card>
          </>
        )}
      </ScrollView>
    </View>
  );
}

// --- Мелкие переиспользуемые части формы ---

function FieldLabel({ text }: { text: string }) {
  const { colors } = useTheme();
  return (
    <Text variant="label" color={colors.textSecondary}>
      {text}
    </Text>
  );
}

function ChipRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.chipRow}>{children}</View>;
}

/** Пилюля-селектор — тот же визуальный язык, что FilterChip в news.tsx. */
function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[
        styles.chip,
        {
          backgroundColor: active ? colors.accent : "transparent",
          borderColor: active ? colors.accent : colors.borderSubtle,
        },
      ]}
    >
      <Text
        style={{
          color: active ? colors.onAccent : colors.textSecondary,
          fontFamily: fontFamily.semibold,
          fontSize: 13,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function NumInput({
  value,
  onChangeText,
  placeholder,
  keyboardType = "decimal-pad",
  style,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: "decimal-pad" | "default";
  style?: object;
}) {
  const { colors } = useTheme();
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.textTertiary}
      keyboardType={keyboardType}
      style={[
        styles.input,
        {
          backgroundColor: colors.bgSurfaceRaised,
          borderColor: colors.borderSubtle,
          color: colors.textPrimary,
          fontFamily: fontFamily.regular,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
  },
  state: { paddingVertical: spacing.xxl },
  list: { overflow: "hidden" },
  ruleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
  },
  ruleText: { flex: 1 },
  deleteBtn: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm - 2 },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 15,
  },
  quietHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  quietRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  quietInput: { flex: 1 },
  submit: {
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
    marginTop: spacing.xs,
  },
});
