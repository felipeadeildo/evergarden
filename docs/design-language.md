# Design language

evergarden should feel like reading a letter someone wrote carefully for you, with a second reader's notes in the margin. The page belongs to the text; the interface steps back until you select something.

The name comes from Violet Evergarden, who writes letters on other people's behalf and rewrites them until they say what the person meant. The palette borrows from her: the Prussian blue of her coat for the interface, and the emerald of her brooch for everything a reviewer adds.

## Colour

| Token      | Light     | Dark      | Use                                                         |
| ---------- | --------- | --------- | ----------------------------------------------------------- |
| `paper`    | `#F6F5F0` | `#10151E` | Page background                                             |
| `sheet`    | `#ECEBE4` | `#171E2A` | Open notes, sheets, the selection bar                       |
| `rule`     | `#D8D6CC` | `#2A3344` | Borders and separators, used sparingly                      |
| `ink`      | `#1C2230` | `#E7E5DD` | Text. A blue-black, like fountain pen ink, never pure black |
| `ink-soft` | `#5B6172` | `#9AA1B2` | Secondary text: folders, dates, authors                     |
| `prussian` | `#23395B` | `#93B1DF` | Links, primary actions, focus rings                         |
| `emerald`  | `#0D7A5A` | `#4CC598` | Reviewer marks: highlights, pins, notes, inserted words     |
| `alizarin` | `#A3243B` | `#E07A8B` | Removed words in a suggestion, destructive actions          |
| `ochre`    | `#8A5B12` | `#D9A85A` | Warning callouts, strings in code                           |

Emerald appears only where a person has marked the text. The page is otherwise blue-black on paper, so a reviewed document visibly carries its notes.

## Type

| Face                                    | Role                                    | Licence                                                                                                                     |
| --------------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `local("Michelangelus")`, then Literata | Everything: body, headings, interface   | Michelangelus may not be served as a webfont, so readers who have it installed see it and everyone else sees Literata (OFL) |
| Paper Mono                              | Code, ASCII figures, document ids, keys | OFL                                                                                                                         |

There is no sans-serif. Literata was drawn for long reading on screens and has an optical size axis, so the same family holds a 13 px button label and a 40 px title. Paper Mono appears only where the content really is code or an identifier.

Code uses the same palette: keywords and tags in `prussian`, strings in `ochre`, numbers in `alizarin`, comments in italic `ink-soft`, function names in a heavier weight. Diagrams take `paper`, `sheet` and `ink` for their shapes and lines, and `prussian`, `ochre` and `alizarin` first among their series colours, so a chart reads as part of the page.

Body text is 19 px on desktop and 17.5 px on phones, line height 1.6, at most 66 characters per line. Headings step by about 1.25 (32, 24, 19.5 px), weight 600, set with `text-wrap: balance`. Paragraphs use `text-wrap: pretty`. Numbers in tables use tabular figures.

## Layout

```
Desktop, 1200 px and wider
┌──────────────┬───────────────────────────────┬──────────────────┐
│ contents     │  AWS costs, November          │                  │
│              │  Updated 2 hours ago by pi    │                  │
│ ▸ Summary    │                               │                  │
│ ▸ Compute    │  EC2 was 41% of the bill…     │                  │
│ ▸ Transfer   │  Data transfer is the second ─┼─ Is this NAT     │
│              │  biggest line item.           │  gateway traffic?│
│              │                               │  felipe          │
│              │  ┌─ traffic flow ──────────┐  │                  │
│              │  │            ③            │──┼─ ③ This should   │
│              │  └─────────────────────────┘  │  go to S3.       │
└──────────────┴───────────────────────────────┴──────────────────┘

Phone
┌─────────────────────────┐
│ ‹  AWS costs, Nov…    ⋯ │
│                         │
│ AWS costs, November     │
│                         │
│ Data transfer is the    │
│ second biggest line     │
│ item.                   │
│ ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔ ●   │
│                         │
│                    3 ◉  │
└─────────────────────────┘
```

Text is left aligned, never justified: justified text on narrow phone columns opens rivers between words.

## The one memorable thing

The margin notes. Everything about a comment happens in the margin; nothing floats over the text.

- A closed comment is one line in the right margin at the height of its passage, in Literata italic and emerald, with the author's name under it in `ink-soft` and a hairline rule on its left. Notes on the same line of text touch, so their rules join and read as one group.
- Hovering a closed note deepens its passage's highlight. Opening it lays the thread out on a `sheet` ground with an emerald rule, and an emerald leader runs from the end of the passage's first line, across the gutter, to the note. Where passages nest, the inner one's highlight sits darker inside the outer one.
- The note in focus stays level with its passage; only the notes in its way move, in 180 ms.
- Selecting text puts a manicule in the gutter, pointing at the selection. It starts a comment, as does `⌘⌥M`.
- Fields have no box: writing in a note looks like writing on it. Buttons are words (Comment, Reply, Accept in emerald; Cancel in `ink-soft`), and Reply appears only once there is a reply to send. Resolving is the check in the note's corner.
- Pins on figures are small emerald numerals in a circle, matching the numeral on their note.
- Notes have no bubbles or avatars. Everything else on the page stays quiet.

On a phone the margin becomes a sheet that rises to half the screen, so the passage stays visible above the note, and `‹ ›` in the sheet walk through the comments while the text scrolls along.

## Brand

The mark is a manicule, the pointing hand that readers drew in book margins to point at a passage. It is the glyph U+261E from Noto Sans Symbols 2, used under the SIL Open Font License, drawn in `prussian`. Commenting on a passage is what evergarden is for, and Violet Evergarden's own hands are mechanical, so the hand ties the name to the product.

| File                                                          | What it is                                                                                                               |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `public/favicon.svg`                                          | The hand alone, with a thicker stroke so it reads at 16 px; light blue in the dark theme                                 |
| `public/icon.svg`                                             | The app icon: the hand pointing at the emerald line among three, on paper, inside the safe zone of iOS and Android masks |
| `public/apple-touch-icon.png`, `icon-192.png`, `icon-512.png` | Rendered from `icon.svg`                                                                                                 |
| `brand/banner.html`                                           | The README banner and the link preview: a real passage, marked and answered in the margin                                |
| `brand/banner.png`, `public/og.png`                           | Rendered from `banner.html` at 1280 × 640 and 1200 × 630                                                                 |

The wordmark is the hand followed by "evergarden" in Literata italic, as in the top bar (`src/components/ui/wordmark.tsx`). After changing `icon.svg` or `banner.html`, run `bun scripts/brand.ts` to render the PNGs again.

## Icons

Phosphor, regular weight, at 1.15 times the size of the text beside them and in its colour. An icon always comes with words: next to a label, or as the only visible content of a phone toolbar button whose label stays readable by screen readers. Callouts get one icon per kind (note, tip, important, warning, caution); documents, folders and linked repositories get theirs in the library.

## Motion

Motion only answers an action: a sheet sliding up, a note appearing beside its passage, a highlight settling after a selection. Durations stay between 150 and 220 ms, animating only `transform` and `opacity`. Nothing moves on load or on scroll, and `prefers-reduced-motion` turns transitions into instant changes.

## Words

The interface uses plain verbs, sentence case, and the same word for an action from button to confirmation: **Resolve** produces "Resolved". Errors say what happened and what to do next. Empty states invite the next action ("No documents yet. Publish one from your agent with `publish`.").

## Choices checked against the usual defaults

Generated interfaces tend to land on a cream background, a serif display face, and a terracotta accent. This brief asked for paper and serif, so those stay, and the rest moves away from the default:

- The accents come from the subject (Prussian blue, emerald) rather than a warm clay.
- The paper is a neutral off-white (`#F6F5F0`), not a yellowed cream.
- No all-caps labels, no labels above headings, no middle-dot metadata strings in the interface chrome.
- Monospace only for real identifiers, never as decoration for small labels.
- One column of text with a wide margin, not a newspaper grid of hairline-ruled columns.

## Quality floor

Every screen meets the [Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines): visible `:focus-visible` rings in `prussian`, labels on every control, `aria-label` on icon buttons, `env(safe-area-inset-*)` on the selection bar and sheets, `overscroll-behavior: contain` on sheets, `touch-action: manipulation`, `color-scheme` and `theme-color` matching the page, `Intl` for dates and numbers, and state that matters (the version, the open comment) kept in the URL.
