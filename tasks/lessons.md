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
