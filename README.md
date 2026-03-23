# E6-B Flight Computer

A browser-based electronic flight bag (EFB) that replicates the core calculations of the E6-B flight computer. Implemented as a single self-contained `index.html` file — no framework, no build step, no dependencies.

**Live demo:** https://thekayrasari.github.io/e6b/

---

## Overview

The app mirrors the two sides of a physical E6-B:

- **Wind Side** — computes wind correction angle, true/magnetic/compass heading, ground speed, and crosswind/headwind components from a vector solution, with a live canvas vector diagram.
- **Calculator Side** — a tabbed panel covering time/speed/distance, fuel planning, true airspeed, altitude/density altitude, crosswind components, top of descent, and unit conversions.

All computation is pure JavaScript with no external libraries.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Language | Vanilla JavaScript (ES6) |
| UI | Plain HTML + CSS custom properties |
| Vector diagram | HTML Canvas (2D context) |
| Fonts | Google Fonts — Spectral, JetBrains Mono, Source Sans 3 |
| Build | None — open `index.html` directly |

---

## Project Structure

```
e6b/
├── index.html      # Complete application — all logic, UI, styles, and rendering
└── LICENSE
```

Everything lives in a single file, organized into distinct sections:

- **Pure calculation functions** — stateless math, no DOM dependencies
- **Unit conversion table** — lookup object of converter functions
- **`drawWindCanvas()`** — canvas-based vector diagram, redraws on every input change
- **UI helpers** — `outputBox()` HTML builder, `fmt()` / `fmtTime()` formatters
- **Panel updaters** — `updateWind()`, `updateTSD()`, `updateFuel()`, etc.
- **Tab/panel switching** — `setPanel()`, `setCalcTab()`, `setTSDsolve()`
- **Init block** — runs all updaters on load to populate default outputs

---

## Usage

### Running Locally

```bash
git clone https://github.com/thekayrasari/e6b.git
cd e6b
open index.html   # macOS
# or just double-click index.html on Windows/Linux
```

No Node.js, no `npm install`, no web server required. Works fully offline.

---

## Features

### Wind Side

| Output | Method |
|---|---|
| Wind Correction Angle | `WCA = arcsin(Vw · sin(θ) / TAS)` |
| Ground Speed | `GS = TAS · cos(WCA) − Vw · cos(θ)` |
| True Heading | `TH = TC ± WCA` |
| Magnetic Heading | `MH = TH ∓ Variation` |
| Compass Heading | `CH = MH ∓ Deviation` |
| Headwind / Crosswind | Vector projection onto runway axis |

A **wind vector canvas diagram** renders in real time alongside the inputs, drawing the true course, true heading/TAS vector, wind vector, and ground speed resultant with a WCA arc label. The canvas redraws on every input event.

### Calculator Side (tabs)

| Tab | Calculations |
|---|---|
| **TSD** | Solves for distance, time, or ground speed given the other two |
| **Fuel** | Endurance, fuel required, and reserve from flow rate and onboard fuel |
| **TAS** | True airspeed, Mach number, density altitude, and ISA deviation from CAS + pressure altitude + OAT |
| **Alt** | Pressure altitude from QNH, ISA temp, ISA deviation, and density altitude |
| **XWind** | Headwind and crosswind components for a given runway heading |
| **TOD** | Top of descent distance for a standard 3° descent profile |
| **Units** | 18 aviation unit conversions across distance, weight, volume, temperature, and pressure |

---

## Architecture

### Calculation Layer

All computation functions are pure and stateless, defined at the top of the script before any DOM code. They take and return plain numbers (or a result object).

Key functions:

```js
calcWind(trueCourse, tas, windDir, windSpeed)  // → { wca, gs, trueHeading } | { error }
calcTSD(dist, gs, timeMin)                     // pass null for the unknown
calcFuel(flow, onboard, timeMin)               // → { endurance, required }
calcTAS(cas, pressAltFt, oatC)                 // → { densAlt, isaDev, tas, mach }
calcPressAlt(indicatedFt, qnh_inHg)
calcCrosswind(rwyHdg, windDir, windSpeed)       // → { headwind, crosswind }
calcTOD(altToLose)
```

ISA temperature uses the standard lapse rate of 1.98 °C per 1,000 ft. Density altitude uses the `(1 − 6.8755856×10⁻⁶ · DA)^4.2558797` rho-ratio approximation. Speed of sound is computed from OAT for the Mach number output.

### State Model

There is no framework state. Each DOM input holds its own value. Updater functions read directly from `input.value`, compute results, and write HTML strings into output `div` containers via `innerHTML`. Panel and tab switching is handled by toggling the `active` CSS class.

### Canvas Diagram

`drawWindCanvas()` reads six inputs (TC, TAS, wind direction, wind speed, and the pre-computed result object), clears the canvas, and repaints all vectors from scratch on every call. Vectors are scaled relative to the maximum of TAS, GS, and wind speed so all arrows stay within the canvas bounds. CSS custom properties are read via `getComputedStyle` so the diagram respects dark/light theme changes.

---

## Theming

Dark and light modes are toggled by the header button. Themes are implemented as a `data-theme` attribute on `<html>`, switching a set of CSS custom properties:

```
--bg1, --bg2, --bg3   background layers
--fg                  primary text
--label               secondary / muted text
--accent              blue highlight
--accent2             teal secondary
--border, --border2   panel borders
--danger              error / caution colour
```

All styles reference these variables, so switching themes requires no layout recalculation — only a canvas redraw is triggered.

---

## Disclaimer

This tool is for **training and educational use only**. All outputs must be verified against official charts and certified avionics before use in flight.

---

## License

MIT — see [LICENSE](./LICENSE) for full terms.