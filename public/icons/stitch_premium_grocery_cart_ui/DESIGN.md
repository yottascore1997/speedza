# Design System: Ultra-Premium Grocery Delivery Experience

## 1. Overview & Creative North Star: "The Digital Concierge"
The Creative North Star for this design system is **"The Digital Concierge."** We are not building a utility; we are crafting a high-end editorial experience that mirrors the precision of a Michelin-starred kitchen and the effortless elegance of a flagship Apple Store.

To break the "template" look common in grocery apps, this system relies on **Intentional Asymmetry** and **Tonal Depth**. We move away from rigid, boxed-in grids toward a layout that breathes. Expect overlapping product imagery, exaggerated white space, and a sophisticated interplay between razor-sharp typography and soft, organic containers. We don't just "list" groceries; we curate them.

---

## 2. Colors & Surface Philosophy
Our palette balances the energetic vitality of fresh produce with the muted, sophisticated tones of premium branding.

### Core Palette
*   **Primary (`primary` #9C3F00):** A deep, roasted orange used for brand authority.
*   **Action Orange (`primary-fixed` #FF7A2F):** The vibrant, high-energy orange for CTAs and conversion.
*   **Success Green (`secondary` #006947):** Used exclusively for savings, organic certifications, and "Freshness Guaranteed" markers.
*   **Neutrals:** A range of soft grays (`surface` #F5F6F7 to `surface-container-lowest` #FFFFFF) that form the foundation of our UI.

### The "No-Line" Rule
**Traditional 1px borders are strictly prohibited.** Boundaries must be defined through background color shifts. To separate a category section from the main feed, transition from `surface` to `surface-container-low`. The eye should perceive change through "slight shifts in weather" rather than "fences."

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers—like stacked sheets of fine vellum.
*   **Base:** `surface` (#F5F6F7)
*   **Sectioning:** `surface-container-low` (#EFF1F2)
*   **Interactive Cards:** `surface-container-lowest` (#FFFFFF)
*   **The "Glass & Gradient" Rule:** Use `surface-tint` with 10% opacity and a 20px `backdrop-blur` for floating navigation bars. For primary CTAs, apply a subtle linear gradient from `primary-fixed` to `primary-fixed-dim` to provide a "lit from within" glow.

---

## 3. Typography: The Editorial Voice
We use a four-font stack to create a rhythmic, high-end hierarchy.

*   **Display & Headlines (Sora/PlusJakartaSans):** Geometric and confident. Use `display-lg` for hero marketing moments. The wide apertures of Sora convey openness and modern luxury.
*   **Main UI (Poppins):** Used for navigation, buttons, and titles. Poppins’ geometric construction maintains a clean, architectural feel.
*   **Body Text (Inter):** The workhorse. Used for product descriptions and fine print (`body-md`). Inter ensures maximum legibility at small scales.
*   **Secondary Accents (Manrope):** Our "Luxury Label." Used for `label-sm` metadata, such as "Imported from Italy" or "Origin: Organic Farm." It adds a technical yet premium flair to secondary information.

---

## 4. Elevation & Depth
In this design system, depth is a feeling, not a feature.

*   **The Layering Principle:** Avoid shadows for static elements. Instead, nest a `surface-container-lowest` card on a `surface-container-high` background. This "Tonal Layering" creates a sophisticated, natural lift.
*   **Ambient Shadows:** For floating elements (e.g., a "Quick Add" FAB), use a multi-layered shadow:
    *   Layer 1: 0px 4px 20px rgba(44, 47, 48, 0.04)
    *   Layer 2: 0px 10px 40px rgba(44, 47, 48, 0.06)
    *   *Note:* Shadow color must be a tint of `on-surface`, never pure black.
*   **The "Ghost Border":** If a product image blends too closely with the background, use a 1px stroke of `outline-variant` at **15% opacity**. It should be felt, not seen.
*   **Glassmorphism:** Use for persistent headers. It allows the vibrant colors of fresh produce to bleed through the UI as the user scrolls, maintaining a sense of place.

---

## 5. Components

### Buttons
*   **Primary:** High-pill shape (`rounded-full`), `primary-fixed` background, `on-primary-fixed` text. Subtle inner-glow on hover.
*   **Secondary:** `surface-container-highest` background with `on-surface` text. No border.
*   **Tertiary:** No background. `primary` text with a 2pt weight increase.

### Cards & Lists
*   **The Product Card:** 20px corner radius (`md`). Use `surface-container-lowest` background. 
*   **Spacing:** Content within cards must use a minimum of 24px padding. 
*   **No Dividers:** In lists, use 12px of vertical white space to separate items. If separation is visually required, use a subtle background shift to `surface-container-low`.

### Input Fields
*   **Style:** `surface-container-low` background, no border. On focus, transition to `surface-container-lowest` with a "Ghost Border" of `primary` at 20% opacity.
*   **Feedback:** Error states use `error` (#B02500) only for the helper text and a subtle tint in the field background.

### Premium-Specific Components
*   **The "Provenance Tag":** A small Manrope-set label with a `secondary-container` background and `on-secondary-container` text, used to highlight organic or local sourcing.
*   **Glass Drawer:** Bottom sheets for product details should use 70% opacity `surface-container-lowest` with a heavy `backdrop-blur` (30px), making the grocery list appear as if it’s floating over the kitchen floor.

---

## 6. Do’s and Don’ts

### Do:
*   **Do** use extreme white space (e.g., 64px+ between sections) to evoke a gallery-like feel.
*   **Do** lean into high-quality, "hero" photography where the food breaks the container bounds.
*   **Do** use `rounded-lg` (2rem) for large image containers to maintain the "soft luxury" aesthetic.

### Don’t:
*   **Don’t** use 100% black (#000000). Use `on-surface` (#2C2F30) for a softer, more premium contrast.
*   **Don’t** use standard "drop shadows" on every card. Rely on background color shifts first.
*   **Don’t** crowd the interface. If a screen feels busy, remove a divider and increase the padding.
*   **Don’t** use "Alert Red" for everything. Reserve `error` for critical failures; use `primary` for attention-grabbing notifications.