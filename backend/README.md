# ClimateRisk AI local prediction service

The project has no prior climate observations or fitted model. The pipeline
downloads daily historical ERA5 reanalysis for six documented, georeferenced
Indian city locations from the Open-Meteo Historical Weather API, writes
`data/observed_daily_climate.csv`, evaluates a temporal holdout, and saves
`models/climate_risk_models.joblib` plus `models/model_metadata.json`.

The targets are explicitly weather-trigger proxies, not observed disasters:

- Heavy rainfall: daily precipitation at least 64.5 mm.
- Extreme heat: daily maximum at least 40 °C below 1,000 m elevation, or 30 °C
  at/above 1,000 m.
- High local wind: daily maximum 10 m wind at least 63 km/h.

The Random Forest's displayed percentage is an uncalibrated class score for
reproducing those feature-derived thresholds; it is not a calibrated event
probability. Evaluation uses the final two calendar years as a chronological
holdout. Since labels are computed directly from weather features, accuracy,
precision, recall, and F1 measure threshold reproduction, not skill at
predicting independently recorded disasters. A hazard receives no numeric
forecast score unless its holdout contains at least ten positive trigger days.

The heat threshold does not include all IMD heatwave declaration criteria;
daily local wind is not cyclone-track/landfall data; and heavy rainfall is not
observed flooding. The 0–100 scores estimate a proxy trigger on the highest
scoring day in the next seven-day Open-Meteo forecast. The overall score is the
maximum validated individual proxy score, not a combined event probability.
Unvalidated hazards are shown as N/A. These outputs are experimental and must
not replace IMD, NDMA, or local-authority alerts.

Population density and verified flood/cyclone impact labels are not available
in the existing project or the selected weather data source and are not
imputed. Results have limited spatial training coverage (six representative
locations) and must not be presented as a validated nationwide operational
early-warning model.

## Setup and run

Use Python 3.7 or newer compatible with the pinned requirements:

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -r backend\requirements.txt
.\.venv\Scripts\python backend\train_model.py
.\.venv\Scripts\python backend\app.py
```

Open `http://127.0.0.1:5000/`. Selecting a city runs a geocoded seven-day
forecast against the locally trained model. Historical downloads are cached
in the CSV; pass `--refresh` to explicitly redownload. No prediction scores are
shown when the backend/model or forecast is unavailable.

## Digital Twin weather scenario simulation

After selecting a city on the Climate Risk Map and successfully loading its
forecast, the Digital Twin page uses the first daily Open-Meteo forecast row as
the baseline. It posts the selected state, district, city, verified
coordinates, five baseline model features, and four user-adjustable scenario
features to `POST /api/digital-twin/simulate`. Elevation is held constant.
Both baseline and scenario are scored by the existing saved Random Forests
using the same feature columns; the model is not retrained.

Scenario controls accept rainfall 0–300 mm, temperature 0–50 °C, wind speed
0–150 km/h, and relative humidity 0–100%. The response includes both scores,
classifications, percentage-point changes, and the weather values actually
scored. Reset restores the exact forecast weather values; values outside the
scenario input limits remain visible and must be adjusted before running.
Training feature ranges are calculated from the existing chronological
training split and included in model metadata. Out-of-range scenario values
produce a visible warning but are not changed or blocked solely for that
reason. Cyclone remains not validated because its evaluation holdout has no
positive samples. Scores are uncalibrated model scores for weather-trigger
proxies, not real-world disaster probabilities, a physically validated flood
model, hazard boundary, or forecast of an actual future disaster. No
affected-area or population outputs are inferred.

Default city lookups are user-triggered and proxied through Flask to Nominatim
to avoid browser CORS failures. The proxy serializes requests at least 1.1
seconds apart and caches non-empty search results in memory for 24 hours;
strictly matched coordinates are also cached in the browser. Custom compatible
geocoding endpoints are called directly by the browser and must allow CORS.
Follow the provider's acceptable-use policy; use an approved provider/proxy
for shared or higher-volume deployments.

Open-Meteo weather data is CC BY 4.0; retain attribution to
[Open-Meteo](https://open-meteo.com/). Training place coordinates link to
their OpenStreetMap objects and are © OpenStreetMap contributors under ODbL.
The map uses OpenStreetMap tiles and attribution in the existing UI.
