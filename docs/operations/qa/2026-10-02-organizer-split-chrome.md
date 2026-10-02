# Task 5.16.2 — Chrome local QA, 2026-10-02

Product revision: `cad35c35ea7ff0220005b966045d02f743591d72`. Separate user-authorized headed Chrome session `task4-chrome`, isolated local PostgreSQL `volleytime_split_ui_qa`, normal user email login. Health200 db/auth ok at14:10:20UTC. No production, Telegram delivery or pilot acceptance is asserted.

## Observed results

| Check               | Actual browser/API evidence                                                                                                                                                                                                                                                                           |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Native cancel       | Desktop empty event2 and populated event4; Mini event5. Cancel does not settle. Empty event2 request inventory contained no POST before acceptance.                                                                                                                                                   |
| Native confirm      | Event4 actual POST200 closes120BYN/3 participants,40BYN each, pending120BYN; Mini event5 POST200 closes100BYN/3, range33.33–33.34BYN, pending100BYN. Actual GET reloads and three waiting-payment rows observed.                                                                                      |
| Empty roster        | Native confirmation on event2 returns409 `Add participants before settling`; event remains open with actionable alert and GET retry.                                                                                                                                                                  |
| Save                | Desktop event2 PATCH200 with split target11000/price0; Mini PATCH200 restores target10000/price0. Both return to their actual manager route. No fixture recreation or financial SQL writes.                                                                                                           |
| Validation          | Desktop target0 produces invalid focused input and amount alert; request inventory has no PATCH.                                                                                                                                                                                                      |
| Keyboard            | Actual ArrowRight/ArrowLeft switch native radios at320/390/1280. Focus-visible solid outline,20px radio. Unsaved fixed15 / split111 values survive switching; these keyboard probes are not submitted.                                                                                                |
| Loading/error/retry | Abort only event2 GET on desktop edit → actual ErrorState. Remove abort, click retry while holding the next actual GET → skeleton, zero form radios. Release original request → real API restores target100. No fabricated API response; all routes released in finally.                              |
| Visual              | Twelve real-API form/settled screenshots atMini320/390 and desktop1280 light/dark captured and inspected. All document widths <= viewport widths. Dark uses explicit `.dark` application token simulation, not Telegram theme events.                                                                 |
| Native200%          | Chrome Appearance Page Zoom actual200% selected;1280x900 reflows to640x450 CSS pixels/DPR2/visualViewport.scale1. Both new radios and amount controls fit; no horizontal overflow. Actual desktop compositor frame subsequently inspected with both full labels, target100 and forecast25BYN visible. |

## Native screenshot limitation and resolution

Initial Playwright screenshot artifacts at200% showed incorrect vertical position; an actual compositor capture also clipped the right side. Read-only `Browser.getWindowForTarget` reported physical window945px, narrower than the virtual1280px area. Enlarging only this dedicated QA window to1310px and capturing `Page.captureScreenshot` with `fromSurface:false` produced a complete frame, visually inspected inline by the controller. Width remained640CSS, DPR2, document632CSS. This is real Chrome zoom, not pinch, CSS zoom or DPR emulation.

That successful native frame is an inline tool artifact, not a persisted PNG. Follow-up file-export helper stalled and was stopped by exact helper PID; its capture-only descendants were identified by exact session/filename and stopped. Neither the QA server nor Chrome was terminated. Do not use the earlier clipped200% PNGs as acceptance evidence. Chrome setting was returned to100% through the same native control at14:19:22UTC.

## Artifact and verification boundaries

Дополнительный narrow-save выполнен на Mini320 и390: оба реальных PATCH200 передали targetAmount10000 и вернули `/m/orgs/1/events/2/manage`. Сырой CLI-result сохранён в `output/playwright/task4-chrome/mini-narrow-save-result.log`; процедура — `mini-narrow-save-code.txt`.

Focus/desktop GET retry повторён с сохранением сырого `focus-retry-result.log`:320/390/1280 focus-visible solid20px, значения15/111 сохранены; pendingFormCount0, восстановленный target100. Исходные abort/hold освобождены; никакого settlement или изменения финансовых записей.

Предыдущая дополнительная процедура `mini-narrow-save-retry-code.txt` завершилась тайм-аутом ожидания «Повторить»: Mini edit error state явно использует `:retry="false"` для organization/event GET. Это не подтверждение Mini edit retry; успешный error/loading/retry выше относится к desktop edit, а guarded settlement retry имеет отдельные mounted/native manager evidence. Сеть после abort освобождена через finally; narrow-save повторён отдельно. Изменения поведения Mini edit retry здесь не выполнялись.

Independent local acceptance supplement: spec PASS, quality PASS с Minor D1 (устаревший верхний checkpoint RELEASES.md), синхронизированным контроллером. Native dialogs/POST counts и успешный inline200% frame остаются явно controller-owned observations; сохранённые нулевые YAML не доказывают их независимо.

Local artifacts: `output/playwright/task4-chrome/` contains form/settled320/390/1280 light/dark PNGs, focus320/390/1280 PNGs, edit error/pending/restored PNGs, snapshots and the reproducible matrix/form-save/focus-retry scripts. Earlier service preparation added three real cash reservations each to existing QA events4/5; UI performed settlement, not preparation script. Event1's earlier unobserved settlement is excluded from native-confirm evidence.

Expected console errors correspond to deliberately aborted event GET and the intentional empty-roster409; no assertion of universally clean historical console logs. Page-local organization-retry I1 is covered by mounted test and scoped source re-review; the browser abort here targets event GET, not an exclusive reproduction of that page-local organization failure. Route/lifecycle/I2 barriers retain their mounted-test evidence rather than being relabelled as browser actions.

Fresh five gates on unchanged product `cad35c35`: lint PASS (12 baseline warnings), typecheck6/6 PASS, PostgreSQL147files/1075tests PASS (548.03s), build2/2 PASS (zero cache), format retry PASS. Initial format failed only on preserved untracked `output/task4-reserve-qa-events.mts`; mechanical Prettier formatting fixed that helper, initial log retained. Earlier source-suite timeout is also retained, not relabelled as PASS. Full logs `output/task4-final-20261002-{format,lint,typecheck,test,build,format-retry}.log` and private owning task report retain execution evidence.

Independent code re-review and local acceptance supplement PASS. Browser evidence does not replace exact-head CI or PR merge, still open. Player/landing Task8.11.2 and rollback/release9.8.11 remain outstanding; prod/VPS/capability/tag unchanged. Post-deploy real Telegram/pilot checks remain mandatory.
