# Tunisia Transport Risk Mapper

A road safety intelligence platform that predicts accident risk along routes in Tunisia using ML, real-time weather, and OSRM road routing.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/transport-risk run dev` — run the frontend (port 21075)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19 + Vite + Tailwind CSS v4 (dark control-room theme)
- Map: Leaflet + react-leaflet with OSRM real-road routing
- API: Express 5 + OpenAPI-first (Orval codegen)
- ML: Python 3 + XGBoost + scikit-learn (trained .pkl models in `attached_assets/`)
- Weather: Open-Meteo API (free, no key needed)
- Routing: OSRM public API (free, no key needed)
- AI: OpenAI via Replit AI integration (SSE-streamed recommendations, falls back to static if no key)

## Where things live

- `lib/api-spec/openapi.yaml` — single source of truth for all API contracts
- `lib/api-client-react/` — auto-generated React Query hooks (do not edit manually)
- `lib/api-zod/` — auto-generated Zod schemas (do not edit manually)
- `artifacts/api-server/src/routes/predict.ts` — route segmentation + ML prediction logic
- `artifacts/api-server/predict.py` — Python ML script (spawned as subprocess)
- `artifacts/api-server/src/routes/recommend.ts` — LLM recommendation streaming
- `artifacts/transport-risk/src/components/map/RouteMap.tsx` — map + OSRM routing
- `artifacts/transport-risk/src/pages/dashboard.tsx` — top-level dashboard orchestration
- `attached_assets/*.pkl` — pre-trained XGBoost model + scaler + label encoders

## Architecture decisions

- **OSRM for real road routing**: RouteMap.tsx calls `router.project-osrm.org` to get actual road waypoints; these are passed to the backend so prediction segments follow real roads instead of straight lines.
- **Python subprocess for ML**: The XGBoost model is loaded in a Python subprocess spawned per request; this avoids embedding a Python runtime in the Node.js server.
- **Auto weather fetch**: The `/predict` endpoint auto-fetches real-time weather from Open-Meteo for the route midpoint — users don't need to manually specify weather.
- **Streaming AI recommendations**: The `/recommend` endpoint uses SSE to stream LLM output character-by-character for a live typing effect.
- **Graceful fallbacks**: Both ML (if pkl files not found) and AI (if no API key) have fallback modes so the app always works.

## Product

Users select origin/destination cities (or click on the map), set departure time and infrastructure flags, then click Analyze. The app:
1. Fetches the real driving route from OSRM and shows it on the map
2. Segments the route and runs XGBoost risk prediction on each segment
3. Auto-fetches real-time weather at the route midpoint from Open-Meteo
4. Colors the map segments by risk level (green/yellow/orange/red)
5. Shows per-segment breakdown with risk scores and distribution
6. Streams AI safety recommendations via SSE

## Gotchas

- Python ML packages must be installed: `pip install joblib numpy pandas scikit-learn xgboost`
- pkl model files live in `attached_assets/` at workspace root — predict.py expects them there
- After editing routes, restart the API server workflow (esbuild rebuild needed)
- After editing the OpenAPI spec, run codegen before starting the server
- OSRM is a free public API with rate limits — for production use a self-hosted instance
- OpenAI recommendation requires `AI_INTEGRATIONS_OPENAI_API_KEY` + `AI_INTEGRATIONS_OPENAI_BASE_URL` env vars (Replit AI integration), or `OPENAI_API_KEY` directly; falls back gracefully if absent

## User preferences

- Dark control-room theme (slate-900 base, cyan primary)
- Real road routing (OSRM) not straight-line interpolation
