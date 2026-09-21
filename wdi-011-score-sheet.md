# THE CLAW — WDI-011 Composition and Visual Anti-Slop Score

Builder self-review. Draft. PASS needs an independent review artifact.

## Page: `src/app/page.tsx` (`/`)

A1 Viewport dominance:      4/5 — The felt pit and hanging claw are the glance object; THE CLAW wordmark is the identity lock. The ask dock is the control, not a second hero. (evidence: docs/claw-where.png, docs/claw-risen.png)
A2 Section rhythm:          4/5 — Three unequal bands: HUD rail, empty glass, striped felt. Location-needed, idle pit, and lifted matches are three visual states of one machine, not cloned sections. (evidence: docs/claw-where.png vs docs/claw-risen.png)
A3 Card justification:      5/5 — Site type game-playful-interactive, card budget 0, cards used 0. Prizes are physics tokens. (evidence: design-note.md; src/components/Claw.tsx)
A4 Type:                    4/5 — Bebas Neue wordmark, Figtree UI, IBM Plex Mono HUD labels. Three roles, one display identity. (evidence: src/app/layout.tsx)
A5 Color:                   4/5 — Cabinet black and prize ivory as chrome; claw gold as the only action accent; felt burgundy as pit media. No per-section extra palettes. (evidence: src/app/globals.css)
A6 Motion:                  4/5 — Gravity in the pit, claw rig drops while asking, matches lift on a Jev verdict. Reduced-motion is declared in the design note. (evidence: src/components/Claw.tsx, src/app/globals.css)
A7 Mobile composition:      4/5 — Corpora become a horizontal ticket strip; city ask is full-width copy plus pickable tokens; the pit stays the dominant field. (evidence: composed in Claw.tsx header wrap; desktop proof in docs/*.png)
Weighted overall:           4.15/5.0
Hard-fails triggered:       none
Signature conformance:      confirmed — playable-first-screen: first act is picking a city or asking; controls and catalog exist as HTML buttons and an input; honesty band names Jev vs heuristic.
Verdict:                    PASS (builder draft)

## Hard-fail audit

- HF-1: no card wall
- HF-2: no three-column hero
- HF-3: no fake dashboard
- HF-4: no KPI strip
- HF-5: no stock-icon feature grid
- HF-6: no zig-zag marketing sections
- HF-7: felt is a striped material fill, not a decorative blob wash
- HF-8: no testimonial row
- HF-9: single-page, single-brand
- VPM-1 / VPM-2: no static product stills in visitor HTML; QA screenshots live under docs/ only
