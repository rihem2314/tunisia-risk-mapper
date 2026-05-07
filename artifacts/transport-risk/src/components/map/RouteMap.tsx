import { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { PredictRouteResult, RouteSegment } from "@workspace/api-client-react";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

const startIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const endIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface Point {
  lat: number;
  lng: number;
}

interface RouteReadyData {
  waypoints: Point[];
  distanceKm: number;
}

interface RouteMapProps {
  startPoint: Point | null;
  endPoint: Point | null;
  onMapClick: (point: Point) => void;
  predictionResult: PredictRouteResult | null;
  onRouteReady?: (data: RouteReadyData) => void;
}

function MapClickHandler({ onMapClick }: { onMapClick: (point: Point) => void }) {
  useMapEvents({
    click(e) {
      onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

function MapBoundsFitter({
  startPoint,
  endPoint,
  roadRoute,
}: {
  startPoint: Point | null;
  endPoint: Point | null;
  roadRoute: Point[] | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (roadRoute && roadRoute.length >= 2) {
      const bounds = L.latLngBounds(roadRoute.map((p) => [p.lat, p.lng] as [number, number]));
      map.fitBounds(bounds, { padding: [50, 50] });
    } else if (startPoint && endPoint) {
      const bounds = L.latLngBounds(
        [startPoint.lat, startPoint.lng],
        [endPoint.lat, endPoint.lng]
      );
      map.fitBounds(bounds, { padding: [50, 50] });
    } else if (startPoint) {
      map.setView([startPoint.lat, startPoint.lng], 10);
    } else if (endPoint) {
      map.setView([endPoint.lat, endPoint.lng], 10);
    }
  }, [startPoint, endPoint, roadRoute, map]);

  return null;
}

const getRiskColor = (level: number) => {
  switch (level) {
    case 0: return "#22c55e";
    case 1: return "#f59e0b";
    case 2: return "#ef4444";
    case 3: return "#7f1d1d";
    default: return "#3b82f6";
  }
};

const OSRM_URL = "https://router.project-osrm.org/route/v1/driving";

export function RouteMap({
  startPoint,
  endPoint,
  onMapClick,
  predictionResult,
  onRouteReady,
}: RouteMapProps) {
  const [roadRoute, setRoadRoute] = useState<Point[] | null>(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!startPoint || !endPoint) {
      setRoadRoute(null);
      return;
    }

    // Cancel any in-flight request
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoadingRoute(true);
    setRoadRoute(null);

    const url =
      `${OSRM_URL}` +
      `/${startPoint.lng},${startPoint.lat}` +
      `;${endPoint.lng},${endPoint.lat}` +
      `?overview=full&geometries=geojson`;

    fetch(url, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`OSRM ${res.status}`);
        return res.json() as Promise<{
          code: string;
          routes: Array<{
            distance: number;
            geometry: { coordinates: [number, number][] };
          }>;
        }>;
      })
      .then((data) => {
        if (data.code !== "Ok" || !data.routes?.length) {
          throw new Error("No route found");
        }
        const route = data.routes[0];
        const waypoints: Point[] = route.geometry.coordinates.map(
          ([lng, lat]) => ({ lat, lng })
        );
        const distanceKm = route.distance / 1000;
        setRoadRoute(waypoints);
        onRouteReady?.({ waypoints, distanceKm });
      })
      .catch((err: unknown) => {
        if ((err as Error).name === "AbortError") return;
        console.warn("OSRM routing failed, falling back to straight line:", err);
        setRoadRoute(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingRoute(false);
      });

    return () => {
      controller.abort();
    };
  }, [startPoint, endPoint]);

  return (
    <div className="h-full w-full relative z-0">
      {isLoadingRoute && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-card/95 border border-border text-xs text-muted-foreground px-3 py-1.5 rounded-full shadow-lg flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          Fetching road route…
        </div>
      )}
      <MapContainer
        center={[34, 9]}
        zoom={6}
        style={{ height: "100%", width: "100%", background: "#0f172a" }}
        className="rounded-lg overflow-hidden border border-border"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapClickHandler onMapClick={onMapClick} />
        <MapBoundsFitter startPoint={startPoint} endPoint={endPoint} roadRoute={roadRoute} />

        {startPoint && (
          <Marker position={[startPoint.lat, startPoint.lng]} icon={startIcon}>
            <Popup>Departure</Popup>
          </Marker>
        )}

        {endPoint && (
          <Marker position={[endPoint.lat, endPoint.lng]} icon={endIcon}>
            <Popup>Destination</Popup>
          </Marker>
        )}

        {/* Real road route (before prediction) */}
        {startPoint && endPoint && !predictionResult && roadRoute && roadRoute.length >= 2 && (
          <Polyline
            positions={roadRoute.map((p) => [p.lat, p.lng] as [number, number])}
            color="#0ea5e9"
            weight={4}
            opacity={0.85}
          />
        )}

        {/* Straight-line fallback while route is loading or OSRM failed */}
        {startPoint && endPoint && !predictionResult && !roadRoute && (
          <Polyline
            positions={[
              [startPoint.lat, startPoint.lng],
              [endPoint.lat, endPoint.lng],
            ]}
            color="#0ea5e9"
            weight={3}
            dashArray="8, 12"
            opacity={0.6}
          />
        )}

        {/* Colored risk segments after prediction */}
        {predictionResult?.segments &&
          predictionResult.segments.map((segment: RouteSegment) => (
            <Polyline
              key={`segment-${segment.segmentIndex}`}
              positions={[
                [segment.startLat, segment.startLng],
                [segment.endLat, segment.endLng],
              ]}
              color={getRiskColor(segment.riskLevel)}
              weight={6}
              opacity={0.85}
            >
              <Popup>
                <div className="font-semibold mb-1">Segment {segment.segmentIndex + 1}</div>
                <div className="text-sm">
                  Risk: {segment.riskLabel} ({Math.round(segment.riskScore)}/100)
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Distance: {segment.distanceKm.toFixed(1)} km
                </div>
              </Popup>
            </Polyline>
          ))}
      </MapContainer>
    </div>
  );
}
