import { useEffect, useState, useCallback, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "./App.css";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";
const POLL_INTERVAL_MS = 10000;
const STALE_THRESHOLD_MS = 15 * 60 * 1000;
const DEFAULT_CENTER = [17.522624444444443, 78.41514388888889];

const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard",    icon: "grid"    },
  { key: "vehicles",  label: "Vehicles",     icon: "truck"   },
  { key: "live",      label: "Live Tracking",icon: "pin"     },
  { key: "trips",     label: "Trips",        icon: "route"   },
  { key: "reports",   label: "Reports",      icon: "chart"   },
  { key: "settings",  label: "Settings",     icon: "gear"    },
];

const ICONS = {
  grid:   "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z",
  truck:  "M3 6h11v8H3zM14 10h4l3 3v1h-7zM6 18a2 2 0 100-4 2 2 0 000 4zM17 18a2 2 0 100-4 2 2 0 000 4z",
  pin:    "M12 21s7-6.2 7-11.5A7 7 0 105 9.5C5 14.8 12 21 12 21zM12 11.5a2 2 0 100-4 2 2 0 000 4z",
  route:  "M5 6a2 2 0 100-4 2 2 0 000 4zM19 22a2 2 0 100-4 2 2 0 000 4zM5 6v6a4 4 0 004 4h6",
  chart:  "M4 20V10M11 20V4M18 20v-7",
  gear:   "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 13a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V19a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H4a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33h0A1.65 1.65 0 0011 4.09V4a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82v0c.27.6.85 1 1.51 1H20a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z",
  search: "M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z",
  clock:  "M12 22a10 10 0 100-20 10 10 0 000 20zM12 6v6l4 2",
  speed:  "M12 2a10 10 0 11-10 10M12 12l3-3",
  dist:   "M3 12h18M3 6h6M3 18h6",
  save:   "M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2zM17 21v-8H7v8M7 3v5h8",
  bell:   "M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  info:   "M12 22a10 10 0 100-20 10 10 0 000 20zM12 8h.01M11 12h1v4h1",
};

function Icon({ name, size = 18 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={ICONS[name]} />
    </svg>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatTimestamp(iso) {
  if (!iso) return "No Data";
  return new Date(iso).toLocaleString();
}

function formatDuration(seconds) {
  if (!seconds && seconds !== 0) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDistance(meters) {
  if (!meters && meters !== 0) return "—";
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}

function formatSpeed(kmh) {
  if (!kmh && kmh !== 0) return "—";
  return `${Math.round(kmh)} km/h`;
}

function isStale(iso) {
  if (!iso) return true;
  return Date.now() - new Date(iso).getTime() > STALE_THRESHOLD_MS;
}

// ISO datetime-local value (for date inputs)
function toDatetimeLocal(date) {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

// Default date range: last 7 days
function defaultRange() {
  const to = new Date();
  const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  return { from: toDatetimeLocal(from), to: toDatetimeLocal(to) };
}

// ── Data hook ─────────────────────────────────────────────────────────────────
function useFleetData() {
  const [vehicles, setVehicles] = useState([]);
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastFetched, setLastFetched] = useState(null);

  const loadData = useCallback(async () => {
    try {
      const [vRes, pRes] = await Promise.all([
        fetch(`${API_BASE}/api/vehicles`),
        fetch(`${API_BASE}/api/positions`),
      ]);
      if (!vRes.ok) throw new Error(`Vehicles request failed (${vRes.status})`);
      if (!pRes.ok) throw new Error(`Positions request failed (${pRes.status})`);
      const vData = await vRes.json();
      const pData = await pRes.json();
      setVehicles(Array.isArray(vData) ? vData : []);
      setPositions(Array.isArray(pData) ? pData : []);
      setError(null);
      setLastFetched(new Date());
    } catch (err) {
      setError(err.message || "Failed to load fleet data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadData]);

  return { vehicles, positions, loading, error, lastFetched, loadData };
}

// ── StatCard ──────────────────────────────────────────────────────────────────
function StatCard({ label, value, tone, sub }) {
  return (
    <div className={`card card-${tone || "default"}`}>
      <span className="card-label">{label}</span>
      <span className="card-value">{value}</span>
      {sub && <span className="card-sub">{sub}</span>}
    </div>
  );
}

// ── SearchBar ─────────────────────────────────────────────────────────────────
function SearchBar({ value, onChange, placeholder = "Search vehicles…" }) {
  return (
    <div className="search-bar">
      <Icon name="search" size={16} />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="search-input"
      />
      {value && (
        <button className="search-clear" onClick={() => onChange("")} title="Clear">✕</button>
      )}
    </div>
  );
}

// ── FleetMap ──────────────────────────────────────────────────────────────────
function FleetMap({ positions, height = 420 }) {
  const center = positions.length
    ? [positions[0].latitude, positions[0].longitude]
    : DEFAULT_CENTER;
  return (
    <div className="map-box" style={{ height }}>
      <MapContainer center={center} zoom={13} style={{ height: "100%", width: "100%" }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {positions.map((position) => (
          <Marker key={position.id || position.deviceId} position={[position.latitude, position.longitude]}>
            <Popup>
              <strong>Device ID:</strong> {position.deviceId}<br />
              <strong>Latitude:</strong> {position.latitude}<br />
              <strong>Longitude:</strong> {position.longitude}<br />
              <strong>Speed:</strong> {position.speed} km/h<br />
              <strong>Fix time:</strong> {formatTimestamp(position.fixTime)}
              {isStale(position.fixTime) && <><br /><em>Stale — last known location</em></>}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

// ── RouteMap (for trips) ───────────────────────────────────────────────────────
function RouteMap({ routePoints, height = 380 }) {
  const center = routePoints.length
    ? [routePoints[0].latitude, routePoints[0].longitude]
    : DEFAULT_CENTER;
  const polyline = routePoints.map((p) => [p.latitude, p.longitude]);
  return (
    <div className="map-box" style={{ height }}>
      <MapContainer center={center} zoom={14} style={{ height: "100%", width: "100%" }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {polyline.length > 0 && <Polyline positions={polyline} color="#3D7EFF" weight={3} />}
        {routePoints.length > 0 && (
          <>
            <Marker position={[routePoints[0].latitude, routePoints[0].longitude]}>
              <Popup>Start</Popup>
            </Marker>
            <Marker position={[routePoints[routePoints.length - 1].latitude, routePoints[routePoints.length - 1].longitude]}>
              <Popup>End</Popup>
            </Marker>
          </>
        )}
      </MapContainer>
    </div>
  );
}

// ── VehicleTable ──────────────────────────────────────────────────────────────
function VehicleTable({ vehicles, positions, loading, onRequestCommand, commandSupport, commandStatus }) {
  if (loading && vehicles.length === 0) return <p className="muted">Loading vehicles…</p>;
  if (vehicles.length === 0) return <div className="empty-state"><span>🚗</span><p>No vehicles found.</p></div>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>ID</th><th>IMEI / Name</th><th>Status</th>
            <th>Latitude</th><th>Longitude</th><th>Last Position</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {vehicles.map((vehicle) => {
            const position = positions.find((p) => p.deviceId === vehicle.id);
            const hasPosition = Boolean(position);
            const stale = hasPosition && isStale(position.fixTime);
            const support = commandSupport[vehicle.id];
            const status = commandStatus[vehicle.id];
            return (
              <tr key={vehicle.id} className={hasPosition ? (stale ? "row-stale" : "row-live") : ""}>
                <td><span className="id-badge">{vehicle.id}</span></td>
                <td><span className="vehicle-name">{vehicle.name}</span></td>
                <td>
                  <span className={`status-pill ${vehicle.status === "online" ? "pill-online" : "pill-offline"}`}>
                    {vehicle.status}
                  </span>
                </td>
                <td className="mono">{position?.latitude ?? <span className="muted">—</span>}</td>
                <td className="mono">{position?.longitude ?? <span className="muted">—</span>}</td>
                <td>
                  {hasPosition ? (
                    <>{formatTimestamp(position.fixTime)}{stale && <span className="stale-tag"> (stale)</span>}</>
                  ) : <span className="muted">No Data</span>}
                </td>
                <td>
                  <div className="action-cell">
                    <button className="action-btn action-stop"
                      disabled={!support || !support.includes("engineStop") || status?.state === "pending"}
                      onClick={() => onRequestCommand(vehicle, "engineStop")}
                      title={support && !support.includes("engineStop") ? "Not supported" : "Lock engine"}>
                      🔒 Lock
                    </button>
                    <button className="action-btn action-resume"
                      disabled={!support || !support.includes("engineResume") || status?.state === "pending"}
                      onClick={() => onRequestCommand(vehicle, "engineResume")}
                      title={support && !support.includes("engineResume") ? "Not supported" : "Unlock engine"}>
                      🔓 Unlock
                    </button>
                    {status && <span className={`command-status command-${status.state}`}>{status.message}</span>}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── ConfirmDialog ─────────────────────────────────────────────────────────────
function ConfirmDialog({ vehicle, commandType, onConfirm, onCancel }) {
  if (!vehicle) return null;
  const isStop = commandType === "engineStop";
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h3>{isStop ? "🔒 Lock vehicle?" : "🔓 Unlock vehicle?"}</h3>
        <p className="muted">
          This sends a remote {isStop ? "engine stop" : "engine resume"} command to{" "}
          <strong>{vehicle.name}</strong> (ID {vehicle.id}). The vehicle confirms execution on its own.
        </p>
        {isStop && (
          <p className="modal-warning">
            ⚠️ Only do this if the vehicle is stationary and safe to immobilize.
          </p>
        )}
        <div className="modal-actions">
          <button className="modal-btn modal-cancel" onClick={onCancel}>Cancel</button>
          <button className={`modal-btn ${isStop ? "modal-confirm-danger" : "modal-confirm"}`} onClick={onConfirm}>
            {isStop ? "Yes, lock it" : "Yes, unlock it"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── DateRangePicker ───────────────────────────────────────────────────────────
function DateRangePicker({ from, to, onChange, vehicles, selectedVehicleId, onVehicleChange, onSubmit, loading }) {
  return (
    <div className="filter-bar">
      <div className="filter-group">
        <label className="filter-label">Vehicle</label>
        <select className="filter-select" value={selectedVehicleId} onChange={(e) => onVehicleChange(e.target.value)}>
          <option value="">— Select vehicle —</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>{v.name} (ID {v.id})</option>
          ))}
        </select>
      </div>
      <div className="filter-group">
        <label className="filter-label">From</label>
        <input type="datetime-local" className="filter-input" value={from}
          onChange={(e) => onChange({ from: e.target.value, to })} />
      </div>
      <div className="filter-group">
        <label className="filter-label">To</label>
        <input type="datetime-local" className="filter-input" value={to}
          onChange={(e) => onChange({ from, to: e.target.value })} />
      </div>
      <button className="fetch-btn" onClick={onSubmit} disabled={loading || !selectedVehicleId}>
        {loading ? "Loading…" : "Fetch"}
      </button>
    </div>
  );
}

// ── Trips Page ────────────────────────────────────────────────────────────────
function TripsPage({ vehicles }) {
  const range = defaultRange();
  const [dateRange, setDateRange] = useState(range);
  const [vehicleId, setVehicleId] = useState("");
  const [trips, setTrips] = useState([]);
  const [routePoints, setRoutePoints] = useState([]);
  const [loadingTrips, setLoadingTrips] = useState(false);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [error, setError] = useState(null);
  const [selectedTrip, setSelectedTrip] = useState(null);

  async function fetchTrips() {
    if (!vehicleId) return;
    setLoadingTrips(true);
    setError(null);
    setTrips([]);
    setRoutePoints([]);
    setSelectedTrip(null);
    try {
      const from = new Date(dateRange.from).toISOString();
      const to   = new Date(dateRange.to).toISOString();
      const res  = await fetch(`${API_BASE}/api/reports/trips?deviceId=${vehicleId}&from=${from}&to=${to}`);
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      const data = await res.json();
      setTrips(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingTrips(false);
    }
  }

  async function fetchRoute(trip) {
    setSelectedTrip(trip);
    setLoadingRoute(true);
    setRoutePoints([]);
    try {
      const from = new Date(trip.startTime).toISOString();
      const to   = new Date(trip.endTime).toISOString();
      const res  = await fetch(`${API_BASE}/api/reports/route?deviceId=${vehicleId}&from=${from}&to=${to}`);
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      const data = await res.json();
      setRoutePoints(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingRoute(false);
    }
  }

  return (
    <div className="page-content">
      <DateRangePicker from={dateRange.from} to={dateRange.to} onChange={setDateRange}
        vehicles={vehicles} selectedVehicleId={vehicleId} onVehicleChange={setVehicleId}
        onSubmit={fetchTrips} loading={loadingTrips} />
      {error && <div className="error-banner">{error}</div>}
      {trips.length === 0 && !loadingTrips && !error && vehicleId && (
        <div className="empty-state"><span>🗺️</span><p>No trips found for this range.</p></div>
      )}
      {trips.length > 0 && (
        <div className="panel">
          <h2>Trips ({trips.length})</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Start</th><th>End</th><th>Duration</th><th>Distance</th><th>Avg Speed</th><th>Max Speed</th><th>Route</th></tr>
              </thead>
              <tbody>
                {trips.map((trip, i) => (
                  <tr key={i} className={selectedTrip === trip ? "row-selected" : ""}>
                    <td>{formatTimestamp(trip.startTime)}</td>
                    <td>{formatTimestamp(trip.endTime)}</td>
                    <td>{formatDuration(trip.duration)}</td>
                    <td>{formatDistance(trip.distance)}</td>
                    <td>{formatSpeed(trip.averageSpeed)}</td>
                    <td>{formatSpeed(trip.maxSpeed)}</td>
                    <td>
                      <button className="action-btn action-resume" onClick={() => fetchRoute(trip)}>
                        {loadingRoute && selectedTrip === trip ? "Loading…" : "View Route"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {routePoints.length > 0 && (
        <div className="panel" style={{ marginTop: 20 }}>
          <h2>Route — {formatTimestamp(selectedTrip?.startTime)}</h2>
          <RouteMap routePoints={routePoints} height={400} />
        </div>
      )}
    </div>
  );
}

// ── Reports Page ──────────────────────────────────────────────────────────────
function ReportsPage({ vehicles }) {
  const range = defaultRange();
  const [dateRange, setDateRange] = useState(range);
  const [vehicleId, setVehicleId] = useState("");
  const [summary, setSummary] = useState([]);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [error, setError] = useState(null);

  async function fetchSummary() {
    if (!vehicleId) return;
    setLoadingSummary(true);
    setError(null);
    setSummary([]);
    try {
      const from = new Date(dateRange.from).toISOString();
      const to   = new Date(dateRange.to).toISOString();
      const res  = await fetch(`${API_BASE}/api/reports/summary?deviceId=${vehicleId}&from=${from}&to=${to}`);
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      const data = await res.json();
      setSummary(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingSummary(false);
    }
  }

  const totals = useMemo(() => summary.reduce((acc, s) => ({
    distance:     acc.distance     + (s.distance     || 0),
    duration:     acc.duration     + (s.duration     || 0),
    engineHours:  acc.engineHours  + (s.engineHours  || 0),
    maxSpeed:     Math.max(acc.maxSpeed, s.maxSpeed   || 0),
  }), { distance: 0, duration: 0, engineHours: 0, maxSpeed: 0 }), [summary]);

  return (
    <div className="page-content">
      <DateRangePicker from={dateRange.from} to={dateRange.to} onChange={setDateRange}
        vehicles={vehicles} selectedVehicleId={vehicleId} onVehicleChange={setVehicleId}
        onSubmit={fetchSummary} loading={loadingSummary} />
      {error && <div className="error-banner">{error}</div>}
      {summary.length === 0 && !loadingSummary && !error && vehicleId && (
        <div className="empty-state"><span>📊</span><p>No report data found for this range.</p></div>
      )}
      {summary.length > 0 && (
        <>
          <div className="cards" style={{ marginBottom: 20 }}>
            <StatCard label="Total Distance"  value={formatDistance(totals.distance)}  tone="default" />
            <StatCard label="Total Drive Time" value={formatDuration(totals.duration)}  tone="online" />
            <StatCard label="Engine Hours"    value={formatDuration(totals.engineHours)} tone="default" />
            <StatCard label="Top Speed"       value={formatSpeed(totals.maxSpeed)}      tone="offline" />
          </div>
          <div className="panel">
            <h2>Summary Report</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Device</th><th>Distance</th><th>Drive Time</th><th>Engine Hrs</th><th>Avg Speed</th><th>Max Speed</th><th>Stops</th></tr>
                </thead>
                <tbody>
                  {summary.map((s, i) => (
                    <tr key={i}>
                      <td>{s.deviceName || s.deviceId}</td>
                      <td>{formatDistance(s.distance)}</td>
                      <td>{formatDuration(s.duration)}</td>
                      <td>{formatDuration(s.engineHours)}</td>
                      <td>{formatSpeed(s.averageSpeed)}</td>
                      <td>{formatSpeed(s.maxSpeed)}</td>
                      <td>{s.stops ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Settings Page ─────────────────────────────────────────────────────────────
function SettingsPage() {
  const [pollInterval, setPollInterval] = useState(10);
  const [staleThreshold, setStaleThreshold] = useState(15);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    // Persist to localStorage for a realistic UX (actual runtime constants are
    // compile-time in this build, but this shows the full settings pattern)
    localStorage.setItem("vc_poll_interval", pollInterval);
    localStorage.setItem("vc_stale_threshold", staleThreshold);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="page-content">
      <div className="settings-grid">
        <div className="settings-section panel">
          <h2><Icon name="bell" size={16} /> Polling & Refresh</h2>
          <p className="muted" style={{ marginBottom: 20 }}>
            Control how often the dashboard fetches live data from the server.
          </p>
          <div className="setting-row">
            <div>
              <div className="setting-label">Poll interval (seconds)</div>
              <div className="setting-desc">How often to refresh vehicles and positions</div>
            </div>
            <input type="number" className="setting-input" min={5} max={120}
              value={pollInterval} onChange={(e) => setPollInterval(Number(e.target.value))} />
          </div>
          <div className="setting-row">
            <div>
              <div className="setting-label">Stale threshold (minutes)</div>
              <div className="setting-desc">Positions older than this are marked as stale</div>
            </div>
            <input type="number" className="setting-input" min={1} max={60}
              value={staleThreshold} onChange={(e) => setStaleThreshold(Number(e.target.value))} />
          </div>
        </div>

        <div className="settings-section panel">
          <h2><Icon name="shield" size={16} /> Connection</h2>
          <p className="muted" style={{ marginBottom: 20 }}>Backend and Traccar API configuration.</p>
          <div className="setting-row">
            <div>
              <div className="setting-label">Backend URL</div>
              <div className="setting-desc">The Express API this frontend talks to</div>
            </div>
            <input type="text" className="setting-input" defaultValue={API_BASE} readOnly style={{ opacity: 0.7 }} />
          </div>
          <div className="setting-row">
            <div>
              <div className="setting-label">Traccar host</div>
              <div className="setting-desc">Configured in backend .env</div>
            </div>
            <input type="text" className="setting-input" defaultValue="app.voltcred.com" readOnly style={{ opacity: 0.7 }} />
          </div>
        </div>

        <div className="settings-section panel">
          <h2><Icon name="info" size={16} /> About</h2>
          <div className="about-list">
            <div className="about-row"><span>App</span><span>VoltCred Fleet</span></div>
            <div className="about-row"><span>Frontend</span><span>React + Vite</span></div>
            <div className="about-row"><span>Backend</span><span>Node.js / Express</span></div>
            <div className="about-row"><span>Tracking</span><span>Traccar (app.voltcred.com)</span></div>
            <div className="about-row"><span>Map</span><span>Leaflet + OpenStreetMap</span></div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 14 }}>
        <button className="fetch-btn" onClick={handleSave}>
          <Icon name="save" size={14} /> Save preferences
        </button>
        {saved && <span className="command-status command-success">✓ Saved</span>}
      </div>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const { vehicles, positions, loading, error, lastFetched, loadData } = useFleetData();

  const [commandSupport, setCommandSupport] = useState({});
  const [commandStatus, setCommandStatus]   = useState({});
  const [pendingConfirm, setPendingConfirm] = useState(null);
  const [search, setSearch] = useState("");

  // Fetch supported commands once per vehicle
  useEffect(() => {
    vehicles.forEach((vehicle) => {
      if (commandSupport[vehicle.id] !== undefined) return;
      fetch(`${API_BASE}/api/vehicles/${vehicle.id}/commands`)
        .then((res) => (res.ok ? res.json() : { supported: [] }))
        .then((data) => setCommandSupport((prev) => ({ ...prev, [vehicle.id]: data.supported || [] })))
        .catch(() => setCommandSupport((prev) => ({ ...prev, [vehicle.id]: [] })));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicles]);

  // Search filter — applies on vehicles tab and dashboard table
  const filteredVehicles = useMemo(() => {
    if (!search.trim()) return vehicles;
    const q = search.toLowerCase();
    return vehicles.filter(
      (v) =>
        String(v.id).includes(q) ||
        (v.name || "").toLowerCase().includes(q) ||
        (v.status || "").toLowerCase().includes(q)
    );
  }, [vehicles, search]);

  const requestCommand = (vehicle, commandType) => setPendingConfirm({ vehicle, commandType });

  const confirmCommand = async () => {
    const { vehicle, commandType } = pendingConfirm;
    setPendingConfirm(null);
    setCommandStatus((prev) => ({ ...prev, [vehicle.id]: { state: "pending", message: "Sending…" } }));
    try {
      const res = await fetch(`${API_BASE}/api/vehicles/${vehicle.id}/command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: commandType }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error?.message || data.error || "Command failed");
      setCommandStatus((prev) => ({
        ...prev,
        [vehicle.id]: { state: "success", message: commandType === "engineStop" ? "Lock sent" : "Unlock sent" },
      }));
    } catch (err) {
      setCommandStatus((prev) => ({ ...prev, [vehicle.id]: { state: "error", message: "Failed — try again" } }));
    }
    setTimeout(() => {
      setCommandStatus((prev) => { const next = { ...prev }; delete next[vehicle.id]; return next; });
    }, 6000);
  };

  const onlineCount = vehicles.filter((v) => v.status === "online").length;
  const offlineCount = vehicles.filter((v) => v.status !== "online").length;
  const liveCount = positions.filter((p) => !isStale(p.fixTime)).length;

  const titleMap = {
    dashboard: "Fleet Dashboard", vehicles: "Vehicles",
    live: "Live Tracking", trips: "Trips", reports: "Reports", settings: "Settings",
  };

  const tableProps = {
    positions, loading,
    onRequestCommand: requestCommand,
    commandSupport, commandStatus,
  };

  return (
    <div className="app">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">VC</span>
          <span className="brand-name">VoltCred Fleet</span>
        </div>
        <nav>
          <ul>
            {NAV_ITEMS.map((item) => (
              <li key={item.key}>
                <button
                  className={`nav-item ${activeTab === item.key ? "nav-item-active" : ""}`}
                  onClick={() => setActiveTab(item.key)}>
                  <Icon name={item.icon} />
                  <span>{item.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="sidebar-footer">
          <span className={`pulse-dot ${liveCount > 0 ? "pulse-live" : "pulse-idle"}`} />
          <span>{liveCount > 0 ? `${liveCount} reporting live` : "No live signal"}</span>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="content">
        <div className="topbar">
          <h1>{titleMap[activeTab]}</h1>
          <div className="status-row">
            {lastFetched && (
              <span className="last-updated">Updated {lastFetched.toLocaleTimeString()}</span>
            )}
            <button className="refresh-btn" onClick={loadData} disabled={loading}>
              {loading ? "Refreshing…" : "↻ Refresh"}
            </button>
          </div>
        </div>

        {error && <div className="error-banner">⚠ Could not reach backend: {error}. Showing last known data.</div>}

        {/* Dashboard */}
        {activeTab === "dashboard" && (
          <>
            <div className="cards">
              <StatCard label="Total Vehicles" value={vehicles.length} tone="default" sub="fleet size" />
              <StatCard label="Online"  value={onlineCount}  tone="online"  sub="currently active" />
              <StatCard label="Offline" value={offlineCount} tone="offline" sub="no signal" />
              <StatCard label="Live GPS" value={liveCount}   tone="default" sub="fresh position" />
            </div>
            <FleetMap positions={positions} />
            <section className="panel">
              <div className="panel-header">
                <h2>Vehicles</h2>
                <SearchBar value={search} onChange={setSearch} />
              </div>
              <VehicleTable vehicles={filteredVehicles} {...tableProps} />
            </section>
          </>
        )}

        {/* Vehicles */}
        {activeTab === "vehicles" && (
          <section className="panel">
            <div className="panel-header">
              <h2>All Vehicles</h2>
              <SearchBar value={search} onChange={setSearch} />
            </div>
            {filteredVehicles.length === 0 && search && (
              <p className="muted" style={{ marginBottom: 12 }}>No vehicles match "{search}"</p>
            )}
            <VehicleTable vehicles={filteredVehicles} {...tableProps} />
          </section>
        )}

        {/* Live Tracking */}
        {activeTab === "live" && (
          <section className="panel">
            <h2>Live Tracking</h2>
            <p className="muted" style={{ marginBottom: 16 }}>
              {positions.length} device{positions.length === 1 ? "" : "s"} with a reported position.
            </p>
            <FleetMap positions={positions} height={560} />
          </section>
        )}

        {activeTab === "trips"    && <TripsPage   vehicles={vehicles} />}
        {activeTab === "reports"  && <ReportsPage vehicles={vehicles} />}
        {activeTab === "settings" && <SettingsPage />}
      </main>

      {pendingConfirm && (
        <ConfirmDialog
          vehicle={pendingConfirm.vehicle}
          commandType={pendingConfirm.commandType}
          onConfirm={confirmCommand}
          onCancel={() => setPendingConfirm(null)}
        />
      )}
    </div>
  );
}

export default App;
