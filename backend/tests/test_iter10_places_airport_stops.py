"""Iteration 10 — verifies the three new features at the API layer:
1. /api/places returns the expanded curated list incl. MCO + SFB.
2. POST /api/rides accepts an airport_info object and persists it.
3. Service-area (100-mile Orlando) rule still enforced.
4. Multi-stop ride is stored with stops so the driver UI can render them.
"""
import os
import time
import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"


def _login(email: str, password: str) -> str:
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def rider_headers():
    return {"Authorization": f"Bearer {_login('rider@getaride.com', 'Ride1234')}"}


@pytest.fixture(scope="module")
def driver_headers():
    return {"Authorization": f"Bearer {_login('driver@getaride.com', 'Drive1234')}"}


# --- /api/places ----------------------------------------------------------
class TestPlaces:
    def test_places_empty_returns_curated_list_with_airports(self, rider_headers):
        r = requests.get(f"{API}/places", headers=rider_headers, timeout=30)
        assert r.status_code == 200
        places = r.json()["places"]
        labels = [p["label"] for p in places]

        # Airports flagged correctly
        mco = next((p for p in places if "MCO" in p["label"]), None)
        sfb = next((p for p in places if "SFB" in p["label"]), None)
        assert mco and mco.get("airport") is True and mco.get("iata") == "MCO"
        assert sfb and sfb.get("airport") is True and sfb.get("iata") == "SFB"

        # Curated list contains hotels/resorts
        assert any("Hilton" in l for l in labels)
        assert any("Marriott" in l for l in labels)
        assert any("Disney" in l for l in labels)
        # Healthy size (curated list expanded)
        assert len(places) >= 20

    def test_places_query_filters(self, rider_headers):
        r = requests.get(f"{API}/places", params={"q": "Hilton"}, headers=rider_headers, timeout=30)
        assert r.status_code == 200
        places = r.json()["places"]
        assert len(places) >= 1
        assert all("hilton" in p["label"].lower() for p in places)

    def test_places_requires_auth(self):
        r = requests.get(f"{API}/places", timeout=30)
        assert r.status_code == 401


# --- POST /api/rides (airport_info + service area + stops) ---------------
class TestRideCreation:
    def test_normal_ride_still_works(self, rider_headers):
        body = {
            "pickup": {"label": "Lake Eola Park", "lat": 28.5439, "lng": -81.3729},
            "destination": {"label": "Disney Springs", "lat": 28.3700, "lng": -81.5180},
            "stops": [], "when": "now",
        }
        r = requests.post(f"{API}/rides", json=body, headers=rider_headers, timeout=30)
        assert r.status_code == 200, r.text
        ride = r.json()["ride"]
        assert ride["status"] == "searching"
        assert ride.get("airport_info") is None
        assert ride["recommended_fare"] > 0

    def test_ride_with_airport_info_to(self, rider_headers):
        body = {
            "pickup": {"label": "Hilton Orlando", "lat": 28.4256, "lng": -81.4536},
            "destination": {"label": "Orlando Intl Airport (MCO)", "lat": 28.4312, "lng": -81.3081, "airport": True},
            "stops": [], "when": "now",
            "airport_info": {"direction": "to", "airline": "Delta Air Lines", "bags": 2},
        }
        r = requests.post(f"{API}/rides", json=body, headers=rider_headers, timeout=30)
        assert r.status_code == 200, r.text
        ride = r.json()["ride"]
        ai = ride.get("airport_info")
        assert ai and ai["direction"] == "to"
        assert ai["airline"] == "Delta Air Lines"
        assert ai["bags"] == 2

        # Verify persisted via GET
        rid = ride["id"]
        g = requests.get(f"{API}/rides/{rid}", headers=rider_headers, timeout=30)
        assert g.status_code == 200
        gai = g.json()["ride"]["airport_info"]
        assert gai["airline"] == "Delta Air Lines" and gai["bags"] == 2

    def test_ride_with_airport_info_from_includes_flight(self, rider_headers):
        body = {
            "pickup": {"label": "Orlando Intl Airport (MCO)", "lat": 28.4312, "lng": -81.3081, "airport": True},
            "destination": {"label": "Hilton Orlando Bonnet Creek", "lat": 28.3506, "lng": -81.5366},
            "stops": [], "when": "now",
            "airport_info": {"direction": "from", "airline": "American Airlines", "bags": 1, "flight_number": "AA1234"},
        }
        r = requests.post(f"{API}/rides", json=body, headers=rider_headers, timeout=30)
        assert r.status_code == 200, r.text
        ai = r.json()["ride"]["airport_info"]
        assert ai["direction"] == "from"
        assert ai["flight_number"] == "AA1234"

    def test_service_area_rejects_seattle(self, rider_headers):
        body = {
            "pickup": {"label": "Seattle", "lat": 47.6062, "lng": -122.3321},
            "destination": {"label": "Seattle 2", "lat": 47.61, "lng": -122.33},
            "stops": [], "when": "now",
        }
        r = requests.post(f"{API}/rides", json=body, headers=rider_headers, timeout=30)
        assert r.status_code == 400
        assert "100 miles" in r.json()["detail"]

    def test_ride_with_stops_persists(self, rider_headers):
        body = {
            "pickup": {"label": "Lake Eola Park", "lat": 28.5439, "lng": -81.3729},
            "destination": {"label": "Disney Springs", "lat": 28.3700, "lng": -81.5180},
            "stops": [
                {"label": "Hilton Orlando", "lat": 28.4256, "lng": -81.4536},
                {"label": "ICON Park", "lat": 28.4429, "lng": -81.4685},
            ],
            "when": "now",
        }
        r = requests.post(f"{API}/rides", json=body, headers=rider_headers, timeout=30)
        assert r.status_code == 200, r.text
        ride = r.json()["ride"]
        assert len(ride["stops"]) == 2
        assert ride["stops"][0]["label"] == "Hilton Orlando"

        # GET to verify persistence
        g = requests.get(f"{API}/rides/{ride['id']}", headers=rider_headers, timeout=30)
        assert g.status_code == 200
        assert len(g.json()["ride"]["stops"]) == 2


# --- Driver multi-stop flow (status progression) ------------------------
class TestDriverStatusFlow:
    def test_driver_can_drive_status_progression(self, driver_headers):
        # bring a sim ride into existence
        requests.post(f"{API}/driver/online", json={"status": "online"}, headers=driver_headers, timeout=30)
        reqs = requests.get(f"{API}/driver/requests", headers=driver_headers, timeout=30)
        assert reqs.status_code == 200
        assert len(reqs.json()["requests"]) >= 1
        rid = reqs.json()["requests"][0]["id"]
        bid_fare = reqs.json()["requests"][0]["recommended_fare"]
        b = requests.post(f"{API}/rides/{rid}/bid", json={"fare": bid_fare}, headers=driver_headers, timeout=30)
        assert b.status_code == 200, b.text
        time.sleep(6)  # auto-accept after 5s
        a = requests.get(f"{API}/driver/active", headers=driver_headers, timeout=30)
        assert a.status_code == 200
        assert a.json()["ride"]["status"] in ("accepted", "arrived", "in_progress")

        # Drive status to in_progress (driver multi-stop UI relies on this)
        for st in ("arrived", "in_progress"):
            s = requests.post(f"{API}/rides/{rid}/driver-status", json={"status": st},
                              headers=driver_headers, timeout=30)
            assert s.status_code == 200, s.text
            assert s.json()["ride"]["status"] == st
