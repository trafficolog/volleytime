# Landing 3.11.4 — повторная QA после интеграции main

## Проверенное дерево

Landing head `deded48b8f670e4f2939084af4e950bf54063a29` + `main` `38c9b054305d4476854bf6573fb2d9533048c9a4`, разрешённые конфликты только в документации. Код лендинга не изменялся. Рабочий каталог: `C:/Users/User/.codex/worktrees/player-miniapp-v2-spec/volleytime`.

## Gates, 2026-09-28

- `pnpm format:check`: pass.
- `pnpm lint`: pass, 0 errors / 12 baseline warnings вне лендинга.
- `pnpm typecheck`: 6/6, совпадающее дерево из Turbo cache.
- `pnpm test`: 123 files / 717 tests pass; оба DATABASE_URL и DATABASE_URL_TEST указывают на отдельную локальную PostgreSQL `volleytime_qa_8101_post56`.
- `pnpm build`: 2/2, совпадающее дерево из Turbo cache.
- `git diff --check`: pass.

## Browser / visual

Chrome channel, отдельный Playwright CLI profile `landing43final`, собранный Nuxt на `http://127.0.0.1:3142/`. Команда: `npx --yes --package @playwright/cli playwright-cli -s=landing43final run-code --filename scripts/qa/landing-post-main.pwcode`.

Проверено на 320/390/768/1280/1440 CSS px: нет горизонтального document overflow, hero CTA в пределах viewport; шесть MVP Bento-карточек, три шага, один h1/main. Anonymous CTA сохраняет login redirect создания группы; fixture действующей сессии переключает его на `/m/orgs/create`. Это fixture, не новый реальный OTP/production-email тест. Telegram href совпадает с ранее подтверждённым `volleytimeby_bot`, без отправки сообщений.

Якорь шагов, FAQ клавишей Enter, reduced motion, реально загруженные локальные Oswald 700/Golos Text 400 прошли. Live reduced motion останавливает canvas и снимает pointer-эффект; обратное переключение возобновляет rAF. Переход на auth удаляет canvas. В отдельном no-JS контексте SSR и нативный FAQ работают, CTA сохраняет redirect.

Просмотрены полные снимки `output/playwright/landing43-post-main-{320,1440}.png`: сохранены hero, телефоны (один mobile / два desktop), оранжевая полоса, чат/событие, Bento, шаги, роли, FAQ и финал. Точная палитра принята пользователем; прежнее ограничение контраста исходного оранжевого не объявляется исправленным.

## Ручное свидетельство

Пользователь подтвердил zoom 200% для полного снимка `C:/Users/User/AppData/Local/Temp/codex-clipboard-ed4b51d6-8a53-4a3e-8e60-594e27954285.png`, остановку анимации в настоящей фоновой вкладке и возобновление при возврате. Эти пункты зачтены как ручная проверка, не как автоматическое измерение и не как Telegram-host QA.

## Независимое review

Final integrated-tree review: Critical/Important отсутствуют; landing slice 3 files / 9 tests pass. Minor session-error logging воспроизведён Chrome fixture 503 и выделен в [3.11.8](../../tasks/3-11-8-landing-session-failure-fallback.md): страница/CTA работают, Vue пишет FetchError в консоль. Не блокирует main-интеграцию 3.11.4, должен быть проверен отдельно до общего R0.6 gate.

## Границы

Точный новый GitHub CI/merge фиксируется после публикации этого дерева. Общая 8.10.3 ещё открыта. `prod`/VPS остаются v0.1.5; deploy/backup/health и ручной Telegram/two-account QA полного кандидата этой локальной QA не доказаны.
