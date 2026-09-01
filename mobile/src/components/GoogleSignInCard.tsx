/**
 * Native (iOS/Android) вариант. На iOS уже есть родной Apple Sign-In
 * (AppleSignInCard), а нативный Google Sign-In (expo-auth-session +
 * dev-client) пока не подключён — Android всё равно не в релизе
 * (project_stage5_ios_only). Поэтому здесь просто ничего не рендерим,
 * а не показываем недоделанную кнопку.
 *
 * Реальная реализация — GoogleSignInCard.web.tsx, её Metro подставляет
 * автоматически на вебе по расширению файла.
 */
export function GoogleSignInCard() {
  return null;
}
