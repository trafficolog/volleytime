---
id: '8.11.2'
phase: '8'
epic: '8.11'
status: done
release: 'v0.1.7'
last_reviewed: 2026-10-05
status_note: 'PR85 и I2/M3/M7 corrections приняты PR88; N1 separately accepted PR90/main003968944, head/main CI37293801825/37294307936 all4SUCCESS. Final source22c0850 and targeted Chrome100/native200 accepted; M8 broad harness/M9 tooling deferred, E2 provenance retained. Production/Telegram/pilot отдельно в9.8.11.'
roles: [FE, QA]
depends_on: ['5.16.2']
tags: [mvp, split, miniapp, player, landing]
---

# Task 8.11.2: прогноз и персональная сумма игрока

## Цель

Игрок записывается в split-событие и видит актуальный прогноз до закрытия и свой точный долг после него.

## Контекст

[R0.7 spec](../superpowers/specs/2026-10-01-event-split-pricing-design.md), references/screens-player.jsx. Полная анонимная event page/QR/share-link остаётся отдельной будущей задачей; действующие roster/deep links входят в эту.

## Что должно быть сделано

1. EventCard, player Home, список событий, event page, booking confirmation и «Мои записи» используют общий согласованный pricing view.
2. До фиксации знак ≈, текущий taken или ясно подписанный full-capacity прогноз при N0; pending без paymentId не называется бесплатным/оплаченным.
3. Cash/transfer рабочие; абонемент недоступен для split независимо от настроек организации и личного остатка. Waitlist не получает начисление до повышения/фиксации.
4. После расчёта показать именно личную allocatedAmount/payment status; убрать самостоятельную отмену по серверному правилу, не скрывать сохранённый итог при дальнейших статусах.
5. Read models/privacy/error/loading/stale org/route сохраняются. Landing может вернуть применимые реальные split-блоки/FAQ исходника только после готовности потока.
6. Уточнение 2026-10-02: существующий dashboard GET дополнительно проецирует EventPricingView через readEventPricing и валюту собственных записей. Это устраняет отсутствующий контракт Home без дополнительных клиентских запросов; ограничения выборки, membership и own-only сохраняются. Новые endpoints и изменения финансовых/domain services не требуются.
7. Уточнение 2026-10-02: «Мои записи» сохраняют отменённую split-бронь с уже выделенной личной долей, чтобы показать исходный итог и последующий статус оплаты/возврата. Прежняя фильтрация отменённых fixed и нерассчитанных броней сохраняется; существующий GET уже возвращает эти строки.
8. Уточнение QA provenance 2026-10-02: ручной локальный запуск для browser acceptance сверяет ожидаемый HEAD с текущим и детерминированный SHA256 всего дерева `apps/web/.output` (относительные пути и хеш каждого файла, ordinal-порядок). Отсутствующие, новые, изменённые файлы и небезопасные пути блокируют запуск до настройки окружения/логов. Сборочные junction-ссылки допускаются только на реальные цели внутри дерева: записывается их путь цели без перехода по ссылке, а содержимое цели хешируется на физическом пути. Это проверка исходников и сборки, а не browser/Telegram acceptance.
9. Уточнение review 2026-10-02: подтверждение самостоятельной отмены в «Моих записях» привязано к полному маршруту и жизни компонента; после подтверждения повторно проверяется актуальная запись и право отмены. Смена query/hash прерывает ожидающее подтверждение, но не отменяет уже отправленный POST в том же представлении: кнопка остаётся занятой, а при позднем отказе сервера состояние перечитывается. При уходе с представления, смене группы/фильтра или unmount старые callback-и не обновляют страницу. Для settled waitlist без собственной выделенной суммы не показывать объяснение «доля зафиксирована» — использовать причину дедлайна или закрытия события.
10. Уточнение inherited landing review 2026-10-03: конфликт тёмного предка с белыми поверхностями существовал в базе Task5 и исправляется в рамках применимой theme-приёмки этой задачи. `landing.css` локально закрепляет потребляемую reference-light palette, включая focus, статусные пары, ledger и inverse roster. DOM/CSSOM-тесты проверяют light, `html.dark`, `html.vt-dark`, `.dark`/`.vt-dark` на промежуточном предке и сохранение тёмных токенов вне landing. Это source/unit evidence; актуальная сборка, Chrome после reveal, независимое review и CI ещё обязательны.

## Критерии приёмки

Latest acceptance 2026-10-05: I2 canonical/lifetime protection и M3/M7 приняты в PR88, trailing-spelling N1 — отдельной8.11.3/PR90. [Final provenance](../operations/qa/2026-10-05-r07-final-code-checkpoint.md) связывает accepted exact source, local visual/native200 supplements и CI; historical open checkpoint ниже superseded. M8 broad mounted harness остаётся deferred; isolated actual event-consumer suite принят. Real Telegram asynchronous confirmation/delivery остаётся9.8.11.

- Integrated review checkpoint 2026-10-04 (Task9.8.11 combined fix wave): I2 — actual event page получает full-route/lifetime confirmation guard и latest booking/canCancel/submitting recheck; уже отправленный booking/cancel POST сохраняет busy/result/refusal refresh на same-view query/hash, leave/unmount запрещает stale writes. Named isolated event-consumer regression suite: held POST, late409, duplicates, confirmation query/hash/unmount/leave-return/latest cannotCancel. M3 — concise one-cent explanation без payable forecast; M7 — cancelled empty roster не приглашает записаться. M8 broad shared-harness reorganization deferred. Историческое принятие PR85 не закрывает новый regression checkpoint; новые gates/re-review/targeted Chrome открыты.

- Уточнение browser QA 2026-10-03: исправить унаследованный конфликт palette лендинга с `.dark`/`.vt-dark`. Лендинг сохраняет принятый светлый референс и его точные цвета/шрифты независимо от темы приложения: локально согласовать используемые foreground/background токены, не менять глобальные токены, `html.dark`, геометрию, анимации или содержимое. Белые поверхности не получают светлый текст, тёмный декоративный блок не становится белым. Подтвердить RED→GREEN и Chrome320/390/1280 после окончания reveal; ограничения исходного оранжевого не пересматривать.

- Уточнение review 2026-10-03: settled split waitlist без собственной суммы явно сообщает, что начисления нет и переход в состав после закрытия недоступен. Не обещать будущую долю для уже рассчитанного события; для ещё открытого события сохранить пояснение о переходе и последующем расчёте. Проверить общий helper и его отображение на event, Home и «Моих записях».

- RED→GREEN проверяет N0, forecast при смене состава, 100/3 персональную копейку, waitlist, server refusal subscription и отказ self cancel после фиксации.
- Browser320/390 light/dark с реальным локальным API доказывает запись→прогноз→закрытие организатором→личный итог, error/retry и deep link. Fixed/free/subscription regressions проходят.
- Нет false paid в public roster, не раскрыты чужие платежи; пять gates и review проходят. Telegram доставка проверяется 9.8.11.

## Подсказки

Использовать настоящий event/booking/payment response; price===0 перед проверкой mode является ошибкой. Лендинг не должен обещать multi-seat или автоматическое закрытие.

## Не делать

Не платить приблизительную сумму, не добавлять отдельную анонимную event page, multi-seat, online payment, будущие reminders/credits или realtime transport.
