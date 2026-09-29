# Task 3.11.9 — глобальная локальная поставка шрифтов

## Изменение и RED → GREEN

Ветка `trafficolog/fix/3.11.9-global-local-reference-fonts` от main `060ecdf27d65cbef88e077d620400c49f5b89b73`. Существующая `landing-fonts.css` подключена в глобальном `css` Nuxt; три повторных импорта landing/Mini App удалены. Удалены только Google Fonts stylesheet/preconnect. Семь TTF, лицензии, CSS-токены, размеры, цвета, auth/API и Telegram SDK не менялись.

SDD и утверждённый план существовали до кода. Главный regression — `scripts/qa/global-local-fonts.pwcode`, реальный Chrome CLI `fonts3119`, built preview `http://127.0.0.1:3168`. Перед запуском нужен обычный вход владельца и открытая организация; script переносит только полученную нормальным OTP сессию в свежие private contexts. Auth/landing проверяются в отдельных anonymous contexts. Origin и org id берутся из текущего URL, секреты в script отсутствуют.

Google CSS/gstatic блокируются; каждый маршрут — новый context и прямой document entry, без предварительного landing. `document.fonts.load` с кириллицей `Тренировка 123` проверяет реальные `loaded` FontFace entries всех Oswald 500/600/700 и Golos Text 400/500/600/700, а response observer требует семь локальных TTF с HTTP 200. Отдельно проверяются отсутствие внешних font requests и pageerror.

- RED: `/auth/login` и `/app/orgs/1` дали `faces=[]`, `localResponses=[]`, все семь весов отсутствовали; auth redirect/selector/pageerror не были причиной отказа. Landing и `/m/orgs/1` загрузили семь faces и семь local 200, сохраняя контроль работоспособности. Все четыре страницы ещё запрашивали Google CSS.
- GREEN: та же browser-команда после минимального исправления и полной пересборки дала `cases=4`, `failures=[]`; на каждом маршруте семь loaded faces, семь local 200, `externalRequests=[]`, `pageErrors=[]`.
- Обновлённое старое token-test ожидание также прошло RED (1 fail / 4 pass: глобального CSS нет) → GREEN (5/5). Source assertion вспомогательный; browser FontFaceSet — основной regression.

До принятого RED были исправлены ошибки harness: отсутствующий `URL` global в CLI и ожидание h1 внутри Mini App main, где заголовок h2. Они не считаются продуктовым RED.

## Gates

- `pnpm format:check`: pass; повторён после финальной документации.
- `pnpm lint`: 0 errors / 12 существующих warnings вне изменённых файлов.
- `pnpm typecheck`: 6/6 successful (5 cache hits, web пересчитан).
- `pnpm test`: 124 files / 722 tests pass, 52.10 s. Оба `DATABASE_URL` и `DATABASE_URL_TEST` явно установлены в отдельную `volleytime_qa_8101_post56`; integration files не параллелятся. Browser DB `volleytime_qa_8101_selfcheck` не использовалась suite.
- `pnpm build`: 2/2 successful, web пересобран; 1m34.963s. Сохраняются dependency warnings DEP0155 и две Rollup/Zod annotation warnings.

Предыдущий preview остановлен до build. Только после завершения сборки запущен новый preview: port 3168, process 45840, owned exec 41398, DB `volleytime_qa_8101_selfcheck`. Не было сборки поверх работающего `.output`.

## Browser/reflow и действия

- Owner matrix: **103/103**, `failures=[]`, `pageErrors=[]`. 12 Mini App routes × 320/390 × light/dark = 48; 11 desktop routes × 1280/1440/720/390/320 = 55. На каждой странице перед геометрией реально загружены Oswald 700 и Golos Text 400/700. Проверены отсутствие горизонтального overflow, выходящих за ширину main controls, unexpected routes/alerts/positive tabindex и перекрытого dock конца контента при прокрутке вниз. Ширина client area компенсирована на размер scrollbar.
- Auth: **15/15** — email, code, invalid code, organization GET 503 error, organization choice × 320/390/720. Реальный email OTP; invalid code даёт штатный 400. Только organizations GET использует error fixture 503; retry восстанавливает choice без второго OTP. Нет overflow/потери controls или font fallback.
- Landing: **5/5** на 320/390/720/1280/1440, local loaded faces, CTA geometry и anonymous redirect; anchor и FAQ Enter работают; внешних font requests нет. Дополнительно `/m/orgs` проверен на реальной owner session: локальные loaded Oswald/Golos после удаления импорта generic layout.
- Organizer controls: реальный GET кассы удержан fixture до завершения; баланс 115,00 BYN не исчезает, filter focus сохраняется, empty появляется только после ответа. Menu Enter/Shift+Tab/Escape и восстановление focus/inert, открытие/закрытие expense dialog и focus, tabs payments/roster прошли; `mutations=[]`.

PNG в `output/playwright/3119-*.png`: статические снимки с `animations: 'disabled'` в font/reflow проверках; это не проверка реальной фоновой анимации. Просмотрены Mini App owner Home 320 light, invite 320 dark, desktop Home 1280, new-event 390, cashbox 320, auth choice/load-error 320 и landing viewport 320/1440. Сравнение с live `http://127.0.0.1:3169/Volley%20Time%20Mini%20App.html` подтверждает исходную пару Oswald/Golos. Различия реальных данных и исключённых будущих функций референса не использованы как бизнес-требования.

## Команды и локальные artifacts

Все browser-команды запускаются из workspace:

```powershell
npx --yes --package @playwright/cli playwright-cli -s=fonts3119 open http://127.0.0.1:3168/auth/login --browser chrome --headed
# Обычный email OTP; затем выбрать QA Волейбол Минск.
npx --yes --package @playwright/cli playwright-cli -s=fonts3119 run-code --filename scripts/qa/global-local-fonts.pwcode
npx --yes --package @playwright/cli playwright-cli -s=fonts3119 eval 'window.__globalLocalFonts'
npx --yes --package @playwright/cli playwright-cli -s=fonts3119 run-code --filename output/playwright/r06-owner-matrix.pwcode
npx --yes --package @playwright/cli playwright-cli -s=fonts3119 run-code --filename output/playwright/r06-organizer-interactions.pwcode
npx --yes --package @playwright/cli playwright-cli -s=fonts3119 run-code --filename output/playwright/3119-auth-state.pwcode
npx --yes --package @playwright/cli playwright-cli -s=fonts3119 run-code --filename output/playwright/3119-landing-control.pwcode
```

RED/GREEN details, gates, owner matrix, auth states, landing и controls logs: `output/playwright/3119-*.log`. Скрипты в ignored `output/playwright` — локальные повторяемые fixtures; новый основной regression в `scripts/qa` входит в ветку. OTP в пользовательском выводе редактирован, в tracked файлы не записывался.

## Границы приёмки

Implementer self-review: diff ограничен пятью заданными source/test файлами, regression и task-specific документацией; `git diff --check` чистый, assets/licenses/tokens/SDK/auth/API diff отсутствует. Независимые task и whole-branch review не нашли Critical/Important или новых Minor; baseline warnings зафиксированы отдельно. Controller проверил неизменность защищённых assets/CSS/tokens, трейлеры и сохранение checkpoint 8.10.3; повторил exact browser regression (4/4, на каждом семь loaded/local200 и ноль external/errors) и полный PostgreSQL suite на отдельной `volleytime_qa_8101_post56` (124 files / 722 tests, 53,60 s).

[CI 36523981993](https://github.com/trafficolog/volleytime/actions/runs/36523981993) success: quality, unit/integration и build на точном head `67ef8c6beeb0e92d9761be009ebe97d00776dae8`. [PR #61](https://github.com/trafficolog/volleytime/pull/61) смёржен в main как `b4c9630f14d04782d916d00af3fe51f9166507fd`; `git diff 67ef8c6 origin/main --exit-code` подтвердил идентичное полное дерево merge. 3.11.9 принята (`done`). Локальный preview соответствует этому runtime; production не выкладывался.

Это scoped Chrome/font QA, не общий release gate 8.10.3, не реальный Telegram-host, native zoom, screen reader или production acceptance. Заблокированный SDK даёт ожидаемый network console error, а controlled invalid-code/503 — ожидаемые HTTP errors; application pageerror нет. Исполнитель не публиковал изменения; controller провёл проверенную задачу через PR в main. `prod=67bbfe89acaac04992b8128d45cb1b40f8acc75c` / v0.1.5 и VPS не менялись. Далее общая 8.10.3, без частичной выкладки R0.6.
