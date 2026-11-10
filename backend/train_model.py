import argparse
import csv
import json
import sys
import time
from datetime import date, datetime
from pathlib import Path
from urllib.error import URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import joblib
import numpy as np
import sklearn
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score


ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
MODEL_DIR = ROOT / "models"
CSV_PATH = DATA_DIR / "observed_daily_climate.csv"
MODEL_PATH = MODEL_DIR / "climate_risk_models.joblib"
METADATA_PATH = MODEL_DIR / "model_metadata.json"

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
TARGETS = {
    "flood": "heavy_rain_trigger",
    "heatwave": "extreme_heat_trigger",
    "cyclone": "cyclone_wind_trigger",
}
MINIMUM_VALIDATION_POSITIVES = 10

# Representative, explicitly georeferenced urban places span India's regions.
# Their coordinates are training sample locations, not prediction lookups.
TRAINING_LOCATIONS = [
    {
        "name": "Samastipur",
        "district": "Samastipur",
        "state": "Bihar",
        "latitude": 25.8596845,
        "longitude": 85.7839038,
        "osm": "https://www.openstreetmap.org/node/245739285",
    },
    {
        "name": "Pudukkottai",
        "district": "Pudukkottai",
        "state": "Tamil Nadu",
        "latitude": 10.3826515,
        "longitude": 78.8191259,
        "osm": "https://www.openstreetmap.org/way/84749701",
    },
    {
        "name": "Srinagar",
        "district": "Srinagar",
        "state": "Jammu and Kashmir",
        "latitude": 34.0747444,
        "longitude": 74.8204443,
        "osm": "https://www.openstreetmap.org/node/273658993",
    },
    {
        "name": "Surat",
        "district": "Surat",
        "state": "Gujarat",
        "latitude": 21.2094892,
        "longitude": 72.8317058,
        "osm": "https://www.openstreetmap.org/node/10029899747",
    },
    {
        "name": "Kolkata",
        "district": "Kolkata",
        "state": "West Bengal",
        "latitude": 22.5726459,
        "longitude": 88.3638953,
        "osm": "https://www.openstreetmap.org/relation/9381363",
    },
    {
        "name": "Guwahati",
        "district": "Kamrup Metropolitan",
        "state": "Assam",
        "latitude": 26.1805978,
        "longitude": 91.7539430,
        "osm": "https://www.openstreetmap.org/node/566672802",
    },
]

CSV_FIELDS = [
    "date",
    "city",
    "district",
    "state",
    "latitude",
    "longitude",
    "temperature_2m_max_c",
    "relative_humidity_2m_mean_pct",
    "precipitation_sum_mm",
    "wind_speed_10m_max_kmh",
    "elevation_m",
    "heavy_rain_trigger",
    "extreme_heat_trigger",
    "cyclone_wind_trigger",
    "source",
]


def fetch_json(url):
    request = Request(
        url,
        headers={"User-Agent": "ClimateRiskAI/1.0 (local research prototype)"},
    )
    with urlopen(request, timeout=60) as response:
        if response.status != 200:
            raise RuntimeError("Weather data service returned HTTP {}".format(
                response.status
            ))
        return json.loads(response.read().decode("utf-8"))


def fetch_location_history(location, start_date, end_date):
    query = urlencode({
        "latitude": location["latitude"],
        "longitude": location["longitude"],
        "start_date": start_date,
        "end_date": end_date,
        "daily": (
            "temperature_2m_max,relative_humidity_2m_mean,"
            "precipitation_sum,wind_speed_10m_max"
        ),
        "timezone": "Asia/Kolkata",
    })
    payload = fetch_json(
        "https://archive-api.open-meteo.com/v1/archive?" + query
    )
    daily = payload.get("daily") or {}
    dates = daily.get("time") or []
    variables = [
        daily.get("temperature_2m_max") or [],
        daily.get("relative_humidity_2m_mean") or [],
        daily.get("precipitation_sum") or [],
        daily.get("wind_speed_10m_max") or [],
    ]
    if not dates or any(len(values) != len(dates) for values in variables):
        raise RuntimeError(
            "Historical climate data was incomplete for {}".format(
                location["name"]
            )
        )

    elevation = payload.get("elevation")
    if elevation is None:
        raise RuntimeError(
            "Elevation was unavailable for {}".format(location["name"])
        )

    rows = []
    for index, observed_date in enumerate(dates):
        values = [column[index] for column in variables]
        if any(value is None for value in values):
            continue
        temperature, humidity, rainfall, wind = [
            float(value) for value in values
        ]
        rows.append({
            "date": observed_date,
            "city": location["name"],
            "district": location["district"],
            "state": location["state"],
            "latitude": location["latitude"],
            "longitude": location["longitude"],
            "temperature_2m_max_c": temperature,
            "relative_humidity_2m_mean_pct": humidity,
            "precipitation_sum_mm": rainfall,
            "wind_speed_10m_max_kmh": wind,
            "elevation_m": float(elevation),
            "heavy_rain_trigger": int(rainfall >= 64.5),
            "extreme_heat_trigger": int(
                temperature >= (30.0 if float(elevation) >= 1000 else 40.0)
            ),
            "cyclone_wind_trigger": int(wind >= 63.0),
            "source": "Open-Meteo Historical Weather API (ERA5 reanalysis)",
        })
    return rows


def load_or_download_rows(start_date, end_date, refresh):
    if CSV_PATH.exists() and not refresh:
        with CSV_PATH.open("r", encoding="utf-8", newline="") as stream:
            rows = list(csv.DictReader(stream))
        if rows and rows[0].get("date") == start_date and rows[-1].get("date") <= end_date:
            return rows, "cached"

    rows = []
    for index, location in enumerate(TRAINING_LOCATIONS):
        print(
            "Fetching historical reanalysis for {}, {}...".format(
                location["name"], location["state"]
            ),
            flush=True,
        )
        rows.extend(fetch_location_history(location, start_date, end_date))
        if index + 1 < len(TRAINING_LOCATIONS):
            time.sleep(1.1)

    if not rows:
        raise RuntimeError("The historical weather source returned no records")

    rows.sort(key=lambda row: (row["date"], row["state"], row["city"]))
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with CSV_PATH.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=CSV_FIELDS)
        writer.writeheader()
        writer.writerows(rows)
    return rows, "downloaded"


def evaluate_and_train(rows, end_date):
    cutoff_year = date.fromisoformat(end_date).year - 1
    cutoff = "{}-01-01".format(cutoff_year)
    train_rows = [row for row in rows if row["date"] < cutoff]
    test_rows = [row for row in rows if row["date"] >= cutoff]
    if len(train_rows) < 1000 or len(test_rows) < 100:
        raise RuntimeError(
            "Not enough temporal train/test samples; use at least two years."
        )

    train_x = np.asarray([
        [float(row[column]) for column in FEATURES] for row in train_rows
    ])
    test_x = np.asarray([
        [float(row[column]) for column in FEATURES] for row in test_rows
    ])
    models = {}
    metrics = {}

    for hazard, target in TARGETS.items():
        train_y = np.asarray([int(row[target]) for row in train_rows])
        test_y = np.asarray([int(row[target]) for row in test_rows])
        if len(np.unique(train_y)) < 2:
            raise RuntimeError(
                "The training history has no positive and negative examples " +
                "for {}. No model was saved.".format(hazard)
            )

        model = RandomForestClassifier(
            n_estimators=200,
            min_samples_leaf=5,
            class_weight="balanced_subsample",
            random_state=42,
            n_jobs=-1,
        )
        model.fit(train_x, train_y)
        predictions = model.predict(test_x)
        models[hazard] = model
        metrics[hazard] = {
            "accuracy": float(accuracy_score(test_y, predictions)),
            "precision": float(precision_score(
                test_y, predictions, zero_division=0
            )),
            "recall": float(recall_score(
                test_y, predictions, zero_division=0
            )),
            "f1": float(f1_score(test_y, predictions, zero_division=0)),
            "positive_test_samples": int(np.sum(test_y)),
            "positive_train_samples": int(np.sum(train_y)),
            "test_samples": int(len(test_y)),
            "validated": int(np.sum(test_y)) >= MINIMUM_VALIDATION_POSITIVES,
        }

    return models, metrics, cutoff


def training_feature_ranges(train_rows):
    if not train_rows:
        raise ValueError("Training rows are required to calculate feature ranges.")
    ranges = {}
    for feature in FEATURES:
        values = [float(row[feature]) for row in train_rows]
        if not values or not all(np.isfinite(values)):
            raise ValueError(
                "Training feature {} contains no finite values.".format(feature)
            )
        ranges[feature] = {
            "min": min(values),
            "max": max(values),
            "unit": FEATURE_UNITS[feature],
        }
    return ranges


def main():
    parser = argparse.ArgumentParser(
        description="Build and evaluate the ClimateRisk AI weather-trigger model."
    )
    parser.add_argument("--start-date", default="2015-01-01")
    parser.add_argument("--end-date", default="2024-12-31")
    parser.add_argument("--refresh", action="store_true")
    args = parser.parse_args()
    date.fromisoformat(args.start_date)
    date.fromisoformat(args.end_date)
    if args.start_date >= args.end_date:
        parser.error("--start-date must precede --end-date")

    try:
        rows, data_status = load_or_download_rows(
            args.start_date, args.end_date, args.refresh
        )
        models, metrics, cutoff = evaluate_and_train(rows, args.end_date)
    except (URLError, OSError, RuntimeError, ValueError) as error:
        print("Training failed: {}".format(error), file=sys.stderr)
        return 1

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(models, MODEL_PATH)
    train_rows = [row for row in rows if row["date"] < cutoff]
    metadata = {
        "algorithm": "scikit-learn RandomForestClassifier",
        "scikit_learn_version": sklearn.__version__,
        "training_data_source": (
            "Open-Meteo Historical Weather API; ERA5 reanalysis; "
            "CC BY 4.0 attribution required"
        ),
        "training_data_url": "https://archive-api.open-meteo.com/v1/archive",
        "coordinate_source": "OpenStreetMap city locations, linked in training locations",
        "training_period": {
            "start": args.start_date,
            "end": args.end_date,
            "test_starts": cutoff,
        },
        "split_method": "Chronological holdout: earlier dates for training, final two calendar years for testing",
        "minimum_positive_holdout_samples_for_numeric_score": MINIMUM_VALIDATION_POSITIVES,
        "data_rows": len(rows),
        "training_rows": sum(1 for row in rows if row["date"] < cutoff),
        "test_rows": sum(1 for row in rows if row["date"] >= cutoff),
        "data_status": data_status,
        "feature_columns": FEATURES,
        "feature_units": FEATURE_UNITS,
        "preprocessing": (
            "None; raw numeric feature vectors are passed to each "
            "RandomForestClassifier in feature_columns order."
        ),
        "training_feature_ranges": training_feature_ranges(train_rows),
        "training_locations": TRAINING_LOCATIONS,
        "targets": {
            "flood": "Daily precipitation >=64.5 mm (heavy-rainfall trigger proxy; not observed flooding).",
            "heatwave": "Daily maximum temperature >=40 C below 1000 m or >=30 C at/above 1000 m (heat trigger proxy; not official IMD heatwave declaration).",
            "cyclone": "Daily maximum 10 m wind >=63 km/h (wind trigger proxy; not cyclone detection or landfall probability).",
        },
        "excluded_features": {
            "population_density": (
                "Not present in the existing local-body dataset or the selected "
                "weather endpoint; not imputed or fabricated."
            ),
            "flood_extent_and_cyclone_tracks": (
                "No verified event/impact labels were available in the project; "
                "the output is an explicitly labeled weather-trigger proxy."
            ),
        },
        "risk_score_interpretation": (
            "Uncalibrated Random Forest class score (0-100) for reproducing a "
            "feature-derived daily weather-trigger proxy on the highest-scoring "
            "day in the next 7-day forecast. It is not a calibrated disaster "
            "probability, official warning, or independently validated event "
            "forecast. Evaluation measures reproduction of the stated "
            "feature-derived trigger labels."
        ),
        "evaluation": metrics,
        "model_file": MODEL_PATH.name,
    }
    METADATA_PATH.write_text(
        json.dumps(metadata, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(json.dumps({
        "model": str(MODEL_PATH),
        "metadata": str(METADATA_PATH),
        "dataset": str(CSV_PATH),
        "data_rows": len(rows),
        "training_rows": metadata["training_rows"],
        "test_rows": metadata["test_rows"],
        "evaluation": metrics,
    }, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
