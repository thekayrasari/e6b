/**
 * E6B Flight Computer - Test Suite
 */

const E6BCalculator = require('./calculator.js');

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function runTests() {
  console.log("=== Running E6B Flight Computer Tests ===");
  let passed = 0;
  let failed = 0;

  function testCase(name, fn) {
    try {
      fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (e) {
      console.error(`[FAIL] ${name}`);
      console.error(e.message);
      failed++;
    }
  }

  // Test 1: Atmospheric Calculations (Standard Conditions at Sea Level)
  testCase("Standard Conditions at Sea Level", () => {
    // Sea level, 15°C, 120 IAS should yield TAS of 120 and DA of 0
    const da = E6BCalculator.calculateDensityAltitude(0, 15);
    const tas = E6BCalculator.calculateTAS(120, 0, 15);
    
    assert(Math.abs(da) < 1, `Expected DA near 0, got ${da}`);
    assert(Math.abs(tas - 120) < 0.1, `Expected TAS near 120, got ${tas}`);
  });

  // Test 2: Atmospheric Calculations at Altitude
  testCase("Density Altitude & TAS at 5,000 ft", () => {
    // 5000 ft PA, 15°C, 120 IAS
    const da = E6BCalculator.calculateDensityAltitude(5000, 15);
    const tas = E6BCalculator.calculateTAS(120, 5000, 15);
    
    // Standard Temp at 5000 ft is 15 - 1.98 * 5 = 5.1°C
    // Deviation is 15 - 5.1 = 9.9°C
    // DA = 5000 + 120 * 9.9 = 6188
    assert(Math.abs(da - 6188) < 1, `Expected DA of 6188, got ${da}`);
    // Check TAS: Density ratio sigma ~ 0.832. TAS = 120 / sqrt(sigma) = 131.6
    assert(Math.abs(tas - 131.6) < 0.5, `Expected TAS near 131.6, got ${tas}`);
  });

  // Test 3: Wind Triangle (Direct Headwind)
  testCase("Direct Headwind", () => {
    // Course: 180, Wind: 180 / 15 kts, TAS: 150 kts
    const result = E6BCalculator.solveWindTriangle(180, 180, 15, 150);
    
    assert(result.wca === 0, `Expected WCA of 0, got ${result.wca}`);
    assert(result.heading === 180, `Expected Heading of 180, got ${result.heading}`);
    assert(result.gs === 135, `Expected GS of 135, got ${result.gs}`);
    assert(result.headwind === 15, `Expected headwind component of 15, got ${result.headwind}`);
    assert(result.crosswind === 0, `Expected crosswind component of 0, got ${result.crosswind}`);
    assert(!result.impossible, "Flight should be possible");
  });

  // Test 4: Wind Triangle (Direct Tailwind)
  testCase("Direct Tailwind", () => {
    // Course: 045, Wind: 225 / 30 kts, TAS: 100 kts
    const result = E6BCalculator.solveWindTriangle(45, 225, 30, 100);
    
    assert(result.wca === 0, `Expected WCA of 0, got ${result.wca}`);
    assert(result.heading === 45, `Expected Heading of 45, got ${result.heading}`);
    assert(result.gs === 130, `Expected GS of 130, got ${result.gs}`);
    assert(result.headwind === -30, `Expected headwind component of -30 (tailwind), got ${result.headwind}`);
    assert(result.crosswind === 0, `Expected crosswind component of 0, got ${result.crosswind}`);
    assert(!result.impossible, "Flight should be possible");
  });

  // Test 5: Wind Triangle (Pure Crosswind from Right)
  testCase("Pure Crosswind from Right", () => {
    // Course: 360, Wind: 090 / 20 kts, TAS: 120 kts
    const result = E6BCalculator.solveWindTriangle(360, 90, 20, 120);
    
    // WCA = arcsin(20 / 120) = arcsin(1/6) = 9.59 degrees
    // TH = 360 + 9.59 = 369.59 = 9.59 (rounded to 10 for heading, 9.6 for WCA)
    // GS = 120 * cos(9.59) - 0 = 118.3 kts
    assert(Math.abs(result.wca - 9.6) < 0.1, `Expected WCA of 9.6, got ${result.wca}`);
    assert(result.heading === 10, `Expected Heading of 10, got ${result.heading}`);
    assert(Math.abs(result.gs - 118.3) < 0.2, `Expected GS near 118.3, got ${result.gs}`);
    assert(Math.abs(result.headwind) < 0.1, `Expected headwind near 0, got ${result.headwind}`);
    assert(result.crosswind === 20, `Expected crosswind of 20, got ${result.crosswind}`);
    assert(!result.impossible, "Flight should be possible");
  });

  // Test 6: Fuel and ETE Calculations
  testCase("Leg Performance (ETE & Fuel)", () => {
    // Distance: 250 nm, GS: 125 kts, Fuel Flow: 10.0 gph
    const result = E6BCalculator.calculateLegPerformance(250, 125, 10.0);
    
    // Duration: 250 / 125 = 2.0 hours
    // Fuel: 2.0 * 10 = 20 gallons
    // ETE: 2h 00m 00s
    assert(result.durationHrs === 2.0, `Expected duration of 2.0, got ${result.durationHrs}`);
    assert(result.fuelBurned === 20.0, `Expected fuel burned of 20.0, got ${result.fuelBurned}`);
    assert(result.eteStr === "2h 00m 00s", `Expected ETE string '2h 00m 00s', got '${result.eteStr}'`);
  });

  // Test 7: Strong Wind (Impossible Flight)
  testCase("Strong Wind (Impossible Flight)", () => {
    // Course: 360, Wind: 090 / 150 kts, TAS: 120 kts
    // Wind is stronger than TAS (150 > 120), so ratio = 150/120 = 1.25 > 1
    const result = E6BCalculator.solveWindTriangle(360, 90, 150, 120);
    
    assert(result.impossible, "Flight should be flagged as impossible");
    assert(result.gs === 0, "Ground Speed should be capped at 0");
  });

  console.log(`\n=== Test Results: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
