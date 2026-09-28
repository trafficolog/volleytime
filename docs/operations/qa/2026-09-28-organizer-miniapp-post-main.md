# Mini App организатора — post-main QA, 2026-09-28

Tasks 8.10.2 / 8.10.3, код `d3df334`, worktree `organizer-miniapp-v2-spec`. Nuxt production-preview `http://127.0.0.1:3143`, отдельная QA-БД `volleytime_qa_task1_20260926`, Edge Playwright CLI, локальный console-email owner. Health `status/db/auth: ok`. Production и настоящий Telegram не использовались.

## Свежий проход

Все пути ниже внутри `/m/orgs/30`.

| Экран                     | Маршрут                                     | Результат                                                                                                                       |
| ------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| События                   | `/events`                                   | 320/390 light/dark, без overflow                                                                                                |
| Состав                    | `/events/16/manage`                         | 320/390 light/dark, реальная pending-запись, без overflow                                                                       |
| Очередь оплат             | `/payments`                                 | 320/390 light/dark, 25,00 BYN из API, индивидуальные действия, без overflow                                                     |
| Касса                     | `/cashbox`                                  | 320/390 light/dark, реальные баланс/журнал, без overflow                                                                        |
| Создание и редактирование | `/events/new`, `/events/17/edit`            | 320/390 light/dark, поля/опция абонементов видны, без overflow                                                                  |
| Оплаты события            | `/events/16/manage`, «Оплаты»               | 390 light, вкладка/реальная pending-запись/две кнопки видны                                                                     |
| Меню                      | нижняя навигация                            | 390 light, первый пункт получает фокус; Shift+Tab замыкается на «Журнал»; Escape возвращает фокус на «Меню», inert восстановлен |
| Новый расход              | `/cashbox`, «Расход»                        | 320 light, лист/поля/submit видны, категория получает фокус; Escape без POST                                                    |
| Прочие ссылки             | `/members`, `/plans`, `/settings`, `/audit` | 320 light, без alert/overflow                                                                                                   |
| Приглашения               | `/invite`                                   | 320 light, overflow 308/305, отдельная 8.10.5                                                                                   |

Для шести основных маршрутов сделано 24 измерения: 320/390 × light/dark; client widths 305/375 из-за scrollbar. `scrollWidth === clientWidth`, кнопки/поля не выходят по горизонтали. `.dark` включена явно; проверен `--vt-paper: #0f1013`. Финальные captures сняты после 150 ms CSS-переходов. Это CSS-fixture, не Telegram themeChanged.

На обеих формах при прокрутке вниз submit заканчивается на 764,81 px, dock начинается на 828 px: перекрытия нет. Шесть маршрутов при **client width 160** прошли 160/160 (viewport 175 с учётом scrollbar). Первый viewport 160 оставлял только 145 CSS px: две формы дали 160/145; этот более узкий результат не засчитывается как успешный 160 px тест. Resize proxy не является native browser zoom.

FontFaceSet на manage содержит загруженные Golos Text 400/600 и Oswald 600/700, включая кириллические faces. Это подтверждает загрузку этих используемых faces в данной сессии, не всех весов/маршрутов или pixel-perfect fidelity. Пользовательский Home native 200% записан в карточке 8.10.2 и не перенесён на другие маршруты/игрока.

## Ограничения

- Денежные, event-save, settings и revoke POST/PATCH не выполнялись. Прежняя functional QA не выдана за свежую.
- Геометрия не заменяет контраст, полный screen-reader проход, review и сравнение каждого состояния с HTML-референсом.
- PNG/snapshots: локальный `output/playwright/miniapp-r06-20260928/`, не опубликованные release artifacts. Пользовательские снимки находятся в Windows Temp.
- Пять gates в этом проходе не повторялись: продуктовый код не менялся. Последний объединённый gate-run описан в 8.10.2.
- Открыты 8.10.5, интеграция/приёмка веток Mini App и общий 8.10.3. Реальный Telegram QA — после контролируемой выкладки полного кандидата. `prod`/VPS не менялись.

## Повторная интеграционная QA после PR #53

Исторический проход выше относится к `d3df334`. Новый проход выполнен на дереве с parent `0e7cb98` и main `16d7266` (PR #53), после разрешения трёх документационных конфликтов. Source-конфликтов нет; приглашения идентичны main. Старое замечание 8.10.5 закрыто; вывод «открыта 8.10.5» выше больше не является текущим статусом.

- Пять gates: format pass; lint pass (0 errors/19 warnings); typecheck 6/6; tests 112 files/637 tests на отдельной PostgreSQL `volleytime_qa_8102_post53_20260928`; build 2/2 (web fresh, bot cached). Windows EBUSY первого build устранён остановкой только старого preview 3143; повторный build exit 0 и новый preview `node apps/web/.output/server/index.mjs` восстановлены. Health `status/db/auth: ok`, release `dev`.
- Whole-branch независимое read-only review относительно main `16d7266`: Critical/Important/Minor findings отсутствуют; `git diff --check` clean. Reviewer не выдаёт этот вывод за visual/Telegram/deploy acceptance.
- `post53-matrix.pwcode`: Home, events, manage roster, payments, cashbox, new и edit — **28/28** при actual client widths 320/390 × light/dark. `scrollWidth === clientWidth`, видимые main button/input/select/textarea не выходят по горизонтали; pageerror отсутствуют. Fonts ready дождались до снимка. Тема задана CSS `.dark`, бумага `#fff` / `#0f1013`.
- Встроенный `scripts/qa/miniapp-invite-actions-reflow.pwcode` повторён на 3143 — **12/12**: 320/390/160 light/dark × copy/copied, Tab copy → share → revoke, revoke 44×44. Clipboard stub, реальный API GET; share/revoke не выполнялись. 160 px — reflow proxy, не native zoom.
- `post53-interactions.pwcode`: задержанный реальный `GET /ledger?type=expense` показывает skeleton, не empty, с балансом и фокусом `ledger-type`; после release видны реальные −1/−20 BYN без доходных строк. Меню Enter → «Создать событие», Shift+Tab → «Журнал», Escape → фокус «Меню», inert снят. «Расход» открывает форму с фокусом `lg-cat`, Escape закрывает без денежного POST.
- Подпись «Касса» Home: foreground rgba(255 255 255 / 0,78), opacity 0,75, background rgb(31 46 150); эффективная alpha 0,585, WCAG 2 ratio **4,82:1** после alpha-композиции. Это проверка одной пары, не полная a11y/контрастная приёмка; цвета не менялись.
- Просмотрены PNG Home 320 light, manage 320 dark, cashbox 390 dark, new 320 light, payments 320 light, events 390 light, edit 390 dark, menu keyboard 320 light и cashbox pending 320 light. У full-page PNG fixed dock остаётся на координате первого viewport: нахождение dock посередине длинного снимка не доказывает перекрытие submit при прокрутке. Pixel-perfect, все состояния и все веса шрифтов этим не доказаны.

Скрипты/28 PNG и дополнительные captures находятся локально в `output/playwright/miniapp-r06-20260928/`, не являются опубликованными release artifacts. Прежний подтверждённый пользователем Home native 200% не запрашивался повторно. Общий 8.10.3, совместная матрица веток и реальный Telegram после полного кандидата остаются открытыми. `prod`/VPS не менялись.
