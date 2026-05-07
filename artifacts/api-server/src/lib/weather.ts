export interface WeatherInfo {
  condition: string;
  temperatureCelsius: number;
  humidity: number;
  windSpeedKmh: number;
  precipitationMm: number;
  description: string;
}

export function wmoToWeatherCondition(code: number, windSpeedKmh: number): string {
  if (windSpeedKmh > 56) return "Windy";
  if (code === 0) return "Clear";
  if (code <= 3) return "Cloudy";
  if (code <= 48) return "Fog";
  if (code <= 67 || (code >= 80 && code <= 82)) return "Rain";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "Snow";
  if (code >= 95) return "Thunderstorm";
  return "Other";
}

export function wmoToDescription(code: number): string {
  if (code === 0) return "Clear sky";
  if (code === 1) return "Mainly clear";
  if (code === 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code <= 48) return "Foggy";
  if (code <= 57) return "Drizzle";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Rain showers";
  if (code <= 86) return "Snow showers";
  if (code === 95) return "Thunderstorm";
  if (code >= 96) return "Thunderstorm with hail";
  return "Mixed conditions";
}

interface OpenMeteoResponse {
  current: {
    temperature_2m: number;
    relative_humidity_2m: number;
    precipitation: number;
    weather_code: number;
    wind_speed_10m: number;
  };
}

export async function fetchWeather(lat: number, lng: number): Promise<WeatherInfo> {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lng}` +
    `&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m` +
    `&wind_speed_unit=kmh`;

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Open-Meteo returned ${response.status}`);

  const data = (await response.json()) as OpenMeteoResponse;
  const c = data.current;

  return {
    condition: wmoToWeatherCondition(c.weather_code, c.wind_speed_10m),
    temperatureCelsius: c.temperature_2m,
    humidity: c.relative_humidity_2m,
    windSpeedKmh: c.wind_speed_10m,
    precipitationMm: c.precipitation,
    description: wmoToDescription(c.weather_code),
  };
}
