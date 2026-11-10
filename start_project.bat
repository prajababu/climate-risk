@echo off
setlocal
set "PROJECT_DIR=%~dp0"
cd /d "%PROJECT_DIR%"
if errorlevel 1 (
    echo [ERROR] Could not open project directory: "%PROJECT_DIR%"
    pause
    exit /b 1
)

echo ClimateRisk AI startup
echo Project directory: "%CD%"

if exist ".venv\Scripts\activate.bat" (
    call ".venv\Scripts\activate.bat"
    if errorlevel 1 (
        echo [ERROR] Could not activate the existing .venv.
        pause
        exit /b 1
    )
    set "PYTHON_COMMAND=python"
) else (
    echo [WARNING] Existing .venv was not found. Looking for Python 3.7.
    where py >nul 2>nul
    if errorlevel 1 (
        echo [ERROR] Python launcher "py" is unavailable. Install Python 3.7 or restore the existing .venv.
        pause
        exit /b 1
    )
    py -3.7 --version
    if errorlevel 1 (
        echo [ERROR] Python 3.7 is not installed. No packages were installed or upgraded.
        pause
        exit /b 1
    )
    set "PYTHON_COMMAND=py -3.7"
)

%PYTHON_COMMAND% -c "import sys; print('Using Python ' + sys.version.split()[0]); sys.exit(0 if sys.version_info >= (3, 7) else 1)"
if errorlevel 1 (
    echo [ERROR] Python 3.7 or newer is required.
    pause
    exit /b 1
)

%PYTHON_COMMAND% -c "import flask, joblib, numpy, sklearn; print('Flask ' + flask.__version__ + ', joblib ' + joblib.__version__ + ', NumPy ' + numpy.__version__ + ', scikit-learn ' + sklearn.__version__)"
if errorlevel 1 (
    echo [ERROR] A required Python dependency is missing or cannot be imported.
    echo Install the existing pinned dependencies with:
    echo %PYTHON_COMMAND% -m pip install -r backend\requirements.txt
    pause
    exit /b 1
)

for %%F in (backend\app.py backend\requirements.txt frontend\index.html frontend\script.js frontend\style.css frontend\data\india_urban_local_bodies.json) do (
    if not exist "%%~F" (
        echo [ERROR] Required application file is missing: %%~F
        pause
        exit /b 1
    )
)

if not exist "backend\data\observed_daily_climate.csv" (
    echo [WARNING] Training dataset is missing: backend\data\observed_daily_climate.csv
    echo The existing model can still serve predictions, but retraining is unavailable.
)
if not exist "backend\models\climate_risk_models.joblib" (
    echo [WARNING] Saved model is missing. Prediction APIs will report that no model is available.
    echo This launcher will not retrain or replace a model.
)
if not exist "backend\models\model_metadata.json" (
    echo [WARNING] Saved model metadata is missing. Prediction APIs will report that the model is unavailable.
)

%PYTHON_COMMAND% -c "import socket, sys; probe = socket.socket(); probe.settimeout(2); result = probe.connect_ex(('127.0.0.1', 5000)); probe.close(); sys.exit(0 if result == 0 else 1)"
if not errorlevel 1 (
    echo [WARNING] Port 5000 is already listening.
    curl.exe --silent --show-error --max-time 3 http://127.0.0.1:5000/api/health | findstr /C:"model_available" >nul
    if not errorlevel 1 (
        echo An existing ClimateRisk backend is already responding at http://127.0.0.1:5000/.
        goto frontend_instructions
    )
    echo [ERROR] Port 5000 is occupied by a service that is not the ClimateRisk backend.
    echo Stop that service using its own terminal, then run this file again.
    echo Port owner details:
    netstat -ano -p tcp | find ":5000"
    pause
    exit /b 1
)

echo.
echo Starting Flask. Keep this window open while using the project.
echo Backend and API: http://127.0.0.1:5000/
echo Frontend can also be opened with VS Code Live Server.
echo Stop Flask with Ctrl+C in this window.
echo.
%PYTHON_COMMAND% backend\app.py
set "START_EXIT_CODE=%ERRORLEVEL%"
echo.
echo Flask stopped with exit code %START_EXIT_CODE%.
pause
exit /b %START_EXIT_CODE%

:frontend_instructions
echo.
echo Open the frontend with VS Code Live Server:
echo   1. Open this folder in VS Code: "%PROJECT_DIR%"
echo   2. Open frontend\index.html.
echo   3. Select "Go Live" in the VS Code status bar.
echo Keep the existing backend running at http://127.0.0.1:5000/.
exit /b 0
