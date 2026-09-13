# Ответы для форм приватности сторов — KursWise

Практическая шпаргалка для заполнения **Google Play Data Safety** и **Apple App Privacy** (обе — анкеты в консолях, не файлы в репозитории). Основано на реальном сборе данных приложением (проверено по коду: `server/prisma/schema.prisma`, `auth/routes.ts`; трекеров/аналитики в `mobile/package.json` нет).

Сводка того, что собирается: идентификатор аккаунта (Apple/Google `sub` + внутренний ID), email (опционально), push-токен, watchlist и правила алертов, часовой пояс/язык. **Нет:** геолокации, контактов, фото, здоровья, платёжных данных, рекламных трекеров, отслеживания между приложениями.

---

## 1. Google Play — Data Safety

**Собирает ли приложение данные?** Да. **Передаёт ли третьим сторонам для их целей?** Нет (только обработчики для работы сервиса — это не считается «sharing» в смысле Data Safety, если они действуют по нашему поручению).

| Категория Google | Тип данных | Собирается | Передаётся | Обяз./опц. | Цель |
| --- | --- | --- | --- | --- | --- |
| Personal info | Email addresses | Да | Нет | Опционально | Account management, App functionality |
| Personal info | User IDs | Да | Нет | Обязательно | Account management, App functionality |
| App activity | Other user-generated content (watchlist, правила алертов) | Да | Нет | Обязательно | App functionality |
| Device or other IDs | Device or other IDs (push-токен) | Да | Нет | Обязательно | App functionality (уведомления) |

**Security practices:**
- _Is data encrypted in transit?_ → **Да** (HTTPS/TLS). ⚠️ Убедиться, что продовый бэкенд за HTTPS: `usesCleartextTraffic: true` в `app.json` — только для локальной разработки, в проде очищённый HTTP недопустим.
- _Can users request data deletion?_ → **Да**, укажите способ (см. §3 — требует реализации удаления аккаунта).
- _Committed to Play Families policy?_ → Нет (не для детей).

---

## 2. Apple — App Privacy (App Store Connect)

Заполняется отдельно от `PrivacyInfo.xcprivacy` (манифест уже настроен в `app.json → ios.privacyManifests`). Анкета «nutrition label»:

| Тип данных Apple | Собирается | Связан с пользователем (Linked) | Для трекинга | Цель |
| --- | --- | --- | --- | --- |
| Contact Info → Email Address | Да | Да | Нет | App Functionality |
| Identifiers → User ID | Да | Да | Нет | App Functionality |
| User Content → Other User Content (watchlist, алерты) | Да | Да | Нет | App Functionality |

- **Used to Track You?** → Нет ни по одному типу (`NSPrivacyTracking = false`).
- Push-токен Apple как правило не декларируется отдельным типом в nutrition label (не используется для трекинга); в манифесте required-reason API — только `UserDefaults` (CA92.1), его добавляют RN/Expo-модули.

---

## 3. Обязательное условие обоих сторов: удаление аккаунта

⚠️ **Блокер релиза.** И Apple (App Review Guideline 5.1.1(v)), и Google Play (Data deletion) требуют: если в приложении есть регистрация аккаунта, должен быть способ **удалить аккаунт и данные из приложения** (+ опционально веб-ссылка для Google).

Сейчас этого нет. Нужно до подачи:
- бэкенд: эндпоинт `DELETE /v1/me` — удаляет `AppUser` и каскадно `DeviceToken` / `AlertRule` / `NotificationLog` / `user_watchlist`;
- клиент: пункт «Удалить аккаунт» на экране «Ещё» с подтверждением;
- (Google) публичный URL для запроса удаления — можно указать страницу с формой/почтой.

---

## 4. Чек-лист перед подачей

- [ ] Заполнить `[плейсхолдеры]` в `privacy-policy.md`, разместить по публичному URL.
- [ ] Вписать этот URL в App Store Connect и Google Play Console.
- [ ] Реализовать удаление аккаунта (§3).
- [ ] Подтвердить, что прод-API за HTTPS (не cleartext).
- [ ] Проверить, что в `PrivacyInfo.xcprivacy` (генерится из `app.json`) после сборки попали все нужные required-reason API — EAS Build агрегирует манифесты Expo-модулей; сверить в собранном `.ipa`.
- [ ] Заполнить обе анкеты (§1, §2) согласно таблицам выше.
