# Trello "Doing" list — implementation tracking

Board: https://trello.com/b/4kvG8aa5 · List: Doing (`69ef9d96d58778f5f9f53ff7`)
Polling every ~5 min this session. Commit + push to main after each card.

## Done
- [x] `6a265aaf` — "Görev Tipi" column in Görevlerim grid (matched Personelimin Görevleri). Pushed.
- [x] `6a265b44` — Gittiği Yer destination pills uniform green (was tinted by approval status). Pushed. Moved to Done.
- [x] `6a265c3e` — Creator can cancel own job (CancelJobCommand isCreator) + cascade non-terminal tasks to Cancelled; İptal button in Taleplerim. Pushed. Moved to Done.
- [x] `6a265d9b` — Auto-approved create now assigns JobNumber (was "Onay Bekleyen" in approved list); İade hidden for manager's own InternalUnit in Taleplerim. Pushed. Moved to Done.
- [x] `6a265ea9` — Manager Birim Dışı number fix: SAME root cause as 6a265d9b, resolved by that commit (JobNumber assigned at creation for all !requiresOwnerApproval). No new code. Moved to Done.

## Pending (top → bottom)
- [ ] `6a266007` — Son Tarih button styling: yellow if last day, red if overdue (screenshot)
- [ ] `6a26624e` — Calendar icon before dates in all date gridviews (Ekrana Yansıt parity)
- [ ] `6a26631b` — Onay/Tamamlanma/İptal-İade Tarihi columns sortable+filterable
- [ ] `6a2665f4` — Multi-tab logout: session drop across tabs (screenshot)
- [ ] `6a26673e` — Taleplerim İşlem column: only İptal/İade for manager; standard user only "İptal"
- [ ] `6a2669a1` — Manager Dashboard: add "Birimden Giden Yapılmakta Olan Talepler" box (screenshot)
- [ ] `6a266a85` — Control panel pie charts 3-per-row (currently 2)
- [ ] `6a266b79` — Remove /jobs?scope=pending-approval page (duplicate of Birime Gelen Talepler default)
- [ ] `6a266bd3` — Rename "Birime Gelen Onay Bekleyenler" → "...Talepler"; link to default Birime Gelen page
- [ ] `6a2687a6` — 2-department user: Birim İçi/Dışı request not appearing in Taleplerim
- [ ] `6a26885e` — Manager-only Birim İçi: "Görev Sahibi Kişi/Birim" dropdown lists all dept staff incl. self
