
// =====================================
// CLIMATERISK AI - MAIN JAVASCRIPT
// =====================================

// 1. SIDEBAR PAGE NAVIGATION

const navLinks = document.querySelectorAll(".nav-link");
const pages = document.querySelectorAll(".page");
const pageTitle = document.getElementById("page-title");

const titles = {
    dashboard: "Climate Dashboard",
    prediction: "AI Risk Prediction",
    map: "Climate Risk Map",
    "digital-twin": "Digital Twin Simulation",
    vulnerability: "Vulnerability Analysis",
    alerts: "Alerts & Warnings",
    preparedness: "Community Preparedness"
};

function openPage(pageId) {
    pages.forEach(page => page.classList.remove("active"));
    navLinks.forEach(link => link.classList.remove("active"));

    const selectedPage = document.getElementById(pageId);
    if (!selectedPage) return;

    selectedPage.classList.add("active");

    const selectedLink = document.querySelector(
        `.nav-link[data-page="${pageId}"]`
    );

    if (selectedLink) selectedLink.classList.add("active");

    if (pageTitle) {
        pageTitle.textContent = titles[pageId] || "ClimateRisk AI";
    }

    if (pageId === "map") {
        setTimeout(() => {
            initializeClimateMap();
            if (climateMap) climateMap.invalidateSize();
        }, 200);
    }
}

navLinks.forEach(link => {
    link.addEventListener("click", function(event) {
        event.preventDefault();
        openPage(this.dataset.page);
    });
});

document.querySelectorAll("[data-page]").forEach(button => {
    if (button.classList.contains("nav-link")) return;

    button.addEventListener("click", function() {
        openPage(this.dataset.page);
    });
});


// 2. RAINFALL ANALYTICS CHART

const rainfallCanvas = document.getElementById("rainfallChart");

if (rainfallCanvas && typeof Chart !== "undefined") {
    new Chart(rainfallCanvas, {
        type: "line",
        data: {
            labels: [
                "Jan", "Feb", "Mar", "Apr", "May", "Jun",
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
            ],
            datasets: [{
                label: "Rainfall (mm)",
                data: [
                    45, 60, 75, 55, 110, 180,
                    220, 195, 150, 120, 80, 50
                ],
                borderColor: "#27c5e8",
                backgroundColor: "rgba(39, 197, 232, 0.12)",
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointRadius: 3,
                pointBackgroundColor: "#27c5e8"
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: "#b6c7d9" }
                }
            },
            scales: {
                x: {
                    ticks: { color: "#879bb2" },
                    grid: { color: "rgba(255,255,255,0.04)" }
                },
                y: {
                    beginAtZero: true,
                    ticks: { color: "#879bb2" },
                    grid: { color: "rgba(255,255,255,0.06)" }
                }
            }
        }
    });
}


// 3. CLIMATE RISK DISTRIBUTION CHART

const riskCanvas = document.getElementById("riskChart");

if (riskCanvas && typeof Chart !== "undefined") {
    new Chart(riskCanvas, {
        type: "doughnut",
        data: {
            labels: [
                "Low Risk", "Moderate Risk",
                "High Risk", "Very High Risk"
            ],
            datasets: [{
                data: [35, 30, 23, 12],
                backgroundColor: [
                    "#29c99a", "#e8c45b",
                    "#f39a48", "#ed6262"
                ],
                borderWidth: 2,
                borderColor: "#14243a",
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: "65%",
            plugins: {
                legend: {
                    position: "bottom",
                    labels: {
                        color: "#b6c7d9",
                        padding: 15,
                        usePointStyle: true
                    }
                }
            }
        }
    });
}


// 4. INDIA CLIMATE RISK MAP

const indiaStates = [
    { name: "Andhra Pradesh", slug: "andhra-pradesh" },
    { name: "Arunachal Pradesh", slug: "arunachal-pradesh" },
    { name: "Assam", slug: "assam" },
    { name: "Bihar", slug: "bihar" },
    { name: "Chhattisgarh", slug: "chhattisgarh" },
    { name: "Goa", slug: "goa" },
    { name: "Gujarat", slug: "gujarat" },
    { name: "Haryana", slug: "haryana" },
    { name: "Himachal Pradesh", slug: "himachal-pradesh" },
    { name: "Jharkhand", slug: "jharkhand" },
    { name: "Karnataka", slug: "karnataka" },
    { name: "Kerala", slug: "kerala" },
    { name: "Madhya Pradesh", slug: "madhya-pradesh" },
    { name: "Maharashtra", slug: "maharashtra" },
    { name: "Manipur", slug: "manipur" },
    { name: "Meghalaya", slug: "meghalaya" },
    { name: "Mizoram", slug: "mizoram" },
    { name: "Nagaland", slug: "nagaland" },
    { name: "Odisha", slug: "odisha" },
    { name: "Punjab", slug: "punjab" },
    { name: "Rajasthan", slug: "rajasthan" },
    { name: "Sikkim", slug: "sikkim" },
    { name: "Tamil Nadu", slug: "tamil-nadu" },
    { name: "Telangana", slug: "telangana" },
    { name: "Tripura", slug: "tripura" },
    { name: "Uttar Pradesh", slug: "uttar-pradesh" },
    { name: "Uttarakhand", slug: "uttarakhand" },
    { name: "West Bengal", slug: "west-bengal" },

    { name: "Andaman and Nicobar Islands", slug: "andaman-and-nicobar-islands" },
    { name: "Chandigarh", slug: "chandigarh" },
    { name: "Dadra & Nagar Haveli and Daman & Diu", slug: "dadra-and-nagar-haveli-and-daman-and-diu" },
    { name: "Delhi", slug: "delhi" },
    { name: "Jammu and Kashmir", slug: "jammu-and-kashmir" },
    { name: "Ladakh", slug: "ladakh" },
    { name: "Lakshadweep", slug: "lakshadweep" },
    { name: "Puducherry", slug: "puducherry" }
];

const stateSelect = document.getElementById("stateSelect");
const districtSelect = document.getElementById("districtSelect");
const citySelect = document.getElementById("citySelect");

const selectedLocation = document.getElementById("selectedLocation");
const mapRiskLevel = document.getElementById("mapRiskLevel");
const mapWeatherInfo = document.getElementById("mapWeatherInfo");

let climateMap = null;
let indiaBoundaryLayer = null;
let districtBoundaryLayer = null;
let hazardLayers = {};
let currentDistrictData = [];
let currentStateName = "";
let cityLoadRequestId = 0;
let stateLoadRequestId = 0;
let citySelectionRequestId = 0;
let urbanLocalBodyData = null;
let urbanLocalBodyDataPromise = null;
let selectedCityMarker = null;
let selectedRiskLayer = null;
let selectedDistrictLayer = null;
let digitalTwinBaselineLayer = null;
let digitalTwinScenarioLayer = null;
let digitalTwinSelection = null;
let digitalTwinSimulationRequestId = 0;
let mapLocationSelectionMade = false;
let geocodingQueue = Promise.resolve();
let lastGeocodingRequestAt = 0;

const INDIA_MAP_URL =
    "https://cdn.jsdelivr.net/gh/udit-001/india-maps-data@main/geojson/india.geojson";

const STATE_MAP_BASE =
    "https://cdn.jsdelivr.net/gh/udit-001/india-maps-data@main/geojson/states/";

const NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search";
const GEOCODING_CACHE_KEY = "climaterisk-osm-geocoding-v1";
const GEOCODING_ENDPOINT_KEY = "climaterisk-geocoding-endpoint";
const GEOCODING_MIN_INTERVAL_MS = 1100;

function isLoopbackHost(hostname) {
    return hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname === "[::1]";
}

function getLocalClimateRiskApiUrl(path) {
    return new URL(path, "http://127.0.0.1:5000").toString();
}

function getClimateRiskApiUrl() {
    if (
        window.location.protocol === "file:" ||
        (
            isLoopbackHost(window.location.hostname) &&
            window.location.port !== "5000"
        )
    ) {
        return getLocalClimateRiskApiUrl("/api/climate-risk");
    }
    return new URL("/api/climate-risk", window.location.origin).toString();
}

function getGeocodingApiUrl() {
    if (
        window.location.protocol === "file:" ||
        (
            isLoopbackHost(window.location.hostname) &&
            window.location.port !== "5000"
        )
    ) {
        return getLocalClimateRiskApiUrl("/api/geocode");
    }
    return new URL("/api/geocode", window.location.origin).toString();
}

function getDigitalTwinApiUrl() {
    if (
        window.location.protocol === "file:" ||
        (
            isLoopbackHost(window.location.hostname) &&
            window.location.port !== "5000"
        )
    ) {
        return getLocalClimateRiskApiUrl("/api/digital-twin/simulate");
    }
    return new URL(
        "/api/digital-twin/simulate",
        window.location.origin
    ).toString();
}

const URBAN_LOCAL_BODY_DATA_URL = new URL(
    "data/india_urban_local_bodies.json",
    document.currentScript.src
);


function loadUrbanLocalBodyData() {
    if (!urbanLocalBodyDataPromise) {
        urbanLocalBodyDataPromise = fetch(URBAN_LOCAL_BODY_DATA_URL)
            .then(response => {
                if (!response.ok) {
                    throw new Error(
                        `Local urban local body data could not load (${response.status})`
                    );
                }
                return response.json();
            })
            .then(data => {
                if (
                    !data ||
                    !data.metadata ||
                    !Array.isArray(data.states) ||
                    !Array.isArray(data.districts) ||
                    !Array.isArray(data.urbanLocalBodies) ||
                    data.states.length !==
                        data.metadata.counts.statesAndUnionTerritories ||
                    data.urbanLocalBodies.length !==
                        data.metadata.counts.urbanLocalBodies
                ) {
                    throw new Error("Local urban local body data is invalid");
                }

                urbanLocalBodyData = data;
                return data;
            })
            .catch(error => {
                urbanLocalBodyDataPromise = null;
                throw error;
            });
    }

    return urbanLocalBodyDataPromise;
}


function normalizeStateSlug(name) {
    return name
        .trim()
        .toLocaleLowerCase()
        .replace(/&/g, " and ")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .replace(/^the-/, "");
}


function findLgdState(state) {
    if (!urbanLocalBodyData || !state) return null;

    return urbanLocalBodyData.states.find(
        item => normalizeStateSlug(item.name) === state.slug
    ) || null;
}


function findLgdDistrict(stateCode, districtName) {
    if (!urbanLocalBodyData) return null;

    const normalizedName = normalizeAdministrativeName(districtName);
    return urbanLocalBodyData.districts.find(
        item =>
            item.stateCode === stateCode &&
            matchesAdministrativeName(item.name, normalizedName)
    ) || null;
}

function normalizeAdministrativeName(name) {
    return String(name || "")
        .trim()
        .toLocaleLowerCase()
        .replace(/&/g, " and ")
        .replace(/\bmetropolitan\b/g, "metro")
        .replace(/^the\s+/, "")
        .replace(/\s+(district|taluk|tehsil|subdistrict)$/i, "")
        .replace(/[^a-z0-9]/g, "");
}


// Initialize map only once

function initializeClimateMap() {
    const mapElement = document.getElementById("climateMap");

    if (!mapElement || typeof L === "undefined") {
        console.error("Leaflet or map container is missing.");
        return;
    }

    if (climateMap) {
        climateMap.invalidateSize();
        return;
    }

    climateMap = L.map("climateMap", {
        zoomControl: true,
        minZoom: 4,
        maxZoom: 18
    }).setView([22.5, 79], 4);

    L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png"
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 18
    }).addTo(climateMap);

    loadIndiaBoundary();
    populateStateDropdown();
    setupHazardLayers();
    setupGeocodingEndpointSetting();
}


// Load India map boundary

async function loadIndiaBoundary() {
    try {
        const response = await fetch(INDIA_MAP_URL);
        if (!response.ok) throw new Error("India map data unavailable");

        const geoData = await response.json();

        indiaBoundaryLayer = L.geoJSON(geoData, {
            style: {
                color: "#27c5e8",
                weight: 1.5,
                fillColor: "#153c58",
                fillOpacity: 0.12
            }
        }).addTo(climateMap);

        if (!mapLocationSelectionMade) {
            climateMap.fitBounds(indiaBoundaryLayer.getBounds(), {
                animate: false
            });
        }

    } catch (error) {
        console.error("India boundary error:", error);
        showMapMessage("India boundary could not load. Check your internet connection.");
    }
}


// Fill all 28 States and 8 UTs

function populateStateDropdown() {
    if (!stateSelect) return;

    stateSelect.innerHTML = '<option value="">Select State / UT</option>';

    indiaStates.forEach(state => {
        const option = document.createElement("option");
        option.value = state.slug;
        option.textContent = state.name;
        stateSelect.appendChild(option);
    });

    stateSelect.addEventListener("change", handleStateChange);
    districtSelect?.addEventListener("change", handleDistrictChange);
    citySelect?.addEventListener("change", handleCityChange);
    document.getElementById("countrySelect")?.addEventListener("change", () => {
        stateSelect.value = "";
        handleStateChange();
    });
}


// State selection

async function handleStateChange() {
    const requestId = ++stateLoadRequestId;
    const selected = indiaStates.find(
        state => state.slug === stateSelect.value
    );

    mapLocationSelectionMade = Boolean(selected);
    clearSelectedCityMarker();
    clearSelectedDistrictLayer();
    clearDigitalTwinComparisonLayers();
    clearDigitalTwinSelection("Select a city and load its forecast baseline.");
    renderClimateRiskPanels(
        null,
        "",
        selected ? "Choose a district and city to run a location-specific forecast." :
            "Select a state or union territory."
    );
    resetSelect(districtSelect, "Select District");
    resetSelect(citySelect, "Select City / Town");
    citySelectionRequestId += 1;
    cityLoadRequestId += 1;
    currentDistrictData = [];
    currentStateName = selected ? selected.name : "";

    if (districtBoundaryLayer) {
        climateMap.removeLayer(districtBoundaryLayer);
        districtBoundaryLayer = null;
    }

    if (!selected) {
        if (indiaBoundaryLayer) {
            climateMap.fitBounds(indiaBoundaryLayer.getBounds(), {
                animate: false
            });
        } else {
            climateMap.setView([22.5, 79], 4, { animate: false });
        }
        updateLocationInfo("India", "Select a state or UT");
        return;
    }

    updateLocationInfo(selected.name, "Loading district data...");

    try {
        let lgdState = null;
        try {
            const data = await loadUrbanLocalBodyData();
            lgdState = findLgdState(selected);
            if (!lgdState) {
                throw new Error("The selected state has no LGD code in the local dataset");
            }
        } catch (error) {
            console.error("Local urban local body data error:", error);
        }

        const response = await fetch(
            STATE_MAP_BASE + selected.slug + ".geojson"
        );

        if (!response.ok) {
            throw new Error("State district data unavailable");
        }

        const geoData = await response.json();
        if (requestId !== stateLoadRequestId) return;

        currentDistrictData = geoData.features || [];

        districtBoundaryLayer = L.geoJSON(geoData, {
            style: {
                color: "#27c5e8",
                weight: 1.2,
                fillColor: "#1685a8",
                fillOpacity: 0.15
            },
            onEachFeature: (feature, layer) => {
                const districtName = getDistrictName(feature.properties);
                layer.bindTooltip(districtName);
                layer.on("click", () => {
                    selectDistrictByName(districtName);
                });
            }
        }).addTo(climateMap);

        climateMap.fitBounds(districtBoundaryLayer.getBounds(), {
            animate: false
        });

        const districtNames = [...new Set(
            currentDistrictData
                .map(feature => getDistrictName(feature.properties))
                .filter(Boolean)
        )].sort();

        districtNames.forEach(name => {
            const option = document.createElement("option");
            const lgdDistrict = lgdState
                ? findLgdDistrict(lgdState.code, name)
                : null;
            option.value = lgdDistrict ? lgdDistrict.code : name;
            option.textContent = name;
            option.dataset.mapName = name;
            if (lgdDistrict) {
                option.dataset.lgdCode = lgdDistrict.code;
            }
            districtSelect.appendChild(option);
        });

        districtSelect.disabled = false;

        updateLocationInfo(
            selected.name,
            districtNames.length + " district areas loaded" +
                (lgdState ? "" : "; local urban local body data unavailable")
        );

    } catch (error) {
        if (requestId !== stateLoadRequestId) return;

        console.error("State data error:", error);
        updateLocationInfo(
            selected.name,
            "District data could not load. Try another state."
        );
    }
}


// Read district name from GeoJSON attributes

function getDistrictName(properties = {}) {
    const possibleNames = [
        "district", "DISTRICT", "District",
        "dtname", "DTNAME", "DT_NAME",
        "name", "NAME_2", "shapeName",
        "district_name", "dt_name"
    ];

    for (const key of possibleNames) {
        if (properties[key]) return String(properties[key]);
    }

    return "Unnamed district";
}


// District selection

function selectDistrictByName(name) {
    if (!districtSelect) return;

    const option = [...districtSelect.options].find(
        item => item.dataset.mapName === name || item.textContent === name
    );

    if (option) {
        districtSelect.value = option.value;
        handleDistrictChange();
    }
}

function handleDistrictChange() {
    const option = districtSelect.options[districtSelect.selectedIndex];
    const districtName = option?.value
        ? option.dataset.mapName || option.textContent
        : "";
    const districtCode = option?.dataset.lgdCode || "";
    mapLocationSelectionMade = Boolean(districtName);
    clearSelectedCityMarker();
    clearSelectedDistrictLayer();
    clearDigitalTwinComparisonLayers();
    clearDigitalTwinSelection(
        "Select a city and load its forecast baseline.",
        districtName
            ? `${currentStateName} / ${districtName}`
            : currentStateName
    );
    renderClimateRiskPanels(
        null,
        districtName
            ? `${currentStateName} / ${districtName}`
            : currentStateName,
        districtName
            ? "Choose a city or town to run a location-specific forecast."
            : "Select a district to continue."
    );
    cityLoadRequestId += 1;
    citySelectionRequestId += 1;

    resetSelect(
        citySelect,
        districtName ? "Loading cities and urban local bodies..." : "Select City / Town"
    );

    if (!districtName) {
        if (districtBoundaryLayer) {
            climateMap.fitBounds(districtBoundaryLayer.getBounds(), {
                animate: false
            });
        }
        updateLocationInfo(
            currentStateName || "India",
            currentStateName ? "Select a district" : "Select a state or UT"
        );
        return;
    }

    const feature = currentDistrictData.find(
        item => getDistrictName(item.properties) === districtName
    );

    if (feature) {
        selectedDistrictLayer = L.geoJSON(feature, {
            style: {
                color: "#ffbd59",
                weight: 3,
                fillColor: "#ffbd59",
                fillOpacity: 0.25
            }
        }).addTo(climateMap);

        climateMap.fitBounds(selectedDistrictLayer.getBounds(), {
            animate: false
        });
    }

    updateLocationInfo(
        currentStateName + " / " + districtName,
        "District selected"
    );

    loadCitiesForDistrict(districtName, districtCode);
}


// Load cities and urban local bodies from the local LGD-derived dataset.
async function loadCitiesForDistrict(districtName, districtCode) {
    if (!citySelect) return;

    const requestId = ++cityLoadRequestId;
    citySelect.disabled = true;
    citySelect.innerHTML =
        '<option value="">Loading cities and urban local bodies...</option>';

    try {
        const data = await loadUrbanLocalBodyData();
        const selectedState = indiaStates.find(
            state => state.name === currentStateName
        );
        const lgdState = findLgdState(selectedState);
        if (!lgdState) {
            throw new Error("The selected state has no LGD code in the local dataset");
        }
        if (requestId !== cityLoadRequestId) return;

        const uniqueCities = new Map(
            data.urbanLocalBodies
                .filter(city =>
                    city.stateCode === lgdState.code &&
                    city.districtMappings.some(
                        district =>
                            (districtCode && district.code === districtCode) ||
                            matchesAdministrativeName(
                                district.name,
                                districtName
                            )
                    ) &&
                    typeof city.code === "string" &&
                    typeof city.name === "string" &&
                    city.name.trim()
                )
                .map(city => [city.code, city])
        );

        const sortedCities = [
            ...uniqueCities.values()
        ].sort((a, b) => a.name.localeCompare(b.name, "en-IN"));

        citySelect.innerHTML = '<option value="">Select City / Town</option>';

        sortedCities.forEach(city => {
            const option = document.createElement("option");
            option.value = city.code;
            option.textContent = city.type
                ? `${city.name} — ${city.type}`
                : city.name;
            option.dataset.cityName = city.name;
            option.dataset.districtName = districtName;
            if (city.type) option.dataset.cityType = city.type;
            if (city.coordinateSource?.url) {
                option.dataset.coordinateSource = city.coordinateSource.url;
            }

            const hasCoordinates =
                (typeof city.latitude === "number" ||
                    (typeof city.latitude === "string" &&
                        city.latitude.trim() !== "")) &&
                (typeof city.longitude === "number" ||
                    (typeof city.longitude === "string" &&
                        city.longitude.trim() !== ""));
            const latitude = Number(city.latitude);
            const longitude = Number(city.longitude);
            if (
                hasCoordinates &&
                Number.isFinite(latitude) &&
                Number.isFinite(longitude) &&
                latitude >= -90 &&
                latitude <= 90 &&
                longitude >= -180 &&
                longitude <= 180
            ) {
                option.dataset.lat = String(latitude);
                option.dataset.lon = String(longitude);
            }
            citySelect.appendChild(option);
        });

        if (sortedCities.length === 0) {
            citySelect.innerHTML =
                '<option value="">No urban local bodies with verified district mappings are listed for this district</option>';
        }

        citySelect.disabled = sortedCities.length === 0;

    } catch (error) {
        if (requestId !== cityLoadRequestId) return;

        console.error("Local urban local body data error:", error);

        citySelect.innerHTML = "";
        const errorOption = document.createElement("option");
        errorOption.value = "";
        errorOption.textContent =
            error.message || "City data unavailable. Check your connection and try again.";
        citySelect.appendChild(errorOption);

        citySelect.disabled = true;
    }
}


// City selection

async function handleCityChange() {
    const option = citySelect.options[citySelect.selectedIndex];
    if (!option) return;

    const requestId = ++citySelectionRequestId;
    const cityName = option.dataset.cityName || option.textContent;
    const districtName =
        option.dataset.districtName ||
        districtSelect.options[districtSelect.selectedIndex]?.dataset.mapName ||
        districtSelect.value;
    const locationName = [
        currentStateName,
        districtName,
        option.value ? cityName : ""
    ].filter(Boolean).join(" / ");
    clearDigitalTwinComparisonLayers();
    clearDigitalTwinSelection(
        option.value
            ? "Loading the selected city's weather forecast baseline..."
            : "Select a city and load its forecast baseline.",
        locationName
    );

    if (!option.value) {
        clearSelectedCityMarker();
        if (selectedDistrictLayer) {
            climateMap.fitBounds(selectedDistrictLayer.getBounds(), {
                animate: false
            });
        }
        updateLocationInfo(locationName, "Select a city or town");
        renderClimateRiskPanels(
            null,
            locationName,
            "Choose a city or town to run a location-specific forecast."
        );
        return;
    }

    mapLocationSelectionMade = true;
    clearSelectedCityMarker();
    renderClimateRiskPanels(
        null,
        locationName,
        "Resolving verified city coordinates before requesting climate analysis..."
    );

    if (!climateMap) {
        if (mapRiskLevel) mapRiskLevel.textContent = "Map unavailable";
        showMapMessage("The map is not ready; the selected city location was not changed.");
        return;
    }

    let coordinates = getValidCoordinates(option.dataset.lat, option.dataset.lon);
    let coordinateSource = option.dataset.coordinateSource || "local dataset";
    if (!coordinates) {
        climateMap.stop();
        if (selectedDistrictLayer) {
            climateMap.fitBounds(selectedDistrictLayer.getBounds(), {
                animate: false
            });
        }
        updateLocationInfo(locationName, "Looking up city coordinates...");
        showMapMessage(
            "Looking up a matching city, district and state in OpenStreetMap. " +
            "The map will move only if the result is verified."
        );

        try {
            const result = await geocodeUrbanLocalBody(
                cityName,
                districtName,
                currentStateName,
                option.value
            );
            if (requestId !== citySelectionRequestId) return;

            if (!result) {
                if (mapRiskLevel) mapRiskLevel.textContent = "Location not found";
                clearDigitalTwinSelection(
                    "No exact city, district and state match was verified; baseline weather is unavailable.",
                    locationName
                );
                renderClimateRiskPanels(
                    null,
                    locationName,
                    "No exact city, district and state match was verified; climate-risk analysis was not requested."
                );
                showMapMessage(
                    `No verified OpenStreetMap location was found for ${cityName}, ` +
                    `${districtName}, ${currentStateName}. The map was not moved.`
                );
                return;
            }

            coordinates = { latitude: result.latitude, longitude: result.longitude };
            coordinateSource = result.sourceUrl;
            option.dataset.lat = String(result.latitude);
            option.dataset.lon = String(result.longitude);
            option.dataset.coordinateSource = result.sourceUrl;
        } catch (error) {
            if (requestId !== citySelectionRequestId) return;

            console.error("City coordinate lookup failed:", error);
            if (mapRiskLevel) mapRiskLevel.textContent = "Coordinate lookup failed";
            clearDigitalTwinSelection(
                "City coordinates could not be verified; baseline weather is unavailable.",
                locationName
            );
            renderClimateRiskPanels(
                null,
                locationName,
                "City coordinates could not be verified; climate-risk analysis was not requested."
            );
            showMapMessage(
                "City coordinates could not be retrieved. Check your connection and " +
                "try again; the map was not moved to an unverified location."
            );
            return;
        }
    }

    if (requestId !== citySelectionRequestId) return;
    updateLocationInfo(locationName, "Urban local body selected");
    climateMap.stop();
    climateMap.setView(
        [coordinates.latitude, coordinates.longitude],
        12,
        { animate: false }
    );
    selectedCityMarker = L.marker([
        coordinates.latitude,
        coordinates.longitude
    ])
        .addTo(climateMap)
        .bindPopup(
            `<strong>${escapeHtml(cityName)}</strong><br>` +
            `${escapeHtml(districtName)}, ${escapeHtml(currentStateName)}<br>` +
            `<a href="${escapeHtml(coordinateSource)}" target="_blank" rel="noopener noreferrer">` +
            "OpenStreetMap source</a>",
            { autoPan: false }
        )
        .openPopup();

    showMapMessage(
        `Location verified using ${coordinateSource}. ` +
        `Coordinates: ${coordinates.latitude}, ${coordinates.longitude}.`
    );
    renderClimateRiskPanels(
        null,
        locationName,
        "Location verified. Fetching the seven-day weather forecast and model estimates..."
    );
    loadClimateRiskPrediction(
        requestId,
        cityName,
        districtName,
        currentStateName,
        coordinates
    );
}


async function loadClimateRiskPrediction(
    requestId,
    cityName,
    districtName,
    stateName,
    coordinates
) {
    try {
        const response = await fetch(getClimateRiskApiUrl(), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                city: cityName,
                district: districtName,
                state: stateName,
                latitude: coordinates.latitude,
                longitude: coordinates.longitude
            })
        });
        const contentType = response.headers.get("content-type") || "";
        const rawBody = await response.text();
        let result;
        try {
            if (!rawBody.trim()) {
                throw new Error("The response body was empty.");
            }
            result = JSON.parse(rawBody);
        } catch (error) {
            const responseType = contentType || "no Content-Type";
            const bodyStatus = rawBody.trim()
                ? "contained invalid JSON"
                : "was empty";
            throw new Error(
                `Climate API returned HTTP ${response.status} with ${responseType}; ` +
                `the response ${bodyStatus}. Check that the Flask backend is running at ` +
                "http://127.0.0.1:5000."
            );
        }

        if (!contentType.toLowerCase().includes("application/json")) {
            throw new Error(
                `Climate API returned HTTP ${response.status} with unexpected ` +
                `Content-Type "${contentType || "missing"}"; expected application/json.`
            );
        }
        if (!response.ok) {
            const apiMessage =
                result && typeof result.error === "string" ? result.error : "";
            throw new Error(
                apiMessage ||
                `Climate API returned HTTP ${response.status} without an error message.`
            );
        }
        if (
            !result ||
            typeof result !== "object" ||
            !result.risks ||
            !result.overall ||
            !result.model ||
            !Array.isArray(result.forecast_dates)
        ) {
            throw new Error(
                "Climate API returned JSON, but it did not include the expected risk forecast fields."
            );
        }
        if (requestId !== citySelectionRequestId) return;

        const locationName = [stateName, districtName, cityName].join(" / ");
        digitalTwinSelection = {
            location: { state: stateName, district: districtName, city: cityName },
            coordinates,
            baseline: result.baseline_weather
                ? Object.freeze({ ...result.baseline_weather })
                : null,
            locationName
        };
        setDigitalTwinBaseline(digitalTwinSelection);
        renderClimateRiskPanels(
            result,
            locationName,
            "Model estimates for the seven-day forecast are ready."
        );

        if (selectedRiskLayer) {
            climateMap.removeLayer(selectedRiskLayer);
        }
        const riskColor = riskColorFor(result.overall.classification);
        selectedRiskLayer = L.circle(
            [coordinates.latitude, coordinates.longitude],
            {
                radius: 12000,
                color: riskColor,
                fillColor: riskColor,
                fillOpacity: 0.18,
                weight: 2
            }
        ).addTo(climateMap);
        selectedRiskLayer.bindTooltip(
            `Overall weather-trigger risk: ${result.overall.risk_percent}% ` +
            `(${result.overall.classification})`
        );
        selectedCityMarker.setPopupContent(
            `<strong>${escapeHtml(cityName)}</strong><br>` +
            `${escapeHtml(districtName)}, ${escapeHtml(stateName)}<br>` +
            `Overall climate risk: ${result.overall.risk_percent}% ` +
            `(${escapeHtml(result.overall.classification)})<br>` +
            `<a href="${escapeHtml(result.data_attribution_url || "https://open-meteo.com/")}" ` +
            'target="_blank" rel="noopener noreferrer">Weather data source</a>'
        );
        if (mapRiskLevel) {
            mapRiskLevel.textContent =
                `${result.overall.risk_percent}% — ${result.overall.classification}`;
        }
        showMapMessage(
            `${result.model.forecast_period} • ${result.data_attribution}`
        );
    } catch (error) {
        if (requestId !== citySelectionRequestId) return;

        console.error("Climate risk prediction failed:", error);
        const errorMessage = error instanceof TypeError
            ? `Could not connect to the Flask climate-risk API at ${getClimateRiskApiUrl()}. ` +
                "Check that the backend is running and accessible."
            : error.message || "Climate risk prediction is unavailable.";
        renderClimateRiskPanels(
            null,
            [stateName, districtName, cityName].join(" / "),
            errorMessage
        );
        clearDigitalTwinSelection(
            `Baseline forecast unavailable: ${errorMessage}`,
            [stateName, districtName, cityName].join(" / ")
        );
        if (mapRiskLevel) mapRiskLevel.textContent = "Prediction unavailable";
        showMapMessage(
            "The verified city location is shown, but climate-risk estimates are unavailable. " +
            "Start the backend and train the model; no scores have been fabricated."
        );
    }
}


function renderClimateRiskPanels(result, location, status) {
    updateDashboardRiskSummary(result, location);
    const panels = document.querySelectorAll(".climate-risk-analysis");
    const risks = result
        ? {
            flood: result.risks.flood,
            heatwave: result.risks.heatwave,
            cyclone: result.risks.cyclone,
            overall: {
                name: "Overall Climate Risk",
                risk_percent: result.overall.risk_percent,
                classification: result.overall.classification,
                peak_forecast_date: "Highest hazard proxy score"
            }
        }
        : null;

    panels.forEach(panel => {
        const mapPanel = panel.id === "mapRiskPanel";
        if (!result) {
            panel.innerHTML =
                `<h3>${mapPanel ? "Selected City Risk" : "Selected Location Climate Risk"}</h3>` +
                `<p class="risk-analysis-location">${escapeHtml(location || "No city selected")}</p>` +
                `<p class="risk-empty-state">${escapeHtml(status)}</p>`;
            return;
        }

        const cards = Object.keys(risks).map(key => {
            const risk = risks[key];
            const hasScore =
                risk.risk_percent !== null &&
                Number.isFinite(Number(risk.risk_percent));
            const percentage = hasScore
                ? Math.max(0, Math.min(100, Number(risk.risk_percent)))
                : 0;
            const classification = String(risk.classification || "Unavailable");
            const tone = classification.toLowerCase().replace(/\s+/g, "-");
            return (
                `<article class="risk-score-card risk-${escapeHtml(tone)}">` +
                    `<div class="risk-score-heading">` +
                        `<span>${escapeHtml(risk.name)}</span>` +
                        `<span class="risk-score-value">${hasScore ? `${percentage}%` : "N/A"}</span>` +
                    `</div>` +
                    `<div class="risk-score-meter" role="progressbar" ` +
                        `aria-valuemin="0" aria-valuemax="100" ` +
                        `${hasScore ? `aria-valuenow="${percentage}"` : 'aria-valuetext="Not validated"'} ` +
                        `aria-label="${escapeHtml(risk.name)}">` +
                        `<div class="risk-score-meter-fill" style="width:${percentage}%"></div>` +
                    `</div>` +
                    `<span class="risk-score-classification">${escapeHtml(classification)}</span>` +
                    `<small class="risk-score-date">${escapeHtml(risk.peak_forecast_date || risk.score_scope || "")}</small>` +
                `</article>`
            );
        }).join("");

        const factors = result.factors.map(factor =>
            `<li>${escapeHtml(factor.name)}: ${escapeHtml(factor.value)} ` +
            `${escapeHtml(factor.unit)} (${escapeHtml(factor.date)})</li>`
        ).join("");
        const recommendations = result.recommendations.map(item =>
            `<li>${escapeHtml(item)}</li>`
        ).join("");
        const trainingMetrics = Object.entries(
            result.model.test_metrics || {}
        ).map(([name, metric]) =>
            metric.validated
                ? `${escapeHtml(name)} proxy-label holdout F1: ` +
                    `${Math.round(metric.f1 * 100)}%`
                : `${escapeHtml(name)}: no numeric score; only ` +
                    `${metric.positive_test_samples} positive holdout examples`
        ).join(" • ");

        panel.innerHTML =
            `<div class="panel-header"><div>` +
                `<h3>Seven-Day Climate Risk Analysis</h3>` +
                `<p>${escapeHtml(status)}</p>` +
            `</div></div>` +
            `<p class="risk-analysis-location">${escapeHtml(location)}</p>` +
            `<p class="risk-analysis-status">` +
                `${escapeHtml(result.model.algorithm)} • ` +
                `${escapeHtml(result.model.forecast_period)} • ` +
                `Updated ${escapeHtml(result.generated_at)}` +
            `</p>` +
            `<div class="risk-score-grid">${cards}</div>` +
            `<p class="risk-overall"><strong>Overall:</strong> ` +
                `${result.overall.risk_percent}% — ` +
                `${escapeHtml(result.overall.classification)}. ` +
                `${escapeHtml(result.overall.basis)}` +
            `</p>` +
            `<div class="risk-details-grid">` +
                `<div><h4>Forecast factors</h4><ul class="risk-detail-list">${factors}</ul></div>` +
                `<div><h4>Safety guidance</h4><ul class="risk-detail-list">${recommendations}</ul></div>` +
            `</div>` +
            `<p class="risk-analysis-disclaimer">` +
                `${escapeHtml(result.model.risk_score_interpretation)} ` +
                `Flood is a heavy-rainfall proxy; cyclone is a local wind proxy. ` +
                `Percentages are uncalibrated classifier scores, not calibrated event probabilities or official warnings. ` +
                `Holdout metrics only measure reproduction of the proxy labels. ` +
                `Population density and verified impact labels were unavailable. ` +
                `${escapeHtml(trainingMetrics)}. ` +
                `<a href="https://open-meteo.com/en/terms" target="_blank" rel="noopener noreferrer">` +
                `Open-Meteo attribution and data terms</a>. Consult official IMD and local advisories.` +
            `</p>`;
    });
}

function updateDashboardRiskSummary(result, location) {
    const summaries = [
        {
            risk: result && result.risks.flood,
            score: document.getElementById("dashboardFloodRiskScore"),
            context: document.getElementById("dashboardFloodRiskContext")
        },
        {
            risk: result && result.risks.heatwave,
            score: document.getElementById("dashboardHeatRiskScore"),
            context: document.getElementById("dashboardHeatRiskContext")
        }
    ];

    summaries.forEach(summary => {
        if (!summary.score || !summary.context) return;
        if (!summary.risk) {
            summary.score.textContent = "—";
            summary.score.className = "";
            summary.context.textContent = location
                ? `Waiting for a verified forecast • ${location}`
                : "Select a city for a live forecast";
            return;
        }

        const hasScore =
            summary.risk.risk_percent !== null &&
            Number.isFinite(Number(summary.risk.risk_percent));
        summary.score.textContent = hasScore
            ? `${summary.risk.classification} · ${summary.risk.risk_percent}%`
            : "N/A";
        summary.score.className = {
            Low: "low-text",
            Moderate: "moderate-text",
            High: "warning-text",
            "Very High": "very-high-text"
        }[summary.risk.classification] || "";
        summary.context.textContent =
            `Seven-day model score • ${location || "selected location"}`;
    });
}

const DIGITAL_TWIN_CONTROLS = [
    {
        id: "twinRainfall",
        outputId: "twinRainfallValue",
        feature: "precipitation_sum_mm",
        label: "Rainfall",
        unit: "mm",
        min: 0,
        max: 300
    },
    {
        id: "twinTemperature",
        outputId: "twinTemperatureValue",
        feature: "temperature_2m_max_c",
        label: "Temperature",
        unit: "°C",
        min: 0,
        max: 50
    },
    {
        id: "twinWind",
        outputId: "twinWindValue",
        feature: "wind_speed_10m_max_kmh",
        label: "Wind speed",
        unit: "km/h",
        min: 0,
        max: 150
    },
    {
        id: "twinHumidity",
        outputId: "twinHumidityValue",
        feature: "relative_humidity_2m_mean_pct",
        label: "Relative humidity",
        unit: "%",
        min: 0,
        max: 100
    }
];

function setupDigitalTwinControls() {
    DIGITAL_TWIN_CONTROLS.forEach(control => {
        const input = document.getElementById(control.id);
        const output = document.getElementById(control.outputId);
        if (!input || !output) return;
        input.min = String(control.min);
        input.max = String(control.max);
        input.addEventListener("input", () => {
            output.textContent = `${input.value} ${control.unit}`;
            document.getElementById("twinResults").hidden = true;
            clearDigitalTwinTrainingWarnings();
            clearDigitalTwinComparisonLayers();
            document.getElementById("twinSimulationStatus").textContent =
                "Scenario inputs changed. Run the simulation to refresh model scores.";
        });
    });

    document.getElementById("runTwinSimulation")?.addEventListener(
        "click",
        runDigitalTwinSimulation
    );
    document.getElementById("resetTwinScenario")?.addEventListener(
        "click",
        resetDigitalTwinScenario
    );
}

function clearDigitalTwinSelection(status, locationName) {
    digitalTwinSelection = null;
    digitalTwinSimulationRequestId += 1;
    clearDigitalTwinResults();
    document.getElementById("twinLocation").textContent =
        locationName || "No city selected";
    document.getElementById("twinBaselineStatus").textContent =
        "Baseline is populated from the selected city's seven-day forecast.";
    document.getElementById("twinBaselineDate").textContent =
        "No forecast baseline";
    document.getElementById("twinWeatherReadout").innerHTML =
        `<p>${escapeHtml(status || "Select a city and load its baseline forecast.")}</p>`;
    document.getElementById("twinSimulationStatus").textContent =
        status || "Select a city and load its baseline forecast first.";
    clearDigitalTwinTrainingWarnings();
    clearDigitalTwinComparisonLayers();
    DIGITAL_TWIN_CONTROLS.forEach(control => {
        const input = document.getElementById(control.id);
        const output = document.getElementById(control.outputId);
        if (input) {
            input.disabled = true;
            input.value = "0";
        }
        if (output) output.textContent = `— ${control.unit}`;
    });
    document.getElementById("runTwinSimulation").disabled = true;
    document.getElementById("resetTwinScenario").disabled = true;
}

function setDigitalTwinBaseline(selection) {
    const baseline = selection.baseline;
    const hasBaseline = baseline &&
        DIGITAL_TWIN_CONTROLS.every(control =>
            Number.isFinite(Number(baseline[control.feature]))
        ) &&
        Number.isFinite(Number(baseline.elevation_m));
    document.getElementById("twinLocation").textContent =
        selection.locationName;
    if (!hasBaseline) {
        clearDigitalTwinSelection(
            "The climate API did not return valid baseline forecast weather; " +
            "simulation is unavailable until a forecast succeeds.",
            selection.locationName
        );
        return;
    }

    document.getElementById("twinBaselineStatus").textContent =
        "Observed baseline inputs are forecast values from Open-Meteo; elevation is retained from the forecast grid.";
    document.getElementById("twinBaselineDate").textContent =
        `Forecast baseline • ${baseline.date || "date unavailable"}`;
    document.getElementById("twinWeatherReadout").innerHTML =
        `<div><span>Rainfall</span><strong>${Number(baseline.precipitation_sum_mm)} mm</strong></div>` +
        `<div><span>Temperature</span><strong>${Number(baseline.temperature_2m_max_c)} °C</strong></div>` +
        `<div><span>Wind speed</span><strong>${Number(baseline.wind_speed_10m_max_kmh)} km/h</strong></div>` +
        `<div><span>Relative humidity</span><strong>${Number(baseline.relative_humidity_2m_mean_pct)}%</strong></div>` +
        `<div><span>Elevation (fixed)</span><strong>${Number(baseline.elevation_m)} m</strong></div>`;

    DIGITAL_TWIN_CONTROLS.forEach(control => {
        const input = document.getElementById(control.id);
        const output = document.getElementById(control.outputId);
        input.value = String(Number(baseline[control.feature]));
        input.disabled = false;
        output.textContent = `${input.value} ${control.unit}`;
    });
    clearDigitalTwinTrainingWarnings();
    document.getElementById("twinSimulationStatus").textContent =
        getScenarioRangeIssues(baseline).length
            ? "Forecast baseline restored exactly. Adjust values outside the supported scenario ranges before running."
            : "Scenario reset to the original forecast values. Run the simulation when ready.";
    document.getElementById("runTwinSimulation").disabled = false;
    document.getElementById("resetTwinScenario").disabled = false;
    clearDigitalTwinResults();
}

function resetDigitalTwinScenario() {
    if (!digitalTwinSelection || !digitalTwinSelection.baseline) return;
    digitalTwinSimulationRequestId += 1;
    setDigitalTwinBaseline(digitalTwinSelection);
    clearDigitalTwinComparisonLayers();
    document.getElementById("runTwinSimulation").disabled = false;
}

function clearDigitalTwinResults() {
    document.getElementById("twinResults").hidden = true;
    document.getElementById("twinResultLocation").textContent = "";
    document.getElementById("twinRiskComparisons").replaceChildren();
    document.getElementById("twinWeatherComparison").replaceChildren();
    document.getElementById("twinInterpretation").textContent = "";
}

function getScenarioRangeIssues(values) {
    return DIGITAL_TWIN_CONTROLS.filter(control => {
        const value = Number(values[control.feature]);
        return (
            !Number.isFinite(value) ||
            value < control.min ||
            value > control.max
        );
    });
}

function clearDigitalTwinTrainingWarnings() {
    const warning = document.getElementById("twinTrainingWarnings");
    warning.hidden = true;
    warning.replaceChildren();
}

function renderDigitalTwinTrainingWarnings(warnings) {
    const container = document.getElementById("twinTrainingWarnings");
    container.replaceChildren();
    if (!warnings.length) {
        container.hidden = true;
        return;
    }

    const heading = document.createElement("strong");
    heading.textContent =
        "Training-range warning: these scenario inputs are outside the actual model training data range. Scores may be unreliable.";
    const list = document.createElement("ul");
    warnings.forEach(warning => {
        const item = document.createElement("li");
        item.textContent = warning.message;
        list.append(item);
    });
    container.append(heading, list);
    container.hidden = false;
}

async function runDigitalTwinSimulation() {
    if (!digitalTwinSelection || !digitalTwinSelection.baseline) {
        document.getElementById("twinSimulationStatus").textContent =
            "Simulation unavailable: select a city and load valid forecast baseline data.";
        return;
    }

    const selection = digitalTwinSelection;
    const requestId = ++digitalTwinSimulationRequestId;
    const scenario = {};
    let validationError = "";
    DIGITAL_TWIN_CONTROLS.forEach(control => {
        const input = document.getElementById(control.id);
        const value = input.valueAsNumber;
        if (
            !Number.isFinite(value) ||
            value < control.min ||
            value > control.max
        ) {
            validationError =
                `${control.label} must be between ${control.min} and ` +
                `${control.max} ${control.unit}.`;
            return;
        }
        scenario[control.feature] = value;
    });
    if (validationError) {
        document.getElementById("twinResults").hidden = true;
        clearDigitalTwinTrainingWarnings();
        document.getElementById("twinSimulationStatus").textContent =
            validationError;
        return;
    }
    const button = document.getElementById("runTwinSimulation");
    button.disabled = true;
    DIGITAL_TWIN_CONTROLS.forEach(control => {
        document.getElementById(control.id).disabled = true;
    });
    document.getElementById("twinResults").hidden = true;
    clearDigitalTwinTrainingWarnings();
    clearDigitalTwinComparisonLayers();
    document.getElementById("twinSimulationStatus").textContent =
        "Running baseline and scenario inputs through the existing Random Forest models...";

    try {
        const response = await fetch(getDigitalTwinApiUrl(), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                location: selection.location,
                coordinates: selection.coordinates,
                baseline: selection.baseline,
                scenario
            })
        });
        const contentType = response.headers.get("content-type") || "";
        const rawBody = await response.text();
        let result;
        try {
            if (!rawBody.trim()) throw new Error("Empty response body");
            result = JSON.parse(rawBody);
        } catch (error) {
            throw new Error(
                `Simulation API returned HTTP ${response.status} with ` +
                `${contentType || "no Content-Type"} and an empty or invalid JSON body.`
            );
        }
        if (!contentType.toLowerCase().includes("application/json")) {
            throw new Error(
                `Simulation API returned unexpected Content-Type "${contentType}".`
            );
        }
        if (!response.ok) {
            throw new Error(
                result.error || `Simulation API returned HTTP ${response.status}.`
            );
        }
        if (requestId !== digitalTwinSimulationRequestId) return;
        validateDigitalTwinResponse(result, selection, scenario);

        renderDigitalTwinResults(result);
        document.getElementById("twinSimulationStatus").textContent =
            "Simulation complete. Scores are existing-model outputs for the supplied weather inputs.";
        showDigitalTwinComparisonOnMap(result, selection.coordinates);
    } catch (error) {
        if (requestId !== digitalTwinSimulationRequestId) return;
        console.error("Digital Twin simulation failed:", error);
        document.getElementById("twinSimulationStatus").textContent =
            error instanceof TypeError
                ? `Could not connect to ${getDigitalTwinApiUrl()}. Check that Flask is running.`
                : error.message || "Digital Twin simulation failed.";
        document.getElementById("twinResults").hidden = true;
    } finally {
        if (requestId === digitalTwinSimulationRequestId && digitalTwinSelection) {
            button.disabled = false;
            DIGITAL_TWIN_CONTROLS.forEach(control => {
                document.getElementById(control.id).disabled = false;
            });
        }
    }
}

function validateDigitalTwinResponse(result, selection, scenario) {
    const closeEnough = (left, right) =>
        Number.isFinite(Number(left)) &&
        Number.isFinite(Number(right)) &&
        Math.abs(Number(left) - Number(right)) < 0.000001;
    if (
        !result ||
        typeof result !== "object" ||
        !result.location ||
        !result.baseline ||
        !result.scenario ||
        !result.comparison ||
        !result.training_feature_ranges ||
        !result.model ||
        typeof result.score_type !== "string" ||
        typeof result.interpretation !== "string" ||
        !Array.isArray(result.training_range_warnings)
    ) {
        throw new Error(
            "Simulation API response is missing required model, baseline, scenario or training-range fields."
        );
    }

    const trainingFeatures = [
        ...DIGITAL_TWIN_CONTROLS.map(control => control.feature),
        "elevation_m"
    ];
    const warningByFeature = new Map(
        result.training_range_warnings.map(warning => [
            warning && warning.feature,
            warning
        ])
    );
    trainingFeatures.forEach(feature => {
        const range = result.training_feature_ranges[feature];
        if (
            !range ||
            !Number.isFinite(Number(range.min)) ||
            !Number.isFinite(Number(range.max)) ||
            Number(range.min) > Number(range.max) ||
            typeof range.unit !== "string"
        ) {
            throw new Error(
                `Simulation API returned an invalid training range for ${feature}.`
            );
        }
        const value = Number(
            feature === "elevation_m"
                ? selection.baseline.elevation_m
                : scenario[feature]
        );
        const outOfRange = value < Number(range.min) ||
            value > Number(range.max);
        const warning = warningByFeature.get(feature);
        if (
            (outOfRange && (!warning || typeof warning.message !== "string")) ||
            (!outOfRange && warning)
        ) {
            throw new Error(
                `Simulation API returned an inconsistent training-range warning for ${feature}.`
            );
        }
    });

    DIGITAL_TWIN_CONTROLS.forEach(control => {
        if (
            !closeEnough(
                result.baseline[control.feature],
                selection.baseline[control.feature]
            ) ||
            !closeEnough(
                result.scenario[control.feature],
                scenario[control.feature]
            )
        ) {
            throw new Error(
                `Simulation API changed the submitted ${control.label.toLowerCase()} inputs.`
            );
        }
    });
    if (
        !closeEnough(result.baseline.elevation_m, selection.baseline.elevation_m) ||
        !closeEnough(result.scenario.elevation_m, selection.baseline.elevation_m)
    ) {
        throw new Error(
            "Simulation API changed the fixed baseline elevation."
        );
    }

    ["flood", "heatwave", "cyclone"].forEach(hazard => {
        const comparison = result.comparison[hazard];
        if (!comparison || !comparison.baseline || !comparison.scenario) {
            throw new Error(
                `Simulation API response is missing ${hazard} predictions.`
            );
        }
        [comparison.baseline, comparison.scenario].forEach(risk => {
            if (
                typeof risk.classification !== "string" ||
                !(
                    risk.risk_percent === null ||
                    (
                        Number.isFinite(Number(risk.risk_percent)) &&
                        Number(risk.risk_percent) >= 0 &&
                        Number(risk.risk_percent) <= 100
                    )
                )
            ) {
                throw new Error(
                    `Simulation API returned an invalid ${hazard} prediction.`
                );
            }
        });
        if (
            comparison.baseline.risk_percent === null ||
            comparison.scenario.risk_percent === null
        ) {
            if (
                comparison.score_change !== null ||
                comparison.change !== "Not validated"
            ) {
                throw new Error(
                    `Simulation API returned inconsistent ${hazard} validation status.`
                );
            }
            return;
        }

        const expectedDelta = Math.round((
            Number(comparison.scenario.risk_percent) -
            Number(comparison.baseline.risk_percent)
        ) * 100) / 100;
        const expectedChange = expectedDelta > 0
            ? "Increased"
            : expectedDelta < 0
                ? "Decreased"
                : "Unchanged";
        if (
            !closeEnough(comparison.score_change, expectedDelta) ||
            comparison.change !== expectedChange
        ) {
            throw new Error(
                `Simulation API returned an inconsistent ${hazard} score comparison.`
            );
        }
    });
}

function renderDigitalTwinResults(result) {
    const resultLocation = [
        result.location.state,
        result.location.district,
        result.location.city
    ].join(" / ");
    document.getElementById("twinResultLocation").textContent = resultLocation;
    document.getElementById("twinRiskComparisons").innerHTML =
        Object.entries(result.comparison).map(([hazard, comparison]) => {
            const baseline = comparison.baseline;
            const scenario = comparison.scenario;
            const valid = baseline.risk_percent !== null &&
                scenario.risk_percent !== null;
            const changeClass = comparison.change.toLowerCase();
            const deltaText = valid
                ? `${comparison.score_change > 0 ? "+" : ""}${comparison.score_change} percentage points`
                : "Not validated";
            return (
                `<article class="twin-risk-card twin-change-${escapeHtml(changeClass)}">` +
                    `<h4>${escapeHtml(baseline.name)}</h4>` +
                    `<div class="twin-score-pair">` +
                        `<div><span>Baseline</span><strong>${valid ? `${baseline.risk_percent}%` : "N/A"}</strong><small>${escapeHtml(baseline.classification)}</small></div>` +
                        `<div><span>Scenario</span><strong>${valid ? `${scenario.risk_percent}%` : "N/A"}</strong><small>${escapeHtml(scenario.classification)}</small></div>` +
                    `</div>` +
                    `<p class="twin-score-delta">${escapeHtml(comparison.change)} · ${escapeHtml(deltaText)}</p>` +
                `</article>`
            );
        }).join("");

    document.getElementById("twinWeatherComparison").innerHTML =
        DIGITAL_TWIN_CONTROLS.map(control =>
            `<div class="twin-weather-row">` +
                `<span>${escapeHtml(control.label)}</span>` +
                `<strong>${formatTwinValue(result.baseline[control.feature], control.unit)}</strong>` +
                `<span aria-hidden="true">→</span>` +
                `<strong>${formatTwinValue(result.scenario[control.feature], control.unit)}</strong>` +
            `</div>`
        ).join("") +
        `<div class="twin-weather-row twin-elevation-row">` +
            `<span>Elevation (fixed)</span>` +
            `<strong>${formatTwinValue(result.baseline.elevation_m, "m")}</strong>` +
            `<span aria-hidden="true">→</span>` +
            `<strong>${formatTwinValue(result.scenario.elevation_m, "m")}</strong>` +
        `</div>`;
    document.getElementById("twinInterpretation").textContent =
        `${result.score_type} ${result.model}. ${result.interpretation}`;
    renderDigitalTwinTrainingWarnings(result.training_range_warnings);
    document.getElementById("twinResults").hidden = false;
}

function formatTwinValue(value, unit) {
    return `${Number(value).toLocaleString(undefined, {
        maximumFractionDigits: 2
    })} ${unit}`;
}

function showDigitalTwinComparisonOnMap(result, coordinates) {
    if (!climateMap) return;
    clearDigitalTwinComparisonLayers();
    if (selectedRiskLayer) climateMap.removeLayer(selectedRiskLayer);
    selectedRiskLayer = null;

    const validatedScores = ["flood", "heatwave"]
        .map(hazard => result.comparison[hazard].scenario.risk_percent)
        .filter(score => score !== null);
    const peakScore = validatedScores.length
        ? Math.max(...validatedScores)
        : null;
    const scenarioColor = peakScore === null
        ? "#8294a9"
        : riskColorFor(classifyTwinRisk(peakScore));
    const center = [coordinates.latitude, coordinates.longitude];
    digitalTwinBaselineLayer = L.circle(center, {
        radius: 18000,
        color: "#22c5e8",
        fillColor: "#22c5e8",
        fillOpacity: 0.06,
        weight: 3
    }).addTo(climateMap);
    digitalTwinBaselineLayer.bindTooltip(
        `Baseline model scores: Flood ${formatTwinScore(result.comparison.flood.baseline)}; ` +
        `Heat ${formatTwinScore(result.comparison.heatwave.baseline)}`
    );
    digitalTwinScenarioLayer = L.circle(center, {
        radius: 9000,
        color: scenarioColor,
        fillColor: scenarioColor,
        fillOpacity: 0.2,
        weight: 3,
        dashArray: "6 5"
    }).addTo(climateMap);
    digitalTwinScenarioLayer.bindTooltip(
        `Scenario model scores: Flood ${formatTwinScore(result.comparison.flood.scenario)}; ` +
        `Heat ${formatTwinScore(result.comparison.heatwave.scenario)}`
    );
}

function formatTwinScore(risk) {
    return risk.risk_percent === null
        ? "Not validated"
        : `${risk.risk_percent}% ${risk.classification}`;
}

function classifyTwinRisk(score) {
    if (score < 25) return "Low";
    if (score < 50) return "Moderate";
    if (score < 75) return "High";
    return "Very High";
}

function clearDigitalTwinComparisonLayers() {
    if (climateMap && digitalTwinBaselineLayer) {
        climateMap.removeLayer(digitalTwinBaselineLayer);
    }
    if (climateMap && digitalTwinScenarioLayer) {
        climateMap.removeLayer(digitalTwinScenarioLayer);
    }
    digitalTwinBaselineLayer = null;
    digitalTwinScenarioLayer = null;
}

function riskColorFor(classification) {
    return {
        "Low": "#29c99a",
        "Moderate": "#e8c45b",
        "High": "#f39a48",
        "Very High": "#ed6262"
    }[classification] || "#22c5e8";
}


function getValidCoordinates(latitude, longitude) {
    if (
        latitude === undefined ||
        longitude === undefined ||
        latitude === null ||
        longitude === null ||
        latitude === "" ||
        longitude === ""
    ) {
        return null;
    }

    const lat = Number(latitude);
    const lon = Number(longitude);
    if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lon) ||
        lat < -90 ||
        lat > 90 ||
        lon < -180 ||
        lon > 180
    ) {
        return null;
    }

    return { latitude: lat, longitude: lon };
}


function getGeocodingCache() {
    try {
        const cache = JSON.parse(
            localStorage.getItem(GEOCODING_CACHE_KEY) || "{}"
        );
        return cache && typeof cache === "object" ? cache : {};
    } catch (error) {
        console.warn("Could not read the city geocoding cache:", error);
        return {};
    }
}


function getGeocodingCacheKey(cityName, districtName, stateName, cityCode) {
    return [
        cityCode,
        normalizeAdministrativeName(cityName),
        normalizeAdministrativeName(districtName),
        normalizeAdministrativeName(stateName)
    ].join("|");
}


function getVerifiedCachedCoordinates(cacheKey) {
    const cached = getGeocodingCache()[cacheKey];
    if (!cached || !cached.sourceUrl) return null;

    const coordinates = getValidCoordinates(cached.latitude, cached.longitude);
    return coordinates ? { ...coordinates, sourceUrl: cached.sourceUrl } : null;
}


function cacheVerifiedCoordinates(cacheKey, result) {
    const cache = getGeocodingCache();
    cache[cacheKey] = result;
    try {
        localStorage.setItem(GEOCODING_CACHE_KEY, JSON.stringify(cache));
    } catch (error) {
        console.warn("Could not persist the city geocoding cache:", error);
    }
}


function matchesAdministrativeName(actual, expected) {
    const actualName = normalizeAdministrativeName(actual);
    const expectedName = normalizeAdministrativeName(expected);
    return actualName === expectedName ||
        actualName === expectedName + "city" ||
        actualName === expectedName + "district" ||
        actualName === expectedName + "taluk" ||
        actualName === expectedName + "tehsil";
}


function isMatchingGeocodingResult(result, cityName, districtName, stateName) {
    const address = result.address || {};
    const stateMatches = [
        address.state,
        address.state_district,
        address.county
    ].some(value => matchesAdministrativeName(value, stateName));
    const districtMatches = [
        address.state_district,
        address.county,
        address.district,
        address.city_district
    ].some(value => matchesAdministrativeName(value, districtName));

    const searchableCityName = stripUrbanBodyType(cityName);
    return [
        normalizeAdministrativeName(cityName),
        normalizeAdministrativeName(searchableCityName)
    ].includes(normalizeAdministrativeName(result.name)) &&
        stateMatches &&
        districtMatches &&
        getValidCoordinates(result.lat, result.lon) !== null &&
        result.osm_type &&
        result.osm_id;
}

function stripUrbanBodyType(cityName) {
    const types = [
        "Town Municipal Council",
        "City Municipal Council",
        "Municipal Corporation",
        "Municipal Committee",
        "Municipal Council",
        "Municipal Board",
        "Nagar Panchayat",
        "Town Panchayat",
        "Notified Area Council",
        "Notified Area Committee",
        "City Corporation",
        "Town Committee",
        "Town Council",
        "Municipality"
    ];
    let placeName = cityName.trim();
    for (const type of types) {
        const pattern = new RegExp(
            `(?:^\\s*${type}\\s+|\\s+${type}\\s*$)`,
            "i"
        );
        placeName = placeName.replace(pattern, " ").trim();
    }
    return placeName || cityName;
}


function fetchNominatim(url) {
    const request = geocodingQueue.then(async () => {
        const delay = Math.max(
            0,
            GEOCODING_MIN_INTERVAL_MS - (Date.now() - lastGeocodingRequestAt)
        );
        if (delay) {
            await new Promise(resolve => setTimeout(resolve, delay));
        }
        lastGeocodingRequestAt = Date.now();

        const response = await fetch(url, {
            headers: { Accept: "application/json" }
        });
        if (!response.ok) {
            throw new Error(`OpenStreetMap lookup failed (${response.status})`);
        }
        return response.json();
    });

    geocodingQueue = request.catch(() => {});
    return request;
}

function setupGeocodingEndpointSetting() {
    const input = document.getElementById("geocodingEndpoint");
    const saveButton = document.getElementById("saveGeocodingEndpoint");
    if (!input || !saveButton) return;

    input.value = getGeocodingEndpoint();

    saveButton.addEventListener("click", () => {
        let endpoint;
        try {
            endpoint = new URL(input.value.trim());
        } catch (error) {
            showMapMessage("Enter a valid geocoding service URL.");
            return;
        }

        const isLocalDevelopmentHost =
            endpoint.hostname === "localhost" ||
            endpoint.hostname === "127.0.0.1";
        if (
            endpoint.protocol !== "https:" &&
            !(isLocalDevelopmentHost && endpoint.protocol === "http:")
        ) {
            showMapMessage("The geocoding service URL must use HTTPS.");
            return;
        }

        try {
            localStorage.setItem(
                GEOCODING_ENDPOINT_KEY,
                endpoint.toString().replace(/\/+$/, "")
            );
            showMapMessage(
                "Geocoding service saved. New lookups will use this endpoint; " +
                "verified cached coordinates are retained."
            );
        } catch (error) {
            console.error("Could not save the geocoding service:", error);
            showMapMessage(
                "The geocoding service could not be saved in this browser."
            );
        }
    });
}

function getGeocodingEndpoint() {
    try {
        return localStorage.getItem(GEOCODING_ENDPOINT_KEY) ||
            NOMINATIM_SEARCH_URL;
    } catch (error) {
        console.warn("Could not read the configured geocoding service:", error);
        return NOMINATIM_SEARCH_URL;
    }
}


async function geocodeUrbanLocalBody(cityName, districtName, stateName, cityCode) {
    const cacheKey = getGeocodingCacheKey(
        cityName,
        districtName,
        stateName,
        cityCode
    );
    const cached = getVerifiedCachedCoordinates(cacheKey);
    if (cached) return cached;

    const query = new URLSearchParams({
        city: stripUrbanBodyType(cityName),
        county: districtName,
        state: stateName,
        country: "India",
        format: "jsonv2",
        addressdetails: "1",
        limit: "5"
    });
    const endpoint = getGeocodingEndpoint();
    const usesPublicNominatim =
        new URL(endpoint).origin === new URL(NOMINATIM_SEARCH_URL).origin &&
        new URL(endpoint).pathname === new URL(NOMINATIM_SEARCH_URL).pathname;
    const lookupUrl = usesPublicNominatim
        ? `${getGeocodingApiUrl()}?${query.toString()}`
        : `${endpoint}?${query.toString()}`;
    const results = await fetchNominatim(lookupUrl);
    if (!Array.isArray(results)) {
        throw new Error("OpenStreetMap returned an invalid geocoding response");
    }

    const match = results.find(result =>
        isMatchingGeocodingResult(result, cityName, districtName, stateName)
    );
    if (!match) return null;

    const { latitude, longitude } = getValidCoordinates(match.lat, match.lon);
    const result = {
        latitude,
        longitude,
        sourceUrl: `https://www.openstreetmap.org/${match.osm_type}/${match.osm_id}`,
        cachedAt: new Date().toISOString()
    };
    cacheVerifiedCoordinates(cacheKey, result);
    return result;
}


function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}


function clearSelectedCityMarker() {
    if (selectedCityMarker && climateMap) {
        climateMap.removeLayer(selectedCityMarker);
    }
    selectedCityMarker = null;
    if (selectedRiskLayer && climateMap) {
        climateMap.removeLayer(selectedRiskLayer);
    }
    selectedRiskLayer = null;
}

function clearSelectedDistrictLayer() {
    if (selectedDistrictLayer && climateMap) {
        climateMap.removeLayer(selectedDistrictLayer);
    }
    selectedDistrictLayer = null;
}


// Reset dependent dropdowns

function resetSelect(element, placeholder) {
    if (!element) return;

    element.innerHTML = `<option value="">${placeholder}</option>`;
    element.disabled = true;
}


// Location information panel

function updateLocationInfo(location, status) {
    if (selectedLocation) {
        selectedLocation.textContent = location;
    }

    if (mapRiskLevel) {
        mapRiskLevel.textContent = status;
    }

    if (mapWeatherInfo) {
        mapWeatherInfo.textContent =
            "Hazard overlays are illustrative until connected to verified climate data.";
    }
}

function showMapMessage(message) {
    if (mapWeatherInfo) mapWeatherInfo.textContent = message;
}


// 5. HAZARD LAYERS

function setupHazardLayers() {
    const hazardSettings = [
        { id: "floodLayer", name: "Flood", color: "#268cff" },
        { id: "heatLayer", name: "Heatwave", color: "#ff7043" },
        { id: "cycloneLayer", name: "Cyclone", color: "#b47cff" },
        { id: "rainLayer", name: "Rainfall", color: "#27c5e8" }
    ];

    hazardSettings.forEach(hazard => {
        const checkbox = document.getElementById(hazard.id);
        if (!checkbox) return;

        checkbox.addEventListener("change", function() {
            if (this.checked) {
                showHazardOverlay(hazard);
            } else {
                removeHazardOverlay(hazard.id);
            }
        });
    });
}


// Demonstration overlays - not live hazard observations

function showHazardOverlay(hazard) {
    removeHazardOverlay(hazard.id);

    const center = climateMap.getCenter();

    const overlay = L.circle(center, {
        radius: hazard.id === "cycloneLayer" ? 50000 : 25000,
        color: hazard.color,
        fillColor: hazard.color,
        fillOpacity: 0.18,
        weight: 2
    }).addTo(climateMap);

    overlay.bindPopup(
        hazard.name + " demonstration overlay. " +
        "Connect verified climate data for real risk visualization."
    );

    hazardLayers[hazard.id] = overlay;
}

function removeHazardOverlay(id) {
    if (hazardLayers[id]) {
        climateMap.removeLayer(hazardLayers[id]);
        delete hazardLayers[id];
    }
}


setupDigitalTwinControls();


// 6. INITIAL PAGE

openPage("dashboard");


// 7. CONSOLE MESSAGE

console.log("ClimateRisk AI Frontend Loaded Successfully!");
console.log("Dashboard, navigation and map modules initialized.");
