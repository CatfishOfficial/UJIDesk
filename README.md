# UJI Workspace: web interface prototype

A whiteboard math workspace: floating, reusable tools you pull out of a backpack, eleven problem instruments that do real, exact math (with Lesson mode and practice for each), three practice calculators, saved desks, and a little science. Optional delight is kept small and out of the way.

> The math is clean. The teaching feels human. Never hold the answer hostage.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # engine tests (Vitest): math, science, calculators, desks, da Ship
npm run build      # type-check + production build into dist/
```

Everything is saved to `localStorage` first (the live board under `uji.workspace`, saved desks under `uji.desks`), so UJI works without an account. Optional email-and-password accounts (Supabase, for students 13 and up) back it all up and sync it between devices; see *Accounts* below. The one server-side piece is `api/recognize.ts` (a Vercel serverless function) for reading photos of problems — it needs `OPENAI_API_KEY` set on the host; without it, everything still works except that one reader, which just fails over to typing the problem in by hand. `npm run dev` alone won't exercise it (no function runtime) — use `vercel dev`, or test against a deployed preview.

Shortcuts: **Ctrl/⌘ K** opens Math tools search in the backpack · **Ctrl/⌘ B** toggles the backpack · **Esc** closes the backpack or leaves Draw mode · window title bars take **arrow keys** to move and **Shift+arrows** to resize · with the backpack button focused, **arrow keys** hop it between corners.

## What works

| Area | Status |
| --- | --- |
| Whiteboard with a single **backpack button** (just the backpack, no frame) as the only chrome: drag it anywhere and it snaps to the nearest edge (pulling into corners); position persists. A dot means "what next?", a number means tucked-away windows | Working |
| Floating windows: drag, resize (8 handles), focus/z-order, minimize, maximize, close, keyboard move/resize, smart placement, viewport clamping, persistence | Working |
| **Window arrangement** (Settings → Workspace → Window arrangement, all off by default): snap to a 12/24/48px grid (the board's dots move onto the snap points), snap to other windows (edges line up; side by side keeps a 12px gap; screen edges too), and periwinkle alignment guides while dragging or resizing. Works for windows and desk items, for moving, resizing and arrow-key nudges. Hold **Alt** to place freely. **Right-click the whiteboard** for Tidy up (rows in reading order, no overlaps, shrinking only if needed, with Undo) and quick toggles | Working |
| Close vs. clear: closing a window is quiet (no pop-up); one with content is kept under "On your desk → closed" in the bag to reopen. Clearing a page is a separate action with its own undo. Messages (toasts) follow light/dark | Working |
| Backpack = the whole menu. A top icon bar switches between the bag itself, Math tools, Desks, My stuff, Settings and the Arcade, and launches Challenge and Trip on da Ship, with the pen on the right. The bag opens toward the screen centre from wherever the button is. **A "type a problem" field** detects the tool ("x² − 5x + 6 = 0", "2x + 3y = 12, x − y = 1", "mean of 3, 7, 9", "legs 5 and 12", "angle 35°, hypotenuse 10", "3, 7, 11, …"), or you pick one. Click-to-place **and drag-to-place**, Cheat ↔ Lesson switch (no Challenge), tucked-away and recently closed windows, never consumed | Working |
| First visit opens the backpack once; after that every session starts on a blank board | Working |
| **Bring in a problem from a photo**: camera capture, file upload, clipboard paste (button or Ctrl+V anywhere in a problem tool), or type/paste text. A reader (OpenAI, via the `api/recognize` serverless function — never the browser directly, so the API key stays off the client) transcribes the problem as plain text and flags any characters it's unsure about; the student always sees the reading and can fix it before anything is solved. When it's confident which tool and exact field values match, it also offers to open that tool prefilled — re-checked against the real tool registry before it's trusted with anything, and always optional: "Let me check the text instead" falls back to the plain-text reading, which still goes through the same deterministic `detect.ts` router every typed problem does (including right triangles named by their corners, like "right angle at F, EF = 12, ∠E = 42°"). If nothing recognizes it, the import window asks which tool it's for instead of guessing. The AI only ever reads; it never solves anything itself. Requires `OPENAI_API_KEY` set on the host; real per-IP rate limiting (20 / 10 min) kicks in once a Redis database is connected under the project's Storage tab, and fails open (skipped, not enforced some weaker way) until then — see `.env.example` and `api/recognize.ts` | Working |
| **Standard → slope-intercept**: any linear equation (`2y = 4x + 6`, `½x + y = 3`, `3(x − 2) + y = 0`), exact fractions, vertical/horizontal/degenerate cases, steps, copy answer/work, graph it | Working |
| **Slope from two points**: fractions/decimals/negatives, vertical (undefined) and horizontal lines, same-point error, bonus line equation, graph with points | Working |
| **Point-slope form**: from a point and a slope (or "undefined") or from two points; tidy signs (y + 4 = −⅔(x + 1)), plus slope-intercept and standard form, graph with the points | Working |
| **Systems of equations**: substitution when an equation already says y = … (or has one variable), elimination otherwise (it picks the cheaper variable; Lesson lets you pick either); exact fractions, parallel lines (no solution) and the same line twice (infinitely many), a check step, both lines graphed with the intersection | Working |
| **Quadratic formula**: any quadratic typed any way (x² = 3x + 10, x^2/2 + x − 4 = 0, or a = 1, b = −5, c = 6); clears fractions, discriminant, exact simplified radicals (x = {−3 ± √41}/4, x = ±2√2), double roots, complex roots with i, decimals, vertex and axis; graphs the parabola with its roots and vertex | Working |
| **Factoring**: GCF first (numbers and powers of x, and a leading minus), then the quick monic method or the AC method with split-and-group shown step by step; perfect squares and differences of squares named; honest "prime over the integers" with a jump to the quadratic formula; add "= 0" to also get the solutions | Working |
| **Pythagorean theorem**: either leg or the hypotenuse, exact roots (√74, 5√2) and decimals, the longest-side check, or all three sides to test for a right triangle; a live diagram drawn to scale | Working |
| **Area & perimeter**: rectangle, square, triangle, parallelogram, trapezoid and circle (radius or diameter), with units; circles stay exact in π (25π cm² ≈ 78.54 cm²); the shape is drawn with your measurements on it | Working |
| **Right-triangle trig**: an angle and a side, or two sides; SOH CAH TOA picks the ratio, inverse trig finds angles, the Pythagorean theorem finds the third side; a labelled diagram, both acute angles | Working |
| **Mean, median, mode** (plus range): exact means (repeating ones shown rounded with the exact fraction alongside), even-count medians, ties for mode or no mode; a dot plot with the mean and median marked | Working |
| **Sequences & series**: arithmetic or geometric from three or more terms; common difference or ratio, the explicit formula, next term, any nth term, the sum of n terms, and the infinite sum when \|r\| < 1; a term strip showing the step | Working |
| Reusable instruments: Solve → Next problem keeps the previous answer visible, recent history, re-solve from history, edited-since-solved notice | Working |
| **Lesson mode** for every problem tool, built on the usual classroom arc: an intro (the goal, the big idea, words to know, the plan, common slip-ups, and a Khan Academy video for anyone who'd rather watch first), then one decision at a time with a short explanation before each question and the reason after each answer (so the finished lesson reads as a worked solution), then a wrap-up: what you did, how to check the answer, **Another like this** (a fresh problem of the same kind), **Try it on your own** (a Challenge set on the topic), and Khan Academy videos, articles and practice. Also: specific corrective feedback, equivalent approaches accepted (e.g. subtracting in the other order), progressive hints, "Show me this step", optional calculator helper opened beside the work | Working |
| Cheat ↔ Lesson preserves the problem, the result, and lesson progress; each worked step has a **why?** link into the matching lesson step | Working |
| **Challenge** (from the menu only): generated sets for any of the eleven topics, one topic per set (topic × difficulty × length), or bring your own problem of any recognised type (checked by the same solver), unlimited attempts, hints ending in the answer, skip with no penalty, modest **tokens** (10 for a first-try answer; your own problems earn none, so they can't be farmed), summary, then a subtle "What next?". **No cheating mid-set:** while a set is running (even minimized), both solvers show a "paused for practice" card, the bag's type-a-problem box disappears, and solver slots are paused. Calculator, graph paper, scratch paper and formulas stay usable. Closing a set ends it, with no undo | Working |
| Calculator: safe parser (no `eval`), keyboard + keypad, tape, exact fraction toggle, model picker using the shared inventory pattern | Working |
| **Graphing calculator** (practice model, unbranded): home screen with history, Ans and ENTRY, MODE (Normal/Sci, Float/Fix 0–9, Radian/Degree, Connected/Dot), Y= (seven functions), WINDOW, ZOOM (In, Out, ZDecimal, ZSquare, ZStandard, ZTrig), GRAPH on a 95 × 63 pixel screen, TRACE (arrows, jump to a typed X, ENTER re-centres), TABLE and TBLSET, MATH (▶Frac, ▶Dec, ³, ³√) and NUM (abs, iPart, fPart, int). It keeps the habits worth practising: radians by default, (−) is not −, an operator first means Ans, ERR:SYNTAX with Quit/Goto. Keys it doesn't model (STAT, APPS, VARS…) say so under the screen | Working |
| **Exam calculator**: a two-line scientific like the ones allowed on tests, with a stacked n/d fraction key (6 ÷ 1⁄2 = 12), answers kept as fractions until f◂▸d, its own (−) key, 2nd functions, degrees by default | Working |
| **Lesson key guides**: when a lesson step offers the calculator, it opens (or reuses) your calculator and lights up the keys to press on *that* model: (−) on the graphing and exam models, 2nd chords for √ and π, = vs ENTER. It warns when the calculator is in radians for a degrees problem, and offers a better model when yours can't do it | Working |
| **Desks** (saved workspaces): save the whole board (windows and their contents, ink, stickers, help style) as a named desk, switch between desks, start a fresh desk, rename, duplicate, delete with undo. Switching always keeps the board you leave, so nothing is lost. Each desk shows a little map of its windows | Working |
| Graph: `y = …`, `x = c`, and any linear equation; pan, wheel/pinch zoom, adaptive grid, multiple colored equations, points from the slope tool | Working |
| Scratchpad (type or sketch, multiple instances), sticky notes (multiple, 4 papers), formula sheet (searchable), timer/stopwatch (survives reload), ruler | Working |
| **Saved notes**: Save in a scratchpad keeps the whole page (text and sketches) as a named note (its first line, or "Doodle 3"); the toolbar shows which note a pad is and a dot for unsaved changes. The backpack's **Notes** tab is a searchable grid of miniatures drawn like the real page (lined paper, text wrapped where it was written, ink on top), with open (focusing a pad already showing it), rename, duplicate and delete with undo. Syncs with accounts once `supabase/migrations/0002_notes.sql` has run | Working |
| **Periodic table:** all 118 elements in the standard layout (f-block rows below), colored by category; search, highlight a category, arrow-key navigation; click to pin an element for atomic number, mass ([brackets] for the longest-lived isotope), category, period/group/block and electron configuration (Aufbau with the usual exceptions; predicted for Z ≥ 104). "Decay it" sends the element to the decay tool | Working |
| **Nuclear decay:** alpha, beta-minus and positron emission with true nuclide notation (mass number above, atomic number below), balanced equation, conservation steps, why-links and a Lesson mode with targeted feedback. Reads input typed many ways ("Po-210", "210Po", "polonium-210", "84 Po 210"), and the bag's problem box recognizes "Po-210 alpha decay" | Working |
| **Scientific calculator** (calculator model, or Science → Scientific calculator): sin/cos/tan and inverses in DEG or RAD, ln, log, xʸ, e, π, x!, 1/x, EE (×10ⁿ), Ans | Working |
| Draw on the whiteboard: pen (pressure-aware), highlighter, line/rect/ellipse, eraser, 4 muted inks, undo/redo, **hold-to-straighten**, optional **shape assist**; windows step aside while drawing | Working |
| Stickers: sheet in the backpack, place/drag/rotate/scale/peel off, keyboard accessible, three earnable stickers. **Drop one on a window or item and it sticks there**, moving, minimizing and stacking with it (and coming back with Undo if the window is closed); drag it off to put it back on the board | Working |
| **Trip on da Ship** (from the boat icon): a pixel seaside ticket shop that follows your real clock. The ticket for the current time of day costs 50 tokens (about 5 practice answers) and the other one 100 (about 10). Board da Ship for 3 casts in the open sea: click to cast, wait, click when the bobber dips. Missing the bite loses the cast; clicking too early just reels in. Four rarities with slightly shorter bite windows for rarer fish, separate day and night fish, catch cards, rare decor drops, food and decor unlocks, a catch log, and a send-to-bowl button | First playable |
| **Items**: frameless, interactable objects that live on the desk, each with its own right-click menu (long-press on touch, or the menu key) sharing a compact Size / Tuck away row (`items/ItemMenu.tsx`). Tuck away puts it back in the bag; taking it out again brings back the same one, where it was and as it was. Right-click menus always fit on screen: they flip upward or inward near an edge and re-fit when they change size. Found under *Items* in the backpack | Working |
| **Clock item**: pixel-art desk clock with two looks, picked from its right-click menu: an **80s alarm clock** (all dark plastic with a snooze bar, red seven-segment LEDs with faint unlit segments, blinking colon, AM/PM lights) or a **modern** slab (slim digits, date, a bar that fills each minute; follows light/dark). 12- or 24-hour | Working |
| Fishbowl item (one per desk; "Put in bowl" and the backpack reuse it): a frameless floating object (no window) you drag from anywhere, with a corner resize that keeps proportions. **Right-click** (long-press on touch, or the menu key) opens tank options: say hi, feed, switch fish from your collection, bowl size, tuck away, put away. Pixel-art scene (generated bowl, seaweed, gravel, bubbles, book-stack decor) with the selected fish swimming in whole-pixel steps, tail flick and blink frames, one personality beat on click, reduced-motion safe | Placeholder art |
| **Appearance:** Light, Dark, or Dynamic (follows your clock: dark from 7pm to 6am, the same day/night as da Ship), in the bag's Settings. All colors are tokens in `styles/tokens.css`; paper (sticky notes, hints) stays paper in both themes | Working |
| Responsive: under 720px wide, windows go full-screen one at a time, the backpack becomes a bottom sheet listing every open window | Working |

## Accounts

Optional, email and password, for students 13 and up. Settings → Account signs in or creates an account; everything already on the device comes with it, and it all syncs from then on (progress, settings, the board, saved desks). Signing out clears the device, for shared computers.

- **Setup:** a Supabase project with `supabase/migrations/0001_accounts.sql` and then `0002_notes.sql` run in its SQL editor (without the second, notes stay on each device and everything else still syncs) (tables, row-level security so each student only reaches their own rows, and `delete_my_account()`). Set `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` on Vercel (and in `.env.local` for `npm run dev`); `vite.config.ts` bakes in exactly those two names at build time, so redeploy after changing them. Without them, accounts stay hidden.
- **Email confirmation is off**, so accounts work immediately. The only email sent is the forgot-password link, which needs an email service with your own domain before real students can rely on it.
- **Tokens are still trusted from the browser,** as before accounts: fine while they only buy fishing tickets, but anything social built on them should award them server-side.

## What is mocked (and says so in the UI)

- **Fish roster.** Five joke fish plus six clearly named placeholders (`placeholder: true` in `data/fish.tsx`) waiting for the real roster. The bowl starts empty; fish come from da Ship.
- **Arcade:** Trip on da Ship is playable; Lucky River Casino, Ikae and Room decor are placeholder cards. The casino copy states there is no cash value and nothing for sale.
- **Tokens for testing:** in dev builds, Settings has a "Give 100 tokens" button.

## Planned / not built

Multiplayer, and the game-side ideas: fish dress-up, room decor, Lucky River Casino, Ikae and the wider points economy. The board deliberately stays one screen; there is no infinite canvas.

## Art direction (development placeholders)

- **Objects and tools** use a pixel-art icon set in the fish's style: 16×16 sprites with a dark 1px outline and flat colors with one light and one dark shade. Each icon is a small draw function in `components/ui/pixel-icons/PixelIcon.tsx` (lines, shaded boxes, discs, balls), outlined automatically and always drawn at whole-number scales (16/32/48/64px). In dev, open `/?icons` for a contact sheet.
- **Fish, stickers, the fishbowl and arcade art** are pixel art built from string rows (`data/pixel.tsx`). Fish share one 20×15 body with a tail-flick frame, a blink frame and per-fish accessory patches. Stickers get an automatic white die-cut edge.
- **UI controls** (close, chevrons, undo) stay as plain line icons, and math stays crisp.

## Component map

```
api/
  recognize.ts             Serverless function (Vercel): the only thing holding the OpenAI
                           key. Reads a photo, transcribes it, optionally names a tool/fields
                           — re-checked against the real registry before being trusted
src/
  math/                    Pure TypeScript, no React. All deterministic, all tested.
    rational.ts            Exact bigint fractions; parses ints, decimals, fractions
    linear.ts              Safe linear-equation parser → Ax + By = C (friendly errors)
    expression.ts          Float expression parser/evaluator for calculator + graph
    standardToSlope.ts     Solver + worked steps (vertical/horizontal/degenerate)
    slopeFromPoints.ts     Solver + worked steps + bonus line
    lessons.ts             Lesson decisions (prompt, check → specific feedback, hints)
    challenge.ts           Seeded problem generator, checker, hints, tokens per answer
    detect.ts              Routes typed text to a tool (all eleven problem types, decay too)
    markup.ts              Tiny math markup ({a/b}, x_1, x^2, √{2}, ±, "text") → nodes / plain text
    poly.ts                Exact one-variable polynomials: parse, add, multiply, format
    surd.ts                Exact square roots (5√2), forgiving number reading for answers
    pointSlope.ts, systems.ts, quadratic.ts, factoring.ts, geometry.ts (Pythagorean,
    area), trig.ts, stats.ts, sequences.ts
                           One solver + steps + lesson builder per tool
    challengeTopics.ts     Practice generators/checkers/hints for the newer topics
    calcExpr.ts            Numbers formatted as calculator input for key guides
    teaching.ts            Lesson guides per topic: goal, idea, vocab, plan, slip-ups, check
    similar.ts             "Another like this": a fresh solvable problem of the same kind
    tools.test.ts          Solvers, lessons (every step accepts its own answer),
                           detection, and every practice topic at every difficulty
    math.test.ts
  state/
    store.ts               Persisted workspace (zustand + localStorage): windows, mode,
                           strokes, stickers, recent problems, progress, settings
    ui.ts                  Ephemeral UI state: backpack, draw tool, toasts, focus
    placement.ts           Smart window placement + viewport clamping
    snap.ts, tidy.ts       Window snapping (grid, edges, guides) and Tidy up layout (tested)
    desks.ts               Saved desks (named board snapshots) behind a DeskStorage adapter
    types.ts
  data/
    tools.ts               Window type registry: sizes, chrome, initial data, hasContent
    recognitionSchema.ts   Which tools the photo reader may name, a guide to each field and
                           its allowed choices, and the checks on its answers (shared with
                           api/recognize.ts — pure data, no React, field names from TOOLS)
    catalog.tsx            Backpack contents, math catalog, calculator models
    stickers.tsx, fish.tsx, pixel.tsx   Pixel-art sprites (swap per sprite, keep grid size)
    decor.tsx              Bowl decor (fish unlocks and rare drops) and fish foods
    khan.ts                Khan Academy links per topic (found via search of khanacademy.org)
    arcade.tsx             Arcade entries
    pixelCanvas.ts         Drawing kit + 3×5 pixel font for scenes
  science/
    elements.ts            118 elements, layout, electron configurations
    decay.ts               Alpha/beta/positron solver, nuclide parsing (tested)
    decayLesson.ts         Lesson decisions for decay
    PeriodicTableTool.tsx, NuclearDecayTool.tsx
  game/
    ship.ts                Trip rules: clock → day/night, ticket prices, casts, rarity
                           weights, bite windows, decor drops (tested in ship.test.ts)
    scenes.tsx             Pixel shop, sea, da Ship, bobber (drawn on a 160×100 grid)
    TripOnDaShip.tsx       Ticket shop, trip loop, catch card, catch log
  components/
    windows/FloatingWindow.tsx   Drag/resize/focus/minimize/maximize shell
    windows/BareObject.tsx       Frameless shell for items (drag, keep-ratio resize, keys)
  items/                       Items: ClockItem.tsx, sevenSeg.ts, shared ItemMenu.tsx
    ui/ContextMenu.tsx           Right-click menus
    windows/WindowLayer.tsx      Maps window types → tools; compact (mobile) mode
    backpack/BackpackButton.tsx  Draggable edge-snapping round button (geometry.ts)
    backpack/QuickProblem.tsx    Type-a-problem entry with tool detection (math/detect.ts)
    backpack/BackpackOverlay.tsx The bag: icon bar + views (backpack/views.tsx)
    ModeSwitch.tsx, Toasts.tsx, StickerLayer.tsx
    ui/pixel-icons/              Pixel icon set (dev contact sheet: /?icons)
    ui/InventoryGrid.tsx         One inventory pattern: slots/cards, search, chips,
                                 sections, arrow-key nav, drag-to-place
    ui/MathView.tsx              Crisp math rendering + inline $math$ prose
    ui/HandDrawn.tsx             Hand-drawn underline/circle/arrow/check (guidance only)
    tools/problem/ProblemShell.tsx   Shared instrument: input, solve, result, steps,
                                     lesson, next problem, history, import
    tools/problem/LessonPanel.tsx, StepsList.tsx, RecognitionDialog.tsx
    tools/*Tool.tsx, tools/HomeMenu.tsx
    tools/bridge.ts              Tool interop: send to graph, open helper beside work (with key guide)
    tools/problem/fields.tsx     Shared inputs for problem tools (expression, number, point, segmented)
    tools/problem/KhanLinks.tsx  Khan Academy links (video / article / practice), new tab
    tools/figures.tsx            Right triangle, shapes, dot plot, term strip (theme-aware SVG)
    tools/calc/                  Calculator models: graphingEngine.ts + GraphingCalc.tsx,
                                 examEngine.ts + ExamCalc.tsx (pure reducers, tested),
                                 guide.ts + useCalcGuide.tsx (lesson key highlighting)
    backpack/DesksView.tsx       Desks: save, switch, rename, duplicate, delete
    drawing/                     Board ink layer, capture surface, toolbar, shape assist
```

## Extension points

- **New problem tool:** write a solver in `math/` that returns `Step[]` and a lesson builder returning `LessonDecision[]` (give each decision a `teach` line and a `why` line; the tests insist), plus a `LessonGuide` in `math/teaching.ts` and links in `data/khan.ts`. Then add a small `*Tool.tsx` that hands `solve`/`renderInputs` to `ProblemShell`, register it in `data/tools.ts` and `WindowLayer`, and add it to `MATH_CATALOG` / `BACKPACK_ITEMS`. History, Cheat/Lesson, why-links, import, copy and graphing come for free.
- **New calculator model:** write a pure `press(state, keyId) → state` engine and a keypad component in `tools/calc/`, add it to `CALCULATOR_MODELS`, branch on `data.model` in `CalculatorTool`, give it a size in `TOOLS.calculator.sizeFor`, and teach `guide.ts` which key ids its tokens map to so lesson key guides work on it.
- **Lesson key guides:** give a lesson decision a `calc` expression (`"(−5)² − 4 × 1 × 6"`, `"10 × sin(35)"`; `calcNum` formats exact numbers). The calculator does the rest for whichever model is selected.
- **Practice topics:** add a `TopicDef` to `math/challengeTopics.ts` (generate, prompt, fields, check, hints, answers). Storing problems as the tool's own inputs means typed "bring your own" problems work for free, and the test suite checks every generated problem against its own answers.
- **Art:** every icon is one draw function in `PixelIcon.tsx`, and every sprite is a string-row grid with a palette. Either can be replaced one at a time. A new fish only needs a palette and, optionally, an accessory patch.
- **Recognition:** the reader lives in `api/recognize.ts`; the tools and fields it may suggest come from `data/recognitionSchema.ts`, whose field names are read straight from the `TOOLS` registry. To make a new problem tool recognizable, add it to `BASE` there with a `when` line (which problems it's for, so the reader picks it over its neighbours) and a one-line guide per field (and `options` for any choice field, like a shape) — `recognitionSchema.test.ts` fails until every field has one. The model's response schema is built from that guide, so it can only name real tools, fields and choices, and `checkGuess` re-checks its answer on both the server and the client. Imports reachable from `api/` keep their `.js` endings: Vercel runs those files as plain ES modules.
- **New fish:** add an entry to `FISH` in `data/fish.tsx` with a rarity, a time (`day`/`night`/`any`), a palette, and optionally an accessory patch and `unlocks`. It appears in the trip pool, catch log and bowl automatically. Prices, casts and odds live at the top of `game/ship.ts`.
- **New item:** register a type in `data/tools.ts` with `chrome: 'bare'` and an `aspect`, render it as pixel art, add a right-click `ContextMenu` ending in `<ItemMenuFooter/>`, and add it to the *Items* section in `data/catalog.tsx`.
- **Persistence and sync:** `useWorkspace` uses zustand's `persist` for the live board, and saved desks go through `DeskStorage` in `state/desks.ts`; both stay the working copy. Account sync (`state/sync.ts`) mirrors them to Supabase in the background: each sync pulls the account, three-way merges it with this device using what was last in step (`uji.sync`, merge rules in `state/syncMerge.ts`), and saves only over the version it read, so devices combine instead of overwriting. A device that has never synced hands everything to the account it signs in to; signing out saves, then clears the device.
