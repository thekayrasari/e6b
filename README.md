# e6b

This project implements a web-based E6B flight computer, providing essential aviation calculations through a modern and interactive user interface. It is built using React for the front-end and Vite for a fast development experience.

## Core Features & Technical Details

The application currently offers the following key calculation functionalities:

### 1. ISA Temperature Calculation

*   **Function**: `isaTemp(altFt)`
*   **Description**: Calculates the International Standard Atmosphere (ISA) temperature at a given pressure altitude. This is a fundamental calculation in aviation for performance planning.
*   **Formula**: The ISA temperature is derived from the standard lapse rate, typically `15 - 1.98 * (altitude_in_feet / 1000)` degrees Celsius.
*   **Input**: Pressure Altitude in feet (`altFt`).
*   **Output**: Temperature in degrees Celsius.

### 2. Wind Correction Angle (WCA) and Ground Speed (GS) Calculation

*   **Function**: `calcWind(trueCourse, tas, windDir, windSpeed)`
*   **Description**: Determines the necessary Wind Correction Angle (WCA) and the resulting Ground Speed (GS) based on true course, true airspeed, wind direction, and wind speed. This is critical for accurate flight planning to account for wind effects.
*   **Methodology**: Utilizes a vector-based approach to resolve the wind triangle, providing precise WCA, True Heading, and Ground Speed.
    *   **True Course (TC)**: The intended path over the ground.
    *   **True Airspeed (TAS)**: The speed of the aircraft relative to the air mass.
    *   **Wind Direction (WD)**: The direction *from* which the wind is blowing (meteorological convention).
    *   **Wind Speed (WS)**: The speed of the wind.
*   **Inputs**: All angles are in degrees (e.g., `trueCourse`, `windDir`). Speeds are in consistent units (e.g., knots).
*   **Outputs**: An object containing `wca` (Wind Correction Angle), `gs` (Ground Speed), and `trueHeading`.
*   **Error Handling**: Includes logic to identify and report scenarios where a valid wind solution cannot be found (e.g., wind speed exceeding TAS when flying directly into a headwind).

## Technical Stack & Libraries

*   **Front-end Framework**: [React](https://react.dev/) (v19.x)
    *   **State Management**: `useState` hook is used for managing component-specific state, such as input values and calculation results.
    *   **Side Effects & Lifecycle**: `useEffect` hook is utilized for handling side effects, data fetching, or DOM manipulations (though minimal in this pure calculation app).
    *   **Referencing DOM Elements**: `useRef` hook may be employed for direct interaction with DOM elements, if needed for input focus or other UI interactions.
    *   **Performance Optimization**: `useCallback` is used to memoize callback functions, preventing unnecessary re-renders of child components that depend on these functions.
*   **Build Tool**: [Vite](https://vitejs.dev/)
    *   Provides a fast development server with Hot Module Replacement (HMR).
    *   Optimizes the production build for efficient deployment.
*   **Language**: JavaScript (ES6+) with JSX syntax for React components.
*   **Deployment**: `gh-pages` npm package is integrated for seamless deployment to GitHub Pages.
    *   The `vite.config.js` file configures the `base` path (`/e6b/`) to correctly serve the application from a GitHub Pages subdirectory (e.g., `https://<YOUR_USERNAME>.github.io/e6b/`).
*   **Linting**: [ESLint](https://eslint.org/) for maintaining code quality and consistency.

## Project Structure

```
. (root)
├── public/
│   └── ...           # Static assets (e.g., favicon, public images).
├── src/
│   ├── assets/
│   │   └── ...       # Application-specific assets (e.g., logos, icons).
│   ├── App.css       # Global or top-level application styling.
│   ├── e6b.jsx       # **Core E6B Component & Logic**:
│   │                 #   - Contains pure mathematical functions (`isaTemp`, `calcWind`) for calculations.
│   │                 #   - Implements the main React functional component responsible for rendering the E6B interface, managing user inputs, and displaying results.
│   │                 #   - Utilizes React hooks (`useState`, `useEffect`, etc.) to manage UI state and trigger calculations.
│   ├── index.css     # Entry point for global CSS styles.
│   └── main.jsx      # Application entry point: Renders the root React component (`<App />`) into the `index.html` DOM.
├── .eslintrc.js      # ESLint configuration file for code linting rules.
├── index.html        # The main HTML entry point for the web application.
├── package.json      # Defines project metadata, scripts, and lists all npm dependencies and devDependencies.
├── vite.config.js    # Vite configuration file, including React plugin and base path for deployment.
└── LICENSE           # Project license information.
```

## Getting Started

### Prerequisites

To set up and run this project, you need:

*   [Node.js](https://nodejs.org/) (v14 or higher) - Includes npm (Node Package Manager).

### Installation

1.  **Clone the repository**: Replace `YOUR_USERNAME` with your GitHub username.

    ```bash
    git clone https://github.com/YOUR_USERNAME/e6b.git
    cd e6b
    ```

2.  **Install dependencies**:

    ```bash
    npm install
    ```

### Development

To launch the development server with hot-reloading:

```bash
npm run dev
```

The application will typically be available at `http://localhost:5173`.

### Building for Production

To create an optimized production build of the application:

```bash
npm run build
```

This command generates static assets in the `dist/` directory, ready for deployment.

### Deployment to GitHub Pages

This project is configured for easy deployment to GitHub Pages. The `deploy` script handles the build process and pushes the compiled assets to the `gh-pages` branch.

1.  Ensure your local repository is pushed to your GitHub remote.
2.  Execute the deployment script:

    ```bash
    npm run deploy
    ```

    This script performs the following actions:
    *   Runs `npm run build` to create the production-ready `dist` folder.
    *   Uses the `gh-pages` package to push the contents of the `dist` folder to the `gh-pages` branch of your repository.
    *   GitHub Pages will then serve your application from this branch, accessible at a URL like `https://YOUR_USERNAME.github.io/e6b/`.

## Contributing

Contributions are welcome! Please feel free to fork the repository, open issues for bugs or feature requests, and submit pull requests with improvements. Adherence to ESLint guidelines is appreciated.

## License

This project is licensed under the terms specified in the [LICENSE](LICENSE) file.