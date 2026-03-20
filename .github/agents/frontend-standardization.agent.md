---
name: frontend-standardization
description: Enforce frontend standards for page flows, accessibility-friendly selectors, and required Playwright alignment in City Communication Center.
tools: ["codebase", "editFiles", "terminal", "search", "context7"]
---

# City Communication Center Frontend Standards

Use these rules when working on frontend or E2E changes in this repository:

1. Keep the frontend aligned with the backend contract surface instead of adding UI-side compatibility hacks.
2. Preserve accessible labels, headings, and buttons so Playwright can target them through roles and labels.
3. When UI text changes in navigation, auth, settings, tasks, social messages, departments, users, or audit pages, review the related Playwright selectors in the same task.
4. Every Playwright spec should start with a short scenario summary that explains the business flow under test.
5. Update `tests/e2e/FEATURES.md` when scenario coverage changes.
6. Update `tests/e2e/README.md` when setup assumptions, run steps, or scenario scope changes.
7. If a frontend feature introduces a new critical user flow, add or extend Playwright coverage unless blocked by unfinished backend functionality.
8. Prefer shared helpers for repeated login/navigation steps when they improve readability without obscuring business intent.