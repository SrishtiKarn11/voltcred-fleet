const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const vehicleRoutes = require("./routes/vehicle.routes");
const positionRoutes = require("./routes/position.routes");
const commandRoutes = require("./routes/command.routes");
const reportsRoutes = require("./routes/reports.routes");

const app = express();

app.use(cors());
app.use(express.json());

// API routes
app.use("/api/vehicles", vehicleRoutes);
app.use("/api/vehicles", commandRoutes);
app.use("/api/positions", positionRoutes);
app.use("/api/reports", reportsRoutes);

// Serve built frontend in production
const frontendDist = path.join(__dirname, "../../frontend/dist");

if (require("fs").existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get("*", (req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });
} else {
  app.get("/", (req, res) => {
    res.json({ success: true, message: "VoltCred Fleet Backend Running" });
  });
}

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});