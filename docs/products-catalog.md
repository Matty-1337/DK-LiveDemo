# Products Catalog — How to Add a Product or Module

The `config/products.json` file is the single source of truth for every
demo the MCP `livedemo_generate_demo` tool can produce.

## Shape at a glance

```
{
  "defaults": { ctaUrl, ctaText, captureBaseUrl, hideSelectors, ... },
  "<productId>": {
    "name":     "Human-readable product name",
    "baseUrl":  "https://app.example.com",   // overrides defaults.captureBaseUrl
    "authFn":   "<key into browser/src/auth/registry.ts>",
    "tiers":    { "<tierId>": { price, priceDisplay } },
    "modules":  {
      "<moduleId>": {
        "name":            "Human-readable module name",
        "tier":            "<tierId> | all",
        "description":     "One sentence for UI surfacing",
        "estimatedDurationMinutes": N,
        "navigationPlan":  [ { path, waitFor, note, hideSelectors? } ],
        "narrative":       [ { screenIndex, popup: { title, body, cta?, alignment?, showOverlay? } } ]
      }
    }
  }
}
```

## Adding a new module to an existing product

1. Decide how many screens the demo needs (3–10 is the sweet spot; one
   popup per screen per Strategy C architecture).
2. Add an entry under `<productId>.modules.<moduleId>`.
3. Populate `navigationPlan` with one entry per screen:
   - `path` — relative to `baseUrl`. Supports query strings (e.g.
     `/dashboard?view=revenue`). Do **not** include the scheme or host —
     they come from `baseUrl`.
   - `waitFor` — either `"networkidle"` (safe default) or a CSS selector
     like `"[data-testid=dashboard-ready]"`. If the page has a known
     reliable ready-marker, use the selector; it's faster and more
     deterministic.
   - `note` — free-form, used for capture logs and debugging.
   - `hideSelectors` (optional) — per-screen overrides. Merged with
     `defaults.hideSelectors` (module-level wins on conflicts).
4. Populate `narrative` with up to `navigationPlan.length` popups. Each
   popup is attached to the screen at `screenIndex`. Missing narrative
   entries → the screen renders without a popup overlay.
5. Personalization tokens — any of these, anywhere in `title` or `body`
   or `cta.*`, are replaced at generation time:
   - `{{prospectName}}` — e.g. `"Johnny's Tavern"`
   - `{{prospectLocation}}` — e.g. `"Dallas, TX"`
   - `{{prospectContext}}` — free-form notes, e.g. `"Sports bar, 80 seats, weekend-heavy"`
6. If the module needs a lead-capture form on the final screen, set
   `narrative[last].popup.cta` with a `url` that points somewhere
   (Calendly, landing page) — the generator will also create a
   LiveDemo `Form` attached to that step when `cta.captureLead: true`.
   (Form-capture wiring is a v2 concern — for now, all CTAs are just
   outbound links.)

## Adding a new product

1. Provision a demo-bot account in the product's environment, scoped to
   a safe demo tenant. Never use a real customer account.
2. Add the following Infisical keys in project `dk-livedemo`, env `prod`:
   - `<PRODUCT>_LOGIN_URL` — full login URL
   - `<PRODUCT>_DEMO_BOT_EMAIL`
   - `<PRODUCT>_DEMO_BOT_PASSWORD`
   - `<PRODUCT>_DEMO_TENANT_ID` — if the product is multi-tenant
3. Implement `browser/src/auth/<product>.ts` — a Playwright function
   that takes a `BrowserContext` and logs in. Must:
   - Navigate to `LOGIN_URL`
   - Fill credentials from the Infisical cache
   - Wait for post-login redirect (selector or URL pattern)
   - Persist cookies in the context (Playwright does this automatically
     once navigation completes successfully)
   - Return the authenticated `Page` to the caller
   - Throw a typed `AuthError` with the reason if login fails
4. Register the auth function in `browser/src/auth/registry.ts`:
   ```ts
   export const authRegistry = {
     coretap: coretapAuth,
     atlastap: atlastapAuth,
     <product>: <product>Auth,  // ← add here
   };
   ```
5. Add the product block to `config/products.json` with `authFn`
   pointing at the registry key.
6. Write at least one module under `modules`. Run the browser
   smoke test against it. Eyeball the captured PNGs.
7. Run the MCP e2e test with the new product/module. Don't ship
   until that's green.

## Tiers

Tiers are metadata only — the generator does not filter or gate based on
tier. They exist for:

- UI labelling ("this is a Monitor-tier demo")
- Pricing mentions inside narrative copy (narrative should reference
  `$449/mo` etc. directly; the tiers block is for programmatic lookup if
  we ever want to render price cards)
- Future: tier-based template selection (e.g. `tier=monitor` → use
  monitor-specific narrative variant)

## What NOT to put in products.json

- Real credentials or tokens — ever
- Customer/prospect-specific data (only `{{prospect*}}` tokens)
- HTML/CSS for the popup renderer — the player handles that; narrative
  `body` is plain-ish HTML (`<p>`, `<strong>`, `<em>`) that the
  LiveDemo popup supports
- Navigation paths that require already-authenticated state NOT
  achievable by `authFn` — the auth function is responsible for leaving
  the browser in a fully-authed state before `navigationPlan` starts

## Catalog health

- **CoreTAP:** 6 modules, live.
- **AtlasTAP:** `status: "pending"`. No bot account, no auth. Revisit
  after CoreTAP end-to-end is green.

## Defaults

`defaults.ctaUrl` (`https://cal.com/matty-dk`) and `defaults.ctaText`
(`"Book a demo"`) apply to every narrative popup that doesn't specify
its own `cta`. To change the DK-wide default CTA, edit only the
`defaults` block — every module inherits automatically.

`defaults.hideSelectors` lists common UI chrome to suppress at capture
time: toasts, live clocks, Intercom, Hotjar, timestamps. Products with
product-specific chrome can add to this list at the product level
(not yet implemented — `defaults` is the only level today).
