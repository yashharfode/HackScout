import crypto from "crypto";
import express from "express";
import cors from "cors";
import { searchHackathons } from "./src/agent.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, "frontend/dist")));

const jobs = new Map();

// Cleanup jobs older than 15 minutes
setInterval(() => {
  const now = Date.now();
  for (const [jobId, job] of jobs.entries()) {
    if (now - job.startedAt > 15 * 60 * 1000) {
      jobs.delete(jobId);
    }
  }
}, 60 * 1000);

app.post("/api/search", (req, res) => {
  const { query } = req.body;
  
  if (!query) {
    return res.status(400).json({ error: "Query parameter 'query' is required." });
  }

  const jobId = "HS-" + crypto.randomBytes(4).toString("hex").toUpperCase();
  
  const job = {
    jobId,
    status: "running",
    stage: "init",
    message: "Initializing search...",
    progress: [],
    result: null,
    error: null,
    startedAt: Date.now()
  };
  
  jobs.set(jobId, job);
  
  // Return immediately
  res.status(202).json({ status: "accepted", jobId });

  // Run in background
  searchHackathons(query, (progressData) => {
    job.progress.push(progressData);
    if (progressData.type) job.stage = progressData.type;
    if (progressData.message) job.message = progressData.message;
    
    if (progressData.type === "complete") {
      job.status = "complete";
      job.result = progressData.result;
    }
  }).catch((error) => {
    job.status = "error";
    job.error = error.message || "An unexpected error occurred.";
  });
});

app.get("/api/search/status/:jobId", (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }
  res.json(job);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 HackScout API & UI running on http://localhost:${PORT}`);
});
