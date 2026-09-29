# R0.6 / 8.10.3 — entry, invite и error/retry, 2026-09-29

## Окружение и границы

Chrome CLI `fonts3119`, built preview `http://127.0.0.1:3168/`, runtime source `67ef8c6` (принят в main через PR #61). QA HEAD до этого прохода `0956445`; runtime diff с актуальным `origin/main=c946142` отсутствует. `git fetch origin` подтвердил main и `prod=67bbfe89acaac04992b8128d45cb1b40f8acc75c`; открытых GitHub PR не было. Production и VPS не изменялись.

Для private routes использованы изолированные Chrome contexts с cookie ранее полученной **штатным email OTP** owner-сессии, без SQL/session bypass. Только синтетические аккаунты/организация 1 в `volleytime_qa_8101_selfcheck`. Управляемые HTTP-ответы проверяют UI, а не серверные бизнес-операции. Telegram SDK блокировался; dark задавался `.dark`, не настоящим Telegram `themeChanged`.

Семь локальных Oswald/Golos faces явно загружены с кириллицей через `document.fonts.load` перед каждым измерением; `scrollWidth <= clientWidth + 1`. Это не замена просмотра PNG, native zoom 200% или реального экранного диктора. Уже подтверждённые пользователем manual evidence сохраняются, не запрашиваются снова.

## Свежие результаты

| Поверхность                      | Сценарии                                                                                                             | Результат и границы                                                                                                                                                               |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mini App entry                   | anonymous → login с return `/m/`; session 503 → retry → группы                                                       | 320/390 × light/dark; normal local session GET после снятия отказа, не auth bypass                                                                                                |
| Отрицательный Telegram entry     | browser WebApp fixture с заведомо неподписанными `initData` → реальный local auth API                                | Четыре ответа **401**, сообщение об ошибке, retry и ссылка **`https://t.me/volleytimeby_bot`**; это не Telegram-host acceptance                                                   |
| Приглашение игрока               | valid/direct, valid/approval, active member, pending, blocked, not_found, revoked, expired, exhausted, GET 503/retry | HTTP fixtures по публичному контракту `InvitePreview`; скрыто вступление в restricted/error состояниях; retry восстанавливает valid CTA                                           |
| Пустые группы / приглашение      | empty; groups 503/retry; invalid input → focus + `aria-invalid`; исправленная ссылка → invite route                  | Реальная Vue-форма и навигация, controlled groups/invite ответы; создание/вступление POST не выполнялись                                                                          |
| Error/retry Mini App             | payments, ledger, members, plans, audit                                                                              | Пять routes × 320/390 × light/dark = **20/20**; controlled GET 503 → «Повторить» → **настоящий локальный GET 200**, без pageerrors/POST                                           |
| Error/retry desktop              | pending payments, history отдельно, ledger, members, plans, invite, events                                           | Семь surfaces × 320/1280/1440 = **21/21**; тот же recovery к real local API 200; response и завершение сетевой загрузки ожидаются до assertion                                    |
| Ошибка organizer Mini App invite | `/m/orgs/1/invite`, GET invites 503                                                                                  | **4/4 воспроизведения дефекта**: alert + ложный «Активных ссылок нет», retry отсутствует. Выделена [8.10.6](../../tasks/8-10-6-miniapp-invite-load-retry.md) до продуктового кода |

Entry/invite matrix: **60/60**, failures `[]`. Зафиксированы только четыре отрицательных auth POST (401); event/payment/ledger/invite mutations отсутствуют. Error/retry matrix: **41 pass + 4 известных RED 8.10.6** из 45, mutations `[]`. Положительный результат остальных 41 повторён с ожиданием HTTP response и `networkidle`, не только исчезновения alert во время loading.

## Визуальный просмотр и воспроизводимость

Просмотрены PNG: valid invite 320 light (длинное имя переносится), pending invite 390 dark, exhausted 320 dark, groups empty 320 light, invalid initData 390 dark; отдельно organizer invite 320 light с дефектом, ledger 390 dark, audit 320 light, desktop history 1280 light. На этих кадрах сохранены принятые токены/Oswald/Golos; ошибки читаемы, действия внутри viewport. Это выборочный визуальный просмотр, не pixel-perfect приёмка всех 60+45 кадров.

Локальные ignored harness/JSON/PNG в QA-worktree `output/playwright/`:

- `r06-entry-invite.pwcode`, SHA-256 `D8D44AED0AC6E4A6F8123119FD33871FDA5F2562A6595D5A7F001E8CD3AAAA81`; `r06-entry-invite-report.json`, `r06-entry-*.png`.
- `r06-error-retry.pwcode`, SHA-256 `527F3E529C8DBB7A628AE67877F65F8E3123555B16EA7DBD43B74F1965010D37`; `r06-error-retry-report.json`, `r06-error-*.png`.
- Команды: `npx --yes --package @playwright/cli playwright-cli -s=fonts3119 run-code --filename output/playwright/<harness>.pwcode`, после открытия локального owner org 1. CLI exit 0 не заменяет чтение JSON `failures`.

При подготовке harness исправлены две его ошибки, не продуктовые дефекты: FontFace loading ленивый (без явного запроса все семь весов не обязаны загрузиться), а groups-empty → invite fixture сначала ошибочно имел `status: null`. Финальный проход выполнен после исправления fixture. Ошибка раннего закрытия request context в пробном harness устранена ожиданием ответа, `route.continue()` и teardown `unrouteAll`; она не приписывается приложению. Диагностические CLI ошибки могут содержать cookie headers — такие выводы не публикуются в evidence/PR; JSON отчёты не содержат cookies/OTP.

## Остаётся

8.10.6 должна пройти отдельные RED/GREEN, browser recovery, пять gates, review/CI и merge. Она входит в R0.6; после неё ещё нужны targeted primary-route error/role states и окончательный release smoke/gates/review/CI. Общая 8.10.3 остаётся `in_progress`. Настоящий Telegram/two-account/pilot — после controlled выкладки **полного** кандидата по согласованному runbook, не до неё; ни release acceptance, ни production backup/deploy здесь не заявлены.
