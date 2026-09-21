---
artifact: design-note
page: src/app/page.tsx
classification: Internal
last_updated: 2026-09-20
---

# THE CLAW — WDI-010 design note

Site type: game-playful-interactive
Audience: people deciding a night out or a night in
Primary action: ask the claw, in one sentence, to lift what fits
Tone: tactile, arcade, honest
Selected composition: playable-first-screen
Why this composition fits: the first act is play — prizes already sit in a felt pit, the ask field is the claw control, and a city is requested as a pickable prize when the corpus is a place.
Style atlas match: style.game-playful-interactive
Reference/pattern moves borrowed (max 3): Dropout ticket yellow on black as the only action color; playable-first-screen DOM controls; arcade cabinet as subject-shaped IA
Card budget for this site type / cards used / justification if > 0: 0 / 0 / prize and city tokens are physics objects in the pit, not an equal-height card wall
Forbidden defaults rejected (from the list of 8): equal-height card wall; three columns under a centered hero; fake dashboard screenshot / invented product UI; pointless KPI strip (unverifiable big numbers); stock-icon feature grid; repeated two-column zig-zag sections; unearned gradient blob background; giant testimonial card row
Product imagery provenance: none
Visitor-facing product proof: runnable program/DOM slice @ src/app/page.tsx
Static product screenshots in visitor-facing content: none
Motion behavior: prizes fall under gravity; matches lift on a Jev verdict; claw rig animates while asking; prefers-reduced-motion parks tokens
Responsive behavior (mobile composed, not squeezed): corpora rail becomes a ticket strip; city ask is a felt plate; pit uses fewer larger tokens
Accessibility fallback (reduced-motion, keyboard, no-JS): ask field, corpora buttons, and city buttons are real HTML; noscript catalog; reduced-motion disables physics
Performance risk: one requestAnimationFrame loop; static catalog JSON; Jev batches of 28
Platform target(s): web desktop plus mobile browser


## Classification

Project/topic: THE CLAW, a Jev-powered prize pit. Ask in plain English; matching things rise out of a physical heap.
Page or site type: game-playful-interactive
Primary audience: people who want a night (food, pub, film, series, gift) without scrolling a grid
Primary user action: type what they actually want and watch the claw lift matches
Secondary user action: pick a city when the pit is place-shaped (eats, pubs, do); switch corpora in the top rail
Emotional tone: tactile, arcade, slightly dangerous, honest
Content density: high in the pit, sparse in the HUD
Device priority: desktop first, mobile composed as a shorter cabinet
Interaction level: high (physics pit + typed ask)
Motion level: high, identity-level, with reduced-motion freeze
Trust requirement: medium — catalog is a dated snapshot, Jev source is named
Conversion pressure: none
Implementation stack: Next.js App Router, React, TypeScript, TypeSafe Jev
Platform target(s): web desktop plus mobile browser

## design.html equivalent — `src/app/page.tsx` (`/`)

Site type: game-playful-interactive
Audience: people deciding a night out or a night in
Primary action: ask the claw, in one sentence, to lift what fits
Tone: tactile, arcade, honest
Selected composition: playable-first-screen
Why this composition fits: the first act is play — prizes already sit in a felt pit, the ask field is the claw control, and a city is requested as a pickable prize when the corpus is a place. There is no marketing hero in front of the machine.
Style atlas match: style.game-playful-interactive (immersive, tactile, high feedback). Chrome is cabinet black and prize ivory; the single nameable accent is claw gold. Felt burgundy is pit media, not a second accent.
Reference/pattern moves borrowed (max 3):
1. Dropout.tv ticket yellow on black as the only action color (inspo slug dropout-tv--about; move: one accent, condensed wordmark). Not their about-page layout.
2. playable-first-screen signature (WDI design-gate.json): controls and catalog exist in the DOM; play is the first verb; machine state is told honestly (live Jev vs local heuristic).
3. Arcade cabinet as subject-shaped IA (WDI P12): HUD rail, glass, felt pit, claw. The page is a machine, not a SaaS shell.
Card budget for this site type / cards used / justification if > 0: 0 / 0 / prize and city tokens are physics objects in the pit, not an equal-height card wall — prizes are physics tokens in a pit, not an equal-height card wall
Forbidden defaults rejected (from the list of 8):
1. equal-height card wall — pit objects collide and stack; they are not a grid of identical cards
2. three columns under a centered hero — no hero, no column marketing
3. fake dashboard screenshot / invented product UI — the product is the live pit
4. pointless KPI strip — no vanity numbers
5. stock-icon feature grid — no features section
6. repeated two-column zig-zag sections — single viewport machine
7. unearned gradient blob background — cabinet fill is flat; prize faces are solid enamel
8. giant testimonial card row — none
Product imagery provenance: none
Visitor-facing product proof: runnable program/DOM slice @ src/app/page.tsx
Static product screenshots in visitor-facing content: none
Motion behavior: prizes fall under gravity; matches are lifted by the claw on a Jev verdict; the claw rig animates only while asking; `prefers-reduced-motion` parks tokens in a static pit and skips the lift
Responsive behavior (mobile composed, not squeezed): desktop is a wide cabinet with the ask dock over the glass; at ~640px the corpora rail becomes a horizontal ticket strip under the wordmark, the city ask is a full-width felt plate, and the pit uses fewer, larger tokens
Accessibility fallback (reduced-motion, keyboard, no-JS): ask field, corpora buttons, and city buttons are real HTML; tokens are named buttons; a noscript ordered catalog remains; reduced-motion disables physics
Performance risk: one requestAnimationFrame loop for the pit; catalog is static JSON; Jev batches of 28

## Location

Place corpora (Eats, Pubs, Do) do not drop prizes until a city is chosen. The ask is the play: city names sit in the pit as pickable prizes. City is stored in localStorage and shown as a brass plate. Movies, Series, Dinner, Wine, and Gifts do not ask.

## Honesty band

Footer names catalog size, that every item is considered, and whether TypeSafe Jev or the local heuristic answered. Catalog is a September 2026 snapshot.
