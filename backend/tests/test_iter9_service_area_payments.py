"""Backend tests for iteration 9:
- Service-area 100mi rule on /api/rides
- Stripe Checkout session creation / status / authorization rules
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://react-native-rides-3.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

CUSTOMER = {"email": "rider@getaride.com", "password": "Ride1234"}
DRIVER = {"email": "driver@getaride.com", "password": "Drive1234"}

# Locations
ORLANDO_PICKUP = {"label": "Lake Eola Park", "lat": 28.5439, "lng": -81.3729}
ORLANDO_DEST = {"label": "Universal Studios", "lat": 28.4754, "lng": -81.4685}
# Seattle is far from Orlando
SEATTLE_A = {"label": "Seattle A", "lat": 47.6062, "lng": -122.3321}
SEATTLE_B = {"label": "Seattle B", "lat": 47.6500, "lng": -122.3500}


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=20)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["token"], r.json()["user"]


@pytest.fixture(scope="module")
def customer_auth():
    token, user = _login(CUSTOMER)
    return {"token": token, "user": user, "headers": {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}}


@pytest.fixture(scope="module")
def driver_auth():
    token, user = _login(DRIVER)
    return {"token": token, "user": user, "headers": {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}}


# ---- Service area rule ----
class TestServiceArea:
    def test_reject_when_both_outside_100mi(self, customer_auth):
        body = {"pickup": SEATTLE_A, "destination": SEATTLE_B, "stops": [], "when": "now"}
        r = requests.post(f"{API}/rides", json=body, headers=customer_auth["headers"], timeout=20)
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text}"
        assert "100 miles of Orlando" in r.text

    def test_accept_when_pickup_in_orlando(self, customer_auth):
        body = {"pickup": ORLANDO_PICKUP, "destination": SEATTLE_B, "stops": [], "when": "now"}
        r = requests.post(f"{API}/rides", json=body, headers=customer_auth["headers"], timeout=20)
        assert r.status_code == 200, r.text
        ride = r.json()["ride"]
        assert ride["status"] == "searching"
        assert ride["pickup"]["label"] == "Lake Eola Park"

    def test_accept_when_destination_in_orlando(self, customer_auth):
        body = {"pickup": SEATTLE_A, "destination": ORLANDO_DEST, "stops": [], "when": "now"}
        r = requests.post(f"{API}/rides", json=body, headers=customer_auth["headers"], timeout=20)
        assert r.status_code == 200, r.text
        assert r.json()["ride"]["destination"]["label"] == "Universal Studios"

    def test_accept_normal_orlando_ride(self, customer_auth):
        body = {"pickup": ORLANDO_PICKUP, "destination": ORLANDO_DEST, "stops": [], "when": "now"}
        r = requests.post(f"{API}/rides", json=body, headers=customer_auth["headers"], timeout=20)
        assert r.status_code == 200, r.text


# ---- Payments ----
def _create_ride(customer_auth):
    body = {"pickup": ORLANDO_PICKUP, "destination": ORLANDO_DEST, "stops": [], "when": "now"}
    r = requests.post(f"{API}/rides", json=body, headers=customer_auth["headers"], timeout=20)
    assert r.status_code == 200
    return r.json()["ride"]


def _force_complete(ride_id, driver_auth):
    """Drive ride directly to completed via driver-status endpoint (auth fine since endpoint doesn't check role)."""
    r = requests.post(
        f"{API}/rides/{ride_id}/driver-status",
        json={"status": "completed"},
        headers=driver_auth["headers"],
        timeout=20,
    )
    assert r.status_code == 200, r.text
    return r.json()["ride"]


class TestPayments:
    def test_checkout_requires_completed_ride(self, customer_auth):
        ride = _create_ride(customer_auth)
        body = {"ride_id": ride["id"], "origin_url": BASE_URL}
        r = requests.post(f"{API}/payments/checkout/session", json=body, headers=customer_auth["headers"], timeout=30)
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text}"

    def test_checkout_403_non_owner(self, customer_auth, driver_auth):
        ride = _create_ride(customer_auth)
        _force_complete(ride["id"], driver_auth)
        body = {"ride_id": ride["id"], "origin_url": BASE_URL}
        r = requests.post(f"{API}/payments/checkout/session", json=body, headers=driver_auth["headers"], timeout=30)
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text}"

    def test_checkout_success_returns_url_and_session(self, customer_auth, driver_auth):
        ride = _create_ride(customer_auth)
        completed = _force_complete(ride["id"], driver_auth)
        # add a tip to confirm server amount = final_fare + tip; but completed ride needs final_fare; the ride
        # didn't have offer chosen, so final_fare may be None. Add tip via API.
        tip_resp = requests.post(
            f"{API}/rides/{ride['id']}/tip", json={"amount": 2.5},
            headers=customer_auth["headers"], timeout=15,
        )
        assert tip_resp.status_code == 200, tip_resp.text

        body = {"ride_id": ride["id"], "origin_url": BASE_URL}
        r = requests.post(f"{API}/payments/checkout/session", json=body, headers=customer_auth["headers"], timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "url" in data and "session_id" in data
        assert "checkout.stripe.com" in data["url"], f"unexpected url: {data['url']}"

        # Status endpoint
        sid = data["session_id"]
        s = requests.get(f"{API}/payments/checkout/status/{sid}", headers=customer_auth["headers"], timeout=30)
        assert s.status_code == 200, s.text
        sd = s.json()
        for k in ("status", "payment_status", "amount_total", "ride_id"):
            assert k in sd, f"missing key {k}"
        assert sd["ride_id"] == ride["id"]
        # Expected amount = recommended_fare (since no offer selected) + 2.5 tip
        expected = round((completed.get("final_fare") or completed.get("recommended_fare")) + 2.5, 2)
        # amount_total is in cents
        if sd.get("amount_total") is not None:
            assert abs(sd["amount_total"] / 100.0 - expected) < 0.05, f"amount mismatch: {sd['amount_total']} vs {expected*100}"
        # Will be open/unpaid until paid
        assert sd["payment_status"] in ("unpaid", "no_payment_required", "paid")
