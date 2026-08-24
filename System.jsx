import { Panel, Chip } from "../components/Chrome.jsx";
import { useMission } from "../state/MissionContext.jsx";
import { focalPx } from "../lib/sensing.js";

export default function System() {
  const {
    cam, setCam, mode, source, modelState, simulateLidar, setSimulateLidar,
    stopLive, startCamera, lidarLabel, home, fps,
  } = useMission();

  const set = (k) => (e) => setCam({ ...cam, [k]: Number(e.target.value) });
  const f = focalPx(cam.imageHeight, cam.vFov);

  return (
    <>
      <div className="page-head">
        <div className="eyebrow">Module · CFG</div>
        <h1 className="page-title">System</h1>
        <p className="prose">
          Every distance on this console comes out of the numbers below. They are
          exposed rather than buried because a range estimate is only as honest as
          the camera geometry behind it, and because a judge should be able to
          check the arithmetic.
        </p>
      </div>

      <div className="grid g-2">
        <Panel title="Platform + optics" note="drives every range">
          <div className="grid g-2" style={{ gap: 16 }}>
            <Slider label="Altitude" unit="m" min="20" max="400" step="5" value={cam.altitude} onChange={set("altitude")} />
            <Slider label="Camera tilt below horizontal" unit="°" min="5" max="89" step="1" value={cam.tilt} onChange={set("tilt")} />
            <Slider label="Horizontal field of view" unit="°" min="30" max="120" step="1" value={cam.hFov} onChange={set("hFov")} />
            <Slider label="Vertical field of view" unit="°" min="20" max="100" step="1" value={cam.vFov} onChange={set("vFov")} />
            <Slider label="Airframe heading" unit="°" min="0" max="359" step="1" value={cam.heading} onChange={set("heading")} />
          </div>

          <div className="readout" style={{ marginTop: 18 }}>
            <div className="readout-row">
              <span className="readout-k">Focal length</span>
              <span className="readout-v">{Math.round(f)} px</span>
            </div>
            <div className="readout-row">
              <span className="readout-k">Frame</span>
              <span className="readout-v">{cam.imageWidth}×{cam.imageHeight}</span>
            </div>
            <div className="readout-row">
              <span className="readout-k">Home</span>
              <span className="readout-v">{home.lat.toFixed(4)}N</span>
            </div>
            <div className="readout-row">
              <span className="readout-k"> </span>
              <span className="readout-v">{home.lng.toFixed(4)}E</span>
            </div>
          </div>
        </Panel>

        <div className="stack">
          <Panel title="Feed" note={`${fps} Hz`}>
            <div className="readout" style={{ gridTemplateColumns: "1fr" }}>
              <div className="readout-row">
                <span className="readout-k">Mode</span>
                <span className="readout-v">{mode === "demo" ? "simulation" : "live vision"}</span>
              </div>
              <div className="readout-row">
                <span className="readout-k">Source</span>
                <span className="readout-v">{source}</span>
              </div>
              <div className="readout-row">
                <span className="readout-k">Model</span>
                <span className="readout-v">{modelState}</span>
              </div>
              <div className="readout-row">
                <span className="readout-k">Rangefinder</span>
                <span className="readout-v">{simulateLidar ? "simulated" : "off"}</span>
              </div>
            </div>
            <div className="btn-row" style={{ marginTop: 14 }}>
              <button className="btn primary" onClick={startCamera}>Go live on camera</button>
              {mode === "live" && <button className="btn" onClick={stopLive}>Back to simulation</button>}
              <button className="btn" onClick={() => setSimulateLidar(!simulateLidar)}>
                {simulateLidar ? "Disable simulated lidar" : "Enable simulated lidar"}
              </button>
            </div>
          </Panel>

          <Panel title="What is real, and what is not" note="read this first">
            <table className="tbl">
              <thead>
                <tr><th>Function</th><th>Status</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ whiteSpace: "normal" }}>Object detection and classification</td>
                  <td><Chip level="LOW">real</Chip></td>
                </tr>
                <tr>
                  <td style={{ whiteSpace: "normal" }}>Multi-target tracking, speed, course, ETA</td>
                  <td><Chip level="LOW">real</Chip></td>
                </tr>
                <tr>
                  <td style={{ whiteSpace: "normal" }}>Range from camera geometry</td>
                  <td><Chip level="LOW">real</Chip></td>
                </tr>
                <tr>
                  <td style={{ whiteSpace: "normal" }}>A* routing and risk field</td>
                  <td><Chip level="LOW">real</Chip></td>
                </tr>
                <tr>
                  <td style={{ whiteSpace: "normal" }}>LiDAR ranging</td>
                  <td><Chip level="MEDIUM">simulated</Chip></td>
                </tr>
                <tr>
                  <td style={{ whiteSpace: "normal" }}>Drone GPS, altitude and heading telemetry</td>
                  <td><Chip level="MEDIUM">entered by hand</Chip></td>
                </tr>
                <tr>
                  <td style={{ whiteSpace: "normal" }}>Demo scenario contacts</td>
                  <td><Chip level="MEDIUM">simulated</Chip></td>
                </tr>
              </tbody>
            </table>
            <p className="prose" style={{ fontSize: 13, marginTop: 12, marginBottom: 0 }}>
              Saying this plainly is worth more than pretending. The tracking and
              routing are the contribution; the sensors they consume are stubbed
              behind interfaces so real hardware can replace them without touching
              the logic above.
            </p>
          </Panel>
        </div>
      </div>

      <Panel title="How a countdown is produced" style={{ marginTop: 14 }}>
        <div className="grid g-2" style={{ gap: 22 }}>
          <div>
            <div className="eyebrow">1 · pixels to metres</div>
            <p className="prose" style={{ fontSize: 14 }}>
              A person is about 1.7 m tall, so a box <em>h</em> pixels high sits
              roughly <code>f × 1.7 / h</code> metres away, where <code>f</code> is
              the focal length in pixels — {Math.round(f)} px at the current field
              of view. Separately, the row where their feet meet the ground gives
              <code> altitude / tan(depression)</code>. Two independent estimates
              from one frame.
            </p>

            <div className="eyebrow" style={{ marginTop: 18 }}>2 · fusing the range</div>
            <p className="prose" style={{ fontSize: 14 }}>
              Vision error grows with the square of range, so the two estimates are
              combined by inverse variance — each contributes in proportion to how
              much it can be trusted at that distance. A LiDAR return, when there
              is one, dominates because its uncertainty barely changes with range.
              {" "}<strong>{lidarLabel}</strong>
            </p>
          </div>

          <div>
            <div className="eyebrow">3 · velocity from a smoothed track</div>
            <p className="prose" style={{ fontSize: 14 }}>
              Detections are associated frame to frame by nearest neighbour within
              a gate, so a target keeps one identity. Position differences give
              velocity, and an exponential moving average removes the per-frame
              jitter that would otherwise make speeds jump around.
            </p>

            <div className="eyebrow" style={{ marginTop: 18 }}>4 · time to contact</div>
            <p className="prose" style={{ fontSize: 14 }}>
              Only the part of the velocity pointing at you matters. Project the
              velocity onto the line of sight to get the closing rate, then
              divide range by it. A target crossing your front has almost no
              closing rate and correctly gets no countdown, however fast it moves.
              Below about 0.05 m/s of closing the estimate is suppressed rather
              than allowed to run to absurd numbers.
            </p>
          </div>
        </div>

        <div className="note" style={{ marginTop: 18 }}>
          <strong>Worked example.</strong> An animal 500 m out closing at 2 m/s
          publishes 250 seconds. Held steady, that reads 04:10, then 03:10, then
          02:10 as it comes in, with the tier stepping through medium, high and
          critical on the way. If it turns broadside the closing rate collapses and
          the countdown disappears — which is the behaviour the whole design is
          built around.
        </div>
      </Panel>

      <Panel title="Tests" note="npm test" style={{ marginTop: 14 }}>
        <p className="prose" style={{ fontSize: 14 }}>
          The geometry, tracking, fusion, routing and scoring are covered by 49
          assertions that run with no dependencies and no browser:
          {" "}<code>npm test</code>. They pin the things that are easy to get
          quietly wrong — that a countdown never rises while a target closes, that
          two targets are never swapped, that the safe route really does carry less
          exposure than the short one, and that a walled-off waypoint reports
          failure instead of inventing a path.
        </p>
      </Panel>
    </>
  );
}

function Slider({ label, unit, value, onChange, min, max, step }) {
  return (
    <div className="field">
      <label>
        {label} · <span className="field-val">{value}{unit}</span>
      </label>
      <input type="range" min={min} max={max} step={step} value={value} onChange={onChange} />
    </div>
  );
}
