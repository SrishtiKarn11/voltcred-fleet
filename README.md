# OPTI Traccar

**Live Demo:** [https://voltcred-fleet-production.up.railway.app](https://optitraccar-05b5.up.railway.app/)

A real-time fleet management dashboard for tracking and controlling vehicles via the Traccar GPS platform.

---

## Features

- **Live Dashboard** — vehicle count, online/offline status, live GPS count
- **Real-time Map** — positions auto-refresh every 10 seconds using Leaflet + OpenStreetMap
- **Vehicle Table** — searchable, with per-row status indicators and stale position warnings
- **Remote Commands** — send engine lock / unlock commands to vehicles
- **Trips** — historical trip data with start/end times, distance, speed, and route map
- **Reports** — summary report with total distance, drive time, engine hours, top speed
- **Settings** — configurable preferences panel

---

## Tech Stack

| Layer     | Technology                    |
|-----------|-------------------------------|
| Frontend  | React 19, Vite, React-Leaflet |
| Backend   | Node.js, Express 5            |
| Tracking  | Traccar (app.optimotion.in)   |
| Map       | Leaflet + OpenStreetMap       |
| Hosting   | Railway                       |

---

## Project Structure

```
opti-traccar/
├── backend/
│   ├── src/
│   │   ├── app.js
│   │   ├── routes/
│   │   │   ├── vehicle.routes.js
│   │   │   ├── position.routes.js
│   │   │   ├── command.routes.js
│   │   │   └── reports.routes.js
│   │   └── services/
│   │       └── traccar.service.js
│   └── .env                        ← NOT committed
└── frontend/
    └── src/
        ├── App.jsx
        └── App.css
```

---

## Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/OPTIMotion1/voltcred-fleet.git
cd voltcred-fleet
```

### 2. Configure the backend

Create `backend/.env`:

```env
PORT=5000
TRACCAR_EMAIL=your@email.com
TRACCAR_PASSWORD=yourpassword
```

### 3. Run the backend

```bash
cd backend
npm install
npm run dev
```

### 4. Run the frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## API Endpoints

| Method | Endpoint                        | Description                      |
|--------|---------------------------------|----------------------------------|
| GET    | `/api/vehicles`                 | All vehicles from Traccar        |
| GET    | `/api/positions`                | Current positions of all devices |
| GET    | `/api/vehicles/:id/commands`    | Supported commands for a device  |
| POST   | `/api/vehicles/:id/command`     | Send engineStop or engineResume  |
| GET    | `/api/reports/trips`            | Trip history for a device        |
| GET    | `/api/reports/summary`          | Summary report for a device      |
| GET    | `/api/reports/route`            | GPS route points for a period    |

---

## Security

- Credentials stored as encrypted environment variables — never in source code
- Commands are server-side allow-listed to `engineStop` and `engineResume` only

---

## License

MIT
