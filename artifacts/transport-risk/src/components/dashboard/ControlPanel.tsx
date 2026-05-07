import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useGetCities, useGetWeather } from "@workspace/api-client-react";
import { haversineDistance } from "@/lib/utils";
import { Cloud, Thermometer, Wind, Droplets, Loader2 } from "lucide-react";

interface Point {
  lat: number;
  lng: number;
}

interface ControlPanelProps {
  startPoint: Point | null;
  endPoint: Point | null;
  onStartChange: (point: Point | null) => void;
  onEndChange: (point: Point | null) => void;
  onAnalyze: (params: Record<string, unknown>) => void;
  onCitiesSelected: (fromCity: string, toCity: string) => void;
  isAnalyzing: boolean;
  routeDistanceKm: number | null;
}

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

export function ControlPanel({
  startPoint,
  endPoint,
  onStartChange,
  onEndChange,
  onAnalyze,
  onCitiesSelected,
  isAnalyzing,
  routeDistanceKm,
}: ControlPanelProps) {
  const { data: citiesData, isLoading: isLoadingCities } = useGetCities();
  const cities = citiesData?.cities || [];

  const [manualDistanceKm, setManualDistanceKm] = useState<string>("");
  const [stepKm, setStepKm] = useState("10");
  const [hour, setHour] = useState([new Date().getHours()]);

  const [hasJunction, setHasJunction] = useState(false);
  const [hasCrossing, setHasCrossing] = useState(false);
  const [hasTrafficSignal, setHasTrafficSignal] = useState(false);
  const [hasRoundabout, setHasRoundabout] = useState(false);

  const [startCityName, setStartCityName] = useState<string>("");
  const [endCityName, setEndCityName] = useState<string>("");

  const midLat = startPoint && endPoint ? (startPoint.lat + endPoint.lat) / 2 : undefined;
  const midLng = startPoint && endPoint ? (startPoint.lng + endPoint.lng) / 2 : undefined;

  const weatherEnabled = midLat != null && midLng != null;
  const { data: weatherData, isLoading: isLoadingWeather } = useGetWeather(
    { lat: weatherEnabled ? midLat! : 0, lng: weatherEnabled ? midLng! : 0 },
    {
      enabled: weatherEnabled,
      staleTime: 5 * 60 * 1000,
    }
  );

  // When OSRM route distance arrives, update the distance display
  useEffect(() => {
    if (routeDistanceKm != null) {
      setManualDistanceKm(routeDistanceKm.toFixed(1));
    } else if (startPoint && endPoint) {
      const dist = haversineDistance(startPoint.lat, startPoint.lng, endPoint.lat, endPoint.lng);
      setManualDistanceKm(dist.toString());
    }
  }, [routeDistanceKm, startPoint, endPoint]);

  useEffect(() => {
    if (startPoint && cities.length > 0) {
      const match = cities.find((c) => c.lat === startPoint.lat && c.lng === startPoint.lng);
      if (!match) setStartCityName("custom");
    }
  }, [startPoint, cities]);

  useEffect(() => {
    if (endPoint && cities.length > 0) {
      const match = cities.find((c) => c.lat === endPoint.lat && c.lng === endPoint.lng);
      if (!match) setEndCityName("custom");
    }
  }, [endPoint, cities]);

  useEffect(() => {
    onCitiesSelected(startCityName || "Origin", endCityName || "Destination");
  }, [startCityName, endCityName]);

  const handleStartCityChange = (cityName: string) => {
    const city = cities.find((c) => c.name === cityName);
    if (city) {
      onStartChange({ lat: city.lat, lng: city.lng });
      setStartCityName(city.name);
    }
  };

  const handleEndCityChange = (cityName: string) => {
    const city = cities.find((c) => c.name === cityName);
    if (city) {
      onEndChange({ lat: city.lat, lng: city.lng });
      setEndCityName(city.name);
    }
  };

  const handleAnalyze = () => {
    if (!startPoint || !endPoint) return;
    onAnalyze({
      startLat: startPoint.lat,
      startLng: startPoint.lng,
      endLat: endPoint.lat,
      endLng: endPoint.lng,
      totalDistanceKm: routeDistanceKm ?? (parseFloat(manualDistanceKm) || 0),
      stepKm: parseFloat(stepKm),
      hour: hour[0],
      hasJunction,
      hasCrossing,
      hasTrafficSignal,
      hasRoundabout,
    });
  };

  const formatHour = (h: number) => `${h.toString().padStart(2, "0")}:00`;
  const displayDistance = routeDistanceKm != null ? routeDistanceKm.toFixed(1) : manualDistanceKm;

  return (
    <Card className="w-full border-0 rounded-none h-full overflow-y-auto bg-card flex flex-col shadow-none">
      <CardHeader className="pb-4">
        <CardTitle className="text-xl font-bold tracking-tight text-primary">Mission Control</CardTitle>
        <CardDescription className="text-muted-foreground">Configure route parameters</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-6 flex-1">
        {/* Route Selection */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Departure</Label>
            <Select value={startCityName} onValueChange={handleStartCityChange} disabled={isLoadingCities}>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Select origin city" />
              </SelectTrigger>
              <SelectContent>
                {cities.map((city) => (
                  <SelectItem key={`start-${city.name}`} value={city.name}>
                    {city.name}
                  </SelectItem>
                ))}
                {startCityName === "custom" && (
                  <SelectItem value="custom">Custom Location on Map</SelectItem>
                )}
              </SelectContent>
            </Select>
            {startPoint && (
              <div className="text-[10px] text-muted-foreground font-mono">
                {startPoint.lat.toFixed(4)}, {startPoint.lng.toFixed(4)}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Destination</Label>
            <Select value={endCityName} onValueChange={handleEndCityChange} disabled={isLoadingCities}>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Select destination city" />
              </SelectTrigger>
              <SelectContent>
                {cities.map((city) => (
                  <SelectItem key={`end-${city.name}`} value={city.name}>
                    {city.name}
                  </SelectItem>
                ))}
                {endCityName === "custom" && (
                  <SelectItem value="custom">Custom Location on Map</SelectItem>
                )}
              </SelectContent>
            </Select>
            {endPoint && (
              <div className="text-[10px] text-muted-foreground font-mono">
                {endPoint.lat.toFixed(4)}, {endPoint.lng.toFixed(4)}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="space-y-2">
              <Label className="text-xs font-medium flex items-center gap-1">
                Distance (km)
                {routeDistanceKm != null && (
                  <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 ml-1">Road</Badge>
                )}
              </Label>
              <Input
                type="number"
                value={displayDistance}
                onChange={(e) => setManualDistanceKm(e.target.value)}
                className="bg-background"
                readOnly={routeDistanceKm != null}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium">Step (km)</Label>
              <Select value={stepKm} onValueChange={setStepKm}>
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 km</SelectItem>
                  <SelectItem value="10">10 km</SelectItem>
                  <SelectItem value="20">20 km</SelectItem>
                  <SelectItem value="50">50 km</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <Separator className="bg-border" />

        {/* Live Weather Display */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Cloud className="w-3 h-3" /> Live Weather
            <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 ml-auto">Auto-detected</Badge>
          </Label>

          {!startPoint || !endPoint ? (
            <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-3">
              Select both cities to see live weather conditions
            </div>
          ) : isLoadingWeather ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground p-3 bg-muted/50 rounded-md">
              <Loader2 className="w-3 h-3 animate-spin" /> Fetching weather…
            </div>
          ) : weatherData ? (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{WEATHER_ICONS[weatherData.condition] ?? "🌤️"}</span>
                  <div>
                    <div className="font-semibold text-sm">{weatherData.condition}</div>
                    <div className="text-[10px] text-muted-foreground">{weatherData.description}</div>
                  </div>
                </div>
                <div className="text-2xl font-bold font-mono text-primary">
                  {weatherData.temperatureCelsius.toFixed(1)}°
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-[10px] text-muted-foreground pt-1">
                <div className="flex items-center gap-1">
                  <Droplets className="w-3 h-3 text-blue-400" />
                  {weatherData.humidity.toFixed(0)}%
                </div>
                <div className="flex items-center gap-1">
                  <Wind className="w-3 h-3 text-slate-400" />
                  {weatherData.windSpeedKmh.toFixed(0)} km/h
                </div>
                <div className="flex items-center gap-1">
                  <Thermometer className="w-3 h-3 text-orange-400" />
                  {weatherData.precipitationMm.toFixed(1)} mm
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <Separator className="bg-border" />

        {/* Departure Time */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium">Departure Time</Label>
            <span className="text-xs font-mono text-primary font-bold bg-primary/10 px-2 py-1 rounded">
              {formatHour(hour[0])}
            </span>
          </div>
          <Slider value={hour} min={0} max={23} step={1} onValueChange={setHour} className="py-2" />
        </div>

        <Separator className="bg-border" />

        {/* Infrastructure Hazards */}
        <div className="space-y-4">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Infrastructure Hazards
          </Label>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center space-x-2">
              <Switch id="junction" checked={hasJunction} onCheckedChange={setHasJunction} />
              <Label htmlFor="junction" className="text-xs">Junction</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch id="crossing" checked={hasCrossing} onCheckedChange={setHasCrossing} />
              <Label htmlFor="crossing" className="text-xs">Crossing</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch id="traffic-signal" checked={hasTrafficSignal} onCheckedChange={setHasTrafficSignal} />
              <Label htmlFor="traffic-signal" className="text-xs">Signals</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch id="roundabout" checked={hasRoundabout} onCheckedChange={setHasRoundabout} />
              <Label htmlFor="roundabout" className="text-xs">Roundabout</Label>
            </div>
          </div>
        </div>

        <div className="mt-auto pt-6 pb-2">
          <Button
            onClick={handleAnalyze}
            disabled={!startPoint || !endPoint || isAnalyzing}
            className="w-full font-bold text-sm tracking-wide h-12"
            size="lg"
          >
            {isAnalyzing ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Analyzing Route…
              </span>
            ) : (
              "Analyze Route"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
