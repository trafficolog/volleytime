# R0.6 / 8.10.3 — entry, invite и error/retry, 2026-09-29

## Актуальное дополнение после PR #64

Первоначальные четыре RED organizer-invite ниже были исправлены отдельной [8.10.6](../../tasks/8-10-6-miniapp-invite-load-retry.md), принятой в `main` как `c473de1` после RED→GREEN, пяти gates, Chrome, независимого review, exact-head и main CI. [Отчёт фикса](2026-09-29-miniapp-invite-load-retry.md) отделяет ошибку GET от отказа POST revoke.

На исправленной built-сборке source `40759fc` Chrome `fonts3119` повторил error/retry матрицу: **45/45**, включая четыре organizer invite 320/390 × light/dark, failures/pageerrors/mutations пусты. Клавиатурный Enter на retry (**102,5625 × 44 CSS px**) получил реальный локальный GET 200; успешный empty проверен отдельным assertion и PNG после повтора. Контролируемый revoke POST503: **4/4**, ранее загруженная ссылка и действия видимы, повтор GET не предлагается; все четыре POST перехвачены, не дошли до сервера. Локальный smoke точного code SHA прошёл; это синтетический initData, не Telegram-host.

Дополнительно `r06-primary-errors.pwcode` дал **21/21** primary-route error→retry в обычной owner-сессии: Mini App Home/settings/organizer event manage × 320/390 light/dark (12), desktop Home/org-entry→settings/event × 320/1280/1440 (9). Каждая ошибка получена управляемым GET503 по действительной SPA-навигации, Enter вызвал новый GET и **настоящий локальный 200**; overflow/pageerrors/mutations нет. Desktop settings имеет общий `desktop-org` cache key с layout: ошибка проверена на входе в shell, после восстановления открыт settings с действующей формой. Пробные harness-ошибки выбора скрытой desktop-ссылки, organizer `/manage` и точного текста «Сохранить настройки» исправлены до финальных 21/21 и не приписываются приложению. Просмотрены PNG Mini event 320 dark, desktop org-entry 320 и event 1280; все они показывают читаемый error/retry без горизонтального обрезания. Остальные кадры пройдены автоматическими assertions, а не названы pixel-perfect просмотром.

Локальные ignored JSON/PNG: `r06-error-retry-report.json`, `r06-primary-errors-report.json`, `r06-recovered-mini-invite-*.png`, `8106-revoke-error-*.png`. Browser fixture/viewport и синтетический smoke не заменяют настоящий Telegram `themeChanged`, уведомления, BotFather, production или пилот. Базовые результаты 60/60 entry/invite ниже не повторялись после 8.10.6, поскольку исправление затронуло только organizer invite list; task-специфичная QA остаётся принятой как **P**, не выдаётся за новый F.

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
- `r06-error-retry.pwcode`, SHA-256 `8ACBDCCCD5877110D43C24D97FC4DBA6924EA8DF37C6A0615B3ED93810D7A3B8`; `r06-error-retry-report.json`, `r06-error-*.png`.
- Команды: `npx --yes --package @playwright/cli playwright-cli -s=fonts3119 run-code --filename output/playwright/<harness>.pwcode`, после открытия локального owner org 1. CLI exit 0 не заменяет чтение JSON `failures`.

При подготовке harness исправлены две его ошибки, не продуктовые дефекты: FontFace loading ленивый (без явного запроса все семь весов не обязаны загрузиться), а groups-empty → invite fixture сначала ошибочно имел `status: null`. Финальный проход выполнен после исправления fixture. Ошибка раннего закрытия request context в пробном harness устранена ожиданием ответа, `route.continue()` и teardown `unrouteAll`; она не приписывается приложению. Диагностические CLI ошибки могут содержать cookie headers — такие выводы не публикуются в evidence/PR; JSON отчёты не содержат cookies/OTP.

## Оставалось на момент RED-checkpoint (историческое)

На момент этого первоначального отчёта 8.10.6, targeted primary-route error и final release gates были открыты. Их последующие результаты приведены в верхнем актуальном дополнении и интегрированной матрице; строки 41 pass + 4 RED ниже — история выявления дефекта, не текущее состояние. Настоящий Telegram/two-account/pilot остаётся после controlled выкладки **полного** кандидата по согласованному runbook, не до неё; production backup/deploy здесь не заявлены.
