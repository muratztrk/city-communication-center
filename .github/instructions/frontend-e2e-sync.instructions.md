---
description: "Use when changing frontend routes, labels, flows, forms, page actions, or API-driven UI in City Communication Center. Frontend changes must trigger E2E scenario review and, when needed, Playwright/spec/docs updates."
applyTo: "frontend/src/**,tests/e2e/**"
---

# Frontend And E2E Sync Rules

When you modify frontend code in this repository, treat Playwright coverage as part of the same change.

1. If a page heading, button label, field label, menu item, route, or primary workflow step changes, review the impacted files under `tests/e2e/specs/` and update them in the same task.
2. If a new frontend feature is user-facing, add or extend at least one E2E scenario unless the feature is explicitly behind unfinished backend work.
3. Prefer role-based and label-based selectors in Playwright. If markup changes break those selectors, fix the UI or test so accessibility-friendly selectors remain possible.
4. Keep a short scenario summary at the top of each Playwright spec so the intended business flow is visible without reading the whole test.
5. When changing social message, task, auth, settings, departments, users, or audit screens, update `tests/e2e/FEATURES.md` and `tests/e2e/README.md` if coverage or assumptions changed.
6. If a frontend change is intentionally not covered by E2E, state the reason in the final response.