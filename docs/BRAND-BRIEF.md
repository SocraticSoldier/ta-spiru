# Brand brief — Gemini Ltd pipeline

**For:** the Gemini Ltd team (design, build, content)
**Owner:** Jake · Gemini Ltd, Malta
**Last updated:** 26 July 2026

---

## How to read this

Every project below is marked with how settled its brand actually is. This matters more than it
sounds: half of these are running in production and half are a paragraph in a planning document, and
treating them the same is how a team ends up "refreshing" a brand nobody agreed on.

| Mark | Means |
| --- | --- |
| 🟢 **Confirmed** | Shipped and in code. Values here are read from the repo. Do not change without Jake. |
| 🟡 **Proposed** | Written down and coherent, but not signed off. Argue with it now, not after launch. |
| ⚪ **Open** | Little more than a name. Needs a discovery conversation before any design work. |

**One rule across everything:** if a value is not in this document or in a `tailwind.config.ts`, it
does not exist yet. Do not invent hex codes in a comp and let them leak into production — bring the
question here instead.

---

## The house view

Gemini Ltd builds for Maltese businesses, and the work has a recognisable temperature: dark grounds,
one metal, one hot accent, and typography doing the talking rather than illustration. That is a house
tendency, not a mandate — Ananke deliberately breaks it, and a property brand should too.

What genuinely is a house standard:

- **Dark grounds are never pure black.** `#000000` reads as a hole. Every dark in this document
  carries a lift toward blue or warm grey.
- **One accent metal per brand.** Gold and bronze do not appear together.
- **Type over ornament.** No stock iconography, no gradient meshes, no drop shadows as decoration.
- **Real photography or nothing.** A brand with no photography budget gets a type-led system, not
  filler stock.

---

## 🔴 Katana Crust — P1

🟡 **Proposed.** Client: Marcelo. Ghost kitchen. Next.js, hosted on Hostinger.

**Gated on the NDA.** Nothing goes public, and no work is shown outside the team, until it is signed.

**Positioning.** A ghost kitchen with no dining room has no atmosphere to sell, so the brand *is* the
atmosphere. Kurosawa rather than Benihana: restraint, negative space, one decisive stroke. Theatrical,
not cartoonish. The failure mode to avoid is the anime-samurai cliché — no crossed katanas, no
brush-script "authentic Japanese" lettering, no rising-sun rays.

**Palette (proposed — needs sign-off).**

| Role | Hex | Note |
| --- | --- | --- |
| Ground | `#0B0B0D` | Near-black with a cool lift |
| Crimson | `#C8102E` | The single decisive stroke. Used sparingly — a blade, not a wash |
| Gold | `#C9A227` | Menu accents, prices, the mark |
| Paper | `#F2EDE4` | Warm off-white for light sections |

**Type (proposed).** A high-contrast display serif or a confident geometric sans for the wordmark;
clean sans for the menu. Menus are read on phones in a hurry — legibility beats character below 16px.

**Scope — three sections.** Hero with order CTA · menu showcase (signature pizzas lead, then tenders,
tacos, burgers, desserts) · live order tracking, customer and admin, via the Wolt map API.

**Blocked / needed.** NDA signed · domain confirmed (`katanacrust.com` / `.mt`) · Wolt API keys from
Julian · food photography direction (shot or sourced?) · Marcelo's surname, address, billing details.

---

## ⚫ ΑΝΑΠΟΦΕΥΚΤΟΣ (Ananke / "Inevitable")

🟡 **Proposed, and the most developed of the proposals.** In-house content brand.
Live brand site: `apps/ananke` — the site *is* the brand guide, keep it as the source of truth.

**Positioning.** Greek content on necessity and inevitability — the Odyssey, Stoic philosophy, and
astrology as character writing. Low production cost, strong upside with a small paid push.

**The name.** Ἀνάγκη (Ananke) is the personification of necessity. **ΑΝΑΠΟΦΕΥΚΤΟΣ**
(*anapófefktos*) is the adjective that falls out of her — "inevitable". The brand carries the
adjective, not the goddess, because the adjective is the part the audience already feels.

**Palette — sampled from the key art, not chosen.**

| Role | Hex |
| --- | --- |
| Dusk deep | `#ED9774` |
| Coral | `#FFA489` |
| Coral light | `#FEB8AB` |
| Blush | `#FECDC6` |
| Obsidian | `#0B0B14` |
| Navy lift | `#181830` |
| Gilt | `#C9A66B` |
| Ivory | `#FFF6F1` |

**Type.** Wordmark in **GFS Didot** — a Didone drawn *for Greek*, so the letterforms keep their
thick-to-thin contrast instead of being stretched out of a Latin face. Latin headings in **Bodoni
Moda**. Body in **Inter**.

**The three marks.** The helmet seen from behind (the viewer stands where he stands — never show the
face) · the gilded spine (endurance as an object, the one anatomical motif) · the coral dusk (the hour
when the thing is decided but has not landed).

**Voice.** Certain, unhurried, second person, addressed to one person as an equal. State the thing and
stop. Quote accurately and name the source. Let astrology describe character, never predict events.
Not everything has to resolve on an uplift line.

**Formats.** Portrait 1080×1350 (feed) · square 1080×1080 · story 1080×1920. Templates are live in the
post studio at `/studio`.

**Blocked / needed.** Domain and handle availability sweep — `anapofefktos.com` and the handles in the
brand site are **proposals, not reservations**. Check before anything is printed or announced.

---

## 🟢 Ta' Spiru

🟢 **Confirmed and live** at `app.taspiru.com`. Values below are read from `apps/web/tailwind.config.ts`.

**Positioning.** Five Maltese branches combining premium barbering with high-end car detailing —
two businesses, one brand, one loyalty wallet. *"It's not just a haircut, it's a lifestyle."*

**The two-stream rule — the most important thing to get right.** Barber is **bronze**, car wash is
**teal**, everywhere, without exception: storefronts, calendar chips, queue boards, receipts. A
customer should be able to tell which business they are looking at from three metres away with the
sound off. Combo bookings show both.

| Role | Hex |
| --- | --- |
| Graphite | `#1c1c1e` |
| Graphite deep | `#0e0e10` |
| Bronze (barber) | `#b08d57` |
| Bronze light | `#cfae7b` |
| Teal (wash) | `#3fc1b0` |
| Teal light | `#7adccf` |

**Type.** **Brewheat** is the display face, self-hosted in `apps/web/public/fonts` (and loaded via
`expo-font` on mobile). **Helvetica Neue** for body. BrandScript is also in the repo for accents.

**Surfaces.** Storefront · `/admin` master portal · `/display/[branch]` TV queue boards, which are
read at distance in a bright shop — that is a legibility constraint, not a style choice.

**Needed.** Apple/Google wallet-pass certificates for the loyalty card.

---

## 🟡 Gemini Ltd (the agency, and the dashboard product)

🟡 **Proposed.** The mark in use across the command centre and Jarvis is a gold-to-crimson diamond on
a dark tile, but **the official logo and hex codes have not been supplied** — everything below is
derived from the working boards, not from a brand file.

| Role | Hex | Source |
| --- | --- | --- |
| Ink | `#0A0A0C` | Command centre |
| Ink raised | `#121218` / `#1A1A22` | Command centre |
| Crimson | `#E01A2B` | Command centre |
| Gold | `#E7B24C` | Command centre |
| Text / muted / faint | `#ECECF1` / `#9C9CAA` / `#63636F` | Command centre |

**Type.** Chakra Petch (display) · Inter (body) · Space Mono (data, labels, timestamps).

**The product.** A unified dashboard for local business owners — inbox, revenue, staff clock-in,
payroll. ~€400/month basic, custom for multi-venue. It still has **no final name and no stated
differentiator**, which is the actual blocker; the visual work is downstream of that decision.

**Needed — this is the top open item in the whole pipeline.** Official Gemini Ltd logo files and hex
codes. Until they arrive, every internal surface is guessing, and the guesses have already been copied
into three apps.

---

## 🟡 Jarvis

🟡 **Proposed, shipping.** In-house. `apps/jarvis`.

Shares the Gemini Ltd ink/crimson/gold system above — deliberately, since it is an internal tool and
should read as part of the agency rather than as its own brand. Chakra Petch, Inter, Space Mono.

**Voice.** Short, spoken-first. Replies are read aloud by text-to-speech, so no markdown, no bullets,
one or two sentences unless asked for detail. Direct and a little dry. Says plainly when it cannot do
something rather than pretending.

**Surfaces.** Assistant (wake word) · Daily brief · Malti dictionary · Vault · Debug console.

---

## ⚪ Mediterranean Properties Malta

⚪ **Open.** Website preview. **Blocked on Google Drive access** — the brief and source material sit in
the Gemini Ltd Drive and nobody has read them yet.

Do not start visual work. A property brand should almost certainly break the house dark-ground
tendency — property sells light, space and location — but that is a conversation to have with the
source material in hand, not a decision to make from this document.

**Needed.** Drive sign-in, then a read of the existing brief.

---

## ⚪ Alma Restaurant

⚪ **Open as a brand; active as a content account.** Client, Sliema. Social content ongoing.

**Reels are pending and the client has asked us to push** — that is the live commitment. There is no
brand system captured for Alma in the repo, so reels are currently being made to the restaurant's
existing look. If we are going to keep producing content at volume, it needs a one-page content
template set so posts stop being bespoke.

**Needed.** Confirm whether Gemini Ltd owns Alma's visual identity or is working inside the client's.

---

## ⚪ Autobahn

⚪ **Open. Not yet classified.** New website.

**The blocking question is not design, it is ownership:** is Autobahn a client project or an in-house
one? That determines the budget, the approval loop, and which bucket it sits in. Nobody should open a
design file until that is answered.

---

## Open items across the pipeline

Ordered by how much they are blocking.

1. **Gemini Ltd logo + hex codes.** Blocks the agency brand and its own product; guesses are already
   duplicated across three apps.
2. **Katana Crust NDA.** Blocks the P1 build going anywhere near public.
3. **Google Drive sign-in.** Blocks Mediterranean Properties entirely, plus the NDA draft and the
   client list.
4. **Gemini Ltd dashboard — name and differentiator.** Blocks the commercial product's identity.
5. **Autobahn — client or in-house.** Blocks classification.
6. **Ananke domain and handle sweep.** Blocks announcing the brand.
7. **Katana Crust food photography direction.** Blocks the menu showcase.
8. **Wolt API keys (Julian).** Blocks live order tracking.

---

## What "brand done" means here

Before a project moves from 🟡 to 🟢, it has all of:

- A palette with roles, not just swatches — which colour is the ground, which is the accent, what is
  never allowed to touch what.
- A type pairing with a stated fallback stack, and the licence sorted for any self-hosted face.
- The values committed to `tailwind.config.ts`, so the code is the source of truth and this document
  only has to describe intent.
- A voice section with at least three do/don't pairs written against *real* copy from the project.
- One worked example per surface the brand actually ships on.

If those five exist, a new person can produce on-brand work without asking. That is the bar.
