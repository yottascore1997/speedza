# Design System Specification: The Kinetic Merchant

## 1. Overview & Creative North Star
**Creative North Star: "The Tactile Dashboard"**
In the fast-paced world of food and grocery logistics, efficiency is often mistaken for "flatness." This design system rejects the clinical, sterile nature of standard SaaS templates. Instead, it adopts an editorial, high-end approach we call **The Tactile Dashboard**. 

The system moves beyond simple grids by utilizing **Tonal Layering** and **Intentional Asymmetry**. We treat the mobile screen not as a flat canvas, but as a physical workspace of stacked, premium materials. By utilizing varying surface containers and glassmorphism, we create a UI that feels responsive, high-velocity, and authoritative—giving partners the confidence of a command center with the elegance of a luxury brand.

---

## 2. Colors & Surface Architecture
Our palette transitions from the high-energy `primary` (#FF6B00) to the calming, operational `secondary` (#006D37). 

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders to section off content. Traditional dividers create visual "noise" that slows down cognitive processing. 
- **Boundaries** must be defined through background shifts (e.g., a `surface-container-low` card resting on a `surface` background).
- **Definition** comes from depth and tone, not lines.

### Surface Hierarchy & Nesting
Treat the UI as a series of nested physical layers:
- **Base Layer:** `surface` (#F8F9FA) – The foundation of the app.
- **Sectioning:** `surface-container-low` (#F3F4F5) – Used for grouping related content areas.
- **Actionable Cards:** `surface-container-lowest` (#FFFFFF) – The highest "physical" lift for interactive elements.

### The "Glass & Gradient" Rule
To elevate the experience from "utility" to "premium":
- **Floating Navigation:** Use `surface` colors at 80% opacity with a `20px` backdrop blur for bottom sheets and navigation bars.
- **Signature Gradients:** Main CTAs and Hero sections must use a linear gradient: `primary` (#A04100) to `primary-container` (#FF6B00) at a 135° angle. This adds "soul" and prevents the orange from feeling "cheap" or "plastic."

---

## 3. Typography
We utilize a pairing of **Plus Jakarta Sans** for expressive display and **Inter** for high-velocity data consumption.

| Level | Token | Font | Size | Weight | Intent |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Display** | `display-sm` | Plus Jakarta | 2.25rem | 700 | Large milestone numbers (Daily Sales) |
| **Headline** | `headline-sm` | Plus Jakarta | 1.5rem | 600 | Page titles and section starts |
| **Title** | `title-md` | Inter | 1.125rem | 600 | Card headings and primary navigation |
| **Body** | `body-md` | Inter | 0.875rem | 400 | General information and descriptions |
| **Label** | `label-md` | Inter | 0.75rem | 500 | Metadata, timestamps, and small badges |

**Editorial Note:** Use `on-surface-variant` (#5A4136) for body text to maintain a sophisticated warmth, reserving `on-surface` (#191C1D) strictly for headlines and critical data.

---

## 4. Elevation & Depth
Hierarchy is achieved through **Tonal Layering**, mimicking how light hits stacked paper.

*   **The Layering Principle:** Depth is created by stacking. Place a `surface-container-lowest` card (Pure White) on top of a `surface-container` (Soft Gray) to create a natural "pop" without heavy shadows.
*   **Ambient Shadows:** For high-priority floating elements (e.g., "Accept Order" buttons), use a custom shadow: 
    *   `X: 0, Y: 8, Blur: 24, Spread: -4`
    *   `Color: #A04100 (Primary) at 8% Opacity`. 
    *   *Never use pure black or grey shadows.*
*   **The "Ghost Border" Fallback:** If a border is required for accessibility in input fields, use `outline-variant` (#E2BFB0) at **15% opacity**. It should be felt, not seen.

---

## 5. Components

### Cards & Lists
*   **Structure:** Forbid divider lines. Use `16px` (xl) vertical spacing or a subtle shift from `surface-container-low` to `surface-container-lowest`.
*   **Corner Radius:** All cards must use `lg` (1rem/16px) for a modern, friendly feel.

### Buttons (The Kinetic Set)
*   **Primary:** Gradient fill (`primary` to `primary-container`). `full` radius. Bold `on-primary` text.
*   **Secondary:** `secondary-container` (#7BF8A1) background with `on-secondary-container` (#007239) text. No border.
*   **Tertiary:** Transparent background, `primary` text, no border. Used for "Cancel" or "View Details."

### High-Contrast Status Badges
*   **Success (Ready/Delivered):** `secondary-fixed` (#7EFBA4) background with `on-secondary-fixed` (#00210C) text.
*   **Critical (Delayed):** `error-container` (#FFDAD6) background with `on-error-container` (#93000A) text.
*   **Visual Style:** Heavy weight, uppercase, `0.5px` letter spacing for an "authoritative" look.

### Input Fields
*   **Surface:** `surface-container-highest` (#E1E3E4).
*   **Active State:** `outline` (#8E7164) ghost border (20% opacity) with a `primary` cursor.
*   **Radius:** `md` (0.75rem).

### Merchant-Specific Components
*   **The Velocity Bar:** A slim, horizontal progress gradient showing order preparation time vs. estimated pickup.
*   **Live Ticker:** A `surface-container-lowest` floating header with a soft `primary` glow to alert the partner of incoming orders.

---

## 6. Do's and Don'ts

### Do
*   **Do** use whitespace as a structural element. If a layout feels cluttered, increase the gap before adding a line.
*   **Do** use asymmetrical layouts for dashboards (e.g., a large "Today's Revenue" card paired with two smaller "Live Orders" cards).
*   **Do** apply `backdrop-blur` to any overlay to maintain a sense of environmental context.

### Don't
*   **Don't** use 100% opaque borders. They create a "grid-lock" feel that looks dated.
*   **Don't** use standard "Drop Shadows" from default UI kits. Always tint your shadows with the primary or surface brand colors.
*   **Don't** use pure black (#000000) for text. It is too harsh for high-readability partner dashboards. Use `on-surface`.