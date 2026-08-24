import { useState } from "react";
import { Panel, Chip, AlertFeed } from "../components/Chrome.jsx";
import { ContactLadder, ApproachScope, TargetCard, KIND_NAME, tag } from "../components/Instruments.jsx";
import { useMission } from "../state/MissionContext.jsx";
import { fmtCountdown, fmtDistance } from "../lib/geo.js";

export default function Approach() {
  const { tracks, scenario, mode, soonest, pushAlert } = useMission();
  const [selected, setSelected] = useState(null);
  const [sort, setSort] = useState("eta");

  const sorted = [...tracks].sort((a, b) => {
    if (sort === "eta") {
      const ax = isFinite(a.eta) ? a.eta : Infinity;
      const bx = isFinite(b.eta) ? b.eta : Infinity;
      return ax - bx;
    }
    if (sort === "range") return a.distance - b.distance;
    return b.speed - a.speed;
  });

  const sel = tracks.find((t) => t.id === selected) || soonest || tracks[0] || null;

  return (
    <>
      <div className="page-head">
        <div className="eyebrow">Module · TTC</div>
        <h1 className="page-title">Approach</h1>
        <p className="prose">
          One row per contact. Speed and course come from differencing a smoothed
          track, closing speed is the part of that velocity pointed at this
          position, and the countdown is range divided by closing speed — so a
          target crossing in front of you has no countdown at all, however fast
          it is moving.
        </p>
      </div>

      <Panel title="Time to contact" note={mode === "demo" ? "simulation feed" : "live vision"} live>
        <ContactLadder />
      </Panel>

      <div className="grid g-scope" style={{ marginTop: 14 }}>
        <Panel title="Approach scope" note="click a contact" live>
          <ApproachScope size={380} selected={sel?.id} onSelect={setSelected} />
        </Panel>

        <div className="stack">
          {sel ? (
            <Panel title={`Contact ${tag(sel)}`} note={KIND_NAME[sel.kind]} live>
              <div className={`tier-${sel.alert}`}>
                <div className="between" style={{ alignItems: "flex-end" }}>
                  <div>
                    <div
                      className="num"
                      style={{ fontSize: 58, lineHeight: 1, color: "var(--tier)", fontWeight: 600 }}
                    >
                      {fmtCountdown(sel.eta)}
                    </div>
                    <div className="panel-note" style={{ marginTop: 4 }}>
                      {sel.approaching
                        ? `closing at ${sel.closing.toFixed(2)} m/s`
                        : "not closing on this position"}
                    </div>
                  </div>
                  <Chip level={sel.alert} />
                </div>

                <div className="bar" style={{ marginTop: 14, height: 6 }}>
                  <div
                    className="bar-fill"
                    style={{ width: `${isFinite(sel.eta) ? Math.max(0, Math.min(100, (1 - sel.eta / 300) * 100)) : 0}%` }}
                  />
                </div>

                <div className="readout" style={{ marginTop: 16 }}>
                  <Row k="Range" v={fmtDistance(sel.distance)} />
                  <Row k="Seen at" v={`${Math.round(sel.bearingFromUser)}° ${sel.bearingCompass}`} />
                  <Row k="Ground speed" v={`${sel.speed.toFixed(2)} m/s`} />
                  <Row k="Course" v={sel.heading == null ? "stationary" : `${Math.round(sel.heading)}° ${sel.headingCompass}`} />
                  <Row k="Closing rate" v={`${sel.closing > 0 ? "+" : ""}${sel.closing.toFixed(2)} m/s`} />
                  <Row k="Track age" v={`${sel.age} frames`} />
                  <Row
                    k="Range source"
                    v={
                      sel.loc
                        ? `${Math.round(sel.loc.weightLidar * 100)}% lidar · ±${sel.loc.sigma.toFixed(1)} m`
                        : "simulated truth"
                    }
                  />
                  <Row k="Class" v={sel.species || KIND_NAME[sel.kind]} />
                </div>

                <p className="prose" style={{ fontSize: 13, marginTop: 14, marginBottom: 0 }}>
                  {sel.approaching
                    ? `At the current closing rate this contact reaches the position in about ${Math.round(sel.eta)} seconds. The estimate updates roughly four times a second and will stretch or collapse the moment the target changes speed or direction.`
                    : `This contact is not gaining on the position, so no arrival time is published. It stays on the board because a single turn would put it back on the ladder.`}
                </p>
              </div>
            </Panel>
          ) : (
            <Panel title="Contact detail">
              <div className="empty">No contacts in range</div>
            </Panel>
          )}

          {mode === "demo" && (
            <Panel title="Rehearsal controls" note="simulation only">
              <p className="prose" style={{ fontSize: 13.5, marginTop: 0 }}>
                Force the situation the judges should see, then watch the
                countdowns and the alert log respond.
              </p>
              <div className="btn-row">
                <button
                  className="btn primary"
                  onClick={() => {
                    scenario.converge();
                    pushAlert("HIGH", "Rehearsal: all mobile contacts turned inbound");
                  }}
                >
                  Send everything inbound
                </button>
                <button
                  className="btn"
                  disabled={!sel}
                  onClick={() => {
                    if (!sel) return;
                    const src = scenario.entities.find(
                      (e) => Math.hypot(e.e - sel.pos.e, e.n - sel.pos.n) < 30
                    );
                    if (src) {
                      scenario.nudge(src.id);
                      pushAlert("MEDIUM", `Rehearsal: ${tag(sel)} changed course — estimate re-solving`);
                    }
                  }}
                >
                  Turn {sel ? tag(sel) : "target"} off course
                </button>
              </div>
            </Panel>
          )}
        </div>
      </div>

      <Panel
        title="All contacts"
        note={`${tracks.length} tracked`}
        live
        style={{ marginTop: 14 }}
      >
        <div className="row" style={{ marginBottom: 10 }}>
          <span className="panel-note">Sort</span>
          <div className="toggle">
            {[["eta", "countdown"], ["range", "range"], ["speed", "speed"]].map(([k, lbl]) => (
              <button key={k} className={sort === k ? "on" : ""} onClick={() => setSort(k)}>
                {lbl}
              </button>
            ))}
          </div>
        </div>

        <div className="tbl-scroll">
          <table className="tbl">
            <thead>
              <tr>
                <th>Track</th>
                <th>Class</th>
                <th>Range</th>
                <th>Seen at</th>
                <th>Course</th>
                <th>Speed</th>
                <th>Closing</th>
                <th>Countdown</th>
                <th>Alert</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 && (
                <tr>
                  <td colSpan="9" style={{ color: "var(--faint)" }}>
                    Nothing in sensor range.
                  </td>
                </tr>
              )}
              {sorted.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => setSelected(t.id)}
                  style={{ cursor: "pointer", background: t.id === sel?.id ? "rgba(240,168,48,0.07)" : undefined }}
                >
                  <td>{tag(t)}</td>
                  <td style={{ color: "var(--muted)" }}>{t.species || KIND_NAME[t.kind]}</td>
                  <td>{fmtDistance(t.distance)}</td>
                  <td>{Math.round(t.bearingFromUser)}° {t.bearingCompass}</td>
                  <td>{t.heading == null ? "—" : `${Math.round(t.heading)}° ${t.headingCompass}`}</td>
                  <td>{t.speed.toFixed(1)}</td>
                  <td style={{ color: t.approaching ? "var(--bone)" : "var(--faint)" }}>
                    {t.closing > 0 ? "+" : ""}{t.closing.toFixed(2)}
                  </td>
                  <td className={`tier-${t.alert}`} style={{ color: isFinite(t.eta) ? "var(--tier)" : "var(--faint)", fontWeight: 600 }}>
                    {fmtCountdown(t.eta)}
                  </td>
                  <td><Chip level={t.alert} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid g-2" style={{ marginTop: 14 }}>
        <Panel title="Contact cards" note="per target" live>
          <div className="grid g-2">
            {sorted.slice(0, 6).map((t) => (
              <TargetCard key={t.id} t={t} onSelect={setSelected} selected={t.id === sel?.id} />
            ))}
            {sorted.length === 0 && <div className="empty">No contacts</div>}
          </div>
        </Panel>
        <Panel title="Alert log" note="escalations only">
          <AlertFeed limit={12} />
        </Panel>
      </div>
    </>
  );
}

function Row({ k, v }) {
  return (
    <div className="readout-row">
      <span className="readout-k">{k}</span>
      <span className="readout-v">{v}</span>
    </div>
  );
}
