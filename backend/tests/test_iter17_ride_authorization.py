"""Iteration 17 — P0 per-ride authorization tests.

Covers:
  ensure_ride_participant  (GET /rides/{id}, GET /track, POST /cancel)
  ensure_ride_customer     (GET /offers, POST /select)
  driver-status authorization (POST /rides/{id}/driver-status)
  ensure_thread_access     (GET & POST /rides/{id}/messages, support-<userId>)
  Regression happy-path for owner & driver.
"""
import os
import time
import uuid
import base64
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://nextjs-rebuild-8.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

RIDER_A = {"email": "rider@getaride.com", "password": "Ride1234"}
DRIVER = {"email": "driver@getaride.com", "password": "Drive1234"}
ADMIN = {"email": "admin@getaride.com", "password": "Admin1234"}

MCO = {"label": "Orlando MCO", "lat": 28.4312, "lng": -81.3081, "airport": True}
DEST = {"label": "Downtown Orlando", "lat": 28.5383, "lng": -81.3792, "airport": False}

# tiny valid base64 PNG for profile photo
PNG_DATA = (
    "data:image/png;base64,"
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
)


def _auth_headers(token: str) -> dict:
    return {"Content-Type": "application/json", "Authorization": f"Bearer {token}"}


def _login(email: str, password: str) -> str:
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"login {email} failed: {r.status_code} {r.text}"
    return r.json()["token"]


def _register_customer(email: str, name: str = "Attacker B") -> str:
    payload = {
        "email": email,
        "password": "Attack1234",
        "name": name,
        "role": "customer",
        "first_name": "Attacker",
        "last_name": "Test",
        "phone": "+14075550199",
        "date_of_birth": "1990-01-01",
        "photo": PNG_DATA,
    }
    r = requests.post(f"{API}/auth/register", json=payload, timeout=15)
    assert r.status_code == 200, f"register attacker: {r.status_code} {r.text}"
    return r.json()["token"]


# ---------- session-scoped tokens & primary ride ----------
@pytest.fixture(scope="module")
def tokens():
    rider_a = _login(**RIDER_A)
    driver = _login(**DRIVER)
    admin = _login(**ADMIN)
    attacker_email = f"TEST_attacker_{uuid.uuid4().hex[:8]}@getaride.com"
    attacker = _register_customer(attacker_email)
    return {"rider_a": rider_a, "driver": driver, "admin": admin,
            "attacker": attacker, "attacker_email": attacker_email}


@pytest.fixture(scope="module")
def owner_ride(tokens):
    """Create a real ride owned by rider_a (from MCO to downtown)."""
    body = {
        "pickup": MCO,
        "destination": DEST,
        "stops": [],
        "when": "now",
        "passengers": 1,
        "bags": 1,
    }
    r = requests.post(f"{API}/rides", json=body, headers=_auth_headers(tokens["rider_a"]), timeout=20)
    assert r.status_code == 200, f"create ride: {r.status_code} {r.text}"
    ride = r.json()["ride"]
    assert ride["id"] and ride["customer_id"], "missing id/customer_id"
    return ride


# ==========================================================================
# GET /api/rides/{id}  — ensure_ride_participant
# ==========================================================================
class TestGetRideAuthorization:
    def test_owner_gets_200(self, tokens, owner_ride):
        r = requests.get(f"{API}/rides/{owner_ride['id']}", headers=_auth_headers(tokens["rider_a"]), timeout=15)
        assert r.status_code == 200
        assert r.json()["ride"]["id"] == owner_ride["id"]

    def test_admin_gets_200(self, tokens, owner_ride):
        r = requests.get(f"{API}/rides/{owner_ride['id']}", headers=_auth_headers(tokens["admin"]), timeout=15)
        assert r.status_code == 200

    def test_other_customer_gets_403(self, tokens, owner_ride):
        r = requests.get(f"{API}/rides/{owner_ride['id']}", headers=_auth_headers(tokens["attacker"]), timeout=15)
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text}"


# ==========================================================================
# GET /api/rides/{id}/offers  — ensure_ride_customer
# ==========================================================================
class TestOffersAuthorization:
    def test_owner_gets_200(self, tokens, owner_ride):
        r = requests.get(f"{API}/rides/{owner_ride['id']}/offers", headers=_auth_headers(tokens["rider_a"]), timeout=15)
        assert r.status_code == 200
        assert "offers" in r.json()

    def test_other_customer_gets_403(self, tokens, owner_ride):
        r = requests.get(f"{API}/rides/{owner_ride['id']}/offers", headers=_auth_headers(tokens["attacker"]), timeout=15)
        assert r.status_code == 403


# ==========================================================================
# POST /api/rides/{id}/select — ensure_ride_customer
# ==========================================================================
class TestSelectAuthorization:
    def test_non_owner_gets_403(self, tokens, owner_ride):
        r = requests.post(f"{API}/rides/{owner_ride['id']}/select",
                          json={"offer_id": "bogus"},
                          headers=_auth_headers(tokens["attacker"]), timeout=15)
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text}"

    def test_owner_selects_offer(self, tokens, owner_ride):
        # Poll offers until at least one appears (simulated reveal is progressive)
        offer_id = None
        for _ in range(15):
            r = requests.get(f"{API}/rides/{owner_ride['id']}/offers",
                             headers=_auth_headers(tokens["rider_a"]), timeout=15)
            assert r.status_code == 200
            offers = r.json().get("offers", [])
            if offers:
                offer_id = offers[0]["id"]
                break
            time.sleep(1.2)
        assert offer_id, "no simulated offers appeared within polling window"
        r = requests.post(f"{API}/rides/{owner_ride['id']}/select",
                          json={"offer_id": offer_id},
                          headers=_auth_headers(tokens["rider_a"]), timeout=20)
        assert r.status_code == 200, f"owner select: {r.status_code} {r.text}"
        ride = r.json()["ride"]
        assert ride.get("assigned_driver") and ride["assigned_driver"].get("id")


# ==========================================================================
# GET /api/rides/{id}/track  — ensure_ride_participant
# ==========================================================================
class TestTrackAuthorization:
    def test_owner_gets_200(self, tokens, owner_ride):
        r = requests.get(f"{API}/rides/{owner_ride['id']}/track", headers=_auth_headers(tokens["rider_a"]), timeout=15)
        assert r.status_code == 200

    def test_non_participant_gets_403(self, tokens, owner_ride):
        r = requests.get(f"{API}/rides/{owner_ride['id']}/track", headers=_auth_headers(tokens["attacker"]), timeout=15)
        assert r.status_code == 403


# ==========================================================================
# POST /api/rides/{id}/cancel — ensure_ride_participant
# ==========================================================================
class TestCancelAuthorization:
    def test_non_participant_gets_403(self, tokens, owner_ride):
        r = requests.post(f"{API}/rides/{owner_ride['id']}/cancel",
                          headers=_auth_headers(tokens["attacker"]), timeout=15)
        assert r.status_code == 403

    def test_owner_cancel_200(self, tokens, owner_ride):
        r = requests.post(f"{API}/rides/{owner_ride['id']}/cancel",
                          headers=_auth_headers(tokens["rider_a"]), timeout=15)
        assert r.status_code == 200, f"owner cancel: {r.status_code} {r.text}"
        # Verify persistence
        g = requests.get(f"{API}/rides/{owner_ride['id']}",
                         headers=_auth_headers(tokens["rider_a"]), timeout=15)
        assert g.status_code == 200
        assert g.json()["ride"]["status"] == "cancelled"


# ==========================================================================
# Chat / support thread — ensure_thread_access
# ==========================================================================
class TestChatAuthorization:
    def test_ride_messages_non_participant_get_403(self, tokens, owner_ride):
        r = requests.get(f"{API}/rides/{owner_ride['id']}/messages",
                         headers=_auth_headers(tokens["attacker"]), timeout=15)
        assert r.status_code == 403

    def test_ride_messages_participant_get_200(self, tokens, owner_ride):
        r = requests.get(f"{API}/rides/{owner_ride['id']}/messages",
                         headers=_auth_headers(tokens["rider_a"]), timeout=15)
        assert r.status_code == 200
        assert "messages" in r.json()

    def test_ride_messages_non_participant_post_403(self, tokens, owner_ride):
        r = requests.post(f"{API}/rides/{owner_ride['id']}/messages",
                          json={"text": "hi"},
                          headers=_auth_headers(tokens["attacker"]), timeout=15)
        assert r.status_code == 403

    def test_ride_messages_owner_can_post(self, tokens, owner_ride):
        r = requests.post(f"{API}/rides/{owner_ride['id']}/messages",
                          json={"text": "TEST participant hi"},
                          headers=_auth_headers(tokens["rider_a"]), timeout=15)
        assert r.status_code == 200

    def test_support_thread_owner_only(self, tokens):
        # Get rider_a's own user id
        me = requests.get(f"{API}/auth/me", headers=_auth_headers(tokens["rider_a"]), timeout=10)
        assert me.status_code == 200
        rider_a_id = me.json()["user"]["id"]
        support_id = f"support-{rider_a_id}"

        # Attacker cannot read rider_a's support thread
        r = requests.get(f"{API}/rides/{support_id}/messages",
                         headers=_auth_headers(tokens["attacker"]), timeout=15)
        assert r.status_code == 403, f"attacker on other user's support: {r.status_code} {r.text}"

        # Attacker cannot post either
        r = requests.post(f"{API}/rides/{support_id}/messages",
                          json={"text": "TEST intruder"},
                          headers=_auth_headers(tokens["attacker"]), timeout=15)
        assert r.status_code == 403

        # Owner can read
        r = requests.get(f"{API}/rides/{support_id}/messages",
                         headers=_auth_headers(tokens["rider_a"]), timeout=15)
        assert r.status_code == 200

        # Admin can read anyone's support thread
        r = requests.get(f"{API}/rides/{support_id}/messages",
                         headers=_auth_headers(tokens["admin"]), timeout=15)
        assert r.status_code == 200


# ==========================================================================
# Driver-status authorization  (POST /rides/{id}/driver-status)
# ==========================================================================
class TestDriverStatusAuthorization:
    def test_driver_online_and_active(self, tokens):
        """Regression + setup: driver goes online, bids on a sim ride, gets active."""
        r = requests.post(f"{API}/driver/online", json={"status": "online"},
                          headers=_auth_headers(tokens["driver"]), timeout=15)
        assert r.status_code == 200 and r.json().get("online") is True
        # Warm-up buffer is ~5s
        time.sleep(6)
        sim_ride_id = None
        sim_fare = None
        for _ in range(10):
            r = requests.get(f"{API}/driver/requests",
                             headers=_auth_headers(tokens["driver"]), timeout=15)
            if r.status_code == 200:
                reqs = r.json().get("requests", [])
                if reqs:
                    sim_ride_id = reqs[0]["id"]
                    sim_fare = reqs[0].get("fare_min", 10) + 1
                    break
            time.sleep(1.2)
        assert sim_ride_id, "no simulated driver requests appeared"
        # Bid on the ride
        b = requests.post(f"{API}/rides/{sim_ride_id}/bid",
                          json={"fare": float(sim_fare)},
                          headers=_auth_headers(tokens["driver"]), timeout=15)
        assert b.status_code == 200, f"bid: {b.status_code} {b.text}"
        # Poll driver/active to confirm
        active_id = None
        for _ in range(10):
            a = requests.get(f"{API}/driver/active",
                             headers=_auth_headers(tokens["driver"]), timeout=15)
            assert a.status_code == 200
            ride = a.json().get("ride")
            if ride:
                active_id = ride["id"]
                break
            time.sleep(1)
        assert active_id == sim_ride_id
        # Store for other tests
        pytest.driver_active_ride_id = active_id

    def test_wrong_driver_gets_403(self, tokens):
        """A different authenticated user (e.g. rider) trying driver-status should be denied."""
        ride_id = getattr(pytest, "driver_active_ride_id", None)
        if not ride_id:
            pytest.skip("no driver active ride from previous test")
        r = requests.post(f"{API}/rides/{ride_id}/driver-status",
                          json={"status": "arrived"},
                          headers=_auth_headers(tokens["attacker"]), timeout=15)
        assert r.status_code == 403, f"expected 403 for non-driver, got {r.status_code}: {r.text}"

    def test_correct_driver_gets_200(self, tokens):
        ride_id = getattr(pytest, "driver_active_ride_id", None)
        if not ride_id:
            pytest.skip("no driver active ride from previous test")
        # move status to arrived (does not need PIN)
        r = requests.post(f"{API}/rides/{ride_id}/driver-status",
                          json={"status": "arrived"},
                          headers=_auth_headers(tokens["driver"]), timeout=15)
        assert r.status_code == 200, f"driver-status arrived: {r.status_code} {r.text}"
        assert r.json()["ride"]["status"] == "arrived"


# ==========================================================================
# Regression: happy-path end-to-end already covered via fixtures above:
#   create ride -> offers -> select -> track -> cancel  (TestSelectAuthorization
#   .test_owner_selects_offer + TestCancelAuthorization.test_owner_cancel_200)
# Driver happy path is in TestDriverStatusAuthorization.
# ==========================================================================
