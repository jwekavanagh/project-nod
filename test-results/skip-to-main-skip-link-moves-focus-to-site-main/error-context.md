# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: skip-to-main.spec.ts >> skip link moves focus to #site-main
- Location: test\website-holistic\skip-to-main.spec.ts:3:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('.skip-to-main')
    - locator resolved to <a href="#site-main" class="skip-to-main">Skip to main content</a>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - element is outside of the viewport
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - element is outside of the viewport
    - retrying click action
      - waiting 100ms
    56 × waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - element is outside of the viewport
     - retrying click action
       - waiting 500ms

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - link "Skip to main content" [ref=e2] [cursor=pointer]:
    - /url: "#site-main"
  - banner [ref=e3]:
    - generic [ref=e4]:
      - link "AgentSkeptic" [ref=e5] [cursor=pointer]:
        - /url: /
      - navigation "Primary" [ref=e6]:
        - link "Pricing" [ref=e7] [cursor=pointer]:
          - /url: /pricing
        - link "Security" [ref=e8] [cursor=pointer]:
          - /url: /security
        - link "Product brief (traces vs database)" [ref=e9] [cursor=pointer]:
          - /url: /database-truth-vs-traces
        - link "Integrate" [ref=e10] [cursor=pointer]:
          - /url: /integrate
        - link "Try" [ref=e11] [cursor=pointer]:
          - /url: /#try-it
        - link "Guides" [ref=e12] [cursor=pointer]:
          - /url: /guides
        - link "Examples" [ref=e13] [cursor=pointer]:
          - /url: /examples
        - link "CLI" [ref=e14] [cursor=pointer]:
          - /url: https://github.com/jwekavanagh/agentskeptic#try-it-about-one-minute
        - link "Sign in" [ref=e15] [cursor=pointer]:
          - /url: /auth/signin?callbackUrl=%2Faccount
  - main [ref=e17]:
    - region "Ship with database truth, not trace color." [ref=e18]:
      - generic [ref=e20]:
        - heading "Ship with database truth, not trace color." [level=1] [ref=e21]
        - paragraph [ref=e22]: When traces, logs, or success flags say your workflow succeeded but you still need read-only SQL proof that Postgres or SQLite rows match structured tool activity at verification time, use AgentSkeptic before you ship, bill, or close compliance. It fits teams who verify persisted state instead of trusting green dashboards alone.
        - paragraph [ref=e23]: AgentSkeptic answers with read-only SQL at verification time—not with trace success flags or chat narratives.
        - paragraph [ref=e24]:
          - link "View plans and quota" [ref=e25] [cursor=pointer]:
            - /url: /pricing
          - link "Run verification" [ref=e26] [cursor=pointer]:
            - /url: "#try-it"
          - link "Product brief (traces vs database)" [ref=e27] [cursor=pointer]:
            - /url: /database-truth-vs-traces
    - region "Proof and contracts (no signup)" [ref=e28]:
      - heading "Proof and contracts (no signup)" [level=2] [ref=e29]
      - list [ref=e30]:
        - listitem [ref=e31]:
          - link "OpenAPI (commercial v1)" [ref=e32] [cursor=pointer]:
            - /url: /openapi-commercial-v1.yaml
        - listitem [ref=e33]:
          - link "npm package" [ref=e34] [cursor=pointer]:
            - /url: https://www.npmjs.com/package/agentskeptic
        - listitem [ref=e35]:
          - link "Source repository" [ref=e36] [cursor=pointer]:
            - /url: https://github.com/jwekavanagh/agentskeptic
        - listitem [ref=e37]:
          - link "Product brief (canonical)" [ref=e38] [cursor=pointer]:
            - /url: /database-truth-vs-traces
        - listitem [ref=e39]:
          - link "First-run integration" [ref=e40] [cursor=pointer]:
            - /url: /integrate
    - region "How it works" [ref=e41]:
      - heading "How it works" [level=2] [ref=e42]
      - paragraph [ref=e43]: "A support tool reports “ticket closed” and the trace step is green. In the CRM database, the ticket row should be `status = resolved`. Verification compares that expectation to a real `SELECT`—not to the narrative."
      - generic [ref=e44]:
        - generic [ref=e45]:
          - heading "Before" [level=3] [ref=e46]
          - paragraph [ref=e47]: You only see trace or tool success; you assume the row was written correctly.
        - generic [ref=e48]:
          - heading "After" [level=3] [ref=e49]
          - paragraph [ref=e50]: "You get a verdict from observed SQL: aligned with expectations, missing row, or wrong values—still at verification time, not proof of who wrote what."
      - heading "Declared → Expected → Observed" [level=3] [ref=e51]
      - list [ref=e52]:
        - listitem [ref=e53]: "Declared — what captured tool activity encodes (`toolId`, parameters)."
        - listitem [ref=e54]: Expected — what should hold in SQL under your registry rules.
        - listitem [ref=e55]: Observed — what read-only queries returned at verification time.
      - paragraph [ref=e56]: This is not generic observability or log search. It compares expected database state to read-only query results at verification time.
      - paragraph [ref=e57]:
        - link "Security & Trust" [ref=e58] [cursor=pointer]:
          - /url: /security
        - text: — trust boundary and what verification does not guarantee.
    - region "Fit and limits" [ref=e59]:
      - heading "Fit and limits" [level=2] [ref=e60]
      - heading "For you" [level=3] [ref=e61]
      - list [ref=e62]:
        - listitem [ref=e63]: You emit structured tool activity (e.g. NDJSON) your pipeline can produce.
        - listitem [ref=e64]: You have SQL-accessible ground truth (SQLite, Postgres, or a mirror).
        - listitem [ref=e65]: You care when traces look fine but rows are wrong or missing.
      - heading "Not for you" [level=3] [ref=e66]
      - list [ref=e67]:
        - listitem [ref=e68]: You only have unstructured logs and no SQL ground truth.
        - listitem [ref=e69]: You need causal proof that a particular call wrote a row.
        - listitem [ref=e70]: You want a generic APM or log analytics replacement.
      - heading "Guaranteed" [level=3] [ref=e71]
      - list [ref=e72]:
        - listitem [ref=e73]: Verdicts are based on read-only SQL against your DB at verification time, under your registry rules.
        - listitem [ref=e74]: Same inputs and DB snapshot yield the same deterministic result shape (schema-versioned JSON).
      - heading "Not guaranteed" [level=3] [ref=e75]
      - list [ref=e76]:
        - listitem [ref=e77]: Not proof that a tool executed, committed, or caused a row—only that state did or did not match expectations when checked.
    - region "Try it (no account)" [ref=e78]:
      - heading "Try it (no account)" [level=2] [ref=e79]
      - paragraph [ref=e80]: Pick a bundled scenario. The server runs the same verification engine as the open-source CLI against demo fixtures.
      - generic [ref=e81]:
        - generic [ref=e82]: Scenario
        - combobox "Scenario" [ref=e83]:
          - option "Happy path — row matches (wf_complete)" [selected]
          - option "Green trace, missing row (wf_missing)"
          - option "Row present, values wrong (wf_inconsistent)"
        - button "Run verification" [ref=e84] [cursor=pointer]
      - paragraph [ref=e85]: Structured tool activity matches the persisted row; workflow completes as verified.
    - region "Commercial surface (what the product charges for)" [ref=e86]:
      - heading "Commercial surface (what the product charges for)" [level=2] [ref=e87]
      - paragraph [ref=e88]: Open-source lets you contract-verify from the repo without an API key; licensed npm usage, quota, and keys follow Pricing and Account. Machine-readable contracts stay on the site.
      - paragraph [ref=e89]:
        - link "Pricing" [ref=e90] [cursor=pointer]:
          - /url: /pricing
        - text: ·
        - link "Account" [ref=e91] [cursor=pointer]:
          - /url: /account
        - text: ·
        - link "OpenAPI" [ref=e92] [cursor=pointer]:
          - /url: /openapi-commercial-v1.yaml
  - contentinfo [ref=e93]:
    - generic [ref=e94]:
      - navigation "Product links" [ref=e95]:
        - link "GitHub" [ref=e97] [cursor=pointer]:
          - /url: https://github.com/jwekavanagh/agentskeptic
        - generic [ref=e98]:
          - text: ·
          - link "npm" [ref=e99] [cursor=pointer]:
            - /url: https://www.npmjs.com/package/agentskeptic
        - generic [ref=e100]:
          - text: ·
          - link "OpenAPI" [ref=e101] [cursor=pointer]:
            - /url: /openapi-commercial-v1.yaml
        - generic [ref=e102]:
          - text: ·
          - link "GitHub issues" [ref=e103] [cursor=pointer]:
            - /url: https://github.com/jwekavanagh/agentskeptic/issues
        - generic [ref=e104]:
          - text: ·
          - link "Company" [ref=e105] [cursor=pointer]:
            - /url: /company
      - navigation "Trust and legal" [ref=e106]:
        - link "Security & Trust" [ref=e108] [cursor=pointer]:
          - /url: /security
        - generic [ref=e109]:
          - text: ·
          - link "Privacy" [ref=e110] [cursor=pointer]:
            - /url: /privacy
        - generic [ref=e111]:
          - text: ·
          - link "Terms" [ref=e112] [cursor=pointer]:
            - /url: /terms
  - alert [ref=e113]
```

# Test source

```ts
  1 | import { expect, test } from "@playwright/test";
  2 | 
  3 | test("skip link moves focus to #site-main", async ({ page }) => {
  4 |   await page.goto("/");
> 5 |   await page.locator(".skip-to-main").click();
    |                                       ^ Error: locator.click: Test timeout of 30000ms exceeded.
  6 |   await expect(page.locator("#site-main")).toBeFocused();
  7 | });
  8 | 
```