/**
 * E6B Flight Computer - Vector Physics & Compass Visualizer
 */

const E6BVisualizer = {
  // Matter.js components
  engine: null,
  world: null,
  runner: null,
  aircraft: null,
  
  // Canvas configuration
  canvas: null,
  ctx: null,
  width: 500,
  height: 500,
  cx: 250,
  cy: 250,
  
  // Whiz-wheel state
  bezelAngle: 0,         // Rotation of the compass rose in degrees (0-360)
  isDraggingBezel: false,
  startDragAngle: 0,
  startBezelAngle: 0,
  syncBezelToCourse: true, // Auto-align bezel with course

  // Physics simulation settings
  isPaused: false,
  forceScale: 0.00004,   // Scales TAS/WS knots into Matter.js force magnitudes
  frictionAir: 0.03,     // Aerodynamic air drag coefficient
  speedScale: 0.015,     // Visual trail and particle speed scaling
  showParticles: true,
  
  // Simulated entities
  particles: [],
  trail: [],
  maxTrailLength: 100,
  
  // Current active flight telemetry
  telemetry: {
    course: 360,
    tas: 132,
    windDir: 90,
    windSpeed: 20,
    th: 360,
    wca: 0,
    gs: 118,
    impossible: false
  },

  /**
   * Initializes the Matter.js engine, canvas, and drawing loops
   */
  init: function(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    
    this.ctx = this.canvas.getContext('2d');
    
    // Set up canvas size and DPI scaling
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
    
    // Matter.js Engine Setup
    const { Engine, World, Bodies, Composite } = Matter;
    this.engine = Engine.create({
      gravity: { x: 0, y: 0 } // Aviation vector physics has zero gravity on the 2D plane
    });
    this.world = this.engine.world;
    
    // Spawn the aircraft as a lightweight triangular rigid body
    // Spawning at center (cx, cy)
    const aircraftPath = [
      { x: 0, y: -15 },  // Nose
      { x: 10, y: 12 },  // Right wingtip
      { x: 0, y: 6 },    // Tail slot
      { x: -10, y: 12 }  // Left wingtip
    ];
    
    this.aircraft = Bodies.fromVertices(this.cx, this.cy, aircraftPath, {
      frictionAir: this.frictionAir,
      mass: 1.0,
      label: 'aircraft',
      isSensor: true // Passes through everything, strictly for kinematic vector pathing
    });
    
    World.add(this.world, this.aircraft);
    
    // Start Matter.js Runner
    this.runner = Matter.Runner.create();
    Matter.Runner.run(this.runner, this.engine);
    
    // Mouse Event Handlers for Bezel rotation dragging
    this.setupInteractions();
    
    // Setup Wind airflow lines
    this.spawnParticles(35);
    
    // Start drawing loop
    this.tick();
  },

  /**
   * Resizes the canvas to match its high DPI and bounds
   */
  resizeCanvas: function() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    this.width = rect.width;
    this.height = rect.height;
    
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    
    this.ctx.scale(dpr, dpr);
    
    this.cx = this.width / 2;
    this.cy = this.height / 2;
  },

  /**
   * Spawns flow particles to visualize the wind vector field
   */
  spawnParticles: function(count) {
    this.particles = [];
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        length: Math.random() * 20 + 10,
        opacity: Math.random() * 0.4 + 0.1
      });
    }
  },

  /**
   * Binds mouse click-and-drag interactions to enable rotating the compass bezel
   */
  setupInteractions: function() {
    const box = document.getElementById('whizWheelBox');
    if (!box) return;
    
    const getAngle = (clientX, clientY) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = clientX - rect.left - this.cx;
      const y = clientY - rect.top - this.cy;
      return Math.atan2(y, x) * 180 / Math.PI;
    };
    
    const handleStart = (clientX, clientY) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = clientX - rect.left - this.cx;
      const y = clientY - rect.top - this.cy;
      const dist = Math.sqrt(x*x + y*y);
      
      // Bezel dragging occurs in the outer ring of the compass card (radius 160-240px)
      if (dist > 130 && dist < 240) {
        this.isDraggingBezel = true;
        this.startDragAngle = getAngle(clientX, clientY);
        this.startBezelAngle = this.bezelAngle;
        box.style.cursor = 'grabbing';
      }
    };
    
    const handleMove = (clientX, clientY) => {
      if (!this.isDraggingBezel) return;
      
      const currentAngle = getAngle(clientX, clientY);
      const angleDiff = currentAngle - this.startDragAngle;
      
      // Update bezel angle, wrapping around [0, 360) to align with natural mechanical drag direction
      let newBezelAngle = (this.startBezelAngle - angleDiff + 360) % 360;
      this.bezelAngle = Math.round(newBezelAngle);
      
      // Update UI header val
      document.getElementById('true-index-val').textContent = `${Math.round(this.bezelAngle)}°`;
      
      // If bezel sync is on, update the Course in Panel A!
      if (this.syncBezelToCourse && typeof window.updateCourseFromBezel === 'function') {
        window.updateCourseFromBezel(this.bezelAngle);
      }
    };
    
    const handleEnd = () => {
      if (this.isDraggingBezel) {
        this.isDraggingBezel = false;
        box.style.cursor = 'grab';
      }
    };
    
    // Desktop mouse events
    box.addEventListener('mousedown', (e) => handleStart(e.clientX, e.clientY));
    window.addEventListener('mousemove', (e) => handleMove(e.clientX, e.clientY));
    window.addEventListener('mouseup', handleEnd);
    
    // Mobile touch events
    box.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        handleStart(e.touches[0].clientX, e.touches[0].clientY);
      }
    });
    window.addEventListener('touchmove', (e) => {
      if (this.isDraggingBezel && e.touches.length === 1) {
        e.preventDefault(); // Stop mobile elastic bouncing
        handleMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: false });
    window.addEventListener('touchend', handleEnd);
  },

  /**
   * Updates flight telemetry parameters from the dashboard
   */
  updateTelemetry: function(data) {
    this.telemetry = { ...this.telemetry, ...data };
    
    // If bezel sync is on, lock bezel angle to course
    if (this.syncBezelToCourse && !this.isDraggingBezel) {
      this.bezelAngle = this.telemetry.course;
      document.getElementById('true-index-val').textContent = `${Math.round(this.bezelAngle)}°`;
    }
  },

  /**
   * Resets aircraft body back to the compass center grommet
   */
  resetAircraft: function() {
    if (!this.aircraft) return;
    
    Matter.Body.setPosition(this.aircraft, { x: this.cx, y: this.cy });
    Matter.Body.setVelocity(this.aircraft, { x: 0, y: 0 });
    this.trail = [];
  },

  /**
   * Core simulation & rendering loop (RAF)
   */
  tick: function() {
    requestAnimationFrame(() => this.tick());
    
    if (!this.isPaused && !this.telemetry.impossible) {
      this.applyFlightForces();
    }
    
    this.updateWindParticles();
    this.draw();
  },

  /**
   * Applies the mathematical E6B vectors as physical forces inside Matter.js
   */
  applyFlightForces: function() {
    if (!this.aircraft) return;
    
    const thRad = (this.telemetry.th * Math.PI) / 180;
    const windRad = (this.telemetry.windDir * Math.PI) / 180;
    
    // 1. Thrust Force: constant force acting along the True Heading (TH) vector
    // Standard coordinates: 0 deg = North (up, -y direction)
    const thrustX = Math.sin(thRad) * this.telemetry.tas * this.forceScale;
    const thrustY = -Math.cos(thRad) * this.telemetry.tas * this.forceScale;
    
    // 2. Wind Force: constant blowing force blowing TO (windDir + 180)
    // blowing to = -sin(windDir), cos(windDir) in standard aviation terms
    const windX = -Math.sin(windRad) * this.telemetry.windSpeed * this.forceScale;
    const windY = Math.cos(windRad) * this.telemetry.windSpeed * this.forceScale;
    
    // Apply forces directly to the plane
    Matter.Body.applyForce(this.aircraft, this.aircraft.position, { x: thrustX, y: thrustY });
    Matter.Body.applyForce(this.aircraft, this.aircraft.position, { x: windX, y: windY });
    
    // Force direct alignment rotation of physical aircraft body to point along True Heading (TH)
    // In aviation standard coordinates, North is -y, which corresponds to angle = 0 in our coordinate map.
    // Matter.js uses radians where 0 is East (+x), so we shift angle by Math.PI / 2
    Matter.Body.setAngle(this.aircraft, thRad - Math.PI / 2);
    
    // Log physical trajectory trail
    if (this.runner.enabled && !this.isPaused) {
      const pos = { ...this.aircraft.position };
      
      // If aircraft drifts too far from the center (80% of outer compass card boundary), wrap it back
      const dist = Math.hypot(pos.x - this.cx, pos.y - this.cy);
      if (dist > 185) {
        this.resetAircraft();
      } else {
        this.trail.push(pos);
        if (this.trail.length > this.maxTrailLength) {
          this.trail.shift();
        }
      }
    }
  },

  /**
   * Physics updates for wind airflow lines
   */
  updateWindParticles: function() {
    if (!this.showParticles || this.isPaused) return;
    
    const windRad = (this.telemetry.windDir * Math.PI) / 180;
    // Direction particle travels: TO direction = windDir + 180
    const vx = -Math.sin(windRad) * this.telemetry.windSpeed * this.speedScale * 2.5;
    const vy = Math.cos(windRad) * this.telemetry.windSpeed * this.speedScale * 2.5;
    
    this.particles.forEach(p => {
      p.x += vx;
      p.y += vy;
      
      // Wrap around bounds
      if (p.x < 0) p.x = this.width;
      if (p.x > this.width) p.x = 0;
      if (p.y < 0) p.y = this.height;
      if (p.y > this.height) p.y = 0;
    });
  },

  /**
   * Renders the complete E6B Whiz-Wheel vector graphic to the Canvas
   */
  draw: function() {
    this.ctx.clearRect(0, 0, this.width, this.height);
    
    // Draw E6B grid layers
    this.drawSlideGrid();       // Step 1: Base slide speed & drift grid
    this.drawCompassBezel();    // Step 2: Rotating transparent compass rose card
    this.drawWindFlow();        // Step 3: Flowing wind streaks
    this.drawTrail();           // Step 4: Actual drift track trail
    this.drawVectors();         // Step 5: High-contrast overlay vector arrows
    this.drawAircraft();        // Step 6: The physical plane body
    this.drawCenterGrommet();   // Step 7: Grommet pin axis
  },

  /**
   * Draws the sliding wind speed and drift angle grid (Backing Card)
   */
  drawSlideGrid: function() {
    const ctx = this.ctx;
    ctx.save();
    
    // Background color of the backing slide (minimal off-white drafting paper style)
    ctx.fillStyle = '#fafbfc';
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, 240, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#536b78';
    ctx.stroke();
    
    // Concentric Speed Arcs (knots)
    // Scale: 240px radius corresponds to 240 knots speed range (1px = 1 knot)
    ctx.strokeStyle = 'rgba(83, 107, 120, 0.15)';
    ctx.lineWidth = 1;
    
    for (let speed = 40; speed <= 240; speed += 20) {
      ctx.beginPath();
      ctx.arc(this.cx, this.cy, speed, 0, Math.PI * 2);
      ctx.stroke();
      
      // Speed Labels
      if (speed % 40 === 0) {
        ctx.fillStyle = 'rgba(83, 107, 120, 0.6)';
        ctx.font = '10px "Roboto Mono"';
        ctx.textAlign = 'center';
        ctx.fillText(speed, this.cx, this.cy - speed + 12);
      }
    }
    
    // Radial Drift Correction lines
    // Radiating from center at degrees Left and Right
    ctx.lineWidth = 1;
    for (let drift = -30; drift <= 30; drift += 10) {
      if (drift === 0) continue; // Center line handled separately
      
      ctx.strokeStyle = 'rgba(83, 107, 120, 0.08)';
      ctx.beginPath();
      const rad = (drift * Math.PI) / 180;
      
      // Draw radial drift lines spanning out to the boundary
      ctx.moveTo(this.cx, this.cy);
      ctx.lineTo(this.cx + Math.sin(rad) * 240, this.cy - Math.cos(rad) * 240);
      ctx.stroke();
      
      // Drift Angle Label at the outer rim
      ctx.fillStyle = 'rgba(83, 107, 120, 0.4)';
      ctx.font = '9px "Inter"';
      ctx.textAlign = 'center';
      const labelDist = 220;
      ctx.fillText(
        `${Math.abs(drift)}°${drift > 0 ? 'R' : 'L'}`,
        this.cx + Math.sin(rad) * labelDist,
        this.cy - Math.cos(rad) * labelDist + 4
      );
    }
    
    // Main vertical center course axis (Zero Drift line)
    ctx.strokeStyle = 'rgba(83, 107, 120, 0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(this.cx, this.cy - 240);
    ctx.lineTo(this.cx, this.cy + 240);
    ctx.stroke();
    
    ctx.restore();
  },

  /**
   * Draws the rotating bezel compass rose card on top of the slide
   */
  drawCompassBezel: function() {
    const ctx = this.ctx;
    ctx.save();
    
    // Rotate canvas around center grommet to represent bezel rotation
    ctx.translate(this.cx, this.cy);
    ctx.rotate((-this.bezelAngle * Math.PI) / 180);
    
    // Draw bezel ring border
    ctx.strokeStyle = '#536b78';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 238, 0, Math.PI * 2);
    ctx.stroke();
    
    // Outer glass dial ring
    ctx.strokeStyle = 'rgba(83, 107, 120, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, 215, 0, Math.PI * 2);
    ctx.stroke();
    
    // Draw Compass markings (0-360 degrees)
    for (let deg = 0; deg < 360; deg += 5) {
      ctx.save();
      ctx.rotate((deg * Math.PI) / 180);
      
      const isMajor = deg % 10 === 0;
      const isCardinal = deg % 90 === 0;
      
      ctx.strokeStyle = '#536b78';
      ctx.lineWidth = isCardinal ? 2 : (isMajor ? 1.5 : 0.8);
      
      // Draw tick marks extending inwards from the bezel
      const tickStart = 238;
      const tickEnd = isCardinal ? 222 : (isMajor ? 228 : 232);
      
      ctx.beginPath();
      ctx.moveTo(0, -tickStart);
      ctx.lineTo(0, -tickEnd);
      ctx.stroke();
      
      // Labels for every 30 degrees (written as single numbers, e.g. 3, 6, 9... 33)
      if (deg % 30 === 0) {
        ctx.fillStyle = '#536b78';
        ctx.font = isCardinal ? 'bold 13px "Roboto Mono"' : '11px "Roboto Mono"';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        let label = deg / 10;
        if (deg === 0) label = 'N';
        else if (deg === 90) label = 'E';
        else if (deg === 180) label = 'S';
        else if (deg === 270) label = 'W';
        
        ctx.fillText(label, 0, -204);
      }
      
      ctx.restore();
    }
    
    ctx.restore();
  },

  /**
   * Draws custom vector lines (Wind, Heading, Ground Speed)
   */
  drawVectors: function() {
    const ctx = this.ctx;
    
    const thRad = (this.telemetry.th * Math.PI) / 180;
    const courseRad = (this.telemetry.course * Math.PI) / 180;
    const windRad = (this.telemetry.windDir * Math.PI) / 180;
    
    // Arrow drawing helper
    const drawArrow = (fromX, fromY, toX, toY, color, width, isDashed = false) => {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = width;
      
      if (isDashed) {
        ctx.setLineDash([4, 4]);
      }
      
      // Draw line
      ctx.beginPath();
      ctx.moveTo(fromX, fromY);
      ctx.lineTo(toX, toY);
      ctx.stroke();
      
      // Draw arrowhead
      ctx.setLineDash([]); // Reset dash for arrow head
      const angle = Math.atan2(toY - fromY, toX - fromX);
      ctx.beginPath();
      ctx.moveTo(toX, toY);
      ctx.lineTo(toX - 10 * Math.cos(angle - Math.PI / 6), toY - 10 * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(toX - 10 * Math.cos(angle + Math.PI / 6), toY - 10 * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };
    
    // Vector magnitudes in pixels (corresponds directly to speed value)
    const tasLength = this.telemetry.tas;
    const windLength = this.telemetry.windSpeed * 2.5; // Scaled up to make wind vector distinct
    const gsLength = this.telemetry.gs;
    
    // 1. True Heading Vector (Aircraft direction of travel in calm air)
    // Starts at center, extends along TH.
    const thX = this.cx + Math.sin(thRad) * tasLength;
    const thY = this.cy - Math.cos(thRad) * tasLength;
    drawArrow(this.cx, this.cy, thX, thY, '#536b78', 2);
    
    // Vector Labels
    ctx.fillStyle = '#536b78';
    ctx.font = 'bold 9px "Inter"';
    ctx.fillText(`TAS: ${this.telemetry.tas}K`, thX + 8, thY);
    
    // 2. Wind Vector (Drift force)
    // Standard wind is plotted starting from the tip of the Heading vector!
    // Wind vector points in the direction the wind blows TO (windDir + 180)
    // blowing to = -sin(windDir), cos(windDir)
    const windEndX = thX - Math.sin(windRad) * windLength;
    const windEndY = thY + Math.cos(windRad) * windLength;
    drawArrow(thX, thY, windEndX, windEndY, '#ed6c02', 2, true);
    
    ctx.fillStyle = '#ed6c02';
    ctx.fillText(`WIND: ${this.telemetry.windSpeed}K`, windEndX + 8, windEndY);
    
    // 3. Resulting Ground Track Vector (GS)
    // Extends from center to the end of the wind vector (which is the actual ground path).
    // Mathematically, this equals the position the aircraft drifts to!
    drawArrow(this.cx, this.cy, windEndX, windEndY, '#2e7d32', 2.5);
    
    ctx.fillStyle = '#2e7d32';
    ctx.fillText(`GS: ${Math.round(this.telemetry.gs)}K`, windEndX - 35, windEndY - 10);
  },

  /**
   * Renders the simulated aircraft body at its physical position
   */
  drawAircraft: function() {
    if (!this.aircraft) return;
    
    const ctx = this.ctx;
    const pos = this.aircraft.position;
    const angle = this.aircraft.angle;
    
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(angle);
    
    // Solid airplane silhouette in brand slate-blue with a sharp white outline
    ctx.fillStyle = '#536b78';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    
    ctx.beginPath();
    ctx.moveTo(15, 0);       // Nose (rotated coordinates: 0 angle points East (+x))
    ctx.lineTo(-12, -10);    // Right wingtip
    ctx.lineTo(-6, 0);       // Tail slot
    ctx.lineTo(-12, 10);     // Left wingtip
    ctx.closePath();
    
    ctx.fill();
    ctx.stroke();
    
    ctx.restore();
  },

  /**
   * Draws a physical trail marking the aircraft's actual ground path
   */
  drawTrail: function() {
    if (this.trail.length < 2) return;
    
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = 'rgba(46, 125, 50, 0.4)'; // Transparent green course trail
    ctx.lineWidth = 3;
    ctx.setLineDash([2, 3]);
    
    ctx.beginPath();
    ctx.moveTo(this.trail[0].x, this.trail[0].y);
    for (let i = 1; i < this.trail.length; i++) {
      ctx.lineTo(this.trail[i].x, this.trail[i].y);
    }
    ctx.stroke();
    ctx.restore();
  },

  /**
   * Renders wind flow vector streaks
   */
  drawWindFlow: function() {
    if (!this.showParticles || this.telemetry.impossible) return;
    
    const ctx = this.ctx;
    const windRad = (this.telemetry.windDir * Math.PI) / 180;
    
    ctx.save();
    ctx.strokeStyle = 'rgba(237, 108, 2, 0.18)'; // Translucent orange wind lines
    ctx.lineWidth = 1;
    
    this.particles.forEach(p => {
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      // Particle tail points opposite of wind velocity vector (blown FROM)
      ctx.lineTo(
        p.x + Math.sin(windRad) * p.length,
        p.y - Math.cos(windRad) * p.length
      );
      ctx.stroke();
    });
    ctx.restore();
  },

  /**
   * Renders the center mechanical grommet eyelet of the slide computer
   */
  drawCenterGrommet: function() {
    const ctx = this.ctx;
    ctx.save();
    
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#536b78';
    ctx.lineWidth = 3;
    
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    // Draw core center pinhole
    ctx.fillStyle = '#536b78';
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, 2, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
  }
};
