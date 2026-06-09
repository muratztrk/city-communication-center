# Trello "Doing" list — implementation tracking

Board: https://trello.com/b/4kvG8aa5 · List: Doing (`69ef9d96d58778f5f9f53ff7`)
Polling every ~5 min this session. Commit + push to main after each card.

## Done
- [x] `6a265aaf` — "Görev Tipi" column in Görevlerim grid (matched Personelimin Görevleri). Pushed.
- [x] `6a265b44` — Gittiği Yer destination pills uniform green (was tinted by approval status). Pushed. Moved to Done.
- [x] `6a265c3e` — Creator can cancel own job (CancelJobCommand isCreator) + cascade non-terminal tasks to Cancelled; İptal button in Taleplerim. Pushed. Moved to Done.
- [x] `6a265d9b` — Auto-approved create now assigns JobNumber (was "Onay Bekleyen" in approved list); İade hidden for manager's own InternalUnit in Taleplerim. Pushed. Moved to Done.
- [x] `6a265ea9` — Manager Birim Dışı number fix: SAME root cause as 6a265d9b, resolved by that commit (JobNumber assigned at creation for all !requiresOwnerApproval). No new code. Moved to Done.
- [x] `6a266007` — Shared DueDatePill (yellow=last day, red=overdue) in Jobs/Tasks/IncomingRequests Son Tarih columns; CSS in globals.css. Pushed. Moved to Done.
- [x] `6a26624e` — Shared DateCell (calendar icon + date) on all date columns in Jobs/Tasks/IncomingRequests grids. Pushed. Moved to Done.
- [x] `6a26631b` — Onay/Tamamlanma/İptal-İade date columns → FilterableTh (sort+filter) in Jobs/Tasks/IncomingRequests; flattened ownerDecidedAtUtc for sort. Pushed. Moved to Done.
- [x] `6a2665f4` — 401 in ensureOk → clearAuthSession + SESSION_EXPIRED_EVENT → drop to login; AuthContext storage listener auto-logs-out other tabs. Pushed. Moved to Done.
- [x] `6a26673e` — İade shown only for managers (non-internal); standard user gets İptal only. Pushed. Moved to Done.
- [x] `6a2669a1` — Dashboard: added outgoingInProgressCount box after outgoing-pending (BE GetDashboardQuery + contract + FE type + i18n); pending tightened to approval-only. Pushed. Moved to Done.
- [x] `6a266a85` — Dashboard chart section md:grid-cols-2 lg:grid-cols-3 (was lg:grid-cols-2). Pushed. Moved to Done.
- [x] `6a266b79` — Removed pending-approval scope from /jobs (chips + default→department-pool); ?scope=pending-approval redirects to /incoming-requests. Pushed. Moved to Done.
- [x] `6a266bd3` — Renamed dashboard label → "Birime Gelen Onay Bekleyen Talepler" (tr/en) + repointed link to /incoming-requests. Pushed. Moved to Done.
- [x] `6a2687a6` — Removed active-department filter from "mine" scope in JobQueries so multi-dept user sees all own requests in Taleplerim. Pushed. Moved to Done.

- [x] `6a26885e` — Internal owner dropdown lists all active dept staff (incl. self) for managers; non-managers keep pool+self. Pushed. Moved to Done.

## Done (round 2 — new cards)
- [x] `6a27ba60` — After create, navigate(-1) to previous page instead of fixed list/dashboard; kind switches use replace. Pushed. Moved to Done.
- [x] `6a27bb7c` — Removed İade Et button entirely from Taleplerim (creator can only İptal) + deleted dead return modal. SUPERSEDES card 10. Pushed. Moved to Done.
- [x] `6a265d9b` (reopened) — Görevlerim button: İptal/İade + return choice only for ExternalUnit tasks; internal/routine → İptal-only (drives label + skipChoose by jobRequestType, not role). Pushed. Moved to Done.
- [x] `6a27c07f` — Routine task: apply tenant default SLA to compute due date when none given (job + task); was "Belirsiz". Pushed. Moved to Done.
- [x] `6a27c24d` — Birime Gelen Talepler: added title search + year filter in scope-chips bar (mirrors Taleplerim). Pushed. Moved to Done.

## Round 3
- [x] `6a27db3a` — External create form title label "İş Başlığı" → "Talep Başlığı" (uses tasks.newRequest.title). Pushed. Moved to Done.
- [x] `6a27d915` — Manager internal request: owner field = required multi-select "Personel seçiniz" (was single pool dropdown). Pushed. Moved to Done.
- [x] `6a27dab1` — Internal form: red * on Talep Başlığı + Açıklama labels (Görev Sahibi already * for managers). Pushed. Moved to Done.
- [x] `6a27ba60` (reopened) — Reverted kind-switch to push (Geri → /requests/new not dashboard); submit now navigates explicitly to /requests/new. Pushed. Moved to Done.
- [x] `6a27c22a` — Manager Taleplerim: replaced Bekleyen+Onaylanmış with single "Yapılmakta Olan Taleplerim" (pending+active); non-managers unchanged. Pushed. Moved to Done.
- [x] `6a27c123` — Added "Son Tarihi Geçmiş Görevlerim" overdue chip (orange) to My Tasks + Dept Tasks, after İptal/İade; filters active past-due tasks. Pushed. Moved to Done.
- [x] `6a27ea8d` — Merged dashboard managerRow1+managerRow2 into one grid so Vatandaş Talepleri sits beside Birimde Bekleyen Görevler (no 3rd-row overflow). Pushed. Moved to Done.
- [x] `6a27ed5e` — Description editor font 18px→16px (base 15px→13px). Pushed. Moved to Done.

## Round 4 (drained back-to-back)
- [x] `6a265d9b` (reopened #3) — Removed duplicate İptal in Taleplerim: scoped manager approve/cancel buttons to jobs view only. Pushed. Moved to Done.
- [x] `6a27f408` — Routine task "Görevin Talep Yeri" column shows creator (not dept). Pushed. Moved to Done.
- [x] `6a27fef4` — Görevlerim: green "Tamamla" button next to Detaylar → completeTask → Completed; job auto-recomputes to Tamamlanmış Talepler. Pushed. Moved to Done.
- [x] `6a27ff91` — Department Tasks overdue chip label → "Son Tarihi Geçmiş Görevler" (non-possessive, departmentViews.overdue). Pushed. Moved to Done.

## Round 5
- [x] `6a243164` — Shrink login page logo only (desktop seal h-20/w-52→h-16/w-40; compact h-48→h-36). Pushed. Moved to Done.
- [x] `6a2687a6` (reopened) — Taleplerim now separates by active department for multi-dept users (mine scope filters OwnerDepartmentId == activeDept; all when none). REVERSES card-15 no-filter approach. Pushed. Moved to Done.

- [x] `6a280332` — Moved overdue chip to 2nd position (after pending) in My Tasks + Dept Tasks. Pushed. Moved to Done.

## Round 6
- [x] `6a280836` — Task grids: priority shown (colored) under Görev No; removed Öncelik column. Pushed. Moved to Done.
- [x] `6a2809cd` — Merged task grid "Görevin Talep Yeri" + "Oluşturan" into "Görevin Talep Yeri/Oluşturan" (dept top, creator below). Pushed. Moved to Done.

## STATUS: Doing list empty — queue fully drained (all rounds complete).
