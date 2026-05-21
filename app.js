/**
 * E6B Flight Computer - UI Controller & Telemetry Bindings
 */

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

const App = {
  // Active application state
  state: {
    course: 360,
    tas: 132,
    windDir: 90,
    windSpeed: 20,
    pressureAlt: 5000,
    oat: 15,
    ias: 120,
    distance: 240,
    fuelFlow: 8.5,
    
    // UI states
    activeTab: 'wind-triangle',
    bezelSyncCourse: true,
    isAccordionOpen: false
  },

  /**
   * Initializes input bindings, setups event listeners, and starts the visualizer
   */
  init: function() {
    // 1. Setup double-binding for numeric inputs + range sliders
    this.bindInputs();
    
    // 2. Initialize the visualizer canvas
    E6BVisualizer.init('simulationCanvas');
    
    // 3. Bind global callback for bezel rotating interaction
    window.updateCourseFromBezel = (newCourse) => {
      this.state.course = newCourse;
      
      // Update inputs without recursive trigger loops
      document.getElementById('input-course').value = newCourse;
      document.getElementById('slider-course').value = newCourse;
      
      // Recalculate
      this.calculateAll();
    };

    // 4. Run initial calculation pass
    this.calculateAll();
    
    // 5. Trigger initial reset of airplane to align physical simulation
    setTimeout(() => {
      resetAircraft();
    }, 100);
  },

  /**
   * Binds numeric inputs and their sliders together to ensure dual-control reactivity
   */
  bindInputs: function() {
    const bindings = [
      { id: 'course', stateKey: 'course', isInt: true },
      { id: 'tas', stateKey: 'tas', isInt: true },
      { id: 'wind-dir', stateKey: 'windDir', isInt: true },
      { id: 'wind-speed', stateKey: 'windSpeed', isInt: true },
      { id: 'pressure-alt', stateKey: 'pressureAlt', isInt: true },
      { id: 'oat', stateKey: 'oat', isInt: true },
      { id: 'ias', stateKey: 'ias', isInt: true },
      { id: 'distance', stateKey: 'distance', isInt: true },
      { id: 'fuel-flow', stateKey: 'fuelFlow', isInt: false }
    ];

    bindings.forEach(bind => {
      const numInput = document.getElementById(`input-${bind.id}`);
      const sliderInput = document.getElementById(`slider-${bind.id}`);
      
      if (!numInput || !sliderInput) return;

      const updateVal = (val) => {
        let parsed = bind.isInt ? parseInt(val, 10) : parseFloat(val);
        if (isNaN(parsed)) return;

        // Clamp values to input limits
        const min = bind.isInt ? parseInt(numInput.min, 10) : parseFloat(numInput.min);
        const max = bind.isInt ? parseInt(numInput.max, 10) : parseFloat(numInput.max);
        parsed = Math.max(min, Math.min(max, parsed));

        this.state[bind.stateKey] = parsed;
        numInput.value = parsed;
        sliderInput.value = parsed;

        // Special check: If atmospheric variables change, recalculate TAS first
        if (['pressureAlt', 'oat', 'ias'].includes(bind.stateKey)) {
          this.syncAtmosphericTAS();
        }

        // Trigger E6B recalculation loop
        this.calculateAll();
      };

      // Listener on number field change
      numInput.addEventListener('input', (e) => updateVal(e.target.value));
      // Listener on slider scroll
      sliderInput.addEventListener('input', (e) => updateVal(e.target.value));
    });
  },

  /**
   * Calculates aerodynamic TAS and updates the navigation TAS value
   */
  syncAtmosphericTAS: function() {
    const calcTAS = E6BCalculator.calculateTAS(
      this.state.ias,
      this.state.pressureAlt,
      this.state.oat
    );
    
    const roundedTAS = Math.round(calcTAS);
    
    // Update Wind Triangle state & active input controls
    this.state.tas = roundedTAS;
    
    const tasInput = document.getElementById('input-tas');
    const tasSlider = document.getElementById('slider-tas');
    
    if (tasInput && tasSlider) {
      tasInput.value = roundedTAS;
      tasSlider.value = roundedTAS;
    }
  },

  /**
   * Run the active aviation mathematical models and update dashboard readouts
   */
  calculateAll: function() {
    // 1. Solve Atmospherics
    const densityAlt = E6BCalculator.calculateDensityAltitude(
      this.state.pressureAlt,
      this.state.oat
    );
    const calcTAS = E6BCalculator.calculateTAS(
      this.state.ias,
      this.state.pressureAlt,
      this.state.oat
    );

    // Update Atmospherics UI
    document.getElementById('output-density-alt').textContent = `${Math.round(densityAlt).toLocaleString()} ft`;
    document.getElementById('output-calc-tas').textContent = `${Math.round(calcTAS)} kts`;

    // 2. Solve Wind Triangle
    const windResult = E6BCalculator.solveWindTriangle(
      this.state.course,
      this.state.windDir,
      this.state.windSpeed,
      this.state.tas
    );

    // Update Digital Outputs in panel A
    const gsVal = document.getElementById('output-gs');
    const thVal = document.getElementById('output-th');
    const wcaVal = document.getElementById('output-wca');
    const windCompVal = document.getElementById('output-wind-comp');
    const banner = document.getElementById('wind-warning-banner');

    if (windResult.impossible) {
      // Critical Alert state
      gsVal.textContent = "0 kts";
      gsVal.className = "output-value error";
      thVal.textContent = "ERR";
      thVal.className = "output-value error";
      wcaVal.textContent = "N/A";
      wcaVal.className = "output-value error";
      windCompVal.textContent = "-- / -- kts";
      
      banner.style.display = 'flex';
      
      document.getElementById('card-gs').className = "output-card impossible";
      document.getElementById('card-th').className = "output-card impossible";
    } else {
      // Normative computation state
      gsVal.textContent = `${windResult.gs} kts`;
      gsVal.className = "output-value highlight";
      
      thVal.textContent = `${windResult.heading}°`;
      thVal.className = "output-value";
      
      const sign = windResult.wca > 0 ? '+' : '';
      wcaVal.textContent = `${sign}${windResult.wca}°`;
      wcaVal.className = "output-value";
      
      // Format wind components: HW = positive, TW = negative
      const hwLabel = windResult.headwind >= 0 ? 'HW' : 'TW';
      const xwSide = windResult.crosswind >= 0 ? 'R' : 'L';
      windCompVal.textContent = `${Math.abs(windResult.headwind)}k ${hwLabel} | ${Math.abs(windResult.crosswind)}k ${xwSide}`;
      
      banner.style.display = 'none';
      
      document.getElementById('card-gs').className = "output-card highlight";
      document.getElementById('card-th').className = "output-card highlight";
    }

    // 3. Solve Leg & Fuel Burn
    const legResult = E6BCalculator.calculateLegPerformance(
      this.state.distance,
      windResult.impossible ? 0 : windResult.gs,
      this.state.fuelFlow
    );

    document.getElementById('output-ete').textContent = legResult.eteStr;
    document.getElementById('output-fuel-burn').textContent = windResult.impossible ? "-- gal" : `${legResult.fuelBurned} gal`;

    // 4. Update Compass Rose HUD readouts
    document.getElementById('hud-trk').textContent = `${String(this.state.course).padStart(3, '0')}°`;
    document.getElementById('hud-hdg').textContent = windResult.impossible ? 'ERR' : `${String(windResult.heading).padStart(3, '0')}°`;
    document.getElementById('hud-wind').textContent = `${String(this.state.windDir).padStart(3, '0')}° @ ${this.state.windSpeed}K`;
    document.getElementById('hud-gs').textContent = windResult.impossible ? '0 KTS' : `${Math.round(windResult.gs)} KTS`;

    // 5. Update Matter.js simulation state parameters
    E6BVisualizer.updateTelemetry({
      course: this.state.course,
      tas: this.state.tas,
      windDir: this.state.windDir,
      windSpeed: this.state.windSpeed,
      th: windResult.heading,
      wca: windResult.wca,
      gs: windResult.gs,
      impossible: windResult.impossible
    });
  }
};

/* ============================================================
   GLOBAL WINDOW HANDLERS (Called by HTML buttons & events)
   ============================================================ */

/**
 * Switch tabs in the Panel A calculator dashboard
 */
function switchTab(tabId) {
  // Update state
  App.state.activeTab = tabId;
  
  // Update tabs DOM
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
  
  document.getElementById(`tab-${tabId}`).classList.add('active');
  document.getElementById(`content-${tabId}`).classList.add('active');
}

/**
 * Toggle quick-conversions accordion panel
 */
function toggleAccordion() {
  App.state.isAccordionOpen = !App.state.isAccordionOpen;
  
  const content = document.getElementById('conv-accordion-content');
  const arrow = document.getElementById('accordion-arrow');
  
  if (App.state.isAccordionOpen) {
    content.classList.add('active');
    arrow.className = "fa-solid fa-chevron-up";
  } else {
    content.classList.remove('active');
    arrow.className = "fa-solid fa-chevron-down";
  }
}

/**
 * Pause / Resume flight physics runner
 */
function toggleSim() {
  const btn = document.getElementById('btn-toggle-sim');
  E6BVisualizer.isPaused = !E6BVisualizer.isPaused;
  
  if (E6BVisualizer.isPaused) {
    btn.innerHTML = '<i class="fa-solid fa-play"></i> Resume Sim';
    btn.className = "btn";
    E6BVisualizer.runner.enabled = false;
  } else {
    btn.innerHTML = '<i class="fa-solid fa-pause"></i> Pause Sim';
    btn.className = "btn primary";
    E6BVisualizer.runner.enabled = true;
  }
}

/**
 * Reset simulated plane position back to grommet origin
 */
function resetAircraft() {
  E6BVisualizer.resetAircraft();
}

/**
 * Toggles whether dragging the whiz-wheel bezel changes Course (TRK) in Panel A
 */
function toggleBezelSync() {
  const btn = document.getElementById('btn-toggle-bezel-sync');
  E6BVisualizer.syncBezelToCourse = !E6BVisualizer.syncBezelToCourse;
  
  if (E6BVisualizer.syncBezelToCourse) {
    btn.innerHTML = '<i class="fa-solid fa-link"></i> Bezel Sync: Course';
    btn.className = "btn";
    // Sync bezel angle to course immediately
    E6BVisualizer.bezelAngle = App.state.course;
    document.getElementById('true-index-val').textContent = `${Math.round(E6BVisualizer.bezelAngle)}°`;
  } else {
    btn.innerHTML = '<i class="fa-solid fa-link-slash"></i> Bezel Sync: OFF';
    btn.className = "btn active-state";
  }
}

/**
 * Toggles visibility of simulated wind airflow streaks
 */
function toggleParticles() {
  const btn = document.getElementById('btn-toggle-particles');
  E6BVisualizer.showParticles = !E6BVisualizer.showParticles;
  
  if (E6BVisualizer.showParticles) {
    btn.innerHTML = '<i class="fa-solid fa-wind"></i> Wind Lines: ON';
    btn.className = "btn";
  } else {
    btn.innerHTML = '<i class="fa-solid fa-eye-slash"></i> Wind Lines: OFF';
    btn.className = "btn active-state";
  }
}

/**
 * Form unit conversion solvers
 */
function convertSpeed(unit) {
  const ktsVal = document.getElementById('conv-kts');
  const mphVal = document.getElementById('conv-mph');
  const kmhVal = document.getElementById('conv-kmh');
  
  if (unit === 'kts') {
    const val = parseFloat(ktsVal.value) || 0;
    mphVal.value = (E6BCalculator.knotsToMph(val)).toFixed(1);
    kmhVal.value = (E6BCalculator.knotsToKmh(val)).toFixed(1);
  } else if (unit === 'mph') {
    const val = parseFloat(mphVal.value) || 0;
    const kts = E6BCalculator.mphToKnots(val);
    ktsVal.value = kts.toFixed(1);
    kmhVal.value = (E6BCalculator.knotsToKmh(kts)).toFixed(1);
  } else if (unit === 'kmh') {
    const val = parseFloat(kmhVal.value) || 0;
    const kts = E6BCalculator.kmhToKnots(val);
    ktsVal.value = kts.toFixed(1);
    mphVal.value = (E6BCalculator.knotsToMph(kts)).toFixed(1);
  }
}

function convertAlt(unit) {
  const ftVal = document.getElementById('conv-ft');
  const mVal = document.getElementById('conv-m');
  
  if (unit === 'ft') {
    const val = parseFloat(ftVal.value) || 0;
    mVal.value = (E6BCalculator.feetToMeters(val)).toFixed(1);
  } else if (unit === 'm') {
    const val = parseFloat(mVal.value) || 0;
    ftVal.value = (E6BCalculator.metersToFeet(val)).toFixed(1);
  }
}

function convertTemp(unit) {
  const cVal = document.getElementById('conv-c');
  const fVal = document.getElementById('conv-f');
  
  if (unit === 'c') {
    const val = parseFloat(cVal.value) || 0;
    fVal.value = (E6BCalculator.celsiusToFahrenheit(val)).toFixed(1);
  } else if (unit === 'f') {
    const val = parseFloat(fVal.value) || 0;
    cVal.value = (E6BCalculator.fahrenheitToCelsius(val)).toFixed(1);
  }
}
