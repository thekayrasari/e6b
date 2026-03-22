import { useState, useEffect, useRef } from "react";

// ─────────────────────────────────────────────
// PURE CALCULATION FUNCTIONS
// ─────────────────────────────────────────────

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

function isaTemp(altFt) {
  return 15 - 1.98 * (altFt / 1000);
}

function calcWind(trueCourse, tas, windDir, windSpeed) {
  if (tas <= 0) return { error: "TAS must be > 0" };
  const windAngle = (windDir - trueCourse) * DEG;
  const sinWCA = (windSpeed * Math.sin(windAngle)) / tas;
  if (Math.abs(sinWCA) > 1) return { error: "No solution — wind speed exceeds TAS" };
  const wca = Math.asin(sinWCA) * RAD;
  const trueHeading = ((trueCourse + wca) % 360 + 360) % 360;
  const gs = tas * Math.cos(wca * DEG) - windSpeed * Math.cos(windAngle);
  if (gs <= 0) return { error: "No solution — headwind component exceeds TAS" };
  return { wca, gs, trueHeading };
}

function calcTSD(dist, gs, timeMin) {
  if (dist === null && gs > 0 && timeMin > 0)   return { dist: gs * (timeMin / 60) };
  if (timeMin === null && gs > 0 && dist > 0)    return { timeMin: (dist / gs) * 60 };
  if (gs === null && dist > 0 && timeMin > 0)    return { gs: dist / (timeMin / 60) };
  return {};
}

function calcFuel(flow, onboard, timeMin) {
  const endurance = flow > 0 ? (onboard / flow) * 60 : null;
  const required  = flow > 0 && timeMin > 0 ? flow * (timeMin / 60) : null;
  return { endurance, required };
}

function calcTAS(cas, pressAltFt, oatC) {
  const isaDev   = oatC - isaTemp(pressAltFt);
  const densAlt  = pressAltFt + 120 * isaDev;
  const rhoRatio = Math.pow(Math.max(1 - 6.8755856e-6 * densAlt, 0.001), 4.2558797);
  const tas      = cas / Math.sqrt(rhoRatio);
  const sos_kt   = 661.47 * Math.sqrt((oatC + 273.15) / 288.15);
  const mach     = tas / sos_kt;
  return { densAlt, isaDev, tas, mach };
}

function calcPressAlt(indicatedFt, qnh_inHg) {
  return indicatedFt + (29.92 - qnh_inHg) * 1000;
}

function calcCrosswind(rwyHdg, windDir, windSpeed) {
  const angle = ((windDir - rwyHdg) * DEG + Math.PI * 2) % (Math.PI * 2);
  return { headwind: windSpeed * Math.cos(angle), crosswind: windSpeed * Math.sin(angle) };
}

function calcTOD(altToLose) {
  if (altToLose <= 0) return null;
  return altToLose / 318.5;
}

// ─────────────────────────────────────────────
// UNIT CONVERSIONS
// ─────────────────────────────────────────────
const conversions = {
  "nm → sm":       (v) => v * 1.15078,
  "sm → nm":       (v) => v / 1.15078,
  "nm → km":       (v) => v * 1.852,
  "km → nm":       (v) => v / 1.852,
  "sm → km":       (v) => v * 1.60934,
  "km → sm":       (v) => v / 1.60934,
  "kg → lbs":      (v) => v * 2.20462,
  "lbs → kg":      (v) => v / 2.20462,
  "L → US gal":    (v) => v * 0.264172,
  "US gal → L":    (v) => v / 0.264172,
  "L → Imp gal":   (v) => v * 0.219969,
  "Imp gal → L":   (v) => v / 0.219969,
  "°C → °F":       (v) => v * 1.8 + 32,
  "°F → °C":       (v) => (v - 32) / 1.8,
  "hPa → inHg":    (v) => v * 0.02953,
  "inHg → hPa":    (v) => v / 0.02953,
  "ft → m":        (v) => v * 0.3048,
  "m → ft":        (v) => v / 0.3048,
};

// ─────────────────────────────────────────────
// WIND VECTOR CANVAS
// ─────────────────────────────────────────────
function WindCanvas({ trueCourse, tas, windDir, windSpeed, result }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx   = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    const cx = W / 2, cy = H / 2;
    const scale = Math.min(W, H) * 0.36;

    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = "var(--bg1)";
    ctx.fillRect(0, 0, W, H);

    // Concentric range rings
    ctx.lineWidth = 0.5;
    for (let r = scale * 0.25; r <= scale * 1.1; r += scale * 0.25) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = "var(--border)";
      ctx.stroke();
    }
    // Cross hairs
    ctx.strokeStyle = "var(--border)";
    ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(cx, cy - scale * 1.1); ctx.lineTo(cx, cy + scale * 1.1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - scale * 1.1, cy); ctx.lineTo(cx + scale * 1.1, cy); ctx.stroke();

    // North label
    ctx.fillStyle = "var(--muted)";
    ctx.font = "500 11px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText("N", cx, cy - scale * 1.05);

    if (!result || result.error) {
      ctx.fillStyle = "var(--danger)";
      ctx.font = "400 11px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText(result?.error || "Awaiting input", cx, cy);
      return;
    }

    const { wca, gs, trueHeading } = result;
    const courseRad  = (trueCourse  - 90) * DEG;
    const headingRad = (trueHeading - 90) * DEG;
    const windRad    = (windDir - 90 + 180) * DEG;

    const maxLen = Math.max(tas, gs, windSpeed, 1);
    const tasLen  = (tas / maxLen) * scale;
    const gsLen   = (gs  / maxLen) * scale;
    const windLen = (windSpeed / maxLen) * scale;

    const arrow = (x1, y1, x2, y2, color, width, dash = []) => {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.fillStyle   = color;
      ctx.lineWidth   = width;
      ctx.setLineDash(dash);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.setLineDash([]);
      const a = Math.atan2(y2 - y1, x2 - x1);
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - 9 * Math.cos(a - 0.4), y2 - 9 * Math.sin(a - 0.4));
      ctx.lineTo(x2 - 9 * Math.cos(a + 0.4), y2 - 9 * Math.sin(a + 0.4));
      ctx.closePath(); ctx.fill();
      ctx.restore();
    };

    // True course (dashed, muted)
    arrow(cx, cy,
      cx + tasLen * Math.cos(courseRad),
      cy + tasLen * Math.sin(courseRad),
      "rgba(107,155,210,0.3)", 1.2, [5, 5]);

    // Wind vector (teal)
    arrow(cx, cy,
      cx + windLen * Math.cos(windRad),
      cy + windLen * Math.sin(windRad),
      "#4da8a8", 1.8);

    // True heading / TAS (accent blue)
    arrow(cx, cy,
      cx + tasLen * Math.cos(headingRad),
      cy + tasLen * Math.sin(headingRad),
      "#6b9bd2", 2.2);

    // Ground speed (gold)
    arrow(cx, cy,
      cx + gsLen * Math.cos(courseRad),
      cy + gsLen * Math.sin(courseRad),
      "#c4a35a", 2.5);

    // WCA arc
    ctx.save();
    ctx.strokeStyle = "rgba(196,163,90,0.5)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    const arcR    = tasLen * 0.35;
    const a1 = courseRad, a2 = headingRad;
    ctx.arc(cx, cy, arcR, Math.min(a1, a2), Math.max(a1, a2));
    ctx.stroke();
    const midA = (a1 + a2) / 2;
    ctx.fillStyle = "rgba(196,163,90,0.8)";
    ctx.font = "400 10px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText(`${Math.abs(wca).toFixed(1)}°`,
      cx + (arcR + 13) * Math.cos(midA),
      cy + (arcR + 13) * Math.sin(midA));
    ctx.restore();

    // Legend
    const legend = [
      { color: "#6b9bd2",              label: "True heading / TAS" },
      { color: "#c4a35a",              label: `Gnd speed  ${gs.toFixed(0)} kt` },
      { color: "#4da8a8",              label: `Wind  ${windSpeed} kt` },
      { color: "rgba(107,155,210,0.4)", label: "True course" },
    ];
    legend.forEach((l, i) => {
      ctx.fillStyle = l.color;
      ctx.font = "300 9px 'JetBrains Mono', monospace";
      ctx.textAlign = "left";
      ctx.fillRect(8, 10 + i * 15, 10, 1.5);
      ctx.fillText(l.label, 22, 15 + i * 15);
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
    <div style={{ marginBottom: 10 }}>
      <label style={{
        display: "block",
        fontSize: 11,
        fontWeight: 500,
        color: "var(--label)",
        marginBottom: 4,
        fontFamily: "var(--sans)",
      }}>
        {label}
        {unit && <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--accent2)", marginLeft: 5 }}>[{unit}]</span>}
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
          border: `1px solid ${caution ? "var(--danger)" : "var(--border2)"}`,
          color: readOnly ? "var(--accent)" : "var(--fg)",
          fontFamily: "var(--mono)",
          fontSize: 14,
          fontWeight: 400,
          padding: "6px 9px",
          borderRadius: 2,
          outline: "none",
          boxSizing: "border-box",
          transition: "border-color 0.15s",
        }}
      />
    </div>
  );
}

function OutputBox({ label, value, unit, caution, highlight }) {
  return (
    <div style={{
      background: "var(--bg2)",
      border: `1px solid ${caution ? "rgba(184,64,64,0.4)" : highlight ? "rgba(107,155,210,0.35)" : "var(--border)"}`,
      borderRadius: 2,
      padding: "8px 11px",
      marginBottom: 7,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "baseline",
    }}>
      <span style={{
        fontSize: 11,
        fontWeight: 500,
        color: "var(--label)",
        fontFamily: "var(--sans)",
        letterSpacing: "0.01em",
      }}>{label}</span>
      <span style={{
        fontFamily: "var(--mono)",
        fontSize: 15,
        fontWeight: 400,
        color: caution ? "var(--danger)" : highlight ? "var(--accent)" : "var(--fg)",
      }}>
        {value}
        {unit && <span style={{ fontSize: 10, color: "var(--label)", marginLeft: 4 }}>{unit}</span>}
      </span>
    </div>
  );
}

function SectionHeader({ children }) {
  return (
    <div style={{
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: "0.1em",
      color: "var(--muted)",
      textTransform: "uppercase",
      borderBottom: "1px solid var(--border)",
      paddingBottom: 6,
      marginBottom: 12,
      marginTop: 20,
      fontFamily: "var(--sans)",
    }}>
      {children}
    </div>
  );
}

function Note({ children }) {
  return (
    <p style={{
      fontSize: 11,
      color: "var(--muted)",
      fontFamily: "var(--sans)",
      lineHeight: 1.5,
      marginTop: 8,
      fontStyle: "italic",
    }}>
      {children}
    </p>
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
  const [tc,     setTc]     = useState("270");
  const [tas,    setTas]    = useState("120");
  const [wd,     setWd]     = useState("310");
  const [ws,     setWs]     = useState("25");
  const [magVar, setMagVar] = useState("5");
  const [dev,    setDev]    = useState("2");

  const result   = calcWind(+tc, +tas, +wd, +ws);
  const magHdg   = result.trueHeading !== undefined ? ((result.trueHeading - +magVar + 360) % 360) : null;
  const compHdg  = magHdg !== null ? ((magHdg - +dev + 360) % 360) : null;
  const xwResult = calcCrosswind(+tc, +wd, +ws);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
      {/* Left: inputs + outputs */}
      <div>
        <SectionHeader>Course &amp; Airspeed</SectionHeader>
        <Field label="True Course" unit="°" value={tc} onChange={setTc} placeholder="270" />
        <Field label="True Airspeed (TAS)" unit="kt" value={tas} onChange={setTas} placeholder="120" />

        <SectionHeader>Wind</SectionHeader>
        <Field label="Wind Direction (FROM)" unit="°" value={wd} onChange={setWd} placeholder="310" />
        <Field label="Wind Speed" unit="kt" value={ws} onChange={setWs} placeholder="25" />

        <SectionHeader>Results</SectionHeader>
        {result.error ? (
          <div style={{
            color: "var(--danger)",
            fontFamily: "var(--mono)",
            fontSize: 12,
            padding: "8px 10px",
            border: "1px solid rgba(184,64,64,0.3)",
            borderRadius: 2,
            background: "rgba(184,64,64,0.05)",
          }}>
            {result.error}
          </div>
        ) : (
          <>
            <OutputBox label="Wind Correction Angle" value={`${result.wca >= 0 ? "+" : ""}${fmt(result.wca)}°`} highlight caution={Math.abs(result.wca) > 20} />
            <OutputBox label="Ground Speed" value={fmt(result.gs, 0)} unit="kt" highlight />
            <OutputBox label="True Heading" value={`${fmt(result.trueHeading, 0)}°`} />
            <OutputBox label="Headwind Component" value={fmt(xwResult.headwind, 0)} unit="kt" />
            <OutputBox label="Crosswind Component" value={`${Math.abs(xwResult.crosswind).toFixed(0)} (${xwResult.crosswind >= 0 ? "R" : "L"})`} unit="kt" />
          </>
        )}

        <SectionHeader>Magnetic / Compass</SectionHeader>
        <Field label="Magnetic Variation (E+/W−)" unit="°" value={magVar} onChange={setMagVar} placeholder="5" />
        <Field label="Compass Deviation (E+/W−)" unit="°" value={dev} onChange={setDev} placeholder="2" />
        {magHdg !== null && (
          <>
            <OutputBox label="Magnetic Heading" value={`${fmt(magHdg, 0)}°`} />
            <OutputBox label="Compass Heading" value={`${fmt(compHdg, 0)}°`} />
          </>
        )}
      </div>

      {/* Right: canvas + formula reference */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{
          background: "var(--bg2)",
          border: "1px solid var(--border)",
          borderRadius: 2,
          padding: 12,
        }}>
          <div style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.08em",
            color: "var(--muted)",
            textTransform: "uppercase",
            fontFamily: "var(--sans)",
            textAlign: "center",
            marginBottom: 10,
          }}>Wind Vector Diagram</div>
          <WindCanvas trueCourse={+tc} tas={+tas} windDir={+wd} windSpeed={+ws} result={result} />
        </div>

        <div style={{
          background: "var(--bg2)",
          border: "1px solid var(--border)",
          borderRadius: 2,
          padding: "11px 14px",
        }}>
          <div style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.08em",
            color: "var(--muted)",
            textTransform: "uppercase",
            fontFamily: "var(--sans)",
            marginBottom: 8,
            borderBottom: "1px solid var(--border)",
            paddingBottom: 6,
          }}>Formula Reference</div>
          {[
            "WCA = arcsin(V_w · sin θ / TAS)",
            "GS  = TAS · cos(WCA) − V_w · cos θ",
            "TH  = TC ± WCA",
            "MH  = TH ∓ Var",
            "CH  = MH ∓ Dev",
          ].map((f) => (
            <div key={f} style={{
              fontFamily: "var(--mono)",
              fontSize: 11,
              fontWeight: 300,
              color: "var(--label)",
              lineHeight: 1.8,
            }}>{f}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// CALCULATOR SUB-PANELS
// ─────────────────────────────────────────────
function CalcTSD() {
  const [dist,    setDist]    = useState("120");
  const [gs,      setGs]      = useState("140");
  const [timeMin, setTimeMin] = useState("");
  const [solving, setSolving] = useState("time");

  let result = {};
  if (solving === "dist") result = calcTSD(null, +gs, +timeMin);
  if (solving === "time") result = calcTSD(+dist, +gs, null);
  if (solving === "gs")   result = calcTSD(+dist, null, +timeMin);

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {[
          { id: "dist", label: "Solve Distance" },
          { id: "time", label: "Solve Time" },
          { id: "gs",   label: "Solve Speed" },
        ].map((s) => (
          <button key={s.id} onClick={() => setSolving(s.id)} style={{
            flex: 1,
            padding: "6px 0",
            fontFamily: "var(--sans)",
            fontSize: 11,
            fontWeight: 500,
            background: solving === s.id ? "var(--accent)" : "var(--bg2)",
            color: solving === s.id ? "var(--bg1)" : "var(--fg)",
            border: `1px solid ${solving === s.id ? "var(--accent)" : "var(--border2)"}`,
            borderRadius: 2,
            cursor: "pointer",
            transition: "all 0.15s",
          }}>
            {s.label}
          </button>
        ))}
      </div>
      {solving !== "dist" && <Field label="Distance" unit="nm" value={dist} onChange={setDist} placeholder="120" />}
      {solving !== "gs"   && <Field label="Ground Speed" unit="kt" value={gs} onChange={setGs} placeholder="140" />}
      {solving !== "time" && <Field label="Time" unit="min" value={timeMin} onChange={setTimeMin} placeholder="51" />}
      <div style={{ marginTop: 8 }}>
        {solving === "dist" && result.dist   !== undefined && <OutputBox label="Distance"     value={fmt(result.dist, 1)}  unit="nm"  highlight />}
        {solving === "time" && result.timeMin !== undefined && <>
          <OutputBox label="Time"         value={fmtTime(result.timeMin)}        highlight />
          <OutputBox label="Time (decimal)" value={fmt(result.timeMin, 1)} unit="min" />
        </>}
        {solving === "gs"   && result.gs     !== undefined && <OutputBox label="Ground Speed" value={fmt(result.gs, 1)}    unit="kt"  highlight />}
      </div>
    </div>
  );
}

function CalcFuel() {
  const [flow,       setFlow]       = useState("42");
  const [onboard,    setOnboard]    = useState("220");
  const [flightTime, setFlightTime] = useState("90");
  const res = calcFuel(+flow, +onboard, +flightTime);

  return (
    <div>
      <Field label="Fuel Flow" unit="lbs/hr or L/hr" value={flow} onChange={setFlow} placeholder="42" />
      <Field label="Fuel Onboard" unit="same unit" value={onboard} onChange={setOnboard} placeholder="220" />
      <Field label="Flight Time" unit="min" value={flightTime} onChange={setFlightTime} placeholder="90" />
      <div style={{ marginTop: 8 }}>
        <OutputBox label="Endurance" value={fmtTime(res.endurance)} highlight />
        <OutputBox label="Endurance (decimal)" value={fmt(res.endurance !== null ? res.endurance / 60 : null, 2)} unit="hr" />
        <OutputBox label="Fuel Required" value={fmt(res.required, 1)} unit="same unit" />
        {res.required !== null && onboard && (
          <OutputBox
            label="Fuel Reserve"
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
  const [pa,  setPa]  = useState("8500");
  const [oat, setOat] = useState("-5");
  const res = calcTAS(+cas, +pa, +oat);

  return (
    <div>
      <Field label="Calibrated Airspeed (CAS)" unit="kt" value={cas} onChange={setCas} placeholder="120" />
      <Field label="Pressure Altitude" unit="ft" value={pa} onChange={setPa} placeholder="8500" />
      <Field label="Outside Air Temperature (OAT)" unit="°C" value={oat} onChange={setOat} placeholder="-5" />
      <div style={{ marginTop: 8 }}>
        <OutputBox label="True Airspeed (TAS)" value={fmt(res.tas, 1)} unit="kt" highlight />
        <OutputBox label="Mach Number" value={`M ${fmt(res.mach, 3)}`} />
        <OutputBox label="Density Altitude" value={fmt(res.densAlt, 0)} unit="ft" caution={res.densAlt > 8000} />
        <OutputBox label="ISA Deviation" value={`${res.isaDev >= 0 ? "+" : ""}${fmt(res.isaDev, 1)} °C`} caution={Math.abs(res.isaDev) > 15} />
        <OutputBox label="ISA Temp at Altitude" value={fmt(isaTemp(+pa), 1)} unit="°C" />
        <Note>CAS treated as EAS — compressibility correction omitted. Error negligible below ~200 kt.</Note>
      </div>
    </div>
  );
}

function CalcAlt() {
  const [indicAlt, setIndicAlt] = useState("5500");
  const [qnh,      setQnh]      = useState("29.65");
  const [oat,      setOat]      = useState("5");
  const pa     = calcPressAlt(+indicAlt, +qnh);
  const isaDev = +oat - isaTemp(pa);
  const da     = pa + 120 * isaDev;

  return (
    <div>
      <Field label="Indicated Altitude" unit="ft" value={indicAlt} onChange={setIndicAlt} placeholder="5500" />
      <Field label="Altimeter Setting (QNH)" unit="inHg" value={qnh} onChange={setQnh} placeholder="29.65" />
      <Field label="Outside Air Temperature (OAT)" unit="°C" value={oat} onChange={setOat} placeholder="5" />
      <div style={{ marginTop: 8 }}>
        <OutputBox label="Pressure Altitude" value={fmt(pa, 0)} unit="ft" highlight />
        <OutputBox label="ISA Temperature at PA" value={fmt(isaTemp(pa), 1)} unit="°C" />
        <OutputBox label="ISA Deviation" value={`${isaDev >= 0 ? "+" : ""}${fmt(isaDev, 1)} °C`} caution={Math.abs(isaDev) > 20} />
        <OutputBox label="Density Altitude" value={fmt(da, 0)} unit="ft" caution={da > 8000} highlight />
      </div>
    </div>
  );
}

function CalcConvert() {
  const [type, setType] = useState(Object.keys(conversions)[0]);
  const [val,  setVal]  = useState("100");
  const result = conversions[type] ? conversions[type](+val) : null;

  return (
    <div>
      <label style={{
        fontSize: 11,
        fontWeight: 500,
        color: "var(--label)",
        fontFamily: "var(--sans)",
        display: "block",
        marginBottom: 5,
      }}>
        Conversion
      </label>
      <select
        value={type}
        onChange={(e) => setType(e.target.value)}
        style={{
          width: "100%",
          background: "var(--bg2)",
          border: "1px solid var(--border2)",
          color: "var(--fg)",
          fontFamily: "var(--mono)",
          fontSize: 13,
          fontWeight: 300,
          padding: "6px 9px",
          borderRadius: 2,
          marginBottom: 12,
          outline: "none",
          cursor: "pointer",
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
        <OutputBox label="Top of Descent Distance (3°)" value={fmt(tod, 1)} unit="nm" highlight />
        <Note>
          d = ΔAlt ÷ (tan 3° × 6076 ft/nm) ≈ ΔAlt ÷ 318.5 — geometry only; GS affects timing, not distance.
        </Note>
      </div>
    </div>
  );
}

function CalcXwind() {
  const [rwy, setRwy] = useState("270");
  const [wd,  setWd]  = useState("310");
  const [ws,  setWs]  = useState("20");
  const res = calcCrosswind(+rwy, +wd, +ws);

  return (
    <div>
      <Field label="Runway Heading" unit="°" value={rwy} onChange={setRwy} placeholder="270" />
      <Field label="Wind Direction (FROM)" unit="°" value={wd} onChange={setWd} placeholder="310" />
      <Field label="Wind Speed" unit="kt" value={ws} onChange={setWs} placeholder="20" />
      <div style={{ marginTop: 8 }}>
        <OutputBox
          label={res.headwind >= 0 ? "Headwind Component" : "Tailwind Component"}
          value={fmt(Math.abs(res.headwind), 0)} unit="kt"
          caution={res.headwind < 0} highlight
        />
        <OutputBox
          label={`Crosswind Component (${res.crosswind >= 0 ? "Right" : "Left"})`}
          value={fmt(Math.abs(res.crosswind), 0)} unit="kt"
          caution={Math.abs(res.crosswind) > 15}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// CALCULATOR SIDE — tabbed
// ─────────────────────────────────────────────
const calcTabs = [
  { id: "tsd",  label: "TSD",   full: "Time / Speed / Distance", comp: CalcTSD },
  { id: "fuel", label: "Fuel",  full: "Fuel Planning",            comp: CalcFuel },
  { id: "tas",  label: "TAS",   full: "True Airspeed",            comp: CalcTAS },
  { id: "alt",  label: "Alt",   full: "Altitude",                 comp: CalcAlt },
  { id: "xw",   label: "XWind", full: "Crosswind Components",     comp: CalcXwind },
  { id: "tod",  label: "TOD",   full: "Top of Descent",           comp: CalcTOD },
  { id: "conv", label: "Units", full: "Unit Conversions",         comp: CalcConvert },
];

function CalcSide() {
  const [activeTab, setActiveTab] = useState("tsd");
  const Active      = calcTabs.find((t) => t.id === activeTab)?.comp || CalcTSD;
  const activeLabel = calcTabs.find((t) => t.id === activeTab)?.full || "";

  return (
    <div>
      {/* Tab bar */}
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 16 }}>
        {calcTabs.map((t) => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            padding: "5px 13px",
            fontFamily: "var(--sans)",
            fontSize: 12,
            fontWeight: 500,
            background: activeTab === t.id ? "var(--accent)" : "var(--bg2)",
            color: activeTab === t.id ? "var(--bg1)" : "var(--fg)",
            border: `1px solid ${activeTab === t.id ? "var(--accent)" : "var(--border2)"}`,
            borderRadius: 2,
            cursor: "pointer",
            transition: "all 0.15s",
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Active tab title */}
      <div style={{
        fontSize: 12,
        fontWeight: 400,
        fontStyle: "italic",
        color: "var(--accent2)",
        fontFamily: "var(--serif)",
        marginBottom: 14,
        paddingLeft: 9,
        borderLeft: "2px solid var(--border2)",
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
  @import url('https://fonts.googleapis.com/css2?family=Spectral:ital,wght@0,300;0,400;0,500;1,300;1,400&family=JetBrains+Mono:wght@300;400;500&family=Source+Sans+3:wght@300;400;500;600&display=swap');

  :root {
    --bg1:    #0c0e14;
    --bg2:    #111420;
    --bg3:    #161926;
    --fg:     #c8cedf;
    --label:  #5a6278;
    --muted:  #3e4760;
    --accent:  #6b9bd2;
    --accent2: #4da8a8;
    --border:  #1f2535;
    --border2: #2a3045;
    --danger:  #b84040;
    --serif: 'Spectral', Georgia, serif;
    --sans:  'Source Sans 3', system-ui, sans-serif;
    --mono:  'JetBrains Mono', 'Courier New', monospace;
  }

  [data-theme="light"] {
    --bg1:    #f4f4ef;
    --bg2:    #eaeae4;
    --bg3:    #e0e0da;
    --fg:     #1c1e28;
    --label:  #6a7088;
    --muted:  #9aa0b8;
    --accent:  #3a6ea8;
    --accent2: #2a8888;
    --border:  #d0d0c8;
    --border2: #c0c0b8;
    --danger:  #a03030;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: var(--bg1);
    color: var(--fg);
    font-family: var(--sans);
  }

  input[type=number] { -moz-appearance: textfield; }
  input[type=number]::-webkit-inner-spin-button,
  input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
  input:focus { border-color: var(--accent) !important; }

  select:focus { outline: none; border-color: var(--accent) !important; }

  button { cursor: pointer; transition: all 0.15s; }
  button:hover { opacity: 0.88; }

  ::-webkit-scrollbar { width: 5px; }
  ::-webkit-scrollbar-track { background: var(--bg1); }
  ::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 2px; }
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
      <div style={{ minHeight: "100vh", background: "var(--bg1)", color: "var(--fg)", display: "flex", flexDirection: "column" }}>

        {/* ── Header ── */}
        <header style={{
          background: "var(--bg2)",
          borderBottom: "1px solid var(--border)",
          padding: "0 24px",
          height: 52,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <span style={{
              fontFamily: "var(--serif)",
              fontSize: 16,
              fontWeight: 500,
              color: "var(--fg)",
              letterSpacing: "0.01em",
            }}>
              E6-B <span style={{ fontStyle: "italic", fontWeight: 300, color: "var(--accent)" }}>Flight Computer</span>
            </span>
            <span style={{
              fontFamily: "var(--mono)",
              fontSize: 10,
              fontWeight: 300,
              color: "var(--label)",
              letterSpacing: "0.06em",
            }}>
              Electronic Flight Bag · Client-side · Training Use Only
            </span>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {/* Panel toggle */}
            <div style={{
              display: "flex",
              border: "1px solid var(--border2)",
              borderRadius: 2,
              overflow: "hidden",
            }}>
              {[
                { id: "wind", label: "Wind Side" },
                { id: "calc", label: "Calculator" },
              ].map((p, i) => (
                <button key={p.id} onClick={() => setPanel(p.id)} style={{
                  padding: "5px 16px",
                  fontFamily: "var(--sans)",
                  fontSize: 12,
                  fontWeight: 500,
                  background: panel === p.id ? "var(--accent)" : "transparent",
                  color: panel === p.id ? "var(--bg1)" : "var(--fg)",
                  border: "none",
                  borderRight: i === 0 ? "1px solid var(--border2)" : "none",
                  cursor: "pointer",
                  transition: "background 0.15s",
                }}>
                  {p.label}
                </button>
              ))}
            </div>

            {/* Theme toggle */}
            <button onClick={() => setTheme(t => t === "dark" ? "light" : "dark")} style={{
              background: "var(--bg3)",
              border: "1px solid var(--border2)",
              color: "var(--label)",
              fontFamily: "var(--sans)",
              fontSize: 11,
              fontWeight: 500,
              padding: "5px 11px",
              borderRadius: 2,
            }}>
              {theme === "dark" ? "Day Mode" : "Night Mode"}
            </button>
          </div>
        </header>

        {/* ── Disclaimer bar ── */}
        <div style={{
          background: "var(--bg2)",
          borderBottom: "1px solid var(--border)",
          padding: "3px 24px",
          display: "flex",
          gap: 28,
          fontSize: 10,
          fontFamily: "var(--mono)",
          fontWeight: 300,
          color: "var(--muted)",
          letterSpacing: "0.05em",
        }}>
          <span style={{ color: "#4a9e72" }}>● Offline</span>
          <span>v2.0</span>
          <span>For training use only — verify all outputs with official charts and certified avionics</span>
        </div>

        {/* ── Main ── */}
        <main style={{
          flex: 1,
          padding: "22px 24px",
          maxWidth: 1120,
          margin: "0 auto",
          width: "100%",
        }}>
          {panel === "wind" ? <WindSide /> : <CalcSide />}
        </main>

        {/* ── Footer ── */}
        <footer style={{
          borderTop: "1px solid var(--border)",
          padding: "7px 24px",
          fontSize: 10,
          fontFamily: "var(--mono)",
          fontWeight: 300,
          color: "var(--muted)",
          textAlign: "center",
          letterSpacing: "0.04em",
        }}>
          Not for navigational use · All calculations must be verified with official charts and certified avionics
        </footer>
      </div>
    </>
  );
}