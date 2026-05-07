import { useState, useCallback } from "react";
import { RouteMap } from "@/components/map/RouteMap";
import { ControlPanel } from "@/components/dashboard/ControlPanel";
import { ResultsPanel } from "@/components/dashboard/ResultsPanel";
import { usePredictRoute } from "@workspace/api-client-react";
import type { PredictRouteResult } from "@workspace/api-client-react";
import { toast } from "sonner";
import { Activity } from "lucide-react";

interface Point {
  lat: number;
  lng: number;
}

interface RouteReadyData {
  waypoints: Point[];
  distanceKm: number;
}

export default function Dashboard() {
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [endPoint, setEndPoint] = useState<Point | null>(null);
  const [predictionResult, setPredictionResult] = useState<PredictRouteResult | null>(null);
  const [fromCity, setFromCity] = useState("Origin");
  const [toCity, setToCity] = useState("Destination");

  // Real road route data from OSRM
  const [routeWaypoints, setRouteWaypoints] = useState<Point[]>([]);
  const [routeDistanceKm, setRouteDistanceKm] = useState<number | null>(null);

  // AI recommendation state
  const [recommendation, setRecommendation] = useState<string>("");
  const [isLoadingRecommendation, setIsLoadingRecommendation] = useState(false);

  const predictMutation = usePredictRoute();

  const handleRouteReady = useCallback((data: RouteReadyData) => {
    setRouteWaypoints(data.waypoints);
    setRouteDistanceKm(data.distanceKm);
  }, []);

  const fetchRecommendations = useCallback(
    async (result: PredictRouteResult, origin: string, dest: string) => {
      setIsLoadingRecommendation(true);
      setRecommendation("");

      try {
        const response = await fetch("/api/recommend", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            segments: result.segments,
            overallRiskScore: result.overallRiskScore,
            overallRiskLabel: result.overallRiskLabel,
            weatherInfo: result.weatherInfo ?? null,
            totalDistanceKm: result.totalDistanceKm,
            hour: result.hour,
            fromCity: origin,
            toCity: dest,
          }),
        });

        if (!response.body) {
          setIsLoadingRecommendation(false);
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const data = JSON.parse(line.slice(6)) as { content?: string; done?: boolean; error?: string };
              if (data.content) {
                setRecommendation((prev) => prev + data.content);
              }
              if (data.done || data.error) {
                setIsLoadingRecommendation(false);
              }
            } catch {
              // ignore malformed SSE line
            }
          }
        }
        setIsLoadingRecommendation(false);
      } catch (err) {
        setIsLoadingRecommendation(false);
        console.warn("Recommendation fetch failed:", err);
      }
    },
    []
  );

  const handleMapClick = (point: Point) => {
    if (!startPoint) {
      setStartPoint(point);
    } else if (!endPoint) {
      setEndPoint(point);
    } else {
      setStartPoint(point);
      setEndPoint(null);
      setPredictionResult(null);
      setRecommendation("");
      setRouteWaypoints([]);
      setRouteDistanceKm(null);
    }
  };

  const handleAnalyze = (params: Record<string, unknown>) => {
    if (!startPoint || !endPoint) return;

    const totalDistanceKm =
      routeDistanceKm != null ? routeDistanceKm : (params.totalDistanceKm as number);

    predictMutation.mutate(
      {
        data: {
          ...params,
          totalDistanceKm,
          routeWaypoints: routeWaypoints.length >= 2 ? routeWaypoints : undefined,
        },
      },
      {
        onSuccess: (data) => {
          setPredictionResult(data);
          setRecommendation("");
          toast.success("Analysis Complete", {
            description: `Route analyzed over ${data.segmentCount} segments. Overall Risk: ${data.overallRiskLabel}`,
          });
          fetchRecommendations(data, fromCity, toCity);
        },
        onError: (error) => {
          toast.error("Analysis Failed", {
            description: (error as { error?: string }).error || "An unexpected error occurred during prediction.",
          });
        },
      }
    );
  };

  const handleStartChange = (point: Point | null) => {
    setStartPoint(point);
    if (predictionResult) {
      setPredictionResult(null);
      setRecommendation("");
    }
    setRouteWaypoints([]);
    setRouteDistanceKm(null);
  };

  const handleEndChange = (point: Point | null) => {
    setEndPoint(point);
    if (predictionResult) {
      setPredictionResult(null);
      setRecommendation("");
    }
    setRouteWaypoints([]);
    setRouteDistanceKm(null);
  };

  const handleCitiesSelected = useCallback((from: string, to: string) => {
    setFromCity(from);
    setToCity(to);
  }, []);

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden text-foreground">
      {/* Sidebar Controls */}
      <div className="w-80 flex-shrink-0 h-full border-r border-border bg-card flex flex-col z-10 shadow-lg">
        <div className="p-4 border-b border-border flex items-center gap-3 bg-card">
          <div className="w-8 h-8 rounded bg-primary flex items-center justify-center">
            <Activity className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-tight leading-tight">OPS CENTER</h1>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Transport Risk Predictor</p>
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <ControlPanel
            startPoint={startPoint}
            endPoint={endPoint}
            onStartChange={handleStartChange}
            onEndChange={handleEndChange}
            onAnalyze={handleAnalyze}
            onCitiesSelected={handleCitiesSelected}
            isAnalyzing={predictMutation.isPending}
            routeDistanceKm={routeDistanceKm}
          />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex h-full relative">
        {/* Map Area */}
        <div className={`flex-1 h-full transition-all duration-300 ${predictionResult ? "w-2/3" : "w-full"}`}>
          <RouteMap
            startPoint={startPoint}
            endPoint={endPoint}
            onMapClick={handleMapClick}
            predictionResult={predictionResult}
            onRouteReady={handleRouteReady}
          />
        </div>

        {/* Results Panel (Slides in) */}
        {predictionResult && (
          <div className="w-96 flex-shrink-0 h-full z-10 shadow-[-10px_0_15px_-5px_rgba(0,0,0,0.3)] animate-in slide-in-from-right-8 duration-300">
            <ResultsPanel
              result={predictionResult}
              recommendation={recommendation}
              isLoadingRecommendation={isLoadingRecommendation}
            />
          </div>
        )}
      </div>
    </div>
  );
}
