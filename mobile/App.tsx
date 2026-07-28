import { useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { api, API_URL } from './src/api'

type PingResponse = {
  message: string
  previousPings: number
  id: number
}

export default function App() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<PingResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handlePress() {
    setLoading(true)
    setError(null)
    try {
      setResult(await api<PingResponse>('/ping'))
    } catch (e) {
      setResult(null)
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="auto" />
      <View style={styles.content}>
        <Text style={styles.title}>dfta</Text>
        <Text style={styles.subtitle}>{API_URL}</Text>

        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          onPress={handlePress}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Дёрнуть /ping</Text>
          )}
        </Pressable>

        {result && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{result.message}</Text>
            <Text style={styles.cardLine}>запись в БД #{result.id}</Text>
            <Text style={styles.cardLine}>до неё было: {result.previousPings}</Text>
          </View>
        )}

        {error && (
          <View style={[styles.card, styles.cardError]}>
            <Text style={styles.cardTitle}>Не достучались</Text>
            <Text style={styles.cardLine}>{error}</Text>
            <Text style={styles.hint}>
              Проверь, что бэкенд поднят (docker compose up) и что телефон
              в той же сети, что и компьютер.
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0f1115' },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  title: { color: '#fff', fontSize: 32, fontWeight: '700' },
  subtitle: { color: '#6b7280', fontSize: 13, marginBottom: 20 },
  button: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 10,
    minWidth: 200,
    alignItems: 'center',
  },
  buttonPressed: { opacity: 0.7 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  card: {
    marginTop: 24,
    padding: 16,
    borderRadius: 10,
    backgroundColor: '#1a1d24',
    width: '100%',
    gap: 4,
  },
  cardError: { backgroundColor: '#2a1519' },
  cardTitle: { color: '#fff', fontSize: 18, fontWeight: '600' },
  cardLine: { color: '#9ca3af', fontSize: 14 },
  hint: { color: '#6b7280', fontSize: 12, marginTop: 8, lineHeight: 17 },
})
