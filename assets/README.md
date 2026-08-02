# SNAP art assets

Everything the rank emblems and the app icon are generated from.

```
npm run emblem-ref      renders assets/ref/plate-icon-ref.png — the plate shape
   ↓  generate a tier sheet, save it to assets/sheets/<tier>.png (or .jpg)
npm run emblem-slice    writes public/ranks/*.png — the 16 rank emblems
npm run emblem-preview  writes assets/preview/ladder.png + sizes.png — look at these
npm run build-icon      writes every app-icon variant from assets/sheets/icon.png
```

`assets/sheets/` holds the raw model output and is the only thing here that cannot be
reproduced by running a script — keep it. Earlier abandoned directions are in
`assets/sheets/archive/`.

Always regenerate the previews after slicing. `ladder.png` shows every rank at hero size
on the real card background; `sizes.png` shows all of them at 24 / 36 / 56 / 112px.
Judging cut-out art on a white page tells you nothing about how it will look in the app.

**The 24 and 36px sizes do not use this art.** Five of the eight places the emblem appears
are that small, where detailed art is an unreadable smudge. Those sizes render the
chamfered brand plate in the tier accent, drawn in CSS — see `src/ui/RankEmblem.tsx`. The
generated art appears at 56px and 112px only.

---

## The system

**One shape, escalating structure.** Every rank is built on the same chamfered plate —
a square with its top-left and bottom-right corners cut at 45°, the shape of the app's
logo. It never changes, at any rank. Repeating it sixteen times is what makes the set read
as one thing, and it ties the emblems back to the wordmark.

What changes as you climb is **how much is built around that plate**.

| Tier | Accent | Structure around the plate |
| --- | --- | --- |
| Bronze | `#a9663c` | Almost nothing. The bare plate. |
| Silver | `#9fb0c4` | A first separate piece — an outer frame, a base, or a pair of supports. |
| Gold | `#f0b429` | More: the surround becomes deliberate and designed. |
| Platinum | `#5fc4b8` | Substantial structure. The plate is clearly held by something. |
| Diamond | `#8aacf5` | Elaborate — layered, built up, unmistakably rare. |
| Legend | `#f4f1ea` | The full assembly, grown SIDEWAYS not taller, with gold, teal and ice-blue accents drawn from the tiers below. |

Legend is one emblem; every other tier is three.

**Style — the logo's.** `assets/sheets/icon.png` defines it: flat and graphic rather than
photographic. A thin keyline inset just inside the outer edge, a very shallow bevel, two
or three tones, bold and high-contrast. No rendered metal, no fine texture, no dense
ornament. **This stays equally simple at every rank.** Legend is more *built*, not more
*detailed*.

**The mark is engraved, not printed.** Flat rendering makes it very easy for a model to
lay the mark on the plate like a decal. It must read as cut into the surface, which means
the shading inverts — shadow along the top and left inner walls of the cut, highlight
along the bottom and right, the recessed face a shade darker than the plate around it.
Achieved with two or three flat tone steps and hard edges, never soft gradients.

**Each tier's audio motif is assigned, not left open.** Telling the model to "use a
different idea from the attached tier" does not work — the reference image is a far
stronger signal than the sentence, and Gold came back with Silver's bars twice. Name the
motif explicitly instead, and name the previous one as forbidden.

| Tier | Motif engraved in the plate | Shape family | Counts by |
| --- | --- | --- | --- |
| Bronze | Waveform peaks | horizontal, spiky | tall peaks: 1, 2, 3 |
| Silver | Level-meter bars | vertical, stacked | bars: 1, 2, 3 |
| Gold | Concentric grooves, like a record | circular, closed | rings: 1, 2, 3 |
| Platinum | Tuning forks | object silhouette | forks: 1, 2, 3 |
| Diamond | Sound arcs rising from a struck point | radial, open | arcs: 1, 2, 3 |
| Legend | A single struck point, everything radiating from it | burst | n/a — one emblem |

**Motifs must differ by SHAPE FAMILY, not just by name.** "Struck strings" and
"level-meter bars" are both vertical elements side by side, so Gold came back looking like
Silver twice despite being told to differ. Pick a family the neighbouring tiers do not use,
and forbid the previous tier's family explicitly — "no vertical bars or lines of any kind"
works where "use a different idea" does not.

**Division is counted, not implied.** One prominent element in the first emblem, two in
the second, three in the third, with any smaller detail clearly subordinate. Bronze does
this with tall waveform peaks amid smaller ones. The count has to live in a *dominant*
element — if it lives in overall density it reads as texture and vanishes by 56px.

**Everything ascends left to right, and nothing wanders.** The most common failure is a
row where the most impressive emblem lands in the middle, or where the mark grows but the
structure shrinks. Every aspect — engraving, structure, mass — must move the same way
across the three. Accumulate the design rather than varying it: whatever the middle emblem
has, the right one has too, plus more.

**The ladder never dips.** A tier's first emblem must outrank the previous tier's third.
Sixteen ranks, one continuous climb.

**Height is the scarce dimension.** Emblems are sized by their plate and render at their
natural proportions, so structure stacked above and below makes them taller — Diamond III
already renders 1.75x Bronze's height in the same slot. The two places the art appears are
flex rows that simply grow, but there is a limit before the Standing card and profile
header look stretched for high-ranked players. Legend must therefore build OUTWARD rather
than upward: wider is free, taller is not.

**Colour.** The plate body carries the tier accent; the mark inside contrasts strongly
against it. Two or three tones total. The tier colour must be recognisable instantly,
because it is how the app colour-codes rank everywhere else.

**Legend is the exception.** Its plate stays bone white — it is still the colourless rank —
but its structure carries gold `#f0b429`, teal `#5fc4b8` and ice blue `#8aacf5`, the accents
of Gold, Platinum and Diamond. Legend contains the ladder beneath it. Pure white was tried
and read as flat and washed out: four pale tiers in a row, with no internal contrast and
nothing separating it from Diamond.

---

## Generating

**Model: Gemini 3 Pro Image (Nano Banana Pro).** Bronze is generated cold. Every tier
after it attaches the approved sheet from the tier below, which carries the plate, the
style and the quality bar all at once.

```
bronze    ref/plate-icon-ref.png + sheets/icon.png
silver    attach bronze     →  gold      attach silver
platinum  attach gold       →  diamond   attach platinum
legend    attach diamond
```

PNG is better than JPEG if the generator offers it — the slicer accepts both, but JPEG
compresses hardest at high-contrast edges, which is every emblem outline against magenta.

### The chained prompt

Substitute the tier, its position, its brief line and its accent.

```
The attached image shows the <<PREVIOUS TIER>> rank emblems from SNAP, a competitive music
game where you hear one second of a song and have to name it before your opponent does.

<<PREVIOUS TIER>> is tier <<N-1>> of 6. Design the next rank up: <<TIER>>, tier <<N>> of 6.

<<TIER BRIEF>>

KEEP THESE EXACTLY AS THEY ARE:
  - The chamfered plate at the core. Same shape, same size, same proportion. It is the
    same plate at every rank in this game and it never changes.
  - The drawing style: flat and graphic, a thin inset keyline, a very shallow bevel, two
    or three tones, no photographic metal and no fine texture.
  - That the emblem is unmistakably about sound.

CHANGE THIS, AND ONLY THIS: how much structure is built AROUND the plate. <<TIER>> must
obviously outrank the attached one because more has been built around its plate.

STRUCTURE MEANS A SEPARATE PIECE, NOT A THICKER EDGE. A wider border, a doubled keyline or
a deeper bevel on the plate itself do NOT count — those are the same object with a heavier
outline, and they will not read as a promotion. What counts is a distinct part that a
viewer could point at and name: an outer frame standing off the plate, a base or plinth
the plate sits on, supports or wings either side, a second plate layered behind it, a
crowning element above. Something ATTACHED TO the plate rather than part of it.

The plate itself never grows or changes. Everything new sits around it.

Do NOT escalate by adding fine detail, texture or ornament. The drawing stays exactly as
simple and clean as the attached one no matter how high the rank goes. What grows is the
amount of structure, not the amount of detail.

THE MUSIC MARK INSIDE THE PLATE MUST BE A DIFFERENT IDEA from the attached tier's. Every
rank in this game has its own audio motif — do not simply redraw the one you were shown in
a new colour. If the attached tier uses a waveform, use something else: grooves, frequency
bars, a struck string, a resonance pattern, the anatomy of an instrument. It must stay
bold and simple enough to read at 56 pixels tall.

THE THREE MUST ASCEND, LEFT TO RIGHT. This is the most important thing about the layout.
The left emblem is the least impressive, the middle clearly more so, the right the most.

That ordering has to hold for EVERY part of the design at once, in the same direction:
  - the engraved mark — simplest on the left, richest on the right
  - the structure around the plate — least on the left, most on the right

Nothing may be larger, denser or more elaborate on an earlier emblem than on a later one.
If you give the middle emblem a feature, the right emblem must have that feature and more.
Do not vary the design across the three; ACCUMULATE it. Someone glancing at the row should
see one thing growing, not three different takes.

The counting device rides along with that: one prominent element in the mark of the left
emblem, two in the middle, three on the right, with any smaller detail clearly subordinate.

Your left emblem must still clearly outrank the RIGHT emblem of the attached tier — the
ladder never dips between tiers either.

THE MARK IS CUT INTO THE PLATE, NOT PRINTED ON IT. It must read as engraved — stamped down
into the surface, so you could run a finger across the plate and feel the groove. Under a
light from directly above the shading INVERTS compared to a raised element:
  - a shadow along the TOP and LEFT inner walls of the cut
  - a highlight catching along the BOTTOM and RIGHT inner walls
  - the recessed face itself a shade darker than the plate surface around it
  - the plate reading as one continuous surface the mark has been subtracted from
Do all of that with two or three flat tone steps and hard edges — no soft gradients, no
blur. It must NOT look like a flat graphic or decal laid on top of the plate.

COLOUR: the plate body is <<ACCENT>>, with the mark inside contrasting strongly against
it. Two or three tones total. It must read as clearly different from the attached tier.

FIVE TECHNICAL RULES — these exist because the emblems get cut out and placed into a user
interface, and breaking any of them makes the asset unusable:

  1. BACKGROUND: flat, solid, edge-to-edge pure magenta #FF00FF. Every pixel that is not
     part of an emblem must be exactly that magenta. No shadow, no glow, no reflection,
     no light spill, no vignette, no gradient.
  2. LAYOUT: three emblems in a row, evenly spaced, not touching each other or the edges.
  3. VIEW: dead-on frontal and orthographic. No perspective, tilt or rotation.
  4. FOOTPRINT: all three roughly the same size, no more than about 1.3x wider than tall.
  5. NO TEXT: no letters, numbers, Roman numerals or musical notation symbols.
```

**Legend** is a single emblem: drop the counting-device paragraph, and rule 2 becomes
"a single emblem centred on the magenta".

---

## The app icon

The icon shares the plate but is not on the ladder — it is the brand mark. Generated on
magenta and cut out like everything else, then `npm run build-icon` produces every
variant: the favicon, the iOS icon, the PWA icons, the maskable icon, and the transparent
mark the sidebar wordmark uses.

Attach `assets/ref/plate-icon-ref.png`.

```
A single app icon shape, centred on a flat solid edge-to-edge pure magenta #FF00FF
background.

THE OUTER SHAPE IS FIXED. Match the attached reference exactly: a square plate whose
top-left and bottom-right corners are cut off at 45 degrees, with the other two corners
left perfectly sharp. This asymmetric chamfer is the logo of the app and must not change
— not the angle, not the proportion, not which corners are cut.

INSIDE THE PLATE: a bold music mark. This app is called SNAP — you hear one second of a
song and have to name it before your opponent does. The mark should say sound: a struck
waveform spike, a few frequency bars, a single amplitude peak, a groove — your choice.
It must be simple, heavy and high-contrast against the plate.

THE SIZE RULE, which matters more than anything else: this icon is displayed as small as
16 pixels wide. The mark inside must still be readable there. That means ONE strong shape
with thick strokes and generous spacing — no fine lines, no small repeated elements, no
delicate detail. If in doubt, make it bolder and simpler.

STYLE: sleek and modern — a crisp keyline around the forms, clean confident shading, a
subtle chamfered bevel catching light from directly above. Dimensional but restrained.
Dead-on frontal orthographic view, no perspective or tilt.

COLOUR: bone-white plate #f4f1ea. The music mark inside may use a single accent colour if
it makes the icon stronger — warm gold #f0b429 is the app's accent — or stay white.

TECHNICAL RULES — the plate gets cut out of the magenta, so these are not optional:
  1. The background must be flat, uniform, edge-to-edge #FF00FF.
  2. No drop shadow, cast shadow, glow, bloom, reflection or light spill onto the
     background. Nothing outside the plate's own outline.
  3. Dead-on frontal orthographic view. No perspective, tilt or rotation.
  4. The plate must not touch the edges of the image.
  5. No text, letters, numbers or musical notation symbols.
  6. No outer border, no rounded container, no squircle mask, no circular badge behind
     the plate.
```

Check the result at 16px before accepting it. That is the only test that matters here.

---

## If the model fights you

- **The mark looks pasted on rather than engraved.** The most likely failure in a flat
  style. Re-send with: *"The mark is stamped INTO the plate. Under a light from above an
  engraving shadows along its top and left inner walls and catches light along its bottom
  and right — the opposite of a raised shape. Right now it reads as a flat decal."*
- **Shadow or glow on the magenta.** The one failure that breaks the pipeline rather than
  just looking wrong — `emblem-slice` keys on magenta, so anything bleeding onto the
  background survives the cutout as a grey halo. Check the corners before saving.
- **A tilted or three-quarter view.** Fatal for UI use, and sixteen differently-angled
  emblems cannot sit in the same box. Ask for "perfectly flat-on front view, like a
  scanned object."
- **The plate changed size or proportion.** Breaks the whole system. Say: *"The chamfered
  plate must be identical in shape, size and proportion to the attached one. Only what
  surrounds it may change."*
- **Escalation came as detail rather than structure.** Say: *"Keep the drawing exactly as
  simple. Add more built structure around the plate instead of more detail within it."*
- **"Structure" arrived as a thicker border.** The most common misreading. Say: *"A wider
  or doubled border is not structure — it is the same object with a heavier outline. Add a
  separate piece: a frame standing off the plate, a base it sits on, supports at its
  sides. Something a viewer could point at and name as a distinct part."*
- **The mark reads as something other than sound.** Diamond's arcs came back looking like
  a wifi symbol because they floated above their struck point instead of springing from it.
  Whatever the motif, anchor it: the element it radiates from must touch it.
- **The count is unreadable.** Say: *"The counting element must be the most prominent thing
  in the mark — one, then two, then three, with everything else clearly smaller."*
- **Emblems touching or merging.** `emblem-slice` throws rather than guessing. Ask for
  "clear magenta space between them, at least a third of an emblem's width."
