# CI/CD: первое продвижение и защита веток, 2026-10-13

> Задача [9.8.17](../../tasks/9-8-17-gated-prod-promotion.md). Evidence наблюдений агента-оркестратора; приёмка владельцем — его сообщениями в сессии.

| Шаг                            | Результат                                                                                                                                                                           |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PR #97 (9.8.17) и #98 (19.0.1) | независимое ревью Opus: `merge`; CI head #97 `c4820c9` — 4/4 success; смержены владельцем                                                                                           |
| main CI на `b056806`           | [38316837466](https://github.com/trafficolog/volleytime/actions/runs/38316837466) success                                                                                           |
| Продвижение                    | диапазон `e68acf2..b056806` меняет `.github/workflows/`, поэтому по решению владельца — ручной reviewed fast-forward `git push origin b056806:prod`                                 |
| Deploy                         | [38317488959](https://github.com/trafficolog/volleytime/actions/runs/38317488959) success: source gate, тесты, image-bundle, backup, migrate, smoke; job в environment `production` |
| Health                         | `https://volleytime.by/api/health` → `status ok, db ok, auth ok, release b056806636d89516858b4281f0d4c33748f84cd6`                                                                  |
| Promote (no-op)                | [38318437096](https://github.com/trafficolog/volleytime/actions/runs/38318437096): проверка SHA/CI/ancestry success, push и dispatch пропущены (`prod == SHA`)                      |
| Защита веток                   | применена с согласия владельца: `main` — 4 обязательные проверки, PR, `enforce_admins=true`, `strict=false`, без force-push; `prod` — без force-push и удаления                     |

Не проверено вживую: продвижение с реальным fast-forward через Promote без изменений workflow и путь с `PROMOTE_TOKEN` — подтвердятся на следующем релизе.
