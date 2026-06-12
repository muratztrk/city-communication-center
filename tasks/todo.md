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
- [x] `zKMGZt6C` — Birime Gelen: renamed "Oluşturan" → "Talep Yeri/Oluşturan" (new i18n key tr/en); cell now shows departmentName (top) + creator (below). Pushed. Moved to Done.

## Round 9 (cards arriving during round 8)
- [x] `pcK6CiqA` (reopened) — MultiSelectDropdown now flex-col with max-h-72; only the options list scrolls (flex-1 overflow-y-auto), "Seç" footer pinned at bottom (shrink-0). Pushed. Moved to Done.
- [x] `lUimEurb` — Üst Düzey Yönetici = Reporter role. Reporter landing on /requests/new auto-redirects to ?kind=external (skips type selection); external form title/desc swapped to neutral "Talep Oluştur" wording (reporterFormTitle/Description i18n tr+en) so "Birim Dışı" is hidden for them. Pushed. Moved to Done.

- [x] `Zm3d6Xu9` (reopened) — Banner search now covers date columns too: Jobs added owner-decided/completed/updated dates, Tasks added completed/updated dates (Incoming already had all). Same formatDateTime as displayed cells. Pushed. Moved to Done.

- [x] `4nERM5Az` (reopened) — Wallboard stat buttons: changed yellow (#fef08a) numbers + active border/tint to priority orange #f97316 (text-orange-500, same as Görev No priority text). Confirmed via card image. Pushed. Moved to Done.

## STATUS: Round 9 complete — Doing list drained.

## Round 10 (cards arriving during round 9 polling)
- [x] `XLzwexhd` — MultiSelectDropdown: added red "Çıkış" button left of "Seç"; both close the dropdown (Çıkış = exit without picking). Pushed. Moved to Done.
- [x] `Zm3d6Xu9` (reopened #2) — Added missing 'departmentName' (Talep Yeri) to Birime Gelen SEARCH_COLUMN_KEYS so request-location is searchable. Jobs/Tasks/Incoming already cover number/title/status/priority/dept/creator/type + all date columns. Pushed. Moved to Done.
- [x] `mr3mhNbq` — Login hero: increased section vertical padding (lg:py-6→py-10, 2xl:py-9→py-14) for more top/bottom spacing per arrows. Pushed. Moved to Done.
- [x] `4nERM5Az` (reopened #2) — Lightened wallboard stat numbers + active border/tint orange #f97316→#fb923c (orange-400). Pushed. Moved to Done.

## STATUS: Round 10 complete — Doing list drained.

## Round 11
- [x] `iInXSSPd` — Sidebar nav.departments "Müdürlükler"→"Departmanlar"; rebranded departments.* page strings Müdürlük(ler)→Departman(lar) (kept "Müdür"=manager + type-value options); added "Yönetim" (value Administration, existing enum label) to both create/edit type dropdowns. Pushed. Moved to Done.

## Round 12
- [x] `XLzwexhd` (reopened) — Çıkış button red now matches İptal Et: bg-[var(--color-destructive)] + hover:brightness-95 (was bg-red-600). Pushed. Moved to Done.
- [x] `Zm3d6Xu9` (reopened #3, root cause) — Department names under Gittiği Yer/Talep Yeri/Oluşturan weren't searchable because default toLowerCase() turns Turkish "İ" into "i"+combining-dot, breaking includes(). Switched all 3 banner searches (Jobs/Tasks/Incoming) to toLocaleLowerCase('tr') for query+haystack; also added createdByDisplayName/assignedUserDisplayName + all job.departments names to Jobs haystack (Oluşturan column). Pushed. Moved to Done.
- [x] `gQtqAh9g` — Wallboard "Son Tarihi Geçmiş Görevler" button: number white when 0 else red #ef4444; label always red. CSS via .stat-overdue/.is-zero classes. Pushed. Moved to Done.

## STATUS: Round 12 complete — Doing list drained.

## Round 13
- [x] `jgdkgrz4` — Departments İşlemler button "Müdür Ata"→"Yönetici Ata" (departments.assignManager tr + fallbacks); Users grid header + new-user form label "Müdürlük"→"Departman" (users.department tr, shared key). Pushed. Moved to Done.
- [x] `zvlsKa8U` — Allow Üst Düzey Yönetici (Reporter) to create requests: CreateJobCommand role guard now permits RoleCode.Reporter (no owner-dept restriction). Frontend already routes them to external form + lists all depts as owner. Pushed. Moved to Done.
- [x] `whhWlZfI` — Dashboard: hide "Bekleyen Görevlerim" card for Reporter (Üst Düzey Yönetici); staffMetrics omits myPendingTasks when isReporter (Staff/Operator unchanged). Pushed. Moved to Done.
- [x] `Z3zAkoW0` — Wallboard: Toplam Bekleyen/Birim İçi/Birim Dışı numbers turn white when 0 (added is-zero class + general `.is-zero span{color:#fff}`); non-zero stays orange, overdue rules unchanged. Pushed. Moved to Done.

## STATUS: Round 13 complete — Doing list drained.

## Round 14
- [x] `vHn5mTdW` — Reporter's external request now shows in target dept's "Onay Bekleyen Talepler": rows awaiting staff assignment (assignTargetDepartmentId) routed to pending-approval filter (and out of active), full-yellow row via .row-attention (overrides zebra), and Personel Ata list now includes the manager themselves (departmentUsers += current user). FE-only (owner is auto-approved for non-Staff). Pushed. Moved to Done.
- [x] `yyuspqnm` (reopened) — Wallboard table no longer has an inner vertical scroll: removed wallboard-table-shell max-height and set table-scroll overflow-y visible (overflow-x auto kept). Table renders full height, pagination sits right below (page scrolls like Birimdeki Görevler). Pushed. Moved to Done.
- [x] `VcbxO7g2` — Reporter Taleplerim: added "Yapılmakta Olan Taleplerim" chip after "Bekleyen Taleplerim". getMyRequestsView accepts in-progress; chip order [pending,in-progress,completed,rejected,all]; filterMyRequests split for Reporter — pending=Active&taskCount0, in-progress=Active&taskCount>0 (so once target mgr assigns staff/task created it moves to Yapılmakta Olan). Pushed. Moved to Done.

## STATUS: Round 14 complete — Doing list drained.
- [x] `z5IXBmo1` — Login desktop hero logo box height bumped slightly (h-14→h-16, 2xl:h-16→2xl:h-[4.5rem]); widths unchanged. Pushed. Moved to Done.
- [x] `b4NKnv5X` (reopened) — Self-requested-owner flow already implemented in edebad3 (approve-owner popup flags the creator who picked themselves). Aligned label text to card exactly: "(Görevi kendisi yapmak istiyor.)" (added period, tr+en+fallback). Pushed. Moved to Done.
- [x] `vHn5mTdW` (reopened) — Already implemented this session (commit 7928260): assignTargetDepartmentId rows → Onay Bekleyen (not Onaylanmış), full-yellow .row-attention. Verified intact on main; no code change needed. Moved to Done.

## STATUS: Round 14 (extended) complete — Doing list drained.
- [x] `lKLORn9n` (reopened) — Department Tasks grid owner column "Sahip" → "Görev Sahibi" (tasks.columns.owner tr; en "Owner"→"Task Owner"). Pushed. Moved to Done.
- [x] `yyuspqnm` (reopened #2) — Restored bounded wallboard-table-shell (max-height calc(100dvh-18rem)) so the pagination row stays pinned/visible without page-scrolling; table scrolls inside but the right scrollbar is hidden (scrollbar-width:none + webkit display:none). Prior attempt had removed the bound, causing a document scrollbar + pagination below the fold. Pushed. Moved to Done.

## Round 15
- [x] `GGxFLaip` — Yellow incoming row now persists after staff assigned: .row-attention triggers on active external incoming rows (kind external && status Active) instead of only assignTargetDepartmentId (which clears once a task is created). Darkened the yellow #fde68a→#fbbf24 (amber-400, orange-leaning), hover #f59e0b. Pushed. Moved to Done.
- [x] `z5IXBmo1` (reopened) — Increased login hero logo box height more (h-16→h-20, 2xl:h-[4.5rem]→2xl:h-24); widths unchanged. Pushed. Moved to Done.

## STATUS: Round 15 complete — Doing list drained.

## Round 16
- [x] `TcXvxFyf` — Removed "Seçim zorunlu değildir." from the assign/approve staff popup help text (assignStaffHelp tr/en + both inline fallbacks). Pushed. Moved to Done.
- [x] `mr3mhNbq` (reopened) — Increased login hero top/bottom spacing more (lg:py-10→py-16, 2xl:py-14→py-20) per arrow. Pushed. Moved to Done.

## STATUS: Round 16 complete — Doing list drained.

## Round 17
- [x] `z5IXBmo1` (reopened #2) — Login logo height was too tall (h-20/2xl:h-24); reduced to middle ground h-[4.5rem]/2xl:h-20. Pushed. Moved to Done.
- [x] `z5IXBmo1` (reopened #3) — Reverted login logo height to original h-14/2xl:h-16 ("eski haline getir"). Pushed. Moved to Done.

## Round 18
- [x] `YsCh570U` — "Görevin Talep Yeri/Oluşturan" column now shows the request creator (job.CreatedByUserId), not the approver. task.createdByDisplayName was the TASK creator, which for manager-assigned external tasks is the approver. Fixed projection in GetTasksQuery + GetTaskByIdQuery to resolve from the job's creator. Pushed. Moved to Done.

## Round 19
- [x] `gjVHpVxO` — Hide "İade Et" in the İptal/İade popup for Reporter-originated requests. Added CreatedByRoleCode to JobSummaryResponse (populated in JobQueries from creator's RoleCode) + FE JobSummary type + IncomingRequestRow.createdByRoleCode; modal hides İade Et when row.createdByRoleCode === 'Reporter'. Pushed. Moved to Done.

## STATUS: Round 19 complete — Doing list drained.
- [x] `GGxFLaip` (reopened) — On yellow attention rows, priority text under Talep No was unreadable (priority color near amber bg); now dark + extrabold (text-slate-900 font-extrabold) on those rows, priority color kept elsewhere. Pushed. Moved to Done.

## Round 20
- [x] `GGxFLaip` (reopened #2) — Priority text on yellow incoming rows changed from black to white (text-slate-900→text-white, font-extrabold). Pushed. Moved to Done.
- [x] `CSxXwjKS` — Target dept manager can now cancel an active Reporter request: CancelJobCommand isTargetManager now allows JobStatus.Active (was only PendingExternalApproval), removing the false "İş iptal yetkiniz yok." Pushed. Moved to Done.
- [x] `Zak5yDHj` — Login hero: removed content grid's extra top padding (pt-2 2xl:pt-4) so the gap above "Tire İletişim Merkezi" equals the gap below the footer note box (symmetric py). Pushed. Moved to Done.

## STATUS: Round 20 complete — Doing list drained.

## Round 21
- [x] `yyuspqnm` (reopened #3) — Made wallboard a fixed-height flex column (height:100dvh, overflow hidden); hero+stats flex-shrink:0; table-shell flex:1 1 auto min-height:0 (was hardcoded max-height calc(100dvh-18rem) which mismatched header+stats height and caused a document scrollbar). Table scrolls internally with hidden scrollbar; pagination pinned at bottom. Pushed. Moved to Done.

## Round 22
- [x] `lSO8pWbJ` — Reporter-originated request in Onay Bekleyen: İşlemler button label is "Onayla" instead of "Personel Ata" (same assign action); other active external rows keep "Personel Ata". Pushed. Moved to Done.
- [x] `iLOr9Q5y` — Yellow incoming row priority text now colour-coded by level: Çok Yüksek/Critical = standard red (text-red-600), Yüksek = light red (text-red-400), others white. Added attentionPriorityColorClass helper. Pushed. Moved to Done.

## STATUS: Round 22 complete — Doing list drained.

## Round 23
- [x] `yyuspqnm` (reopened #4) — Reversed: now show the standard app scrollbar on the wallboard grid. Removed scrollbar-hiding (scrollbar-width:none + webkit display:none) so the global *::-webkit-scrollbar style applies; fixed-height layout (pinned pagination + internal scroll) kept. Pushed. Moved to Done.

## Round 24
- [x] `iLOr9Q5y` (reopened) — High-priority light red was too light (red-400) on yellow rows; darkened to red-500 (still distinct from VeryHigh red-600). Pushed. Moved to Done.

## Round 25
- [x] `L2NCcB6x` — Removed "Düşük" (Low) option from Rutin Görev Oluştur priority dropdown. Pushed. Moved to Done.
- [x] `at3oWVCQ` — Updated Talep Oluştur kind descriptions: internal→"Kendi biriminizde birim içi talep sürecini oluşturun.", external→"Başka bir birime gidecek talep sürecini oluşturun." (tr locale + fallbacks). Pushed. Moved to Done.
- [x] `q12UV1ZH` — Son Tarih DueDatePill empty value now "Onay Bekleyen" (was "Belirsiz"). Pushed. Moved to Done.
- [x] `TwGPN6Jv` — Görev Tipi pill: green (success) tone on "Rutin", neutral on "Atanmış". Pushed. Moved to Done.
- [x] `f9lbGfbT` — Reduced wallboard stat button height ~30% (padding 0.85→0.55rem, number font clamp ~2.4rem max, smaller label) to free vertical space for 10 rows. Pushed. Moved to Done.
- [x] `Zg7XTWZx` — Warning (last-day) DueDatePill now solid yellow #facc15/border #eab308/text #422006 matching the "Onaylanmış Talepler" chip (was pale cream). Pushed. Moved to Done.
- [x] `ZsEvcCnJ` — Unified cancel buttons to "İptal/İade" in Görevlerim (TasksPage now always shows choose step) + Birime Gelen. İade option shown but passive (opacity/cursor + onClick guard, pointer-events kept) with "İade yapılamaz" hover tooltip when not returnable: TasksPage internal/routine (canReturn false), Incoming Reporter rows (supersedes gjVHpVxO hide→disable). Pushed. Moved to Done.
- [x] `pBpL8KSA` — Staff Görevlerim: tasks from Reporter requests now render a full-yellow (.row-attention) row and the İptal/İade button is passive (opacity/cursor + onClick guard + "İptal yetkiniz yok" tooltip) since staff can't cancel them. Added CreatedByRoleCode (job creator role) to TaskSummaryResponse + GetTasksQuery + FE Task type. Pushed. Moved to Done.

## STATUS: Round 25 complete — Doing list drained (8 cards).

## Round 26
- [x] `Vy58VVgv` — Follow-up to pBpL8KSA (G-2026-43 not yellow). Verified code is correct & on main: GetTasksQuery populates TaskSummaryResponse.CreatedByRoleCode from the job creator's RoleCode (same pattern as working gjVHpVxO on JobSummary), FE row applies .row-attention when createdByRoleCode==='Reporter'. Root cause: the round-25 backend change (TaskSummaryResponse field) requires the API to be rebuilt/restarted; the older incoming-list Reporter features work off an earlier deploy. No code change needed. Moved to Done — needs `docker-compose up -d --build api` (or dotnet restart) to take effect.
- [x] `Zr0yIf3d` — Clarifies pBpL8KSA: grid İptal/İade button now opens the popup (reverted grid-button disable), and inside the popup the "Görevi İptal Et" + İade options are passive (opacity/cursor + onClick guard + "İptal/İade yetkiniz yok" tooltip) for Reporter-originated tasks. Yellow row kept. (Depends on round-25 TaskSummary.createdByRoleCode → needs API rebuild.) Pushed. Moved to Done.

## STATUS: Round 26 complete — Doing list drained.

## Round 27
- [x] `TwGPN6Jv` (reopened) — Reversed: green (success) tone now on "Atanmış", neutral on "Rutin". Pushed. Moved to Done.
- [x] `Zg7XTWZx` (reopened) — Warning date pill now amber #fbbf24/border #f59e0b matching the wallboard Son Tarih yellow (was chip #facc15). Pushed. Moved to Done.
- [x] `taOkj8Gu` — İptal/İade not passive when a manager assigned the Reporter task to themselves: isReporterTask now `createdByRoleCode==='Reporter' && !isManagerLike`, so managers keep cancel/return; only staff are restricted. Pushed. Moved to Done.

## STATUS: Round 27 complete — Doing list drained.

## Round 28 (manual check after stop request)
- [x] `QGCJLtWm` — "Görevi Yönlendir" (task-route-button) forced light-blue with !important (Button primary variant's green bg utility was overriding the components-layer class). Pushed. Moved to Done.
- [x] `EH7MK87u` — Incoming "Personel Ata" → "Onayla" for all active external (from another dept) requests, not just Reporter. Pushed. Moved to Done.
- [x] `ZsEvcCnJ` (reopened) — Standard-user requests now show active İade in the popup: TasksPage choose-step İade passive only for Reporter tasks (removed the internal/routine !canReturn restriction); IncomingRequests already showed active İptal Et + İade Et for non-Reporter. Pushed. Moved to Done.

## Round 29 (manual check)
- [x] `8xnSiTR5` — Görevi Yönlendir user dropdown now excludes the current task assignee (returnDeptUsers filters out the routed task's assignedUserId when directRoute). Pushed. Moved to Done.

## Round 30 (manual check)
- [x] `QGCJLtWm` (reopened) — Görevi Yönlendir button now a real blue (#0ea5e9 bg / #0284c7 border / white text, hover #0284c7) — previous light blue too light. Pushed. Moved to Done.
- [x] `7RspesWl` — Added "Durum" column after Başlık in the İptal/İade Talepler (cancelled/rejected) views of Incoming/Jobs/Tasks grids, showing İptal (Cancelled) vs İade (Rejected/RevisionRequested). Added cancelReturnStatus i18n key (tr/en). Pushed. Moved to Done.
- [x] `X705MbI5` — Added top-right X close icon to the task İptal/İade/Yönlendir modal (closeReturnModal). Pushed. Moved to Done.

## Round 31 (manual check)
- [x] `X705MbI5` (reopened) — Route/return modal X close icon hover now red (hover:bg-red-50 hover:text-red-600); for directRoute (Görevi Birim İçi Yönlendir) the "Geri" button reads "Çıkış" and closes. Added common.exit (tr/en). Pushed. Moved to Done.
- [x] `7RspesWl` (reopened) — Durum column now shows plain "İptal"/"İade" (was "İptal Et"/"İade Et" from jobs.actions keys) in Incoming/Jobs/Tasks. Pushed. Moved to Done.

## Round 32 (manual check)
- [x] `7RspesWl` (reopened) — Durum column now a FilterableTh (sort + filter) in Incoming/Jobs/Tasks; added cancelReturnStatus to each grid's column accessor (İptal/İade). Pushed. Moved to Done.
- [x] `pE3EAIQ7` — Removed Son Tarih column from the İptal/İade (cancelled/rejected) views in Incoming/Jobs/Tasks. Pushed. Moved to Done.
- [x] `8J3uzZuF` — Görevlerim choose popup İade button relabeled "Görevi İade Et" (İptal already "Görevi İptal Et"); routing redirect label kept. Pushed. Moved to Done.
- [x] `ZsEvcCnJ` (reopened) — Incoming İptal/İade popup buttons: cancel action "İptal" (was "İptal Et"), dismiss "Vazgeç" (common.dismiss, was colliding with common.cancel="İptal"); İade Et unchanged. Added common.dismiss + tasks.actions.returnTask (tr/en). Pushed. Moved to Done.

## Round 33 (manual check)
- [x] `11N4MFvZ` — Pending-approval İptal prompt confirm button now "İptali Onayla" (was default "Onayla"). Pushed. Moved to Done.
- [x] `7RspesWl` (reopened #2) — Durum column now sortable: injected cancelReturnStatus property onto rows (Incoming/Jobs/Tasks) so useSortable obj[sortKey] works; filter already via column accessor. Pushed. Moved to Done.
- [x] `u5coQlbm` — Added red-hover X close icon (top-right) to shared PromptDialog + ConfirmDialog and the Incoming cancel/return + staff-assign modals (route modal already had it). Pushed. Moved to Done.
- [x] `qpgXDcLh` — "Görevi İade Et" now returns directly to the task owner (görev sahibi) without the routing screen: new 'returnOwner' step (reason only) → requestTaskRevision(taskId, reason, ownerUserId) → RevisionRequested with owner as approver. Added OwnerUserId to TaskSummaryResponse + GetTasksQuery + FE Task type. Reporter routing case keeps the 'return' (Görevi Birim İçi Yönlendir) screen. Pushed. Moved to Done.

## STATUS: Round 33 complete — Doing list drained.

## Round 34 (manual check)
- [x] `IM1wf1dA` — Wallboard: added red "Çıkış" button next to "Yenile" → navigates to home (/). Pushed. Moved to Done.
- [x] `eXTCjF9l` — Wallboard rows for Reporter-originated tasks now amber (#fbbf24, dark text) via .reporter-row (item.isReporterRequest from job.createdByRoleCode). Pushed. Moved to Done.

## Round 35 (manual check)
- [x] `7RspesWl` (reopened #3, filter) — Column filters were case-broken for Turkish "İ" (İptal/İade) because useColumnFilters.matchesFilters used default toLowerCase(); switched to toLocaleLowerCase('tr'). Fixes Durum filter (and all column filters) for Turkish text. Pushed. Moved to Done.
- [x] `MrqUHoyC` — Bildirimler bell now reflects all request/task lifecycle changes: GetNotificationsQuery merges real (push) notifications with an audit-log-derived feed for the current user's own jobs + assigned/owned/created tasks. AuditLog Action mapped to Turkish titles (Talep/Görev oluşturuldu/onaylandı/iptal/iade vb.), message from Notes/Details + actor, link to /my-requests|/my-tasks. Audit entries marked read so they don't inflate the unread badge. Backend-only (bell renders the contract). Pushed. Moved to Done.

## STATUS: Round 35 complete — Doing list drained.
