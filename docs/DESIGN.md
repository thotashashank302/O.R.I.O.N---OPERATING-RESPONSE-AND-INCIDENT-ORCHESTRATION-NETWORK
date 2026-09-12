# ORION Visual System

## Direction

ORION combines two supplied references into one product world: cinematic blue-hour campus photography for entry and authentication, then a warm institutional desk for daily operations. The shift is intentional—the threshold feels secure and atmospheric; the working environment feels calm, legible, and accountable.

The dashboard borrows the structure, not the academic content, of the supplied Stitch reference: a persistent left index, quiet top context bar, warm paper field, charcoal navigation, editorial serif headings, and dense operational information without decorative glass or neon.

## Color

- Entry background: `#06101b` and `#07101c`.
- Primary action: `#63b5d7` to `#78bdd9`.
- Dashboard paper: `#f6efe4`; deeper navigation paper: `#eee3d4`.
- Primary ink: `#29251f`; muted ink: `#756d62`; divider: `#d7c9b6`.
- Attention: `#b6792c`; danger: `#a64f45`; ready state: `#4d9874`.

Color communicates state sparingly. Private, critical, pending, failed, and verified states retain explicit text labels; color is never the only signal.

## Type

Operational copy uses Avenir Next with Segoe UI fallback. Display headings use Georgia/Times as the locally available editorial serif. Uppercase tracking is reserved for compact system labels, never paragraphs. Numeric operational data uses tabular figures.

## Composition

- Authentication uses a 58/42 split at desktop: full-height campus photograph and a narrow dark form pane.
- Protected routes use a 248px persistent role navigation rail, a compact context bar, and a flexible content surface.
- Navigation changes by the active role; server authorization remains independent from what navigation displays.
- Mobile collapses the rail to a horizontal, scrollable navigation row and keeps primary operations reachable without hover.

## Components and States

- Containers use either a single border or depth shadow, not both.
- Cards are used only for bounded records, assignments, approvals, and forms—not as the universal page structure.
- Cyan is reserved for primary action and current focus. Amber and red are reserved for real operational attention and danger.
- Every data surface must provide loading, empty, error, forbidden, and retry behavior.
- Modals are limited to focused report or role-grant actions already present in the product.

## Motion and Accessibility

Motion is restrained to state feedback and navigation transitions. Reduced-motion preferences disable nonessential animation. Focus rings, selection color, input caret, contrast, keyboard operation, and mobile overflow are part of the visual system.

## Image Provenance

`public/images/orion-campus-login.webp` was generated for this project from the user-supplied login composition reference. Its exact production prompt is stored in the adjacent JSON sidecar.
