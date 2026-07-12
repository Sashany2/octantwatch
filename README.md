# OCTANT — Time, Measured

A scroll-driven WebGL landing page for **OCTANT**, a fictional watch brand.

**Live:** https://octantwatch.xyz

![The watch, dial forward](screenshots/v11-release-front.png)

## What it is

A single self-contained `index.html`. No build step, no framework, no bundler. Three.js is
vendored into `vendor/`, so apart from two Google fonts the page loads nothing it does not own.
The watch is not a downloaded 3D model: it is built in code from primitives.

Scrolling the page turns the watch through one full revolution: dial → profile → exhibition
caseback → dial. The hands advance as you scroll (twelve hours over the full page), the second hand
sweeps in real time, and the balance wheel oscillates whether you scroll or not.

## How the watch is made

Everything is procedural Three.js geometry:

- **Case** — a closed `LatheGeometry` profile revolved into a steel ring, with a polished torus bezel.
- **Dial** — recessed disc, chapter ring, sixty minute ticks and twelve applied batons (doubled at twelve).
- **Hands** — geometry offset so each pivots about the dial centre; the seconds hand has a counterweight.
- **Bracelet** — links laid along a `CatmullRomCurve3` that wraps away from the viewer, each link a
  polished centre bar between two brushed flanks.
- **Movement** — visible through the sapphire caseback: four wheels, a balance wheel and a
  skeletonised oscillating weight.
- **Environment** — a studio softbox reflection map generated on a `<canvas>` and run through
  `PMREMGenerator`. Without it, metal at `metalness: 0.95` on a black stage has nothing to reflect
  and renders as a black hole.

The background is a three-layer sine-wave shader whose palette migrates by luminance — graphite at
the top of the page, polished steel at the bottom. The page is monochrome throughout.

## On a phone

<img src="screenshots/live-phone-final.png" alt="The site on a phone" width="300">

The layout collapses to a single column below 820px, which also catches a portrait tablet. On a
portrait screen the camera aims at the middle of the case so the watch sits dead centre and the copy
runs beneath it. Touch devices lose the custom cursor, the shadow maps and half the dust particles —
they are the expensive part, and none of them survive contact with a phone GPU.

The bracelet is a closed loop rather than two open straps. An open bracelet has to end somewhere, and
because it curves away from the camera that end falls back inside the frame at most angles, reading
as a snapped strap. A loop has no ends.

## When the 3D cannot run

WebGL is not always there: an office machine with 3D disabled by policy, a stale driver, a privacy
extension that blocks the context, a phone saving battery. The page does not go dark. It notices,
drops the class `no-webgl` on `<html>`, and becomes what it always was underneath — an editorial
column with a watch drawn in SVG at the top, every word readable, the shop still working.

The words on this page were never allowed to depend on a graphics card, and a watchdog in a plain
`<script>` catches even the case where the module itself fails to load and takes its own error
handling down with it.

Motion respects `prefers-reduced-motion`: the watch still turns when *you* scroll, but the balance
wheel, the rotor, the dust and the waves stop moving on their own.

## Orders

The form posts to a Cloudflare Worker (`worker/`), which forwards the order to Telegram. The bot
token lives in the worker, never in the page — a token in page source is a bot someone else owns
by lunchtime. Deploy it, then paste the URL it prints into `ORDER_ENDPOINT` near the top of the
module script.

Until you do, the form says it has nowhere to send an order. It does not thank anyone for an order
it is quietly dropping.

## Running it

Because Three.js is now a local ES module, a browser will not load it over `file://` — it needs to
be served:

```bash
python -m http.server 8000     # then open http://localhost:8000
```

Double-clicking `index.html` still opens the page, but it will show the static fallback rather than
the 3D. That is the fallback doing its job, not a bug.

## Before you show it to anyone

```bash
node ~/.claude/skills/web-quality-gate/check-site.mjs http://localhost:8000
```

Exit 0 or it is not finished.

## Disclaimer

OCTANT is not a real company. The brand, the references, the calibre and the prices are invented for
a design exercise. No payment is taken and no watch will arrive — but the order form, unlike the
brand, is real: it genuinely delivers what you type into it.
