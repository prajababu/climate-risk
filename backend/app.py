import json
import math
import os
import pickle
import threading
import time
import zipfile
import zlib
from datetime import datetime
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import joblib
import numpy as np
from flask import Flask, jsonify, request, send_from_directory
from werkzeug.exceptions import HTTPException


ROOT = Path(__file__).resolve().parent
FRONTEND_DIR = ROOT.parent / "frontend"
MODEL_PATH = ROOT / "models" / "climate_risk_models.joblib"
METADATA_PATH = ROOT / "models" / "model_metadata.json"
FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search"
GEOCODING_MIN_INTERVAL_SECONDS = 1.1
GEOCODING_CACHE_SECONDS = 24 * 60 * 60
FEATURES = [
    "temperature_2m_max_c",
    "relative_humidity_2m_mean_pct",
    "precipitation_sum_mm",
    "wind_speed_10m_max_kmh",
    "elevation_m",
]
FEATURE_UNITS = {
    "temperature_2m_max_c": "°C",
    "relative_humidity_2m_mean_pct": "%",
    "precipitation_sum_mm": "mm",
    "wind_speed_10m_max_kmh": "km/h",
    "elevation_m": "m",
}
FEATURE_LABELS = {
    "temperature_2m_max_c": "Temperature",
    "relative_humidity_2m_mean_pct": "Relative humidity",
    "precipitation_sum_mm": "Rainfall",
    "wind_speed_10m_max_kmh": "Wind speed",
    "elevation_m": "Elevation",
}
HAZARDS = {
    "flood": {
        "name": "Flood Risk",
        "target": "heavy-rainfall trigger",
        "color": "#268cff",
    },
    "heatwave": {
        "name": "Heatwave Risk",
        "target": "extreme-heat trigger",
        "color": "#ff7043",
    },
    "cyclone": {
        "name": "Cyclone Risk",
        "target": "cyclone-wind trigger",
        "color": "#b47cff",
    },
}

app = Flask(__name__)
models = None
model_metadata = None
model_load_error = None
geocoding_lock = threading.Lock()
geocoding_cache = {}
last_geocoding_request_at = 0.0


def load_model():
    global models, model_metadata, model_load_error
    if models is not None:
        return True
    if not MODEL_PATH.is_file():
        model_load_error = (
            "Saved climate model file is missing: {}. Restore the model "
            "from a known-good backup; models are not retrained automatically."
        ).format(MODEL_PATH)
        return False
    if not METADATA_PATH.is_file():
        model_load_error = (
            "Saved climate model metadata file is missing: {}. Restore the "
            "metadata from a known-good backup; models are not retrained "
            "automatically."
        ).format(METADATA_PATH)
        return False

    try:
        loaded_models = joblib.load(MODEL_PATH)
        loaded_metadata = json.loads(
            METADATA_PATH.read_text(encoding="utf-8")
        )
        if not isinstance(loaded_models, dict):
            raise TypeError("The saved model bundle is not a dictionary.")
        if not isinstance(loaded_metadata, dict):
            raise TypeError("The saved model metadata is not a JSON object.")
        if not isinstance(loaded_metadata.get("evaluation"), dict):
            raise TypeError("Saved model metadata is missing evaluation results.")
        if not isinstance(loaded_metadata.get("targets"), dict):
            raise TypeError("Saved model metadata is missing target definitions.")
        if any(
            not isinstance(loaded_metadata["evaluation"].get(hazard), dict) or
            not isinstance(
                loaded_metadata["evaluation"][hazard].get("validated"),
                bool,
            ) or
            not isinstance(loaded_metadata["targets"].get(hazard), str)
            for hazard in HAZARDS
        ):
            raise TypeError(
                "Saved model metadata is missing a hazard evaluation or target."
            )
        if loaded_metadata.get("feature_columns") != FEATURES:
            raise RuntimeError(
                "Saved model metadata feature order does not match the API."
            )
        if set(loaded_models) != set(HAZARDS) or any(
            getattr(model, "n_features_in_", None) != len(FEATURES)
            for model in loaded_models.values()
        ):
            raise RuntimeError(
                "A saved model does not accept the expected feature count."
            )
    except (
        AttributeError,
        EOFError,
        ImportError,
        IndexError,
        KeyError,
        OSError,
        pickle.UnpicklingError,
        RuntimeError,
        TypeError,
        UnicodeError,
        ValueError,
        zipfile.BadZipFile,
        zlib.error,
    ) as error:
        model_load_error = (
            "Saved climate model files could not be loaded: {}. Restore "
            "known-good model and metadata files from a backup; models are "
            "not retrained automatically."
        ).format(error)
        app.logger.exception("Saved climate model could not be loaded")
        return False

    models = loaded_models
    model_metadata = loaded_metadata
    model_load_error = None
    return True


def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Max-Age"] = "600"
    return response


@app.after_request
def cors_after_request(response):
    return add_cors_headers(response)


@app.errorhandler(HTTPException)
def handle_http_exception(error):
    if not request.path.startswith("/api/"):
        return error
    return jsonify({
        "error": error.description,
        "status": error.code,
    }), error.code or 500


@app.errorhandler(Exception)
def handle_unexpected_exception(error):
    if request.path.startswith("/api/"):
        app.logger.exception("Unhandled API error")
        return jsonify({
            "error": "Internal server error while processing the API request."
        }), 500
    app.logger.exception("Unhandled application error")
    return "Internal server error", 500


@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_frontend(path):
    requested = path or "index.html"
    return send_from_directory(str(FRONTEND_DIR), requested)


@app.route("/api/health", methods=["GET"])
def health():
    ready = load_model()
    return jsonify({
        "status": "ready" if ready else "model_not_trained",
        "model_available": ready,
        "error": None if ready else model_load_error,
        "training_metadata": model_metadata if ready else None,
    }), (200 if ready else 503)


@app.route("/api/geocode", methods=["GET"])
def geocode():
    city = request.args.get("city", "").strip()
    district = request.args.get("county", "").strip()
    state = request.args.get("state", "").strip()
    if not all((city, district, state)):
        return jsonify({
            "error": "City, district and state are required for geocoding."
        }), 400

    cache_key = (city.casefold(), district.casefold(), state.casefold())
    cached = geocoding_cache.get(cache_key)
    if cached and cached["expires_at"] > time.monotonic():
        return jsonify(cached["results"])

    query = urlencode({
        "city": city,
        "county": district,
        "state": state,
        "country": "India",
        "format": "jsonv2",
        "addressdetails": "1",
        "limit": "5",
    })
    global last_geocoding_request_at
    try:
        with geocoding_lock:
            cached = geocoding_cache.get(cache_key)
            if cached and cached["expires_at"] > time.monotonic():
                return jsonify(cached["results"])
            delay = GEOCODING_MIN_INTERVAL_SECONDS - (
                time.monotonic() - last_geocoding_request_at
            )
            if delay > 0:
                time.sleep(delay)
            last_geocoding_request_at = time.monotonic()
            geocoding_request = Request(
                NOMINATIM_SEARCH_URL + "?" + query,
                headers={
                    "Accept": "application/json",
                    "User-Agent": "ClimateRiskAI/1.0 (local geocoding proxy)",
                },
            )
            with urlopen(geocoding_request, timeout=20) as response:
                if response.status != 200:
                    raise RuntimeError(
                        "OpenStreetMap Nominatim returned HTTP {}".format(
                            response.status
                        )
                    )
                results = json.loads(response.read().decode("utf-8"))
            if isinstance(results, list) and results:
                geocoding_cache[cache_key] = {
                    "results": results,
                    "expires_at": time.monotonic() + GEOCODING_CACHE_SECONDS,
                }
    except (HTTPError, URLError, TimeoutError, ValueError, RuntimeError) as error:
        app.logger.exception("OpenStreetMap city lookup failed")
        return jsonify({
            "error": "OpenStreetMap could not resolve the requested city.",
            "detail": str(error),
        }), 502

    if not isinstance(results, list):
        return jsonify({
            "error": "OpenStreetMap returned an invalid geocoding response."
        }), 502
    return jsonify(results)


@app.route("/api/climate-risk", methods=["POST", "OPTIONS"])
def climate_risk():
    if request.method == "OPTIONS":
        return add_cors_headers(app.response_class(status=204))
    if not load_model():
        return jsonify({"error": model_load_error}), 503

    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"error": "A JSON request body is required."}), 400

    try:
        latitude = float(payload.get("latitude"))
        longitude = float(payload.get("longitude"))
    except (TypeError, ValueError):
        return jsonify({"error": "Valid latitude and longitude are required."}), 400

    if (
        not math.isfinite(latitude) or
        not math.isfinite(longitude) or
        latitude < 6.0 or latitude > 38.0 or
        longitude < 68.0 or longitude > 98.0
    ):
        return jsonify({"error": "Coordinates are outside the supported India map extent."}), 400

    location = {
        "state": str(payload.get("state", "")).strip(),
        "district": str(payload.get("district", "")).strip(),
        "city": str(payload.get("city", "")).strip(),
    }
    if not all(location.values()):
        return jsonify({"error": "State, district and city are required."}), 400

    try:
        weather = fetch_forecast(latitude, longitude)
        result = predict_risks(weather)
    except (HTTPError, URLError, TimeoutError, ValueError, RuntimeError) as error:
        app.logger.exception("Climate forecast or prediction failed")
        return jsonify({
            "error": "A reliable climate forecast could not be retrieved.",
            "detail": str(error),
        }), 502

    overall_score = max(
        result["risks"][key]["risk_percent"]
        for key in HAZARDS
        if result["risks"][key]["risk_percent"] is not None
    )
    result["overall"] = {
        "risk_percent": overall_score,
        "classification": classify_risk(overall_score),
        "basis": (
            "Highest validated hazard proxy score; not a combined event probability. "
            "Unvalidated hazards are excluded."
        ),
    }
    result["location"] = location
    result["coordinates"] = {
        "latitude": latitude,
        "longitude": longitude,
    }
    result["baseline_weather"] = {
        "date": weather[0]["date"],
        **{
            feature: weather[0][feature]
            for feature in FEATURES
        },
    }
    result["model"] = {
        "algorithm": model_metadata["algorithm"],
        "data_source": "Open-Meteo Forecast API",
        "forecast_period": "7-day daily forecast",
        "risk_score_interpretation": model_metadata[
            "risk_score_interpretation"
        ],
        "test_metrics": model_metadata["evaluation"],
        "limitations": [
            "Training uses six representative Indian city locations and ERA5 reanalysis, not a population-wide or nationwide event inventory.",
            "Flood output is a heavy-rainfall trigger proxy, not a flood extent or inundation prediction.",
            "Cyclone output is a local wind trigger proxy, not cyclone track, landfall, or official warning prediction.",
            "Holdout metrics measure reproduction of feature-derived proxy thresholds, not independent prediction of recorded disasters.",
            "Population density and verified hazard-impact labels are unavailable and are not fabricated.",
            "Use official IMD, NDMA and local authority alerts for decisions.",
        ],
    }
    result["recommendations"] = build_recommendations(result["risks"])
    return jsonify(result)


@app.route("/api/digital-twin/simulate", methods=["POST", "OPTIONS"])
def simulate_digital_twin():
    if request.method == "OPTIONS":
        return add_cors_headers(app.response_class(status=204))
    if not load_model():
        return jsonify({"error": model_load_error}), 503

    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"error": "A JSON request body is required."}), 400

    location = payload.get("location")
    coordinates = payload.get("coordinates")
    baseline = payload.get("baseline")
    scenario = payload.get("scenario")
    if not isinstance(location, dict) or not isinstance(coordinates, dict):
        return jsonify({
            "error": "Selected location and coordinates are required."
        }), 400
    if not isinstance(baseline, dict) or not isinstance(scenario, dict):
        return jsonify({
            "error": "Baseline weather and scenario values are required."
        }), 400

    normalized_location = {
        name: location.get(name)
        for name in ("state", "district", "city")
    }
    if any(
        not isinstance(value, str) or not value.strip() or len(value) > 120
        for value in normalized_location.values()
    ):
        return jsonify({
            "error": "State, district and city are required."
        }), 400
    normalized_location = {
        name: value.strip()
        for name, value in normalized_location.items()
    }

    try:
        if (
            isinstance(coordinates.get("latitude"), bool) or
            isinstance(coordinates.get("longitude"), bool)
        ):
            raise ValueError("Boolean coordinates are not valid.")
        latitude = float(coordinates.get("latitude"))
        longitude = float(coordinates.get("longitude"))
    except (TypeError, ValueError):
        return jsonify({
            "error": "Valid selected-location coordinates are required."
        }), 400
    if (
        not math.isfinite(latitude) or
        not math.isfinite(longitude) or
        latitude < 6.0 or latitude > 38.0 or
        longitude < 68.0 or longitude > 98.0
    ):
        return jsonify({
            "error": "Coordinates are outside the supported India map extent."
        }), 400

    baseline_limits = {
        "temperature_2m_max_c": (-50, 60),
        "relative_humidity_2m_mean_pct": (0, 100),
        "precipitation_sum_mm": (0, 1000),
        "wind_speed_10m_max_kmh": (0, 300),
        "elevation_m": (-500, 9000),
    }
    if set(baseline) - set(baseline_limits) - {"date"}:
        return jsonify({"error": "Baseline contains unsupported weather fields."}), 400
    baseline_values, error = validate_weather_values(
        baseline,
        baseline_limits,
        "Baseline",
    )
    if error:
        return jsonify({"error": error}), 400

    scenario_limits = {
        "temperature_2m_max_c": (0, 50),
        "relative_humidity_2m_mean_pct": (0, 100),
        "precipitation_sum_mm": (0, 300),
        "wind_speed_10m_max_kmh": (0, 150),
    }
    if set(scenario) != set(scenario_limits):
        return jsonify({
            "error": "Scenario must contain exactly rainfall, temperature, wind speed and relative humidity."
        }), 400
    scenario_values, error = validate_weather_values(
        scenario,
        scenario_limits,
        "Scenario",
    )
    if error:
        return jsonify({"error": error}), 400
    scenario_values["elevation_m"] = baseline_values["elevation_m"]

    training_feature_ranges = model_metadata.get("training_feature_ranges")
    if not isinstance(training_feature_ranges, dict) or any(
        feature not in training_feature_ranges
        for feature in FEATURES
    ):
        return jsonify({
            "error": (
                "Model metadata does not contain verified training feature "
                "ranges; simulation is unavailable."
            )
        }), 503

    training_range_warnings = []
    for feature in FEATURES:
        feature_range = training_feature_ranges[feature]
        try:
            training_min = float(feature_range["min"])
            training_max = float(feature_range["max"])
        except (KeyError, TypeError, ValueError):
            return jsonify({
                "error": (
                    "Model metadata contains invalid training feature ranges; "
                    "simulation is unavailable."
                )
            }), 503
        if (
            not math.isfinite(training_min) or
            not math.isfinite(training_max) or
            training_min > training_max
        ):
            return jsonify({
                "error": (
                    "Model metadata contains invalid training feature ranges; "
                    "simulation is unavailable."
                )
            }), 503
        value = scenario_values[feature]
        if value < training_min or value > training_max:
            training_range_warnings.append({
                "feature": feature,
                "label": FEATURE_LABELS[feature],
                "value": value,
                "training_min": training_min,
                "training_max": training_max,
                "unit": FEATURE_UNITS[feature],
                "message": (
                    "{} {} is outside the training range {}–{} {}. "
                    "The model score may be unreliable for this input."
                ).format(
                    FEATURE_LABELS[feature], value, training_min, training_max,
                    FEATURE_UNITS[feature]
                ),
            })

    baseline_result = score_weather_input(baseline_values)
    scenario_result = score_weather_input(scenario_values)
    comparison = {}
    for hazard in HAZARDS:
        base_risk = baseline_result[hazard]
        scenario_risk = scenario_result[hazard]
        if base_risk["risk_percent"] is None:
            score_change = None
            change = "Not validated"
        else:
            score_change = round(
                scenario_risk["risk_percent"] - base_risk["risk_percent"],
                2,
            )
            change = (
                "Increased" if score_change > 0 else
                "Decreased" if score_change < 0 else
                "Unchanged"
            )
        comparison[hazard] = {
            "baseline": base_risk,
            "scenario": scenario_risk,
            "score_change": score_change,
            "change": change,
        }

    return jsonify({
        "location": normalized_location,
        "coordinates": {
            "latitude": latitude,
            "longitude": longitude,
        },
        "baseline": baseline_values,
        "scenario": scenario_values,
        "comparison": comparison,
        "training_feature_ranges": training_feature_ranges,
        "training_range_warnings": training_range_warnings,
        "model": model_metadata["algorithm"],
        "score_type": (
            "Uncalibrated existing-model score for a weather-trigger proxy; "
            "not a real-world disaster probability."
        ),
        "interpretation": (
            "Weather-trigger scenario simulation using the existing Random "
            "Forest; not a physically validated flood model or a forecast of "
            "an actual future disaster."
        ),
    })


def validate_weather_values(values, limits, label):
    normalized = {}
    for feature, (minimum, maximum) in limits.items():
        raw_value = values.get(feature)
        if isinstance(raw_value, bool) or not isinstance(raw_value, (int, float)):
            return None, "{} {} must be a number.".format(label, feature)
        value = float(raw_value)
        if not math.isfinite(value) or value < minimum or value > maximum:
            return None, "{} {} must be between {} and {}.".format(
                label, feature, minimum, maximum
            )
        normalized[feature] = value
    return normalized, None


def score_weather_input(weather):
    risks = {}
    for name, config in HAZARDS.items():
        validation = model_metadata["evaluation"][name]
        if not validation.get("validated"):
            risks[name] = {
                "name": config["name"],
                "risk_percent": None,
                "classification": "Not validated",
            }
            continue
        score = round(
            positive_class_probability(models[name], weather) * 100,
            2,
        )
        risks[name] = {
            "name": config["name"],
            "risk_percent": score,
            "classification": classify_risk(score),
        }
    return risks


def fetch_forecast(latitude, longitude):
    query = urlencode({
        "latitude": latitude,
        "longitude": longitude,
        "daily": (
            "temperature_2m_max,relative_humidity_2m_mean,"
            "precipitation_sum,wind_speed_10m_max"
        ),
        "forecast_days": 7,
        "timezone": "Asia/Kolkata",
    })
    req = Request(
        FORECAST_URL + "?" + query,
        headers={"User-Agent": "ClimateRiskAI/1.0 local risk prototype"},
    )
    with urlopen(req, timeout=30) as response:
        if response.status != 200:
            raise RuntimeError(
                "Open-Meteo forecast service returned HTTP {}".format(
                    response.status
                )
            )
        payload = json.loads(response.read().decode("utf-8"))

    daily = payload.get("daily") or {}
    dates = daily.get("time") or []
    columns = {
        "temperature_2m_max_c": daily.get("temperature_2m_max") or [],
        "relative_humidity_2m_mean_pct": daily.get(
            "relative_humidity_2m_mean"
        ) or [],
        "precipitation_sum_mm": daily.get("precipitation_sum") or [],
        "wind_speed_10m_max_kmh": daily.get("wind_speed_10m_max") or [],
    }
    if not dates or any(len(values) != len(dates) for values in columns.values()):
        raise RuntimeError("Open-Meteo returned incomplete daily forecast data")
    if len(dates) != 7:
        raise RuntimeError(
            "Open-Meteo returned {} forecast days; exactly 7 are required".format(
                len(dates)
            )
        )
    elevation = payload.get("elevation")
    if elevation is None:
        raise RuntimeError("Open-Meteo did not return elevation for this location")

    forecast_rows = []
    for index, forecast_date in enumerate(dates):
        row = {"date": forecast_date, "elevation_m": float(elevation)}
        for feature, values in columns.items():
            value = values[index]
            if value is None or not math.isfinite(float(value)):
                raise RuntimeError("Forecast contains a missing climate feature")
            row[feature] = float(value)
        forecast_rows.append(row)
    return forecast_rows


def positive_class_probability(model, row):
    features = np.asarray([[row[name] for name in FEATURES]], dtype=float)
    probabilities = model.predict_proba(features)[0]
    for index, label in enumerate(model.classes_):
        if int(label) == 1:
            return float(probabilities[index])
    return 0.0


def classify_risk(score):
    if score < 25:
        return "Low"
    if score < 50:
        return "Moderate"
    if score < 75:
        return "High"
    return "Very High"


def predict_risks(forecast):
    daily_predictions = []
    for row in forecast:
        probabilities = {
            name: positive_class_probability(models[name], row)
            for name in HAZARDS
        }
        daily_predictions.append({
            "date": row["date"],
            "probabilities": probabilities,
            "weather": row,
        })

    risks = {}
    for name, config in HAZARDS.items():
        validation = model_metadata["evaluation"][name]
        if not validation.get("validated"):
            risks[name] = {
                "name": config["name"],
                "risk_percent": None,
                "classification": "Not validated",
                "peak_forecast_date": None,
                "trigger_definition": model_metadata["targets"][name],
                "score_scope": (
                    "No numeric score: fewer than the required positive "
                    "holdout examples."
                ),
                "color": "#8294a9",
            }
            continue

        peak = max(
            daily_predictions,
            key=lambda day: day["probabilities"][name]
        )
        score = round(peak["probabilities"][name] * 100)
        risks[name] = {
            "name": config["name"],
            "risk_percent": score,
            "classification": classify_risk(score),
            "peak_forecast_date": peak["date"],
            "trigger_definition": model_metadata["targets"][name],
            "score_scope": "Uncalibrated classifier score for the defined daily weather-trigger proxy on the highest-scoring forecast day.",
            "color": config["color"],
        }

    temperatures = [row["temperature_2m_max_c"] for row in forecast]
    precipitation = [row["precipitation_sum_mm"] for row in forecast]
    winds = [row["wind_speed_10m_max_kmh"] for row in forecast]
    humidity = [row["relative_humidity_2m_mean_pct"] for row in forecast]
    hottest_index = int(np.argmax(temperatures))
    wettest_index = int(np.argmax(precipitation))
    windiest_index = int(np.argmax(winds))
    return {
        "forecast_dates": [row["date"] for row in forecast],
        "risks": risks,
        "factors": [
            {
                "name": "Maximum daily temperature",
                "value": temperatures[hottest_index],
                "unit": "°C",
                "date": forecast[hottest_index]["date"],
                "source": "Open-Meteo forecast",
            },
            {
                "name": "Maximum daily precipitation",
                "value": precipitation[wettest_index],
                "unit": "mm",
                "date": forecast[wettest_index]["date"],
                "source": "Open-Meteo forecast",
            },
            {
                "name": "Maximum 10 m wind speed",
                "value": winds[windiest_index],
                "unit": "km/h",
                "date": forecast[windiest_index]["date"],
                "source": "Open-Meteo forecast",
            },
            {
                "name": "Mean relative humidity",
                "value": round(sum(humidity) / len(humidity), 1),
                "unit": "%",
                "date": "7-day forecast average",
                "source": "Open-Meteo forecast",
            },
            {
                "name": "Elevation",
                "value": forecast[0]["elevation_m"],
                "unit": "m",
                "date": "Open-Meteo grid elevation",
                "source": "Open-Meteo forecast API",
            },
        ],
        "data_attribution": (
            "Weather forecast data © Open-Meteo, CC BY 4.0; "
            "https://open-meteo.com/"
        ),
        "generated_at": datetime.utcnow().replace(
            microsecond=0
        ).isoformat() + "Z",
    }


def build_recommendations(risks):
    recommendations = [
        "Treat these experimental weather-trigger estimates as supplementary; follow official IMD and local authority alerts."
    ]
    if (
        risks["flood"]["risk_percent"] is not None and
        risks["flood"]["risk_percent"] >= 25
    ):
        recommendations.append(
            "Check local flood advisories, keep drains clear where safe, and never walk or drive through floodwater."
        )
    if (
        risks["heatwave"]["risk_percent"] is not None and
        risks["heatwave"]["risk_percent"] >= 25
    ):
        recommendations.append(
            "Follow local heat-health advice, plan strenuous outdoor activity for cooler hours, and maintain access to drinking water and shade."
        )
    if (
        risks["cyclone"]["risk_percent"] is not None and
        risks["cyclone"]["risk_percent"] >= 25
    ):
        recommendations.append(
            "Monitor official IMD cyclone bulletins; do not infer cyclone landfall from this local wind proxy."
        )
    return recommendations


if __name__ == "__main__":
    app.run(
        host=os.environ.get("CLIMATERISK_HOST", "127.0.0.1"),
        port=int(os.environ.get("CLIMATERISK_PORT", "5000")),
        debug=False,
    )
