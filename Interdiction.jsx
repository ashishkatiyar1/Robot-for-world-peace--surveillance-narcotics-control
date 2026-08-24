import { Panel, Chip, AlertFeed } from "../components/Chrome.jsx";
import { tag } from "../components/Instruments.jsx";
import { useMission } from "../state/MissionContext.jsx";
import { fmtDistance, enuToLatLng } from "../lib/geo.js";

export default function Interdiction() {
  const { suspicious, tracks, home, counts } = useMission();

  const flagged = suspicious.filter((s) => s.unattended);
  const watching = suspicious.filter((s) => !s.unattended);
  const fastVehicles = tracks.filter((t) => t.kind === "vehicle" && t.speed > 8);

  return (
    <>
      <div className="page-head">
        <div className="eyebrow">Module · OBJ</div>
        <h1 className="page-title">Interdiction</h1>
        <p className="prose">
          Narcotics work from the air is rarely about recognising a substance. It
          is about noticing behaviour: a bag set down and left, a vehicle that
          stops where no vehicle should, a handover at a treeline. This module
          watches for the first of those — an object that has stopped moving with
          nobody near it — and timestamps the moment it qualified.
        </p>
      </div>

      <div className="kpi-row">
        <div className={`kpi ${flagged.length ? "tier-HIGH" : "tier-LOW"}`}>
          <div className="kpi-v" style={{ color: "var(--tier)" }}>{flagged.length}</div>
          <div className="kpi-k">Packages flagged</div>
        </div>
        <div className="kpi">
          <div className="kpi-v">{watching.length}</div>
          <div className="kpi-k">Objects under watch</div>
        </div>
        <div className="kpi">
          <div className="kpi-v">{counts.vehicles}</div>
          <div className="kpi-k">Vehicles in sector</div>
        </div>
        <div className={`kpi ${fastVehicles.length ? "tier-MEDIUM" : ""}`}>
          <div className="kpi-v" style={{ color: fastVehicles.length ? "var(--tier)" : undefined }}>
            {fastVehicles.length}
          </div>
          <div className="kpi-k">Moving above 8 m/s</div>
        </div>
      </div>

      <div className="grid g-2" style={{ marginTop: 14 }}>
        <Panel title="Flagged objects" note="dwell + separation" live>
          {suspicious.length === 0 ? (
            <div className="empty">No unattended objects in sector</div>
          ) : (
            <div className="stack" style={{ gap: 10 }}>
              {[...suspicious]
                .sort((a, b) => Number(b.unattended) - Number(a.unattended))
                .map((s) => {
                  const ll = enuToLatLng(home, s.pos.e, s.pos.n);
                  return (
                    <div key={s.id} className={`tcard tier-${s.unattended ? "HIGH" : "LOW"}`}>
                      <div className="tcard-top">
                        <div>
                          <div className="tcard-id">
                            {tag(s)}{" "}
                            <span style={{ color: "var(--muted)", fontWeight: 500 }}>
                              {s.species || "object"}
                            </span>
                          </div>
                          <div className="panel-note">
                            {s.unattended ? "unattended — flagged" : "attended or recently placed"}
                          </div>
                        </div>
                        <Chip level={s.unattended ? "HIGH" : "LOW"}>
                          {s.unattended ? "flagged" : "watching"}
                        </Chip>
                      </div>
                      <div className="readout">
                        <div className="readout-row">
                          <span className="readout-k">Range</span>
                          <span className="readout-v">{fmtDistance(s.distance)}</span>
                        </div>
                        <div className="readout-row">
                          <span className="readout-k">Bearing</span>
                          <span className="readout-v">{Math.round(s.bearingFromUser)}° {s.bearingCompass}</span>
                        </div>
                        <div className="readout-row">
                          <span className="readout-k">Still for</span>
                          <span className="readout-v">{Math.round(s.dwell)} s</span>
                        </div>
                        <div className="readout-row">
                          <span className="readout-k">Nearest person</span>
                          <span className="readout-v">
                            {isFinite(s.nearestPerson) ? fmtDistance(s.nearestPerson) : "none in sector"}
                          </span>
                        </div>
                        <div className="readout-row">
                          <span className="readout-k">Position</span>
                          <span className="readout-v">{ll.lat.toFixed(5)}N</span>
                        </div>
                        <div className="readout-row">
                          <span className="readout-k"> </span>
                          <span className="readout-v">{ll.lng.toFixed(5)}E</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </Panel>

        <div className="stack">
          <Panel title="The rule being applied" note="two conditions">
            <div className="readout" style={{ gridTemplateColumns: "1fr" }}>
              <div className="readout-row">
                <span className="readout-k">Motion</span>
                <span className="readout-v">under 0.25 m/s</span>
              </div>
              <div className="readout-row">
                <span className="readout-k">Separation</span>
                <span className="readout-v">no person within 25 m</span>
              </div>
              <div className="readout-row">
                <span className="readout-k">Dwell</span>
                <span className="readout-v">held for 8 s or more</span>
              </div>
              <div className="readout-row">
                <span className="readout-k">Classes watched</span>
                <span className="readout-v">backpack · suitcase · handbag</span>
              </div>
            </div>
            <p className="prose" style={{ fontSize: 13, marginTop: 12, marginBottom: 0 }}>
              Deliberately conservative, and deliberately not a verdict. A flag
              means a human should look at this frame — it does not mean
              contraband, and the console never claims it does. Over a busy
              market this rule will produce false positives, which is the correct
              failure direction for a tool that only ever recommends a second
              look.
            </p>
          </Panel>

          <Panel title="Vehicles" note="speed screening">
            {tracks.filter((t) => t.kind === "vehicle").length === 0 ? (
              <div className="empty">No vehicles tracked</div>
            ) : (
              <div className="tbl-scroll">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Track</th>
                      <th>Range</th>
                      <th>Speed</th>
                      <th>Course</th>
                      <th>Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tracks.filter((t) => t.kind === "vehicle").map((v) => (
                      <tr key={v.id}>
                        <td>{tag(v)}</td>
                        <td>{fmtDistance(v.distance)}</td>
                        <td style={{ color: v.speed > 8 ? "var(--amber)" : undefined }}>
                          {v.speed.toFixed(1)} m/s
                        </td>
                        <td>{v.heading == null ? "—" : `${Math.round(v.heading)}° ${v.headingCompass}`}</td>
                        <td style={{ color: "var(--muted)" }}>
                          {v.speed > 8 ? "above track speed" : v.speed < 0.5 ? "stopped" : "nominal"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel title="Evidence log" note="timestamped">
            <AlertFeed limit={10} />
          </Panel>
        </div>
      </div>
    </>
  );
}
