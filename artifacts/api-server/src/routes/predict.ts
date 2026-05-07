import { Router, type IRouter } from "express";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { fetchWeather, type WeatherInfo } from "../lib/weather.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// predict.py lives at the artifact root (artifacts/api-server/predict.py)
// __dirname resolves to dist/ at runtime, so one ".." gets us to artifact root
const PREDICT_SCRIPT = path.join(__dirname, "..", "predict.py");

const router: IRouter = Router();

interface SegmentInput {
  lat: number;
  lng: number;
  distance_km: number;
  weather: string;
  hour: number;
  has_junction: boolean;
  has_crossing: boolean;
  has_traffic_signal: boolean;
  has_roundabout: boolean;
}

interface Waypoint {
  lat: number;
  lng: number;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function interpolateLinear(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

function interpolateOnRoute(waypoints: Waypoint[], cumDist: number[], targetDist: number): Waypoint {
  if (targetDist <= 0) return waypoints[0];
  for (let i = 1; i < cumDist.length; i++) {
    if (cumDist[i] >= targetDist || i === cumDist.length - 1) {
      const segStart = cumDist[i - 1];
      const segEnd = cumDist[i];
      const t = segEnd > segStart ? (targetDist - segStart) / (segEnd - segStart) : 0;
      return {
        lat: waypoints[i - 1].lat + t * (waypoints[i].lat - waypoints[i - 1].lat),
        lng: waypoints[i - 1].lng + t * (waypoints[i].lng - waypoints[i - 1].lng),
      };
    }
  }
  return waypoints[waypoints.length - 1];
}

function segmentAlongWaypoints(
  waypoints: Waypoint[],
  stepKm: number
): Array<{ startPt: Waypoint; endPt: Waypoint; midPt: Waypoint; distKm: number }> {
  // Compute cumulative distances along the route
  const cumDist = [0];
  for (let i = 1; i < waypoints.length; i++) {
    cumDist.push(
      cumDist[i - 1] + haversineKm(waypoints[i - 1].lat, waypoints[i - 1].lng, waypoints[i].lat, waypoints[i].lng)
    );
  }
  const totalDist = cumDist[cumDist.length - 1];
  const effectiveStep = Math.max(0.5, Math.min(stepKm, totalDist));
  const numSegments = Math.max(1, Math.ceil(totalDist / effectiveStep));
  const segLen = totalDist / numSegments;

  const segments = [];
  for (let i = 0; i < numSegments; i++) {
    const startDist = i * segLen;
    const endDist = (i + 1) * segLen;
    const midDist = (startDist + endDist) / 2;
    segments.push({
      startPt: interpolateOnRoute(waypoints, cumDist, startDist),
      endPt: interpolateOnRoute(waypoints, cumDist, endDist),
      midPt: interpolateOnRoute(waypoints, cumDist, midDist),
      distKm: segLen,
    });
  }
  return segments;
}

function callPython(segments: SegmentInput[]): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    const pythonPath = process.env.PYTHON_PATH || "python3";
    const proc = spawn(pythonPath, [PREDICT_SCRIPT], {
      env: { ...process.env },
    });

    const inputJson = JSON.stringify(segments);
    let stdout = "";
    let stderr = "";

    proc.stdin.write(inputJson);
    proc.stdin.end();

    proc.stdout.on("data", (d: Buffer) => {
      stdout += d.toString();
    });

    proc.stderr.on("data", (d: Buffer) => {
      stderr += d.toString();
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Python process exited with code ${code}: ${stderr}`));
        return;
      }
      try {
        const parsed = JSON.parse(stdout.trim());
        if (parsed.error) {
          reject(new Error(parsed.error));
        } else {
          resolve(parsed);
        }
      } catch {
        reject(new Error(`Failed to parse Python output: ${stdout}`));
      }
    });

    proc.on("error", (err) => {
      reject(new Error(`Failed to spawn Python: ${err.message}`));
    });
  });
}

const RISK_LABELS = ["Low", "Moderate", "High", "Critical"];

router.post("/predict", async (req, res): Promise<void> => {
  const {
    startLat,
    startLng,
    endLat,
    endLng,
    totalDistanceKm,
    stepKm = 10,
    hour,
    hasJunction = false,
    hasCrossing = false,
    hasTrafficSignal = false,
    hasRoundabout = false,
    routeWaypoints,
  } = req.body;

  if (
    typeof startLat !== "number" ||
    typeof startLng !== "number" ||
    typeof endLat !== "number" ||
    typeof endLng !== "number" ||
    typeof totalDistanceKm !== "number"
  ) {
    res.status(400).json({ error: "Invalid input: startLat, startLng, endLat, endLng, totalDistanceKm are required numbers" });
    return;
  }

  const currentHour = hour ?? new Date().getHours();

  // Auto-fetch real-time weather for the route midpoint
  const midLat = (startLat + endLat) / 2;
  const midLng = (startLng + endLng) / 2;
  let weatherInfo: WeatherInfo | null = null;
  let autoWeather = "Clear";

  try {
    weatherInfo = await fetchWeather(midLat, midLng);
    autoWeather = weatherInfo.condition;
    req.log.info({ condition: autoWeather, lat: midLat, lng: midLng }, "Auto-fetched weather");
  } catch (err) {
    req.log.warn({ err }, "Auto weather fetch failed, defaulting to Clear");
  }

  // Build segment inputs — using real road waypoints when available
  let segmentInputs: SegmentInput[];
  let segments: Array<{
    segmentIndex: number;
    startLat: number;
    startLng: number;
    endLat: number;
    endLng: number;
    distanceKm: number;
    riskLevel: number;
    riskLabel: string;
    riskProbabilities: number[];
    riskScore: number;
  }>;

  const hasRealRoute =
    Array.isArray(routeWaypoints) &&
    routeWaypoints.length >= 2 &&
    typeof routeWaypoints[0].lat === "number";

  if (hasRealRoute) {
    // Segment along actual road waypoints
    req.log.info({ waypointCount: routeWaypoints.length }, "Segmenting along real road route");
    const roadSegments = segmentAlongWaypoints(routeWaypoints as Waypoint[], stepKm);

    segmentInputs = roadSegments.map((seg) => ({
      lat: seg.midPt.lat,
      lng: seg.midPt.lng,
      distance_km: seg.distKm,
      weather: autoWeather,
      hour: currentHour,
      has_junction: hasJunction,
      has_crossing: hasCrossing,
      has_traffic_signal: hasTrafficSignal,
      has_roundabout: hasRoundabout,
    }));

    let predictions: unknown[];
    try {
      predictions = await callPython(segmentInputs);
    } catch (err: unknown) {
      req.log.error({ err }, "Python prediction failed");
      res.status(500).json({ error: `Prediction failed: ${err instanceof Error ? err.message : String(err)}` });
      return;
    }

    segments = predictions.map((pred: unknown, i: number) => {
      const p = pred as { risk_level: number; risk_label: string; risk_probabilities: number[]; risk_score: number };
      const seg = roadSegments[i];
      return {
        segmentIndex: i,
        startLat: seg.startPt.lat,
        startLng: seg.startPt.lng,
        endLat: seg.endPt.lat,
        endLng: seg.endPt.lng,
        distanceKm: seg.distKm,
        riskLevel: p.risk_level,
        riskLabel: p.risk_label,
        riskProbabilities: p.risk_probabilities,
        riskScore: p.risk_score,
      };
    });
  } else {
    // Fallback: linear interpolation between start and end
    req.log.info("No road waypoints provided, using linear interpolation fallback");
    const effectiveStepKm = Math.max(1, Math.min(stepKm, totalDistanceKm));
    const numSegments = Math.max(1, Math.ceil(totalDistanceKm / effectiveStepKm));

    segmentInputs = [];
    for (let i = 0; i < numSegments; i++) {
      const tMid = (i + 0.5) / numSegments;
      segmentInputs.push({
        lat: interpolateLinear(startLat, endLat, tMid),
        lng: interpolateLinear(startLng, endLng, tMid),
        distance_km: totalDistanceKm / numSegments,
        weather: autoWeather,
        hour: currentHour,
        has_junction: hasJunction,
        has_crossing: hasCrossing,
        has_traffic_signal: hasTrafficSignal,
        has_roundabout: hasRoundabout,
      });
    }

    let predictions: unknown[];
    try {
      predictions = await callPython(segmentInputs);
    } catch (err: unknown) {
      req.log.error({ err }, "Python prediction failed");
      res.status(500).json({ error: `Prediction failed: ${err instanceof Error ? err.message : String(err)}` });
      return;
    }

    segments = predictions.map((pred: unknown, i: number) => {
      const p = pred as { risk_level: number; risk_label: string; risk_probabilities: number[]; risk_score: number };
      const tStart = i / numSegments;
      const tEnd = (i + 1) / numSegments;
      return {
        segmentIndex: i,
        startLat: interpolateLinear(startLat, endLat, tStart),
        startLng: interpolateLinear(startLng, endLng, tStart),
        endLat: interpolateLinear(startLat, endLat, tEnd),
        endLng: interpolateLinear(startLng, endLng, tEnd),
        distanceKm: totalDistanceKm / numSegments,
        riskLevel: p.risk_level,
        riskLabel: p.risk_label,
        riskProbabilities: p.risk_probabilities,
        riskScore: p.risk_score,
      };
    });
  }

  const allScores = segments.map((s) => s.riskScore);
  const overallRiskScore = allScores.reduce((sum, s) => sum + s, 0) / allScores.length;
  const overallRiskLevel = Math.min(3, Math.floor(overallRiskScore / 25));
  const overallRiskLabel = RISK_LABELS[overallRiskLevel];

  const realTotalDistance = hasRealRoute
    ? segments.reduce((sum, s) => sum + s.distanceKm, 0)
    : totalDistanceKm;

  res.json({
    segments,
    overallRiskScore: Math.round(overallRiskScore * 100) / 100,
    overallRiskLevel,
    overallRiskLabel,
    totalDistanceKm: Math.round(realTotalDistance * 100) / 100,
    segmentCount: segments.length,
    weatherCondition: autoWeather,
    weatherInfo,
    hour: currentHour,
  });
});

export default router;
