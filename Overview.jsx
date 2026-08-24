import { Link } from "react-router-dom";
import { Panel, ThreatMeter, AlertFeed, Chip } from "../components/Chrome.jsx";
import { ContactLadder, ApproachScope } from "../components/Instruments.jsx";
import { useMission } from "../state/MissionContext.jsx";
import { fmtCountdown, fmtDistance } from "../lib/geo.js";

const MODULES = [
  {
    to: "/approach",
    tag: "TTC",
    name: "Approach",
    txt: "Per-target range, course, speed and a countdown to contact that re-solves every time a target turns.",
  },
  {
    to: "/sensor",
    tag: "CAM",
    name: "Live sensor",
    txt: "COCO-SSD running in the browser over the drone camera, with range from bounding-box geometry fused with LiDAR.",
  },
  {
    to: "/route",
    tag: "NAV",
    name: "Safe route",
    txt: "Two A* solutions over the same terrain: the shortest line out, and the one that keeps the most distance from every contact.",
  },
  {
    to: "/interdiction",
    tag: "OBJ",
    name: "Interdiction",
    txt: "Unattended packages flagged by dwell time and separation from the nearest person, with a timestamped evidence log.",
  },
];

export default function Overview() {
  const { threat, counts, soonest, tracks, mode } = useMission();

  return (
    <>
      <section className="hero">
        <div className="eyebrow">RoboFest for peace · ground station · unit 01</div>
        <h1 className="hero-title">
          Every contact gets<br />its own <em>countdown</em>.
        </h1>
        <p className="hero-lede">
          The drone watches a sector from above, works out what each person,
          animal and vehicle is doing, and answers one question for each of them
          separately: how long until this reaches us. When something turns away
          the estimate dissolves. When it turns back, the clock restarts.
        </p>
      </section>

      <Panel
        title="Time to contact"
        note={mode === "demo" ? "simulation feed" : "live vision"}
        live
      >
        <ContactLadder />
      </Panel>

      <div className="kpi-row">
        <div className={`kpi tier-${threat.level}`}>
          <div className="kpi-v" style={{ color: "var(--tier)" }}>{threat.score}</div>
          <div className="kpi-k">Threat index · {threat.level}</div>
        </div>
        <div className={`kpi ${soonest ? `tier-${soonest.alert}` : ""}`}>
          <div className="kpi-v" style={{ color: soonest ? "var(--tier)" : "var(--faint)" }}>
            {soonest ? fmtCountdown(soonest.eta) : "--:--"}
          </div>
          <div className="kpi-k">
            {soonest ? `Next contact · ${fmtDistance(soonest.distance)} out` : "Nothing closing"}
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-v">{counts.inbound}<span style={{ color: "var(--faint)", fontSize: 17 }}>/{tracks.length}</span></div>
          <div className="kpi-k">Closing · of tracked</div>
        </div>
        <div className="kpi">
          <div className="kpi-v">
            {counts.people}<span style={{ color: "var(--faint)", fontSize: 15 }}>P</span>{" "}
            {counts.animals}<span style={{ color: "var(--faint)", fontSize: 15 }}>A</span>{" "}
            {counts.vehicles}<span style={{ color: "var(--faint)", fontSize: 15 }}>V</span>
          </div>
          <div className="kpi-k">People · animals · vehicles</div>
        </div>
      </div>

      <div className="grid g-scope" style={{ marginTop: 14 }}>
        <Panel title="Approach scope" note="plan position" live>
          <ApproachScope size={380} />
        </Panel>

        <div className="stack">
          <Panel title="Threat index" note="live scoring">
            <ThreatMeter />
          </Panel>
          <Panel title="Alert log" note="newest first">
            <AlertFeed limit={7} />
          </Panel>
        </div>
      </div>

      <Panel title="Modules" note="six channels" style={{ marginTop: 14 }}>
        <div className="grid g-4">
          {MODULES.map((m) => (
            <Link key={m.to} to={m.to} className="mod">
              <span className="eyebrow">{m.tag}</span>
              <div className="mod-name">{m.name}</div>
              <p className="mod-txt">{m.txt}</p>
            </Link>
          ))}
        </div>
      </Panel>

      <Panel title="What the drone is for" style={{ marginTop: 14 }}>
        <div className="grid g-3">
          <div>
            <div className="eyebrow">Surveillance</div>
            <p className="prose" style={{ fontSize: 14 }}>
              Hold a sector from 120 m and keep a continuous count of who is in
              it. Density and grouping are scored, not just totalled, because six
              people arriving together means something different from six people
              spread across a field.
            </p>
          </div>
          <div>
            <div className="eyebrow">Narcotics interdiction</div>
            <p className="prose" style={{ fontSize: 14 }}>
              A bag that stops moving, with nobody within 25 m of it, is worth a
              second look. The console times how long it has been that way and
              logs the moment it was flagged.
            </p>
          </div>
          <div>
            <div className="eyebrow">Wildlife early warning</div>
            <p className="prose" style={{ fontSize: 14 }}>
              For people working in forest edges, the useful output is not
              "elephant detected" but "elephant, 480 m north-east, closing at
              2 m/s, four minutes". <Chip level="HIGH">that is the product</Chip>
            </p>
          </div>
        </div>
      </Panel>
    </>
  );
}
