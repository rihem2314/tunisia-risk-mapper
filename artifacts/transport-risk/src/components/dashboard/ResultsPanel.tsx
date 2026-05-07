import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { PredictRouteResult, WeatherInfo } from "@workspace/api-client-react";
import { Wind, Droplets, Thermometer, Bot, AlertCircle, Loader2 } from "lucide-react";

const WEATHER_ICONS: Record<string, string> = {
  Clear: "☀️",
  Cloudy: "☁️",
  Rain: "🌧️",
  Snow: "❄️",
  Fog: "🌫️",
  Thunderstorm: "⛈️",
  Hail: "🌨️",
  Windy: "💨",
  Other: "🌤️",
};

interface ResultsPanelProps {
  result: PredictRouteResult | null;
  recommendation?: string;
  isLoadingRecommendation?: boolean;
}

function WeatherCard({ weather }: { weather: WeatherInfo }) {
  return (
    <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">{WEATHER_ICONS[weather.condition] ?? "🌤️"}</span>
          <div>
            <div className="font-semibold text-sm">{weather.condition}</div>
            <div className="text-[10px] text-muted-foreground">{weather.description}</div>
          </div>
        </div>
        <div className="text-2xl font-bold font-mono text-primary">
          {weather.temperatureCelsius.toFixed(1)}°C
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1">
          <Droplets className="w-3 h-3 text-blue-400" />
          {weather.humidity.toFixed(0)}% RH
        </div>
        <div className="flex items-center gap-1">
          <Wind className="w-3 h-3 text-slate-400" />
          {weather.windSpeedKmh.toFixed(0)} km/h
        </div>
        <div className="flex items-center gap-1">
          <Thermometer className="w-3 h-3 text-orange-400" />
          {weather.precipitationMm.toFixed(1)} mm
        </div>
      </div>
    </div>
  );
}

function RecommendationText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {lines.map((line, i) => {
        if (line.startsWith("## ")) {
          return (
            <h4 key={i} className="font-semibold text-xs uppercase tracking-wider text-primary mt-3 first:mt-0">
              {line.slice(3)}
            </h4>
          );
        }
        if (line.startsWith("- ") || line.startsWith("* ")) {
          return (
            <div key={i} className="flex gap-2 text-xs text-foreground/90">
              <span className="text-primary mt-0.5 flex-shrink-0">•</span>
              <span>{line.slice(2)}</span>
            </div>
          );
        }
        if (line.startsWith("**") && line.endsWith("**")) {
          return (
            <p key={i} className="font-semibold text-xs text-foreground">
              {line.slice(2, -2)}
            </p>
          );
        }
        if (line.trim() === "") return null;
        return (
          <p key={i} className="text-xs text-foreground/80">
            {line}
          </p>
        );
      })}
    </div>
  );
}

export function ResultsPanel({ result, recommendation, isLoadingRecommendation }: ResultsPanelProps) {
  if (!result) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground p-8 text-center border-l border-border bg-card">
        <div className="max-w-sm space-y-2">
          <div className="text-lg font-medium text-foreground">Awaiting Route Data</div>
          <p className="text-sm">Select departure and destination points, configure parameters, and analyze to view sector risk.</p>
        </div>
      </div>
    );
  }

  const getRiskColorClass = (level: number) => {
    switch (level) {
      case 0: return "text-green-500 bg-green-500/10 border-green-500/20";
      case 1: return "text-amber-500 bg-amber-500/10 border-amber-500/20";
      case 2: return "text-red-500 bg-red-500/10 border-red-500/20";
      case 3: return "text-red-900 bg-red-900/20 border-red-900/30 font-bold";
      default: return "text-blue-500 bg-blue-500/10 border-blue-500/20";
    }
  };

  const getRiskColorHex = (level: number) => {
    switch (level) {
      case 0: return "#22c55e";
      case 1: return "#f59e0b";
      case 2: return "#ef4444";
      case 3: return "#7f1d1d";
      default: return "#3b82f6";
    }
  };

  const distribution = [0, 0, 0, 0];
  result.segments.forEach((s) => {
    if (s.riskLevel >= 0 && s.riskLevel <= 3) distribution[s.riskLevel]++;
  });

  return (
    <div className="h-full flex flex-col border-l border-border bg-background overflow-hidden">
      {/* Header summary */}
      <div className="p-6 border-b border-border bg-card">
        <h2 className="text-xl font-bold tracking-tight text-foreground mb-4">Risk Assessment</h2>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <Card className="bg-background border-border shadow-none">
            <CardContent className="p-4 flex flex-col justify-center items-center text-center h-full">
              <div className="text-sm font-medium text-muted-foreground mb-1 uppercase tracking-wider">Overall Risk</div>
              <div
                className="text-4xl font-bold font-mono tracking-tighter mb-2"
                style={{ color: getRiskColorHex(result.overallRiskLevel) }}
              >
                {result.overallRiskScore.toFixed(1)}
              </div>
              <Badge variant="outline" className={getRiskColorClass(result.overallRiskLevel)}>
                {result.overallRiskLabel}
              </Badge>
            </CardContent>
          </Card>

          <div className="space-y-2">
            <Card className="bg-background border-border shadow-none">
              <CardContent className="p-3 py-2 flex justify-between items-center">
                <span className="text-xs text-muted-foreground uppercase font-semibold">Distance</span>
                <span className="font-mono font-medium">{result.totalDistanceKm.toFixed(1)} km</span>
              </CardContent>
            </Card>
            <Card className="bg-background border-border shadow-none">
              <CardContent className="p-3 py-2 flex justify-between items-center">
                <span className="text-xs text-muted-foreground uppercase font-semibold">Segments</span>
                <span className="font-mono font-medium">{result.segmentCount}</span>
              </CardContent>
            </Card>
            <Card className="bg-background border-border shadow-none">
              <CardContent className="p-3 py-2 flex justify-between items-center">
                <span className="text-xs text-muted-foreground uppercase font-semibold">Hour</span>
                <span className="font-mono font-medium">{String(result.hour).padStart(2, "0")}:00</span>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Risk Distribution */}
        <div className="space-y-2 mb-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Risk Distribution</div>
          <div className="h-4 flex rounded-full overflow-hidden w-full bg-muted">
            {distribution.map((count, index) => {
              if (count === 0) return null;
              const percentage = (count / result.segmentCount) * 100;
              return (
                <div
                  key={`dist-${index}`}
                  style={{ width: `${percentage}%`, backgroundColor: getRiskColorHex(index) }}
                  title={`Level ${index}: ${count} segments`}
                />
              );
            })}
          </div>
        </div>

        {/* Live Weather */}
        {result.weatherInfo && (
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Live Weather</div>
            <WeatherCard weather={result.weatherInfo} />
          </div>
        )}
      </div>

      {/* Scrollable content */}
      <ScrollArea className="flex-1">
        <div className="px-6 py-3 border-b border-border bg-muted/30">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">Segment Breakdown</h3>
        </div>
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="w-[60px] text-center text-xs">Seg</TableHead>
              <TableHead className="text-xs">Risk</TableHead>
              <TableHead className="text-right text-xs">Score</TableHead>
              <TableHead className="text-right text-xs">Dist</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.segments.map((segment) => (
              <TableRow key={`seg-table-${segment.segmentIndex}`} className="border-border hover:bg-muted/50">
                <TableCell className="font-mono text-xs text-center text-muted-foreground">
                  {segment.segmentIndex + 1}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={`text-[10px] py-0 px-2 h-5 ${getRiskColorClass(segment.riskLevel)}`}>
                    {segment.riskLabel}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${segment.riskScore}%`,
                          backgroundColor: getRiskColorHex(segment.riskLevel),
                        }}
                      />
                    </div>
                    <span className="font-mono text-xs w-6 inline-block">{Math.round(segment.riskScore)}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono text-xs text-muted-foreground">
                  {segment.distanceKm.toFixed(1)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* AI Safety Recommendations */}
        <div className="px-6 pt-4 pb-6">
          <Separator className="mb-4" />
          <div className="flex items-center gap-2 mb-3">
            <Bot className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">AI Safety Advisor</h3>
            {isLoadingRecommendation && (
              <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" /> Analyzing…
              </span>
            )}
          </div>

          {!recommendation && !isLoadingRecommendation && (
            <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md p-3">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <span>AI recommendations will appear here after route analysis.</span>
            </div>
          )}

          {isLoadingRecommendation && !recommendation && (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-3 bg-muted rounded animate-pulse" style={{ width: `${70 + (i % 3) * 10}%` }} />
              ))}
            </div>
          )}

          {recommendation && (
            <div className="bg-card border border-border rounded-lg p-4">
              <RecommendationText text={recommendation} />
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
