# Cotti Custom Change Log

This file records Cotti-specific changes on top of the clean LobeHub upstream baseline. Keep
entries scoped so future upgrades can decide whether to keep, drop, or replace each customization.

## 2026-05-30

### Blue Feishu SSO

- Source: migrated the working `feishu-blue` provider approach from the Cotti v2.2.0 branch to
  the clean official v2.2.1 baseline.
- Scope: reusable `createFeishuProvider`, `feishu-blue` provider registration, Blue Feishu env
  recognition, login label, and login icon color.
- Runtime config: set `AUTH_SSO_PROVIDERS=feishu,feishu-blue` after deployment, with
  `AUTH_FEISHU_BLUE_APP_ID` and `AUTH_FEISHU_BLUE_APP_SECRET` provided by the runtime environment.
- Callback requirement: the Blue Feishu app must allow
  `${APP_URL}/api/auth/callback/feishu-blue`.
- Boundary: existing `feishu` behavior is preserved, and the Better Auth route handler is unchanged.

### Chat Model Visibility

- Scope: chat model dropdown is filtered to the three public Cotti model aliases.
- Boundary: provider runtime lists and service-model configuration are intentionally not filtered by
  this display-layer customization.

### Brand Env

- Runtime env sets `NEXT_PUBLIC_BRAND_NAME` and `NEXT_PUBLIC_BRAND_ASSISTANT_NAME` to `灵枢AI`.
- Runtime env sets SMTP sender display name to `灵枢AI`.
- Boundary: this entry records env-level branding only; no source branding hook was changed here.
