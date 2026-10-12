# W-14 · Страница группы · рендер

| Интерфейс | Фаза | Сложность | Модель | Ревью |
|---|---|---|---|---|
| Кабинет организатора | Ф4 · SEO-страницы групп | XL | Opus | Opus + тесты |

## Цель

Публичная страница, которую находят по «волейбол {город} тренировки».

## Макет

- 4 Кабинет организатора → Страница группы → предпросмотр

## Объём

- Серверный рендер
- schema.org: SportsActivityLocation, Event, FAQPage
- index/noindex по seoIndex
- sitemap.xml, canonical, OG
- Каталог «Волейбол в {город}»
- Гео-тексты для ИИ-поиска

## Критерии приёмки

- [ ] noindex-страница отсутствует в sitemap и каталоге
- [ ] Lighthouse SEO ≥ 95

## Зависимости

**Нужно до начала:** [W-13](../03-organizer-web/W-13-group-page-builder.md) Страница группы · конструктор, [P-07](../01-platform/P-07-join-mode-invites.md) Режим записи и приглашения

**Ждут эту задачу:** [R-06](../04-root-admin/R-06-group-page-moderation.md) Модерация страниц групп

## Общий функционал

- **Режим записи и приглашения** — Настройка группы по умолчанию → событие → Mini App и бот. С этим связаны: [P-07](../01-platform/P-07-join-mode-invites.md), [W-11](../03-organizer-web/W-11-settings.md), [W-04](../03-organizer-web/W-04-event-create.md), [M-23](../02-mini-app/M-23-org-event-create.md), [M-08](../02-mini-app/M-08-invite-booking.md), [P-16](../01-platform/P-16-telegram-bot.md). [Подробнее](../links.md#invite)
- **Страница группы** — Конструктор организатора, рендер и модерация root. С этим связаны: [W-13](../03-organizer-web/W-13-group-page-builder.md), [R-06](../04-root-admin/R-06-group-page-moderation.md), [P-02](../01-platform/P-02-group-settings.md). [Подробнее](../links.md#seo)
