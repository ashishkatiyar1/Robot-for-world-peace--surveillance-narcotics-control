import { useEffect, useMemo, useState } from "react";
import { Panel } from "../components/Chrome.jsx";
import { useMission } from "../state/MissionContext.jsx";
import { buildGrid, astar, pathRisk } from "../lib/pathfind.js";
import { enuToLatLng, fmtDistance, compass } from "../lib/geo.js";

/* Map extent, in metres, centred on the protected position. */
const WORLD_W = 1600;
const COLS = 48;
const ROWS = 32;
const CELL_M = WORLD_W / COLS;          // 33.3 m per cell
const WORLD_H = ROWS * CELL_M;

const VIEW_W = 960;
const VIEW_H = Math.round((VIEW_W * ROWS) / COLS);
const PX = VIEW_W / COLS;

/* Coordinate helpers: ENU metres <-> grid cells <-> svg pixels. */
const enuToCell = (e, n) => ({
  x: Math.max(0, Math.min(COLS - 1, Math.round((e + WORLD_W / 2) / CELL_M))),
  y: Math.max(0, Math.min(ROWS - 1, Math.round((WORLD_H / 2 - n) / CELL_M))),
});
const cellToEnu = (x, y) => ({ e: x * CELL_M - WORLD_W / 2, n: WORLD_H / 2 - y * CELL_M });
const cellToPx = (x, y) => ({ px: (x + 0.5) * PX, py: (y + 0.5) * PX });

const PRESETS = [
  { id: "school", name: "Village school", e: 520, n: 430 },
  { id: "ranger", name: "Ranger post", e: -600, n: 120 },
  { id: "roadhead", name: "Road head", e: 140, n: -470 },
];

export default function SafeRoute() {
  const { dangerZones, home, tracks } = useMission();
  const [goalId, setGoalId] = useState("school");
  const [custom, setCustom] = useState(null);
  const [tick, setTick] = useState(0);
  const [avoidance, setAvoidance] = useState(6);

  /* Re-solve on a slow cadence: the picture changes constantly but a route the
     operator is reading should not flicker under them. */
  useEffect(() => {
    const iv = setInterval(() => setTick((t) => t + 1), 2000);
    return () => clearInterval(iv);
  }, []);

  const goalEnu = custom || PRESETS.find((p) => p.id === goalId) || PRESETS[0];

  const solution = useMemo(() => {
    const dangers = dangerZones.map((z) => {
      const c = enuToCell(z.e, z.n);
      return {
        x: c.x,
        y: c.y,
        radius: Math.max(2, z.radius / CELL_M),
        intensity: z.intensity,
        hardRadius: z.intensity >= 9 ? Math.max(1, (z.radius * 0.35) / CELL_M) : 0,
      };
    });
    const grid = buildGrid(COLS, ROWS, dangers);
    const start = enuToCell(0, 0);
    const goal = enuToCell(goalEnu.e, goalEnu.n);

    const short = astar(grid, start, goal, "short");
    const safe = astar(grid, start, goal, "safe", avoidance);

    const metres = (p) => {
      if (!p) return 0;
      let m = 0;
      for (let i = 1; i < p.length; i++) {
        m += Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y) * CELL_M;
      }
      return m;
    };

    return {
      grid,
      start,
      goal,
      short,
      safe,
      shortM: metres(short?.path),
      safeM: metres(safe?.path),
      shortRisk: short ? pathRisk(grid, short.path) : 0,
      safeRisk: safe ? pathRisk(grid, safe.path) : 0,
    };
  }, [dangerZones, goalEnu, avoidance, tick]);

  const { grid, short, safe } = solution;

  const goalLL = enuToLatLng(home, goalEnu.e, goalEnu.n);
  const detour = solution.shortM > 0 ? ((solution.safeM / solution.shortM - 1) * 100) : 0;
  const riskCut = solution.shortRisk > 0
    ? (1 - solution.safeRisk / solution.shortRisk) * 100
    : 0;

  const toPoly = (path) =>
    path.map((p) => {
      const { px, py } = cellToPx(p.x, p.y);
      return `${px.toFixed(1)},${py.toFixed(1)}`;
    }).join(" ");

  /* Turn-by-turn for the safe route, thinned to meaningful direction changes. */
  const legs = useMemo(() => {
    if (!safe?.path?.length) return [];
    const pts = safe.path;
    const out = [];
    let lastDir = null;
    let runStart = 0;
    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i].x - pts[i - 1].x;
      const dy = pts[i].y - pts[i - 1].y;
      const brg = (Math.atan2(dx, -dy) * 180) / Math.PI;
      const dir = compass((brg + 360) % 360);
      if (dir !== lastDir) {
        if (lastDir !== null) {
          const d = Math.hypot(pts[i - 1].x - pts[runStart].x, pts[i - 1].y - pts[runStart].y) * CELL_M;
          if (d > 20) out.push({ dir: lastDir, m: d });
        }
        lastDir = dir;
        runStart = i - 1;
      }
    }
    if (lastDir) {
      const last = pts[pts.length - 1];
      const d = Math.hypot(last.x - pts[runStart].x, last.y - pts[runStart].y) * CELL_M;
      if (d > 20) out.push({ dir: lastDir, m: d });
    }
    return out.slice(0, 8);
  }, [safe]);

  return (
    <>
      <div className="page-head">
        <div className="eyebrow">Module · NAV</div>
        <h1 className="page-title">Safe route</h1>
        <p className="prose">
          The same A* search runs twice over the same ground. The first pass
          counts only distance. The second adds a surcharge for every cell near a
          contact, so it will happily walk further to keep a hedge between you and
          an elephant. Both are drawn — the operator decides which trade to take.
        </p>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,340px)", gap: 14 }}>
        <Panel title="Sector chart" note={`${Math.round(WORLD_W)} × ${Math.round(WORLD_H)} m · ${Math.round(CELL_M)} m cells`} live>
          <div className="map-wrap">
            <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} role="img" aria-label="Sector chart with routes">
              {/* survey lattice */}
              <defs>
                <pattern id="lattice" width={PX * 3} height={PX * 3} patternUnits="userSpaceOnUse">
                  <path d={`M ${PX * 3} 0 L 0 0 0 ${PX * 3}`} fill="none" stroke="#1b2b3d" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width={VIEW_W} height={VIEW_H} fill="#080e18" />
              <rect width={VIEW_W} height={VIEW_H} fill="url(#lattice)" />

              {/* risk field */}
              {grid.risk.map((r, i) => {
                if (r < 0.4) return null;
                const x = i % COLS;
                const y = Math.floor(i / COLS);
                const a = Math.min(0.5, r / 26);
                return (
                  <rect
                    key={i}
                    x={x * PX} y={y * PX} width={PX} height={PX}
                    fill="#e5484d" opacity={a}
                  />
                );
              })}

              {/* contacts */}
              {dangerZones.map((z) => {
                const c = enuToCell(z.e, z.n);
                const { px, py } = cellToPx(c.x, c.y);
                return (
                  <g key={z.id}>
                    <circle
                      cx={px} cy={py} r={(z.radius / CELL_M) * PX}
                      fill="none" stroke="#e5484d" strokeWidth="1"
                      strokeDasharray="3 4" opacity="0.4"
                    />
                    <circle cx={px} cy={py} r="4" fill="#e5484d" />
                  </g>
                );
              })}

              {/* routes — magenta is the active/recommended course, which is the
                  convention on aviation navigators */}
              {short?.path && (
                <polyline
                  points={toPoly(short.path)}
                  fill="none" stroke="#8a9bb0" strokeWidth="2"
                  strokeDasharray="7 5" opacity="0.85"
                />
              )}
              {safe?.path && (
                <polyline
                  points={toPoly(safe.path)}
                  fill="none" stroke="#e45fbf" strokeWidth="3"
                  strokeLinejoin="round" strokeLinecap="round"
                />
              )}

              {/* start + goal */}
              {(() => {
                const s = cellToPx(solution.start.x, solution.start.y);
                const g = cellToPx(solution.goal.x, solution.goal.y);
                return (
                  <g>
                    <circle cx={s.px} cy={s.py} r="7" fill="none" stroke="#e9e4d9" strokeWidth="1.5" />
                    <circle cx={s.px} cy={s.py} r="3" fill="#e9e4d9" />
                    <text x={s.px + 11} y={s.py + 4} fill="#e9e4d9" style={{ font: '500 11px "IBM Plex Mono", monospace' }}>
                      YOU
                    </text>
                    <rect x={g.px - 6} y={g.py - 6} width="12" height="12" fill="none" stroke="#79b4a0" strokeWidth="2" />
                    <text x={g.px + 11} y={g.py + 4} fill="#79b4a0" style={{ font: '500 11px "IBM Plex Mono", monospace' }}>
                      {goalEnu.name || "WAYPOINT"}
                    </text>
                  </g>
                );
              })()}

              {/* click target for setting a custom waypoint */}
              <rect
                width={VIEW_W} height={VIEW_H} fill="transparent"
                style={{ cursor: "crosshair" }}
                onClick={(ev) => {
                  const box = ev.currentTarget.getBoundingClientRect();
                  const gx = Math.round(((ev.clientX - box.left) / box.width) * COLS - 0.5);
                  const gy = Math.round(((ev.clientY - box.top) / box.height) * ROWS - 0.5);
                  const { e, n } = cellToEnu(gx, gy);
                  setCustom({ id: "custom", name: "WAYPOINT", e, n });
                }}
              />
            </svg>
          </div>

          <div className="legend-row">
            <span><i style={{ background: "#e45fbf", height: 3 }} />safest route</span>
            <span><i style={{ background: "#8a9bb0", height: 3 }} />shortest route</span>
            <span><i style={{ background: "#e5484d", height: 8, width: 8, borderRadius: 8 }} />contact + risk halo</span>
            <span>click the chart to move the waypoint</span>
          </div>
        </Panel>

        <div className="stack">
          <Panel title="Route comparison" note="live re-solve" live>
            {!safe || !short ? (
              <div className="empty">No route to that waypoint</div>
            ) : (
              <>
                <div className="readout" style={{ gridTemplateColumns: "1fr" }}>
                  <div className="readout-row">
                    <span className="readout-k">Shortest</span>
                    <span className="readout-v">{fmtDistance(solution.shortM)}</span>
                  </div>
                  <div className="readout-row">
                    <span className="readout-k">Safest</span>
                    <span className="readout-v" style={{ color: "var(--magenta)" }}>
                      {fmtDistance(solution.safeM)}
                    </span>
                  </div>
                  <div className="readout-row">
                    <span className="readout-k">Extra walking</span>
                    <span className="readout-v">{detour > 0 ? `+${detour.toFixed(0)}%` : "none"}</span>
                  </div>
                  <div className="readout-row">
                    <span className="readout-k">Risk avoided</span>
                    <span className="readout-v" style={{ color: "var(--verdigris)" }}>
                      {riskCut > 0.5 ? `${riskCut.toFixed(0)}% less exposure` : "routes agree"}
                    </span>
                  </div>
                  <div className="readout-row">
                    <span className="readout-k">Waypoint</span>
                    <span className="readout-v">
                      {goalLL.lat.toFixed(4)}N {goalLL.lng.toFixed(4)}E
                    </span>
                  </div>
                </div>

                <p className="prose" style={{ fontSize: 13, marginTop: 12, marginBottom: 0 }}>
                  {riskCut > 5
                    ? `Taking the magenta line adds ${fmtDistance(Math.max(0, solution.safeM - solution.shortM))} on foot and removes about ${riskCut.toFixed(0)}% of the exposure the direct line would have walked you into.`
                    : `With the sector this quiet the two solutions are effectively the same route. The safe pass only diverges once something is actually in the way.`}
                </p>
              </>
            )}
          </Panel>

          <Panel title="Waypoint">
            <div className="btn-row">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  className={`btn ${!custom && goalId === p.id ? "primary" : ""}`}
                  onClick={() => { setCustom(null); setGoalId(p.id); }}
                >
                  {p.name}
                </button>
              ))}
            </div>
            {custom && (
              <p className="prose" style={{ fontSize: 13, marginTop: 10, marginBottom: 0 }}>
                Using a chart waypoint at {Math.round(custom.e)} m east,
                {" "}{Math.round(custom.n)} m north. Pick a named point above to go back.
              </p>
            )}

            <div className="field" style={{ marginTop: 16 }}>
              <label htmlFor="avoid">
                Avoidance weight · <span className="field-val">{avoidance}</span>
              </label>
              <input
                id="avoid"
                type="range" min="1" max="16" step="1"
                value={avoidance}
                onChange={(e) => setAvoidance(Number(e.target.value))}
              />
              <p className="prose" style={{ fontSize: 12.5, margin: 0 }}>
                How much distance the router will trade for clearance. At 1 it
                behaves like the shortest path; at 16 it hugs the map edges to
                stay clear.
              </p>
            </div>
          </Panel>

          <Panel title="Safe route legs" note="turn by turn">
            {legs.length === 0 ? (
              <div className="empty">No route computed</div>
            ) : (
              <ol style={{ margin: 0, paddingLeft: 20, fontFamily: "var(--f-mono)", fontSize: 12.5, lineHeight: 1.9 }}>
                {legs.map((l, i) => (
                  <li key={i}>
                    Head {l.dir} for {Math.round(l.m)} m
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>
      </div>

      <Panel title="Why two routes" style={{ marginTop: 14 }}>
        <div className="grid g-3">
          <div>
            <div className="eyebrow">Risk field</div>
            <p className="prose" style={{ fontSize: 14 }}>
              Each of the {tracks.length} live contacts stamps a soft cost dome onto the
              grid — wider for animals, tighter for people — falling off with the
              square of distance from its centre. Nothing is a hard wall unless a
              contact is already critical.
            </p>
          </div>
          <div>
            <div className="eyebrow">Admissible search</div>
            <p className="prose" style={{ fontSize: 14 }}>
              A* with a straight-line heuristic on an 8-connected grid. The
              heuristic never over-estimates, so the shortest solution really is
              the shortest, and the search stays fast enough to re-run every two
              seconds as contacts move.
            </p>
          </div>
          <div>
            <div className="eyebrow">Honest failure</div>
            <p className="prose" style={{ fontSize: 14 }}>
              If critical contacts fully enclose the waypoint, the safe pass
              returns nothing rather than inventing a corridor, and the panel says
              so. A router that always answers is a router you cannot trust.
            </p>
          </div>
        </div>
      </Panel>
    </>
  );
}
