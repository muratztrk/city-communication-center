# Lessons

## Portaling a modal out of the `zoom` context changes its scale
The app shell content area uses CSS `zoom` (~0.81 at common widths). Modals rendered
inside it are scaled down by that factor. When you `createPortal(..., document.body)` to
escape the zoom stacking context (needed so a modal overlays the body-portaled
notifications modal), the modal renders at scale **1.0** — so any fixed `dvh`/`rem`
dimensions become visibly larger (e.g. `h-[92dvh]` went from ~74.5dvh effective to a full
92dvh and looked too tall).

**Rule:** when portaling a previously-in-content modal to body, re-check its height/width.
Prefer `max-h-[80dvh]` (cap + size-to-content) over a forced `h-[92dvh]`. Fixed by lowering
the Jobs/Tasks detail (Detay) modals to `max-h-[80dvh]` after the #444 portal change.

## "It's not working" ≠ stale cache — verify the build at HEAD first
This repo gets **parallel commits** (the user / other sessions push between turns; the
reflog showed 9 commits landing on top of mine, summarized away). When the user re-reports
a card whose fix you think is already committed, don't assume stale PWA cache:
1. **Build the backend** (`dotnet build`). A parallel commit (`301cccf`) shipped
   `AttachmentsController.Download` using the `RequireTenantId()` extension without
   `using CityCommunicationCenter.Application;` → the whole backend failed to compile at
   HEAD, so it **hadn't deployed** and the download endpoint wasn't live. That was the real
   cause of #631, not cache.
2. **Check for a partially-applied prior fix** — earlier commits had closed half a card and
   left a real gap (#621: rows hidden but the only access point removed; #631: ↓ button
   added but the tile still opened inline).
The PWA *is* aggressively configured (`autoUpdate`+`skipWaiting`+`clientsClaim`), so genuine
cache staleness is rarer than "the deploy is broken or the fix is incomplete." Confirm with a
build + a quick code read before telling the user to hard-refresh.
