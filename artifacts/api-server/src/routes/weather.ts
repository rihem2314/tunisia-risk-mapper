import { Router, type IRouter } from "express";
import { fetchWeather } from "../lib/weather.js";

const router: IRouter = Router();

router.get("/weather", async (req, res): Promise<void> => {
  const lat = parseFloat(req.query.lat as string);
  const lng = parseFloat(req.query.lng as string);

  if (isNaN(lat) || isNaN(lng)) {
    res.status(400).json({ error: "Invalid lat/lng parameters" });
    return;
  }

  try {
    const weatherInfo = await fetchWeather(lat, lng);
    res.json(weatherInfo);
  } catch (err) {
    req.log.warn({ err }, "Weather fetch failed, returning fallback");
    res.json({
      condition: "Clear",
      temperatureCelsius: 25,
      humidity: 45,
      windSpeedKmh: 10,
      precipitationMm: 0,
      description: "Weather data unavailable",
    });
  }
});

export default router;
