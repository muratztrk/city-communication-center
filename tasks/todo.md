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

## Round 7
- [x] `6a287c20` (reopened) — Moved Birime Gelen search+date filters onto banner header (green styling, date text matches "Ara"). Pushed. Moved to Done.
- [x] `6a287d30` (reopened) — Center only the title (flex-1 text-center); reverted logo-row + subtitle centering. Pushed. Moved to Done.
- [x] `6a2880c7` — Dashboard: "(Birim İçi/Birim Dışı)" moved to 2nd line (metric sublabel) under Bekleyen Taleplerim/Görevlerim. Pushed. Moved to Done.
- [x] `6a287d30` — Login hero title+logo row and subtitle centered in layout. Pushed. Moved to Done.
- [x] `6a287c20` — Banner date picker: CalendarClock icon (matches grid); placeholder text + icon colored like search "Ara". Pushed. Moved to Done.
- [x] `6a287af7` — Priority under Talep/Görev No prefixed with "Öncelik:" across Jobs/Tasks/Incoming/Wallboard. Pushed. Moved to Done.
- [x] `6a287409` — Dashboard "Bekleyen Görevlerim (İçi/Dışı)" → "(Birim İçi/Birim Dışı)" (tr/en). Pushed. Moved to Done.
- [x] `6a287787` — Login hero title font-extrabold → font-semibold. Pushed. Moved to Done.
- [x] `6a286ad0` (reopened) — Removed chip-bar scroll; moved search+date onto banner (header) for Jobs/Tasks with green-harmonized translucent styling. Pushed. Moved to Done.
- [x] `6a286269` (reopened#?) — Portaled DateTimePicker dropdown to body (overflow chip bar was clipping it → opened at page bottom); now opens below input. Pushed. Moved to Done.
- [x] `6a28639b` (reopened#2) — Login logo frame transparent/borderless (was white box) to blend with green hero. Pushed. Moved to Done.
- [x] `6a286ad0` — scope-chips bar single-line (nowrap + overflow-x) so search/date no longer wrap down; compact .scope-chip-date pickers. Pushed. Moved to Done.
- [x] `6a286269` (reopened) — DateTimePicker forceDown prop; filter calendars always open downward. Pushed. Moved to Done.
- [x] `6a2869ac` — Moved Taleplerim/Görevlerim search+date back to chip nav (out of banner); narrowed search width 9rem→6rem. Pushed. Moved to Done.
- [x] `6a28639b` (reopened) — Force official logo on login (was overridden by tenant appearance.logoUrl); always uses tire-belediyesi-logo.png. Pushed. Moved to Done.
- [x] `6a286269` (reopened) — Banner date filter now uses shared DateTimePicker (same calendar as Talep Oluştur), from–to range; date-part compare. Pushed. Moved to Done.
- [x] `6a2860ff` — Removed "Gittiği Yer" (assignedDepartment) column from task grids (My/Dept/Staff). Pushed. Moved to Done.
- [x] `6a28639b` — Login logo replaced with official Tire Belediyesi logo (public/tire-belediyesi-logo.png); white backdrop on hero, scaled to slot. Pushed. Moved to Done.
- [x] `6a2865b7` — Cancel confirm dialog button → "İptali Onayla" (Jobs + Incoming). Pushed. Moved to Done.
- [x] `6a286269` — Date-range filter (from–to, two calendar inputs, no time) in banner across Jobs/Tasks/Incoming. NOTE: single-calendar range UX approximated with two date inputs. Pushed. Moved to Done.
- [x] `6a285de9` — Fixed: opening another tab no longer logs out. Cross-tab logout now via dedicated LOGOUT_BROADCAST_KEY (real logout only), not storage churn. Reconciles 6a2665f4. Pushed. Moved to Done.
- [x] `6a285f17` — Birimden Giden (pending): Onayla button for managers → approveJobOwner → activates & drops to target dept incoming pool. Pushed. Moved to Done.
- [x] `6a285f8d` — Date column filter inputs (…Utc keys) accept only digits + . : space (FilterableTh sanitize). Pushed. Moved to Done.
- [x] `6a285c46` — Taleplerim/Görevlerim: removed banner create button, moved search+date filter into banner bottom-right; year select → calendar date input "Tarih seçimi". Pushed. Moved to Done.
- [x] `6a285317` (reopened) — Grids keep headers on empty filter: render table always + empty message as tbody row (Jobs/Tasks/Incoming). Pushed. Moved to Done.
- [x] `6a285897` — Wallboard title "Bekleyen İşler"→"Bekleyen Görevler" + subtitle işler→görevler (tr/en). Pushed. Moved to Done.
- [x] `6a285783` — Reduced dashboard metric card height (py-2, value text-2xl, icon size-9). Pushed. Moved to Done.
- [x] `6a2853f6` — Centered all wallboard column data (header+cells); creator name under dept centered too. Pushed. Moved to Done.
- [x] `6a285317` — Restored filter+sort on Talep No (Jobs/Incoming) & Görev No (Tasks) via FilterableTh + accessors. Pushed. Moved to Done.
- [x] `6a285152` — Scaled down login hero (padding/title/subtitle/logo/feature cards) to fix zoomed/shifted look. Pushed. Moved to Done.
- [x] `6a285240` — Centered İşlemler action buttons in Birime Gelen Talepler (flex justify-center). Pushed. Moved to Done.
- [x] `6a280f01` — Wallboard: merged "Görevin Talep Yeri" + "Talebi Oluşturan" into "Görevin Talep Yeri/Oluşturan" (dept top, creator below). Pushed. Moved to Done.
- [x] `6a280ebb` (reopened) — Centered İşlemler action buttons (.request-actions justify-center) + Gittiği Yer destination pills (renderOutgoingDestination). Pushed. Moved to Done.
- [x] `6a2813e0` (reopened) — Login hero: per-card nested frames (separate outer frames) instead of one shared outer frame. Pushed. Moved to Done.
- [x] `6a281b50` — Priority shown (colored) under Talep No + removed Öncelik column in Taleplerim/Birime Gelen/Birimden Gelen (JobsPage + IncomingRequestsPage). Pushed. Moved to Done.
- [x] `6a2813e0` — Login hero: wrapped the two feature cards in an outer bordered/rounded frame (nested look). Pushed. Moved to Done.
- [x] `6a280ebb` — All gridview headers + cells center-aligned (data-table th/td text-align center; FilterableTh content centered). Pushed. Moved to Done.
- [x] `6a280dc9` — Narrowed "Görevin Talep Yeri/Oluşturan" cell (max-w-11rem, truncate) and centered dept + creator lines. Pushed. Moved to Done.
- [x] `6a280836` (extended) — Applied priority-under-Görev-No + removed Öncelik column to the Ekrana Yansıt wallboard too. Pushed. Moved to Done.

## Round 8 (new cards, Jun 10)
- [x] `ykH6nKxa` — Banner date filter text was unreadable: empty-state muted-foreground Tailwind utility (utilities layer) overrode banner white (components layer); forced `.sticky-page-header .scope-chip-date .field-input` color `!important` to match "Ara". Pushed. Moved to Done.
- [ ] `fuMAFjia` — Login: center only "Tire İletişim Merkezi" title in green hero.
- [x] `YlC2hK7H` — Wallboard: removed Talep No (jobNumber) column header + cell. Pushed. Moved to Done.
- [x] `pcK6CiqA` — MultiSelectDropdown: added green "Seç" button (bottom-right footer) that closes the dropdown; applies to manager owner picker. Pushed. Moved to Done.
- [x] `z9PpTlId` — Dept Tasks: added "Görev Tipi" column (header+cell now include isDepartmentTasksView, after Başlık). Pushed. Moved to Done.
- [x] `Zm3d6Xu9` — Banner search now scans all columns (number/priority/dates/dept/creator/status/type), not just Başlık, in Jobs/Tasks/Incoming. Incoming reuses extracted getColumnValue accessor. Wallboard has no banner search. Pushed. Moved to Done.
- [x] `uuyCK0cw` — Wallboard default order now createdAtUtc desc (newest first) as primary sort; priority/due-date demoted to tiebreakers. Column-header sort still overrides. Pushed. Moved to Done.
- [x] `4nERM5Az` — Wallboard stats now 4 clickable filter buttons (Toplam Bekleyen/Birim İçi/Birim Dışı/Son Tarihi Geçmiş Görevler), hover+pointer, active highlight, default 'total'; filters the list. Added overdue count + wallboard.overdue i18n (tr/en). Pushed. Moved to Done.
- [x] `ydzQ2PI7` — Internal request "Gittiği Yer" now shows owner dept + assigned staff name below. Added optional AssignedUserDisplayName to JobSummaryResponse (populated in JobQueries list from job tasks' AssignedUserId), FE type + renderOutgoingDestination. Pushed. Moved to Done.
- [ ] `zKMGZt6C` — Birime Gelen: rename "Oluşturan" column → "Talep Yeri/Oluşturan".

## STATUS: Round 8 in progress — 1/10 done.
