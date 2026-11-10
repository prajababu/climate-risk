import csv
import json
import shutil
import subprocess
import sys
from html.parser import HTMLParser
from pathlib import Path
from unittest import mock


PROJECT_ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = PROJECT_ROOT / "backend"
FRONTEND_DIR = PROJECT_ROOT / "frontend"
DATASET_PATH = BACKEND_DIR / "data" / "observed_daily_climate.csv"
MODEL_PATH = BACKEND_DIR / "models" / "climate_risk_models.joblib"
METADATA_PATH = BACKEND_DIR / "models" / "model_metadata.json"
LOCAL_DATA_PATH = FRONTEND_DIR / "data" / "india_urban_local_bodies.json"
EXPECTED_PACKAGES = {
    "Flask": ("flask", "2.2.5"),
    "joblib": ("joblib", "1.2.0"),
    "numpy": ("numpy", "1.21.6"),
    "scikit-learn": ("sklearn", "1.0.2"),
}
EXPECTED_CSV_FIELDS = {
    "date",
    "temperature_2m_max_c",
    "relative_humidity_2m_mean_pct",
    "precipitation_sum_mm",
    "wind_speed_10m_max_kmh",
    "elevation_m",
    "heavy_rain_trigger",
    "extreme_heat_trigger",
    "cyclone_wind_trigger",
}
EXPECTED_PAGES = {
    "dashboard",
    "prediction",
    "map",
    "digital-twin",
    "vulnerability",
    "alerts",
    "preparedness",
}
failures = 0


def report(passed, label, details=""):
    global failures
    status = "PASS" if passed else "FAIL"
    print("[{}] {}{}".format(
        status,
        label,
        ": {}".format(details) if details else "",
    ))
    if not passed:
        failures += 1


class ProjectHTMLParser(HTMLParser):
    def __init__(self):
        HTMLParser.__init__(self)
        self.page_ids = []
        self.navigation_targets = []

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        classes = attributes.get("class", "").split()
        if tag == "section" and "page" in classes:
            self.page_ids.append(attributes.get("id"))
        if tag == "a" and "nav-link" in classes:
            self.navigation_targets.append(attributes.get("data-page"))


def check_python_syntax():
    source_files = [
        BACKEND_DIR / "app.py",
        BACKEND_DIR / "train_model.py",
        Path(__file__).resolve(),
    ]
    for path in source_files:
        try:
            source = path.read_text(encoding="utf-8")
            compile(source, str(path), "exec")
        except (OSError, SyntaxError, UnicodeError) as error:
            report(False, "Python syntax {}".format(path.name), str(error))
        else:
            report(True, "Python syntax {}".format(path.name))


def check_packages():
    imported_modules = {}
    for package, (module_name, expected_version) in EXPECTED_PACKAGES.items():
        try:
            module = __import__(module_name)
        except ImportError as error:
            report(False, "Dependency {}".format(package), str(error))
            continue
        imported_modules[module_name] = module
        actual_version = getattr(module, "__version__", "unknown")
        report(
            actual_version == expected_version,
            "Dependency {}".format(package),
            "installed {}, requirements pin {}".format(
                actual_version, expected_version
            ),
        )
    return len(imported_modules) == len(EXPECTED_PACKAGES)


def check_dataset():
    if not DATASET_PATH.is_file():
        report(False, "Training dataset", "Missing {}".format(DATASET_PATH))
        return
    try:
        with DATASET_PATH.open("r", encoding="utf-8", newline="") as stream:
            reader = csv.DictReader(stream)
            fields = set(reader.fieldnames or [])
            missing = sorted(EXPECTED_CSV_FIELDS - fields)
            row_count = sum(1 for _ in reader)
    except (OSError, UnicodeError, csv.Error) as error:
        report(False, "Training dataset", str(error))
        return
    report(
        not missing and row_count > 0,
        "Training dataset",
        "{} data rows; {} required columns{}".format(
            row_count,
            len(EXPECTED_CSV_FIELDS),
            "; missing {}".format(", ".join(missing)) if missing else "",
        ),
    )


def check_json_file(path, label):
    if not path.is_file():
        report(False, label, "Missing {}".format(path))
        return None
    try:
        with path.open("r", encoding="utf-8") as stream:
            data = json.load(stream)
    except (OSError, UnicodeError, ValueError) as error:
        report(False, label, str(error))
        return None
    report(True, label, "Valid JSON")
    return data


def check_local_data():
    data = check_json_file(LOCAL_DATA_PATH, "Frontend location data")
    if not isinstance(data, dict):
        return
    metadata = data.get("metadata")
    valid = (
        isinstance(metadata, dict) and
        isinstance(metadata.get("counts"), dict) and
        all(isinstance(data.get(key), list) for key in (
            "states", "districts", "urbanLocalBodies"
        ))
    )
    if valid:
        counts = metadata["counts"]
        valid = (
            len(data["states"]) == counts.get("statesAndUnionTerritories") and
            len(data["districts"]) == counts.get("districts") and
            len(data["urbanLocalBodies"]) == counts.get("urbanLocalBodies")
        )
    report(
        valid,
        "Frontend location data structure",
        "Counts agree with metadata" if valid else
        "Required arrays or metadata counts are missing or inconsistent",
    )


def check_html():
    path = FRONTEND_DIR / "index.html"
    try:
        source = path.read_text(encoding="utf-8")
        parser = ProjectHTMLParser()
        parser.feed(source)
        parser.close()
    except (OSError, UnicodeError, ValueError) as error:
        report(False, "Frontend HTML parsing", str(error))
        return
    duplicate_ids = sorted({
        page_id for page_id in parser.page_ids
        if parser.page_ids.count(page_id) > 1
    })
    missing_pages = sorted(
        EXPECTED_PAGES - set(parser.page_ids)
    )
    invalid_targets = sorted(
        target for target in parser.navigation_targets
        if target not in parser.page_ids
    )
    passed = not duplicate_ids and not missing_pages and not invalid_targets
    report(
        passed,
        "Frontend HTML and navigation",
        "{} pages; {} navigation links{}".format(
            len(parser.page_ids),
            len(parser.navigation_targets),
            "; problems: {}".format(
                ", ".join(duplicate_ids + missing_pages + invalid_targets)
            ) if not passed else "",
        ),
    )


def check_javascript():
    node = shutil.which("node")
    if not node:
        print("[NOT TESTED] JavaScript syntax: Node.js is not installed")
        return
    script_path = FRONTEND_DIR / "script.js"
    result = subprocess.Popen(
        [node, "--check", str(script_path)],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    stdout, stderr = result.communicate()
    details = (stdout + stderr).decode("utf-8", "replace").strip()
    report(
        result.returncode == 0,
        "JavaScript syntax",
        details or "node --check",
    )


def forecast_fixture():
    weather = []
    for day in range(1, 8):
        weather.append({
            "date": "2026-01-{:02d}".format(day),
            "temperature_2m_max_c": 29.1,
            "relative_humidity_2m_mean_pct": 71.0,
            "precipitation_sum_mm": 0.0,
            "wind_speed_10m_max_kmh": 9.4,
            "elevation_m": 16.0,
        })
    return weather


def check_backend():
    sys.path.insert(0, str(BACKEND_DIR))
    try:
        import app as climate_app
    except ImportError as error:
        report(False, "Backend import", str(error))
        return

    model_ready = climate_app.load_model()
    report(
        model_ready,
        "Saved ML model loading",
        "Existing models loaded; no training was run" if model_ready
        else climate_app.model_load_error,
    )
    client = climate_app.app.test_client()

    health_response = client.get("/api/health")
    health_body = health_response.get_json(silent=True) or {}
    report(
        health_response.status_code == (200 if model_ready else 503) and
        health_body.get("model_available") is model_ready,
        "Backend health endpoint",
        "HTTP {} ({})".format(
            health_response.status_code,
            health_body.get("status", "invalid response"),
        ),
    )
    if not model_ready:
        return

    saved_models = climate_app.models
    saved_metadata = climate_app.model_metadata
    saved_load_error = climate_app.model_load_error
    try:
        climate_app.models = None
        climate_app.model_metadata = None
        with mock.patch.object(
            climate_app,
            "MODEL_PATH",
            MODEL_PATH.with_name("missing_model_for_health_check.joblib"),
        ):
            missing_model_response = client.get("/api/health")
            missing_model_api_response = client.post(
                "/api/climate-risk",
                json={},
            )
        missing_model_body = (
            missing_model_response.get_json(silent=True) or {}
        )
        report(
            missing_model_response.status_code == 503 and
            "missing" in missing_model_body.get("error", "").lower(),
            "Missing-model health response",
            "HTTP {}".format(missing_model_response.status_code),
        )
        missing_model_api_body = (
            missing_model_api_response.get_json(silent=True) or {}
        )
        report(
            missing_model_api_response.status_code == 503 and
            isinstance(missing_model_api_body.get("error"), str) and
            "missing" in missing_model_api_body["error"].lower(),
            "Missing-model prediction API response",
            "HTTP {}".format(missing_model_api_response.status_code),
        )
    finally:
        climate_app.models = saved_models
        climate_app.model_metadata = saved_metadata
        climate_app.model_load_error = saved_load_error

    for path in ("/", "/index.html", "/script.js", "/style.css"):
        response = client.get(path)
        report(
            response.status_code == 200,
            "Frontend route {}".format(path),
            "HTTP {}".format(response.status_code),
        )

    invalid_response = client.post(
        "/api/climate-risk",
        data="not JSON",
        content_type="text/plain",
    )
    invalid_body = invalid_response.get_json(silent=True) or {}
    report(
        invalid_response.status_code == 400 and
        isinstance(invalid_body.get("error"), str),
        "Climate API invalid-input response",
        "HTTP {}".format(invalid_response.status_code),
    )

    payload = {
        "city": "Surat",
        "district": "Surat",
        "state": "Gujarat",
        "latitude": 21.2095,
        "longitude": 72.8317,
    }
    try:
        with mock.patch.object(
            climate_app,
            "fetch_forecast",
            return_value=forecast_fixture(),
        ):
            prediction_response = client.post(
                "/api/climate-risk",
                json=payload,
            )
        prediction = prediction_response.get_json(silent=True) or {}
        prediction_valid = (
            prediction_response.status_code == 200 and
            isinstance(prediction.get("risks"), dict) and
            isinstance(prediction.get("forecast_dates"), list) and
            isinstance(prediction.get("baseline_weather"), dict)
        )
        report(
            prediction_valid,
            "Climate Risk Prediction API",
            "HTTP {}".format(prediction_response.status_code),
        )
    except (TypeError, ValueError, RuntimeError) as error:
        report(False, "Climate Risk Prediction API", str(error))

    twin_payload = {
        "location": {
            "state": "Gujarat",
            "district": "Surat",
            "city": "Surat",
        },
        "coordinates": {
            "latitude": 21.2095,
            "longitude": 72.8317,
        },
        "baseline": {
            "date": "2026-01-01",
            "temperature_2m_max_c": 29.1,
            "relative_humidity_2m_mean_pct": 71.0,
            "precipitation_sum_mm": 0.0,
            "wind_speed_10m_max_kmh": 9.4,
            "elevation_m": 16.0,
        },
        "scenario": {
            "temperature_2m_max_c": 29.1,
            "relative_humidity_2m_mean_pct": 71.0,
            "precipitation_sum_mm": 0.0,
            "wind_speed_10m_max_kmh": 9.4,
        },
    }
    twin_response = client.post(
        "/api/digital-twin/simulate",
        json=twin_payload,
    )
    twin = twin_response.get_json(silent=True) or {}
    twin_valid = (
        twin_response.status_code == 200 and
        isinstance(twin.get("comparison"), dict) and
        isinstance(twin.get("training_range_warnings"), list) and
        twin.get("baseline", {}).get("precipitation_sum_mm") == 0.0
    )
    report(
        twin_valid,
        "Digital Twin Simulation API",
        "HTTP {}".format(twin_response.status_code),
    )


def main():
    version_ok = sys.version_info >= (3, 7)
    report(
        version_ok,
        "Python version",
        sys.version.split()[0] + (" (requires 3.7+)" if not version_ok else ""),
    )

    for relative_path in (
        "backend/app.py",
        "backend/train_model.py",
        "backend/requirements.txt",
        "frontend/index.html",
        "frontend/script.js",
        "frontend/style.css",
    ):
        path = PROJECT_ROOT / relative_path
        report(path.is_file(), "Required project file", relative_path)

    check_python_syntax()
    packages_ready = check_packages()
    check_dataset()
    metadata = check_json_file(METADATA_PATH, "Model metadata")
    if metadata is not None:
        report(
            metadata.get("feature_columns") == [
                "temperature_2m_max_c",
                "relative_humidity_2m_mean_pct",
                "precipitation_sum_mm",
                "wind_speed_10m_max_kmh",
                "elevation_m",
            ],
            "Model metadata feature order",
        )
    check_local_data()
    report(MODEL_PATH.is_file(), "Saved model file", str(MODEL_PATH))
    check_html()
    check_javascript()

    if packages_ready:
        check_backend()
    else:
        print("[NOT TESTED] Backend/API checks: required dependencies are unavailable")

    if failures:
        print("\nHealth check failed: {} check(s) need attention.".format(failures))
        return 1
    print("\nHealth check passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
