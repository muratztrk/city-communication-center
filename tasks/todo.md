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

## Round 30
- [x] `4jiu9dpb` — Birime Gelen yönlendirilmiş talep satırında Talep No yanında koyu turkuaz yönlendiren birim + bullet + yönlenme sebebi gösterildi; banner araması bu metni de tarıyor.
- [x] `bAumvBgX` — Yönlendirilmiş dış birim talebi detayında `Talebi Yönlendir` butonu gizlendi; yeniden yönlendirme UI’dan kapanıyor.

## Round 31
- [x] `phqjfjcn` — Yönlendirilmiş talepten atanan görevlerde TaskSummary `forwardReason` taşınıyor; personel/görev gridindeki Bağlı Talep No yanında koyu turkuaz `(Yönlendirilen Talep)` etiketi, görev detayındaki İlgili Talep Detayları içinde `Talebin Yönlenme Sebebi` satırı gösteriliyor.

## Round 32
- [x] `4jiu9dpb` (reopened) — Birime Gelen detay popup'ında `Talebin Yönlenme Sebebi` değeri artık koyu turkuaz `Talebi Yönlendiren Birim • yönlenme sebebi` formatında gösteriliyor; yönlendiren birim `requestedByUserId` üzerinden çözülüyor.

## Round 33
- [x] `4jiu9dpb` (reopened #2) — Birime Gelen grid Talep No yanında tekrar koyu turkuaz `(Yönlendirilen Talep)` rozeti gösteriyor; yönlenme sebebi yalnız detay popup içinde kalıyor.
- [x] `StfNPmMP` — Detay popup `Talebin Yönlenme Sebebi` değeri koyu turkuaz kalıp bold olmayan metne çekildi.
- [x] `Ta9QyzXj` — Ortak `.detail-modal-shell` ölçüsü Taleplerim popup ölçüsüne alındı; Birime Gelen/Birimden Giden/Görevlerim/Birimdeki/Personelimin detay popupları aynı boyuta hizalandı.

## Round 34
- [x] `rUud298x` — Görev detay popup'ındaki `İlgili Talep Detayları > Talebin Yönlenme Sebebi` değeri koyu turkuaz `Talebi Yönlendiren Birim • sebep` formatına alındı.

## Round 35
- [x] `rUud298x` (reopened) — Yönlendirilmiş görevlerde `Bağlı Olduğu Talep No` hücresi tam genişlikte ortalandı.
- [x] `DSlHXxSc` — Görev detayındaki `İlgili Talep Detayları > Talep No` satırında `Birim Dışı` etiketinden sonra koyu turkuaz `(Yönlendirilen Talep)` rozeti gösteriliyor.
- [x] `E3RyXkox` — Bildirim başlıklarında `İşlem gerçekleşti` fallback'i kaldırıldı; eksik audit action mapping'leri ve entity bazlı anlamlı fallback eklendi.

## Round 36
- [x] `rUud298x` (reopened #2) — Yönlendirilmiş görev gridlerinde `(Yönlendirilen Talep)` rozeti `Bağlı Olduğu Talep No` değerinin alt satırına alındı ve ortalı kaldı.
- [x] `hqzpuTDn` — Bildirim başlığında `Talep yönlendirildi` metninin aksiyon kısmı bold vurgulanıyor.

## Round 37
- [x] `gMRPRmkO` — Üst Düzey Yönetici (`Reporter`) dashboard'ında `Vatandaş Talep Kanalları` pie chart'ı açıldı; backend `citizen-channels` rol kapısı Reporter'ı da kabul ediyor. Birim yöneticisi (`Manager`) görünümü mevcut chart ile korunuyor.
- [x] `gMRPRmkO` (reopened) — `Vatandaş Talep Kanalları` sayımı rol kapsamına alındı: Üst Düzey Yönetici tüm tenant VT taleplerini, Birim Yöneticisi yalnız kendi aktif/kapsam birimine gelen VT taleplerini kanal kırılımıyla görür.
- [x] `6DfZU3kf` — Reporter `Birimlerde Bekleyen Talepler` grafiği dış birim hedef linklerini `PendingOwnerApproval` + `PendingExternalApproval` statülerinde hedef birim adına göre sayıyor; drilldown aynı kapsamı kullanıyor.
- [x] `nDHm4SMs` — Manager `Vatandaş Talep Kanalları` grafiği VT kanalını `SocialMessage.JobId + CitizenRequestNumber` üzerinden buluyor; `SourceRefId` eksik/uyumsuz olduğunda grafik boş kalmıyor.
- [x] `gzrWNfu4` — Reporter dashboard pie chart drilldown popup'ı Taleplerim detay popup'ıyla aynı `.detail-modal-shell` ölçüsünü kullanıyor.
- [x] `oVHYh7ew` — Reporter dashboard pie chart drilldown gridine `İşlemler` sütunu ve `Detaylar` butonu eklendi; buton ilgili talebi salt-okunur `MyRequestDetailModal` popup'ında açıyor.

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

## Round 36 (manual check)
- [x] `UWHsvfFj` — Removed İade from the cancel flow: grid "İptal/İade" buttons → "İptal" in TasksPage + IncomingRequests; clicking goes straight to the cancel-reason popup (TasksPage openReturnModal → 'cancel' step; IncomingRequests openCancelReturn → prompt). Task popup keeps "Görev" wording; request popup says "Talebi İptal Et" (Talep, not Görev). Reporter cancel restriction preserved (staff button passive). Choose/İade-Et UI now unreachable. Pushed. Moved to Done.

## STATUS: Round 36 complete — Doing list drained.

## Round 37 (Jun 15 — Doing list, 8 cards)
- [x] `#377` (6a2e8e13) — Bell unread count now a round red badge with white number (was bare red text); rounded-full bg-red-600 text-white ring-2 ring-white. NotificationBell.tsx.
- [x] `#441` (6a304f84) — Birim Dışı Talep Oluştur coordination texts: "Koordineli Birimler"→"Koordine Departmanlar", placeholder "Birim/Müdürlük seçin"→"Koordine Departman seçin", help "...ek birimler."→"...ek departmanlar." Same strings aligned in IncomingRequests coordinated modal. CreateRequestPage + IncomingRequestsPage.
- [x] `#436` (6a300106) — JobsPage detail popup coordination button "Koordine Birim Ekle"→"Koordine Departman Ekle" (heading was already correct).
- [x] `#442` (6a3051fd) — Request detail popup (Taleplerim/Birime Gelen/Birimden Giden) bottom section now 3 columns: Koordine Departman Ekle | Adres Bilgileri (opsiyonel adres alanları, veri varsa) | Ekler/Fotoğraflar. Added renderJobAddressInfo + Adres section for non-coordination (staff) viewers. JobsPage.
- [x] `#438` (6a304a70) — Task detail popup: removed the redundant header "Görevi Yönlendir" button (the inline "Görevi Yönlendir" column does the same routing); enlarged that section's heading/help/select/button (text-2xl, h-12 select, size lg full-width button). TasksPage.
- [x] `#431` (6a2ff8d1) — Removed the standalone JobsPage "Birime Gelen Talepler" list page (duplicate of /incoming-requests): /request-details with no jobId now redirects to /incoming-requests?kind=all; closing a detail in external mode returns to /incoming-requests (or /social for social context); GlobalSearchBar external results open the detail directly with jobId. JobsPage + GlobalSearchBar.
- [x] `#440` (6a304dc0) — Pending requests now surface in notifications: NotificationAudience.GetManagerPendingJobIdsAsync adds a manager's pending incoming ("Onay Bekleyen Talepler") + outgoing ("Bekleyen Talepler") jobs (status Pending(Owner|External)Approval where their managed dept is owner or Target) to the visible-entity set, so both the bell feed AND unread count include them consistently; their "Detay" opens the approvable incoming detail. Backend: NotificationAudience + GetNotificationsQuery.
- [x] `#439` (6a304cae) — Notifications: row click no longer navigates; only the "Detay" button opens the detail (and marks read). Detail popups (Jobs/Tasks z-[120]) now layer ABOVE the notifications modal (z-100) so the notifications popup stays behind. NotificationBell + JobsPage + TasksPage.

### Verification (Round 37)
- Frontend `npm run build` (tsc -b + vite) — PASS.
- Backend `dotnet build` full solution — PASS (had to clear pre-existing runaway nested `bin/` recursion + stray `bin\Debug` literal dir in the Api project; unrelated to these changes).
- `npm run lint` — clean for all touched files (2 pre-existing errors remain in untouched RichTextEditor.tsx / date-time-picker.tsx).
- Runtime E2E NOT performed: no demo seed is configured in any appsettings (`SeedData:EnableDemoData` unset → off), so a fresh DB has no managers/requests/notifications to exercise cards #431/#440/#439 without heavy manual data setup. Note: this contradicts CLAUDE.md which claims demo seed is on in dev config.

## STATUS: Round 37 complete — Doing list drained (8 cards).

## Round 38 (#443 — arrived mid-session, user chose "implement now")
- [x] `#443` (6a30569e) — Vatandaş Talepleri redesign: removed the inline Müdürlük dropdown, İş başlığı input, Yönlendir/Sil/İşe çevir buttons and the "Konuşmayı Aç" link + slide-in conversation. Each unconverted citizen message now has a single "Talep Oluştur" button that opens a new `CitizenRequestModal` — a two-pane pop-up with the related WhatsApp conversation (ConversationPanel) on the left and the full "Birim Dışı Talep Oluştur" form on the right (Talep Başlığı, Talebin Gideceği Birim, Koordineli + Koordine Departmanlar, Öncelik, Proje, Başlangıç/Son tarih, Adres, Açıklama). Submit creates an ExternalUnit job linked to the message. Backend: extended ConvertSocialMessageToJobCommand/Request + controller to accept RequestType/TargetDepartmentIds/IsProject/StartDate/address; handler passes them to CreateJobCommand (defaults preserve old Citizen behavior). FE: new CitizenRequestModal.tsx, api client convert payload extended, SocialMessagesPage rewired. Converted rows keep "Detaylar".
  - Verification: frontend build PASS, backend Api build PASS, lint clean for touched files. Runtime E2E not run (no demo seed → no social messages/conversations to exercise without manual setup).

## STATUS: Round 38 complete — Doing list drained.

## Round 39 (live review feedback on Round 37 work)
- [x] `#438` (reopened) — Round-37 enlargement was too big; shrank the task-detail "Görevi Yönlendir" section back down (h3 text-2xl→text-base, removed helper text-base / select h-12 text-base / full-width lg button → default field-select + size sm). TasksPage.
- [x] `#445` — Notification row click now marks the notification read only (no navigation); detail still opens solely via the "Detay" button (refines Round-37 #439 where the row did nothing). NotificationBell.
- [x] `#444` — Detail popup opened from a notification must appear above the notifications modal and, on X, leave the notifications open. Root cause: detail modals render inside the content `zoom` stacking context, so a z-index alone can't lift them above the body-portaled notifications modal. Fix: portal the Tasks + Jobs detail modals to `document.body` (same technique the notifications modal already documents) at z-[120] > notifications z-[100]; closing the detail never touches the notifications modal. TasksPage + JobsPage.
  - Verification: frontend build PASS, lint clean for touched files. Runtime not exercised (no demo seed). Note: portaling the detail modals also makes them render at full viewport scale (was content-zoom ~0.81) — intended/acceptable for a focal overlay.

## STATUS: Round 39 complete.

## Round 40
- [x] `#446` — "Birim Dışı Talep Oluştur" target dropdown placeholder "Birim/Müdürlük seçin" → "Departman seçiniz" (CreateRequestPage); aligned CitizenRequestModal target placeholder to the same key. Build PASS.

## Round 41
- [x] `#447` — Bell unread badge nudged a bit further out (-right-2.5/-top-2.5 → -right-3.5/-top-3.5). NotificationBell.
- [x] `#443` (reopened, no feedback) — Likely cause: CitizenRequestModal rendered inside the content `zoom` stacking context (same issue as #444), so the popup appeared mis-scaled/clipped. Fix: portal CitizenRequestModal to document.body. Build PASS. If the real issue was different, awaiting clarification.

## Round 42 (direct feedback)
- [x] Detay popups too tall after the #444 portal (scale went 0.81→1.0). Lowered Jobs + Tasks detail modals from forced `h-[92dvh] max-h-[92dvh]` to `max-h-[80dvh]` (caps + sizes to content). Build PASS. (Citizen "Talep Oluştur" popup left as-is — out of scope of "Detay" popups.)

## Round 43 (new Doing cards)
- [x] `#462` — Detay popups (Jobs + Tasks detail modals) height-only bump max-h-[72dvh] → max-h-[80dvh] (notification list modal left at 72dvh — it's bell-opened, not a Detay popup). JobsPage + TasksPage.
- [x] `#459` — Manager Taleplerim "Birim Dışı Onay Bekleyen Talepler" grid was empty: filterMyRequests external-pending required status PendingExternalApproval AND hasPendingTargetDepartment(job, activeDept) — but in Taleplerim the active dept is the OWNER (never a target), so it always excluded everything; it also missed the owner-approved-awaiting-target-staff state. Fixed: external-pending now = ExternalUnit && (PendingExternalApproval || (Active && taskCount===0)) && !overdue (mirrors what the target manager sees in Birime Gelen → Onay Bekleyen). Removed now-unused hasPendingTargetDepartment helper. JobsPage. Build + lint PASS.

## Round 44
- [x] `#463` — Detay popup coordination block: shrank "Koordine Departman seçin" placeholder font (new MultiSelectDropdown triggerClassName prop → text-xs) and narrowed the "Koordine Departman Ekle" button (size sm). JobsPage + multi-select-dropdown.
- [x] `#453` — Yönetici Notu: added Job.ManagerNote (+ migration AddJobManagerNote), SetJobManagerNoteCommand + POST /jobs/{id}/manager-note, JobDetailResponse.ManagerNote. FE: editable note (textarea + green "Ekle") in Birimden Giden → Bekleyen detail while target hasn't approved (PendingOwnerApproval/PendingExternalApproval/Active+noTasks); read-only display in Birime Gelen (incoming) detail. JobsPage + api client + types. Build (FE+BE) + lint PASS.

## Round 45
- [x] `#452` — Düzenle (edit) flow for pending requests. JobsPage Taleplerim list: light-turquoise "Düzenle" button right of "Detaylar", shown while editable (isPreApprovalStatus OR manager Active+taskCount0); navigates to /requests/new?kind=…&editJobId=…. CreateRequestPage edit mode: prefill external/internal form from job (title/desc/priority/dates/isProject/address + target+coordinated from Target depts), submit calls updateJob (button label → "Güncelle"), default owner-dept effects guarded so prefill isn't clobbered. Backend: UpdateJobCommand/Request/controller expanded with IsProject/Neighborhood/Street/OpenAddress + TargetDepartmentIds reconciliation (pre-approval external only; replace Target rows, keep Owner). Build (FE+BE) + lint PASS. Note: runtime not exercised (no seed); target-dept reconciliation guarded to pre-approval.

## Round 46 (5 cards)
- [x] `#462` (reopened, screenshot) — Detay popups grew unbounded tall on 27" (80dvh≈1152px). Capped absolute height: max-h-[min(85dvh,52rem)] (Jobs+Tasks) so big monitors stay compact like the screenshot; small screens still use 85dvh.
- [x] `#457` — Manager Taleplerim "Yapılmakta Olan Taleplerim" chip active bg orange→yellow (new .scope-chip--in-progress-yellow; applied when in-progress && isManagerLike). globals.css + JobsPage.
- [x] `#464` — Detay popup Koordine Departman MultiSelectDropdown now opens upward (new openUp prop → bottom-full mb-2). Personel seçiniz is a native <select> (browser auto-positions upward near viewport bottom).
- [x] `#465`+`#466` — Yönetici Notu moved from a row below into the coordination grid as the 3rd column (right of Adres Bilgileri); grid becomes 4 cols (Koordine|Adres|Yönetici Notu|Ekler) when shown. Birimden Giden→Bekleyen: editable. Birime Gelen: read-only — shows the note, or "Yönetici Notu girilmemiş" when empty.
- Build (FE) + lint PASS. Runtime not exercised (no seed).

## Round 47 (4 cards)
- [x] `#469` — Taleplerim "Düzenle" button background light→dark turquoise (bg-teal-700). JobsPage.
- [x] `#467` — Manager note "Ekle" now shows an info popup "Notunuz Eklendi" (ConfirmDialog hideCancel) after save. JobsPage.
- [x] `#464` (reopened) — Görevi Yönlendir "Personel seçiniz" converted from native <select> to new SingleSelectDropdown with openUp (opens upward). TasksPage + single-select-dropdown.tsx.
- [x] `#468` — Yönetici Notu column now shows in ALL request detail contexts (showManagerNoteColumn = isRequestDetailContext; read-only "Yönetici Notu girilmemiş" when empty). In the Task detail, added a read-only Yönetici Notu column (parent job's note) right of Atama Geçmişi (grid 3→4 cols for managers). JobsPage + TasksPage.
- Build (FE) + lint PASS.

## Round 48
- [x] `#470` — Manager's own Birim İçi (internal) request assigned to self/staff didn't show in "Yapılmakta Olan Taleplerim": the in-progress manager filter required hasApprovedTargetDepartment (only valid for external). Now internal Active+taskCount>0 jobs qualify directly (requestType==='InternalUnit' || hasApprovedTargetDepartment). JobsPage. Build + lint PASS.

## Round 49 (2 cards — print popup)
- [x] `#565` — Print window height now matches the detail popup behind it. Both print fns measure the open detail modal (`document.querySelector('.detail-modal-shell').offsetHeight`, fallback 832) and pass it to `getCenteredPopupFeatures(820, …)` instead of the fixed 832. JobsPage + TasksPage.
- [x] `#570` — Reverted regressions from "Clean print popup chrome" (21926e4): removed `@page{margin:0}` (it zeroed page margins → killed left/right alignment AND the browser's default "1/1" page-number footer), and restored the `.footer` CSS + `<div class="footer">Yazdırma tarihi: …</div>`. Matches the pre-regression state (da2390d). JobsPage + TasksPage.
- Build (FE) + lint PASS. Runtime not exercised (no seed; print needs an open detail modal with data).

## Round 50 (1 card — print chrome)
- [x] `#571` — Remove the browser's native print header/footer (top-left date, top-center "about:blank" title, bottom-left "about:blank" URL) while keeping a "1/1" page number. These are all the browser's all-or-nothing print chrome (only toggled by `@page` margin), so: re-added `@page{margin:0}` to suppress ALL native chrome; restored left/right (and top/bottom) margins via `@media print{body{padding:1.5cm}}`; and rendered our own print-only bottom-right `.page-number` ("1 / 1"). Decided with the user (native "1/1" can't be kept while removing the about:blank/date). JobsPage + TasksPage. Build (FE) + lint PASS.
  - Caveat: the custom "1 / 1" is a fixed bottom-right indicator, accurate for the typical single-page printout; a multi-page print would repeat "1 / 1" (no cross-browser way to paginate counters in Chrome).

## Round 51 (3 cards)
- [x] `#573` — Print → Save as PDF filename was "download". Set the print doc `<title>` to the number (TasksPage → `taskDisplayNumber` / Görev No, JobsPage → `jobDisplayNumber` / Talep No). Title is still hidden from the printout (suppressed by `@page{margin:0}` from #571) but drives the PDF filename. JobsPage + TasksPage.
- [x] `#572` — Enlarged two helper texts (cancel-request "…neden belirtiniz." + route-within-unit "Görev sadece aynı birim içinde yönlendirilebilir.") via inline `fontSize:0.85rem` so only these `.helper-copy` instances grow (base is 0.76rem / 0.66rem in the zoomed shell — global change avoided). JobsPage + IncomingRequestsPage (cancel popup) + TasksPage (route popup).
- [x] `#574` — Address labels (Mahalle, Cadde / Sokak / Bulvar, Açık Adres) bumped `text-xs`→`text-sm` in CreateRequestPage `renderAddressFields` (shared by internal + external forms).
- Build (FE) + lint PASS.

## Round 52 (2 bug cards)
- [x] `#576` — Notifications → task detail showed Görev No as `taskId.slice(0,8)` hash and Atanan as a raw user GUID. Root: `TaskDetailResponse` lacked the number + display names. Added `AssignedDepartmentName`, `AssignedUserDisplayName`, `TaskNumber`, `TaskNumberYear` to the contract (appended — no positional reshuffle), resolved them in `GetTaskByIdQuery`, mirrored on FE `TaskDetail` type, and updated `NotificationBell` (`formatTaskNumber` → `G-{year}-{n}`; Atanan → displayName ?? deptName ?? '—'). BE + FE build + lint PASS.
- [x] `#577` — Görevlerim › Tüm Görevlerim: empty search collapsed the grid headers (overlap). Root: `my-tasks-all-table` uses `table-layout:fixed` (card 548); the empty `colSpan={99}` row inflates the column model under fixed layout and squeezes the `nowrap` headers. Fix: add `data-table--empty` class when `pagedTasks.length===0` and override to `table-layout:auto` for that case (matches the working Jobs empty grid). TasksPage + globals.css. Build + lint PASS.

## Round 53 (2 cards)
- [x] `#578` — Enlarged the task-cancel popup helper "Görevi iptal etmek için neden belirtiniz." (TasksPage:1386) via inline `fontSize:0.85rem` (same treatment as #572; the IncomingRequestsPage instance was already covered by #572).
- [x] `#579` — Banner 1st line (kicker) + 3rd line (subtitle) enlarged. Split `.page-kicker` out of the shared shell override so only the banner kicker grows (0.66→0.76rem), bumped `.page-subtitle` shell size 0.78→0.88rem, and base `.page-kicker` 0.72→0.8rem. globals.css. Build + lint PASS.

## Round 54 (1 feature card)
- [x] `#575` — Routine tasks: Adres Bilgisi + Dosya/Fotoğraf on the create form, and Adres Bilgileri + Ekler/Fotoğraflar in the Görevlerim routine detail. Key insight: CreateRoutineTask already creates a synthetic Job (SourceType=Routine) that has the address fields; attachments use the Task bucket (same as the existing complete-card uploader, card 528).
  - BE: added Neighborhood/Street/OpenAddress to `CreateRoutineTaskRequest` + `CreateRoutineTaskCommand` (optional), set on the Job in the handler, passed through in `TasksController.CreateRoutine`. No migration (Job already has address fields).
  - FE: `api.createRoutineTask` signature + RoutineTaskPage (address fields mirroring CreateRequestPage + pendingFiles photo upload → `uploadTaskAttachment` after create). TasksPage detail: new routine-only 2nd row with Adres Bilgileri (from parentJobDetail, "Adres bilgisi girilmemiş." when empty) + read-only Ekler/Fotoğraflar (`taskDetail.attachments`, empty "Rutin Görev için ek/fotoğraf bulunmamaktadır.", amber lock "Rutin görev tamamlandığı için sonradan Ek/Fotoğraf eklenemez." when Completed). New i18n keys attachments.routineEmpty/routineLocked (tr+en).
  - BE + FE build + lint PASS. Runtime not exercised (no seed).

## Round 55 (1 card)
- [x] `#580` — Notification "Detay" now deep-links to the real page popup instead of the bell's own inline popup: task → `/my-tasks?view=all&taskId=<id>` (Görevlerim opens the task detail), job → `/my-requests?view=all&jobId=<id>` (Taleplerim opens the request detail). `handleNavigate` in NotificationBell now uses `useNavigate` + `parseNotificationDetailTarget`, closing the dropdown/modal. The bell's inline detail popup is now unreachable (flagged for cleanup). Build + lint PASS.

## Round 56 (3 cards)
- [x] `#581` — Explicitly block dangerous file extensions on upload (.exe, .bat, .msi, .dmg, .iso, .tar, .xz, … 30 total). Added a `BlockedExtensions` denylist to `UploadAttachmentCommandHandler`, checked before the allowlist with a security message. Note: the existing allowlist (jpg/png/pdf/Office only) already rejected these — the denylist is explicit defense-in-depth. BE build PASS.
- [x] `#582` — Routine create form: aligned Adres Bilgisi + Dosya/Fotoğraf layout to match Talep Oluştur exactly (single group: Mahalle|Cadde row, then Açık Adres|Upload row) instead of two separate columns. RoutineTaskPage. Build + lint PASS.
- [x] `#583` — Routine detail Adres Bilgileri: headings now side by side (values beneath) via `flex flex-wrap` instead of the stacked `dl space-y-2`. TasksPage. Build + lint PASS.

## Round 57 (1 card)
- [x] `#584` — Birime Gelen Talepler grid: "Talep Yeri / Oluşturan" header now renders on two lines without the slash ("Talep Yeri" / "Oluşturan"). Single shared table header (line 658) → two `t()` calls with `<br/>`; added `incomingRequests.columns.requestLocation` + `.creator` keys (tr+en). Build + lint PASS.

## Round 58 (3 cards — Doing batch)
- [x] `#594` — Wallboard ("Ekrana yansıt") Görev No column was missing the `G-` prefix (showed `2026/98`). Added a dedicated `formatTaskNumber` → `G-{year}-{n}` in WallboardPage, aligning the wallboard with the app-wide task-number format (also normalised the `/` separator to `-` for consistency with TasksPage/NotificationBell). jobNumber (unused in render) keeps the generic `formatNumber`.
- [x] `#593` — Balanced title wrapping in all gridviews: long `Başlık` text now splits ~half/half across lines instead of orphaning words. Added `text-wrap: balance` to `.cell-title` (Tasks/Jobs/IncomingRequests grids) and switched `.wallboard-row-title` from nowrap+ellipsis to `white-space:normal` + `overflow-wrap:break-word` + `text-wrap:balance` (wallboard). globals.css only.
- [x] `#589` — "Yeni" blinking green badge under the Görev Tarihi value in Görevlerim while the task's assignment-to-staff date is still today. Derived `AssignedAtUtc` (latest AssignmentHistory `ToUserId == AssignedUserId`, covers Assign + Claim) as a no-migration projection in `GetTasksQuery`; added optional trailing `AssignedAtUtc` to `TaskSummaryResponse`. FE: `Task.assignedAtUtc`, `isAssignedToday()` gate (only `isMyTasksView`), `.task-new-badge` blink keyframe (`@keyframes ccc-blink`, respects `prefers-reduced-motion`), `tasks.badges.new` i18n (tr/en).
- BE build + FE build + lint + 10 backend tests PASS. Runtime not exercised (no seed; needs tasks assigned today / open wallboard items).

## Round 59 (1 fix — notification deep-link)
- [x] Notification "Detay" for a **görev** only opened the Görevlerim popup when the task was in the user's "mine" list (`tasks.find` in TasksPage auto-open effect) — so notifications about tasks **not assigned to the viewer** opened nothing. Talep already worked because JobsPage fetches by id. Added `openTaskDetailById` fallback: when the deep-linked task isn't in the loaded list, fetch it by id (`api.getTaskById` — tenant-scoped, no auth gate) + parent job, derive the `selectedTask` summary, and open the same popup. Guarded with `autoOpenInFlightRef` + `!loading` so the common (in-list) path is unchanged. FE build + lint PASS.
  - The original "small inline popup" symptom was a stale PWA cache (deployed #580 code already navigates); this closes the remaining real gap.

## Round 60 (Doing batch 2)
- [x] `#597` — Cap gridview title wrap at **2 lines** (refines #593): `.cell-title` + `.wallboard-row-title` now use `display:-webkit-box` + `-webkit-line-clamp:2` (kept `text-wrap:balance` so a 2-line title still splits ~half; `.cell-title` gets `margin-inline:auto` to stay centered now that it's block-level). Verified via Chrome injection: short=1 line, medium=2, very-long clamped 2 (scrollHeight 74→clientHeight 37). globals.css only. FE build + lint PASS.

## Round 61 (Doing batch — 5 cards)
- [x] `#628` — Gridview "Son Tarih" altındaki **(Ek süre talebi)** işareti geri geldi. Kök neden: `061e033` "Preserve task status during extra-time approval" ek süre talebinde görev durumunu artık `RevisionRequested`'a çekmiyor (Assigned/InProgress kalıyor), oysa işaret `task.currentStatus === 'RevisionRequested'`'a bağlıydı → hiç görünmüyordu. Çözüm: `TaskSummaryResponse.HasPendingExtraTimeRequest` (Approvals'ta `TaskRevision`+`Pending` var mı) projeksiyonu GetTasksQuery'e eklendi; FE `Task.hasPendingExtraTimeRequest` + TasksPage işaret koşulu güncellendi. Şema değişmedi, migration yok.
- [x] `#629` — Tüm gridview'larda **Talep Tarihi** yönetici onayında değişiyordu. Kök neden: birim içi talep onaylanınca (`ApproveJobOwnerCommand` → `EnsureOwnerTasksAsync(... utcNow)`) görevler o an oluşturuluyor; IncomingRequestsPage `toInternalRow` ise "Talep Tarihi" için `task.createdAtUtc` (=onay anı) kullanıyordu. Çözüm: `TaskSummaryResponse.JobCreatedAtUtc` (bağlı talebin oluşturulma tarihi) projeksiyonu eklendi; FE `Task.jobCreatedAtUtc`; `toInternalRow` artık `task.jobCreatedAtUtc ?? task.createdAtUtc`. (`approvedAtUtc` sütunu görev createdAt'inde kaldı — onay anı doğru.)
- [x] `#627` — Ek süre talebi reddedilince sağ alttaki balon yeşil yerine **kırmızı**. TasksPage toast state'i `{ message, type }` + `showToast(msg, type)` helper'ına çevrildi; sadece red akışı `'error'` (Toast bileşeni zaten error=rose desteği veriyordu).
- [x] `#630` — Ekler / Fotoğraflar bölümünde **önizleme (resim küçük görseli) kaldırıldı**; her yüklü dosya yalnızca FileText ikonu + adıyla gösteriliyor. AttachmentSection: `IMAGE_EXTENSIONS`/`isImageAttachment` + `<img>` dalı + gereksiz hover ad katmanı silindi.
- [x] `#612` — Vatandaş Talepleri banner altındaki WhatsApp butonu + gridview'ı. İnceleme: zaten `da84d7f` "Refine citizen request workflow" ile geri getirilmiş (WhatsApp ilk kanal çipi + gridview WhatsApp mesajlarını gösteriyor + "Yazışmalar" butonu; backend GetSocialMessagesQuery WhatsApp'ı hariç tutmuyor). HEAD = origin/main = deploy, kodda eksik yok — muhtemelen stale PWA cache. Kod değişikliği yapılmadı; kullanıcıya soruldu.
- BE build + FE build + lint PASS. Runtime exercise edilmedi (seed yok).

## Round 62 (1 card — reopened #551)
- [x] `#551` (reopened, T-2026-109) — Birime Gelen Talepler → Detaylar pop-up'ında açıklamada hâlâ düz **`&nbsp;`** görünüyordu. Önceki düzeltme (`2689926`, RichTextContent `decodeHtmlEntities`) yalnızca **düz metin** dalını çözüyordu; `<p>` etiketli açıklamalar rich-text dalından (`dangerouslySetInnerHTML`) geçiyor ve **çift kodlanmış** `&amp;nbsp;` düz `&nbsp;` olarak render ediliyordu. Kök neden: RichTextEditor `escapeHtml` `&`→`&amp;` yapıyor; düz metin içinde `&nbsp;` olan değer kaydedilince `&amp;nbsp;` oluyor. Çözüm: RichTextContent'e `normalizeNbsp` eklendi — tek/çift/çoklu kodlanmış `&nbsp;` ve gerçek U+00A0 baştan normal boşluğa indirgenir (`/&(?:amp;)*nbsp;/gi` + ` `), böylece hem düz metin hem HTML dalı düzelir. Meşru `&amp;` (AT&T) korunur. FE build + lint PASS; regex 6 senaryoda node ile doğrulandı. (Print yolu kart kapsamı dışı; salt-okunur display düzeltmesi tüm mevcut kayıtları da kapsar.)

## Round 63 (Doing batch — 4 cards; çoğu deploy'da mevcut, stale PWA cache şüphesi)
- [x] `#635` — Vatandaş Talepleri banner'ı diğer sayfalardan kısaydı çünkü `page-kicker` satırı yoktu (diğer sayfalar kicker+başlık+alt başlık 3 satır; social 2 satır). SocialMessagesPage header'a `<div class="page-kicker">{t('nav.social')}</div>` eklendi → yükseklik eşitlendi. FE build + lint PASS.
- [x] `#631` — Ekler/Fotoğraflar detay pop-up'ında dosyaya tıklayınca **inmiyordu**: kutucuk `<a href={statik /uploads}>` ile dosyayı indirmek yerine tarayıcıda açıyordu; yalnızca küçük ↓ butonu kimlik doğrulamalı gerçek indirme yapıyordu. Çözüm: tüm kutucuk artık `handleDownload` (api.downloadAttachment → blob → kaydet) tetikliyor; statik link + kullanılmayan `resolveAttachmentUrl` importu kaldırıldı. Yükleme progress bar'ı zaten vardı (5a52ab1, AttachmentSection satır 137-141). FE build + lint PASS.
- [x] `#621` — "WhatsApp konuşmaları gridview'de satır olmasın" + "whatsapp tamamen kaybolmuş". Grid'den hariç tutma zaten `1e36cc9` ile yapılmıştı AMA o commit WhatsApp'a erişimi de tamamen kaldırmıştı (çip + Yazışmalar butonu silindi, nav item yok → /whatsapp ulaşılamaz). Eksik parça buydu: SocialMessagesPage scope-chips'e MessageCircle ikonlu "WhatsApp Yazışmaları" çipi eklendi → `navigate('/whatsapp')` (konuşmalar grid satırı olmadan erişilebilir). `useNavigate` + `MessageCircle` geri eklendi; `whatsapp.navLabel` i18n (tr/en). FE build + lint PASS.
- [x] `#634` — Talep/görev süreçlerindeki değişiklikler ilgili tüm kullanıcıların **rozetinde uyarı** versin (kullanıcı: "gerçek okunmamış uyarı"). Olaylar zaten feed'de görünüyordu (AuditLog türevli) ama daima okundu işaretliydi → rozet saymıyordu. Çözüm (çift kayıt/​"tek tıkla çoklu azalma" hatası olmadan): `NotificationReadCursor` imlecini kullanarak imleçten sonraki + kullanıcının kendi yapmadığı AuditLog olayları okunmamış sayılır. `GetUnreadNotificationCountQuery` artık gerçek okunmamış + (ilgili entity'ler için imleç sonrası, aktör≠kullanıcı) AuditLog sayısını topluyor. `GetNotificationsQuery` türev satırların `IsRead`'ini imlece göre veriyor + `IsHistorical:true` işaretliyor. `NotificationResponse.IsHistorical` (trailing optional) eklendi; FE `AppNotification.isHistorical`; NotificationBell geçmiş satırları tek tek okumaz (`canMarkRead = !isRead && !isHistorical`), yalnızca "Hepsini okundu yap" imleci ilerletir. Rozet FE'de 30 sn'de bir poll'leniyor → olaylar ~30 sn içinde uyarı veriyor. BE build + 10 test + FE build + lint PASS. Migration yok.
- **KRİTİK build hotfix**: `301cccf` (paralel commit) `AttachmentsController.Download` içinde `CurrentContext.RequireTenantId()` kullanıyor ama `using CityCommunicationCenter.Application;` eklenmemiş → **backend HEAD'de derlenmiyordu**. Yani 301cccf'den beri backend deploy olmuyordu → indirme uç noktası canlı değildi (#631'in gerçek kök nedeni, stale cache değil). Eksik using eklendi; backend tekrar derleniyor.
- Not: #621/#631 stale cache değil, gerçek eksiklerdi (erişim noktası / tile indirme / backend derleme). #610 reprodüksiyonla doğrulandı (sorun yok). #612 zaten deploy'daydı.
- FE build + lint + BE build + 10 test PASS.

## Round 64 (Doing batch — 11 kart; gruplar halinde işleniyor)
- [x] `#641` — Talep onaylanınca bildirimde "CreatedTasks=N" teknik detayı görünüyordu (ApproveJobOwnerCommand Details, comment yoksa). GetNotificationsQuery `FormatNote` artık "CreatedTasks=" ile başlayan notları gizliyor.
- [x] `#639` — Bildirimde "Bir personele atandı" yerine atanan kişinin ismi. Kök: `CreateTaskCommand` denetim Details'i `"Assigned to user {guid}"` yazıyordu → FormatNote "Bir personele atandı". Artık `"Assigned to: {displayName}"` (target.DisplayName) yazılıyor → FormatNote "Atanan: {isim}". (Mevcut eski kayıtlar guid'li kalır; yeni atamalar ismi gösterir.)
- [x] `#644` — Tamamlanmış taleplerde Ekler/Fotoğraf kilit metni "Talep onaylandığı için..." yerine "Talep tamamlandığı için...". Yeni i18n `attachments.lockedCompletedRequest` (tr/en; mevcut `lockedCompleted` "Görev..." task içindi). JobsPage 3 kilit metni daluna Completed kolu eklendi.
- [x] `#632` — Üst düzey yönetici talebi hedef birime aktifken (Onay Bekleyen incoming) Ekler/Fotoğraf'ta "Talep onaylandığı için..." uyarısı çıkıyordu. Incoming (isRequestDetailContext) bağlamında kilit uyarısı artık yalnızca talep gerçekten kapandığında (Completed/Cancelled/Rejected) gösteriliyor; aktif/onay-bekleyen incoming talepte gösterilmiyor. Giden/Taleplerim bağlamı değişmedi.
- [x] `#640` — Bildirime tıklayınca okunmamış→okundu olmuyordu. Kök: #634'te eklediğim FE koruması (`canMarkRead = !isRead && !isHistorical`) geçmiş satırların tek tek okunmasını engelliyordu. Oysa backend `MarkNotificationReadCommand` audit id'lerini zaten işliyor (imleci o olayın zamanına ilerletir → o olay + daha eskiler okundu). `!isHistorical` koruması kaldırıldı; tıklama artık işliyor (#634 alert davranışı korunur). FE build + lint PASS.
- [x] `#648` — Taleplerim → Bekleyen detay başlığında "Talebi İptal Et"in soluna "Düzenle" butonu eklendi (tüm kullanıcılar, onay öncesi talep; `isMyRequestsView && isPreApprovalStatus`). Gridview'daki Düzenle ile aynı akış: `/requests/new?...&editJobId=`. FE build + lint PASS.
- [~] `#645`/`#647` — ATLANDI (kullanıcı kararı): "başkanlık seviyesi üst düzey yönetici" rol modeli yok (RoleCode yalnızca SystemAdmin/Operator/Manager/Staff/Reporter).
- [x] `#621` (yeni gereksinim) — Sol menüde Vatandaş Talepleri açılır grup olsun, altında "WhatsApp Konuşmaları" → /whatsapp. SidebarNav zaten `type:'group'` destekliyordu; AppShell navItemConfigs'e `children` alanı + reduce'da grup üretimi eklendi; social artık grup (parent /social + child /whatsapp, MessageCircle ikon). Banner altındaki WhatsApp butonu/ikonu önceki turda chip olarak eklenmişti (scope-chips). FE build + lint PASS.
- [x] `#652` — = #634 (okunmamış) + #640 (tıkla→okundu); kod zaten yapıyor (backend build düzeldikten sonra deploy edilebilir). Done'a taşındı.
- [~] `#650` — Detay pop-up'ında "İlgili Talep Detayları" başlığı üstüne border çizgisi (görsel polish). Görsel doğrulama gerektiriyor (app+auth+veri); ATLANDI/ertelendi.
- [x] `#653` — Taleplerim detayında Düzenle butonu artık her zaman görünür (Son Tarihi Geçmiş dahil): onay öncesi talepte aktif, değilse pasif (DisabledActionButton, "Bu kayıtta düzenleme yapılamaz"). #648'i genişletir. FE build + lint PASS.
- [x] `#649` — Taleplerim detay pop-up'ının en altına "Görev Detayları" bölümü eklendi (talebin görev(ler)i varsa): her görev için Görev No (G-yıl-n), Başlık, Atanan, Görev/Son/Tamamlanma Tarihi, Durum — Görevlerim'deki etiketli kutuya benzer. `detail.tasks` (JobDetail) verisinden, frontend-only. `getTaskStatusLabel` import edildi. FE build + lint PASS.
- [x] `#648` (reopened) / `#654` — Taleplerim detayındaki Düzenle butonu artık gridview'daki `canEdit` mantığını birebir yansıtıyor (`isPreApprovalStatus || (isManagerLike && (...))`) → standart olmayan kullanıcılarda da uygun durumlarda aktif; arka plan teal (bg-teal-700, gridview ile aynı), uygun değilse pasif. FE build + lint PASS.
- [x] `#655` — SocialMessagesPage'deki "WhatsApp Yazışmaları" çipi, başında WhatsApp marka ikonu (ChannelIcon) olan "WhatsApp" butonuna çevrildi (yine /whatsapp'a gider). Kullanılmayan MessageCircle importu kaldırıldı. FE build + lint PASS.
- [x] `#642`/`#643` — Görev/Talep Detayları'nda Durum'un yanına parantezde durumu belirleyen kullanıcı + tıklanabilir renkli not. Veri denetim kaydından türetildi (kullanıcı kararı, migration yok): BE `TaskDetailResponse.StatusActorDisplayName` (GetTaskByIdQuery: son TaskCancelled/TaskCompleted audit'in ActorDisplayName); `JobDetailResponse.StatusActorDisplayName`+`CompletionNote` (GetJobByIdQuery: iptal→JobCancelled/JobOwnerRejected actor; tamamlanmış→en son tamamlanan görevin notu+TaskCompleted actor; onay bekleyen→sahip birim yöneticisi). FE: Durum hücreleri JSX'e çevrildi — "(isim)" + kırmızı "İptal Notu" (job: cancelReason / task: revisionReason) ve yeşil "Tamamlama Notu" (job: completionNote / task: notes) → ConfirmDialog pop-up. i18n jobs/tasks.detail.cancelNote/completionNote (tr/en). BE build + 10 test + FE build + lint PASS. Runtime exercise edilmedi (seed yok).
- BE build + FE build + lint PASS.

## Round 65 (#645/#647/#648/#656 — "başkanlık seviyesi" daraltma)
- Kullanıcı netleştirdi: "Üst Düzey Yönetici" = Reporter rolü (UI etiketi), "başkanlık seviyesi" = **Başkanlık birimi**. Yani bu kartlar Reporter + departmentName === 'Başkanlık'.
- Doğrulama (kod): #645 zaten karşılanıyordu (JobsPage:571 reporter görünüm listesi external-pending içermiyor); #647/#648/#656 paralel commit `73aff14` ile uygulanmıştı ama `isReporter` (tüm reporterlar) ile.
- [x] Daraltma: `isPresidencyReporter = isReporter && user?.departmentName === 'Başkanlık'` helper'ı eklendi; grid + detay `canReporterEdit` artık `isPresidencyReporter` kullanıyor → her zaman aktif Düzenle yalnızca Başkanlık birimindeki Üst Düzey Yönetici'lere özel. #645 (external-pending) tüm reporterlar için zaten gizli bırakıldı (Başkanlık'ı kapsar; daraltmak Başkanlık dışı reporterlara yönetici görünümünü geri ekler → regresyon). FE build + lint PASS.

## Round 66 (Doing batch — 6 kart: #646 #633 #610 #638 #585 #637)
- [x] `#646` — Başkanlık seviyesi üst düzey yönetici (Reporter + Başkanlık birimi), Taleplerim → Bekleyen/Yapılmakta Olan/Son Tarihi Geçmiş detayında Ekler/Fotoğraflar bölümünde artık "Talep onaylandığı için... eklenemez" yerine "Dosya ekle" görüyor. JobsPage attachment bloğunda (Location A) `canPresidencyEditAttachments = isPresidencyReporter && isMyRequestsView && view ∈ {pending,in-progress,overdue}` eklendi; `canEditJobAttachments`'a OR'landı → `showAttachmentLockNotice` otomatik gizleniyor, upload kontrolü açılıyor. Backend kontrol: UploadAttachmentCommand/AttachmentsController durum/rol gating yapmıyor (yalnızca tenant + dosya türü/boyut) → UI değişikliği yeterli. FE build + lint PASS. (Runtime exercise edilmedi — seed yok; Başkanlık reporter + onaylı talep gerekiyor.)
- [x] `#638` `#585` — BEST-EFFORT (kullanıcı "push best-effort" dedi). Tarayıcı zoom'u (%80↔%90) reflow'unun kök nedeni: `globals.css`'te içerik genişliği 1024px üstünde tam genişlikti AMA 1680–1919px arası `min(100%,100rem)` (1600px ortalı) ile sınırlıydı, ≥1920'de yine tam genişlik. Yani tarayıcı zoom'u innerWidth'i 1680/1920 sınırlarından geçirince içerik 1600px-ortalı ↔ tam-genişlik arasında sıçrayıp yatay reflow yapıyordu. 1680 width cap'i kaldırıldı (≥1024 her zaman tam genişlik) → sınır geçişinde reflow yok. Canlı prod'da (Claude Chrome, Test Mudur) doğrulama: otomasyon viewport'u 1414px'e kilitli + tarayıcı zoom'u set edilemiyor, bu yüzden tam 1920/%90 durumu reprodüksiyon edilemedi; değişiklik mantıkla hedeflendi. FE build + lint PASS.
- [x] `#610` `#637` — BEST-EFFORT. 15.6"/yüksek zoom'da banner altındaki filtre çipleri (butonlar) banner ile gridview arasında sıkışmış/üstüne binmiş görünüyordu. Canlı prod ölçümü: banner ile çipler arası boşluk ~10px, ama `.sticky-page-header` gölgesi `0 18px 36px` ~50px aşağı taşıyor → çipler banner'ın koyu gölgesinde kalıyor. Düzeltme: gölge `0 6px 16px`'e hafifletildi + `.scope-chips` padding-block 0.2rem→0.45rem (daha fazla nefes payı) + `position:relative`. Canlı prod'a CSS enjekte edilip doğrulandı: çipler/tablo net ayrık, regresyon yok. (Boşluklar zoom ile büyüdüğü için literal "tablo butonların üstüne çıkıyor" reprodüksiyon edilemedi; gerçek neden büyük olasılıkla CSS zoom+sticky render artefaktı — kullanıcı 1920/%90'da doğrulayıp gerekirse yeniden açar.)
- [x] Yan düzeltme (lint gate): `eslint.config.js`'e `@typescript-eslint/no-unused-vars` için `argsIgnorePattern/varsIgnorePattern/caughtErrorsIgnorePattern: '^_'` eklendi — `_appearance` (no-op `applyTenantBrowserBranding`) gibi bilerek-kullanılmayan `_` önekli adlar artık doğru şekilde yok sayılıyor (config'te bu kural eksikti, `theme.ts:134` lint'i kırıyordu). `useColumnFilters.ts`'teki artık gereksiz `eslint-disable` direktifi kaldırıldı. FE build + lint PASS.
- [x] `#633` — Bildirim rozeti tek tıkla birden çok azalıyordu (9→4). Kök neden: rozet = gerçek okunmamış (Notifications) + geçmiş okunmamış (AuditLog türevli, #634). Geçmiş bildirimler **imleçle** (NotificationReadCursor) okunuyordu; #640'ta tek tıklama imleci o olayın zamanına ilerletiyordu → o olay + **daha eski tüm** olaylar okunmuş sayılıyordu (rozet birden çok düşüyordu). Çözüm: geçmiş bildirimler için **tekil** okuma izi — yeni `NotificationAuditRead (TenantId,UserId,AuditLogId)` entity + migration `AddNotificationAuditRead` (unique index). `MarkNotificationReadCommand` audit kaydında artık imleci ilerletmek yerine tek satır ekliyor (idempotent); `GetUnreadNotificationCountQuery` ve `GetNotificationsQuery` tekil okunanları hariç tutuyor. "Hepsini okundu yap" hâlâ imleci ilerletir (MarkAllNotificationsReadCommand değişmedi). FE: NotificationBell panel açılınca unread-count invalidate edilir (rozet tıklamadan önce güncel olur). BE build + 10 test + FE build + lint PASS. (Runtime exercise edilmedi — seed yok; başka kullanıcının ürettiği audit olayları gerekiyor.)

## Round 67 (Doing batch — 3 kart: #661 #650 #660; canlı prod (Claude Chrome) inceleme)
- [x] `#661` — Tüm sayfalardaki banner üstündeki "← Geri" butonu, banner'ın (`.desktop-page-shell`, padding-inline 1/1.5/2rem) sol başlangıç hizasının solunda kalıyordu çünkü AppShell'de Geri butonu `<main>` içindeki `.desktop-page-shell` kardeşinin sahip olduğu yatay iç boşluğa sahip değildi. Geri sarmalayıcı div'e `px-4 sm:px-6 lg:px-8` eklendi → banner sol hizasıyla aynı. FE build + lint PASS.
- [x] `#650` — Taleplerim / Birime Gelen / Birimden Giden detay pop-up'ında "Talep Detayları" başlık bölümü, Görev pop-up'undaki "İlgili Talep Detayları" / "Görev Detayları" kutularıyla aynı kart tasarımına getirildi: `mb-5 border-t border-slate-200 pt-3` (yalnızca üst çizgi) → `form-card page-stack mb-5` (tam kenarlıklı kart); başlıktan `mb-2` kaldırıldı (page-stack gap idare ediyor). FE build + lint PASS.
- [x] `#660` — Başkanlık seviyesi üst düzey yönetici (isPresidencyReporter), Taleplerim → "Tüm Taleplerim" (activeJobView==='all') gridview'inde iptal edilemeyen satırlarda görsel bütünlük için pasif "İptal" görür. JobsPage satır eylemlerindeki İptal bloğu IIFE'ye çevrildi: iptal edilebilir durumda aktif `Button` (destructive); değilse + isPresidencyReporter + all görünüm → `DisabledActionButton` (destructive, hoverTitle "Bu kayıt iptal edilemez"); aksi halde null. FE build + lint PASS.
- NOT: Canlı prod inceleme sırasında Chrome eklenti bağlantısı düştü; #661/#650 deterministik CSS/yapı değişikliği, #660 kapsamlı mantık değişikliği — build+lint temiz, deploy sonrası kullanıcı doğrulaması bekleniyor (yanlışsa yeniden açılır).

## Round 68 (Doing batch — #664 #663: gridview Durum sütunu etiket + renk)
- [x] `#664` — "Tüm" gridview'lerinde Durum sütununda "Aktif" (öyle bir statü yok) ve "Yapıldı" görünüyordu. Kök: ham enum etiketleri (`enum.jobStatus.Active`="Aktif", `enum.taskStatus.{Completed,Closed,PendingCloseApproval}`="Yapıldı") — Birime Gelen ve detay pop-up'larında kullanılıyor. (Taleplerim/Görevlerim/Birimdeki/Personelimin "all" hücreleri zaten getJobDisplayStatus/getTaskDisplayStatus kullanıyordu → doğru etiket.) Locale düzeltildi (tr+en): Active→"Yapılmakta Olan"/"In Progress", Completed/Closed/PendingCloseApproval→"Tamamlanmış"/"Completed". Global olduğu için ekran görselindeki Birime Gelen dahil her yerde "Aktif"/"Yapıldı" kalkar. FE build + lint PASS.
- [x] `#663` — Aynı "Tüm" gridview'lerde Durum hücresi arka plan rengi: Tamamlanmış→yeşil, İptal/Reddedildi→kırmızı, Yapılmakta→sarı, Son Tarihi Geçmiş→turuncu, Bekleyen/diğer→nötr (mevcut). localization.ts'e `getJobStatusTone`/`getTaskStatusTone` (getJob/TaskDisplayStatus mantığıyla paralel) + `getStatusPillClass(tone)` eklendi. JobsPage Taleplerim all hücresi (1390) ve TasksPage Görevlerim/Birimdeki/Personelimin all hücresi (1775) `StatusPill tone="neutral"` → `className={getStatusPillClass(...)}`. StatusPill `cn`=twMerge olduğu için renk sınıfları nötr varsayılanı override eder. FE build + lint PASS.
- NOT: Canlı doğrulama deploy sonrası (Chrome bağlantısı dalgalıydı); etiket locale + renk twMerge davranışı kod düzeyinde doğrulandı.

## Round 69 (Doing — #670: Tüm Görevlerim başlık çakışması)
- [x] `#670` — Görevlerim → Tüm Görevlerim'de "Sıra" ile "Bağlı Olduğu Talep No" başlıkları iç içe geçiyordu. Kök: `.my-tasks-all-table` `table-layout:fixed` + başlık hücreleri `white-space:nowrap` (ortalı) → uzun "BAĞLI OLDUĞU TALEP NO" başlığı sabit kolon genişliğine sığmayıp ortadan iki yana taşıyor, dar "Sıra" kolonunun üzerine biniyordu. (Önceki düzeltme ilk kolonu 4.5rem yapmıştı ama başlık taşmasını çözmüyordu.) Çözüm: `.my-tasks-all-table thead th` için `white-space:normal; overflow-wrap:break-word; line-height:1.18` → başlıklar kolon içinde sarılıyor, taşma/çakışma yok. globals.css (1024px bloğu) sadece. FE build + lint PASS. (Canlı doğrulama bekliyor — Chrome bağlantısı kapalı.)

## Round 70 (Doing — #674 #675: Ekrana Yansıt başlık)
- [x] `#674` — Ekrana Yansıt (WallboardPage /display) hero'sunun en sol üst köşesine ana sayfadaki (sidebar) kurum logosu eklendi: `useTenantTheme()` → `appearance.logoUrl`, `<MunicipalitySeal compact src={logoUrl} />` `wallboard-brand`ın başına (fullscreen butonundan önce). FE build + lint PASS.
- [x] `#675` — Ekrana Yansıt'ta saatin soluna takvim ikonu + tarih eklendi: `wallboard-clock` içine `<CalendarDays/>` + `formatClockDate(lastUpdatedAt)` (gg.aa.yyyy), mevcut Clock3+saatin soluna. `formatClockDate` helper'ı eklendi. FE build + lint PASS.
- NOT: Canlı doğrulama bekliyor (Chrome bağlantısı kapalı).

## Round 71 (Doing — #674 #675 yeniden açıldı: Ekrana Yansıt logo/saat düzeltme)
- [x] `#674` (reopened) — Ekrana Yansıt'ta istenen görsel kurum CRESTİ değil, ana sayfa sidebar'ının sol üst köşesindeki **Atatürk** görseliymiş (`/header-ataturk.png`, ek: ataturk_ekranayansit.png). Önceki turda eklediğim `MunicipalitySeal` (tire belediyesi arması) kaldırıldı; yerine AppShell sidebar'daki ile aynı `<img src="/header-ataturk.png" className="h-16 w-auto opacity-80 pointer-events-none">` wallboard-brand başına eklendi. Kullanılmayan MunicipalitySeal/useTenantTheme importları ve logoUrl kaldırıldı.
- [x] `#675` (reopened) — (a) Saat verisine **saniye** eklendi: `formatTime` `{hour,minute,second:'2-digit'}` → ss:dd:ss. (b) Ok ile gösterilen "tire belediyesi" arması zaten #674 kapsamında kaldırıldı (MunicipalitySeal). (Önceki turda eklenen takvim ikonu + tarih korundu.)
- NOT: Canlı doğrulama bekliyor (Chrome bağlantısı kapalı). /header-ataturk.png public/ içinde mevcut. FE build + lint PASS.

## Round 72 (Doing — #674 (3.kez) #676: Ekrana Yansıt köşe hizası + canlı saat)
- [x] `#674` (reopened, köşe hizası) — Atatürk görseli inline (wallboard-brand içinde, sayfa padding'inden içeride) duruyordu; ana sayfadaki gibi en sol en üst köşeye flush hizalandı: `<img>` wallboard-brand'ten çıkarılıp `.wallboard-page`'in doğrudan çocuğu yapıldı, `absolute left-0 top-0 z-10 pointer-events-none`; `.wallboard-page`'e `position: relative` eklendi (globals.css). AppShell sidebar'daki konumlandırmayla aynı.
- [x] `#676` — Saat saniyeleri saymıyordu (lastUpdatedAt = son yenileme anı, sabit). Canlı saat: `now` state + her 1 sn `setInterval(() => setNow(new Date()))`; saat artık `now`'dan tarih+saat(saniyeli) gösteriyor, her saniye ilerliyor. Kullanılmayan `lastUpdatedAt`/`setLastUpdatedAt` kaldırıldı. FE build + lint PASS.
- NOT: Canlı doğrulama bekliyor (Chrome bağlantısı kapalı).

## Round 73 (otonom 30dk döngü — #703: görev detayı onay tarihi etiketleri)
- [x] `#703` — TasksPage "İlgili Talep Detayları" özetinde: cross-department talepte "Talebi Oluşturan Departman'ın Onay Tarihi" → "Talebin Birim Yöneticisinin Onay Tarihi"; altına "Talebi Gerçekleştiren Birim Yöneticisinin Onay Tarihi" (görevin atandığı/hedef birimin `decidedAtUtc`) eklendi (`fulfillingJobDepartment` = `assignedDepartmentId`'e eşleşen JobDepartment). JobsPage'deki Owner/Target ayrımıyla aynı yaklaşım; yeni alan yalnızca cross-department talepte gösterilir. FE build + lint PASS. main+master push, Done.
- NOT: Kullanıcı sahada değilken otonom döngünün ilk kartı; veriye bağlı detay görünümü, seed yok → kod düzeyinde + build/lint doğrulaması.

## Round 74 (otonom 30dk döngü — #704: Birime Gelen onay bekleyen detay durumu)
- [x] `#704` — Birime Gelen → Onay Bekleyen detay pop-up'ında (JobsPage `/request-details`, `context=incoming`), birim-dışı talep sahibi birim onaylayıp iş `Active` olsa bile hedef birim yöneticisi henüz personel atamadıysa (görev yok) Durum "Yapılmakta" görünüyordu. Kök: pop-up etiketi `detail.status === 'Active' ? 'Yapılmakta'`. Bu satırın başına koşul eklendi: `isIncomingRequestDetail && status==='Active' && tasks boş` → "Yönetici Onayı Bekliyor"; yönetici görev atayınca (taskCount>0) "Yapılmakta"ya geçer. Değişiklik yalnızca incoming bağlamına kapsamlı (diğer detay görünümleri/`getJobStatusLabel` etkilenmedi). FE build + lint PASS. main+master push, Done.
- NOT: `isJobPendingTargetApproval` (Active+tasks boş) zaten modellenmiş durumdu; aynı ölçüt etiket için kullanıldı. Veriye bağlı görünüm, seed yok → kod düzeyinde + build/lint doğrulaması.

## Round 75 (otonom 30dk döngü — #705 #706 #708 #709: görev detayı pop-up düzeltmeleri)
Kartların ekran görselleri Trello'dan indirilip incelendi (gerçek UI durumunu netleştirdi).
- [x] `#705` — Görev Detayları özet kartında "Öncelik", orta kolon başından sol kolona "Görev Tipi"nin hemen altına alındı. TasksPage (Görevlerim) + JobsPage (Birime Gelen "Görev Detayları") pop-up'ları card 649 ile birebir aynı tutulduğu için ikisinde de uygulandı; TasksPage sol kolon alt-sınır çizgisi yeni son satır "Öncelik"e taşındı. FE build+lint PASS. main+master, Done.
- [x] `#706` — "Talep Onay Tarihi" → "Talebin Birim Yöneticisinin Onay Tarihi". TasksPage'te #703'le eklenen ternary'nin else dalı sabitlendi (artık birim-içi/dışı fark etmeksizin tek etiket) + JobsPage `requestDetailRows` yazdırma tablosu. İkisi de Owner birim `decidedAtUtc`. FE build+lint PASS. main+master, Done.
- [x] `#708` — Görev detay pop-up'ı "İlgili Talep Detayları"nda "Son Tarih Bilgisi" → "Son Tarih" (TasksPage:1596, ekran görselinde işaretli). Yazdırma tablosundaki aynı etiket kart "pop up'ta" diye kapsamladığı için dokunulmadı. FE build+lint PASS. main+master, Done.
- [x] `#709` — Birime Gelen "Görev Detayları"nda Görev Tipi "Atanmış Ad" → "Atanmış (Ad)" (JobsPage:2072-74, `assignedUserDisplayName` paranteze alındı); Görevlerim pop-up'ındaki (TasksPage:1227, zaten parantezli) formatla eşitlendi. FE build+lint PASS. main+master, Done.
- NOT: #709 önce TasksPage:1227 sanılmıştı (orası zaten parantezli); ekran görseli sayesinde gerçek yerin JobsPage Görev Detayları olduğu görüldü. Veriye bağlı pop-up'lar, seed yok → kod düzeyinde + build/lint + ekran görseli doğrulaması.

## Round 76 (otonom 30dk döngü — #710 #711: tamamlanma/iptal tarihi gösterimi)
Konvansiyon: tamamlanma=`completedAtUtc` ("Tamamlanma Tarihi"), iptal=`updatedAtUtc` ("İptal Tarihi") — kod tabanında zaten böyle (JobsPage/TasksPage rejected/completed görünümleri).
- [x] `#710` — Görev Detayları özet pop-up'ında "Son Tarih"ten önce koşullu satır: Completed → "Tamamlanma Tarihi" (completedAtUtc), Cancelled → "İptal Tarihi" (özet `selectedTask.updatedAtUtc`; TaskDetail'da updatedAtUtc yok). TasksPage (Görevlerim) + JobsPage (Birime Gelen, `detail.tasks`) ikisine de uygulandı (card 649). FE build+lint PASS. main+master, Done.
- [x] `#711` — "Tümü/Tüm" gridview Durum sütununda pill'in altına: Completed→tamamlanma tarihi, Cancelled→iptal tarihi (küçük gri metin, `flex flex-col`). Tek hücre/sayfa ile tüm görünümler: TasksPage `showStatusColumn` (Görevlerim/Birimdeki "Tüm Görevler" + Personelimin "Tüm Personel"), JobsPage all-view (Taleplerim + Birimden Giden "Tümü"), IncomingRequestsPage all-view (Birime Gelen "Tümü"). Ekran görseli (711.png) ile doğrulandı. FE build+lint PASS. main+master, Done.
- NOT: Yalnızca raw `currentStatus`/`status` === Completed/Cancelled koşulu (overdue/rejected'a tarih eklenmez — kart yalnızca tamamlanmış/iptal diyor). Veriye bağlı, seed yok → kod + build/lint + görsel doğrulaması.

## Round 77 (otonom 30dk döngü — #709(reopened) #712 #713: yönetici adı + Son Tarih border)
- [x] `#709` (reopened) — Birime Gelen "Görev Detayları"nda Görev Tipi "Atanmış" görevde görev SAHİBİNİ gösteriyordu (önceki turda `assignedUserDisplayName` paranteze almıştım); kullanıcı ATAYAN YÖNETİCİ adını istedi. **Backend**: `TaskSummaryResponse`'a opsiyonel `AssigningManagerDisplayName` eklendi (3 call-site'tan yalnızca JobQueries dolduruyor; diğerleri default null → değişmedi), JobQueries görev projeksiyonu komşu `AssignedUserDisplayName` subquery deseniyle `t.AssigningManagerId`→DisplayName doldurdu. EF expression-tree pozisyon-dışı isimli argüman kabul etmediği için (CS9307) tüm pozisyonel argümanlar verildi (JobCreatedAtUtc=null, HasPendingExtraTimeRequest=false önceki davranışla aynı). **Frontend**: Task tipine `assigningManagerDisplayName` + JobsPage taskType. dotnet build + FE build/lint PASS. main+master, Done.
- [x] `#712` / `#713` (duplike) — Görev Detayları / İlgili Talep Detayları özet kartlarında orta kolon sol kolondan kısa olunca son satır "Son Tarih"in altında kapanış çizgisi yoktu (713b: Rutin görev Görev Detayları; 712b: İlgili Talep Detayları). `Son Tarih` satırına `border-b` eklendi: TasksPage Görev Detayları orta kolon + İlgili Talep rightFields, JobsPage Görev Detayları orta kolon (card 649). Tek commit; #713'e duplike yorumu düşüldü. FE build+lint PASS. main+master, Done.
- NOT: #709 ilk turda yanlış alan (`assignedUserDisplayName`) kullanılmıştı; ekran görseli (Görev Sahibi=Görev Tipi adı aynı) sayesinde yönetici≠sahibi olduğu görüldü. Backend değişikliği komşu çalışan deseni taklit ettiğinden EF runtime riski düşük; seed yok → build doğrulaması.

## Round 78 (otonom 30dk döngü — #714: tarih pill'in İÇİNE)
- [x] `#714` — #711'de "Tümü/Tüm" gridview Durum sütununda tamamlanma/iptal tarihini pill'in DIŞINDA alt satıra koymuştum; kullanıcı tarihin pill ÇERÇEVESİNİN İÇİNDE (durum metninin altında) olmasını istedi. Üç hücre (TasksPage showStatusColumn, JobsPage all-view, IncomingRequestsPage all-view) IIFE ile `statusDate` (Completed→completedAtUtc, Cancelled→updatedAtUtc) hesaplayıp StatusPill içeriğini `flex flex-col items-center leading-tight` ile iki satıra çıkardı (tarih `text-[0.68rem] opacity-80`). FE build+lint PASS. main+master, Done.

## Round 79 (otonom 30dk döngü — #715: Talep Detayları tamamlanma/iptal tarihi)
- [x] `#715` — #710'un (Görev Detayları) talep karşılığı: JobsPage "Talep Detayları" rightFields'ında "Son Tarih"ten önce Completed→"Tamamlanma Tarihi" (detail.completedAtUtc), Cancelled→"İptal Tarihi" (detail.updatedAtUtc). İptal tarihi alanı JobDetail'da yoktu → **Backend**: `JobDetailResponse`'a opsiyonel `UpdatedAtUtc` eklendi (tek call-site JobQueries `job.UpdatedAtUtc` ile pozisyonel doldurdu) + frontend JobDetail tipine `updatedAtUtc`. Ekran görseli (715.png, Birime Gelen; alttaki Görev Detayları'nda #710'un Tamamlanma Tarihi'si zaten çalışıyordu) ile doğrulandı. JobsPage "Talep Detayları" Taleplerim/Birimden Giden/Birime Gelen'de ortak. dotnet build + FE build/lint PASS. main+master, Done.
- NOT: TasksPage "İlgili Talep Detayları" (task detayındaki üst-talep özeti) bilinçli olarak DOKUNULMADI — kart + görsel JobsPage "Talep Detayları"nı hedefliyor, ikisi arasında "aynı tutulur" invariant'ı yok (card 649 gibi). İstenirse oraya da eklenebilir.

## Round 80 (otonom 30dk döngü — #716: Görev Detayları "Oluşturan" yanlış)
- [x] `#716` — Birime Gelen "Görev Detayları"nda "Talep Yeri / Oluşturan" görevi oluşturan yöneticiyi gösteriyordu, talebi oluşturanı (G-2026-160 → Gamze Gürel) göstermeli. Kök: JobQueries görev projeksiyonu `createdByDisplayName`'i `t.CreatedByUserId` (görev oluşturan = onaylayan yönetici) ile dolduruyor; JobsPage `taskLocation` da onu tercih ediyordu. Fix: `detail.createdByDisplayName` (talep oluşturan) tercih edildi. TasksPage Görev Detayları'na dokunulmadı — GetTasksQuery `createdByDisplayName`'i zaten `job.CreatedByUserId`'den (talep oluşturan) alıyor, doğruydu (712b/713b ile teyit). FE build+lint PASS. main+master, Done.
- NOT: İki sorgunun `createdByDisplayName` semantiği farklı (JobQueries=görev oluşturan, GetTasksQuery=talep oluşturan) — bug bu tutarsızlıktandı; sadece görüntüleme katmanında düzeltildi (sorgu semantiği korundu).

## Round 81 (otonom 30dk döngü — 11 kart batch: #707 #717 #719 #720 #722 #723 #724 #725 #726 #727 #728)
Model classifier kesintisinde cron birkaç kez boşa tetiklendi; kesinti bitince Doing'de birikmiş 11 kart sırayla işlendi. Görselli kartlar (#719/#720/#726) Trello'dan indirilip incelendi.
- [x] `#707` — TasksPage "İlgili Talep Detayları" rightFields yatay (etiket+yanında değer) yerine dikey (etiket satırın tamamı, tarih alt satırda); JobsPage "Talep Detayları" stiliyle aynı. FE PASS.
- [x] `#717` — #714 rafine: pill içindeki tamamlanma/iptal tarihi `opacity-80` yerine `text-black` (siyah). 3 gridview hücresi. FE PASS.
- [x] `#719` — Görevlerim Görev Detayları "Görev Sahibi" yönlendirme sonrası eski sahibi gösteriyordu (sadece ownerDisplayName); `assignedUserDisplayName ?? ownerDisplayName` (güncel atanan) yapıldı — JobsPage konvansiyonuyla aynı. AssignTaskCommand OwnerUserId'i değiştirmiyor, sadece AssignedUserId. FE PASS.
- [x] `#720` — Atama Geçmişi'nde ilk atama yoktu (AssignmentHistory yalnızca AssignTask/ClaimFromPool'da). CreateTaskCommand + JobOwnerTaskProvisioning'e ilk-atama kaydı (From=null, To=ilk atanan, ActionDateUtc=oluşturma) eklendi. ActionDateUtc artan sıralı → ilk atama en üstte. **Yalnızca yeni görevler için** (geriye dönük kayıt yok — karta yorum düşüldü). dotnet build PASS.
- [x] `#722` — Tamamlanmış/İptal gridview'lerinde (Görevlerim/Birimdeki, Taleplerim/Birimden Giden, Birime Gelen) kullanıcı sıralaması yokken en yeni tarihli üstte: completed→completedAtUtc, cancelled→updatedAtUtc desc. 3 sayfa. FE PASS.
- [x] `#723` — TasksPage Görev Detayları'nda dosya eki varsa Açıklama'nın yanına "Görev Ekleri" sütunu (ek isimleri); grid 3→4. JobsPage Görev Detayları'na eklenmedi (görev özetinde attachment yok, backend gerektirir — karta yorum). FE PASS.
- [x] `#724` — UpdateJobCommand sadece Draft/onay-bekleyen düzenlemeye izin veriyordu; artık terminal (Completed/Cancelled/Rejected) hariç düzenlenebilir (Active dahil). Hedef-departman değişikliği güvenlik için onay-öncesi'yle sınırlandı. Frontend buton zaten etkindi. dotnet build PASS.
- [x] `#725` — Görev Detayları status "Yapılmakta" (Assigned/InProgress) turuncu (text-[#f97316]) — Talep Detayları ile aynı. TasksPage + JobsPage. FE PASS.
- [x] `#726` — Talep Detayları'nda Adres Bilgileri / Yönetici Notu / Ekler başlıklarının altına ayraç (border-b + pb-2). FE PASS.
- [x] `#727` — Talep Detayları Yönetici Notu satır-içi ekle/değiştir/sil: Reporter+Manager+SystemAdmin, Taleplerim/Birimden Giden, terminal değilse. Not yoksa textbox+"Not Ekle"; not varsa görüntü+"Değiştir/Sil" tetikleyici → textbox + yeşil "Değiştir" + kırmızı "Sil". Backend SetJobManagerNoteCommand zaten add/update/delete(null) destekliyordu → frontend-only. canEditManagerNote genişletildi, kullanılmayan isJobPendingTargetApproval kaldırıldı. FE PASS.
- [x] `#728` — Talep/Görev detay pop-up'larında "Tamamlanma Tarihi" değeri yeşil (emerald-600), "İptal Tarihi" değeri kırmızı (red-600). #710/#715 entry value'ları renkli span. TasksPage + JobsPage (2 kutu). FE PASS.
- NOT: Tümü ayrı commit, main+master push. #720/#724/#727 backend de içerdi (dotnet build + FE yeşil). Veriye bağlı görünümler, seed yok → kod + build + ekran görseli doğrulaması. #727 çok durumlu UX olduğundan kullanıcı dönünce gözle teyit önerilir.

## Round 82 (otonom 30dk döngü — #729 #730 #732 #733 yapıldı; #731 ERTELENDİ)
- [x] `#733` — Talep Detayları'nda "Koordine Departman Ekle" başlığına ayraç (border-b+pb-2), #726'yla aynı. FE PASS.
- [x] `#729` — Birimdeki Görevler İşlemler sütununda rutin/yönlendirilemeyen görevlerde pasif "Yönlendir" (DisabledActionButton) — görsel bütünlük. Önceki yalnızca-overdue pasif durumu genelleştirildi. Ekran görseli ile teyit. FE PASS.
- [x] `#730` — Personelimin Görevleri'nde belirli personel seçildiğinde de Durum sütunu (Son Tarih'ten sonra). showStatusColumn staff görünümünde currentStaffUserId kısıtından çıkarıldı (`|| isStaffTasksView`). FE PASS.
- [x] `#732` — Kontrol Paneli'nden "Genel Talep Özeti" (summaryChart) kaldırıldı + "Vatandaş Talep Kanalları"nda ham "channel.EDevlet" düzeltildi (enum'da EDevlet vardı, channel.* çevirisinde yoktu → tr "E-Devlet"/en "e-Government" eklendi). FE PASS.
- [ ] `#731` — **ERTELENDİ (Doing'de bırakıldı, karta yorum düşüldü).** Dashboard: "Müdürlük İş Dağılımı"→"Personelimin Tüm Görevleri" + 4 bölüm (Birimdeki/Görevlerim/Birimden Giden/Birime Gelen) için banner-buton sayımlarına bağlı pie chart. Bu sayım verileri dashboard'da yok (her sayfa client-side hesaplıyor) → yeni backend aggregation gerekir; "banner butonlardaki veriler" tam net değil; rename mevcut grafik verisiyle uyuşmuyor; görsel doğrulanamaz + prod auto-deploy. Kullanıcı girdisi bekleniyor.

## Round 83 (otonom 30dk döngü — #734, #723 reopened)
- [x] `#734` — "Tümü/Tüm" gridview Durum pill'i içindeki tamamlanma/iptal tarihi metni bold (font-normal → font-bold) — #717'nin (siyah) devamı. 3 hücre. FE PASS.
- [x] `#723` (reopened) — "Görev Ekleri" sütunundaki ek isimleri artık indirilebilir (api.downloadAttachment auth'lu blob → object URL, AttachmentSection yöntemiyle aynı); önceden salt isimdi. `handleDownloadTaskAttachment` eklendi. FE PASS.
- NOT: `#731` hâlâ Doing'de ERTELENMİŞ durumda (kullanıcı girdisi bekliyor); döngü onu tekrar denemiyor.

## Round 84 (otonom 30dk döngü — #694)
- [x] `#694` — Görev detayı "İlgili Talep Detayları" sol kolonunda son satır "Öncelik" altında kapanış çizgisi yoktu (sol kolon orta kolondan kısa → boşluk). leftFields wrapper'a `label === 'Öncelik'` border-b eklendi; #712/#713 (Son Tarih) ve JobsPage Talep Detayları (zaten border'lı) ile aynı. Ekran görseli (694.png) ile teyit. FE PASS.
- NOT: `#731` hâlâ ertelenmiş (kullanıcı girdisi bekliyor).

## Round 85 (manuel tur — #735: Yönetici Notu silme onayı)
- [x] `#735` — Talep Detayları > Yönetici Notu düzenleme görünümündeki "Sil" eylemi artık doğrudan silmiyor: "Notu silmek istediğinize emin misiniz?" onay diyaloğu, `Sil` ve `İptal` seçenekleriyle açılıyor. Onay verilirse mevcut silme akışı çalışıyor. FE build + lint PASS. main+master, Done.

## Round 86 (manuel tur — #740: birim içi yönetici onay tarihi)
- [x] `#740` — Birim yöneticisinin kendi biriminde oluşturup kendine atadığı birim içi talepte hedef (`Target`) departman kaydı bulunmadığından "Talebi Gerçekleştiren Birim Yöneticisinin Onay Tarihi" boş kalıyor ve "Onay Bekleyen" yazıyordu. Talep Detayları artık bu yalnızca-birim-içi durumda Owner yöneticisinin `decidedAtUtc` değerini fallback olarak gösteriyor. FE build + lint PASS. main+master, Done.

## Round 87 (manuel tur — #743 güvenlik beklemesi)
- [ ] `#743` — Doing'de bırakıldı ve Trello'ya açıklayıcı yorum eklendi. Incoming detay popup'ındaki header `Onayla` mevcutta yalnızca `PendingOwnerApproval` yöneticisine gösteriliyor; T-2026-177 için gerçek onay bağlamı/görsel olmadan koşulu genişletmek yanlış onay veya personel atama yetkisi açabilir. Kullanıcıdan hangi onay eyleminin beklendiği netleştirilmeli. Push yapılmadı.

## Round 86 (otomasyon — #732 #736 #738 #739 #745)
- [x] `#732` — Önceki turda tamamlanan Kontrol Paneli "Genel Talep Özeti" kaldırma ve E-Devlet çevirisi için kart Done'a taşındı.
- [x] `#736` — Yönetici Notu, çıkış tarafındaki talep tamamlanana/iptal edilene kadar düzenlenebilir; mevcut #727 akışı kart gereksinimini karşılıyor. Kart Done'a taşındı.
- [x] `#738` — Görev Detayları'ndaki "Görevi Tamamla" bölümü daraltıldı; başlık küçültülüp yeşile alındı.
- [x] `#739` — Tamamlama bölümünde bu oturumda yüklenen ekler görev tamamlanmadan detay kapatılırsa siliniyor; dosya ekle düğmesi de küçültüldü.
- [x] `#745` — "Görev Ekleri" başlığı/yükleme alanı Görevi Tamamla kartının başlık alanına yerleştirildi.
- [x] `#737` — Detay modalı kapanırken aktif banner görünümünün sorgu parametreleri korunuyor; yalnızca geçici `taskId` temizleniyor. Ek değişiklik gerekmeden kart Done'a taşındı.
- Verification: `frontend npm run build` PASS; `frontend npm run lint` PASS (yalnızca önceden var olan JobsPage hook uyarısı). #738/#739/#745 commit `540fe54`, main+master push; kartlar Done'a taşındı. #731 önceki ertelenme gerekçesi nedeniyle yeniden denenmedi.

## Round 87 (otomasyon — #741; daha önce tamamlanan #736/#739 kapatıldı)
- [x] `#741` — Birime Gelen Talepler > Onay Bekleyen satırlarında Normal öncelik metni amber zemin üzerinde beyazdı; kontrast için `text-slate-900` yapıldı. FE build PASS; lint PASS (yalnızca mevcut JobsPage hook uyarısı). Commit `ca17103`, main+master push; Done.
- [x] `#736`, `#739` — Önceki Round 86'da doğrulanmış olan kartlar Doing'de kaldığından kod değişikliği olmadan Done'a taşındı.
- NOT: `#731` önceki ertelenme gerekçesiyle (kullanıcı kararı bekleniyor) yeniden denenmedi ve Doing'de bırakıldı.

## Round 73 (Doing — #677: "Sıra" başlığı sarılması, #670 regresyonu)
- [x] `#677` — Görevlerim → Tüm Görevlerim'de "Sıra" başlığı "Sı/ra" olarak alt satıra geçiyordu (15.6"/1920). Kök: #670 fix'i `.my-tasks-all-table thead th { white-space: normal }` ile TÜM başlıkları sarılabilir yaptı; kısa "Sıra" da dar ilk kolonda (4.5rem) bölündü. Çözüm: `.my-tasks-all-table thead th:first-child { white-space: nowrap }` — "Sıra" tek satır, uzun başlıklar hâlâ sarılır. globals.css. FE build + lint PASS. (Canlı doğrulama bekliyor.)

## Round 74 (Doing — #759: Kontrol Paneli pie chart başlık/lejant tıklanabilir)
- [x] `#759` — Kontrol Paneli'ndeki pie chart başlıkları + lejant (pie yanındaki) metinleri tıklanabilir yapıldı, ilgili sayfaya yönlendiriyor. DashboardPage'e `CHART_ROUTES` (titleKey→rota) eklendi: staffTasks→/staff-tasks, departmentTasks→/department-tasks?flow=all, myTasks→/my-tasks, myRequests→/my-requests, incomingRequests→/incoming-requests, outgoingRequests→/outgoing-requests, citizenChannels.title→/social. Başlık `<h2>` rota varsa `<button onClick navigate>` (hover underline) oluyor; `PieChart`'a `onSelect?` prop'u eklendi → lejant etiketleri tıklanabilir buton (hover underline), tıklanınca chart'ın rotasına gider. FE build + lint PASS (mevcut, ilgisiz useMemo deps uyarısı hariç).

## Round 75 (Doing — #760 #761)
- [x] `#760` — Kontrol Paneli pie chart renkleri: "İptal" kırmızı, "Bekleyen" sarı, "Son Tarihi Geçmiş" turuncu. Backend GetDashboardStatusChartsQuery: overdue colorHint "danger"→"orange", cancelled "neutral"→"danger" (task + job chartları). PieChart COLOR_MAP `warning` #f59e0b→#eab308 (Bekleyen net sarı, turuncu #f97316'dan ayrışsın). BE build + 18 test + FE build + lint PASS.
- [x] `#761` — Talep iptal/tamamlanmış (ve reddedilmiş = kapanmış) durumdaysa "Koordine Departman Ekle" pasif. JobsPage detay koordinasyon sütunu IIFE'ye alındı: `isClosedRequest = status ∈ {Completed,Cancelled,Rejected}`; MultiSelectDropdown ve Ekle butonu `disabled`'ına eklendi. FE build + lint PASS.

## Round 76 (Doing — #762: Kontrol Paneli standart kullanıcı görev tipi filtreleri + etiketler)
- [x] `#762` — (1) Standart kullanıcılarda da "Görevlerim" grafiğinde Atanmış/Rutin/Tümü butonları (sağa yaslı, default Tümü); sayılar+pie görev tipine göre değişir. (2) "Birimdeki Görevler" 2 dilimli grafiğinde aynı butonlar; slice etiketleri "Bana Atanan Görevler"→"Benim Görevlerim", "Birimdeki Tüm Görevler"→"Birimdeki Görevler". Backend BuildStandardUserChartsAsync: myTasks `FilterTasks(tasks, MyTaskType)`, departmentTasks 2 dilimi `FilterTasks(tasks, DepartmentTaskType)` + departmentTaskCount sorgusuna SourceType filtresi. FE: filtre butonu kapısı `isManagerOrAdmin && TASK_CHART_KEYS` → sadece `TASK_CHART_KEYS` (standart kullanıcıda myTasks+departmentTasks gösterir; staffTasks onların grafik listesinde yok). Locale assignedToMe/departmentTotal (tr+en) güncellendi. Butonlar zaten justify-between ile sağa yaslı. BE build + 18 test + FE build + lint PASS.

## Round 77 (Doing — #759 reopened + #764)
- [x] `#759` (reopened) — Pie chart lejant metinleri artık dilime özgü, hedef sayfanın ilgili scope-chip'iyle FİLTRELİ gridview'a yönlendiriyor (önceden hepsi grafiğin genel sayfasına gidiyordu). DashboardPage'e `SLICE_VIEW` (dilim→view paramı) + `getSliceRoute(titleKey, sliceLabel)` eklendi: durum dilimleri `?view=pending/overdue/completed/rejected/approved/in-progress` (department-tasks'ta `&view=`), vatandaş kanal dilimi `/social?channel=X`, personel dilimleri /staff-tasks (kişi adı→tekil filtre yok), standart 2 dilim assignedToMe→/my-tasks & departmentTotal→/department-tasks. PieChart `onSelect` artık `(slice)=>void`; başlık tıklaması genel sayfaya (değişmedi). FE build + lint PASS.
- [x] `#764` — Pie chart'ta "Yapılmakta Olan" ile "Tamamlanan" renkleri yer değiştirildi: completed colorHint "success"→"primary" (task+job chart), inProgress "primary"→"success" (job chart). BE build + 18 test PASS.

## Round 88 (manuel tur — #1007: "Görev Tamamlama Notu" kolonu geri al)
- [x] `#1007` — Kart, `65a901a` ("Show task completion notes in Görevlerim grid column") commit'inin **geri alınmasını** istedi. `git revert --no-commit 65a901a` ile temiz geri alındı: GetTasksQuery projeksiyonundan `task.Notes`/`task.Description`, TaskSummaryResponseFactory'den `Notes:`/`Description:`, TaskContracts'tan `Notes` alanı, TasksPage'deki "Görev Tamamlama Notu" FilterableTh + hücre + kolon sayacı, ve tr/en `tasks.columns.completionNote` locale. Bağımlılık kontrolü: list `task.notes` yalnızca silinen kolonda kullanılıyordu; detay `taskDetail.notes` (ConfirmDialog "Tamamlama Notu") ve completion modalı `tasks.actions.completionNote` ayrı, dokunulmadı. dotnet build PASS (0/0); FE build + lint PASS (yalnızca mevcut 4 hook-deps uyarısı). main+master, Done.

## Round 89 (manuel tur — #1009: Talep Detayları kanal text'i siyah)
- [x] `#1009` — JobsPage "Talep Detayları" özet kartında "Vatandaş Talep No" yanındaki `(Vatandaş Talebi [ikon] WhatsApp)` bloğunun tamamı `text-orange-500` idi; kart yalnızca KANAL etiketinin (ör. WhatsApp) siyah olmasını istedi. `getSocialChannelLabel(...)` `<span className="text-slate-900">` ile sarıldı; "(Vatandaş Talebi" + parantezler turuncu kaldı, ikon kendi rengini korudu. Blok yalnızca JobsPage:1876'da (Taleplerim/Birimden Giden/Birime Gelen'de ortak); TasksPage'de bu blok yok. FE build + lint PASS (mevcut 4 hook-deps uyarısı). main+master, Done.

## Round 90 (manuel tur — #1011: Görevi Tamamla başlığı altı ayraç)
- [x] `#1011` — TasksPage "Görevi Tamamla" pop-up'ının `<h2>` başlığına ayraç eklendi (`mb-3 border-b border-slate-200 pb-2`), aynı modaldaki "Görevi Birim İçi Yönlendir" başlık konvansiyonuyla aynı. Başlık boyutu (text-xl font-extrabold) korundu. FE build + lint PASS. main+master, Done.

## Round 91 (manuel tur — #1008: Görevi Birim İçi Yönlendir helper text yukarı)
- [x] `#1008` — "Görevi Birim İçi Yönlendir" pop-up'ında "Görev sadece aynı birim içinde yönlendirilebilir." helper text'i biraz yukarı alındı. Başlık ile helper arası boşluk = page-stack grid gap (1rem) + başlık `mb-3` (0.75rem) ≈ 1.75rem idi; başlık `mb-3`→`mb-1` yapılarak helper ~0.5rem yukarı çekildi (helper-copy'nin kendi margin'i yok). Yalnızca bu modal başlığı; #1011'de complete modalına eklenen ayraç ayrı `<h2>`. FE build + lint PASS. main+master, Done.

## Round 92 (manuel tur — #1012 + #1010: tamamlama notu tag temizliği + küçük popup buton hizası)
- [x] `#1012` — Görev tamamlama notunda eski kayıtlardan kalma `<p>...</p>` HTML etiketleri literal görünüyordu (kart görseli #1007'de kaldırılan grid kolonundandı; ama notlar detay "Tamamlama Notu" pop-up'ında ve dışa aktarımda hâlâ ham). Tamamlama notu PLAIN textarea'dan kaydedildiğinden yeni notlarda tag yok; etiketler eski veriden. Yeni `utils/richText.ts` → `richTextToPlainText()` (etiket temizler, blok kapanışını \n yapar, entity + &nbsp;/U+00A0 çözer). Uygulandı: TasksPage Tamamlama Notu ConfirmDialog (1), JobsPage Tamamlama Notu ConfirmDialog (2), JobsPage print/export status metni (2). FE build + lint PASS. main+master, Done.
- [x] `#1010` — Küçük popup'larda (görsel: "Görevi Tamamla") sola dayalı Vazgeç/aksiyon butonları sağa alındı. `.inline-actions` 31 yerde (Settings formları, detay panelleri dahil) kullanıldığından global DEĞİŞTİRİLMEDİ; yalnızca TasksPage'deki bare `inline-actions` (3 adet: Tamamla, İptal, Yönlendir modalları) `justify-end` ile sağa yaslandı. `justify-start`'lı detay-paneli kullanımları etkilenmedi. FE build + lint PASS. main+master, Done.

## Round 93 (manuel tur — #1003: WhatsApp konuşması yönetici/personel için salt-okunur)
- [x] `#1003` — Görev/Talep detayından açılan WhatsApp konuşması (WhatsAppConversationModal, JobsPage+TasksPage'de kullanılıyor) `ConversationPanel`'a `canReply={false}` ile salt-okunur yapıldı; yanıt textbox'ı + gönder/şablon butonları gizlendi. Operatörün talep oluşturma akışı (CitizenRequestModal) `canReply` default true ile yazmaya devam ediyor; operatör /whatsapp sayfasından da yazabilir. Karar: sadece-frontend kapsam (kullanıcı onayı). Backend ReplyToSocialMessageCommand yetki kontrolü kapsam dışı bırakıldı. FE build + lint PASS. main+master, Done.

## Round 97 (Doing — #1042 #1047 #1048 #1049 #1050)
- [x] `#1047` — Birim dışı taleplerde `getExternalUnitOwnerDisplayStatus` artık "İşleme Alındı" döndürmez; yalnızca vatandaş taleplerinde kalır. FE build + lint PASS.
- [x] `#1048` — Atama geçmişi çerçevesi kaldırıldı; bullet (•) + kullanıcı + tarih listesi.
- [x] `#1049` — Tamamlanmış/iptal görevlerde atama geçmişi Açıklama yanında (header hizalı); alttaki blok gizlenir.
- [x] `#1050` — Rutin görevlerde Görev Atama Geçmişi alanı kaldırıldı (#1043 geri alındı).
- [x] `#1042` (reopened) — Tamamlama popup: textarea tam genişlik; Dosya ekle Vazgeç/Tamamla satırının solunda. FE build + lint PASS. main+master, Done.

## STATUS: Round 97 complete — Doing list drained (5 cards).

## Round 98 (Doing — #1046: Vatandaş Talepleri pie chart)
- [x] `#1046` — Reporter + Operator dashboard'a "Vatandaş Talepleri" pie chart: İşleme Alındı, Son Tarihi Geçmiş, Yapılmakta Olan, Tamamlanan, İptal dilimleri. Backend `GetDashboardStatusChartsQuery` citizen job sınıflandırması (SocialMessagesPage ile uyumlu). FE: locale, CHART_ROUTES, dilim tıklama → `/social?requestStatus=…`. SocialMessagesPage URL `requestStatus` okur. BE build + 29 test + FE build + lint PASS.

## STATUS: Round 98 complete — Doing list drained (1 card).

## Round 99 (Doing — Vatandaş Talep Yöneticisi rolü)
- [x] `CitizenRequestManager` rolü: enum + ek rol ataması + sayfa erişimi (dashboard + Birime Gelen Talepler). IncomingRequestsPage yalnızca vatandaş talepleri; VT- kayıtlarda Onayla/İptal. Backend: görev atama, iptal, hedef onay yetkileri. BE build + 29 test + FE build + lint PASS.

## STATUS: Round 99 complete — Doing list drained (1 card).

## Round 96 (Doing — #1045: Görev Atama Geçmişi başlık + veri)
- [x] `#1045` — "Görev Atama Geçmişi" başlığı Açıklama ile aynı stil (`text-xs uppercase tracking-wide text-slate-500`). Atama geçmişi satırlarından birim kaldırıldı; yalnızca kullanıcı adı + tarih. FE build + lint PASS. main+master, Done.

## STATUS: Round 96 complete — Doing list drained (1 card).

## Round 95 (Doing — #1042 #1043 #1044)
- [x] `#1043` — Rutin + tamamlanmış görev detayında sağ sütundaki "Görev Ekleri" kaldırıldı; yerine "Görev Atama Geçmişi" (boşsa "Atama geçmişi yok"). FE build + lint PASS.
- [x] `#1044` — `RecomputeStandardJobCompletionAsync`: tüm görevler iptal → talep `Cancelled` (Completed'dan düşürür); karışık terminal → `Active`. `ChangeTaskStatusCommand` audit + tek recompute. Unit test eklendi. BE build + 1 test + FE PASS. NOT: Mevcut tutarsız kayıtlar (T-2026-309) için görev durumunu tekrar değiştirmek gerekir.
- [x] `#1042` — "Görevi Tamamla" popup'ına sol sütunda "Dosya ekle" + seçilen dosya listesi (CitizenRequestModal deseni); tamamlamadan önce `uploadTaskAttachment`, vazgeç/kapatınca orphan silme. FE build + lint PASS.

## STATUS: Round 95 complete — Doing list drained (3 cards).
- [x] `#1005` — Görevlerim'de Tamamlanmış ve İptal (rejected view = Cancelled+Rejected; yalnızca Cancelled satırları) görevlerde İşlemler'de "Detaylar"ın soluna teal "Durum Değiştir" butonu. Açılan pop-up "Görevi Birim İçi Yönlendir" tasarımında: başlık "Görev Durum Değişikliği" + ayraç, "Görev durumunu değiştirmek için neden belirtiniz." helper, Neden textbox, "Talep Durumu Seç" dropdown (default "Görev durumu seçiniz", seçenekler Yapılmakta/Tamamlanmış/İptal eksi mevcut durum), Vazgeç + yeşil "Durum Değiştir". **Backend**: yeni `ChangeTaskStatusCommand` (`POST /tasks/{id}/change-status`, `ChangeTaskStatusRequest`): yalnızca Completed/Cancelled görevde; hedef InProgress/Completed/Cancelled; yetki `EnsureCanActAsAssigneeAsync` (atanan/SystemAdmin, kullanıcı kararı); audit "TaskStatusChanged"; job recompute + WhatsApp bildirim. InProgress'e geri alma: RecomputeJobCompletionAsync terminal'i geri düşürmediğinden talep manuel `Active`+CompletedAtUtc=null yapılıyor (yeni invariant eklendi). Hedef: InProgress→CompletedAtUtc=null/%=0; Completed→%=100/Notes=neden; Cancelled→RevisionReason=neden. dotnet build + FE build/lint PASS. main+master, Done.
- NOT: Veriye bağlı (Tamamlanmış/İptal görev + atanan kullanıcı), seed yok → kod + build doğrulaması; kullanıcı kendi ortamında (gerçek veri var) gözle teyit edebilir. feature-invariants.md §1 (reopen komutu artık VAR) + §2 (recompute demote etmez) güncellendi.

## Round 100 (Doing — #1052–#1060: UI polish batch)
- [x] `#1052` — Pop-up'lar backdrop tıklamasıyla kapanmıyor (`ModalBackdrop` + tüm sayfa/modal overlay'leri).
- [x] `#1053` — Görevi Tamamla popup'ında turuncu Görev No.
- [x] `#1054` — Rol matrisinde checkbox olmayan hücreler "Pasif".
- [x] `#1055` — WhatsApp FAB footer'dan yukarı (`bottom-20`); dış tıklama kapatması kaldırıldı.
- [x] `#1056` — Vatandaş talebinde "Talebi Onaylayan" hedef onayına kadar gizli (`shouldShowRequestApproverField`).
- [x] `#1057` — "Durum Değiştir" detay header'a (koyu mavi); rutin Tamamlanmış/İptal için Düzenle aktif.
- [x] `#1058` — Tamamlama sonrası detay yenileniyor; Görev Ekleri'nde ekler görünür.
- [x] `#1059` — Vatandaş→görev detayında İlgili Talep Detayları'ndan Durum kaldırıldı.
- [x] `#1060` — Görev durumu değişince bildirim: "Görev Durumu Değişti" + Görev No / başlık / Eski → Yeni. BE+FE build/lint PASS. Commit `bc4e807`, deploy, Done.

## STATUS: Round 100 complete — 9 cards moved to Done (1 new card in Doing: #1061).

## Round 101 (Doing — #1061 #1054 reopened)
- [x] `#1061` — Bildirimlerde "tamamlandı" metni yeşil (`NotificationStatusText`, onaylandı ile aynı). FE build + lint PASS.
- [x] `#1054` (reopened) — Rol matrisinde geçersiz hücreler düz metin yerine diğer satırlarla aynı `role-matrix-toggle` (disabled checkbox + "Pasif"). FE build + lint PASS.

## STATUS: Round 101 complete — Doing list drained (2 cards).

## Round 102 (Doing — #1054 #1055 #1061 #1062 #1063 #1064 #1065)
- [x] `#1062` — Vatandaş Talep Yöneticisi görev oluşturma: `CreateTaskCommand` CRM yetkisi Staff dalından bağımsız.
- [x] `#1063` — Bildirim feed'inden kullanıcının kendi audit olayları çıkarıldı.
- [x] `#1064` — Talebi Onaylayan: `Birim Adı / Onaylayan` formatı (Jobs + Tasks).
- [x] `#1065` — Durum Değiştir butonu mavi (`bg-blue-600`).
- [x] `#1055` (reopened) — WhatsApp FAB `bottom-14`.
- [x] `#1054` (reopened) — Rol matrisi pasif hücreler tıklanabilir toggle.
- [x] `#1061` (reopened) — "Tamamlandı" bildirim metni yeşil. BE+FE build/lint PASS.

## STATUS: Round 102 complete — 7 cards moved to Done.

## Round 103 (Doing — #1066 #1067)
- [x] `#1067` — Görev tamamlandı/iptal bildirim başlıkları: `Görev Tamamlandı` / `Görev İptal Edildi`; `JobCompleted` eşlemesi; görev sonrası talep audit action düzeltmesi (`JobUpdated` when Active).
- [x] `#1066` — Tamamlanmış/İptal Görevlerim grid İşlemler sütununda "Durum Değiştir" geri eklendi (detay header ile birlikte). BE+FE build PASS.

## STATUS: Round 103 complete — 2 cards moved to Done.

## Round 104 (Doing — #1062 reopened #1055 reopened #1069)
- [x] `#1062` (reopened) — CRM görev oluşturma: `JobCitizenRequestHelper` ile `SourceType` (SocialMessage vb.) dahil vatandaş talep tanımı BE/FE ile hizalandı.
- [x] `#1055` (reopened) — WhatsApp FAB `bottom-7` (footer üstü); ScrollFab `6.75rem` — çakışma giderildi.
- [x] `#1069` — Bildirim modal banner'ı `sticky-page-header` gradient ile sayfa banner'larıyla aynı. BE+FE build PASS.

## STATUS: Round 104 complete — 3 cards moved to Done.

## Round 105 (Doing — #1068 #1070 #1065 reopened)
- [x] `#1068` — Görev durumu değişince otomatik talep audit bildirimleri gizlendi (`IsJobStatusSideEffectOfTaskChange`).
- [x] `#1070` — Rol Yetkileri matrisine `departmentTasks` (Birimdeki Görevler) eklendi; nav + route `PageAccessGate`.
- [x] `#1065` (reopened) — Durum Değiştir butonu açık mavi (`bg-sky-500`). BE+FE build PASS.

## STATUS: Round 105 complete — 3 cards moved to Done.

## Round 106 (Doing — #1065 #1071 #1072 #1073)
- [x] `#1065` (reopened) — "Durum Değiştir" butonu arka planı turuncu yapıldı: 3 yerde (detay header, grid İşlemler, modal onay) `bg-sky-500 hover:bg-sky-600` → `bg-orange-500 hover:bg-orange-600` (uygulamanın standart turuncusu #f97316, `text-orange-500` ile uyumlu). FE build + lint PASS. main+master, Done.
- [x] `#1073` — (a) Rol matrisi bug: `normalizeRolePageAccessMatrix` CRM için `departmentTasks=false`'ı konfigürasyondan bağımsız zorluyordu → save/load'da admin'in işaretlemesi siliniyordu. CRM bloğu EDevlet'ten ayrıldı; CRM'de yalnızca `outgoingRequests=false` zorlanıyor, `departmentTasks` artık matrise bağlı. Nav (AppShell pageKey) + route (PageAccessGate) zaten `canAnyRoleAccessPage` kullanıyor → tek satır fix uçtan uca açar. (b) TasksPage "Birimdeki Görevler" görünümünde CRM yalnızca vatandaş taleplerinin görevlerini görür (`isCitizenRequestJob` filtresi). FE build + lint PASS. main+master, Done.
- [x] `#1071` — Kod değişikliği gerekmedi: IncomingRequestsPage CRM için satır görünürlüğünü zaten `row.isCitizenRequest` (=`isCitizenRequestJob(job)`) ile vatandaş taleplerine filtreliyor (satır 619); eylemler `canManageIncomingActions = isManagerLike || isCitizenRequestManager` + `canCitizenRequestManagerActOnRow` (yalnızca VT- satırları) ile sağlanıyor. #1062 (R104) citizen-tespiti hizalamasından sonra gereksinim karşılanıyor. Koddan doğrulandı, Done. (Kullanıcı kendi ortamında gözle teyit edebilir.)
- [x] `#1072` — Görev-durumu bildiriminde (Görev Durumu Değişti/Tamamlandı/İptal Edildi) üst talebi **Reporter** (="Üst Düzey Yönetici") ya da **Operator** (="Vatandaş Talep Operatörü") oluşturmuşsa, bildirim başlığı yanına o kullanıcının **birim adı turuncu parantezle** eklenir. Rol terimleri locale etiketleriyle birebir doğrulandı (belirsizlik yok). **Backend**: `NotificationResponse.TitleTag` eklendi; `GetNotificationsQuery` audit-türetilmiş görev bildirimlerinde üst talebin oluşturanını (Reporter/Operator) + birim adını lookup edip `IsTaskStatusChange` olan satırlara `TitleTag` koyuyor (`CreatedByUserId` nullable → join `(Guid?)u.UserId`). **Frontend**: `AppNotification.titleTag` + NotificationBell başlık satırında `text-orange-500` parantez. dotnet build 0/0 + FE build/lint PASS. feature-invariants §5b (audit-türetilmiş feed) + §6 (rol etiket eşlemesi) eklendi. main+master, Done.

## STATUS: Round 106 complete — Doing list drained (4 cards: #1065 #1071 #1073 #1072).

## Round 107 (Doing — #1074 #1075 #1076 #1077)
- [x] `#1074` — "Birimdeki Görevler" banner chip barından Atanmış/Rutin/Tümü (görev tipi) butonları + ayraç kaldırıldı (yalnızca departmentTasks branch; staffTasks'taki aynı butonlar korundu). `currentTaskTypeFilter` 'all'da kaldığından filtre no-op; mantık dokunulmadı. FE build + lint PASS. main+master, Done.
- [x] `#1075` — Vatandaş Talepleri grid'inde (SocialMessagesPage) "Talep Düzenle" butonu, hedef birim yöneticisi onayladıktan sonra pasif. Citizen talep `Active` oluşuyor; hedef onayında task'lar yaratılıyor → onay sinyali `linkedJob.taskCount > 0` (FE getSocialMessageStatusKey İşleme Alındı/Yapılmakta ayrımıyla aynı). `isTargetApproved` true ise DisabledActionButton (hover: "Hedef birim yöneticisi onayladıktan sonra talep düzenlenemez"). FE build + lint PASS. main+master, Done.
- [x] `#1076` — Taleplerim/Birimden Giden "Onaylanmış" görünümünde düzenlenemeyen kayıtlarda (Operatör/CRM) hizalama için pasif "Düzenle" (DisabledActionButton) eklendi: pasif-fallback koşuluna `activeJobView === 'approved'` eklendi (önceden yalnızca all/overdue'da vardı; #648/#729 mantığı). FE build + lint PASS. main+master, Done.
- [x] `#1077` — Vatandaş talebi güncellenince Taleplerim'e düşme + VT→T numara sorunu. **Prod read-only inceleme** (T-2026-318): veri sağlam — requesttype=ExternalUnit, sourcetype=SocialMessage, linkli social message citizenrequestnumber=16 → gerçek no VT-2026-16; sorun yönlendirme+görünüm. **Kök-neden:** `getRequestEditPath` citizen talebi yalnızca Operator için kind=citizen'a yönlendiriyordu → CRM/diğer roller external'a → external submit → navigate('/my-requests'); ayrıca JobsPage `formatJobDisplayNumber` her zaman T- döndürüyordu. **Fix:** (a) `getRequestEditPath` her rol için `isCitizenRequestJob` → `kind=citizen&returnTo=social` (kaydedince /social = Vatandaş Talepleri, VT- korunur); `role` paramı kaldırıldı (2 call-site). (b) Backend `JobSummaryResponse`'a `CitizenRequestNumber`+Year eklendi (JobQueries social message map'i, factory default null) + FE JobSummary tipi + `formatJobDisplayNumber` citizen ise VT- döndürüyor (karar: B — Taleplerim'de VT- göster). dotnet build 0/0 + FE build/lint PASS. feature-invariants §2'ye citizen VT/T invariant'ı eklendi. main+master, Done.

## STATUS: Round 107 complete — Doing list drained (4 cards: #1074 #1075 #1076 #1077).

## Round 108 (Doing — #1079 #1080 #1071 #1072 #1078)
- [x] `z3QgRcCO` / #1079 — Talep oluşturma yetki uyarısı "Bu rol talep olusturamaz." olarak değiştirildi. BE build PASS. main+master, Done.
- [x] `bXWdaNhl` / #1080 — Vatandaş Talep Yöneticisi birim içi/birim dışı talep oluşturabilir: backend role guard'a CRM eklendi, sahip birim kendi çalışma birimiyle sınırlandı, Staff gibi sahip onayına düşürüldü; frontend createRequest varsayılan sayfa erişimi + sahip birim seçimi CRM'e açıldı. BE+FE build/lint PASS. main+master, Done.
- [x] `jZ8uDgJM` / #1071 — Vatandaş Talep Yöneticisi Birimdeki Görevler'de yalnızca vatandaş talebi görevlerini görür: backend department-scope query citizen filtreli, frontend CRM kapsamı müdürlük yerine çalışabildiği birimler, CRM'e citizen görevlerde yönlendirme/iptal/onay aksiyonları açıldı. BE+FE build/lint PASS. main+master, Done.
- [x] `E9hxhTM0` / #1072 — Görev durumu bildirimlerinde parent talep Reporter/Operator kaynaklıysa turuncu birim etiketi güvenilir dolsun diye titleTag lookup'ı Guid tabanlı + explicit user→department join yapıldı. BE build PASS. main+master, Done.
- [x] `IR3Lwi1K` / #1078 — Talep bildirimlerinde (Talep oluşturuldu/güncellendi vb.) talebi Reporter/Operator oluşturduysa aynı turuncu birim titleTag'i başlığa eklendi. BE+FE build/lint PASS. main+master, Done.
- [x] `rZkC2boY` / #1082 — WhatsApp Konuşması → Vatandaş Talebi Oluştur modalında Açıklama rich-text alanı Talep Başlığı satırının hemen altına taşındı; adres/dosya alanları açıklamadan sonra kaldı. FE build/lint PASS. main+master, Done.
- [x] `MGT0UWnK` / #1083 — Vatandaş Talebi düzenleme modalında VT numarası "Vatandaş Adı / Gönderen" alanının üstünde turuncu, altı çizili başlık olarak gösterildi. FE build/lint PASS. main+master, Done.
- [x] `xBPWOWZ9` / #1081 — Operator ve Vatandaş Talep Yöneticisi `Taleplerim` ekranından VT/vatandaş talepleri çıkarıldı; backend `mine` scope citizen filtreli, frontend cached-data guard eklendi. BE+FE build/lint PASS. main+master, Done.
- [x] `36258I0y` / #1084 — Sarı dikkat satırlarında `(Öncelik:...)` etiketi/değeri siyaha çekildi; Incoming ve Tasks gridleri + global row-attention guard güncellendi. FE build/lint PASS. main+master, Done.
- [x] `jXOerULY` / #1085 — Sol menüdeki `WhatsApp Konuşmaları` alt linki için scoped emphasized varyantı eklendi; ikon `size-5`, text `0.85rem`/bold oldu, diğer menüler korunuyor. FE build/lint PASS. main+master, Done.
- [x] `BAnHW5qz` / #1087 — Operator kaynaklı vatandaş talebi bildirimlerinde titleTag birim adı yerine statik `Vatandaş Talebi`; mesaj operatör adı + `Vatandaş Talep No: VT-...` + talep başlığı olacak şekilde güncellendi. BE+FE build/lint PASS. main+master, Done.
- [x] `MoQDJqP9` / #1088 — CitizenRequestModal sağ formunda Açık Adres ile Dosya/Fotoğraf alanı aynı satıra alındı; dosya ekle butonu ve seçilmedi/seçilen dosya paneli yan yana sığacak kompakt bloğa dönüştürüldü. FE build/lint PASS. main+master, Done.
- [x] `jXOerULY` / #1085 reopened — `WhatsApp Konuşmaları` alt linki emphasized kalırken `-ml-3` offset + genişlik telafisiyle sola alındı; text `0.82rem` nowrap yapıldı ve satıra tam sığması sağlandı. FE build/lint PASS. main+master, Done.
- [x] `9KG3Q4J0` / #1086 — `Onayla ve Personel Ata` kullanıcı listesi Staff yanında aynı birimdeki aktif Operator kullanıcıları da gösterecek ortak `isAssignableDepartmentUser` helper'ına taşındı; Incoming ve Jobs detay akışları hizalandı. FE build/lint PASS. main+master, Done.

## STATUS: Round 108 complete — Doing list drained.

## Round 109 (Doing — 2026-06-29 oturumu, sürekli besleme)
- [x] `6a4208f3` / #1090 — Vatandaş Talep Operatörü vatandaş talebini **kendi birimine** de yönlendirebilir. FE: `CitizenRequestModal` + `CreateRequestPage` hedef listesinden sahip birim çıkarılmıyor. BE: `CreateJobCommand` owner=target ayıklamasını yalnızca NON-citizen taleplerde yapıyor (`isCitizenSource`); citizen'de owner=target korunur, JobDepartment Owner(Approved)+Target(Pending) iki satır (onay sorgusu Role==Target). BE+FE build/lint PASS. main+master, Done.
- [x] `6a420ca5` / #3 — "Durum Değiştir" ile görev iptal edilip talep Cancelled/Rejected'a düşünce `ChangeTaskStatusCommand` artık `job.CancelReason=reason` yazıyor → talep "İptal Notu" yansıyor (tamamlama notu zaten `JobQueries`'te tamamlanan görevin Notes'undan türüyor). G-2026-245 bir görev no'ymuş. BE build PASS. main+master, Done.
- [x] `6a4207be` / #4 — WhatsApp "Vatandaş Talebi Oluştur" modalında "Dosya ekle" butonu küçültüldü. İlk: %50 (h-2.75rem, self-start). **Reopen**: %25 daha (h-2.0625rem) + Açık Adres textbox'ının alt hizasına (self-end), ekran görseline göre. FE build/lint PASS. main+master, Done.
- [x] `6a420e26` / #2 — Görevlerim görev detayında **Durum Değişikliği Geçmişi** sütunu (Açıklama'nın sağında). BE: `TaskDetailResponse.StatusChangeHistory` AuditLog `TaskStatusChanged`'den türüyor (Details "from->to", Notes neden); `ChangeTaskStatusCommand` audit'e `ActorDisplayName` yazıyor. FE: sağ panel 4 sütuna kadar; rutin görevde gizli. BE+FE build/lint PASS. main+master, Done.
- [x] `6a42116e` / #1 — Görev Atama Geçmişi sütunu: kullanıcı onayıyla mevcut hâli yeterli, kod değişikliği yok. Done.
- [x] `6a3faa7e` / #1091 — WhatsApp yanıtları **operatör onaylı gönderim**: `ReplyToSocialMessageCommand` WhatsApp'ta göndermez, `DeliveryStatus=Pending` entry; gerçek gönderim `SendPendingConversationEntryCommand` (POST .../conversation/{entryId}/send, yetki Operator/SystemAdmin). FE: `ConversationEntryBubble` Pending'de "Beklemede" + "Mesajı Gönder" (canSendPending); `WhatsAppConversationModal` artık yazabilir (kuyruğa) canSendPending=false; operatör görünümleri (CitizenRequestModal, WhatsAppConversationsPage) rol bazlı gönder butonu. Enum string-stored → migration yok. BE+FE build/lint PASS. feature-invariants §3 güncellendi. main+master, Done.
- [x] `6a3ed5cf` — Rutin Görev düzenleme "İptal" butonu kanonik "Vazgeç" stiliyle eşitlendi (variant secondary + common.dismiss). FE build/lint PASS. main+master, Done.
- [x] `6a42209c` — Görev Durum Değişikliği pop-up'ında yardım metninin başına turuncu Görev No eklendi (statusChangeModal'a displayNumber). FE build/lint PASS. main+master, Done.
- [x] `6a422308` / #1092 — Görev Detayları detay paneli tüm satır genişliğinde: `canCompleteTask` durumunda sağda boş kalan 0.75fr sütun (vestigial; tamamlama header butonlarında) kaldırıldı → sütunlar sıkışmıyor. FE build/lint PASS. main+master, Done.
- [x] `6a4223f6` / #1093 — Görev Detayları iç grid 3. sütunu (Açıklama + Atama/Durum Değişikliği Geçmişi) biraz genişletildi (1.38fr→1.75fr; sol özet 1.45→1.25, durum 0.72→0.65). FE build/lint PASS. main+master, Done.

## STATUS: Round 109 complete — Doing list drained.

## Round 110 (Doing — 2026-06-29, WhatsApp bekleyen mesaj + durum geçmişi iterasyonları)
- [x] `6a42266f` / #1095 — Durum Değişikliği Geçmişi'nde yalnızca durum + tarih (neden/aktör kaldırıldı). FE. main+master, Done.
- [x] `6a422563` / #1094 — Bekleyen mesaj yanında turuncu "Düzenle" butonu; balon metni yerinde textarea ile düzenlenip kaydedilir (`EditPendingConversationEntryCommand`, POST .../conversation/{entryId}/edit, Operator/SystemAdmin, Pending+Outbound). BE+FE build/lint PASS. main+master, Done.
- [x] `6a4225d7` / #1096 — "Mesajı Gönder" önce `ConfirmDialog` onayı gösterir; onaylanınca iletilir (ConversationPanel + WhatsAppConversationsPage). "İletilemedi" = WhatsApp 24s penceresi kapalıyken platform reddi; gönderim kodu değişmedi. FE build/lint PASS. main+master, Done.
- [x] `6a4228ca` / #1097 — Durum Değişikliği Geçmişi G-2026-247 gibi normal akışla (Atandı→Yapılmakta) değişen görevlerde görünmüyordu (sorgu yalnızca `TaskStatusChanged` audit'ine bakıyordu). Artık görevin TÜM audit'lerindeki `StatusAtEvent`'ten geçişler türetiliyor (ilk durum baseline, sonraki her farklı durum kayıt). BE+FE build/lint PASS. feature-invariants §1 güncellendi. main+master, Done.
- [x] `6a42251f` / #1098 — WhatsApp Konuşmaları "Mesajı Gönder" onay pop-up'ı: #1096 ile zaten eklenmiş ve canlı; kod değişikliği gerekmedi. Done.
- [x] `6a429848` / #1099 — "Yazışmaya Git" butonları Vatandaş Talepleri gridview hariç (TasksPage + JobsPage detay) açık mavi (bg-sky-400) yapıldı; SocialMessagesPage teal korundu. FE build/lint PASS. main+master, Done.
- [x] `6a422d3c` / #1104 — Görev Atama Geçmişi yalnızca ilk atanan personelden farklı kullanıcıya yönlendirme varsa görünür; kart İlgili Talep Detayları'nın hemen üstüne taşındı. FE build/lint PASS. main+master, Done.
- [x] `6a422e96` / #1105 — Bekleyen WhatsApp mesajı düzenlenirse `EditedAtUtc` tutulur ve balonda "Beklemede" solunda turuncu "Düzenlendi" etiketi gösterilir. BE+FE build/lint PASS. main+master, Done.
- [x] `6a422f55` / #1106 — WhatsApp bekleyen mesaj aksiyonlarında `Düzenle` ve `Mesajı Gönder` butonlarının yüksekliği biraz artırıldı (`py-1`→`py-1.5`). FE build/lint PASS. main+master, Done.
- [x] `6a4225d7` reopened / #1099 — Bekleyen WhatsApp mesajı gönderimi gerçek platform hatasında artık 404 dönüp refresh'i kesmiyor; entry bulunduysa API 204 dönüyor, konuşma yenilenip balonda `İletilemedi` görünüyor. BE+FE build/lint PASS. main+master, Done.
- [x] `6a42318d` / #1108 — WhatsApp konuşma balonlarında personel adı soyadı artık kısaltılmadan kaydediliyor/görünüyor (`Gamze Gürel`, `Gamze G.` değil). BE+FE build/lint PASS. main+master, Done.
- [x] `6a4230b4` / #1107 — `Mesajı Gönder` confirm pop-up başlığı altı çizili yapıldı (`titleUnderline`). BE+FE build/lint PASS. main+master, Done.
- [x] `6a423345` / #1109 — Tasks detayında `Görev Ekleri` sütunu yalnız görev eki varsa render ediliyor; ek yoksa alan tamamen gizleniyor. FE build/lint PASS. main+master, Done.
- [x] `6a4233e0` / #1110 — WhatsApp bekleyen mesajda `Düzenle` ve `Mesajı Gönder` butonları gönderim sırasında disabled + not-allowed cursor ile pasif görünüyor. FE build/lint PASS. main+master, Done.
- [x] `6a423486` / #1111 — Tasks detayındaki `Görev Atama Geçmişi` kartında ilk kayıt yukarı alındı; kart içi gap sıkılaştırıldı. FE build/lint PASS. main+master, Done.
- [x] `6a42371a` / #1112 — WhatsApp konuşma balonlarında eski `Vatandaş O.` sender label'ı `Vatandaş Operatörü` olarak genişletiliyor; personel/operator adı kısaltılmıyor. FE build/lint PASS. main+master, Done.
- [x] `6a4230b4` reopened / #1107 — `Mesajı Gönder` confirm pop-up'ında başlık metni underline değil, önceki modal standardındaki başlık-altı ayraç çizgisi (`titleDivider`) kullanılıyor. FE build/lint PASS. main+master, Done.
- [x] `6a4238dd` / #1113 — `/whatsapp` konuşma footer'ındaki 24 saat pencere uyarı satırı kaldırıldı. FE build/lint PASS. main+master, Done.
- [x] `6a42116e` reopened / #1093 — Tasks detayında `Görev Atama Geçmişi` ayrı karttan kaldırılıp Görev Detayları içindeki Açıklama'nın sağ sütununa taşındı. BE+FE build/lint PASS. main+master, Done.
- [x] `6a422e96` reopened / #1105 — `/whatsapp` conversation detail timeline artık `EditedAtUtc` taşıyor; düzenlenen bekleyen balonda turuncu `Düzenlendi` rozeti görünür. BE+FE build/lint PASS. main+master, Done.
- [x] `6a4228ca` reopened / #1101 — Status audit zinciri ilk kaydı doğrudan yeni durumla başlıyorsa Atandı→ilk durum geçişi üretiliyor; Durum Değişikliği Geçmişi Açıklama sağında Atama Geçmişiyle birlikte görünür. BE+FE build/lint PASS. main+master, Done.
- [x] `6a4223f6` reopened / #1096 — Personelimin Görevleri detay popup header'ında `Görevi Yönlendir` ve `Görevi İptal Et` kaldırıldı. FE build/lint PASS. main+master, Done.
- [x] `6a3fbfda` reopened / #1004 — Görevlerim `Tüm Görevler` terminal görev detayında sağ üstte `Durum Değiştir`, solunda varsa `Yazışmaya Git` görünüyor; pasif `Düzenle` placeholder'ı gizleniyor. FE build/lint PASS. main+master, Done.
- [x] `6a422b93` / #1103 — Atama Geçmişi ve Durum Değişikliği Geçmişi yan yana olduğunda `Durum Değişikliği` başlığı ilk satır, `Geçmişi` ikinci satır olacak şekilde sabitlendi. FE build/lint PASS. main+master, Done.
- [x] `6a422b93` reopened / #1103 — Birimdeki Görevler `Tüm Görevler` gridinde İşlemler sütunundaki `İptal Et` butonu sadece bu görünümden kaldırıldı. FE build/lint PASS. main+master, Done.
- [x] `6a4291a3` / #1114 — Görev Detayları'nda Atama Geçmişi ve Durum Değişikliği Geçmişi yan yanayken iki başlık da tek satırda sığacak kolon oranına alındı. FE build/lint PASS. main+master, Done.
- [x] `6a42974f` / #1117 — Görevlerim/Birimdeki Görevler grid `İşlemler` aksiyonları detay popup sağ üst header mantığıyla hizalandı: Birimdeki görevlerde `Yönlendir` yalnız Bekleyen/Son Tarihi Geçmiş görünümünde (pasif durum dahil), Birimdeki `Tüm Görevler` detayında `Görevi İptal Et` yok. FE build/lint PASS. main+master, Done.
- [x] `6a4291a3` reopened / #1114 — Tasarım bozulduğu için Görev Detayları üst kartında sol Görev No kolonunu yeniden daraltıp sağ Açıklama/Geçmişler panelini genişlettim; iki geçmiş başlığı `nowrap` ve yeterli kolon min-width ile tek satırda kalır. İlgili Talep Detayları'nda Talep No kolonu da daraltıldı. FE build/lint PASS. main+master, Done.
- [x] `6a42974f` reopened / #1117 — Kart metni güncellendi: Görevlerim/Birimdeki Görevler grid `İşlemler` sütununda artık `Detaylar` hariç buton kalmaz; aksiyonlar detay popup header'ında kalır. FE build/lint PASS. main+master, Done.
- [x] `6a429afa` / #1119 — Görevlerim/Birimdeki Görevler banner aramasına gridde görünen `Bağlı Olduğu Talep No` formatı eklendi (`formatTaskJobDisplayNumber`); `T-2026-328` gibi talep numarasıyla arama artık satırı düşürmez. FE build/lint PASS. main+master, Done.
- [x] `6a429bcc` / #1120 — Görevlerim `Tamamlanmış Görevlerim` ve `İptal Görevlerim` detay popup header'ına `Düzenle` geri eklendi; `Durum Değiştir` yanında mevcut aktif/pasif edit mantığıyla görünür, `Tüm Görevler` terminal detayındaki pasif Düzenle gizleme kuralı korunur. FE build/lint PASS. main+master, Done.
- [x] `6a429e79` / #1122 — Görevlerim gridlerinin `İşlemler` kolonu tek `Detaylar` butonuna göre daraltıldı (`17rem` → `7.5rem`) ve buton ortalandı; diğer tablo action düzenlerine dokunulmadı. FE build/lint PASS. main+master, Done.
- [x] `6a42a0b4` / #1123 — Birimdeki Görevler ve Personelimin Görevleri gridleri yatay alt scroll'a düşmesin diye aynı fixed colgroup planına alındı; personel/departman action kolonu da tek `Detaylar` butonuna göre 7.5rem ve ortalı. FE build/lint PASS. main+master, Done.

## STATUS: Round 117 complete — Doing list drained.

## Round 118 (Doing — 2026-07-02, Taleplerim detay popup kartları)
- [x] `6a450127` / #1192 — Taleplerim detay düzenlemede öncelik seçenekleri Talep Oluştur ile eşitlendi (Çok Yüksek/Yüksek/Normal); adres alt alanları mahalle seçilmeden kilitli; ek yükleme alanı rich-list modunda iki kolonlu, dosya adları sağda. FE build/lint PASS. main+master, Done.
- [x] `6a4558fa` / #1199 — Taleplerim detay ekleri rich-list olarak her rolde gösteriliyor; PDF/Office dosyaları belge ikonu, JPG/PNG dosyaları görsel ikonu ile ayrışıyor. FE build/lint PASS. main+master, Done.
- [x] `6a455845` / #1198 — Taleplerim adres etiketleri title-case kaldı, `Cadde / Sokak / Bulvar` etiketi kullanıldı; büyük harf zorlaması kaldırıldı. FE build/lint PASS. main+master, Done.
- [x] `6a455843` / #1197 — Tüm adres giriş yüzeylerinde Cadde/Sokak/Bulvar ve Açık Adres mahalle seçimine bağlandı; mahalle temizlenince alt adresler de temizleniyor. FE build/lint PASS. main+master, Done.
- [x] `6a4501f6` / #1193 — Taleplerim tamamlanan gridinde Tamamlanma Tarihi kolonu genişletildi. FE build/lint PASS. main+master, Done.
- [x] `6a4553ef` / #1195 — Taleplerim detay başlığı ikonu sol menüdeki Taleplerim `ClipboardList` ikonu ile eşitlendi. FE build/lint PASS. main+master, Done.
- [x] `6a45553c` / #1196 — Terminal talep not linkleri `Not` metniyle gösteriliyor; tamamlanan/iptal taleplerde Görev Detayları içindeki duplicate iptal/tamamlama not linkleri gizlendi. FE build/lint PASS. main+master, Done.

## STATUS: Round 118 complete — Doing list drained.

## Round 119 (Doing — 2026-07-02, ekler/fotoğraflar tekrar düzeltmesi)
- [x] `6a460240` / #1200 — Talepler detay popup'ındaki Ekler / Fotoğraflar alanları `rich-list` moduna alındı; yükleme dropzone'u yarı genişlikte, dosya adları sağ tarafta listelenir. FE build/lint PASS. main+master, Done.
- [x] `6a4558fa` reopened / #1199 — `AttachmentSection` ikon ayrımı tüm modlara yayıldı; list/gallery/rich-list görünümlerinde JPG/PNG görsel ikonu, PDF/Office doküman ikonu kullanılır. FE build/lint PASS. main+master, Done.
- [x] `6a45553c` reopened / #1196 — Taleplerim süreç satırında terminal tarih label'ındaki parantezli durum metni (`(İptal)` gibi) kaldırıldı; aktör adı ve `Not` linki korunuyor. FE build/lint PASS. main+master, Done.

## STATUS: Round 119 complete — Doing list drained.

## Round 120 (Doing — 2026-07-02, ek ikonları + timeline aktör formatı)
- [x] `6a4604e1` / #1201 — Ek ikonları ortak `AttachmentSection` dışındaki alanlara da yayıldı: görev eki listeleri, görev tamamlama geçici ekleri, Talep Oluştur/Vatandaş Talebi/Rutin Görev seçili dosya listeleri JPG/PNG için görsel, PDF/Office için doküman ikonu gösterir. FE build/lint PASS. main+master, Done.
- [x] `6a45553c` reopened / #1196 — Taleplerim süreç timeline'ında terminal tarih label'ında aktör adı parantez içine alındı (`İptal Tarihi (Gamze Gürel)`); `Not` linki tarih değerinin yanında kalır. FE build/lint PASS. main+master, Done.

## STATUS: Round 120 complete — Doing list drained.

## Round 121 (Doing — 2026-07-02, ek ikon kompakt stil)
- [x] `6a4558fa` reopened / #1199 — Ek dosya ikonları küçültüldü; dosya adları bold olmaktan çıkarılıp text boyutu düşürüldü; rich-list boyut bilgisi kaldırıldı. Aynı kompakt stil geçici seçili dosya listelerine de uygulandı. FE build/lint PASS. main+master, Done.

## STATUS: Round 121 complete — Doing list drained.

## Round 122 (Doing — 2026-07-02, ek yükleme + mobil/wallboard düzeltmeleri)
- [x] `6a461c87` / #1204 — Tüm ek yükleme yüzeylerinde kesik çizgili "Dosyayı buraya sürükleyin" alanları kaldırılıp ataç ikonlu kompakt `Dosya ekle` butonu kullanıldı.
- [x] `6a46373e` / #1205 — Mobil genişliklerde AppShell desktop zoom'u kapatıldı; telefonlarda içerik/sidebar native ölçek ve scroll ile çalışır.
- [x] `6a4558fa` reopened / #1199 — Ek dosya adları tüm ortak/gönderim listelerinde siyah, normal ağırlıkta ve altı çizgisiz hale getirildi.
- [x] `6a461085` / #1202 — Ekrana Yansıt wallboard listesi rutin görevleri filtreliyor; G-2026-250 gibi rutin kayıtlar görünmez.

## STATUS: Round 122 complete — Doing list drained.

## Round 123 (Doing — 2026-07-02, talep upload istisnası + wallboard sticky header)
- [x] `6a4646db` / #1206 — Birim içi, birim dışı ve vatandaş talebi oluştur formlarında dosya ekleme alanı eski "Dosyayı buraya sürükleyin" dropzone görünümüne döndürüldü; diğer ek alanları kompakt `Dosya ekle` olarak kaldı.
- [x] `6a46475c` / #1207 — Ekrana Yansıt tablosu sticky header için ayrı border modeline ve opak header arka planına alındı; grid başlıkları tablo scroll'unda sabit kalır.

## STATUS: Round 123 complete — Doing list drained.

## Round 124 (Doing — 2026-07-02, ek sil aksiyonu)
- [x] `6a4647a2` / #1208 — Düzenleme/ekleme sırasında `Dosya Ekle` sonrası görünen rich-list dosya satırlarında `Sil` yazısı hover beklemeden görünür hale getirildi.

## STATUS: Round 124 complete — Doing list drained.

## Round 125 (Doing — 2026-07-02, yönetici notu ikonu + wallboard renk geri alma)
- [x] `6a4648b8` / #1209 — Taleplerim detayındaki Yönetici Notu başlık ikonu konuşma balonu yerine not alanına daha uygun `NotebookPen` ikonuna çevrildi.
- [x] `6a46475c` reopened / #1207 — Ekrana Yansıt sticky header düzeltmesinde hücrelere verilen ayrı opak gradient kaldırıldı; eski sürekli header gradient rengi korunarak `thead` sticky yapıldı.

## STATUS: Round 125 complete — Doing list drained.

## Round 126 (Doing — 2026-07-02, wallboard vatandaş talebi kanal ikonu)
- [x] `6a464923` / #1210 — Ekrana Yansıt gridinde vatandaş talepleri için Oluşturan bilgisinin başına sosyal kanal/e-Devlet ikonu eklendi; vatandaş satırına verilen özel renk ve sıra numarası yanındaki sarı şerit kaldırıldı.

## STATUS: Round 126 complete — Doing list drained.

## Round 127 (Doing — 2026-07-02, ek sil aksiyonu düzenleme modu)
- [x] `6a4647a2` reopened / #1208 — Ek listelerinde `Sil` yazısı hover beklemeden görünmeye devam eder; ancak Taleplerim detayında `Düzenle` moduna geçmeden görünmez. Yükleme izni açık olsa bile silme aksiyonu gerçek düzenleme moduna bağlandı.

## STATUS: Round 127 complete — Doing list drained.

## Round 128 (Doing — 2026-07-02, ek dosya ekle düzenleme modu)
- [x] `6a464a83` / #1211 — Taleplerim detayındaki Ekler / Fotoğraflar bölümünde `Dosya ekle` butonu da `Düzenle` moduna bağlandı; düzenlemeye basmadan ek listesi salt okunur görünür.

## STATUS: Round 128 complete — Doing list drained.

## Round 129 (Doing — 2026-07-02, süreç onay tarihi formatı)
- [x] `6a464b72` / #1212 — `Talebi Gerçekleştiren Birim Yöneticisinin Onay Tarihi` satırında hedef birim yöneticisi adı etiket yerine tarih değerinin yanında parantez içinde gösteriliyor.
- [x] `6a464c04` / #1213 — `Talebin Birim Yöneticisinin Onay Tarihi` satırında parantez içindeki yönetici adı tarih değerinin yanına taşındı.
- [x] `6a464c5a` / #1214 — Manager/SystemAdmin/Reporter rollerinde Süreç altında `Talebin Birim Yöneticisinin Onay Tarihi` satırı gizlendi.

## STATUS: Round 129 complete — Doing list drained.

## Round 130 (Doing — 2026-07-02, süreç durum satırı)
- [x] `6a464d52` / #1215 — Taleplerim/Görev detay Süreç timeline'ındaki ayrı `Durum` step'i kaldırıldı; akış talep/onay/tamamlanma-son tarih satırlarıyla kalır.

## STATUS: Round 130 complete — Doing list drained.

## Round 131 (Doing — 2026-07-02, süreç onaylayan isim stili)
- [x] `6a464e53` / #1216 — Süreç onay tarihi satırlarında parantez içindeki yönetici adı tarih değerinin yanında küçük ve yeşil metin olarak ayrı render ediliyor.

## STATUS: Round 131 complete — Doing list drained.

## Round 132 (Doing — 2026-07-02, detay açıklama paneli ve bekleyen onay)
- [x] `6a4651b5` / #1217 — Taleplerim detay ana kartında `Açıklama` paneli ekran görselindeki soluk nötr arka planla eşitlendi.
- [x] `6a464d52` reopened / #1215 — Standart kullanıcıda owner approval beklerken ilk `Onay Bekleyen` değeri turuncu gösteriliyor ve yanında parantez içinde talebin birim yöneticisi (`statusActorDisplayName`) yazıyor.

## STATUS: Round 132 complete — Doing list drained.

## Round 133 (Doing — 2026-07-02, detay başlık tipografisi)
- [x] `6a4651ff` / #1218 — Taleplerim detay popup üst başlığı görseldeki daha büyük/açık gri/harf aralıklı stile yaklaştırıldı; ana `Talep Detayları` başlığı title-case ve daha bold yeşil görünüme alındı.

## STATUS: Round 133 complete — Doing list drained.

## Round 134 (Doing — 2026-07-02, düzenle ikonları ve başlık ölçüsü)
- [x] `6a465394` / #1219 — Düzenle aksiyonlarında ikon görseldeki stile yaklaştırılarak `SquarePen` ile tekilleştirildi; metinli düzenle butonlarına sol ikon eklendi.
- [x] `6a4654de` / #1220 — Taleplerim detay popup üst başlığı ve ana `Talep Detayları` başlığı önceki büyütmeye göre küçültüldü; title-case görünüm korundu.
- [x] `6a464d52` reopened / #1215 — Standart kullanıcı owner approval bekleyen satırında parantez içindeki yönetici adı da turuncu gösteriliyor.

## STATUS: Round 134 complete — Doing list drained.

## Round 135 (Doing — 2026-07-02, detay popup üst boşluğu)
- [x] `6a465593` / #1221 — Taleplerim detay popup header'ında üst boşluk payı artırıldı; başlık satırı modal üst kenarına yapışmıyor.

## STATUS: Round 135 complete — Doing list drained.

## Round 136 (Doing — 2026-07-02, detay popup görsel düzeltmeleri)
- [x] `6a46568e` / #1222 — Taleplerim detayında `Süreç` ve `Açıklama` kart içi başlıkları hafifletildi; bold kart başlığı gibi görünmüyor.
- [x] `6a4654de` reopened / #1220 — `Taleplerim` header başlığı modal gövdesindeki `Talep Detayları` ikon hizasına çekildi.
- [x] `6a465394` reopened / #1219 — Tüm Düzenle ikonları görseldeki çizgi kalem ikonuna uygun `PenLine` ile güncellendi.
- [x] `6a4656ef` / #1223 — Süreç timeline yuvarlakları referanstaki açık zeminli/halkalı stile yaklaştırıldı.

## STATUS: Round 136 complete — Doing list drained.

## Round 137 (Doing — 2026-07-02, grid tarihleri ve popup edit kompaktlığı)
- [x] `6a468841` / #1243 — Gridview terminal tarih değerlerinde `Tamamlanma Tarihi` yeşil, `İptal Tarihi` kırmızı oldu; `Son Tarih` davranışı korunuyor.
- [x] `6a4689c8` / #1244 — Süreç timeline çizgisinde tamamlanan yeşil adımdan güncel turuncu adıma yumuşak geçiş eklendi; yuvarlak ikon tasarımı korunuyor.
- [x] `6a468a79` / #1245 — WhatsApp konuşmaları alt aksiyonlarında `Talep oluştur` ve `Şablon mesajlar` ikonları yeşil yapıldı, metin renkleri korunuyor.
- [x] `6a467020` / #1238 — Taleplerim detay düzenleme modunda açıklama editörü kompakt min-height aldı; Öncelik/Süreç/Açıklama satırının altı gereksiz genişlemiyor.

## STATUS: Round 137 complete — Doing list drained.

## Round 138 (Doing — 2026-07-02, adres etiketi boyutu)
- [x] `6a468b0a` / #1246 — Taleplerim detay `Adres Bilgileri` etiketleri (`Mahalle`, `Cadde / Sokak / Bulvar`, `Açık Adres`) büyütüldü; değer fontları korunuyor.

## STATUS: Round 138 complete — Doing list drained.

## Round 139 (Doing — 2026-07-02, adres street input boyutu)
- [x] `6a468ba2` / #1247 — Birim içi/dışı/vatandaş talebi oluşturma adres bloklarında `Cadde / Sokak / Bulvar` input yazı boyutu `Açık Adres` textarea yazı boyutuyla eşitlendi.

## STATUS: Round 139 complete — Doing list drained.

## Round 140 (Doing — 2026-07-02, talep formu kompaktlığı ve detay edit)
- [x] `6a468a79` reopened / #1245 — WhatsApp konuşmalarındaki `Şablon mesaj ekle` butonunda yalnızca baştaki `+` ikonu yeşil yapıldı; metin rengi korunuyor.
- [x] `6a468ba2` reopened / #1247 — Talep oluşturma adres bloklarında `Cadde / Sokak / Bulvar` yazı boyutu ana sayfada `Açık Adres` textarea ölçüsüne, vatandaş modalında kompakt textarea ölçüsüne yeniden eşitlendi.
- [x] `6a466b07` / #1232 — Taleplerim detay düzenleme modunda `Talep Başlığı` alanı çok satırlı textarea oldu; uzun metin sağa kaymadan sarıp aşağı genişler.
- [x] `6a468d80` / #1248 — Birim içi talep oluşturma formundaki `Bitiş Tarihi` takvimi yukarı yönde açılacak şekilde ayarlandı.
- [x] `6a468d9b` / #1249 — Birim içi, birim dışı ve vatandaş talebi oluşturma formlarındaki input/dropdown/textarea kontrol yükseklikleri ilgili formlar içinde biraz küçültüldü.

## STATUS: Round 140 complete — Doing list drained.

## Round 141 (Doing — 2026-07-02, dashboard chart ve form yerleşimi)
- [x] `6a46a775` / #1250 — Birim içi talep oluşturma formunda `Görevi Yapan Kişi/Birim` alanı Öncelik/Bitiş/Proje satırının üstüne alındı.
- [x] `6a46a8e2` / #1252 — WhatsApp konuşma detay üst bilgi şeridi breadcrumb `Anasayfa` yüzeyiyle aynı açık zemine çekildi.
- [x] `6a46a88d` / #1251 — Kontrol paneli status pie chart sorgusunda görev kaynak tipi navigation bağımlılığı kaldırıldı; chart endpoint'i daha dayanıklı projeksiyonla çalışır.
- [x] `6a468ba2` / #1247 — Birim içi/dışı/vatandaş talebi oluşturma adres alanlarında `Açık Adres` girilen metin büyütüldü; cadde input'u aynı okunurlukta tutuldu.

## STATUS: Round 141 complete — Doing list drained.

## Round 142 (Doing — 2026-07-02, WhatsApp breadcrumb ve header metni)
- [x] `6a46a92b` / #1253 — Breadcrumb'daki `WhatsApp` pill'inin başına WhatsApp ikonu eklendi.
- [x] `6a46a991` / #1254 — Konuşma detay header'ında telefon numarasının altındaki `WhatsApp Konuşmaları` subtitle'ı kaldırıldı.

## STATUS: Round 142 complete — Doing list drained.

## Round 143 (Doing — 2026-07-02, vatandaş talebi aksiyonları ve otomatik cevaplar)
- [x] `6a46aaee` / #1255 — Vatandaş Talepleri gridinden `Son Tarih` sütunu kaldırıldı; grid işlemlerinde yalnız `Detaylar` bırakıldı, Yazışmaya Git / Düzenle / İptal aksiyonları detay popup header'ına taşındı.
- [x] `6a46a88d` reopened / #1251 — Breadcrumb ara segmentlerine kendi ikonları eklendi.
- [x] `6a46abd3` / #1258 — Ayarlar > Otomatik Yönlendirme altında `Vatandaşa Giden Cevaplar` bölümü eklendi; İşleme Alındı, Yapılmakta ve Tamamlandı şablonları tenant ayarına kaydediliyor.
- [x] `6a46ab40` / #1256 — Vatandaş Talebi detay popup'ında düzenleme modunda `Ekler / Fotoğraflar` bölümünde `Dosya ekle` aksiyonu görünür hale getirildi.
- [x] `6a46ab6b` / #1257 — Otomatik vatandaş cevaplarının varsayılan metnine `no'lu` ifadesinden sonra talep başlığı eklendi.

## STATUS: Round 143 complete — cards moved to Done; follow-up Doing cards picked up.

## Round 144 (Doing — 2026-07-02, detay alt kartları)
- [x] `6a46af30` / #1259 — Detay popup `Ekler / Fotoğraflar` kart zemini `Açıklama` paneliyle aynı soluk nötr renge çekildi.
- [x] `6a46afc9` / #1260 — Detay popup adres bölümünde `Açık Adres`, `Cadde / Sokak / Bulvar` alanının sağ tarafındaki aynı satır akışına alındı.
- [x] `6a46b083` / #1261 — Detay popup `Talebin Gittiği Birim` etiketi `Talebin Gittiği Birim / Görevi Yapan` oldu; atama yoksa değer `Birim / -` gösteriyor.

## STATUS: Round 144 complete — cards moved to Done; follow-up Doing cards picked up.

## Round 145 (Doing — 2026-07-02, görev detay öncelik satırı)
- [x] `6a4299a1` reopened / #1118 — Görev detay popup'ında `Görev Tipi = Atanmış` olduğunda `Öncelik` satırı gizlendi; rutin görevlerde görünmeye devam ediyor.

## STATUS: Round 145 complete — cards moved to Done; follow-up Doing cards picked up.

## Round 146 (Doing — 2026-07-02, vatandaş breadcrumb)
- [x] `6a46b2bf` / #1262 — `Vatandaş Talepleri` breadcrumb'ından `Vatandaş İlişkileri` ara katmanı kaldırıldı.

## STATUS: Round 146 complete — Doing list drained.

## Round 147 (Doing — 2026-07-02, detay alt kart reopen düzeltmeleri)
- [x] `6a46af30` reopened / #1259 — `Ekler / Fotoğraflar` soluk zemin sınıfı yanlışlıkla Adres kartına değil, gerçek Ekler kartına bağlandı.
- [x] `6a46afc9` reopened / #1260 — Detay popup adres alanları Mahalle / Cadde-Sokak-Bulvar / Açık Adres olarak üçlü yan yana zorlandı.
- [x] `6a46b083` reopened / #1261 — `Talebin Gittiği Birim / Görevi Yapan` etiketi tek satırda kalacak şekilde sarma engellendi.

## STATUS: Round 147 complete — Doing list drained.

## Round 148 (Doing — 2026-07-02, otomatik cevap sabit alanları)
- [x] `6a46b541` / #1263 — Ayarlar > Otomatik Yönlendirme altında `Vatandaşa Giden Cevaplar` bölümü üstteki Otomatik Yönlendirme kartının altına alındı; VT no, talep başlığı ve durum adları sabit chip/pill olarak gösterilip yalnız orta metin düzenlenebilir kaldı.

## STATUS: Round 148 complete — Doing list drained.

## Round 149 (Doing — 2026-07-02, adres etiketi satır kırma)
- [x] `6a46afc9` reopened / #1260 — Detay popup `Adres Bilgileri` içindeki `Cadde / Sokak / Bulvar` etiketi tek satır kalacak şekilde nowrap yapıldı.

## STATUS: Round 149 complete — Doing list drained.

## Round 150 (Doing — 2026-07-02, terminal not ve otomatik cevap metni)
- [x] `6a46b7c7` / #1264 — Talep detayında terminal `Not` popup başlığı iptalde `İptal Notu`, tamamlanmış talepte `Tamamlanma Notu` oldu.
- [x] `6a46b846` / #1265 — Vatandaşa Giden Cevaplar tamamlanma durum etiketi `Tamamlanmış` yerine `Tamamlandı` gösteriyor.

## STATUS: Round 150 complete — Doing list drained.

## Round 151 (Doing — 2026-07-02, vatandaş durum bildirimi ve detay stilleri)
- [x] `6a46b91a` / #1266 — Vatandaş talebi görünen durum geçişlerinde otomatik cevap tetiklenir: ilk görevle `Yapılmakta`, kapanış/tamamlama ile `Tamamlanmış`, oluşturma/başlangıçta `İşleme Alındı`; iptal/red/son tarihi geçmiş etiketleri bu üçlü şablona yanlış düşmez.
- [x] `6a46b7c7` reopened / #1264 — Detay popup terminal not başlıkları renklendirildi: `İptal Notu` kırmızı, `Tamamlanma/Tamamlama Notu` yeşil.
- [x] `6a46afc9` reopened / #1260 — Taleplerim detay `Adres Bilgileri` etiketleri (`Mahalle`, `Cadde / Sokak / Bulvar`, `Açık Adres`) altı çizili hale getirildi.

## STATUS: Round 151 complete — Doing list drained.

## Round 152 (Doing — 2026-07-02, adres etiketi çizgi stili)
- [x] `6a46afc9` reopened / #1260 — Taleplerim detay `Adres Bilgileri` etiketlerindeki alt çizgi, text underline yerine görseldeki gibi açık gri label alt sınır çizgisi yapıldı.

## STATUS: Round 152 complete — Doing list drained.

## Round 153 (Doing — 2026-07-02, vatandaş cevap iptal ve operatör onayı)
- [x] `6a46c200` / #1268 — Vatandaşa Giden Cevaplar ayarına en sonda `İptal` durumu eklendi; İptal şablonu tenant JSON ayarında saklanır ve vatandaş talebi iptale geçince otomatik cevap kuyruğa alınır. WhatsApp durum cevapları doğrudan gönderilmez, vatandaş operatörü `Mesajı Gönder` ile onaylayınca iletilir.
- [x] `6a46c19c` / #1267 — Vatandaş operatörü bekleyen Tamamlandı/İptal otomatik mesajlarında `Düzenle` yanında yeşil `Tamamlanma Notu` veya kırmızı `İptal Notu` butonu görür; tıklanınca görev/talep sahibinin notu popup'ta açılır.

## STATUS: Round 153 complete — cards moved to Done; follow-up Doing cards picked up.

## Round 154 (Doing — 2026-07-02, adres çizgi ve log metinleri)
- [x] `6a46afc9` reopened / #1260 — Taleplerim detay `Adres Bilgileri` boş değer çizgisi `—` yerine `-` oldu; label çizgisi ve değer font ağırlığı hafifletildi.
- [x] `6a46c43a` / #1269 — Log ekranında `Şlem` sütun başlığı `İşlem` oldu; audit aksiyonlarında `İş tamamlandı` yerine `Görev tamamlandı` / `Talep tamamlandı` ayrımı yapıldı.

## STATUS: Round 154 complete — Doing list drained.

## Round 155 (Doing — 2026-07-03, otomatik cevaplar ve talep grid/detail davranışları)
- [x] `6a46c200` reopened / #1268 — Vatandaşa Giden Cevaplar iptal otomatik mesajı artık giden/kaydedilen metinde `İptal Edildi` durumunu üretir; backend/frontend varsayılanları eşitlendi.
- [x] `6a474a6e` / #1272 — Vatandaş operatörü bekleyen ara durum (`İşleme Alındı`/`Yapılmakta`) mesajlarında `İptal Notu`/`Tamamlanma Notu` butonları gizlendi; terminal not butonu yalnız terminal durum mesajlarında görünür.
- [x] `6a474b39` / #1273 — Birime Gelen ve Birimden Giden grid `İşlemler` sütununda yalnız `Detaylar` kaldı; onay/iptal aksiyonları detay üst sağ alanında aktif/pasif mantığıyla kullanılmaya devam eder.
- [x] `6a474d0b` / #1275 — Birim yöneticisinin oluşturduğu birim içi aktif taleplerde Süreç timeline'ına Son Tarih öncesinde turuncu `Durum / Yapılmakta` adımı eklendi.
- [x] `6a46cb51` / #1271 — WhatsApp Konuşmaları detayında kullanıcı yukarı scroll yaptıysa refresh/tıklama otomatik dibe indirmez; yalnız dibe yakınken veya mesaj gönderirken otomatik scroll çalışır.
- [x] `6a474c18` / #1274 — Üst düzey yönetici (Reporter) kaynaklı taleplerde grid başlık metni turuncu gösterilir.
- [x] `6a4756fe` / #1276 — Yönetici Notu textarea arka planı Ekler / Fotoğraflar alanındaki soluk zeminle eşitlendi.
- [x] `6a46c4f4` / #1270 — Vatandaşa Giden Cevaplar durum chip renkleri güncellendi: `İptal` kırmızı, `İşleme Alındı` ve `Yapılmakta` turuncu.

## STATUS: Round 155 complete — cards moved to Done; follow-up Doing card picked up.

## Round 156 (Doing — 2026-07-03, süreç timeline yeşil/geçiş tonu)
- [x] `6a475ad7` / #1278 — Detay Süreç timeline'ında tamamlanmış çizgi/düğüm yeşili `Düzenle` butonu yeşiline eşitlendi; yeşil→turuncu geçişi amber ara tonla daha belirgin ve yumuşak yapıldı.

## STATUS: Round 156 complete — card moved to Done; follow-up Doing cards picked up.

## Round 157 (Doing — 2026-07-03, reopen ince ayarları)
- [x] `6a46c200` reopened / #1268 — Vatandaşa Giden Cevaplar iptal durum chip'i de artık `İptal Edildi` gösterir; iptal otomatik mesajındaki durum metniyle eşitlendi.
- [x] `6a474d0b` reopened / #1275 — Süreç timeline'ındaki özel `Durum` adımının durum metni `Talep Tarihi` başlığıyla aynı küçük metin boyutuna indirildi.
- [x] `6a475dbe` / #1279 — Birime Gelen ve Birimden Giden grid `İşlemler` sütunundaki onay/iptal butonları geri getirildi; Reporter başlık turuncusu korunur.

## STATUS: Round 157 complete — cards moved to Done; follow-up Doing cards picked up.

## Round 158 (Doing — 2026-07-03, popup ve timeline geçiş düzeltmesi)
- [x] `6a475ad7` reopened / #1278 — Süreç timeline yeşil→turuncu geçiş bandı azaltıldı; yeşil ton korunurken geçiş daha kısa/sakin yapıldı.
- [x] `6a47607f` / #1280 — Incoming detayında `Active` ve henüz görevi olmayan taleplerde `Onayla` artık confirm yerine `Onayla ve Personel Ata` popup'ını açar.

## STATUS: Round 158 complete — cards moved to Done; follow-up Doing cards picked up.

## Round 159 (Doing — 2026-07-03, WhatsApp ikon ve liste zamanı)
- [x] `6a475ad7` reopened / #1278 — Süreç timeline yeşil→turuncu geçişi çizginin orta hizasından başlatıldı.
- [x] `6a477f9f` / #1291 — WhatsApp konuşma listesindeki sağ üst zaman alanı göreli gün yerine son mesajın saat:dakika değerini gösterir.
- [x] `6a477e0c` / #1290 — Trello ekindeki yeni WhatsApp ikonu ortak `/icons/whatsapp.webp` asset'i olarak eklendi ve eski svg referansları güncellendi.
- [x] `6a477d77` / #1289 — WhatsApp konuşmaları bölümündeki konuşma/list/detail fallback ikonları WhatsApp ikonuna çevrildi.

## STATUS: Round 159 complete — Doing list drained.

## Round 160 (Doing — 2026-07-03, WhatsApp konuşma operatör araçları)
- [x] `6a476e7c` / #1284 — Vatandaş operatörü `/whatsapp` konuşmasından direkt mesaj gönderebilir; yeni direkt mesajlar bekleyen `Düzenle`/`Mesajı Gönder` aksiyonlarını üretmez.
- [x] `6a478b47` / #1292 — WhatsApp konuşma detayı varsayılan açılışta son mesaj konumuna gider; sonrasında kullanıcı yukarı scroll yaptıysa otomatik dibe çekilmez.
- [x] `6a476ea3` / #1285 — Operatörün manuel yazdığı mesajlar `sendImmediately` akışıyla vatandaşa doğrudan gönderilir.
- [x] `6a475ad7` reopened / #1278 — Süreç timeline geçişleri hedefin %75 hizasında başlar; turuncudan griye geçiş de gradient oldu.
- [x] `6a476e29` / #1282 — WhatsApp footer'a şablon butonunun sağına dosya ekle aksiyonu eklendi; seçilen ek konuşma alanında bekleyen balon olarak görünür ve altında `Düzenle` / `Mesajı Gönder` aksiyonları bulunur.
- [x] `6a4773b9` / #1287 — WhatsApp konuşma listesi/header talep sayısının yanında `İşleme Alındı`, `Yapılmakta`, `Tamamlandı`, `İptal` durum sayaçlarını gösterir.
- [x] `6a476fd5` / #1286 — WhatsApp konuşma detay sağ paneline vatandaş adı, numara, etiket, mahalle, cadde/sokak/bulvar ve açık adres düzenleme/kaydetme alanı eklendi; isim kaydı sol liste/header görünümüne yansır.

## STATUS: Round 160 complete — cards moved to Done; follow-up Doing cards picked up.

## Round 161 (Doing — 2026-07-03, Vatandaş Talepleri grid kolonları)
- [x] `6a476e47` / #1283 — Vatandaş Talepleri gridinde `Durum` sütunu kaldırıldı; yerine operatörün talep etiketi/kategorisini gösteren `Etiket` kolonu eklendi.
- [x] `6a478c8d` / #1293 — Grid başlıkları `Vatandaş / Talep No` ve `Vatandaş / Talep Tarihi` olarak iki satıra bölündü.
- [x] `6a478d6d` / #1294 — Gridde `Kanal` sütunu kaldırıldı; WhatsApp kanal ikonu `Vatandaş Talep No` değerinin başına alındı.

## STATUS: Round 161 complete — cards moved to Done; follow-up Doing cards picked up.

## Round 162 (Doing — 2026-07-03, WhatsApp konuşma sayaçları, FAB ve iç mesajlar)
- [x] `6a478fe8` / #1295 — WhatsApp FAB artık operatör dışındaki ilgili kullanıcılar için de çalışır; yalnız atanmış kişi/aktif departman ve terminal olmayan vatandaş talepleri bildirim kapsamına girer.
- [x] `6a479c66` / #1298 — `/whatsapp` detay sağ panelindeki `Talep Sayısı` başlıklı ayrı blok kaldırıldı.
- [x] `6a479c9f` / #1299 — Durum sayaçları sol panelde `Konuşmalar` başlığı altında görünür hale getirildi.
- [x] `6a478b47` reopened / #1292 — Konuşma detayı yenilenirken mevcut detail state'i boşaltılmıyor; numara tıklama/refresh görsel çerçeve zıplaması üretmez.
- [x] `6a4773b9` reopened / #1287 — Konuşma kartı ve detay header'ındaki `Talep Sayısı`/durum sayaç satırları kaldırıldı; sayaçlar tek toplam filtre alanında toplandı.
- [x] `6a479d1c` / #1300 — WhatsApp footer'da `Dosya ekle` aksiyonu `Şablon mesaj ekle` butonunun soluna alındı.
- [x] `6a476e29` reopened / #1282 — `Dosya ekle` seçimi konuşma içinde bekleyen ek balonunu açar ve kullanıcıyı yeni eke kaydırır.
- [x] `6a4795b1` / #1297 — `İşleme Alınan`, `Yapılmakta`, `Tamamlandı`, `İptal` toplam sayaçları tıklanabilir filtreye dönüştürüldü.
- [x] `6a476deb` / #1281 — Operatör `/whatsapp` konuşmasında birim seçerek aynı konuşmaya vatandaşa gitmeyen iç mesaj ekleyebilir.
- [x] `6a475ad7` reopened / #1278 — Süreç timeline geçişleri hedefin %50 hizasından başlar; yeşil→turuncu ve turuncu→gri geçişler iki renk ailesinde yumuşatıldı.

## STATUS: Round 162 complete — cards moved to Done.

## Round 163 (Doing — 2026-07-03, WhatsApp FAB ikon merkezi)
- [x] `6a4791d9` / #1296 — Sağ alt WhatsApp konuşma FAB'ında mevcut `/icons/whatsapp.webp` asset'i beyaz merkez disk içinde gösterildi; ikon artık içi boş görünmez.

## STATUS: Round 163 complete — cards moved to Done.

## Round 164 (Doing — 2026-07-03, WhatsApp footer ve başlıksız durum sayaçları)
- [x] `6a479d1c` reopened / #1300 — `/whatsapp` footer'da `Dosya ekle` butonu aksiyon satırının en sağına alındı.
- [x] `6a4773b9` reopened / #1287 — Yalnız `Talep Sayısı` metni kaldırılmış halde kalır; konuşma satırı ve detay header'ındaki `İşleme Alınan/Yapılmakta/Tamamlandı/İptal` durum kırılımları geri getirildi.

## STATUS: Round 164 complete — cards moved to Done.

## Round 165 (Doing — 2026-07-03, WhatsApp liste sayaçları ve timeline reopen)
- [x] `6a4773b9` reopened / #1287 — Sol konuşma kartındaki `Talep Sayısı: N` satırı kaldırıldı; altındaki durum kırılımları korunur.
- [x] `6a4791d9` reopened / #1296 — Sağ alt WhatsApp FAB beyaz merkez disk olmadan eski yalın yeşil baloncuk görünümüne döndürüldü.
- [x] `6a475ad7` reopened / #1278 — Süreç timeline geçişi %50'den başlar; yeşil→turuncu geçişi ara renk bandı olmadan iki renk karışımıyla yapılır, turuncu→gri de %50'den başlar.
- [x] `6a4795b1` reopened / #1297 — `Konuşmalar` altındaki toplam `İşleme Alınan/Yapılmakta/Tamamlandı/İptal` sayaçları tek satırda kalacak şekilde sıkılaştırıldı.

## STATUS: Round 165 complete — cards moved to Done.

## Round 166 (Doing — 2026-07-03, WhatsApp toplam sayaç fontu)
- [x] `6a4795b1` reopened / #1297 — `Konuşmalar` altındaki toplam durum sayaçlarının fontu tek satır korunarak büyütüldü.

## STATUS: Round 166 complete — card moved to Done.

## Round 167 (Doing — 2026-07-03, WhatsApp toplam Tümü filtresi)
- [x] `6a47b98e` / #1302 — `Konuşmalar` altındaki toplam sayaç satırına durum sayılarının toplamını gösteren `Tümü` eklendi; tıklanınca status filtresi temizlenip tüm numaralar gösterilir.

## STATUS: Round 167 complete — card moved to Done.

## Round 168 (Doing — 2026-07-03, WhatsApp Tümü üst satır hizası)
- [x] `6a47b98e` reopened / #1302 — `Tümü` butonu toplam sayaç satırından alınıp üst başlık satırında `Konuşmalar` sayısının yanına hizalandı.

## STATUS: Round 168 complete — card moved to Done.

## Round 169 (Doing — 2026-07-03, WhatsApp Tümü ayrı alt satır)
- [x] `6a47b98e` reopened / #1302 — `Tümü` butonu `Konuşmalar` başlığının altındaki kendi satırına taşındı; `İşleme Alınan/Yapılmakta/Tamamlandı/İptal` satırı onun altında aynı kaldı.

## STATUS: Round 169 complete — card moved to Done.

## Round 170 (Doing — 2026-07-04, WhatsApp profil/grid/wallboard görsel düzeltmeleri)
- [x] `6a47c593813c55afb9248370` / #1303 — `/whatsapp` birim seçimi yalnız seçili konuşmadaki aktif taleplerin hedef birimlerini listeler.
- [x] `6a4816ae567227760b5f03ab` / #1322 — Taleplerim detay popup'ında Talep No/Talep Başlığı satırları kaldırılıp başlık/açıklama/öncelik-proje özeti eklendi.
- [x] `6a4815d8faffe7618c65c5c6` / #1321 — Süreç timeline yeşil→turuncu geçişi sert orta geçişe alındı.
- [x] `6a47f59988e0447ada0a781e` / #1308 — WhatsApp arama placeholder'ı `Telefon no, vatandaş adı...` oldu.
- [x] `6a47fe417b1cc47b2592e95b` / #1313 — Wallboard Reporter satırında başlık/görev sahibi turuncu, oluşturan adı birim altında kaldı.
- [x] `6a480f483de67643ccecc873` / #1319 — Ortak grid/table dış çerçeveleri kaldırıldı.
- [x] `6a480eee5b7b3ba71e7be9cd` / #1318 — Grid header uppercase zorlaması kaldırıldı.
- [x] `6a480c41e9b2065849e78fc5` / #1315 — Rutin görev formunda dosya ekle butonu açık adres hizasına, dosya alanı geniş bölüme alındı.
- [x] `6a47f7714fdd976e42482047` / #1311 — Filterable grid header label/ikon aralığı dengelendi.
- [x] `6a47fd767dd6d5aacded1f0e` / #1312 — Frontend ana fontu Plus Jakarta Sans'a geçirildi.
- [x] `6a480cee27c9ab88d9b0c41d` / #1316 — Birim dışı talep formu 27 inç görünüm için daha kompakt hale getirildi.
- [x] `6a47f64b05929e46ddf91023` / #1309 — WhatsApp profil kaydında vatandaş adı Türkçe başlık biçimine normalize edilir.
- [x] `6a47ff974557d32b3594f86f` / #1314 — Wallboard `Görevin Talep Yeri` metni koyu zeminde daha görünür yapıldı.
- [x] `6a47f4d58bb3579c92aa1089` / #1307 — WhatsApp listesinde kayıtlı ad üstte, telefon altta korunur.
- [x] `6a47f6c9f42260d6da663afd` / #1310 — Kayıt payload'larında ilgili textbox değerleri Türkçe başlık biçimine normalize edilir.
- [x] `6a47f3e0f5c469d915943280` / #1306 — WhatsApp profilinde numara salt okunur/ülke kodsuz, etiket adı ve mahalle/adres kapısı güncellendi.
- [x] `6a4811a9eb9ad16c12020d35` / #1320 — Timeline mevcut turuncu noktasına pulse glow efekti eklendi.
- [x] `6a47f3829daa5e0566f7e7b9` / #1305 — WhatsApp iç mesaj butonu `Kurum İçi İlet` oldu.
- [x] `6a47f29711ae004d3550035a` / #1304 — WhatsApp detay header durum sayaçları kaldırıldı, `Talep Sayısı` seçili numaranın talep sayısından hesaplandı.
- [x] `6a480d44edd728c412cabad4` / #1317 — Wallboard Reporter görev sahibi/tarih değerleri turuncu vurguyla korunur.

## Round 171 (Hotfix — 2026-07-04, WhatsApp dosya eki gönderimi)
- [x] Kullanıcı raporu — `/whatsapp` Dosya ekle akışı dosyayı gerçek medya olarak göndermiyordu; frontend sadece dosya adını metne ekliyordu. Multipart reply endpoint'i, WhatsApp Cloud medya upload/send akışı ve yerel görsel/dosya önizlemesi eklendi.

## Round 172 (Hotfix — 2026-07-04, WhatsApp bildirim FAB ikonu)
- [x] Kullanıcı raporu — Sağ alt WhatsApp bildirim FAB'ı yalın yeşil baloncuk olarak kaldı; merkez ikon beyaz çizgisel/içi boş WhatsApp formuna çevrildi.
- [x] Rework — Çizgisel ikon uygulamadaki ikonla uyumsuz göründüğü için FAB merkezi beyaz disk içinde ortak `/icons/whatsapp.webp` asset'ine çevrildi.

## Round 173 (Hotfix — 2026-07-04, WhatsApp ek kaydı medya zorunluluğu)
- [x] Kullanıcı raporu — Canlı log/DB kontrolünde dosya gönderiminin eski `/reply` endpoint'inden gittiği ve `mediaid` boş düz metin balonu ürettiği görüldü. Eski endpoint artık `[Dosya eki: ...]` WhatsApp direkt gönderimini reddeder; frontend sürümü `0.1.2` yapıldı.

## Round 174 (Doing — 2026-07-04, 20 kart reopen — gridview/Taleplerim/WhatsApp/Wallboard/font)
- [x] `6a4815d8` reopened / #1321 — Süreç timeline yeşil→turuncu geçişi ekteki referans gibi tüm çizgi boyunca yumuşak (düz linear-gradient) geçişe alındı; sert orta bant kaldırıldı.
- [x] `6a480eee` reopened / #1318 — Gridview header font-size 0.84rem→0.98rem büyütüldü.
- [x] `6a480f48` reopened / #1319 — Gridview'ları saran `.section-card` dış çerçevesi `:has(.data-table)` ile hedeflenerek kaldırıldı (Round 170'te yalnız `table-wrap` temizlenmişti, dış kart border'ı kalmıştı).
- [x] `6a47fe41` reopened / #1313 — Wallboard reporter satırında birim adı + oluşturan adı aynı satıra "yapışıyordu" (`ReporterDepartmentName` + `.wallboard-creator-line` ikisi de `inline-flex` olduğu için yan yana diziliyordu); ikisi de `flex`'e çevrilip alt satıra düşürüldü.
- [x] `6a47f599` — WhatsApp arama placeholder zaten "Telefon no, vatandaş adı..." idi, değişiklik gerekmedi.
- [x] `6a48a5e0`/`6a48a50a`/`6a4816ae` reopened / #1322 — Taleplerim ana kart: `Talep Başlığı` küçük başlık artık verinin üst satırında, sağında Talep No + Birim İçi/Dışı rozeti; kutu arka planı `bg-white`; Öncelik/Proje satırı kutudan çıkarılıp `Talebin Gittiği Birim / Görevi Yapan`ın altına ayrı satır olarak eklendi; alt alan listesinin üstüne ayraç eklendi; `--request-info` value hizası sola çevrildi (`detail-modal-shell--my-request` scope'unda).
- [x] `6a48a764` — Rutin Görev Oluştur dosya ekle butonu üstten hizalandı (`items-end`→`items-start`).
- [x] `6a47fd76` reopened / #1312 — Plus Jakarta Sans token zaten ayarlıydı ama `@fontsource` yalnız 500/600/700 ağırlıklarını yüklüyordu; 400 (gövde metni) ve 800 eklendi — çoğu düz metin hâlâ sistem fontuna düşüyordu.
- [x] `6a48ac67` — Görevlerim "Görev Tipi / Görevi Yapan" başlık hücresine `pl-3` sol boşluk eklendi.
- [x] `6a47f771` — WhatsApp konuşma detay header avatarı `var(--color-header-from)` koyu yeşilinden sidebar listesindeki `bg-emerald-100`/`text-emerald-800` stiline çevrildi.
- [x] `6a48acd2` — WhatsApp detay header `Talep Sayısı` artık `detail.tickets.length` değil, İşleme Alınan+Yapılmakta+Tamamlandı+İptal toplamı.
- [x] `6a48ab86` — Kök neden: `Kurum İçi İlet` mesajı her zaman `primaryTicket.socialMessageId`'ye yazılıyordu; birden fazla aktif talep farklı birimlere gidiyorsa mesaj YANLIŞ talebin altına düşüyor, o birimin yöneticisi "yazışmaya git"te görmüyordu. Artık seçilen `internalDepartmentId`'ye sahip ticket'ın `socialMessageId`'sine yazılıyor.
- [x] `6a478fe8` — İnceleme: backend `GetCitizenConversationsQuery` zaten atanan personel/hedef birim + terminal-olmayan durum kuralını doğru uyguluyor; kod değişikliği gerekmedi.
- [x] `6a47f3e0` — WhatsApp profil panelindeki Mahalle native `<select>` idi; standart `SingleSelectDropdown` + `stringListSelectOptions`'a çevrildi.
- [x] `6a47ff97` — Wallboard "Görevin Talep Yeri" (`.wallboard-request-location`) rengi `ReporterDepartmentName`'in varsayılan `text-slate-700` utility'siyle eziliyordu (koyu zeminde silik); `!important` eklendi.
- [x] `6a48a8cf` — WhatsApp konuşma paneli ilk açılışta dibe kayma efekti `useEffect` yerine `useLayoutEffect`'e alındı; paint öncesi konumlanarak yukarıdan aşağı görünür scroll flaşı önlendi.
- [x] `6a48a825` — WhatsApp konuşma listesinde numara altındaki son mesaj önizleme satırı kaldırıldı.
- [x] `6a4791d9` reopened / #1296 — Sağ alt WhatsApp FAB merkez ikonu, yeni gönderilen dolu (filled) logo görseliyle (`/icons/whatsapp-fab.png`) değiştirildi; bu değişiklik yalnız bu FAB'a uygulandı, diğer `/icons/whatsapp.webp` kullanımları (nav, breadcrumb, liste) korundu.

## STATUS: Round 174 complete — cards moved to Done.

## Round 175 (Doing — 2026-07-04, pie chart başlığı + birim dışı dosya alanı yüksekliği)
- [x] `6a3ae2f4` — Üst Düzey Yönetici dashboard pie chart başlığı `dashboard.charts.externalRequestPending`
  "Birimde Bekleyen Talepler" → "Birimlerde Bekleyen Talepler" oldu.
- [x] `6a480cee` — Birim Dışı/İçi/Vatandaş Talebi oluşturma formlarında ortak `Dosya / Fotoğraf Ekle`
  alanının dropzone + dosya listesi kutularının `min-h` değeri `5.5rem`→`4rem` düşürüldü.

## STATUS: Round 175 complete — cards moved to Done.

## Round 176 (Doing — 2026-07-04, yeni özellik: Mahallelerde Tamamlanan Talepler grafiği)
- [x] `6a4775ad` / #1330 — Üst Düzey Yönetici kontrol panelinde yeni pie chart eklendi:
  "Mahallelerde Tamamlanan Talepler" — `Job.Neighborhood` dolu ve `Status=Completed` olan tüm
  taleplerin (talep tipinden bağımsız) mahalleye göre dağılımı. Backend: yeni
  `BuildNeighborhoodCompletedRequestsChartAsync` (`GetDashboardStatusChartsQuery.cs`), Reporter
  dalına eklendi. Frontend: yeni `dashboard.charts.neighborhoodCompletedRequests` i18n anahtarı +
  `isReadOnlyDepartmentChart` listesine eklendi (diğer Reporter-özel grafikler gibi tıklanınca
  yönlendirme yapmaz). `chartCards` backend'den dinamik geldiği için ek frontend wiring gerekmedi.

## STATUS: Round 176 complete — card moved to Done.

## Round 177 (Doing — 2026-07-04, global font Plus Jakarta Sans → Inter)
- [x] `6a47fd76` reopened — Kullanıcı Plus Jakarta Sans'tan (Round 174, card #1312) vazgeçip global fontu
  Inter'e çevirmek istedi. `@fontsource/inter` kuruldu (400/500/600/700/800), `@fontsource/plus-jakarta-sans`
  kaldırıldı; `tokens.css`'te `--font-sans`/`--font-display` `Inter`'e alındı; `main.tsx` import'ları güncellendi.

## STATUS: Round 177 complete — card moved to Done.

## Round 178 (Doing — 2026-07-04, Taleplerim sola-hizalama geri alındı)
- [x] `6a48a5e0` reopened / "Beğenmedim geri al" — Round 174'te eklenen
  `.detail-modal-shell--my-request .job-detail-field-row--request-info .job-detail-field-row__value { text-align: left; }`
  override'ı kullanıcı tarafından beğenilmedi, kaldırıldı; satır değerleri eski (sağa hizalı) görünümüne döndü.

## STATUS: Round 178 complete — card moved to Done.

## Round 179 (Doing — 2026-07-04, Taleplerim başlık satırı refine)
- [x] `6a48a50a` reopened — Taleplerim ana kart üst kutusu yeniden düzenlendi: `TALEP BAŞLIĞI` küçük
  başlığı artık tek başına kendi satırında; Talep No, başlık metninin YANINA taşındı (caption satırından
  değil); Birim İçi/Birim Dışı rozeti tamamen kaldırıldı; talep başlığı metni `normalizeTitleCaseField`
  ile Title Case gösterilir (yalnız görüntüleme, kayıtlı veri değişmez); "Öncelik / Proje" satır etiketi
  "Öncelik / Proje Niteliğinde mi?" oldu.

## STATUS: Round 179 complete — card moved to Done.

## Round 180 (Doing — 2026-07-04, Mahalle dropdown arama+yön + WhatsApp FAB beyaz disk kaldırma)
- [x] `6a48bf6e` — `SingleSelectDropdown`'a genel `searchable`/`searchPlaceholder` prop'u eklendi (paneldeki
  ilk satırda contains arama kutusu, `toLocaleLowerCase('tr')` ile); tüm Mahalle kullanım noktalarına
  (`CreateRequestPage`, `RoutineTaskPage`, `CitizenRequestModal`, `WhatsAppConversationsPage` profil paneli,
  `MyRequestAddressEditFields`) `searchable` + `openUp` eklendi (biri zaten `openUp` idi).
- [x] `6a4791d9` reopened — WhatsApp bildirim FAB'ındaki ikonu saran beyaz dairesel disk kaldırıldı; ikon
  artık doğrudan yeşil FAB zemininde görünüyor.

## STATUS: Round 180 complete — cards moved to Done.

## Round 181 (Doing — 2026-07-04, 3 reopen: placeholder locale + dosya ekle konumu + header padding)
- [x] `6a47f599` reopened — Kök neden: Round 174'te kod içi fallback zaten "vatandaş adı" idi ama locale
  dosyasındaki `whatsapp.searchPlaceholderExtended` anahtarı eski "Telefon no, kullanıcı adı…" metnini
  taşıyor ve fallback'i eziyordu. TR "vatandaş adı…", EN "citizen name…" olarak düzeltildi.
  DERS: t() fallback'i düzeltmek yetmez, locale dosyasındaki gerçek değeri kontrol et.
- [x] `6a48a764` reopened — Round 174'te yalnız dikey hiza değişmişti; asıl istek butonun kutunun
  SOLUNA taşınmasıydı. Rutin görev formunda grid kolon sırası değiştirildi: `Dosya ekle` butonu solda
  (`auto`), dosya listesi kutusu sağda (`1fr`).
- [x] `6a48ac67` reopened — Kök neden: header hücrelerinin varsayılan yatay padding'i
  `--table-chrome-row-px: 1rem`; Round 174'te eklenen `pl-3` (0.75rem) utility katmanı kazandığı için
  padding'i DÜŞÜRMÜŞTÜ. `pl-6` (1.5rem) yapıldı — artık gerçekten sol boşluk var.

## STATUS: Round 181 complete — cards moved to Done.

## Round 182 (Doing — 2026-07-04, 20 kart: timeline onay mantığı + popup yeniden yapılandırma + drilldown)
- [x] `6a47fd76` reopened — Font değişiklikleri İLK hale döndürüldü: Inter kaldırıldı,
  `@fontsource/plus-jakarta-sans` 500/600/700 (Round 174 öncesi durum) geri geldi; tokens.css PJS.
- [x] `6a48fb51` — Tüm gridview başlıkları (`data-table`, `table-container`, `wallboard-table` thead th)
  yeniden `text-transform: uppercase` yapıldı (card #1318'in tersine dönüşü).
- [x] `6a48ce9e` — Standart kullanıcı "Birimdeki Görevler" grafiğinde `Benim Görevlerim` dilimi artık
  `/my-tasks?view=all` (Tüm Görevlerim) gridine gider.
- [x] `6a48d22e` — CitizenRequestModal `Dosya ekle` butonunun ataç ikonu `text-emerald-700` yapıldı.
- [x] `6a48d200` — Rutin görev `Dosya ekle` butonu görseldeki gibi alt hizaya (`items-end`) alındı.
- [x] `6a47ff97` — Pie chart başlık altı çizgisi `border-current` yerine standart satır ayracı
  (`border-slate-200`) oldu.
- [x] `6a48fa87` — Reporter kendi Taleplerim gridinde kendi taleplerini turuncu görmez
  (`isReporterJob && !(isMyRequestsView && isReporter)`).
- [x] `6a48e8d4` — Bildirim başlığında durum kelimesi varsa TÜM başlık o renge boyanır (yeşil/kırmızı);
  `(Vatandaş Talebi)` etiketi turuncu kalır.
- [x] `6a48d31c` — WhatsApp iç mesaj balonu: `İç mesaj` → `Kurum İçi Mesaj` (kırmızı, ilk satır),
  birim · kullanıcı ikinci satırda. Backend yeni etiketi yazar, frontend eski kayıtları normalize eder.
- [x] `6a48d31e` — WhatsApp talep oluştur popup'ında `Vatandaş Telefon No` salt okunur; kayıtlı
  vatandaş adı varsa `Vatandaş Adı / Gönderen` dolu + salt okunur gelir (forceNewRequest dahil).
- [x] `6a48a8cf` reopened — Konuşma açılış scroll'u: `scrollIntoView` yerine doğrudan `scrollTop`
  ataması + ilk açılışta 800ms rAF dibe-sabitleme (medya yüklenince içerik uzasa da animasyonsuz).
- [x] `6a475999` — `SingleSelectDropdown`'a `menuClassName` prop'u; Taleplerim düzenleme Mahalle
  menüsü `min-w-full w-max max-w-[20rem]` ile genişledi (trigger genişliği değişmedi).
- [x] `6a48e32d`/`6a48e214` — Kök neden: `CreateJobCommand` yönetici birim dışı talebinde hedef birime
  oluşturan+oluşturma-zamanı damgalıyordu ("onaylanmış" görünüyordu). Artık otomatik onayda karar
  alanları boş; gerçek onaycı/tarih hedef birim yöneticisi personel atadığında yazılır
  (`CitizenJobTargetApproval` external'a genişletildi, eski yaratıcı-damgalı satırları da düzeltir).
  Frontend `shouldShowCitizenTargetApprovalDate`: adım yalnız Approved+gerçek karar+görev varsa görünür;
  birim içi taleplerde hiç görünmez.
- [x] `6a48e73a` — Standart kullanıcı `Onaylanmış Taleplerim` chip'i `Onaylanmış/Yapılmakta Taleplerim`
  oldu (chip yalnız standart kullanıcıda görünür); Active statüdeki standart kullanıcı taleplerinde
  timeline'a turuncu `Durum / Yapılmakta` step'i eklendi (mevcut yönetici-birim-içi istisnasına ek).
- [x] `6a48dcca` — Terminal (son) yeşil/kırmızı timeline noktasına turuncu-pulse'ın yeşil/kırmızı
  eşdeğeri eklendi (`--pulse-success`/`--pulse-danger`).
- [x] `6a48a3f2` — Taleplerim ana kart yeniden düzenlendi: kolon1 = `Talep Başlığı` (FileText ikonlu,
  diğer başlıklarla aynı stil + alt çizgi) başlık + açıklama; kolon2 = `Talep Bilgileri` (Info ikonlu)
  alan satırları; kolon3 = Süreç. Sağdaki Açıklama paneli kaldırıldı (içerik kolon1'de).
- [x] `6a48a50a` reopened — Talep No artık `Talep Başlığı` BAŞLIĞININ yanında; parantezli `(Birim İçi)`
  metni silinip turuncu zeminli rozet geri geldi; başlık verisi font-bold'a düşürüldü; açıklama siyah;
  `Öncelik / Proje Niteliğinde mi?` değeri `Normal · Hayır` biçimine sadeleşti.
- [x] `6a48e5c0` — Talep Bilgileri satırları gridview zebra deseni aldı (`nth-child(even) #f8fafc`).
- [x] `6a48cf6c` — YENİ ÖZELLİK: Reporter panosunda Taleplerim hariç 5 grafik diliminde tıklama,
  chart başlıklı popup + gridview detay açar. Backend `GetDashboardChartDrilldownQuery`
  (5 chartKey: citizenRequests/externalRequestCreators/Pending/Fulfillers/neighborhoodCompleted;
  Reporter/SystemAdmin gate, 200 satır limit), endpoint `GET /reports/dashboard-chart-drilldown`.
  Frontend `DashboardChartDrilldownModal` (body portal, zebra grid, VT-/T- numara, StatusPill).
- [x] Lint refactor — `resolveSliceLabel` → `utils/chartSliceLabel.ts`, `formatJobDisplayNumberText`
  → `utils/requestNumberText.ts` (react-refresh only-export-components kuralı).

## STATUS: Round 182 complete — cards moved to Done.

## Round 183 (Doing — 2026-07-04, birim havuzu seçeneği + açıklama 400 karakter)
- [x] `6a491f07` — KRİTİK: Standart kullanıcı birim içi talepte `Görevi Yapan Kişi/Birim` dropdown'ında
  `Birim Havuzu` yalnız placeholder'dı, seçilebilir SEÇENEK değildi (kendini seçince havuza dönüş yoktu).
  Standart kullanıcıda listeye `{value:'', label:'Birim Havuzu'}` ilk seçenek olarak eklendi
  (yönetici listesi değişmedi — o personel seçmek zorunda).
- [x] `6a491da8` — `RichTextEditor`'a düz-metin `maxLength` prop'u (varsayılan 400) eklendi: beforeinput
  ile fazla girişler engellenir, yapıştırmada kalan karaktere kırpılır. Tüm Açıklama alanları bu
  bileşeni kullandığından sınır otomatik uygulanır.

## STATUS: Round 183 complete — cards moved to Done.

## Round 184 (Doing — 2026-07-04, 9 kart: reopen düzeltmeleri + WhatsApp konuşma bütünlüğü)
- [x] `6a48ac67` reopened — Görevlerim/Birimdeki Görevler gridindeki `Görev Tipi / Görevi Yapan`
  başlık hücresinin sol boşluğu `pl-10` yapıldı; önceki `pl-6` görselde hâlâ sıkışık kalıyordu.
- [x] `6a478fe8` reopened — WhatsApp FAB görünürlüğü mevcut backend `isRelevantToCurrentUser`
  kuralıyla terminal olmayan, kullanıcıya atanmış veya aktif birimine yönlendirilmiş vatandaş
  taleplerine bağlı kalıyor; terminal conversation'lar ilgili kullanıcıdan gizli.
- [x] `6a48ab86` reopened — Detay popup `Yazışmaya Git` artık tek `SocialMessageId` entry'leriyle
  sınırlı değil; aynı vatandaş konuşmasındaki tüm ticket timeline'ı döner. Entry bazlı `socialMessageId`
  ile medya indirme, bekleyen mesaj gönderme ve düzenleme doğru ticket üzerinden çalışır.
- [x] `6a48cf6c` reopened — Reporter pie chart drilldown davranışı korunurken standart kullanıcı
  `Birimdeki Görevler > Benim Görevlerim` diliminin `/my-tasks?view=all` yönlendirmesi yeniden aktif edildi.
- [x] `6a491da8` reopened — Açıklama alanı başlıklarına görsel ibare eklendi:
  `(max 400 karakter) *` talep, vatandaş talebi, rutin görev ve e-Devlet açıklama girişlerinde görünür.
- [x] `6a48d31c` reopened — WhatsApp iç mesaj başlığı `Kurum İçi Mesaj` koyu kırmızıya alındı ve
  altındaki birim/kullanıcı satırıyla arasına ekstra boşluk verildi.
- [x] `6a48ce9e` reopened — Standart kullanıcı dashboard'unda `Birimdeki Görevler` grafiği başlığı
  yetki yoksa read-only kalsa bile slice click handler kapatılmıyor; `Benim Görevlerim` dilimi çalışır.
- [x] `6a48dcca` reopened — Timeline pulse yalnız terminal son noktada değil, turuncu current yoksa
  son aktif yeşil/kırmızı noktada da yanıp söner.
- [x] `6a48e214` reopened — Yönetici tarafından oluşturulan birim içi aktif taleplerde timeline
  `Talebi Gerçekleştiren Birim Yöneticisinin Onay Tarihi / Onay Bekleyen` satırını gri gösterir;
  ardından `Durum / Yapılmakta` turuncu güncel step olarak kalır.

## STATUS: Round 184 complete — cards moved to Done.

## Round 185 (Doing — 2026-07-04, WhatsApp konuşma açılış scroll'u)
- [x] `6a478b47` reopened — `/whatsapp` sol listeden manuel konuşma seçilince eski `phone/at/messageId`
  deep-link parametreleri temizleniyor; böylece farklı numaraya tıklanınca detay penceresi önceki
  anchor/scroll konumunu takip etmiyor, yeni konuşma doğrudan son mesajda/en altta açılıyor.

## STATUS: Round 185 complete — card moved to Done.

## Round 186 (Doing — 2026-07-04, mobil ölçekleme ve login)
- [x] `6a46373e` reopened / #1205 — Mobil genel kontrol: Login mobil formunda yüzde padding ve logo
  yüksekliği küçültüldü; AppShell telefonlarda içerik alanını `overflow-hidden` ile kilitlemiyor ve
  `main` native dikey scroll yapıyor; `/whatsapp` split panel telefonda liste+detay alt alta akıyor.

## Round 187 (Doing — 2026-07-05, local diff check)
- [x] `6a49fcd3` / #1360 — Taleplerim düzenleme detayında Cadde/Sokak/Bulvar ve Açık Adres alanları
  uzun değerde alt satıra büyüyor; adres grid'i değeri kart dışına taşırmıyor.
- [x] `6a49fbe2` / #1359 — Taleplerim düzenleme detayında Cadde/Sokak/Bulvar input'u textarea'ya
  çevrildi; Açık Adres ile aynı satır-büyüme davranışını kullanıyor.
- [x] `6a492c3d` / #1356 — Taleplerim ana kartında ayrı "Talep Başlığı" veri satırı kaldırıldı;
  talep başlığı doğrudan bölüm başlığında görünüyor.
- [x] `6a48cf6c` / #1338 — Reporter dashboard drilldown popup genişletildi ve ortak pagination eklendi.
- [x] `6a478fe8` / #1295 — Kurum içi WhatsApp iletileri de FAB bildirimi üretir; aktif konuşmada
  otomatik okundu işaretleme iç ileti için atlanır.
- [x] `6a48d31c` / #1341 — WhatsApp konuşmasında "Kurum İçi Mesaj" başlığı standart turuncu renge alındı.
- [x] `6a48ce9e` / #1337 — Standart kullanıcı dashboard grafiğinde "Benim Görevlerim" label'ına
  "(iptal olmayan)" eklendi; "Birimdeki Görevler" legend/dilimi tıklanabilir görünmez.
- [x] `6a48e214` / #1345 — Yönetici birim dışı talep timeline'ında `Durum / Yapılmakta` Talep Tarihi'nden
  hemen sonra gelir; hedef onay adımı onay öncesi gri, onay sonrası yeşil kalır.
- [x] `6a49efb3` / #1357 — Yönetici birim içi talep timeline'ında "Talebi Gerçekleştiren Birim
  Yöneticisinin Onay Tarihi" adımı gösterilmez.
- [x] `6a49f603` / #1358 — Doing snapshot'ta var, ancak Round 187 local diff içinde bu mobil/login kartına
  denk yeni kod değişikliği bulunamadı; Round 188'de ele alındı.

## STATUS: Round 187 — 9 kart eşleşti; #1358 açık kaldı.

## Round 188 (Doing — 2026-07-05, mobil düzeltme + Talep Bilgileri ağırlığı)
- [x] `6a4a08a6` / #1361 — Taleplerim detay popup `Talep Bilgileri` değer text'lerinin boldluğu
  azaltıldı (`font-weight: 500`).
- [x] `6a49f603` / #1358 — Mobilde içerik shell'i dikey scroll'u kesmiyor; çip/banner filtreleri
  telefonlarda daha büyük ve sarılabilir; detay modal alanları tek kolona akıyor; mobil login logo
  kutusu alçaltılıp logo görseli büyütüldü.

## STATUS: Round 188 complete — build/lint passed; cards moved to Done.

## Round 189 (Doing — 2026-07-05, reopen title meta + timeline order)
- [x] `6a492c3d` reopened / #1356 — Taleplerim detay başlığında Talep No + Birim İçi/Dışı rozeti
  sağa yaslı meta blok oldu; sığmazsa sağa yaslı alt satıra sarar.
- [x] `6a48e214` reopened / #1345 — Yönetici birim dışı talebinde hedef yönetici onayladıysa timeline
  sırası `Talebi Gerçekleştiren Birim Yöneticisinin Onay Tarihi` ardından `Durum / Yapılmakta` olur.

## STATUS: Round 189 complete — build/lint passed; cards moved to Done.

## Round 190 (Doing — 2026-07-05, Reporter drilldown popup polish)
- [x] `6a48cf6c` reopened / #1338 — Reporter dashboard pie drilldown popup Taleplerim detay modalı
  genişliğine alındı, grid text size küçültüldü ve Son Tarih öncesine terminal tarih kolonu eklendi:
  tamamlananlarda `Tamamlanma Tarihi`, iptal/iade satırlarında `İptal Tarihi`.

## STATUS: Round 190 complete — build/lint passed; card moved to Done.

## Round 191 (Doing — 2026-07-05, adres limitleri + Taleplerim başlık hizası)
- [x] `6a4a0eb0` / #1362 — Cadde / Sokak / Bulvar girişleri 50 karakter, Açık Adres girişleri
  100 karakter ile sınırlandı; talep oluşturma, rutin görev, vatandaş talebi, WhatsApp profil ve
  Taleplerim adres düzenleme UI'ları aynı frontend sabitlerini kullanıyor. Backend create/update job,
  rutin görev create/update ve WhatsApp profil komutları aynı 50/100 validasyonunu uyguluyor.
- [x] `6a492c3d` reopened / #1356 — Taleplerim detay ana kartında başlık yanındaki Talep No +
  Birim İçi/Dışı bloğu grid'in sağ kolonu olarak en sağa yaslandı; başlık sığmadığında meta bloğu
  yine sağ hizasını koruyor.

## STATUS: Round 191 complete — build/lint passed; cards moved to Done.

## Round 192 (Doing — 2026-07-05, Taleplerim timeline geçişleri)
- [x] `6a4a1038` / #1364 — Taleplerim süreç timeline'ında yeşil→kırmızı çizgi geçişi daha belirgin
  yapıldı; ara turuncu stop kaldırıldı, geçiş yalnız yeşil ve kırmızı arasında kaldı.
- [x] `6a4a0fba` / #1363 — Turuncu→gri çizgi geçişi koyu turuncudan başlayıp griye daha belirgin
  açılacak şekilde güncellendi.

## STATUS: Round 192 complete — frontend build/lint passed; cards moved to Done.

## Round 193 (Doing — 2026-07-05, reopen başlık hizası + reporter drilldown)
- [x] `6a492c3d` reopened / #1356 — Taleplerim detay ana kartında talep no ve Birim İçi/Dışı
  verisi sağ hizalı iki satırlı meta bloğa çevrildi; talep no üstte, rozet altında kalıyor.
- [x] `6a48cf6c` reopened / #1338 — Reporter pie chart drilldown popup başlığı yeşil ve Info
  ikonlu oldu; grid başlık fontu daha da küçültüldü, terminal tarih başlığındaki
  `Tamamlanma / İptal Tarihi` fallback'i kaldırıldı.

## STATUS: Round 193 complete — frontend build/lint passed; cards moved to Done.

## Round 194 (Doing — 2026-07-05, mobil banner çip yerleşimi)
- [x] `6a49f603` reopened / #1358 — Telefon breakpoint'inde banner altı çipler iki eşit kolonlu
  grid'e alındı; her satırda en az iki buton sığacak şekilde padding/font küçültüldü. Mobilde
  ayırıcılar gizleniyor, banner arama/tarih filtreleri iki kolon içinde taşmadan ölçekleniyor.

## STATUS: Round 194 complete — frontend build/lint passed; card moved to Done.

## Round 195 (Doing — 2026-07-05, Taleplerim popup boyutu)
- [x] `6a4a15b0` / #1365 — Taleplerim detay popup desktop ölçüsü referans görsele yaklaştırıldı:
  genişlik `min(72vw, 86.5rem)`, yükseklik `min(81dvh, 47rem)` oldu.

## STATUS: Round 195 complete — frontend build/lint passed; card moved to Done.

## Round 196 (Doing — 2026-07-05, Talep Bilgileri ayraç boyutu)
- [x] `6a4a1626` / #1366 — Taleplerim detay popup `Talep Bilgileri` altındaki
  `Öncelik / Proje Niteliğinde mi?` değer ayracı, süreç timeline tarih-saat ayracıyla aynı
  `.job-process-timeline__datetime-bullet` bileşenini kullanacak şekilde değiştirildi.

## STATUS: Round 196 complete — frontend build/lint passed; card moved to Done.

## Round 197 (Doing — 2026-07-05, Taleplerim başlık meta border hizası)
- [x] `6a492c3d` reopened / #1356 — Taleplerim detay ana kartında başlık satırı tam kart
  genişliğine yayıldı; Talep No + Birim İçi/Dışı meta bloğu başlık metnine değil, sol kartın
  sağ border çizgisine göre en sağa yaslanıyor.

## STATUS: Round 197 complete — frontend build/lint passed; card moved to Done.

## Round 198 (Doing — 2026-07-05, reporter drilldown header size)
- [x] `6a48cf6c` reopened / #1338 — Reporter pie chart drilldown tablo başlık fontu,
  genel `.data-table thead th` kuralından sonra daha yüksek specificity ile `0.8rem` olarak
  override edildi; portal/zoom farkı nedeniyle büyük görünen headerlar Taleplerim gridview
  görsel ölçeğine yaklaştırıldı.

## STATUS: Round 198 complete — frontend build/lint passed; card moved to Done.

## Round 199 (Doing — 2026-07-05, Taleplerim başlık edit konumu)
- [x] `6a492c27` / #1355 — Taleplerim detay düzenleme modunda `Talep Başlığı`, `Talep Bilgileri`
  altında ayrı satır olarak görünmüyor; textarea başlığın görüntülendiği sol kart başlık satırında
  açılıyor.

## STATUS: Round 199 complete — frontend build/lint passed; card moved to Done.

## Round 200 (Doing — 2026-07-05, Taleplerim popup boyutu ince ayar)
- [x] `6a4a15b0` reopened / #1365 — Referans görsel piksel oranına göre Taleplerim detay modalı
  `72.05vw / 86.45rem` genişlik ve `80.7dvh / 46.85rem` yükseklik değerlerine çekildi;
  `max-height` da aynı değere sabitlendi.

## STATUS: Round 200 complete — frontend build/lint passed; card moved to Done.

## Round 201 (Doing — 2026-07-05, Departman Adı metni)
- [x] `6a4a1882` / #1367 — Locale'deki `departments.name` metni `Departman Adı` yerine
  `Birim Adı`, placeholder da `Birim adı girin` oldu; İngilizce karşılık `Unit Name` olarak güncellendi.

## STATUS: Round 201 complete — frontend build/lint passed; card moved to Done.

## Round 202 (Doing — 2026-07-05, reporter pie drilldown tablo değerleri)
- [x] `6a4a18ec` / #1368 — Üst düzey yönetici dashboard pie chart drilldown popup'ında
  Durum sütunu rozet/pill yerine düz metin oldu; terminal tarih kolonu terminal olmayan
  satırlarda tarih basmıyor; Son Tarih boşsa `Belirsiz` yerine `Onay Bekleyen` gösteriliyor.

## STATUS: Round 202 complete — frontend build/lint passed; card moved to Done.

## Round 203 (Doing — 2026-07-05, mobil banner filtreleri ve grid kompaktlığı)
- [x] `6a49f603` reopened / #1358 — Mobilde banner filtre grubu içinde arama alanı tam satıra
  yayıldı; başlangıç/bitiş tarihleri aramanın alt satırında iki kolon olarak duruyor. Telefon
  breakpoint'inde tüm gridview tabloları daha düşük min-width, padding ve font ölçeğiyle kompaktlaştı.

## STATUS: Round 203 complete — frontend build/lint passed; card moved to Done.

## Round 204 (Doing — 2026-07-05, Taleplerim popup boyutu ve edit Talep No)
- [x] `6a4a15b0` reopened / #1365 — Taleplerim detay modalı referans görseldeki gibi sol menü
  bitişine yapışık görünmesin diye genişliği `70.9vw / 85.1rem` oranına çekildi; yükseklik korundu.
- [x] `6a4a1b11` / #1369 — Taleplerim detay düzenleme modunda `Talep No` / `Vatandaş Talep No`,
  `Talep Bilgileri` altında ayrı satır olarak görünmüyor; numara yalnız başlık yanındaki meta alanda kalıyor.

## STATUS: Round 204 complete — frontend build/lint passed; cards moved to Done.

## Round 205 (Doing — 2026-07-05, Talep Oluştur ve banner başlık ağırlığı)
- [x] `6a4a1c8e` / #1370 — Talep Oluştur tür seçim kartlarındaki `Birim İçi`,
  `Birim Dışı`, `Vatandaş Talepleri` başlıkları `font-extrabold` yerine `font-bold` oldu;
  bannerların 2. satırındaki `.page-title` ağırlığı sticky header içinde `600` seviyesine indirildi.

## STATUS: Round 205 complete — frontend build/lint passed; card moved to Done.

## Round 206 (Doing — 2026-07-05, reporter pie drilldown durum text rengi)
- [x] `6a4a18ec` reopened / #1368 — Üst düzey yönetici pie chart drilldown popup'ında
  Durum sütunu rozet/pill olmadan düz text kalıyor; `Tamamlandı` yeşil, iptal/iade kırmızı,
  `Yapılmakta Olan` turuncu renkte gösteriliyor.

## STATUS: Round 206 complete — frontend build/lint passed; card moved to Done.

## Round 207 (Doing — 2026-07-05, reopen font/mobil/pie ince ayarlar)
- [x] `6a4a1c8e` reopened / #1370 — Talep Oluştur tür seçim başlıkları `font-medium` oldu;
  banner 2. satır `.page-title` ağırlığı `500` seviyesine indirildi.
- [x] `6a49f603` reopened / #1358 — Mobil login logo alanı yatayda genişletildi; banner
  tarih filtrelerinde başlangıç/bitiş tarihleri mobilde aynı iki kolonlu satırda kalacak invariant'a işlendi.
- [x] `6a4a18ec` reopened / #1368 — Pie chart drilldown popup'ta `Active` yani
  `Yapılmakta Olan` durum text'i de turuncu renge alındı.

## STATUS: Round 207 complete — frontend build/lint passed; cards moved to Done.

## Round 208 (Doing — 2026-07-05, yeni kartlar toplu görsel/davranış)
- [x] `6a4a1c8e` reopened / #1370 — Talep Oluştur tür seçim başlıkları `font-semibold`,
  sticky banner 2. satır başlığı `600` ağırlığına alındı.
- [x] `6a4a288d` / #1376 — Görevlerim detay popup sol üst başlığı, Taleplerim detay popup
  başlığıyla aynı font/renk/letter-spacing değerlerini kullanıyor.
- [x] `6a4a294f` / #1377 — Taleplerim detay popup `Talep Bilgileri` değerleri biraz daha
  küçük text size ile gösteriliyor.
- [x] `6a4a2989` / #1378 — Taleplerim detay popup genişliği çok az azaltıldı.
- [x] `6a4a26b2` / #1374 — Ekrana Yansıt sayfasına login sayfasındaki ortak footer eklendi.
- [x] `6a4a262c` / #1373 — Ekrana Yansıt otomatik yenile aralığı ortak custom dropdown'a taşındı
  ve seçilen aralıkla interval yeniden kuruluyor.
- [x] `6a48bbe2` / #1333 — Ekrana Yansıt grid başlık verisi daha düşük font ağırlığında;
  görev sahibi ve oluşturan alt satırı reporter font ağırlığıyla nötr renkte kalıyor.
- [x] `6a4a21ba` / #1372 — WhatsApp konuşma header'ında görevi oluşmuş ve atanan personeli
  olan vatandaş talepleri için `Talep Sayısı | Görev Sahibi: ...` gösteriliyor.
- [x] `6a4a2791` / #1375 — Üst Düzey Yönetici dashboard'una mahalle bazlı yapılmakta olan
  talepler pie chart'ı ve drilldown popup'ı eklendi.
- [x] `6a4a18ec` reopened / #1368 — Mahallelerde Tamamlanan Talepler drilldown satırlarında
  vatandaş talep numarası (VT) taşınarak Talep No boşluğu düzeltildi.
- [x] `6a4a2133` / #1371 — Birim içi, birim dışı ve vatandaş talebi oluşturma form başlıklarına
  uygun ikonlar eklendi.

## STATUS: Round 208 complete — dotnet build, frontend build/lint passed; cards pending Done move.

## Round 209 (Doing — 2026-07-05, Görevlerim/Taleplerim başlık yönü düzeltmesi)
- [x] `6a4a288d` reopened / #1376 — Önceki uygulama ters yöndeydi; Görevlerim detay popup
  sol üst başlığı eski stilinde kaldı, Taleplerim detay popup üst başlığı Görevlerim başlığının
  font boyutu/ağırlığı/harf aralığı/rengine eşitlendi.

## STATUS: Round 209 complete — frontend build/lint passed; card pending Done move.

## Round 210 (Doing — 2026-07-05, Wallboard footer ve reporter renk reopen)
- [x] `6a4a26b2` reopened / #1374 — Ekrana Yansıt footer'ı sayfa padding'i içinde yukarıda
  kalmayacak şekilde viewport'un en alt kenarına oturtuldu.
- [x] `6a48bbe2` reopened / #1333 — Ekrana Yansıt gridinde Başlık font ağırlığı bir seviye daha
  düşürüldü; Görevi Yapan font ağırlığı azaltıldı. Üst Düzey Yönetici oluşturan metni ve
  reporter talebindeki Görevi Yapan metni turuncu renge geri alındı.

## STATUS: Round 210 complete — frontend build/lint passed; cards pending Done move.

## Round 211 (Doing — 2026-07-05, mahalle pie popup rutin filtre)
- [x] `6a4a18ec` reopened / #1368 — Üst düzey yönetici dashboard'ındaki
  `Mahallelerde Tamamlanan Talepler` ve `Mahallelerde Yapılmakta Olan Talepler` grafiklerinde
  ve tıklanınca açılan drilldown popup satırlarında rutin görevler dışlandı.

## STATUS: Round 211 complete — dotnet build passed; card pending Done move.

## Round 212 (Doing — 2026-07-05, Wallboard footer/Taleplerim başlık/WhatsApp görev sahibi)
- [x] `6a4a26b2` reopened / #1374 — Ekrana Yansıt footer'ı viewport genişliğinde full-bleed
  çalışacak şekilde sayfa padding'inden bağımsızlaştırıldı.
- [x] `6a4a288d` reopened / #1376 — Taleplerim detay popup başlık text size'ı küçük bir seviye
  büyütüldü.
- [x] `6a4a327e` / #1379 — WhatsApp konuşma header'ındaki görev sahibi bilgisi, atanan personel
  adından sonra birim adını parantez içinde gösterecek şekilde formatlandı.

## STATUS: Round 212 complete — dotnet build, frontend build/lint passed; cards pending Done move.

## Round 213 (Doing — 2026-07-05, mobil banner/login ve Wallboard Kapat)
- [x] `6a49f603` reopened / #1358 — Mobilde login logo çerçevesi yatayda genişletildi,
  logo boyutu sabit bırakıldı; mobil banner filtrelerinde arama kutusu daraltıldı, başlangıç
  ve bitiş tarihi aynı satırda çizgisiz gösteriliyor.
- [x] `6a4a374d` / #1381 — Ekrana Yansıt bölümündeki `Çıkış` buton metni `Kapat` oldu.

## STATUS: Round 213 complete — frontend build/lint passed; cards pending Done move.

## Round 214 (Doing — 2026-07-05, WhatsApp liste görev sahibi kaldırma)
- [x] `6a4a330d` / #1380 — WhatsApp konuşma listesi kartındaki `GG Ad Soyad` görev sahibi
  avatar/metni kaldırıldı; görev sahibi bilgisi yalnız detay header'ındaki taşınmış alanda kalıyor.

## STATUS: Round 214 complete — frontend build/lint passed; card pending Done move.

## Round 215 (Doing — 2026-07-05, mobil popup genişlik ve başlık aksiyonları)
- [x] `6a4a384e` / #1382 — Mobil üst düzey yönetici dashboard pie chart drilldown popup'ında
  paging bar gridview ile aynı yatay scroll genişliğine bağlandı.
- [x] `6a4a38ec` / #1383 — Mobil talep/görev detay popup header'ında başlık ve sağ üst aksiyon
  butonları çakışmayacak şekilde kompakt/wrap edebilir hale getirildi.

## STATUS: Round 215 complete — frontend build/lint passed; cards pending Done move.

## Round 216 (Doing — 2026-07-05, WhatsApp çoklu görev sahibi ve Wallboard tipografi)
- [x] `6a4a21ba` / #1372 — WhatsApp konuşma detay header'ında birden fazla talebin görevi
  atanmışsa görev sahipleri virgülle ayrılmış tek listede gösteriliyor.
- [x] `6a48bbe2` / #1333 — Ekrana Yansıt gridinde başlık font ağırlığı düşürüldü; Görevi yapan
  verisi Görevin Talep Yeri tonuyla eşitlendi ve Üst Düzey Yönetici taleplerinde turuncu kalıyor.

## STATUS: Round 216 complete — frontend build/lint passed; cards pending Done move.

## Round 217 (Doing — 2026-07-05, bildirimler, ek süre, banner ve wallboard)
- [x] `6a4a628d` / #1390 — Banner search textbox boyutu büyümeden input metni daha iri/bold yapıldı.
- [x] `6a4a493d` / #1387 — `Yapılmakta` status chip'i turuncu/beyaz stile, bugün dolan Son Tarih
  pill'i Wallboard sarı çerçeve/yazı diline alındı.
- [x] `6a4a54b4` / #1389 — Ekrana Yansıt `Birim Dışı` kutusunun alt border/accent rengi Başkanlık
  turuncusuna çekildi.
- [x] `6a4a48aa` / #1386 — Ek süre talebi bildiriminde kalıcı Notification + audit kaynaklı mükerrer
  kayıt üretimi engellendi; push gerçek zamanlı kaldı.
- [x] `6a4a21ba` / #1372 — WhatsApp detay header görev sahipleri yalnız Yapılmakta taleplerden
  toplanıyor; tamamlanmış/iptal taleplerin personel adları düşüyor.
- [x] `6a4a64fd` / #1393 — Bildirim modalındaki metin `Tümünü okundu yap` diline taşındı.
- [x] `6a4a63b5` / #1392 — Bildirim modalında `Tümünü / Okundu yap` butonu X'in soluna eklendi
  ve tüm bildirimleri okundu yapıyor.
- [x] `6a4a6387` / #1391 — Bildirim başlıklarındaki `güncellendi`, `oluşturuldu`, `atandı`,
  `Yönetici notu atandı` aksiyon kelimeleri bold gösteriliyor.
- [x] `6a4a4bd3` / #1388 — Terminal talep/görevlerde ek süre işaretleri Son Tarih yerine
  Tamamlanma/İptal tarihi veya Tümü görünümünde durum hücresi altında gösteriliyor.
- [x] `6a4a4885` / #1385 — Yönetici talep gridlerinde ek süre işaretleri kullanıcı gridleriyle
  aynı şekilde Son Tarih altında gösteriliyor.

## STATUS: Round 217 complete — backend build and frontend build/lint passed; cards pending Done move.

## Round 218 (Doing — 2026-07-05, Wallboard başlık ağırlığı ve reporter görev sahibi)
- [x] `6a48bbe2` / #1333 reopen — Ekrana Yansıt gridinde Başlık verileri normal font ağırlığına
  düşürüldü; Üst Düzey Yönetici talebindeki Görev Sahibi adı turuncu kuralı genel renge ezilmeyecek
  şekilde güçlendirildi.

## STATUS: Round 218 complete — frontend build/lint passed; card pending Done move.

## Round 219 (Doing — 2026-07-05, reopen ince ayarları)
- [x] `6a4a4bd3` / #1388 reopen — Ek süre isteği/onay/red sonrası görev grid satırındaki marker
  alanları liste yenilemesini beklemeden optimistik güncelleniyor.
- [x] `6a48bbe2` / #1333 reopen — Ekrana Yansıt Başlık text size biraz daha azaltıldı; reporter
  görev sahibi/talep no turuncusu korunuyor.
- [x] `6a4a63b5` / #1392 reopen — `Tümünü / Okundu yap` butonu küçük bildirim dropdown'unda X'in
  soluna, yeşil metinle taşındı; tüm bildirim modalındaki kopyası kaldırıldı.
- [x] `6a4a6387` / #1391 reopen — Bildirim başlığındaki `Ek süre talebi` ifadesi bold vurgulanıyor.
- [x] `6a4a7372` / #1394 — Bildirimden açılan görev/talep detay popup'ında ek süre marker'ı
  grid detaylarıyla aynı şekilde görünür oldu.
- [x] `6a4a54b4` / #1389 reopen — Ekrana Yansıt `Birim Dışı` kutusunun alt accent çizgisi çok koyu
  turuncuya çekildi.

## STATUS: Round 219 complete — backend build and frontend build/lint passed; cards pending Done move.

## Round 220 (Doing — 2026-07-05, banner arama ve Son Tarih uyarı ince ayarı)
- [x] `6a4a628d` / #1390 reopen — Banner/search textbox input metinleri 700-bold yerine
  yarı-kalın (`font-weight: 600`) seviyeye indirildi; iri okunurluk korunurken aşırı bold görünüm azaltıldı.
- [x] `6a4a493d` / #1387 reopen — Bugün dolan gridview `Son Tarih` pill'i dolgulu arka plan
  etkisinden çıkarılıp Wallboard uyarı diliyle uyumlu sarı çerçeve + amber metin stilinde sabitlendi.

## STATUS: Round 220 complete — frontend build/lint passed; cards pending Done move.

## Round 221 (Doing — 2026-07-05, ek süre talebi bildirim kapsamı)
- [x] `6a4a48aa` / #1386 reopen — Ek süre talebi bildirimi kalıcı `Notification` yazmadan
  tek audit-feed satırı olarak kalıyor; talebin onaycısı görevin atanmış/owner/oluşturan kullanıcısı
  olmasa bile `TaskRevision` approval üzerinden bildirim listesi ve okunmamış rozet kapsamına alındı
  (`T-2026-363` benzeri kaçan bildirimler için).

## STATUS: Round 221 complete — backend build passed; card pending Done move.

## Round 222 (Doing — 2026-07-05, detay Son Tarih ek süre marker'ı)
- [x] `6a4a77b6` / #1395 — Yönetici detay görünümünde görev `Son Tarih` değerinin yanında
  ek süre bileşenleri görünür oldu: `GridExtraTimeMarkers` inline kullanım destekliyor, TasksPage görev
  detayı ve JobsPage talep içindeki görev detayında bekleyen/onay/red marker'ları aynı ortak bileşenle basılıyor.

## STATUS: Round 222 complete — frontend build/lint passed; card pending Done move.

## Round 223 (Doing — 2026-07-05, mobil login ve banner filtre yerleşimi)
- [x] `6a49f603` / #1358 reopen — Mobil login logo paneli yatayda biraz daha genişletildi
  (`calc(100% + 1rem)` + negatif yatay margin); logo görsel boyutu sabit kaldı. Mobil banner
  filtrelerinde arama tam satıra alındı, başlangıç/bitiş tarihi aramanın altında iki eşit kolon
  halinde yan yana kaldı; tire/ayraç mobilde gizli.

## STATUS: Round 223 complete — frontend build/lint passed; card pending Done move.

## Round 224 (Doing — 2026-07-05, dashboard drilldown grid başlık ölçüsü)
- [x] `6a4a79b6` / #1396 — Üst Düzey Yönetici dashboard pie chart drilldown popup'ındaki
  gridview başlıkları portal içinde de Taleplerim grid başlık font/ölçeğiyle hizalandı; başlık satırı
  pagination bar yüksekliğiyle aynı chrome değişkenlerini kullanıyor.

## STATUS: Round 224 complete — frontend build/lint passed; card pending Done move.

## Round 225 (Doing — 2026-07-05, Wallboard overdue stat accent)
- [x] `6a4a54b4` / #1389 reopen — Ekrana Yansıt'ta yalnız `Son Tarihi Geçmiş` kutusunun
  alt border/accent çizgisi `Kapat` butonunun `var(--color-destructive)` kırmızısıyla eşitlendi;
  diğer stat kutularının accent renkleri korunuyor.

## STATUS: Round 225 complete — frontend build/lint passed; card pending Done move.

## Round 226 (Doing — 2026-07-05, mobil/header/font/wallboard/bildirim/Son Tarih reopen seti)
- [x] `6a4a38ec` / #1383 reopen — Mobil talep/görev detay header'larında tüm `Yazdır`
  butonları `.detail-print-action` ile telefon breakpoint'inde gizlendi; desktop print korunuyor.
- [x] `6a4a54b4` / #1389 reopen — Ekrana Yansıt `Birim Dışı` stat alt accent çizgisi çok koyu
  kahveden daha açık turuncuya (`#c2410c`) çekildi; `Son Tarihi Geçmiş` kırmızı kuralı korundu.
- [x] `6a4a7ddd` / #1399 — Kullanılmayan `source-serif-4` importları kaldırıldı; metinler yeniden
  Plus Jakarta Sans ailesinde kalıyor.
- [x] `6a4a7c9f` / #1398 — Mobil login logo paneli yatayda biraz daha genişletildi; logo görsel boyutu
  sabit bırakıldı, beyaz alanda yatay nefes payı artırıldı.
- [x] `6a4a7b5b` / #1397 — `Tüm bildirimleri gör` modal toolbar'ına `Tümünü okundu yap` aksiyonu
  geri eklendi.
- [x] `6a4a493d` / #1387 reopen — Bugün dolan `Son Tarih` pill'i sarı arka plan + sarı takvim ikonu
  + sarı çerçeve diline alındı.
- [x] `6a49f603` / #1358 reopen — Mobil banner arama ve başlangıç/bitiş tarihi filtre grubu sola
  hizalı kaldı.

## STATUS: Round 226 complete — frontend build/lint passed; cards pending Done move.

## Round 227 (Doing — 2026-07-05, bildirim butonu ve banner search font)
- [x] `6a4a7e1d` / #1400 — Bildirim dropdown `Tümünü / Okundu yap` aksiyonu çerçeveli buton
  görünümüne alındı; iki satır metin arasına küçük boşluk eklendi.
- [x] `6a4a628d` / #1390 reopen — Banner/search textbox input font family explicit `var(--font-sans)`
  yapıldı; gridview `Başlık` sütunu metniyle aynı ailede kalıyor.

## STATUS: Round 227 complete — frontend build/lint passed; cards pending Done move.

## Round 228 (Doing — 2026-07-06, Görevlerim ilgili talep detay tasarımı)
- [x] manual — Görevlerim detay popup'ındaki `İlgili Talep Detayları`, Taleplerim detayındaki
  3 kolon ana kart + alt kartlar düzenine taşındı; yönlendirilmiş talep rozeti ve sebep satırı korundu.

## STATUS: Round 228 complete — frontend build/lint passed; direct screenshot request, no Trello card to move.

## Round 229 (Doing — 2026-07-06, vatandaş/WhatsApp/ayarlar yeni kartları)
- [x] `6a4bb7b5` / #1435 — Vatandaş Talepleri kanal chip'lerinden Instagram, Facebook, X, E-posta,
  Web Formu kaldırıldı; WhatsApp/Çağrı/e-Devlet/Tümü kaldı.
- [x] `6a4bba6a` / #1437 — Vatandaş Talepleri `Detaylar` butonu pasif görünmez; linked talep yoksa
  vatandaş talebi oluşturma akışına yönlendirir.
- [x] `6a4bb3c6` / #1433 — Ayarlar > Taslak Mesajlar, WhatsApp Meta onaylı şablon mesaj düzenine
  sadeleştirildi; en fazla 3 şablon, tür/otomatik cevap/anahtar kelime/zamanlı yanıt alanları gizli.
- [x] `6a4bb6a9` / #1434 — Manuel Vatandaş Çağrı Talebi `Phone` kanalıyla oluşur; Vatandaş Talepleri
  Çağrı filtresinde VT numarası ve kanal ikonu ile görünür.
- [x] `6a4ba8fb` / #1432 — Talep Oluştur manuel vatandaş metinleri `Vatandaş Çağrı Talebi` olarak
  güncellendi; kanal seçimi yalnız Çağrı kaldı.
- [x] `6a4ba6f2` / #1431 — WhatsApp 24 saat penceresi kapalıyken operatör gönderiminde tek `Çıkış`
  butonlu `Onaylı Şablon Mesajı` popup'ı gösterilir.
- [x] `6a4b9968` / #1430 — WhatsApp konuşma listesi altına Taleplerim gridindeki ortak
  `TablePagination` paging barı eklendi.
- [x] `6a4b982a` / #1428 — WhatsApp/Vatandaş Talepleri grid başlıkları tek satır kaldı; Gittiği Yer
  altında atanmış personel adı gösteriliyor.
- [x] `6a4b96b4` / #1427 — Bildirim başlığı altındaki mesaj metninde kırmızı/yeşil durum renkleri kaldırıldı.
- [x] `6a4b902c` / #1426 — Desktop banner tarih aralığında başlangıç/bitiş arasında `-` ayırıcısı geri geldi;
  mobil/tablette gizli kalıyor.
- [x] `6a4b8894` / #1424 — Dashboard drilldown popup İşlemler/Detaylar aksiyonu mevcut tasarımla korunuyor.
- [x] `6a4b86dc` / #1422 — WhatsApp konuşma sayaçları ve detay header `Talep Sayısı`, Vatandaş Talepleri
  gridine ilgili kanal/durum/telefon filtresiyle yönlendirir.
- [x] `6a4bb805` / #1436 — Ayarlar > Sosyal Medya bölümüne Web Formu kartı eklendi.

## STATUS: Round 229 complete — frontend build/lint passed; cards pending Done move.

## Round 230 (Doing — 2026-07-06, WhatsApp konuşma listesi paging reopen)
- [x] `6a4b9968` / #1430 reopen — Basit toplam kayıt footer'ı kaldırılıp sol Konuşmalar panelinin
  altına Taleplerim gridview ile aynı `TablePagination` bağlandı; liste gerçek sayfalama kullanıyor.

## STATUS: Round 230 complete — frontend build/lint passed; card pending Done move.

## Round 231 (Doing — 2026-07-06, bildirim alt metin ve banner tire reopen)
- [x] `6a4b96b4` / #1427 reopen — Bildirim dropdown/modal başlık altı mesaj satırı düz metne
  çevrildi; kırmızı/yeşil renk ve bold vurgular kaldırıldı.
- [x] `6a4b902c` / #1426 reopen — Desktop banner başlangıç/bitiş tarihi arasındaki `-` ayırıcısı,
  iki tarih input'unun tam ortasına hizalandı; mobil/tablette gizli kalıyor.

## STATUS: Round 231 complete — frontend build/lint passed; cards pending Done move.

## Round 232 (Doing — 2026-07-06, dashboard drilldown Detaylar butonu reopen)
- [x] `6a4b8894` / #1424 reopen — Dashboard pie drilldown popup gridindeki `İşlemler > Detaylar`
  butonu Taleplerim grid aksiyon tasarımındaki `Button size="sm" variant="secondary"` ve
  `actions-cell/request-actions` yapısına alındı.

## STATUS: Round 232 complete — frontend build/lint passed; card pending Done move.

## Round 233 (Doing — 2026-07-06, WhatsApp konuşma kartı durum sayaçları reopen)
- [x] `6a4b86dc` / #1422 reopen — Sol WhatsApp konuşma kartlarındaki `İşleme Alınan`,
  `Yapılmakta`, `Tamamlandı`, `İptal` kırılımları hover'lı butona çevrildi; tıklanınca
  Vatandaş Talepleri gridine ilgili `requestStatus` filtresiyle gider.

## STATUS: Round 233 complete — frontend build/lint passed; card pending Done move.

## Round 234 (Doing — 2026-07-06, Taslak Mesajlar eski form restore)
- [x] `6a4bb3c6` / #1433 — Ayarlar > Taslak Mesajlar formu Meta-onaylı sade tasarımdan
  eski şablon formuna döndürüldü; `Yeni Şablon Oluştur`, `Şablon Türü`, `Otomatik Cevap`,
  `Anahtar Kelime`, `Zamanlı Yanıt` ve zaman planı kontrolleri geri geldi.

## STATUS: Round 234 complete — frontend build/lint passed; card pending Done move.

## Round 235 (Doing — 2026-07-06, Vatandaş Çağrı Talebi submit metni)
- [x] `6a4bc850` / #1438 — Vatandaş Çağrı Talebi oluşturma formunda alt submit butonu
  ve onay popup confirm metni `Talep Oluştur` olarak güncellendi.

## STATUS: Round 235 complete — frontend build/lint passed; card pending Done move.

## Round 236 (Doing — 2026-07-06, Vatandaş Çağrı Talebi kanal butonu)
- [x] `6a4ba8fb` / #1432 — Vatandaş Çağrı Talebi formunda `Talep Kanalı > Çağrı`
  seçimi tek satırı dolduran yatay buton görünümüne alındı.

## STATUS: Round 236 complete — frontend build/lint passed; card pending Done move.

## Round 237 (Doing — 2026-07-07, detay popup ve yeni kartlar)
- [x] `6a4bf94d` / #1448 — Detay popup sağ üst aksiyon butonları bir kademe büyütüldü;
  kapatma butonu da daha büyük yuvarlak butona alındı.
- [x] `6a4bf0c7` / #1443 — Görev Detayları `Durum Değişikliği` özeti saniyesiz, ortalı tarihli,
  normal ağırlıklı ve durum rengine göre renklendirilen metne çevrildi.
- [x] `6a4bb3c6` / #1433 reopen — Taslak Mesajlar aksiyon metni beyaz `+` ile
  `Yeni Meta Onaylı Şablon Oluştur` yapıldı; 3-şablon sınırı uygulanmıyor.
- [x] `6a4bcef4` / #1440 — WhatsApp konuşma kartında isim varsa telefon numarası adın altına,
  yanıt durumu satırıyla aynı hizaya taşındı.
- [x] `6a4bf3b3` / #1444 — Görevlerim detay popup ilgili talep özetinde `Talep Bilgileri`
  üst ana karta taşındı; talep açıklaması bu alandan kaldırıldı.
- [x] `6a4c012e` / #1451 — Vatandaş Çağrı Talebi form başlığı ikonu seçim kartındaki mavi
  telefon ikonuyla eşleştirildi.

## STATUS: Round 237 complete — frontend build/lint passed; cards pending Done move.

## Round 238 (Doing — 2026-07-07, dashboard kanal grafiği ve wallboard yeni kartları)
- [x] `6a4a26b2` / #1374 — Ekrana Yansıt footer'ı sayfa padding'ini aşan tam satır/full-bleed
  genişliğe ve flex footer olarak viewport en altına alındı.
- [x] `6a48bbe2` / #1333 — Ekrana Yansıt Başlık hücre yazısı küçültüldü; Üst Düzey Yönetici
  talebindeki Görev Sahibi turuncu override'ı genel owner rengini ezecek şekilde güçlendirildi.
- [x] `6a4a628d` / #1390 reopen — Banner ve bildirim search input yazı ağırlığı yarı-kalın
  `600`, `letter-spacing:0` ve kontrollü line-height ile grid Başlık font ailesinde sabitlendi.
- [x] `6a4a47b1` / #1384 — Birime Gelen Talepler > Tamamlanmış Talepler gridinde yalnız
  `Tamamlanma Tarihi` başlığına küçük sol boşluk eklendi.
- [x] `6a4b7f35` / #1421 — Kontrol paneli Vatandaş Talep Kanalları grafiği Reporter/SystemAdmin
  için tenant genelinde, Manager için scoped birimde VT numaralı talepleri kanalına göre sayacak
  şekilde `RequestType` dar filtresinden çıkarıldı.
- [x] `6a4bebbb` / #1442 — Yazdır popup'ı CSP ile ağ erişimine kapatıldı ve opener bağlantısı
  kesildi; print dokümanı app/API/local network kaynaklarına istek atamaz.
- [x] `6a4b8814` / #1423 — Birim yöneticisi Vatandaş Talep Kanalları grafiği, kendi birimine
  gelen VT numaralı sosyal/e-Devlet/vatandaş kaynaklı talepleri kanal sayımı içine alır.

## STATUS: Round 238 complete — backend build and frontend build/lint passed; cards pending Done move.

## Round 239 (Doing — 2026-07-07, yeni kartlar)
- [x] `gMRPRmkO` / `6a4b7f35` reopen — Dashboard Vatandaş Talep Kanalları grafiğinde
  SocialMessage kaynaklı ama sosyal mesaj kanalına bağlı olmayan VT kayıtları `Telefon/Çağrı`
  olarak sınıflandırıldı; `Sosyal Medya Mesajı` dilimi bu çağrı kayıtları için kullanılmıyor.
- [x] `BUh0gEYr` / `6a4bf0c7` reopen — Görev Detayları `Durum Değişikliği` özeti sağ border
  tarafına hizalı hale getirildi.
- [x] `NNt7S70j` / `6a4bb3c6` reopen — Ayarlar > Taslak Mesajlar `Sil` aksiyon metni daha
  büyük ve kalın yapıldı.
- [x] `gms8raES` / `6a4c936d` — WhatsApp Konuşmaları sağ vatandaş panelinin üst çizgisi üzerine
  `Talep Oluştur` butonu eklendi.
- [x] `9HIOVDBR` / `6a4c9b50` — WhatsApp konuşma kartlarındaki `İşleme Alınan / Yapılmakta /
  Tamamlandı / İptal` sayaç metinleri tıklanamaz salt metne çevrildi.
- [x] `jk4cPBUu` / `6a4c9cdd` — Vatandaş operatörü WhatsApp şablon seçicisinde aktif Meta
  onaylı şablonlar kullanıcı şablonlarının üstünde listeleniyor.
- [x] `5WKUDYfu` / `6a4c9d8a` — WhatsApp status-only webhook güncellemeleri açık konuşmayı
  yenileyecek `isStatusUpdate` SignalR payload'ı gönderiyor; çift tik sonrası teslim metni eski
  `Gönderildi` durumunda kalmıyor.
- [x] `Sb3SBh8o` / `6a4c931c` — WhatsApp sol panelde `Tümü` sayaç butonu, alt satırdaki `İptal`
  sayaç metniyle aynı satıra hizalandı.
- [x] `XLtxgHkW` / `6a4bf3b3` reopen — Görevlerim detay popup ilgili talep özetinde boş ikon
  satırı kaldırıldı; `Talep Bilgileri` başlığı üst satıra taşındı.
- [x] `TfwvHuHY` / `6a4bf94d` reopen — Detay popup sağ üst aksiyon butonları genel olarak bir
  kademe daha yüksek yapıldı.

## STATUS: Round 239 complete — backend build and frontend build/lint passed; cards moved to Done.

## Round 240 (Doing — 2026-07-07, yeni kartlar)
- [x] `LiZgmmie` / `6a4ca0d05602c970ac3b9688` / #1463 — Jobs/Tasks detay popup
  `Yazışmaya Git` butonlarına konuşma ikonu eklendi.
- [x] `OmHrm6tu` / `6a4ca031fdbe566c84a02480` / #1461 — Tasks detay popup
  `Görevi Yönlendir` butonuna yönlendirme ikonu eklendi.
- [x] `XXIk2pBf` / `6a4ca0abda4e10ea911edbb5` / #1462 — Detay popup
  `Yazışmaya Git` ile açılan konuşma paneli ilk yüklemede ve yeni entry geldiğinde son mesaja hizalanır.
- [x] `Ko0AM1fX` / `6a4bf6d8764098d76879a3c6` / #1447 — Görevlerim detay popup
  `Düzenle` butonu koyu turkuaz yapılarak `Tamamla` butonundan ayrıştırıldı.
- [x] `7dK5c7rP` / `6a4ca27a9a68cf290abaf89f` / #1464 — Otomatik vatandaş
  durum mesajları `Pending` entry üretirken WhatsApp konuşma listesi metadata/push güncellemesini de yapar.

## STATUS: Round 240 complete — backend build and frontend build/lint passed; cards moved to Done.

## Round 241 (Doing — 2026-07-07, yeni kartlar devam)
- [x] `XLtxgHkW` / `6a4bf3b3e208c82094de2c4d` reopen — Görevlerim detay popup
  `İlgili Talep Detayları > Talep Bilgileri` başlığının sağındaki talep no ve `Birim İçi/Birim Dışı`
  meta bloğu geri getirildi.
- [x] `3jl4WA0l` / `6a4ca38d7e336fa948d7cc3d` / #1465 — WhatsApp Konuşmaları sol panel
  üst sayaçlarında ve konuşma kartı alt sayaçlarında `İptal` kalemi gizlendi.

## STATUS: Round 241 complete — frontend build/lint passed; cards moved to Done.

## Round 242 (Doing — 2026-07-07, yeni kartlar devam)
- [x] `gms8raES` / `6a4c936dab5e7280fecca32a` reopen — WhatsApp Konuşmaları sağ profil
  panelindeki `Talep Oluştur` butonu satır ortasına hizalandı ve daha büyük `h-10` buton yapıldı.

## STATUS: Round 242 complete — frontend build/lint passed; cards moved to Done.

## Round 243 (Doing — 2026-07-07, yeni kartlar devam)
- [x] `P2q5ViXg` / `6a4ca619dcbf36c36efe1318` / #1466 — WhatsApp Konuşmaları footer
  `Talep oluştur` butonu kaldırıldı; `Dosya ekle`, `Şablon mesaj ekle` butonunun hemen sağına hizalandı.

## STATUS: Round 243 complete — frontend build/lint passed; cards moved to Done.
