import Constants from 'expo-constants'
import { Platform } from 'react-native'

export type ApiPair = { id: string; base: string; quote: string; displayName: string }
export type ApiQuote = { id: string; base: string; quote: string; rate: number; asOf: string; source: string }
export type ApiCandle = { ts: string; o: number; h: number; l: number; c: number }
export type ApiIndicators = Record<string, {value: string, ts: string}>
/**
 * Самая частая проблема новичка: приложение не видит бэкенд.
 * Причина в том, что "localhost" внутри телефона или эмулятора
 * означает сам телефон, а не твой компьютер.
 *
 * Правильные адреса:
 *   реальный телефон      -> IP компьютера в Wi-Fi, напр. 192.168.1.15
 *   Android эмулятор      -> 10.0.2.2 (спец-алиас для хоста)
 *   iOS симулятор         -> localhost работает, он делит сеть с macOS
 *
 * Ниже адрес вычисляется сам. Expo знает, с какого IP отдаётся
 * бандл (hostUri вида "192.168.1.15:8081") — берём оттуда хост
 * и подставляем свой порт.
 */
function resolveHost(): string {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants.expoGoConfig as { debuggerHost?: string } | undefined)?.debuggerHost

  if (hostUri) {
    const host = hostUri.split(':')[0]
    // В Android-эмуляторе Expo иногда отдаёт localhost — подменяем.
    if (host === 'localhost' || host === '127.0.0.1') {
      return Platform.OS === 'android' ? '10.0.2.2' : 'localhost'
    }
    return host
  }

  return Platform.OS === 'android' ? '10.0.2.2' : 'localhost'
}

export const API_URL = `http://${resolveHost()}:3000`

export async function api<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`)
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`)
  }
  return res.json() as Promise<T>
}

export function getPairs(): Promise<ApiPair[]> {
  return api<ApiPair[]>('/v1/pairs')
}

export function getQuote(id: string): Promise<ApiQuote> {
  return api<ApiQuote>(`/v1/pairs/${id}/quote`)
}

/** Пока только дневные свечи — см. GET /v1/pairs/:id/candles на бэкенде. */
export function getCandles(id: string, limit = 30): Promise<ApiCandle[]> {
  return api<ApiCandle[]>(`/v1/pairs/${id}/candles?limit=${limit}`)
}

export function getIndicators(id: string): Promise<ApiIndicators> {
  return api<ApiIndicators>(`/v1/pairs/${id}/indicators`)
}
