# 24.1.2 · Публичная страница группы — проверка (2026-11-23)

- **Харнесс 19.0.2:** не применяется. В карточке `reference.screens: []`, экранов референса нет (как D-24 для 24.1.1).
- **Smoke на production-сборке** (`node .output/server/index.mjs`, свободный порт, собственная БД с примененными миграциями, одна опубликованная группа):
  - `/g/<slug>` с `seoIndex=true`: 200, `<html lang="ru">`, title, meta description, `robots: index, follow`, canonical, два блока JSON-LD (SportsActivityLocation, FAQPage), один `h1`;
  - `sitemap.xml` содержит главную, `/g/<slug>` и `/volleyball/<город>`; `robots.txt` указывает sitemap;
  - после `seoIndex=false`: `X-Robots-Tag: noindex, nofollow`, страницы нет в sitemap, каталог города отвечает 404.
- **Lighthouse SEO ≥ 95:** **не проверено**. Запуск Lighthouse в среде агента был запрещен правилом разрешений. Выше вручную проверены сигналы, которые оценивает аудит SEO. Нужен прогон владельцем или в CI.
