# AuditX frontend design system

Every screen in every stream follows this file. It is a set of fixed values and rules, not a mood. If something you need is not covered here, do not improvise: add it to this file in a small change, then use it.

Brand files: [brand/auditx-logo.png](brand/auditx-logo.png), [brand/auditx-palette.png](brand/auditx-palette.png).

## Hard rules

1. **No emojis.** Not in UI text, placeholders, toasts, code comments, docs, tests, commit messages or seed data. Use an icon from the icon set if a glyph is needed.
2. **No generic AI-dashboard patterns.** Banned: gradients of any kind, gradient text, glassmorphism or blur, glowing or coloured shadows, purple or bright blue accents, oversized rounded cards in a grid of identical icon tiles, decorative illustrations, hero banners, marketing filler such as "Welcome back!" or "Supercharge your...", and lorem ipsum. Real content or fixtures only.
3. **Use the frameworks below. Do not hand-roll what they provide.** No other component libraries (no MUI, Chakra, Bootstrap, Ant), no CSS-in-JS.
4. **Only the tokens in this file.** No raw hex values, arbitrary pixel sizes or one-off shadows in components. If a token is missing, add it here first.
5. **Light theme only.** Bone is the page background. There is no dark mode in this version.
6. **Never use colour alone to carry meaning.** Every status also has text, and every chart series has a label.
7. **Plain copy.** Sentence case. No exclamation marks. Never write fraud, theft, stealing, dishonest or guilty. Say flagged, held, review, pattern. Explain findings so someone with no finance training understands them.

## Stack

| Concern | Use |
|---|---|
| Framework | Next.js 15 App Router, React, TypeScript strict |
| Styling | Tailwind CSS with the tokens below defined once in `@theme` in `globals.css` |
| Components | shadcn/ui, built on Radix primitives, restyled to these tokens. Add components with the shadcn CLI, do not copy from elsewhere |
| Tables | TanStack Table for every sortable or filterable table |
| Forms | react-hook-form with zod resolvers, the same zod schemas the API uses |
| Charts | Recharts |
| Icons | lucide-react, 16px, stroke width 1.5. 20px only for empty states |
| Fonts | `next/font/google`: Newsreader, IBM Plex Sans, IBM Plex Mono. No other fonts, no CDN font links |
| Dates and money | `Intl.DateTimeFormat` and `Intl.NumberFormat` at the edge. Money is stored as integer cents |
| Toasts | sonner, used only to confirm an action that has no other visible result |

## Logo

The mark is a lowercase serif wordmark: **audit**, a copper dot, **x**.

- Render it at **24px height** in the app header, left aligned. Use the `Logo` component, built as text in Newsreader so it stays sharp: "audit" in Ink Black, "." in Burnished Copper, "x" in Slate Blue.
- Do not recolour, stretch, outline, add effects, or place it on any background other than Bone or Surface.
- Keep clear space equal to the height of the "x" on every side.
- The PNG in `brand/` is the reference for the artwork and for the social image and favicon only. Do not use it in the interface.

## Colour

The palette is called Private Capital: assured, selective, composed. Five colours, plus derived tints of the same colours. Nothing else.

| Token | Hex | Role |
|---|---|---|
| `ink` | `#171A1D` | Primary text, headings, the strongest borders, primary button fill |
| `slate` | `#34495E` | Links, selected states, focus ring, primary chart series, info |
| `copper` | `#A86F43` | Accent for held and pending states, the logo dot, secondary chart series, large numerals |
| `bone` | `#F1EEE7` | Page background |
| `sage` | `#7E8D7A` | Cleared, approved and released states, tertiary chart series |

Derived tokens, all defined from the above:

| Token | Value | Use |
|---|---|---|
| `surface` | `#FAF8F4` | Cards, tables, inputs, popovers, dialogs. Lighter than Bone |
| `line` | Ink at 14% opacity | All 1px borders and dividers |
| `line-strong` | Ink at 28% opacity | Input borders, table header underline |
| `ink-muted` | `#575A5C` | Secondary text |
| `copper-text` | `#8A5A34` | Copper when it is text |
| `sage-text` | `#56634F` | Sage when it is text |
| `copper-tint` | Copper at 14% over Surface | Background of held and pending badges |
| `sage-tint` | Sage at 16% over Surface | Background of cleared badges |
| `slate-tint` | Slate at 10% over Surface | Selected row, hover on slate elements |
| `error` | `#9B3D33` | Form validation errors and destructive confirmations only |

The `error` colour is a functional addition because the brand palette has nothing that reads as a problem. Use it only for validation and destructive confirmations. Held and flagged items use copper, never `error`, because a hold is a pause and not a verdict.

### Contrast, measured against Bone

| Colour | Ratio | Use as text |
|---|---|---|
| ink | 15.1 | Yes |
| ink-muted | 6.0 | Yes |
| slate | 8.0 | Yes |
| copper-text | 5.0 | Yes |
| sage-text | 5.5 | Yes |
| error | 5.8 | Yes |
| copper | 3.6 | **No.** Icons, borders, large numerals (24px and up) and fills only |
| sage | 3.0 | **No.** Fills, borders and chart marks only |

Never put copper or sage text at 14px or 12px. Use `copper-text` and `sage-text`.

### Status mapping

| Meaning | Treatment |
|---|---|
| Cleared, approved, released, reimbursed | `sage-tint` background, `sage-text` label |
| Held, pending review, case open | `copper-tint` background, `copper-text` label |
| Severity IMMEDIATE_HOLD | `copper` fill, Bone text, 12px semibold |
| Severity CASE | `copper-tint` background, `copper-text` label, 1px `copper` border |
| Severity NOTE | `line` border, `ink-muted` label |
| Reviewed, no action taken | `line` border, `ink-muted` label |
| Selected, active navigation, links | `slate` |

Every badge carries a text label. Badges are 12px, semibold, 22px tall, 6px radius, no icon required.

### Charts

Series order is fixed: `slate`, `copper`, `sage`, `ink`. Lines are 2px, no gradient fills, area fills at 18% opacity. Gridlines use `line`, horizontal only. Axis text is 12px `ink-muted`. Each series is labelled directly or in a legend with text, and every chart has a title that states the question it answers. Tooltips use the `surface` style with a `line` border.

## Typography

| Role | Font | Size / line height | Weight |
|---|---|---|---|
| Logo | Newsreader | 24px | 500 |
| Page heading | Newsreader | 30px / 36px | 500 |
| Section heading | Newsreader | 20px / 28px | 500 |
| Card or dialog title | IBM Plex Sans | 16px / 24px | 600 |
| **Base UI text** | IBM Plex Sans | **14px / 20px** | 400 |
| Emphasis and table headers | IBM Plex Sans | 14px / 20px | 600 |
| **Secondary text** | IBM Plex Sans | **12px / 16px** | 400, `ink-muted` |
| Large figure (score, amount at risk) | IBM Plex Sans | 24px or 30px, tabular figures | 600 |
| Ids, hashes, rule ids, evidence values | IBM Plex Mono | 12px / 16px | 400 |

- Body text is 14px. Nothing readable is smaller than 12px.
- Turn on tabular figures for every number in a table, badge or chart (`font-variant-numeric: tabular-nums`).
- Right-align numeric columns. Show money with two decimals and a thousands separator, for example `$3,200.00`.
- Show rule ids such as `TS_LOCATION_CONFLICT` in the mono style, so they read as identifiers.
- Line length is at most 72 characters for prose.

## Layout and density

The product is compact and professional. It is used in short sittings by people who are not analysts, so density serves scanning and never decoration.

- **Grid:** 4px base. Use 4, 8, 12, 16, 24, 32, 48.
- **App header:** 56px tall, Surface background, 1px `line` bottom border. Logo left, navigation next to it, notification bell and user menu right.
- **Page container:** 24px side padding. Maximum width 1200px for admin, 960px for the employee area, 400px for a sign-in or sign-up card.
- **Page heading block:** 30px heading, optional 12px secondary line beneath it, 24px below before content.
- **Tables:** 40px rows, 14px text, sticky header with `line-strong` underline, hover and selected rows use `slate-tint`. Column headers are sortable buttons with a visible arrow and `aria-sort`.
- **Cards:** Surface background, 1px `line` border, 8px radius, 16px or 24px padding. No shadow.
- **Buttons and inputs:** 36px tall (32px in dense toolbars), 6px radius, 14px text. Primary button is Ink fill with Bone text. Secondary is Surface with a `line-strong` border. Destructive is `error` fill and appears only in a confirmation step.
- **Inputs:** Surface fill, 1px `line-strong` border, label above at 14px semibold, help text at 12px, error text at 12px in `error` beneath the field with the border switched to `error`.
- **Focus:** 2px `slate` ring with 2px offset, on every interactive element. Never remove it.
- **Shadows:** none, except popovers, menus and dialogs, which use one shadow: `0 4px 16px rgba(23,26,29,0.12)`.
- **Radius:** 6px controls, 8px cards and dialogs, none on tables.
- **Breakpoints:** design for 1280px first, and confirm nothing breaks at 375px. The employee area must be fully usable on a phone, since receipts are photographed on one.

## Motion

- 150ms ease-out for hover, focus and menu changes. Nothing bounces, floats or pulses.
- The one expressive animation is the score number counting from its old value to its new value on a case decision, 600ms.
- Honour `prefers-reduced-motion`: replace the count with an instant change.

## Grounded answers

Used for "Ask about this finding" and "Ask a question about this case". It is a plain form and an answer, never a chatbot.

- A single 14px textarea, 500 character limit with a 12px counter, and one secondary button labelled "Ask". No avatar, no message bubbles, no typing indicator, no history.
- The answer is 14px prose in a Surface block with a 1px `line` border and 16px padding, two or three sentences.
- Sources sit beneath it as a row of 12px mono labels with a `line` border, for example `Rule TS_LOCATION_CONFLICT` and `Travel policy, section 2`. No sources means no source row, and the answer says the material does not cover it.
- A fixed 12px `ink-muted` line closes the block: "A reviewer makes the decision. Current status: Pending review."
- When the answer came from the fallback, show a `line`-bordered label reading "Prepared without the assistant" above the answer.
- Loading is a two-line skeleton. Errors say what happened and offer to try again.
- The block is collapsed by default wherever it sits next to a decision.

## States every screen must have

Loading (a skeleton in `line` and Surface tones, not a spinner over a blank page), empty (one plain sentence and the next action, for example "No cases are waiting. New flags will appear here."), error (what happened and what to do, in plain words), and success. A screen missing any of these is not done.

## Accessibility

- WCAG 2.2 AA. Contrast is already worked out in the table above.
- Every control reachable and operable by keyboard. Visible focus.
- Labels on every field. Tables use real table elements with header cells. Charts have a text summary or a data table alternative.
- Touch targets at least 40px on the employee area.

## Review checklist

Before marking a section done, confirm:

- [ ] No emoji anywhere
- [ ] No hex values, pixel sizes or shadows outside the tokens here
- [ ] Text sizes are only 12, 14, 16, 20, 24 or 30
- [ ] Copper and sage are never used as small text
- [ ] Every status has a text label
- [ ] Loading, empty, error and success states exist
- [ ] Usable by keyboard, with visible focus
- [ ] Checked at 1280px and 375px
- [ ] Nothing on the banned list in "Hard rules"

## Tokens for `globals.css`

The auth stream installs this in section 1. Everyone else consumes it.

```css
@import "tailwindcss";

@theme {
  --color-ink: #171a1d;
  --color-slate: #34495e;
  --color-copper: #a86f43;
  --color-bone: #f1eee7;
  --color-sage: #7e8d7a;

  --color-surface: #faf8f4;
  --color-line: rgb(23 26 29 / 0.14);
  --color-line-strong: rgb(23 26 29 / 0.28);
  --color-ink-muted: #575a5c;
  --color-copper-text: #8a5a34;
  --color-sage-text: #56634f;
  --color-copper-tint: rgb(168 111 67 / 0.14);
  --color-sage-tint: rgb(126 141 122 / 0.16);
  --color-slate-tint: rgb(52 73 94 / 0.1);
  --color-error: #9b3d33;

  --font-serif: var(--font-newsreader), Georgia, serif;
  --font-sans: var(--font-plex-sans), system-ui, sans-serif;
  --font-mono: var(--font-plex-mono), ui-monospace, monospace;

  --text-xs: 12px;
  --text-xs--line-height: 16px;
  --text-sm: 14px;
  --text-sm--line-height: 20px;
  --text-base: 16px;
  --text-base--line-height: 24px;
  --text-xl: 20px;
  --text-xl--line-height: 28px;
  --text-2xl: 24px;
  --text-2xl--line-height: 32px;
  --text-3xl: 30px;
  --text-3xl--line-height: 36px;

  --radius-control: 6px;
  --radius-card: 8px;
  --shadow-overlay: 0 4px 16px rgb(23 26 29 / 0.12);
}

body {
  background: var(--color-bone);
  color: var(--color-ink);
  font-family: var(--font-sans);
  font-size: 14px;
  line-height: 20px;
}
```
