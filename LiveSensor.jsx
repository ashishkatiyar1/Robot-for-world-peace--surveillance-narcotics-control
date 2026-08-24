import { useEffect, useRef, useState } from "react";
import { Panel, Chip } from "../components/Chrome.jsx";
import { KIND_NAME, TIER_VAR, tag } from "../components/Instruments.jsx";
import { useMission } from "../state/MissionContext.jsx";
import { fmtDistance } from "../lib/geo.js";

const KIND_COLOR = {
  person: "var(--amber)",
  animal: "var(--red)",
  vehicle: "var(--magenta)",
  object: "var(--verdigris)",
};

/* Resolve a CSS custom property to a real colour, because canvas cannot. */
const RAW = {
  person: "#f0a830",
  animal: "#e5484d",
  vehicle: "#e45fbf",
  object: "#79b4a0",
};

export default function LiveSensor() {
  const {
    videoRef, boxes, tracks, counts, mode, source, modelState, modelError, fps,
    startCamera, startFile, stopLive, loadModel, simulateLidar, setSimulateLidar, cam,
  } = useMission();

  const canvasRef = useRef(null);
  const fileRef = useRef(null);
  const rafRef = useRef(0);
  const [showBoxes, setShowBoxes] = useState(true);

  /* Paint the picture: video frame, then the detection overlay. */
  useEffect(() => {
    const draw = () => {
      const cv = canvasRef.current;
      const v = videoRef.current;
      if (cv) {
        const ctx = cv.getContext("2d");
        const rect = cv.getBoundingClientRect();
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const w = Math.max(1, Math.round(rect.width * dpr));
        const h = Math.max(1, Math.round(rect.height * dpr));
        if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }

        ctx.clearRect(0, 0, w, h);

        let dx = 0, dy = 0, dw = w, dh = h;
        if (v && v.readyState >= 2 && v.videoWidth) {
          const scale = Math.max(w / v.videoWidth, h / v.videoHeight);
          dw = v.videoWidth * scale;
          dh = v.videoHeight * scale;
          dx = (w - dw) / 2;
          dy = (h - dh) / 2;
          ctx.drawImage(v, dx, dy, dw, dh);
        } else {
          ctx.fillStyle = "#060a12";
          ctx.fillRect(0, 0, w, h);
        }

        // Reticle — fixed to the frame, not to any target.
        ctx.strokeStyle = "rgba(233,228,217,0.28)";
        ctx.lineWidth = 1 * dpr;
        ctx.beginPath();
        ctx.moveTo(w / 2 - 14 * dpr, h / 2); ctx.lineTo(w / 2 - 4 * dpr, h / 2);
        ctx.moveTo(w / 2 + 4 * dpr, h / 2); ctx.lineTo(w / 2 + 14 * dpr, h / 2);
        ctx.moveTo(w / 2, h / 2 - 14 * dpr); ctx.lineTo(w / 2, h / 2 - 4 * dpr);
        ctx.moveTo(w / 2, h / 2 + 4 * dpr); ctx.lineTo(w / 2, h / 2 + 14 * dpr);
        ctx.stroke();

        if (showBoxes) {
          for (const b of boxes) {
            const x = dx + b.x * dw;
            const y = dy + b.y * dh;
            const bw = b.w * dw;
            const bh = b.h * dh;
            const col = RAW[b.kind] || "#e9e4d9";

            // Corner brackets read as a sensor lock rather than a web bounding box.
            const seg = Math.min(bw, bh) * 0.24;
            ctx.strokeStyle = col;
            ctx.lineWidth = 1.6 * dpr;
            ctx.beginPath();
            ctx.moveTo(x, y + seg); ctx.lineTo(x, y); ctx.lineTo(x + seg, y);
            ctx.moveTo(x + bw - seg, y); ctx.lineTo(x + bw, y); ctx.lineTo(x + bw, y + seg);
            ctx.moveTo(x + bw, y + bh - seg); ctx.lineTo(x + bw, y + bh); ctx.lineTo(x + bw - seg, y + bh);
            ctx.moveTo(x + seg, y + bh); ctx.lineTo(x, y + bh); ctx.lineTo(x, y + bh - seg);
            ctx.stroke();

            const label = `${b.cls} ${Math.round(b.score * 100)}% · ${
              isFinite(b.range) ? `${Math.round(b.range)} m` : "range n/a"
            }`;
            ctx.font = `${11 * dpr}px "IBM Plex Mono", monospace`;
            const tw = ctx.measureText(label).width;
            const ty = y - 6 * dpr < 14 * dpr ? y + bh + 16 * dpr : y - 6 * dpr;
            ctx.fillStyle = "rgba(11,18,32,0.82)";
            ctx.fillRect(x, ty - 11 * dpr, tw + 10 * dpr, 15 * dpr);
            ctx.fillStyle = col;
            ctx.fillText(label, x + 5 * dpr, ty);
          }
        }
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [boxes, videoRef, showBoxes]);

  const live = mode === "live" && source !== "none";

  return (
    <>
      <div className="page-head">
        <div className="eyebrow">Module · CAM</div>
        <h1 className="page-title">Live sensor</h1>
        <p className="prose">
          COCO-SSD runs in this browser tab — no video leaves the machine. Each
          detection is turned into a real-world range two ways at once: from how
          tall the box is in pixels, and from which row of the frame the target's
          feet land on. Those agree closely on level ground, and the LiDAR return
          then pulls the answer tighter still.
        </p>
      </div>

      <div className="grid g-sensor">
        <Panel
          title="Drone camera"
          note={live ? `${fps} Hz · ${source}` : "no source"}
          live={live}
        >
          <div className="video-frame">
            <canvas ref={canvasRef} />
            <i className="hud-corner hud-tl" />
            <i className="hud-corner hud-tr" />
            <i className="hud-corner hud-bl" />
            <i className="hud-corner hud-br" />
            {!live && (
              <div className="video-empty">
                <div className="eyebrow">No feed</div>
                <p className="prose" style={{ fontSize: 14, textAlign: "center" }}>
                  Point a camera at the sector, or load recorded drone footage.
                  Walk toward the lens and the console will start a countdown on
                  you.
                </p>
                <div className="btn-row" style={{ justifyContent: "center" }}>
                  <button className="btn primary" onClick={startCamera}>Start camera</button>
                  <button className="btn" onClick={() => fileRef.current?.click()}>Load footage</button>
                </div>
              </div>
            )}
          </div>

          <div className="btn-row" style={{ marginTop: 12 }}>
            <button className="btn primary" onClick={startCamera}>
              {source === "camera" ? "Restart camera" : "Start camera"}
            </button>
            <button className="btn" onClick={() => fileRef.current?.click()}>Load footage</button>
            {live && <button className="btn danger" onClick={stopLive}>Stop · back to simulation</button>}
            {modelState === "error" && <button className="btn" onClick={loadModel}>Retry model</button>}
            <button className="btn" onClick={() => setShowBoxes((s) => !s)}>
              {showBoxes ? "Hide overlay" : "Show overlay"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="video/*"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) startFile(f);
                e.target.value = "";
              }}
            />
          </div>

          {modelState === "loading" && (
            <div className="note" style={{ marginTop: 12 }}>
              <strong>Loading the vision model.</strong> First run pulls roughly
              6 MB of weights, so it needs a connection once. After that the
              browser caches it.
            </div>
          )}
          {modelState === "error" && (
            <div className="note" style={{ marginTop: 12, borderLeftColor: "var(--red)", background: "rgba(229,72,77,0.08)" }}>
              <strong>The model did not load.</strong> {modelError} Check the
              connection and press retry — the rest of the console keeps working
              on the simulation feed.
            </div>
          )}
        </Panel>

        <div className="stack">
          <Panel title="This frame" note="raw detections" live={live}>
            <div className="grid g-2" style={{ gap: 8 }}>
              <Count label="People" v={counts.people} c={KIND_COLOR.person} />
              <Count label="Animals" v={counts.animals} c={KIND_COLOR.animal} />
              <Count label="Vehicles" v={counts.vehicles} c={KIND_COLOR.vehicle} />
              <Count label="Objects" v={counts.objects} c={KIND_COLOR.object} />
            </div>

            <div className="readout" style={{ marginTop: 14 }}>
              <div className="readout-row">
                <span className="readout-k">Model</span>
                <span className="readout-v">
                  {modelState === "ready" ? "coco-ssd lite" : modelState}
                </span>
              </div>
              <div className="readout-row">
                <span className="readout-k">Rate</span>
                <span className="readout-v">{fps} Hz</span>
              </div>
              <div className="readout-row">
                <span className="readout-k">Boxes</span>
                <span className="readout-v">{boxes.length}</span>
              </div>
              <div className="readout-row">
                <span className="readout-k">Tracks</span>
                <span className="readout-v">{tracks.length}</span>
              </div>
            </div>

            <label className="row" style={{ marginTop: 14, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={simulateLidar}
                onChange={(e) => setSimulateLidar(e.target.checked)}
                style={{ accentColor: "var(--amber)" }}
              />
              <span style={{ fontSize: 13.5 }}>Simulate LiDAR returns</span>
            </label>
            <p className="prose" style={{ fontSize: 12.5, marginTop: 6, marginBottom: 0 }}>
              There is no rangefinder attached to a laptop, so this synthesises
              returns around the camera's own estimate to exercise the fusion
              path. Turn it off and every range shown is vision-only, with its
              true uncertainty. On the airframe this is the one function that
              gets replaced by hardware.
            </p>
          </Panel>

          <Panel title="Detections" note="highest confidence first">
            <div className="tbl-scroll" style={{ maxHeight: 260, overflowY: "auto" }}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Class</th>
                    <th>Conf</th>
                    <th>Range</th>
                  </tr>
                </thead>
                <tbody>
                  {boxes.length === 0 && (
                    <tr>
                      <td colSpan="3" style={{ color: "var(--faint)" }}>
                        {live ? "Nothing recognised in frame." : "Feed offline."}
                      </td>
                    </tr>
                  )}
                  {[...boxes].sort((a, b) => b.score - a.score).map((b, i) => (
                    <tr key={`${b.cls}-${i}`}>
                      <td style={{ color: KIND_COLOR[b.kind] }}>{b.cls}</td>
                      <td>{Math.round(b.score * 100)}%</td>
                      <td>{isFinite(b.range) ? fmtDistance(b.range) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      </div>

      <Panel title="Tracks from this feed" note="ranges are estimates" live style={{ marginTop: 14 }}>
        <div className="tbl-scroll">
          <table className="tbl">
            <thead>
              <tr>
                <th>Track</th>
                <th>Class</th>
                <th>Range</th>
                <th>±</th>
                <th>LiDAR share</th>
                <th>Speed</th>
                <th>Closing</th>
                <th>Alert</th>
              </tr>
            </thead>
            <tbody>
              {tracks.length === 0 && (
                <tr><td colSpan="8" style={{ color: "var(--faint)" }}>No tracks.</td></tr>
              )}
              {tracks.map((t) => (
                <tr key={t.id}>
                  <td>{tag(t)}</td>
                  <td style={{ color: "var(--muted)" }}>{t.species || KIND_NAME[t.kind]}</td>
                  <td>{fmtDistance(t.distance)}</td>
                  <td style={{ color: "var(--faint)" }}>
                    {t.loc ? `${t.loc.sigma.toFixed(1)} m` : "—"}
                  </td>
                  <td style={{ color: "var(--faint)" }}>
                    {t.loc ? `${Math.round(t.loc.weightLidar * 100)}%` : "—"}
                  </td>
                  <td>{t.speed.toFixed(1)} m/s</td>
                  <td style={{ color: t.approaching ? "var(--bone)" : "var(--faint)" }}>
                    {t.closing > 0 ? "+" : ""}{t.closing.toFixed(2)}
                  </td>
                  <td><Chip level={t.alert} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="prose" style={{ fontSize: 13, marginTop: 12, marginBottom: 0 }}>
          Ranges assume the camera settings on the System page match the real
          optics — field of view, altitude and tilt. Change those and every
          distance here moves, which is exactly why they are exposed rather than
          hard-coded. Current setup: {cam.hFov}° × {cam.vFov}° at {cam.altitude} m,
          {" "}{cam.tilt}° down.
        </p>
      </Panel>
    </>
  );
}

function Count({ label, v, c }) {
  return (
    <div style={{ border: "1px solid var(--rule)", borderRadius: 3, padding: "10px 12px" }}>
      <div className="num" style={{ fontSize: 26, fontWeight: 600, color: c, lineHeight: 1 }}>{v}</div>
      <div className="strip-key" style={{ marginTop: 3 }}>{label}</div>
    </div>
  );
}
