---
name: Executive Logistics Telemetry
colors:
  surface: '#0b1326'
  surface-dim: '#0b1326'
  surface-bright: '#31394d'
  surface-container-lowest: '#060e20'
  surface-container-low: '#131b2e'
  surface-container: '#171f33'
  surface-container-high: '#222a3d'
  surface-container-highest: '#2d3449'
  on-surface: '#dae2fd'
  on-surface-variant: '#bccac0'
  inverse-surface: '#dae2fd'
  inverse-on-surface: '#283044'
  outline: '#87948b'
  outline-variant: '#3d4a42'
  surface-tint: '#68dba9'
  primary: '#68dba9'
  on-primary: '#003825'
  primary-container: '#25a475'
  on-primary-container: '#00311f'
  inverse-primary: '#006c4a'
  secondary: '#ffb95f'
  on-secondary: '#472a00'
  secondary-container: '#ee9800'
  on-secondary-container: '#5b3800'
  tertiary: '#ffb3ad'
  on-tertiary: '#68000a'
  tertiary-container: '#ff5451'
  on-tertiary-container: '#5c0008'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#85f8c4'
  primary-fixed-dim: '#68dba9'
  on-primary-fixed: '#002114'
  on-primary-fixed-variant: '#005137'
  secondary-fixed: '#ffddb8'
  secondary-fixed-dim: '#ffb95f'
  on-secondary-fixed: '#2a1700'
  on-secondary-fixed-variant: '#653e00'
  tertiary-fixed: '#ffdad7'
  tertiary-fixed-dim: '#ffb3ad'
  on-tertiary-fixed: '#410004'
  on-tertiary-fixed-variant: '#930013'
  background: '#0b1326'
  on-background: '#dae2fd'
  surface-variant: '#2d3449'
typography:
  display-lg:
    fontFamily: Outfit
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Outfit
    fontSize: 30px
    fontWeight: '600'
    lineHeight: 38px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Outfit
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Outfit
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  telemetry-num:
    fontFamily: Outfit
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: 0.02em
  body-lg:
    fontFamily: Manrope
    fontSize: 18px
    fontWeight: '500'
    lineHeight: 26px
  body-md:
    fontFamily: Manrope
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Manrope
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-lg:
    fontFamily: Outfit
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 18px
    letterSpacing: 0.04em
  label-md:
    fontFamily: Outfit
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Outfit
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.04em
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-sm: 0.75rem
  margin: 1.25rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
  space-2xl: 2.5rem
---

## Brand & Style

This design system defines an executive-grade logistics interface engineered specifically for professional couriers and high-throughput delivery personnel operating under demanding road conditions. The aesthetic fuses cockpit-level instrumentation with refined, dark-mode luxury: crisp matte surfaces, pill-shaped tactile enclosures, and jewel-like status telemetry that guarantees immediate cognitive parsing.

Key brand attributes:
- **Cockpit Precision:** High-contrast layouts optimized for split-second legibility across varying ambient cabin light, direct solar glare, and night operations.
- **Tactile Confidence:** Pill-form controls and oversized target boundaries engineered for deliberate, error-free physical interaction while docked or on foot.
- **Luminous Hierarchy:** Dark matte foundations punctuated by radiant emerald accents and cautionary amber indicators to distinguish navigation, critical route states, and cash reconciliation.

## Colors

The palette establishes an ultra-refined dark spectrum that minimizes driver eye fatigue while providing distinct luminous channels for situational awareness.

- **Primary (`#059669` - Electric Emerald):** Anchors operational progress, active route confirmations, delivery completion sequences, and optimal performance KPIs. It possesses an internal neon-like radiance against charcoal underlays.
- **Secondary (`#F59E0B` - Radiant Amber):** Reserved strictly for high-priority financial checkpoints, cash-on-delivery (COD) thresholds, priority transit alerts, and urgent driver dispatch notifications.
- **Tertiary (`#EF4444` - Crimson Red):** Denotes non-reversible actions, route cancellations, rejected parcels, and immediate safety interventions.
- **Neutral Surfaces (`#0F172A` to `#1E293B`):** Form a deep, anti-reflective matte architecture. Deep Slate `#0F172A` anchors the root view canvas, while `#1E293B` powers elevated functional cards, bounded by structural sub-strokes (`#334155`).
- **Typography & Data Tones:** Pure `#F8FAFC` yields uncompromising visual clarity for dynamic metrics and street labels, while `#94A3B8` renders auxiliary metadata and contextual units without cluttering the driver’s field of view.

## Typography

Typography emphasizes numeric readability, structural balance, and glanceable legibility.

- **Headlines & Telemetry (`Outfit`):** Geometric, precise, and crisp. Outlined figures, distances (e.g., `1.8 KM`), speed ratings, and currency amounts utilize Outfit's structured proportions to maintain absolute clarity even through vehicle motion and vibrations.
- **Body & Instructional Copy (`Manrope`):** Delivers humanist warmth, open counters, and high legibility across dense delivery instructions, address manifests, and customer notes.
- **Scale Rules:** All numeric figures tied to mission-critical telemetry (distance, earnings, timers) adopt the `telemetry-num` style with tabular lining figures. Body text never falls below 14px to protect touch accuracy and rapid cognitive intake.

## Layout & Spacing

Layout geometry follows an uninterrupted single-column vertical flow engineered specifically for one-handed handheld navigation and vehicular cradle mounts.

- **Grid Architecture:** 4-column dynamic grid on mobile devices expanding into an anchored 8-column layout on wide vehicle dashboard tablets. Content expands fluidly while respecting safe vertical hardware insets.
- **The Touch Corridor:** Primary action triggers, turn confirmations, and status slide-toggles are concentrated within the lower 40% of the mobile viewport, guaranteeing zero strain for thumb-reach access.
- **Touch-Target Invariant:** All interactive surface areas enforce an absolute minimum touch zone of 48×48px. Inline action cells expand padding internally (`space-md` to `space-lg`) to ensure rapid taps hit targets without micro-aiming.

## Elevation & Depth

Visual hierarchy uses a refined multi-tiered surface model built on dark slate tones, subtle luminous backdrops, and precision perimeter strokes rather than muddy black drop-shadows.

- **Foundation (Level 0):** Canvas base `#0F172A` provides an anti-glare, non-emissive surface.
- **Docked Surface (Level 1):** Main delivery cards, telemetry panels, and stop queues sit at `#1E293B`, defined by a crisp 1px perimeter stroke of `#334155` (reduced to 60% opacity) to create sharp edge definition against the root backdrop.
- **Floating Controls (Level 2):** Floating emergency actions, floating route re-center buttons, and sticky confirmation bars occupy an elevated layer featuring a calibrated jewel glow: `0 8px 32px -4px rgba(5, 150, 105, 0.25)`.
- **Modals & Overlays (Level 3):** Modal sheets (signature capture, package decline flow) apply a dense backdrop filter blur (16px) combined with an 80% opacity `#0B1120` veil, focusing complete driver attention onto the immediate physical transaction.

## Shapes

The interface embraces a signature pill-shaped geometry, combining aerodynamic luxury with modern industrial utility.

- **Base Radius (Pill Form):** Primary interactive items, badges, pill-tabs, and action buttons employ complete capsule contours (`rounded-full` / Level 3 roundedness). This soft curvature contrasts sharply with dense tabular data, guiding the driver's gaze toward actionable operational touchpoints.
- **Container Architecture:** Primary cards, route modules, and modular telemetry widgets feature generous curved bounds (`rounded-2xl` to `rounded-3xl` / 1.5rem to 2rem corner radii), softening the interface and conveying an executive, crafted feel.
- **Enclosed Chips & Indicators:** Live delivery timers, COD monetary tags, and parcel counter pills maintain complete rounded capsule forms to visually set them apart from standard text lines.

## Components

### Buttons & Interactive Controls
- **Primary Operational Button:** Full-width pill-shaped button (height: 56px, minimum hit zone: 56px) surfaced in vibrant emerald (`#059669`) with white high-contrast text (`#F8FAFC`, `label-lg`). Includes an embedded jewel glow on active hover/press states.
- **Financial / Action Trigger:** Vibrant Amber (`#F59E0B`) fill with deep contrast slate labeling, used exclusively for cash collection confirmation ("Collect COD") and immediate dispatcher communication.
- **Swipe-to-Confirm Slider:** A high-security mechanical slider contained within a capsule track (`#1E293B` background, `#334155` border) with an emerald knob to prevent accidental pocket or cradle completions.

### Metric Cards & Telemetry Pods
- **Telemetry Pod:** Elevated `#1E293B` pill-bracketed surface featuring high-clarity `telemetry-num` statistics (e.g., remaining stops, shift earnings, battery/GPS accuracy). Contains a micro jewel-indicator at the top edge displaying real-time sync status.
- **Parcel Route Card:** Segmented pill container housing customer name, parcel count badge, and route milestone. Features an explicit secondary border tint (`#334155`) that transitions to primary emerald when within a 200m geofence radius.

### Input Fields & Data Entry
- **Delivery Note & PIN Verification:** Capsule-shaped input enclosures (height: 52px) with `#1E293B` fill, `#334155` border, and crisp text (`#F8FAFC`). Focused states shift the stroke to an electric emerald border with a subtle 2px blurred ambient glow.
- **Cash Reconciliation Input:** Dedicated numerical keypad fields using enlarged, centered Outfit numbers (28px) flanked by currency tags in amber (`#F59E0B`).

### Status Badges & Chips
- **Jewel Status Indicators:** Capsule badges featuring a glowing 6px core dot. 
  - Emerald: Active Transit / Delivered.
  - Amber: Pending Payment / Urgent Priority.
  - Crimson: Canceled / Return to Depot.
- Chips use a low-opacity color fill (15%) surrounded by a matching 1px solid stroke to preserve dark-mode legibility without causing glare.

### Selection Controls (Checkboxes & Radios)
- Oversized 24×24px touch targets housed inside 48×48px transparent touch pads. Checked states trigger an electric emerald fill with an animated checkmark, providing unequivocal visual confirmation under direct cabin sunlight.