```markdown
# Design System Specification: The Curated Pantry

## 1. Overview & Creative North Star
**Creative North Star: "The Modern Organicist"**

This design system moves away from the frantic, high-density "quick-commerce" aesthetic and leans into an editorial, premium grocery experience. We are not just building a utility; we are building a digital flagship store. 

To break the "template" look, we utilize **Intentional Asymmetry**. Hero sections should feature overlapping elements—product photography breaking out of container bounds—and a high-contrast typography scale that prioritizes breathing room over information density. The goal is "Modern Cleanliness" that feels human and curated, not clinical.

---

## 2. Colors & Surface Philosophy
The palette is rooted in energy and freshness, balanced by a sophisticated neutral foundation.

### Palette Highlights
- **Primary (`#a04100` / `#ff6b00`):** Use the high-vibrancy `primary_container` (#FF6B00) for high-impact CTAs and the deeper `primary` (#A04100) for interactive text to ensure AAA accessibility.
- **Secondary (`#006d37` / `#27AE60`):** Reserved strictly for "Success" states, organic/fresh categories, and "In-Stock" trust signals.
- **Surface Neutrals:** Use `surface` (#F8F9FA) as the canvas. 

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders to section content. Boundaries must be defined solely through background color shifts. Use `surface_container_low` sections to house groups of cards on a `surface` background. This creates a "soft UI" that feels more expensive and less rigid.

### The "Glass & Gradient" Rule
To move beyond a flat "Blinkit-style" look, use **Glassmorphism** for floating headers and navigation bars. 
- Use `surface` at 80% opacity with a `24px` backdrop blur.
- **Signature Textures:** Apply a subtle linear gradient to main CTAs (e.g., `primary_container` to `primary`) to provide a "tactile" glow that flat hex codes cannot achieve.

---

## 3. Typography
We use a dual-font strategy to balance character with extreme readability.

*   **Display & Headlines (Plus Jakarta Sans):** Chosen for its geometric precision and modern "Apple-esque" flair. Large tracking should be slightly tightened (-2%) for headlines to create a tighter editorial feel.
*   **Body & Labels (Manrope):** A highly functional sans-serif that maintains legibility at small scales (e.g., unit prices, weight).

**The Hierarchy:**
- **Headline-LG (2rem):** For category titles (e.g., "Fresh From the Farm").
- **Title-MD (1.125rem):** For product names.
- **Label-SM (0.6875rem):** For micro-copy like "Express Delivery."

---

## 4. Elevation & Depth: Tonal Layering
Traditional drop shadows are largely replaced by **Tonal Layering**.

### The Layering Principle
Depth is achieved by "stacking" surface tiers.
1.  **Level 0 (Base):** `surface` (#F8F9FA)
2.  **Level 1 (Section):** `surface_container_low` (#F3F4F5)
3.  **Level 2 (Card):** `surface_container_lowest` (#FFFFFF)

By placing a white card (`surface_container_lowest`) on a light grey background (`surface_container_low`), we create a "natural lift" without a single shadow pixel.

### Ambient Shadows & Glass
- **Floating CTAs:** When a button must float (e.g., "View Cart"), use an **Ambient Shadow**: `offset: 0, 12; blur: 24; color: on_surface (opacity 6%)`.
- **Ghost Borders:** If a boundary is strictly required for accessibility, use `outline_variant` at 15% opacity. Never use 100% opaque borders.

---

## 5. Components

### Cards & Lists
*   **The Rule of No Lines:** Forbid the use of divider lines between list items. Use `8px` of vertical white space or a subtle shift to `surface_container_high` on hover/press.
*   **Product Cards:** Use `16px (lg)` rounded corners. Images should be slightly inset from the card edge to create a "framed" gallery look.

### Buttons
*   **Primary:** Uses the "Signature Gradient" (`primary_container` to `primary`). 16px corner radius. Text is `on_primary` (White).
*   **Secondary:** Ghost-style. No fill, `outline` token at 20% opacity, `primary` colored text.
*   **Add-to-Cart:** Use a "Morphing" button that transitions from a pill-shape "ADD" to a stepper (+ / -) using a shared `surface_container_highest` background.

### Input Fields
*   **Search Bar:** Instead of a border, use `surface_container_high`. When focused, transition to `surface_container_lowest` with an Ambient Shadow. This "pops" the search bar toward the user.

### Interactive Chips
*   **Selection:** Use `primary_fixed` for selected states with `on_primary_fixed` text. This provides a soft, "high-end" highlight rather than a harsh high-contrast fill.

---

## 6. Do’s and Don’ts

### Do
*   **Use Overlapping Imagery:** Let a bunch of bananas or a milk bottle "peek" out of its container to break the grid.
*   **Embrace White Space:** Use the 8pt spacing scale aggressively. If it feels "too empty," you’re likely doing it right.
*   **Use "Freshness" Icons:** Use thin-stroke, rounded-end icons to match the friendly illustrations.

### Don't
*   **Don't Use Pure Black:** Use `on_surface` (#191C1D) for text. Pure black (#000) kills the "organic" feel.
*   **Don't Use Sharp Corners:** Every element must adhere to the `16px (lg)` or `12px (md)` corner radius. 
*   **Don't Use Standard Dividers:** Never use a solid 1px line to separate "Fruits" from "Vegetables." Use a header and a change in background tint.

---

## 7. Signature Element: The "Trust Layer"
To build trust, all "Quality Guarantees" or "Origin Stories" should be housed in a `secondary_container` (Soft Green) box with a backdrop blur and a tiny, friendly illustration. This creates a visual "safe zone" that reinforces the premium, healthy nature of the brand.