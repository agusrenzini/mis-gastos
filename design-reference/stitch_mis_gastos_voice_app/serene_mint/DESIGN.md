---
name: Serene Mint
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#3d4a42'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#6d7a72'
  outline-variant: '#bccac0'
  surface-tint: '#006c4a'
  primary: '#006948'
  on-primary: '#ffffff'
  primary-container: '#00855d'
  on-primary-container: '#f5fff7'
  inverse-primary: '#68dba9'
  secondary: '#006398'
  on-secondary: '#ffffff'
  secondary-container: '#5bb8fe'
  on-secondary-container: '#00476e'
  tertiary: '#825100'
  on-tertiary: '#ffffff'
  tertiary-container: '#a36700'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#85f8c4'
  primary-fixed-dim: '#68dba9'
  on-primary-fixed: '#002114'
  on-primary-fixed-variant: '#005137'
  secondary-fixed: '#cce5ff'
  secondary-fixed-dim: '#93ccff'
  on-secondary-fixed: '#001d31'
  on-secondary-fixed-variant: '#004b73'
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb95f'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  headline-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
  headline-xl-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 38px
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 30px
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-mobile: 0.75rem
  margin: 1.25rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system is crafted for an intimate, calm, and empowering personal finance experience. Rather than treating personal budgeting like enterprise accounting or cold corporate spreadsheets, the aesthetic centers on psychological safety, clarity, and daily encouragement.

The visual direction combines **Warm Modernism** with subtle **Soft Tactility**:
- Generous breathing space and uncluttered visual hierarchy reduce financial anxiety.
- Softly rounded contours communicate accessibility and gentleness.
- Fresh botanical emerald tones inspire equilibrium and steady progress rather than hyper-speculative urgency.
- The interface feels effortless in single-hand mobile interactions, favoring low thumb fatigue and immediate tactile feedback.

## Colors

The palette establishes an organic balance between clinical clarity and welcoming warmth:

- **Primary (`#059669` / Emerald Accent `#10B981`):** Serves as the anchor for positive balances, key call-to-actions, successful states, and overall financial vitality.
- **Secondary (`#0284C7`):** Applied to investments, planned goals, and informational indicators.
- **Tertiary (`#F59E0B`):** Warm amber used for alerts, ongoing budgets, and recurring bills nearing limits.
- **Neutrals & Surfaces:**
  - Base canvas: `#F8FAFC` to `#F1F5F9` providing a soothing off-white ground that avoids blinding starkness.
  - Surface cards: `#FFFFFF` offering crisp contrast against the base canvas.
  - Text: Deep slate `#0F172A` for primary readouts, `#334155` for descriptive body, and `#64748B` for secondary captions.
  - Outlines: `#E2E8F0` for featherweight structural separation.

### Category Accent Tokens
For budgeting clarity, category accents rely on pastel-backed vibrant pigments:
- **Food & Dining:** `#F97316` (Tangerine) with `#FFEDD5` (Soft Apricot tint)
- **Housing & Utilities:** `#6366F1` (Indigo) with `#E0E7FF` (Soft Lavender tint)
- **Personal Care & Wellness:** `#EC4899` (Rose) with `#FCE7F3` (Soft Blush tint)
- **Transport & Mobility:** `#0EA5E9` (Sky) with `#E0F2FE` (Soft Cerulean tint)
- **Entertainment:** `#8B5CF6` (Violet) with `#EDE9FE` (Soft Violet tint)

## Typography

Plus Jakarta Sans is utilized across all typographic roles. Its gentle geometric apertures and friendly terminals inject warmth without sacrificing numerical legibility.

- **Tabular Figures:** All financial figures and transactions must enable tabular numbers (`font-variant-numeric: tabular-nums`) to ensure vertical visual alignment along currency amounts.
- **Hierarchy:** Balance values use prominent weights (`headline-xl`, `headline-lg`) paired with subdued auxiliary currency symbols. Small badges and tags employ `label-sm` in semi-bold tracking for crisp rendering at diminutive scale.

## Layout & Spacing

A mobile-first fluid layout centered around the thumb-reach zone.

- **Grid & Margins:** 
  - Mobile screens use a fluid single-column layout flanked by `1rem` outer canvas padding (`margin-mobile`), ensuring maximal surface area for transaction cards while avoiding edge crowding.
  - Tablet/Desktop viewports (PWA running on broader screens) constrain content to a centered max-width container (480px on phone frame simulators or up to 840px for expanded dashboard views) with `1.25rem` margins.
- **Rhythm & Safe Areas:** 
  - Strict compliance with viewport bottom safe zones (`env(safe-area-inset-bottom)`) with dedicated padding of `space-xl` beneath scrollable content to prevent occlusion by the persistent navigation bar.
  - Spacing internally between related list items relies on `space-sm` (8px), whereas distinct categorical modules separate via `space-lg` (24px).

## Elevation & Depth

This design system avoids dark or dramatic shadows, relying instead on ambient light diffusion and layered surfaces:

- **Layer 0 (Canvas):** `#F8FAFC` base background.
- **Layer 1 (Card & Content Blocks):** `#FFFFFF` surfaces paired with an ultra-soft ambient shadow: `0 2px 8px -2px rgba(15, 23, 42, 0.04), 0 1px 3px -1px rgba(15, 23, 42, 0.02)` and a hairline border of `#E2E8F0`.
- **Layer 2 (Elevated Action Modules & Bottom Sheets):** `0 10px 25px -5px rgba(15, 23, 42, 0.06), 0 4px 10px -3px rgba(15, 23, 42, 0.03)` with no top border to evoke soft flotation.
- **Layer 3 (Overlays & Quick Action Dial):** Translucent backdrop blur (`backdrop-filter: blur(12px)`) with `rgba(15, 23, 42, 0.2)` tinting, creating a focused, unobtrusive focal plane for expense entry.

## Shapes

The shape system expresses approachability through organic, pillowy curves:

- Standard input fields, badges, and small components adopt `rounded-lg` (16px) or `rounded-full` (capsules).
- Core interactive cards, balance widgets, and transaction containers enforce `rounded-xl` (24px).
- Bottom sheets, floating action modals, and prompt sheets feature expansive top radii of 28px–32px to reinforce an inviting, mobile-native sheet gesture.

## Components

### Buttons
- **Primary:** Full-width mobile CTA in emerald (`#059669`), text in pure white, height 52px for optimal touch target, radius `1rem`. Active state applies a scale transformation (`scale(0.98)`).
- **Secondary / Ghost:** Soft mint fill (`rgba(16, 185, 129, 0.1)`) with `#047857` label, or outline in `#E2E8F0` on pure `#FFFFFF`.
- **Quick-Add Floating Action Button (FAB):** Integrated centrally in the bottom bar; circular (56px), elevated with primary green tint glow (`0 8px 20px -4px rgba(5, 150, 105, 0.35)`).

### Transaction Lists
- Grouped by day using sticky minimalist headers (`label-sm`, color `#64748B`).
- Rows contain circular category icons (44px) draped in soft category tints, category title in `label-lg`, note or timestamp in `body-sm`, and tabular numerical readouts aligned right. Negative balances default to slate-900, while income values display emerald green (`#059669`) with a `+` prefix.

### Cards & Summary Modules
- Net Worth & Monthly Balance cards use subtle off-white to pale mint/slate gradients (`linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)`) with `1.5rem` internal padding, rounded-2xl geometry, and micro-dividers.

### Inputs & Keypad
- Expense input fields use oversized typography (`headline-xl`, centered) accompanied by an auto-selected currency token.
- Custom bottom numeric keypad with large, rounded button cells (64px height) yielding immediate subtle slate background responses on touch.

### Chips & Category Selectors
- Pill-shaped tags (`rounded-full`) with `space-xs` vertical and `space-md` horizontal padding. Selected states transition from muted light gray outlines into solid pastel category hues with high-contrast text.

### Bottom Navigation Bar
- Grounded navigation docking at screen bottom with blur support (`rgba(255, 255, 255, 0.85)` + 16px blur). Symmetrical 4-item distribution (e.g., Gastos, Presupuesto, Gráficos, Perfil) anchored around the recessed or floating Quick-Add trigger.