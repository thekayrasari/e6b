import { useState, useEffect, useRef, useCallback } from "react";

// ─────────────────────────────────────────────
// PURE CALCULATION FUNCTIONS
// ─────────────────────────────────────────────

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

/** ISA temperature at a given pressure altitude (°C) */
function isaTemp(altFt) {
  return 15 - 1.98 * (altFt / 1000);
}

/**
 * Wind Correction Angle (WCA) using vector method.
 * windDir: FROM direction (met convention), all angles in degrees.
 * Returns { wca, gs, trueHeading } or { error }
 */
function calcWind(trueCourse, tas, windDir, windSpeed) {
  if (tas <= 0) return { error: "TAS must be > 0" };
  // Wind angle relative to course
  const windAngle = (windDir - trueCourse) * DEG;
  const sinWCA = (windSpeed * Math.sin(windAngle)) / tas;
  if (Math.abs(sinWCA) > 1) return { error: "NO SOLUTION — wind exceeds TAS" };
  const wca = Math.asin(sinWCA) * RAD; // degrees, + = right correction
  const trueHeading = ((trueCourse + wca) % 360 + 360) % 360;
  // Ground speed via vector resolution
  const gs = tas * Math.cos(wca * DEG) - windSpeed * Math.cos(windAngle);
  if (gs <= 0) return { error: "NO SOLUTION — headwind exceeds TAS" };
  return { wca, gs, trueHeading };
}

/** Time-Speed-Distance. Pass null for the one to solve. */
function calcTSD(dist, gs, timeMin) {
  if (dist === null && gs > 0 && timeMin > 0)
    return { dist: gs * (timeMin / 60) };
  if (timeMin === null && gs > 0 && dist > 0)
    return { timeMin: (dist / gs) * 60 };
  if (gs === null && dist > 0 && timeMin > 0)
    return { gs: dist / (timeMin / 60) };
  return {};
}

/** Fuel planning */
function calcFuel(flow, onboard, timeMin) {
  const endurance = flow > 0 ? (onboard / flow) * 60 : null; // minutes
  const required = flow > 0 && timeMin > 0 ? flow * (timeMin / 60) : null;
  return { endurance, required };
}

/**
 * True Airspeed from CAS.
 * Uses density altitude via ISA deviation method.
 */
function calcTAS(cas, pressAltFt, oatC) {
  const isaDev = oatC - isaTemp(pressAltFt);
  // Density altitude (ft) = PA + 120 * ISA_deviation
  const densAlt = pressAltFt + 120 * isaDev;
  // rho/rho0 approximation via density altitude
  // Standard lapse: rho ratio ≈ (1 - 6.8755856e-6 * DA)^4.2558797
  const rhoRatio = Math.pow(Math.max(1 - 6.8755856e-6 * densAlt, 0.001), 4.2558797);
  const tas = cas / Math.sqrt(rhoRatio);
  // Mach number: speed of sound at OAT (m/s) = 340.29 * sqrt(T/288.15)
  const sos_kt = 661.47 * Math.sqrt((oatC + 273.15) / 288.15);
  const mach = tas / sos_kt;
  return { densAlt, isaDev, tas, mach };
}

/** Pressure Altitude from indicated alt and altimeter setting */
function calcPressAlt(indicatedFt, qnh_inHg) {
  return indicatedFt + (29.92 - qnh_inHg) * 1000;
}

/** Crosswind / headwind components */
function calcCrosswind(rwyHdg, windDir, windSpeed) {
  const angle = ((windDir - rwyHdg) * DEG + Math.PI * 2) % (Math.PI * 2);
  const hw = windSpeed * Math.cos(angle);
  const xw = windSpeed * Math.sin(angle);
  return { headwind: hw, crosswind: xw };
}

/** Top of descent distance (nm) for 3° — geometry only, GS-independent */
function calcTOD(altToLose) {
  if (altToLose <= 0) return null;
  // tan(3°) × 6076.1 ft/nm = 318.5 ft/nm
  return altToLose / 318.5;
}

// ─────────────────────────────────────────────
// UNIT CONVERSION HELPERS
// ─────────────────────────────────────────────
const conversions = {
  "nm → sm": (v) => v * 1.15078,
  "sm → nm": (v) => v / 1.15078,
  "nm → km": (v) => v * 1.852,
  "km → nm": (v) => v / 1.852,
  "sm → km": (v) => v * 1.60934,
  "km → sm": (v) => v / 1.60934,
  "kg → lbs": (v) => v * 2.20462,
  "lbs → kg": (v) => v / 2.20462,
  "L → US gal": (v) => v * 0.264172,
  "US gal → L": (v) => v / 0.264172,
  "L → Imp gal": (v) => v * 0.219969,
  "Imp gal → L": (v) => v / 0.219969,
  "°C → °F": (v) => v * 1.8 + 32,
  "°F → °C": (v) => (v - 32) / 1.8,
  "hPa → inHg": (v) => v * 0.02953,
  "inHg → hPa": (v) => v / 0.02953,
  "ft → m": (v) => v * 0.3048,
  "m → ft": (v) => v / 0.3048,
};

// ─────────────────────────────────────────────
// WIND VECTOR CANVAS
// ─────────────────────────────────────────────
function WindCanvas({ trueCourse, tas, windDir, windSpeed, result }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H / 2;
    const scale = Math.min(W, H) * 0.36;

    ctx.clearRect(0, 0, W, H);

    // Background grid (faint)
    ctx.strokeStyle = "rgba(255,180,0,0.07)";
    ctx.lineWidth = 1;
    for (let r = scale * 0.25; r <= scale * 1.1; r += scale * 0.25) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Cross hairs
    ctx.strokeStyle = "rgba(255,180,0,0.1)";
    ctx.beginPath(); ctx.moveTo(cx, cy - scale * 1.1); ctx.lineTo(cx, cy + scale * 1.1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - scale * 1.1, cy); ctx.lineTo(cx + scale * 1.1, cy); ctx.stroke();

    // North label
    ctx.fillStyle = "rgba(255,180,0,0.4)";
    ctx.font = "bold 11px 'Share Tech Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText("N", cx, cy - scale * 1.05);

    if (!result || result.error) {
      ctx.fillStyle = "#ff4444";
      ctx.font = "bold 13px 'Share Tech Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText(result?.error || "AWAITING INPUT", cx, cy);
      return;
    }

    const { wca, gs, trueHeading } = result;
    // Convert angles: screen 0° = up (north), clockwise
    const courseRad = (trueCourse - 90) * DEG;
    const headingRad = (trueHeading - 90) * DEG;
    const windRad = (windDir - 90 + 180) * DEG; // wind vector goes TO

    const maxLen = Math.max(tas, gs, windSpeed, 1);
    const tasLen = (tas / maxLen) * scale;
    const gsLen = (gs / maxLen) * scale;
    const windLen = (windSpeed / maxLen) * scale;

    // Draw arrow helper
    const arrow = (x1, y1, x2, y2, color, width, dash = []) => {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = width;
      ctx.setLineDash(dash);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.setLineDash([]);
      // Arrowhead
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const al = 10, aw = 5;
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - al * Math.cos(angle - 0.4), y2 - al * Math.sin(angle - 0.4));
      ctx.lineTo(x2 - al * Math.cos(angle + 0.4), y2 - al * Math.sin(angle + 0.4));
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };

    // TRUE COURSE vector (amber dashed)
    const tcx2 = cx + tasLen * Math.cos(courseRad);
    const tcy2 = cy + tasLen * Math.sin(courseRad);
    arrow(cx, cy, tcx2, tcy2, "rgba(255,180,0,0.4)", 1.5, [5, 4]);

    // WIND vector (cyan)
    const windX = cx + windLen * Math.cos(windRad);
    const windY = cy + windLen * Math.sin(windRad);
    arrow(cx, cy, windX, windY, "#00cccc", 2);

    // TRUE HEADING / TAS vector (bright amber)
    const thx2 = cx + tasLen * Math.cos(headingRad);
    const thy2 = cy + tasLen * Math.sin(headingRad);
    arrow(cx, cy, thx2, thy2, "#ffb800", 2.5);

    // GROUND SPEED resultant (green)
    const gsx2 = cx + gsLen * Math.cos(courseRad);
    const gsy2 = cy + gsLen * Math.sin(courseRad);
    arrow(cx, cy, gsx2, gsy2, "#00ff88", 3);

    // WCA arc
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,100,0.6)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const arcR = tasLen * 0.35;
    const a1 = courseRad, a2 = headingRad;
    ctx.arc(cx, cy, arcR, Math.min(a1, a2), Math.max(a1, a2));
    ctx.stroke();
    // WCA label
    const midAngle = (a1 + a2) / 2;
    ctx.fillStyle = "#ffff66";
    ctx.font = "bold 10px 'Share Tech Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText(`${Math.abs(wca).toFixed(1)}°`, cx + (arcR + 12) * Math.cos(midAngle), cy + (arcR + 12) * Math.sin(midAngle));
    ctx.restore();

    // Legend
    const legend = [
      { color: "#ffb800", label: "TRUE HEADING / TAS" },
      { color: "#00ff88", label: `GND SPEED ${gs.toFixed(0)} kt` },
      { color: "#00cccc", label: `WIND ${windSpeed} kt` },
      { color: "rgba(255,180,0,0.4)", label: "TRUE COURSE" },
    ];
    legend.forEach((l, i) => {
      ctx.fillStyle = l.color;
      ctx.font = "9px 'Share Tech Mono', monospace";
      ctx.textAlign = "left";
      ctx.fillRect(8, 8 + i * 16, 12, 2);
      ctx.fillText(l.label, 24, 14 + i * 16);
    });
  }, [trueCourse, tas, windDir, windSpeed, result]);

  return (
    <canvas
      ref={canvasRef}
      width={360}
      height={360}
      style={{ width: "100%", maxWidth: 360, display: "block", margin: "0 auto" }}
    />
  );
}

// ─────────────────────────────────────────────
// SHARED UI PRIMITIVES
// ─────────────────────────────────────────────
function Field({ label, unit, value, onChange, placeholder, readOnly, caution }) {
  return (
    <div className="field" style={{ marginBottom: 10 }}>
      <label style={{ display: "block", fontSize: 10, letterSpacing: "0.1em", color: "var(--label)", marginBottom: 3, textTransform: "uppercase" }}>
        {label} {unit && <span style={{ color: "var(--accent2)" }}>[{unit}]</span>}
      </label>
      <input
        type="number"
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        placeholder={placeholder}
        readOnly={readOnly}
        style={{
          width: "100%",
          background: readOnly ? "var(--bg3)" : "var(--bg2)",
          border: `1px solid ${caution ? "#ff4444" : "var(--border)"}`,
          color: readOnly ? "var(--accent)" : "var(--fg)",
          fontFamily: "var(--mono)",
          fontSize: 15,
          padding: "6px 8px",
          borderRadius: 3,
          outline: "none",
          boxSizing: "border-box",
          transition: "border-color 0.2s",
        }}
      />
    </div>
  );
}

function OutputBox({ label, value, unit, caution, highlight }) {
  return (
    <div style={{
      background: "var(--bg2)",
      border: `1px solid ${caution ? "#ff4444" : highlight ? "var(--accent)" : "var(--border)"}`,
      borderRadius: 4,
      padding: "8px 12px",
      marginBottom: 8,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "baseline",
    }}>
      <span style={{ fontSize: 10, letterSpacing: "0.1em", color: "var(--label)", textTransform: "uppercase" }}>{label}</span>
      <span style={{ fontFamily: "var(--mono)", fontSize: 17, color: caution ? "#ff4444" : highlight ? "var(--accent)" : "var(--fg)", fontWeight: "bold" }}>
        {value} {unit && <span style={{ fontSize: 11, color: "var(--label)" }}>{unit}</span>}
      </span>
    </div>
  );
}

function SectionHeader({ children }) {
  return (
    <div style={{
      fontSize: 10,
      letterSpacing: "0.15em",
      color: "var(--accent)",
      textTransform: "uppercase",
      borderBottom: "1px solid var(--border)",
      paddingBottom: 4,
      marginBottom: 12,
      marginTop: 20,
      fontFamily: "var(--mono)",
    }}>
      {children}
    </div>
  );
}

function fmt(n, d = 1) {
  if (n === null || n === undefined || isNaN(n)) return "—";
  return n.toFixed(d);
}

function fmtTime(min) {
  if (!min || isNaN(min)) return "—";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

// ─────────────────────────────────────────────
// WIND SIDE PANEL
// ─────────────────────────────────────────────
function WindSide() {
  const [tc, setTc] = useState("270");
  const [tas, setTas] = useState("120");
  const [wd, setWd] = useState("310");
  const [ws, setWs] = useState("25");
  const [magVar, setMagVar] = useState("5");
  const [dev, setDev] = useState("2");

  const result = calcWind(+tc, +tas, +wd, +ws);
  const magHdg = result.trueHeading !== undefined ? ((result.trueHeading - +magVar + 360) % 360) : null;
  const compHdg = magHdg !== null ? ((magHdg - +dev + 360) % 360) : null;
  const xwResult = calcCrosswind(+tc, +wd, +ws);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
      {/* Left: inputs + outputs */}
      <div>
        <SectionHeader>▸ Course & Airspeed</SectionHeader>
        <Field label="True Course" unit="°" value={tc} onChange={setTc} placeholder="270" />
        <Field label="True Airspeed (TAS)" unit="kt" value={tas} onChange={setTas} placeholder="120" />
        <SectionHeader>▸ Wind</SectionHeader>
        <Field label="Wind Direction (FROM)" unit="°" value={wd} onChange={setWd} placeholder="310" />
        <Field label="Wind Speed" unit="kt" value={ws} onChange={setWs} placeholder="25" />
        <SectionHeader>▸ Results</SectionHeader>
        {result.error ? (
          <div style={{ color: "#ff4444", fontFamily: "var(--mono)", fontSize: 13, padding: "8px 0" }}>
            ⚠ CAUTION: {result.error}
          </div>
        ) : (
          <>
            <OutputBox label="Wind Correction Angle" value={`${result.wca >= 0 ? "+" : ""}${fmt(result.wca)}°`} highlight caution={Math.abs(result.wca) > 20} />
            <OutputBox label="Ground Speed" value={fmt(result.gs, 0)} unit="kt" highlight />
            <OutputBox label="True Heading" value={`${fmt(result.trueHeading, 0)}°`} />
            <OutputBox label="Headwind Component" value={`${fmt(xwResult.headwind, 0)}`} unit="kt" />
            <OutputBox label="Crosswind Component" value={`${Math.abs(xwResult.crosswind).toFixed(0)} (${xwResult.crosswind >= 0 ? "R" : "L"})`} unit="kt" />
          </>
        )}
        <SectionHeader>▸ Magnetic / Compass</SectionHeader>
        <Field label="Magnetic Variation (E+/W-)" unit="°" value={magVar} onChange={setMagVar} placeholder="5" />
        <Field label="Compass Deviation (E+/W-)" unit="°" value={dev} onChange={setDev} placeholder="2" />
        {magHdg !== null && (
          <>
            <OutputBox label="Magnetic Heading" value={`${fmt(magHdg, 0)}°`} />
            <OutputBox label="Compass Heading" value={`${fmt(compHdg, 0)}°`} />
          </>
        )}
      </div>
      {/* Right: canvas */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{
          background: "var(--bg2)",
          border: "1px solid var(--border)",
          borderRadius: 6,
          padding: 12,
          width: "100%",
          boxSizing: "border-box",
        }}>
          <div style={{ fontSize: 10, letterSpacing: "0.12em", color: "var(--label)", textAlign: "center", marginBottom: 8, fontFamily: "var(--mono)" }}>
            WIND VECTOR DIAGRAM
          </div>
          <WindCanvas trueCourse={+tc} tas={+tas} windDir={+wd} windSpeed={+ws} result={result} />
        </div>
        <div style={{
          marginTop: 12,
          background: "var(--bg2)",
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: "10px 14px",
          width: "100%",
          boxSizing: "border-box",
          fontFamily: "var(--mono)",
          fontSize: 11,
          color: "var(--label)",
          lineHeight: 1.6,
        }}>
          <div style={{ color: "var(--accent)", fontSize: 10, letterSpacing: "0.12em", marginBottom: 6 }}>FORMULA REFERENCE</div>
          <div>WCA = arcsin(Vw·sin(θ) / TAS)</div>
          <div>GS = TAS·cos(WCA) − Vw·cos(θ)</div>
          <div>TH = TC ± WCA</div>
          <div>MH = TH ∓ Var</div>
          <div>CH = MH ∓ Dev</div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// CALCULATOR SIDE PANEL
// ─────────────────────────────────────────────
function CalcTSD() {
  const [dist, setDist] = useState("120");
  const [gs, setGs] = useState("140");
  const [timeMin, setTimeMin] = useState("");
  const [solving, setSolving] = useState("time");

  let result = {};
  if (solving === "dist") result = calcTSD(null, +gs, +timeMin);
  if (solving === "time") result = calcTSD(+dist, +gs, null);
  if (solving === "gs") result = calcTSD(+dist, null, +timeMin);

  return (
    <div>
      <div style={{ marginBottom: 12, display: "flex", gap: 8 }}>
        {["dist", "time", "gs"].map((s) => (
          <button key={s} onClick={() => setSolving(s)} style={{
            flex: 1, padding: "5px 0", fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.1em",
            textTransform: "uppercase", background: solving === s ? "var(--accent)" : "var(--bg2)",
            color: solving === s ? "var(--bg1)" : "var(--fg)", border: "1px solid var(--border)",
            borderRadius: 3, cursor: "pointer",
          }}>
            Solve {s === "dist" ? "Distance" : s === "time" ? "Time" : "Speed"}
          </button>
        ))}
      </div>
      {solving !== "dist" && <Field label="Distance" unit="nm" value={dist} onChange={setDist} placeholder="120" />}
      {solving !== "gs" && <Field label="Ground Speed" unit="kt" value={gs} onChange={setGs} placeholder="140" />}
      {solving !== "time" && <Field label="Time" unit="min" value={timeMin} onChange={setTimeMin} placeholder="51" />}
      <div style={{ marginTop: 8 }}>
        {solving === "dist" && result.dist !== undefined && <OutputBox label="Distance" value={fmt(result.dist, 1)} unit="nm" highlight />}
        {solving === "time" && result.timeMin !== undefined && (
          <>
            <OutputBox label="Time" value={fmtTime(result.timeMin)} highlight />
            <OutputBox label="Time (minutes)" value={fmt(result.timeMin, 1)} unit="min" />
          </>
        )}
        {solving === "gs" && result.gs !== undefined && <OutputBox label="Ground Speed" value={fmt(result.gs, 1)} unit="kt" highlight />}
      </div>
    </div>
  );
}

function CalcFuel() {
  const [flow, setFlow] = useState("42");
  const [onboard, setOnboard] = useState("220");
  const [flightTime, setFlightTime] = useState("90");
  const res = calcFuel(+flow, +onboard, +flightTime);

  return (
    <div>
      <Field label="Fuel Flow" unit="lbs/hr or L/hr" value={flow} onChange={setFlow} placeholder="42" />
      <Field label="Fuel Onboard" unit="same unit" value={onboard} onChange={setOnboard} placeholder="220" />
      <Field label="Flight Time" unit="min" value={flightTime} onChange={setFlightTime} placeholder="90" />
      <div style={{ marginTop: 8 }}>
        <OutputBox label="Endurance" value={fmtTime(res.endurance)} highlight />
        <OutputBox label="Endurance (hours)" value={fmt(res.endurance !== null ? res.endurance / 60 : null, 2)} unit="hr" />
        <OutputBox label="Fuel Required" value={fmt(res.required, 1)} unit="same unit" />
        {res.required !== null && onboard && (
          <OutputBox
            label="Reserve"
            value={fmt(+onboard - res.required, 1)}
            unit="same unit"
            caution={+onboard - res.required < 0}
          />
        )}
      </div>
    </div>
  );
}

function CalcTAS() {
  const [cas, setCas] = useState("120");
  const [pa, setPa] = useState("8500");
  const [oat, setOat] = useState("-5");

  const res = calcTAS(+cas, +pa, +oat);

  return (
    <div>
      <Field label="Calibrated Airspeed (CAS)" unit="kt" value={cas} onChange={setCas} placeholder="120" />
      <Field label="Pressure Altitude" unit="ft" value={pa} onChange={setPa} placeholder="8500" />
      <Field label="Outside Air Temp (OAT)" unit="°C" value={oat} onChange={setOat} placeholder="-5" />
      <div style={{ marginTop: 8 }}>
        <OutputBox label="True Airspeed (TAS)" value={fmt(res.tas, 1)} unit="kt" highlight />
        <OutputBox label="Mach Number" value={`M ${fmt(res.mach, 3)}`} />
        <OutputBox label="Density Altitude" value={fmt(res.densAlt, 0)} unit="ft" caution={res.densAlt > 8000} />
        <OutputBox label="ISA Deviation" value={`${res.isaDev >= 0 ? "+" : ""}${fmt(res.isaDev, 1)}°C`} caution={Math.abs(res.isaDev) > 15} />
        <OutputBox label="ISA Temp at Altitude" value={fmt(isaTemp(+pa), 1)} unit="°C" />
        <div style={{ fontSize: 10, color: "var(--label)", fontFamily: "var(--mono)", marginTop: 6 }}>
          Note: CAS treated as EAS (no compressibility correction). Error is negligible below ~200 kt; increases at higher speeds/altitudes.
        </div>
      </div>
    </div>
  );
}

function CalcAlt() {
  const [indicAlt, setIndicAlt] = useState("5500");
  const [qnh, setQnh] = useState("29.65");
  const [oat, setOat] = useState("5");

  const pa = calcPressAlt(+indicAlt, +qnh);
  const isaDev = +oat - isaTemp(pa);
  const da = pa + 120 * isaDev;

  return (
    <div>
      <Field label="Indicated Altitude" unit="ft" value={indicAlt} onChange={setIndicAlt} placeholder="5500" />
      <Field label="Altimeter Setting (QNH)" unit="inHg" value={qnh} onChange={setQnh} placeholder="29.65" />
      <Field label="OAT" unit="°C" value={oat} onChange={setOat} placeholder="5" />
      <div style={{ marginTop: 8 }}>
        <OutputBox label="Pressure Altitude" value={fmt(pa, 0)} unit="ft" highlight />
        <OutputBox label="ISA Temp at PA" value={fmt(isaTemp(pa), 1)} unit="°C" />
        <OutputBox label="ISA Deviation" value={`${isaDev >= 0 ? "+" : ""}${fmt(isaDev, 1)}°C`} caution={Math.abs(isaDev) > 20} />
        <OutputBox label="Density Altitude" value={fmt(da, 0)} unit="ft" caution={da > 8000} highlight />
      </div>
    </div>
  );
}

function CalcConvert() {
  const [type, setType] = useState(Object.keys(conversions)[0]);
  const [val, setVal] = useState("100");
  const result = conversions[type] ? conversions[type](+val) : null;

  return (
    <div>
      <label style={{ fontSize: 10, letterSpacing: "0.1em", color: "var(--label)", textTransform: "uppercase", display: "block", marginBottom: 4 }}>
        Conversion
      </label>
      <select
        value={type}
        onChange={(e) => setType(e.target.value)}
        style={{
          width: "100%",
          background: "var(--bg2)",
          border: "1px solid var(--border)",
          color: "var(--fg)",
          fontFamily: "var(--mono)",
          fontSize: 13,
          padding: "6px 8px",
          borderRadius: 3,
          marginBottom: 10,
        }}
      >
        {Object.keys(conversions).map((k) => (
          <option key={k} value={k}>{k}</option>
        ))}
      </select>
      <Field label="Input Value" value={val} onChange={setVal} placeholder="100" />
      <OutputBox label={type} value={fmt(result, 4)} highlight />
    </div>
  );
}

function CalcTOD() {
  const [altLose, setAltLose] = useState("8000");
  const tod = calcTOD(+altLose);

  return (
    <div>
      <Field label="Altitude to Lose" unit="ft" value={altLose} onChange={setAltLose} placeholder="8000" />
      <div style={{ marginTop: 8 }}>
        <OutputBox label="TOD Distance (3° descent)" value={fmt(tod, 1)} unit="nm" highlight />
        <div style={{ fontSize: 10, color: "var(--label)", fontFamily: "var(--mono)", marginTop: 6 }}>
          Formula: Distance = AltLose ÷ (tan(3°) × 6076 ft/nm) ≈ AltLose ÷ 318.5
        </div>
        <div style={{ fontSize: 10, color: "var(--label)", fontFamily: "var(--mono)", marginTop: 4 }}>
          Note: distance is geometry only — ground speed affects descent time, not distance.
        </div>
      </div>
    </div>
  );
}

function CalcXwind() {
  const [rwy, setRwy] = useState("270");
  const [wd, setWd] = useState("310");
  const [ws, setWs] = useState("20");
  const res = calcCrosswind(+rwy, +wd, +ws);

  return (
    <div>
      <Field label="Runway Heading" unit="°" value={rwy} onChange={setRwy} placeholder="270" />
      <Field label="Wind Direction (FROM)" unit="°" value={wd} onChange={setWd} placeholder="310" />
      <Field label="Wind Speed" unit="kt" value={ws} onChange={setWs} placeholder="20" />
      <div style={{ marginTop: 8 }}>
        <OutputBox label={res.headwind >= 0 ? "Headwind" : "Tailwind"} value={fmt(Math.abs(res.headwind), 0)} unit="kt" caution={res.headwind < 0} highlight />
        <OutputBox label={`Crosswind (${res.crosswind >= 0 ? "Right" : "Left"})`} value={fmt(Math.abs(res.crosswind), 0)} unit="kt" caution={Math.abs(res.crosswind) > 15} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// CALCULATOR SIDE — tabbed sections
// ─────────────────────────────────────────────
const calcTabs = [
  { id: "tsd", label: "TSD", full: "Time / Speed / Distance", comp: CalcTSD },
  { id: "fuel", label: "FUEL", full: "Fuel Planning", comp: CalcFuel },
  { id: "tas", label: "TAS", full: "True Airspeed", comp: CalcTAS },
  { id: "alt", label: "ALT", full: "Altitude", comp: CalcAlt },
  { id: "xw", label: "XWIND", full: "Crosswind", comp: CalcXwind },
  { id: "tod", label: "TOD", full: "Top of Descent", comp: CalcTOD },
  { id: "conv", label: "UNITS", full: "Unit Converter", comp: CalcConvert },
];

function CalcSide() {
  const [activeTab, setActiveTab] = useState("tsd");
  const Active = calcTabs.find((t) => t.id === activeTab)?.comp || CalcTSD;
  const activeLabel = calcTabs.find((t) => t.id === activeTab)?.full || "";

  return (
    <div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 16 }}>
        {calcTabs.map((t) => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            padding: "5px 10px",
            fontFamily: "var(--mono)",
            fontSize: 10,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            background: activeTab === t.id ? "var(--accent)" : "var(--bg2)",
            color: activeTab === t.id ? "var(--bg1)" : "var(--fg)",
            border: `1px solid ${activeTab === t.id ? "var(--accent)" : "var(--border)"}`,
            borderRadius: 3,
            cursor: "pointer",
          }}>
            {t.label}
          </button>
        ))}
      </div>
      <div style={{
        fontSize: 11,
        color: "var(--accent2)",
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        marginBottom: 12,
        fontFamily: "var(--mono)",
        borderLeft: "2px solid var(--accent)",
        paddingLeft: 8,
      }}>
        {activeLabel}
      </div>
      <Active />
    </div>
  );
}

// ─────────────────────────────────────────────
// ROOT APP
// ─────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Orbitron:wght@400;600;800&display=swap');

  :root {
    --bg1: #0d0f0d;
    --bg2: #141a14;
    --bg3: #1c241c;
    --fg: #e8e8d8;
    --label: #7a8c7a;
    --accent: #ffb800;
    --accent2: #5fcf80;
    --border: #2a3a2a;
    --mono: 'Share Tech Mono', monospace;
    --display: 'Orbitron', sans-serif;
    --danger: #ff4444;
  }
  [data-theme="light"] {
    --bg1: #f0f0e8;
    --bg2: #e4e4d8;
    --bg3: #d8d8cc;
    --fg: #1a1a0a;
    --label: #5a6a4a;
    --accent: #b87800;
    --accent2: #2a8a40;
    --border: #bcbcaa;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: var(--bg1); color: var(--fg); font-family: var(--mono); }
  input[type=number] { -moz-appearance: textfield; }
  input[type=number]::-webkit-inner-spin-button,
  input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
  input:focus { border-color: var(--accent) !important; }
  select { cursor: pointer; }
  button { cursor: pointer; transition: all 0.15s; }
  button:hover { opacity: 0.85; }
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: var(--bg1); }
  ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
`;

export default function E6B() {
  const [panel, setPanel] = useState("wind");
  const [theme, setTheme] = useState("dark");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  return (
    <>
      <style>{CSS}</style>
      <div style={{
        minHeight: "100vh",
        background: "var(--bg1)",
        color: "var(--fg)",
        display: "flex",
        flexDirection: "column",
      }}>
        {/* Header */}
        <header style={{
          background: "var(--bg2)",
          borderBottom: "1px solid var(--border)",
          padding: "10px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <span style={{
              fontFamily: "var(--display)",
              fontSize: 20,
              fontWeight: 800,
              color: "var(--accent)",
              letterSpacing: "0.08em",
            }}>
              E6B
            </span>
            <span style={{ fontFamily: "var(--display)", fontSize: 11, color: "var(--label)", letterSpacing: "0.2em" }}>
              FLIGHT COMPUTER
            </span>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {/* Panel toggle */}
            <div style={{ display: "flex", border: "1px solid var(--border)", borderRadius: 4, overflow: "hidden" }}>
              {[
                { id: "wind", label: "◎ WIND SIDE" },
                { id: "calc", label: "⊟ CALCULATOR" },
              ].map((p) => (
                <button key={p.id} onClick={() => setPanel(p.id)} style={{
                  padding: "6px 14px",
                  fontFamily: "var(--mono)",
                  fontSize: 11,
                  letterSpacing: "0.1em",
                  background: panel === p.id ? "var(--accent)" : "transparent",
                  color: panel === p.id ? "var(--bg1)" : "var(--fg)",
                  border: "none",
                  borderRight: p.id === "wind" ? "1px solid var(--border)" : "none",
                }}>
                  {p.label}
                </button>
              ))}
            </div>

            {/* Theme toggle */}
            <button onClick={() => setTheme(t => t === "dark" ? "light" : "dark")} style={{
              background: "var(--bg3)",
              border: "1px solid var(--border)",
              color: "var(--fg)",
              fontFamily: "var(--mono)",
              fontSize: 11,
              padding: "6px 10px",
              borderRadius: 4,
            }}>
              {theme === "dark" ? "☀ DAY" : "◑ NIGHT"}
            </button>
          </div>
        </header>

        {/* Status bar */}
        <div style={{
          background: "var(--bg2)",
          borderBottom: "1px solid var(--border)",
          padding: "3px 24px",
          display: "flex",
          gap: 24,
          fontSize: 9,
          color: "var(--label)",
          fontFamily: "var(--mono)",
          letterSpacing: "0.1em",
        }}>
          <span style={{ color: "#00ff88" }}>● OFFLINE</span>
          <span>EFB v2.0</span>
          <span>FOR TRAINING USE ONLY</span>
          <span>VERIFY WITH CERTIFIED CHARTS</span>
        </div>

        {/* Main content */}
        <main style={{
          flex: 1,
          padding: "20px 24px",
          maxWidth: 1100,
          margin: "0 auto",
          width: "100%",
        }}>
          {panel === "wind" ? <WindSide /> : <CalcSide />}
        </main>

        <footer style={{
          borderTop: "1px solid var(--border)",
          padding: "8px 24px",
          fontSize: 9,
          color: "var(--label)",
          fontFamily: "var(--mono)",
          textAlign: "center",
          letterSpacing: "0.1em",
        }}>
          NOT FOR NAVIGATIONAL USE · ALL CALCULATIONS MUST BE VERIFIED WITH OFFICIAL CHARTS AND CERTIFIED AVIONICS
        </footer>
      </div>
    </>
  );
} 