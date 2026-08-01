"""Iter 15 backend tests — rating flow + updated cancellation-fee rule.

Covers:
- POST /api/rides/{id}/rate: rider rates driver, driver rates rider, aggregate
  rating updates on the rider user, 400 on non-completed ride, 403 for outsiders.
- POST /api/rides/{id}/cancel fee rule:
    (a) Regular ride still "searching" -> fee 0
    (b) Regular ride after selecting an offer (driver enroute) -> fee 5.0
    (c) Scheduled ride with assigned driver but still "scheduled" (>5 min) -> fee 0
"""

import os
import time
from datetime import datetime, timedelta, timezone

import pymongo
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://fare-compare-30.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

# --- Fixtures ------------------------------------------------------------
RIDER = {"email": "rider@getaride.com", "password": "Ride1234"}
DRIVER = {"email": "driver@getaride.com", "password": "Drive1234"}

# MCO airport coordinates
MCO = {"label": "Orlando International Airport (MCO)", "lat": 28.4312, "lng": -81.3081, "airport": True}
DOWNTOWN = {"label": "Downtown Orlando", "lat": 28.5383, "lng": -81.3792, "airport": False}


@pytest.fixture(scope="module")
def mongo():
    c = pymongo.MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
    yield c[os.environ.get("DB_NAME", "test_database")]
    c.close()


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()


@pytest.fixture(scope="module")
def rider_auth():
    d = _login(RIDER["email"], RIDER["password"])
    return {"token": d["token"], "user": d["user"], "headers": {"Authorization": f"Bearer {d['token']}"}}


@pytest.fixture(scope="module")
def driver_auth():
    d = _login(DRIVER["email"], DRIVER["password"])
    return {"token": d["token"], "user": d["user"], "headers": {"Authorization": f"Bearer {d['token']}"}}


def _create_ride(rider_auth, when="now", scheduled_time=None):
    payload = {
        "pickup": DOWNTOWN,
        "destination": MCO,
        "stops": [],
        "when": when,
        "scheduled_time": scheduled_time,
        "airport_info": {"direction": "to", "airline": "Delta", "bags": 1, "flight_number": "DL123"},
    }
    r = requests.post(f"{API}/rides", json=payload, headers=rider_auth["headers"], timeout=15)
    assert r.status_code == 200, f"create ride failed: {r.status_code} {r.text}"
    return r.json()["ride"]


# ========================================================================
# Cancellation-fee rule
# ========================================================================
class TestCancelFeeRule:
    def test_a_regular_searching_free(self, rider_auth):
        """Regular ride still 'searching' (no offer selected) -> fee 0."""
        ride = _create_ride(rider_auth, when="now")
        assert ride["status"] == "searching"
        r = requests.post(f"{API}/rides/{ride['id']}/cancel", headers=rider_auth["headers"], timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is True
        assert body.get("cancellation_fee") == 0, f"expected 0, got {body}"

    def test_b_regular_after_select_fee_5(self, rider_auth):
        """After selecting an offer for a regular ride, cancel -> fee 5.0."""
        ride = _create_ride(rider_auth, when="now")
        # Poll offers until at least one shows up (simulated progressive reveal ~1.6s each)
        offer = None
        for _ in range(15):
            r = requests.get(f"{API}/rides/{ride['id']}/offers", headers=rider_auth["headers"], timeout=15)
            assert r.status_code == 200
            offers = r.json().get("offers", [])
            if offers:
                offer = offers[0]
                break
            time.sleep(1.0)
        assert offer is not None, "no offers appeared for regular ride"
        r = requests.post(f"{API}/rides/{ride['id']}/select", json={"offer_id": offer["id"]},
                          headers=rider_auth["headers"], timeout=15)
        assert r.status_code == 200, r.text
        sel = r.json()["ride"]
        assert sel["status"] == "driver_enroute", f"expected driver_enroute, got {sel['status']}"
        assert sel.get("accepted_at") is not None
        # Cancel now that driver is en route
        r = requests.post(f"{API}/rides/{ride['id']}/cancel", headers=rider_auth["headers"], timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("cancellation_fee") == 5.0, f"expected 5.0, got {body}"

    def test_c_scheduled_with_driver_still_scheduled_free(self, rider_auth):
        """Scheduled ride with assigned driver, status still 'scheduled' -> fee 0."""
        # Pickup >30 minutes out to safely clear the 5-minute cutoff
        sched = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()
        ride = _create_ride(rider_auth, when="scheduled", scheduled_time=sched)
        assert ride["status"] == "scheduled"
        # Poll for an offer
        offer = None
        for _ in range(15):
            r = requests.get(f"{API}/rides/{ride['id']}/offers", headers=rider_auth["headers"], timeout=15)
            offers = r.json().get("offers", [])
            if offers:
                offer = offers[0]
                break
            time.sleep(1.0)
        assert offer is not None, "no offers appeared for scheduled ride"
        r = requests.post(f"{API}/rides/{ride['id']}/select", json={"offer_id": offer["id"]},
                          headers=rider_auth["headers"], timeout=15)
        assert r.status_code == 200
        sel = r.json()["ride"]
        assert sel["status"] == "scheduled", f"scheduled ride must stay 'scheduled', got {sel['status']}"
        assert sel.get("accepted_at") is None, f"accepted_at must remain null for scheduled, got {sel.get('accepted_at')}"
        assert sel.get("assigned_driver") is not None
        # Cancel — should be free
        r = requests.post(f"{API}/rides/{ride['id']}/cancel", headers=rider_auth["headers"], timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("cancellation_fee") == 0, f"expected 0 for undispatched scheduled, got {body}"


# ========================================================================
# Rating flow
# ========================================================================
class TestRatingFlow:
    def _complete_ride(self, mongo, rider_auth, driver_auth):
        """Create a customer ride, assign the real driver@getaride.com, and mark it completed in DB."""
        ride = _create_ride(rider_auth, when="now")
        drv_user = mongo.users.find_one({"email": DRIVER["email"]})
        assigned = {
            "id": drv_user["id"],
            "name": drv_user["name"],
            "photo": drv_user.get("photo"),
            "rating": drv_user.get("rating", 5.0),
            "vehicle": drv_user.get("vehicle") or "Toyota Camry",
            "plate": drv_user.get("plate") or "FL 123A",
            "start": {"lat": ride["pickup"]["lat"] + 0.02, "lng": ride["pickup"]["lng"] + 0.02},
            "eta_minutes": 4,
        }
        mongo.rides.update_one(
            {"id": ride["id"]},
            {"$set": {
                "status": "completed",
                "assigned_driver": assigned,
                "accepted_at": int(time.time()) - 200,
                "final_fare": ride.get("recommended_fare", 30.0),
                "driver_bid": {"driver_id": drv_user["id"], "fare": ride.get("recommended_fare", 30.0), "at": int(time.time()) - 200},
            }},
        )
        return ride["id"], drv_user

    def test_rider_rates_driver(self, mongo, rider_auth, driver_auth):
        ride_id, _ = self._complete_ride(mongo, rider_auth, driver_auth)
        r = requests.post(f"{API}/rides/{ride_id}/rate", json={"rating": 5, "comment": "Great driver!"},
                          headers=rider_auth["headers"], timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is True
        assert body.get("stars") == 5
        # Verify persisted on ride
        doc = mongo.rides.find_one({"id": ride_id})
        assert doc.get("rider_rating") is not None
        assert doc["rider_rating"]["stars"] == 5
        assert doc["rider_rating"]["comment"] == "Great driver!"
        # GET /track exposes rider_rating for completed ride
        r = requests.get(f"{API}/rides/{ride_id}/track", headers=rider_auth["headers"], timeout=15)
        assert r.status_code == 200
        tj = r.json()
        assert tj.get("rider_rating") is not None
        assert tj["rider_rating"]["stars"] == 5

    def test_driver_rates_rider_updates_aggregate(self, mongo, rider_auth, driver_auth):
        # Snapshot rider aggregate before
        before = mongo.users.find_one({"id": rider_auth["user"]["id"]})
        before_cnt = before.get("ratings_count", 0)
        before_avg = before.get("rating", 5.0)
        ride_id, _ = self._complete_ride(mongo, rider_auth, driver_auth)
        r = requests.post(f"{API}/rides/{ride_id}/rate", json={"rating": 4, "comment": "Friendly rider"},
                          headers=driver_auth["headers"], timeout=15)
        assert r.status_code == 200, r.text
        assert r.json().get("stars") == 4
        # Ride doc has driver_rating
        doc = mongo.rides.find_one({"id": ride_id})
        assert doc.get("driver_rating", {}).get("stars") == 4
        # Aggregate updated
        after = mongo.users.find_one({"id": rider_auth["user"]["id"]})
        assert after.get("ratings_count", 0) == before_cnt + 1
        expected_avg = round((before_avg * before_cnt + 4) / (before_cnt + 1), 2)
        assert abs(after.get("rating", 0) - expected_avg) < 0.01, f"expected {expected_avg}, got {after.get('rating')}"

    def test_rate_non_completed_returns_400(self, rider_auth):
        ride = _create_ride(rider_auth, when="now")
        r = requests.post(f"{API}/rides/{ride['id']}/rate", json={"rating": 5},
                          headers=rider_auth["headers"], timeout=15)
        assert r.status_code == 400, f"expected 400, got {r.status_code} {r.text}"

    def test_outsider_returns_403(self, mongo, rider_auth, driver_auth):
        # Complete a ride with a sim driver (not the real driver user).
        ride = _create_ride(rider_auth, when="now")
        mongo.rides.update_one(
            {"id": ride["id"]},
            {"$set": {"status": "completed", "assigned_driver": {"id": "sim_outsider_xyz", "name": "Sim"},
                      "accepted_at": int(time.time()) - 200, "final_fare": 30.0}},
        )
        # The real driver@getaride.com is neither the customer nor the assigned driver -> 403
        r = requests.post(f"{API}/rides/{ride['id']}/rate", json={"rating": 3},
                          headers=driver_auth["headers"], timeout=15)
        assert r.status_code == 403, f"expected 403, got {r.status_code} {r.text}"
