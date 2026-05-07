import { Router, type IRouter } from "express";
import OpenAI from "openai";

const router: IRouter = Router();

function createOpenAIClient(): OpenAI | null {
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;

  if (!apiKey) return null;

  return new OpenAI({
    apiKey,
    ...(baseURL ? { baseURL } : {}),
  });
}

router.post("/recommend", async (req, res): Promise<void> => {
  const {
    segments,
    overallRiskScore,
    overallRiskLabel,
    weatherInfo,
    totalDistanceKm,
    hour,
    fromCity,
    toCity,
  } = req.body;

  if (!segments || !Array.isArray(segments)) {
    res.status(400).json({ error: "segments array is required" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const openai = createOpenAIClient();

  if (!openai) {
    // Fallback: return a static recommendation if no AI key available
    const fallback = generateFallbackRecommendation(
      fromCity || "Origin",
      toCity || "Destination",
      overallRiskLabel,
      overallRiskScore,
      weatherInfo,
      hour
    );
    for (const chunk of fallback.split(" ")) {
      res.write(`data: ${JSON.stringify({ content: chunk + " " })}\n\n`);
    }
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
    return;
  }

  const segmentSummary = (segments as Array<{ riskLabel: string; riskScore: number }>)
    .map((s, i) => `Segment ${i + 1}: ${s.riskLabel} (score: ${Math.round(s.riskScore)}/100)`)
    .join(", ");

  const origin = fromCity || "Origin";
  const dest = toCity || "Destination";
  const weather = weatherInfo as {
    condition?: string;
    description?: string;
    temperatureCelsius?: number;
    windSpeedKmh?: number;
    precipitationMm?: number;
  } | null;

  const systemPrompt = `You are a road safety expert specializing in Tunisia's road network. Analyze route risk data and provide clear, actionable safety recommendations in English. Be concise and practical. Organize your response using these markdown sections:
## Risk Analysis
## Key Hazards
## Safety Recommendations
## Timing Advice`;

  const userPrompt = `Route: ${origin} → ${dest}
Distance: ${totalDistanceKm} km | Departure: ${String(hour).padStart(2, "0")}:00
Weather: ${weather?.condition ?? "Unknown"} — ${weather?.description ?? ""} | Temp: ${weather?.temperatureCelsius?.toFixed(1) ?? "?"}°C | Wind: ${weather?.windSpeedKmh?.toFixed(0) ?? "?"} km/h | Precip: ${weather?.precipitationMm?.toFixed(1) ?? "?"}mm
Overall Risk: ${overallRiskLabel} (score: ${Number(overallRiskScore).toFixed(1)}/100)
Segment breakdown: ${segmentSummary}

Provide concise, actionable safety recommendations for this trip.`;

  try {
    const model = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ? "gpt-4o-mini" : "gpt-4o-mini";
    const stream = await openai.chat.completions.create({
      model,
      max_tokens: 600,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    req.log.error({ err }, "LLM recommendation failed");
    const fallback = generateFallbackRecommendation(
      origin, dest, overallRiskLabel, overallRiskScore, weather, hour
    );
    for (const chunk of fallback.split(" ")) {
      res.write(`data: ${JSON.stringify({ content: chunk + " " })}\n\n`);
    }
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  }
});

function generateFallbackRecommendation(
  origin: string,
  dest: string,
  riskLabel: string,
  riskScore: number,
  weather: { condition?: string } | null,
  hour: number
): string {
  const isNight = hour >= 22 || hour <= 5;
  const isRush = [7, 8, 9, 16, 17, 18, 19].includes(hour);
  const isAdverse = ["Rain", "Fog", "Thunderstorm", "Snow", "Hail"].includes(weather?.condition ?? "");

  return `## Risk Analysis
The route from ${origin} to ${dest} has been assessed with an overall risk level of **${riskLabel}** (score: ${Math.round(riskScore)}/100).

## Key Hazards
${isNight ? "- Night driving conditions reduce visibility significantly.\n" : ""}${isRush ? "- Rush hour traffic increases accident probability.\n" : ""}${isAdverse ? `- Adverse weather (${weather?.condition}) requires extra caution.\n` : ""}- Variable road conditions along the route require attention.

## Safety Recommendations
- Maintain safe following distance at all times.
- Reduce speed in high-risk segments.
- Stay alert and avoid distractions while driving.
- Ensure your vehicle lights and brakes are in good condition.

## Timing Advice
${isRush ? "Consider departing outside of rush hours (before 7:00 or after 19:00) to reduce risk." : isNight ? "Night driving is higher risk — consider traveling during daylight hours if possible." : "Current departure time is reasonable. Stay aware of changing conditions."}`;
}

export default router;
