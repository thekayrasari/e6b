# E6-B Flight Computer

A browser-based electronic flight bag (EFB) that replicates the core calculations of the E6-B flight computer. Built with React and Vite, it runs entirely client-side with no backend and no external data dependencies.

**Live demo:** https://thekayrasari.github.io/e6b/

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Features](#features)
- [Architecture](#architecture)
- [Theming](#theming)
- [Disclaimer](#disclaimer)
- [License](#license)

---

## Overview

The app is split into two panels, mirroring the two sides of a physical E6-B:

- **Wind Side** — computes wind correction angle, true/magnetic/compass heading, ground speed, and crosswind/headwind components from a vector solution, with a live canvas vector diagram.
- **Calculator Side** — a tabbed panel covering time/speed/distance, fuel planning, true airspeed, altitude/density altitude, crosswind components, top of descent, and unit conversions.

All computation is pure JavaScript — no physics library, no chart library, no external dependencies beyond React.

---

## Tech Stack

| Layer | Technology |
|---|---|
| UI framework | React 18 (functional components + hooks) |
| Build tool | Vite 5 |
| Vector diagram | HTML Canvas (2D context, drawn via `useEffect`) |
| Styling | Inline CSS-in-JS + a single injected `<style>` block |
| Fonts | Google Fonts — Share Tech Mono, Orbitron (loaded via `@import`) |
| Language | JavaScript (JSX) |
| Linting | ESLint (flat config) |

---

## Project Structure

```
e6b/
├── public/               # Static assets
├── src/
│   └── e6b.jsx           # Entire application — calculations, components, styles
├── index.html            # Vite entry point
├── vite.config.js        # Vite configuration
├── eslint.config.js      # ESLint flat config
├── package.json
└── package-lock.json
```

All logic and UI lives in a single file, `src/e6b.jsx`, organized into distinct sections:

- **Pure calculation functions** — stateless math, no React
- **Unit conversion helpers** — lookup table of converter functions
- **`WindCanvas`** — canvas-based vector diagram component
- **Shared UI primitives** — `Field`, `OutputBox`, `SectionHeader`
- **Wind Side panel** — `WindSide`
- **Calculator sub-panels** — `CalcTSD`, `CalcFuel`, `CalcTAS`, `CalcAlt`, `CalcConvert`, `CalcTOD`, `CalcXwind`
- **Calculator tabbed container** — `CalcSide`
- **Root app** — `E6B` (default export)

---

## Getting Started

### Prerequisites

- Node.js ≥ 18
- npm ≥ 9

### Install & Run

```bash
git clone https://github.com/thekayrasari/e6b.git
cd e6b
npm install
npm run dev
```

Dev server starts at `http://localhost:5173` with HMR enabled.

### Build for Production

```bash
npm run build   # output → dist/
npm run preview # serve dist/ locally
```

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

A **wind vector canvas diagram** renders in real time alongside the inputs, drawing the true course, true heading/TAS vector, wind vector, and ground speed resultant with a WCA arc label. The canvas redraws on every input change via `useEffect`.

### Calculator Side (tabs)

| Tab | Calculations |
|---|---|
| **TSD** | Solves for distance, time, or ground speed given the other two |
| **FUEL** | Endurance, fuel required, and reserve from flow rate and onboard fuel |
| **TAS** | True airspeed, Mach number, density altitude, and ISA deviation from CAS + pressure altitude + OAT |
| **ALT** | Pressure altitude from QNH, ISA temp, ISA deviation, and density altitude |
| **XWIND** | Headwind and crosswind components for a given runway heading |
| **TOD** | Top of descent distance for a standard 3° descent profile |
| **UNITS** | 18 aviation unit conversions across distance, weight, volume, temperature, and pressure |

---

## Architecture

### Calculation Layer

All computation functions are pure, stateless, and defined at the top of the file before any React code. They take and return plain numbers (or a result object), making them straightforward to test or extract independently.

Key functions:

```js
calcWind(trueCourse, tas, windDir, windSpeed)  // → { wca, gs, trueHeading } | { error }
calcTSD(dist, gs, timeMin)                     // pass null for the unknown
calcFuel(flow, onboard, timeMin)               // → { endurance, required }
calcTAS(cas, pressAltFt, oatC)                 // → { densAlt, isaDev, tas, mach }
calcPressAlt(indicatedFt, qnh_inHg)
calcCrosswind(rwyHdg, windDir, windSpeed)       // → { headwind, crosswind }
calcTOD(altToLose, gs)
```

ISA temperature uses the standard lapse rate of 1.98 °C per 1,000 ft. Density altitude uses the `(1 − 6.8755856×10⁻⁶ · DA)^4.2558797` rho-ratio approximation. Speed of sound is computed from OAT for the Mach number output.

### State Model

Each sub-panel manages its own local state with `useState`. There is no global state, context, or external store. The root `E6B` component holds only two pieces of state: the active panel (`wind` or `calc`) and the current theme.

### Canvas Diagram

`WindCanvas` holds a `ref` to a `<canvas>` element and redraws via `useEffect` whenever its props change. It receives the computed `result` object as a prop and uses it directly — no internal calculation. Vectors are scaled relative to the maximum of TAS, GS, and wind speed so all arrows stay within the canvas bounds.

---

## Theming

The app supports dark and light modes, toggled by the header button. Themes are implemented as a `data-theme` attribute on `<html>`, switching a set of CSS custom properties:

```
--bg1, --bg2, --bg3   background layers
--fg                  primary text
--label               secondary / muted text
--accent              amber highlight (#ffb800 dark / #b87800 light)
--accent2             green secondary (#5fcf80 dark / #2a8a40 light)
--border              panel borders
```

All component styles reference these variables inline, so switching themes requires no component re-render beyond the `useEffect` that sets the attribute.

---

## Disclaimer

This tool is for **training and educational use only**. All outputs must be verified against official charts and certified avionics before use in flight.

---

## License

MIT — see [LICENSE](./LICENSE) for full terms.