# E6B Flight Computer

A modern, web-based E6B flight computer built with React and Vite. This tool provides pilots with essential aviation calculations, including wind correction, fuel planning, density altitude, and more, all within a high-performance, mobile-responsive interface.

## ✈️ Features

### ◎ Wind Side (Vector Solving)
- **Wind Vector Diagram**: Real-time canvas visualization of True Course, Wind Vector, True Heading/TAS, and Ground Speed.
- **Wind Correction Angle (WCA)**: Automatic calculation of necessary correction based on TAS and wind.
- **Ground Speed (GS)**: Accurate ground speed calculation using vector resolution.
- **Heading Conversions**: Seamless conversion from True Heading to Magnetic and Compass headings (considering Variation and Deviation).
- **Component Breakdown**: Instant headwind and crosswind calculations.

### ⊟ Calculator Side
- **Time-Speed-Distance (TSD)**: Solve for any missing variable (Distance, Time, or Speed).
- **Fuel Planning**: Calculate endurance, fuel required, and reserves based on flow rates and onboard quantity.
- **True Airspeed (TAS)**: Calculate TAS from CAS using Pressure Altitude and OAT (Outside Air Temperature).
- **Density Altitude**: Detailed atmospheric calculations including ISA Deviation and Density Altitude.
- **Top of Descent (TOD)**: Calculate distance required for a standard 3° descent profile.
- **Unit Converter**: Comprehensive conversion utility for Aviation units (NM/SM/KM, KG/LBS, Gallons/Liters, Celsius/Fahrenheit, hPa/inHg, FT/M).

## 🛠 Tech Stack

- **Framework**: [React 19](https://react.dev/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Graphics**: [HTML5 Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API) for vector rendering.
- **Styling**: Modern CSS with CSS Variables for theme support.
- **Fonts**: [Share Tech Mono](https://fonts.google.com/specimen/Share+Tech+Mono) and [Orbitron](https://fonts.google.com/specimen/Orbitron) for an authentic cockpit display (EFB) feel.

## 🚀 Getting Started

### Prerequisites
- Node.js (Latest LTS recommended)
- npm or yarn

### Installation
1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd e6b
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```

### Deployment
The project includes a deployment script for GitHub Pages:
```bash
npm run deploy
```

## 📐 Mathematical Models

The application uses standard aviation formulas:
- **Wind Correction**: $WCA = \arcsin\left(\frac{V_w \cdot \sin(\theta)}{TAS}\right)$
- **Ground Speed**: $GS = TAS \cdot \cos(WCA) - V_w \cdot \cos(\theta)$
- **Density Altitude**: $DA = PA + (120 \cdot (OAT - ISA_{temp}))$
- **ISA Temperature**: $15 - (1.98 \cdot \frac{Alt_{ft}}{1000})$

## ⚠️ Disclaimer

**FOR TRAINING USE ONLY.**
This application is not certified for navigational use. All calculations must be verified with official charts, certified avionics, and Pilot Operating Handbooks (POH). The developer assumes no responsibility for flight safety or navigation errors resulting from the use of this tool.

---
*Built for pilots, by virtual pilots.*
