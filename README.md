# E6B Flight Computer

Interactive functional E6-B flight computer and vector physics simulator built with plain JavaScript, Matter.js, and a zero-dependency Node.js development server.

## Overview

This repository contains a browser-based aviation tool that combines:

- Wind triangle navigation calculations
- Atmospherics and True Airspeed (TAS) computation
- Fuel burn and estimated time en route (ETE) planning
- Interactive vector visualization and HUD-style flight instrumentation

## Features

- Dynamic wind triangle solver with heading, ground speed, and wind correction angle
- Real-time crosswind and headwind/tailwind component readouts
- Atmospheric calculations for pressure altitude, outside air temperature, density altitude, and TAS
- Fuel and distance planning with duration and fuel burn estimates
- Responsive UI with slider and input bindings for instant updates
- Zero-dependency local server for easy testing and deployment

## Getting Started

### Prerequisites

- Node.js installed on your machine
- Modern web browser

### Run Locally

From the project directory:

```bash
npm install
npm start
``` 

Then open:

```text
http://localhost:3000/
```

### Development

The same local server is available via:

```bash
npm run dev
```

### Tests

Run the built-in calculation tests with:

```bash
npm test
```

### GitHub Pages Deployment

This repository is configured to publish the site at:

```text
https://thekayrasari.github.io/e6b
```

To publish manually:

```bash
npm install
npm run deploy
```

The deployment step includes a build pass that copies the static site into `docs/`, then publishes it to the `gh-pages` branch.

Automatic deployment is also configured via GitHub Actions on `main` branch pushes.

## Repository Structure

- `index.html` — main application UI
- `style.css` — project styling and layout
- `app.js` — UI controller, input bindings, and application state
- `calculator.js` — aviation math models and flight computer logic
- `visualizer.js` — physics-driven vector visualization
- `server.js` — minimal Node.js static file server
- `test.js` — test suite for calculator functions
- `package.json` — project metadata and scripts

## Notes

- The server is intentionally simple and only serves static files from the repository root.
- The application is designed for flight planning education and simulation, not certified navigation use.

## License

This project is licensed under the MIT License.
