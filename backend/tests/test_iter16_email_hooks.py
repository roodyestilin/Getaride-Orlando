"""
Iteration 16 — SendGrid email hook regression tests.

Verifies the 3 newly-wired email hooks do not break their request paths and that
core email-adjacent endpoints still return success:
  - POST /api/rides/{id}/select        -> emails email_driver_selected
  - POST /api/rides/{id}/cancel        -> emails email_ride_cancelled
  - POST /api/admin/drivers/{id}/status status=approved -> emails email_driver_approved
Regression:
  - POST /api/auth/register            -> emails email_verification (+ driver_application)
  - POST /api/rides                    -> emails email_ride_scheduled
Emails are fire-and-forget; we only assert HTTP 200 and no backend exception.
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = (os.environ.get("EXPO_PUBLIC_BACKEND_URL")
            or os.environ.get("EXPO_BACKEND_URL")
            or "https://nextjs-rebuild-8.preview.emergentagent.com").rstrip("/")

RIDER = {"email": "rider@getaride.com", "password": "Ride1234"}
ADMIN = {"email": "admin@getaride.com", "password": "Admin1234"}

# Points in Orlando — pickup near MCO to satisfy service-area rule
MCO = {"label": "Orlando Intl Airport (MCO)", "lat": 28.4312, "lng": -81.3081, "airport": True}
DEST = {"label": "Disney Springs", "lat": 28.3700, "lng": -81.5180}


# ---------- Fixtures ----------
@pytest.fixture(scope="module")
def http():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _login(http, creds):
    r = http.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["token"], r.json()["user"]


@pytest.fixture(scope="module")
def rider_auth(http):
    tok, user = _login(http, RIDER)
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}, user


@pytest.fixture(scope="module")
def admin_auth(http):
    tok, user = _login(http, ADMIN)
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}, user


# ---------- Ride helpers ----------
def _create_ride(http, headers, when="now", scheduled_time=None):
    body = {
        "pickup": MCO,
        "destination": DEST,
        "stops": [],
        "when": when,
        "scheduled_time": scheduled_time,
        "airport_info": {"direction": "from", "airline": "Delta", "bags": 1,
                         "terminal": "A", "baggage_claim": "1"},
        "passengers": 1,
        "bags": 1,
    }
    r = http.post(f"{BASE_URL}/api/rides", json=body, headers=headers, timeout=30)
    return r


def _poll_offers(http, headers, ride_id, timeout=15):
    """Offers are revealed progressively (i * 1.6s). Poll a few seconds."""
    deadline = time.time() + timeout
    offers = []
    while time.time() < deadline:
        r = http.get(f"{BASE_URL}/api/rides/{ride_id}/offers", headers=headers, timeout=15)
        assert r.status_code == 200, r.text
        offers = r.json().get("offers", [])
        if offers:
            return offers
        time.sleep(1.0)
    return offers


# ---------- Regression: register (email_verification) ----------
class TestRegisterEmail:
    def test_register_customer_returns_200_and_no_email_exception(self, http):
        email = f"TEST_v16reg+{uuid.uuid4().hex[:6]}@getaride.com"
        body = {
            "email": email, "password": "Ride1234", "name": "V16 Reg",
            "role": "customer", "phone": "4071234567",
            "date_of_birth": "1995-05-10",
            "photo": "data:image/png;base64,iVBORw0KGgo=",
        }
        r = http.post(f"{BASE_URL}/api/auth/register", json=body, timeout=30)
        assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
        data = r.json()
        assert "token" in data and "user" in data
        assert data["user"]["email"] == email.lower()


# ---------- Regression: ride/schedule (email_ride_scheduled) ----------
class TestRideScheduleEmail:
    def test_create_ride_now_returns_200(self, http, rider_auth):
        headers, _ = rider_auth
        r = _create_ride(http, headers, when="now")
        assert r.status_code == 200, f"create ride: {r.status_code} {r.text}"
        ride = r.json()["ride"]
        assert ride["status"] == "searching"
        assert ride["id"]


# ---------- 1) select_offer -> email_driver_selected ----------
class TestSelectOfferEmail:
    def test_select_offer_returns_200_and_fires_email(self, http, rider_auth):
        headers, _ = rider_auth
        # create ride
        r = _create_ride(http, headers, when="now")
        assert r.status_code == 200, r.text
        ride_id = r.json()["ride"]["id"]

        offers = _poll_offers(http, headers, ride_id, timeout=18)
        assert offers, "No offers appeared within timeout"

        offer_id = offers[0]["id"]
        r2 = http.post(f"{BASE_URL}/api/rides/{ride_id}/select",
                       json={"offer_id": offer_id}, headers=headers, timeout=30)
        assert r2.status_code == 200, f"select failed: {r2.status_code} {r2.text}"
        ride = r2.json()["ride"]
        assert ride["assigned_driver"] is not None
        assert ride["selected_offer_id"] == offer_id
        assert ride["final_fare"] == offers[0]["fare"]
        assert ride["status"] in ("driver_enroute", "scheduled")


# ---------- 2) cancel_ride -> email_ride_cancelled ----------
class TestCancelRideEmail:
    def test_cancel_pre_dispatch_no_fee(self, http, rider_auth):
        headers, _ = rider_auth
        # Fresh ride, do NOT select a driver -> pre-dispatch cancel should be $0.
        r = _create_ride(http, headers, when="now")
        assert r.status_code == 200, r.text
        ride_id = r.json()["ride"]["id"]

        r2 = http.post(f"{BASE_URL}/api/rides/{ride_id}/cancel",
                       headers=headers, timeout=30)
        assert r2.status_code == 200, f"cancel failed: {r2.status_code} {r2.text}"
        data = r2.json()
        assert data.get("ok") is True
        assert data.get("cancellation_fee", None) == 0.0

        # Verify persistence
        r3 = http.get(f"{BASE_URL}/api/rides/{ride_id}", headers=headers, timeout=15)
        assert r3.status_code == 200
        assert r3.json()["ride"]["status"] == "cancelled"

    def test_cancel_after_driver_selected_charges_fee(self, http, rider_auth):
        """After selecting a driver, ride becomes driver_enroute -> $5 fee."""
        headers, _ = rider_auth
        r = _create_ride(http, headers, when="now")
        assert r.status_code == 200, r.text
        ride_id = r.json()["ride"]["id"]
        offers = _poll_offers(http, headers, ride_id, timeout=18)
        assert offers, "No offers appeared"
        # Select an offer -> status driver_enroute (accepted_at set)
        rs = http.post(f"{BASE_URL}/api/rides/{ride_id}/select",
                       json={"offer_id": offers[0]["id"]}, headers=headers, timeout=30)
        assert rs.status_code == 200, rs.text
        assert rs.json()["ride"]["status"] == "driver_enroute"

        # Cancel now -> $5 fee applied
        rc = http.post(f"{BASE_URL}/api/rides/{ride_id}/cancel",
                       headers=headers, timeout=30)
        assert rc.status_code == 200, f"cancel-with-fee failed: {rc.status_code} {rc.text}"
        assert rc.json().get("cancellation_fee") == 5.0


# ---------- 3) admin approve -> email_driver_approved ----------
class TestAdminApproveDriverEmail:
    def _register_pending_driver(self, http):
        email = f"TEST_v16drv+{uuid.uuid4().hex[:6]}@getaride.com"
        body = {
            "email": email, "password": "Drive1234",
            "name": "V16 Driver", "first_name": "V16", "last_name": "Driver",
            "role": "driver", "phone": "4079998888",
            "date_of_birth": "1990-01-01",
            "photo": "data:image/png;base64,iVBORw0KGgo=",
            "vehicle_make": "Toyota", "vehicle_model": "Camry", "vehicle_year": "2020",
            "vehicle_color": "White", "plate": "FL 999X", "license_number": "D999",
            "ssn": "123-45-6780",  # structurally valid
            "agreed_terms": True,
        }
        r = http.post(f"{BASE_URL}/api/auth/register", json=body, timeout=30)
        assert r.status_code == 200, f"driver register failed: {r.status_code} {r.text}"
        return r.json()["user"]

    def test_approve_driver_returns_200_and_fires_email(self, http, admin_auth):
        headers, _ = admin_auth
        driver = self._register_pending_driver(http)
        assert driver["approval_status"] == "pending"
        r = http.post(f"{BASE_URL}/api/admin/drivers/{driver['id']}/status",
                      json={"status": "approved"}, headers=headers, timeout=30)
        assert r.status_code == 200, f"approve failed: {r.status_code} {r.text}"
        assert r.json().get("approval_status") == "approved"

        # Verify persistence via admin users listing
        rl = http.get(f"{BASE_URL}/api/admin/users", headers=headers, timeout=30)
        assert rl.status_code == 200
        matched = [u for u in rl.json()["users"] if u["id"] == driver["id"]]
        assert matched and matched[0]["approval_status"] == "approved"
