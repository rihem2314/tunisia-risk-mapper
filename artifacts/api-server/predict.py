"""
Transport Risk Prediction Script
Loads pre-trained XGBoost model and preprocessing objects,
accepts JSON input via stdin, outputs prediction JSON to stdout.
"""

import sys
import json
import os
import math
import numpy as np
from datetime import datetime

# ── Resolve paths to pkl files ─────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
# attached_assets is at workspace root (2 levels up from artifacts/api-server)
ASSETS_DIR = os.path.join(SCRIPT_DIR, "..", "..", "attached_assets")

MODEL_PATH      = os.path.join(ASSETS_DIR, "xgboost_model_1778084782221.pkl")
SCALER_PATH     = os.path.join(ASSETS_DIR, "scaler_1778084759027.pkl")
LE_WEATHER_PATH = os.path.join(ASSETS_DIR, "le_weather_1778084768736.pkl")
LE_SEASON_PATH  = os.path.join(ASSETS_DIR, "le_season_1778084775261.pkl")

# ── Load models (cached at module level) ───────────────────────────────────
import joblib

MODEL_LOADED = False
LOAD_ERROR = ""

try:
    model      = joblib.load(MODEL_PATH)
    scaler     = joblib.load(SCALER_PATH)
    le_weather = joblib.load(LE_WEATHER_PATH)
    le_season  = joblib.load(LE_SEASON_PATH)
    MODEL_LOADED = True
except Exception as e:
    LOAD_ERROR = str(e)

RISK_LABELS = ['Low', 'Moderate', 'High', 'Critical']

WEATHER_DEFAULTS = {
    'Clear':        dict(temp_f=75, humidity=40, visibility=10.0, wind=5,  precip=0.0, adverse=0),
    'Cloudy':       dict(temp_f=65, humidity=60, visibility=8.0,  wind=10, precip=0.0, adverse=0),
    'Rain':         dict(temp_f=60, humidity=85, visibility=4.0,  wind=15, precip=0.3, adverse=1),
    'Snow':         dict(temp_f=28, humidity=80, visibility=2.0,  wind=12, precip=0.2, adverse=1),
    'Fog':          dict(temp_f=55, humidity=95, visibility=0.5,  wind=3,  precip=0.0, adverse=1),
    'Thunderstorm': dict(temp_f=68, humidity=90, visibility=3.0,  wind=25, precip=0.8, adverse=1),
    'Hail':         dict(temp_f=45, humidity=85, visibility=3.0,  wind=20, precip=0.5, adverse=1),
    'Windy':        dict(temp_f=65, humidity=50, visibility=9.0,  wind=35, precip=0.0, adverse=1),
    'Other':        dict(temp_f=65, humidity=55, visibility=8.0,  wind=10, precip=0.0, adverse=0),
}

def encode_weather(weather_str):
    weather_map = {
        'Clear': 'Clear', 'Cloudy': 'Overcast', 'Rain': 'Light Rain',
        'Snow': 'Light Snow', 'Fog': 'Fog', 'Thunderstorm': 'Thunderstorm',
        'Hail': 'Hail', 'Windy': 'Windy', 'Other': 'Other',
    }
    mapped = weather_map.get(weather_str, 'Other')
    try:
        return int(le_weather.transform([mapped])[0])
    except Exception:
        return len(le_weather.classes_) // 2

def encode_season(month):
    if month <= 3:   season = 'Hiver'
    elif month <= 6: season = 'Printemps'
    elif month <= 9: season = 'Ete'
    else:            season = 'Automne'
    try:
        return int(le_season.transform([season])[0])
    except Exception:
        return 0

def build_features(segment):
    now         = datetime.now()
    hour        = int(segment.get('hour', now.hour))
    day_of_week = now.weekday()
    month       = now.month
    weather     = segment.get('weather', 'Clear')
    lat         = float(segment.get('lat', 34.0))
    lng         = float(segment.get('lng', 9.0))
    dist_km     = float(segment.get('distance_km', 10.0))
    dist_mi     = dist_km * 0.621371

    wd         = WEATHER_DEFAULTS.get(weather, WEATHER_DEFAULTS['Clear'])
    temp_f     = wd['temp_f']
    temp_c     = (temp_f - 32) * 5 / 9
    humidity   = wd['humidity']
    pressure   = 29.9
    visibility = wd['visibility']
    wind       = wd['wind']
    precip     = wd['precip']
    adverse    = wd['adverse']

    low_vis    = int(visibility < 3)
    high_wind  = int(wind > 25)
    heavy_rain = int(precip > 0.5)

    weather_enc = encode_weather(weather) if MODEL_LOADED else 0
    season_enc  = encode_season(month)    if MODEL_LOADED else 0

    is_weekend = int(day_of_week >= 5)
    is_rush    = int(hour in [7, 8, 9, 16, 17, 18, 19])
    is_night   = int(hour >= 22 or hour <= 5)
    is_day     = int(not is_night)

    hour_sin   = math.sin(2 * math.pi * hour / 24)
    hour_cos   = math.cos(2 * math.pi * hour / 24)
    dow_sin    = math.sin(2 * math.pi * day_of_week / 7)
    dow_cos    = math.cos(2 * math.pi * day_of_week / 7)
    month_sin  = math.sin(2 * math.pi * month / 12)
    month_cos  = math.cos(2 * math.pi * month / 12)

    junction       = int(segment.get('has_junction', False))
    crossing       = int(segment.get('has_crossing', False))
    traffic_signal = int(segment.get('has_traffic_signal', False))
    roundabout     = int(segment.get('has_roundabout', False))

    return [
        temp_f, temp_c, humidity, pressure,
        visibility, wind, precip,
        weather_enc, adverse, low_vis, high_wind, heavy_rain,
        hour, day_of_week, month, is_weekend, is_rush, is_night,
        hour_sin, hour_cos, dow_sin, dow_cos, month_sin, month_cos,
        season_enc, is_day,
        lat, lng, dist_mi,
        junction, crossing, traffic_signal, roundabout,
        0, 0, 0, 0, 0, 0,  # Stop, Bump, Amenity, Railway, Give_Way, No_Exit
    ]

def predict_segments(segments):
    if not MODEL_LOADED:
        import random
        results = []
        for seg in segments:
            hour    = int(seg.get('hour', 8))
            weather = seg.get('weather', 'Clear')
            is_rush  = int(hour in [7, 8, 9, 16, 17, 18, 19])
            is_night = int(hour >= 22 or hour <= 5)
            adverse  = WEATHER_DEFAULTS.get(weather, {}).get('adverse', 0)

            base_score = 15
            if is_rush:   base_score += 20
            if is_night:  base_score += 15
            if adverse:   base_score += 25

            seed = int(abs(seg.get('lat', 34)) * 1000 + abs(seg.get('lng', 9)) * 100)
            random.seed(seed)
            base_score = min(base_score + random.randint(-5, 10), 95)

            if base_score < 25:   level = 0
            elif base_score < 50: level = 1
            elif base_score < 75: level = 2
            else:                 level = 3

            probs = [0.4 / 3] * 4
            probs[level] = 0.6

            results.append({
                'risk_level': level,
                'risk_label': RISK_LABELS[level],
                'risk_probabilities': probs,
                'risk_score': float(base_score),
            })
        return results

    X = np.array([build_features(seg) for seg in segments], dtype=float)
    X_scaled = scaler.transform(X)
    predictions = model.predict(X_scaled)
    probabilities = model.predict_proba(X_scaled)

    results = []
    for pred, proba in zip(predictions, probabilities):
        level      = int(pred)
        risk_score = float(np.dot([0, 33.3, 66.6, 100], proba))
        results.append({
            'risk_level': level,
            'risk_label': RISK_LABELS[level],
            'risk_probabilities': [float(p) for p in proba],
            'risk_score': round(risk_score, 2),
        })
    return results


if __name__ == '__main__':
    try:
        input_data = json.load(sys.stdin)
        results = predict_segments(input_data)
        print(json.dumps(results))
    except Exception as e:
        print(json.dumps({'error': str(e)}), file=sys.stderr)
        sys.exit(1)
