/**
 * E6B Flight Computer - Mathematical Core
 */

const E6BCalculator = {
  // --- Atmospheric Group ---

  /**
   * Calculates Pressure (hPa) at a given Pressure Altitude (feet)
   * @param {number} pressureAlt - Pressure Altitude in feet
   * @returns {number} Pressure in hPa
   */
  calculatePressure: function(pressureAlt) {
    return 1013.25 * Math.pow(1 - 6.8755856e-6 * pressureAlt, 5.25588);
  },

  /**
   * Calculates Air Density (kg/m^3)
   * @param {number} pressure - Pressure in hPa
   * @param {number} oat - Outside Air Temperature in Celsius
   * @returns {number} Air Density in kg/m^3
   */
  calculateDensity: function(pressure, oat) {
    const tempK = oat + 273.15;
    return (pressure * 100) / (287.05 * tempK);
  },

  /**
   * Calculates Density Altitude (feet)
   * @param {number} pressureAlt - Pressure Altitude in feet
   * @param {number} oat - Outside Air Temperature in Celsius
   * @returns {number} Density Altitude in feet
   */
  calculateDensityAltitude: function(pressureAlt, oat) {
    // Standard temperature at pressure altitude
    const standardTemp = 15 - 1.98 * (pressureAlt / 1000);
    // ISA deviation
    const isaDeviation = oat - standardTemp;
    // Standard approximation: 120 feet per degree C deviation
    return pressureAlt + 120 * isaDeviation;
  },

  /**
   * Calculates True Airspeed (knots) from IAS, Pressure Altitude, and OAT
   * @param {number} ias - Indicated Airspeed in knots
   * @param {number} pressureAlt - Pressure Altitude in feet
   * @param {number} oat - Outside Air Temperature in Celsius
   * @returns {number} True Airspeed in knots
   */
  calculateTAS: function(ias, pressureAlt, oat) {
    if (ias <= 0) return 0;
    
    const pSl = 1013.25;
    const rhoSl = 1.225;
    
    // Station pressure
    const press = this.calculatePressure(pressureAlt);
    // Density
    const rho = this.calculateDensity(press, oat);
    // Density ratio
    const sigma = rho / rhoSl;
    
    if (sigma <= 0) return 0;
    
    // TAS = IAS / sqrt(sigma)
    return ias / Math.sqrt(sigma);
  },

  // --- Wind Triangle Group ---

  /**
   * Solves the Wind Triangle
   * @param {number} course - Desired Ground Track in degrees (0-360)
   * @param {number} windDir - Wind Direction in degrees (0-360) (direction FROM which wind blows)
   * @param {number} windSpeed - Wind Speed in knots
   * @param {number} tas - True Airspeed in knots
   * @returns {object} { wca: number, heading: number, gs: number, impossible: boolean, headwind: number, crosswind: number }
   */
  solveWindTriangle: function(course, windDir, windSpeed, tas) {
    // Normalize angles
    const cDeg = (course + 360) % 360;
    const wDeg = (windDir + 360) % 360;
    
    const cRad = cDeg * Math.PI / 180;
    const wRad = wDeg * Math.PI / 180;
    
    let impossible = false;
    let wcaDeg = 0;
    let headingDeg = cDeg;
    let gs = tas;
    
    // Calculate headwind and crosswind components
    // Wind Angle relative to course
    const relativeWindAngle = (wDeg - cDeg + 360) % 360;
    const relativeWindAngleRad = relativeWindAngle * Math.PI / 180;
    
    // Headwind component: Positive means headwind, negative means tailwind
    const headwind = windSpeed * Math.cos(relativeWindAngleRad);
    // Crosswind component: Positive means from right, negative means from left
    const crosswind = windSpeed * Math.sin(relativeWindAngleRad);
    
    if (tas <= 0) {
      return {
        wca: 0,
        heading: cDeg,
        gs: 0,
        impossible: true,
        headwind: headwind,
        crosswind: crosswind
      };
    }
    
    // WCA = arcsin((WS * sin(Wdir - C)) / TAS)
    const ratio = (windSpeed * Math.sin(wRad - cRad)) / tas;
    
    if (Math.abs(ratio) > 1) {
      // Wind speed is greater than TAS, impossible to maintain course
      impossible = true;
      wcaDeg = ratio > 0 ? 90 : -90;
      headingDeg = (cDeg + wcaDeg + 360) % 360;
      gs = 0;
    } else {
      const wcaRad = Math.asin(ratio);
      wcaDeg = wcaRad * 180 / Math.PI;
      headingDeg = (cDeg + wcaDeg + 360) % 360;
      
      // GS = TAS * cos(WCA) - WS * cos(C - Wdir)
      gs = tas * Math.cos(wcaRad) - windSpeed * Math.cos(cRad - wRad);
      
      if (gs < 0) {
        gs = 0;
        impossible = true;
      }
    }
    
    return {
      wca: Math.round(wcaDeg * 10) / 10,
      heading: Math.round(headingDeg),
      gs: Math.round(gs * 10) / 10,
      impossible: impossible,
      headwind: Math.round(headwind * 10) / 10,
      crosswind: Math.round(crosswind * 10) / 10
    };
  },

  // --- Fuel & Time Group ---

  /**
   * Calculates Flight Duration (hours) and Fuel Burned (gallons)
   * @param {number} distance - Leg distance in nautical miles
   * @param {number} gs - Ground Speed in knots
   * @param {number} fuelFlow - Fuel Flow in gallons per hour
   * @returns {object} { durationHrs: number, eteStr: string, fuelBurned: number }
   */
  calculateLegPerformance: function(distance, gs, fuelFlow) {
    if (gs <= 0) {
      return {
        durationHrs: Infinity,
        eteStr: "--h --m --s",
        fuelBurned: Infinity
      };
    }
    
    const durationHrs = distance / gs;
    const fuelBurned = durationHrs * fuelFlow;
    
    // Format ETE: HH:MM:SS
    const totalSeconds = Math.round(durationHrs * 3600);
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    
    const pad = (num) => String(num).padStart(2, '0');
    const eteStr = `${hrs}h ${pad(mins)}m ${pad(secs)}s`;
    
    return {
      durationHrs: durationHrs,
      eteStr: eteStr,
      fuelBurned: Math.round(fuelBurned * 100) / 100
    };
  },

  // --- Conversions ---

  knotsToMph: function(kts) {
    return kts * 1.15078;
  },

  mphToKnots: function(mph) {
    return mph / 1.15078;
  },

  knotsToKmh: function(kts) {
    return kts * 1.852;
  },

  kmhToKnots: function(kmh) {
    return kmh / 1.852;
  },

  celsiusToFahrenheit: function(c) {
    return (c * 9/5) + 32;
  },

  fahrenheitToCelsius: function(f) {
    return (f - 32) * 5/9;
  },

  feetToMeters: function(ft) {
    return ft * 0.3048;
  },

  metersToFeet: function(m) {
    return m / 0.3048;
  },

  litersToGallons: function(l) {
    return l * 0.264172;
  },

  gallonsToLiters: function(gal) {
    return gal / 0.264172;
  }
};

// Dual-module compatibility pattern
if (typeof module !== 'undefined' && module.exports) {
  module.exports = E6BCalculator;
} else {
  window.E6BCalculator = E6BCalculator;
}
