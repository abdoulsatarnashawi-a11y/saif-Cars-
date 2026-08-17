import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { getDb } from "./db/database.js";
import authRoutes from "./routes/auth.js";
import apiRoutes from "./routes/api.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 8080;

getDb();
await import("./db/seed.js");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

app.use("/api/auth", authRoutes);
app.use("/api", apiRoutes);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Saif Cars server running on http://0.0.0.0:${PORT}`);
});
