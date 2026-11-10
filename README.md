# ClimateRisk AI

This is the existing ClimateRisk AI project. The saved Random Forest models,
training data, Flask API, and frontend modules are retained; startup and health
checks do not retrain or replace models.

## Windows startup

The project is configured for its existing Python 3.7.1 virtual environment and
the versions pinned in `backend\requirements.txt`. No package upgrade is
performed by the startup script.

1. Open a Command Prompt in the project folder
   (`C:\Users\PRAJA\OneDrive\Desktop\praja`) or double-click
   `start_project.bat`.
2. The script activates the existing `.venv`, checks Python and dependencies,
   verifies required files, and checks whether port 5000 is already serving
   this API. If the port is occupied by another service, it reports the port
   owner rather than attempting to terminate it.
3. If Flask starts, keep that Command Prompt open. It serves the backend at
   `http://127.0.0.1:5000/`.
4. Open the frontend using VS Code Live Server:
   - Open this project folder in VS Code.
   - Open `frontend\index.html`.
   - Select **Go Live** in the VS Code status bar.

The frontend API helpers use `http://127.0.0.1:5000` when opened through Live
Server or as a local file, and use the same origin when Flask serves the page.

### Exact command-line startup

```bat
cd /d C:\Users\PRAJA\OneDrive\Desktop\praja
start_project.bat
```

### Run the health check

Run this before using the application when diagnosing the environment:

```bat
cd /d C:\Users\PRAJA\OneDrive\Desktop\praja
.\.venv\Scripts\python.exe backend\health_check.py
```

If `.venv` is unavailable but the Python launcher has Python 3.7 installed:

```bat
cd /d C:\Users\PRAJA\OneDrive\Desktop\praja
py -3.7 backend\health_check.py
```

The check validates the Python runtime, pinned dependencies, source syntax,
project files, dataset columns/rows, model metadata, local location JSON and
counts, HTML/navigation targets, JavaScript syntax when Node.js is available,
model loading, frontend Flask routes, and prediction/Digital Twin API
responses. API smoke tests use a local fixed weather fixture; they do not
contact Open-Meteo or retrain the model.

## Stop the project

In the Command Prompt running Flask, press **Ctrl+C**. Close the VS Code Live
Server tab or select **Port: ...** in the status bar to stop Live Server.
If `start_project.bat` reports that the backend is already running, stop it
from the terminal that originally launched it.

## Missing files and degraded startup

- The launcher reports missing model or metadata files and still starts Flask
  when its code and dependencies are available. The API then returns a clear
  HTTP 503 error; no prediction is fabricated.
- A missing training CSV prevents retraining but does not prevent use of an
  intact saved model for inference.
- Restore a missing or damaged file from a known-good project backup. The
  launcher and health check never run `train_model.py` automatically.
- Python dependencies are checked without modifying the environment. If the
  check reports a missing dependency, inspect the environment first; the
  existing pinned install command is:

  ```bat
  .\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
  ```

  Do not use an unpinned upgrade command for this Python 3.7.1 project.

## Troubleshooting

### Port 5000 is already in use

If the launcher identifies a responding ClimateRisk API, reuse it and open the
frontend with Live Server. Otherwise inspect the listener:

```bat
netstat -ano -p tcp | findstr :5000
```

Stop an application only from its own terminal or after confirming its
identity. Then run `start_project.bat` again. The frontend currently targets
port 5000, so changing only the Flask port will prevent API requests from
reaching this backend.

### API unavailable from the frontend

Check that Flask is still running and visit
`http://127.0.0.1:5000/api/health`. A healthy installation responds with
`"status": "ready"` and `"model_available": true`. If Live Server is open on a
different device, `127.0.0.1` refers to that device; use the project locally
with the backend on the same Windows computer.

### Model or forecast errors

The health endpoint and the AI Risk Prediction/Digital Twin pages display
missing-model or API errors. Restore missing model files from backup. Forecast
requests require internet access to Open-Meteo; map boundaries and city lookup
also use their configured external sources. No fallback prediction is shown
when those requests fail.

### Frontend location or map data unavailable

Run the health check and confirm that
`frontend\data\india_urban_local_bodies.json` exists and passes its metadata
count check. Map tiles, boundaries, and the default geocoder require internet
access.
