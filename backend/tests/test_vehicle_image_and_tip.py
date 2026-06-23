"""Tests for new features (iteration 3): AI vehicle-image endpoint + ride tipping."""
import time
import uuid
import pytest
import requests


def _suffix():
    return uuid.uuid4().hex[:8]


def h(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


PICKUP = {"label": "Lake Eola Park", "lat": 28.5439, "lng": -81.3729}
DEST = {"label": "Orlando Intl Airport (MCO)", "lat": 28.4312, "lng": -81.3081}


# ---------- fixtures ----------
@pytest.fixture(scope="module")
def customer(base_url, api):
    email = f"TEST_tipcust_{_suffix()}@test.com"
    r = api.post(f"{base_url}/api/auth/register", json={
        "email": email, "password": "pass1234", "name": "Tip Customer", "role": "customer"
    })
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="module")
def driver(base_url, api):
    email = f"TEST_tipdrv_{_suffix()}@test.com"
    r = api.post(f"{base_url}/api/auth/register", json={
        "email": email, "password": "pass1234", "name": "Tip Driver", "role": "driver",
        "vehicle": "Toyota Camry", "plate": "FL 999T"
    })
    assert r.status_code == 200, r.text
    return r.json()


# ---------- Vehicle image ----------
class TestVehicleImage:
    """GET /api/vehicle-image — graceful return + caching."""

    def test_returns_200_with_image_or_null(self, base_url, api, customer):
        desc = f"Silver Toyota Camry {_suffix()}"  # unique to force generation attempt
        r = api.get(f"{base_url}/api/vehicle-image",
                    params={"desc": desc},
                    headers=h(customer["token"]),
                    timeout=60)
        assert r.status_code == 200, f"Expected 200 got {r.status_code}: {r.text}"
        data = r.json()
        assert "image" in data and "cached" in data
        # image may be null (budget exhausted) - graceful
        assert data["image"] is None or data["image"].startswith("data:")
        assert data["cached"] is False  # first call for this unique desc

    def test_caches_on_second_call(self, base_url, api, customer):
        # Use a stable description likely to already be cached
        desc = "Silver Toyota Camry"
        # warm up
        r1 = api.get(f"{base_url}/api/vehicle-image",
                     params={"desc": desc},
                     headers=h(customer["token"]),
                     timeout=60)
        assert r1.status_code == 200, r1.text
        # second call must be quick + cached, but only if first generated successfully
        t0 = time.time()
        r2 = api.get(f"{base_url}/api/vehicle-image",
                     params={"desc": desc},
                     headers=h(customer["token"]),
                     timeout=15)
        elapsed = time.time() - t0
        assert r2.status_code == 200
        d2 = r2.json()
        if r1.json().get("image"):
            assert d2["cached"] is True, "Expected cache hit after successful generation"
            assert d2["image"] is not None
            assert elapsed < 5.0, f"Cached call too slow: {elapsed:.2f}s"
        else:
            # No successful generation (budget exhausted) — still must be 200, no 500
            assert d2["cached"] is False

    def test_case_insensitive_key(self, base_url, api, customer):
        d1 = "Black Honda Civic"
        d2 = "  BLACK  HONDA  civic  "  # whitespace + case variant should resolve to same key
        r1 = api.get(f"{base_url}/api/vehicle-image",
                     params={"desc": d1},
                     headers=h(customer["token"]),
                     timeout=60)
        assert r1.status_code == 200
        r2 = api.get(f"{base_url}/api/vehicle-image",
                     params={"desc": d2},
                     headers=h(customer["token"]),
                     timeout=15)
        assert r2.status_code == 200
        if r1.json().get("image"):
            assert r2.json()["cached"] is True

    def test_requires_auth(self, base_url, api):
        r = api.get(f"{base_url}/api/vehicle-image", params={"desc": "Red Tesla Model 3"})
        assert r.status_code == 401

    def test_empty_desc_400(self, base_url, api, customer):
        r = api.get(f"{base_url}/api/vehicle-image",
                    params={"desc": "   "},
                    headers=h(customer["token"]))
        assert r.status_code == 400


# ---------- Tipping ----------
def _make_ride_through_offer(base_url, api, customer_token):
    """Create ride, wait for offers, select cheapest -> driver_enroute."""
    r = api.post(f"{base_url}/api/rides", headers=h(customer_token), json={
        "pickup": PICKUP, "destination": DEST, "stops": [], "when": "now"
    })
    assert r.status_code == 200, r.text
    ride_id = r.json()["ride"]["id"]
    # Wait for at least 1 offer
    offer_id = None
    for _ in range(10):
        time.sleep(2)
        rr = api.get(f"{base_url}/api/rides/{ride_id}/offers", headers=h(customer_token))
        offers = rr.json().get("offers", [])
        if offers:
            offer_id = offers[0]["id"]
            break
    assert offer_id, "Did not receive any offer"
    sel = api.post(f"{base_url}/api/rides/{ride_id}/select",
                   headers=h(customer_token),
                   json={"offer_id": offer_id})
    assert sel.status_code == 200, sel.text
    return ride_id


class TestTip:
    """POST /api/rides/{id}/tip — gating + persistence on track."""

    def test_tip_blocked_when_driver_enroute(self, base_url, api, customer):
        rid = _make_ride_through_offer(base_url, api, customer["token"])
        # status should be driver_enroute right after selection
        r = api.post(f"{base_url}/api/rides/{rid}/tip",
                     headers=h(customer["token"]), json={"amount": 5})
        assert r.status_code == 400, f"Expected 400 for tip during driver_enroute, got {r.status_code}: {r.text}"
        assert "tip" in r.text.lower()

    def test_tip_blocked_when_searching(self, base_url, api, customer):
        # Create a ride but don't select
        r = api.post(f"{base_url}/api/rides", headers=h(customer["token"]), json={
            "pickup": PICKUP, "destination": DEST, "stops": [], "when": "now"
        })
        rid = r.json()["ride"]["id"]
        rr = api.post(f"{base_url}/api/rides/{rid}/tip",
                      headers=h(customer["token"]), json={"amount": 5})
        assert rr.status_code == 400

    def test_tip_during_in_progress_and_track(self, base_url, api, customer):
        rid = _make_ride_through_offer(base_url, api, customer["token"])
        # Wait until ride reaches in_progress (~25s enroute + ~5s arrived ~= 30-45s)
        in_progress = False
        for _ in range(40):
            time.sleep(3)
            tr = api.get(f"{base_url}/api/rides/{rid}/track", headers=h(customer["token"]))
            if tr.status_code == 200 and tr.json().get("status") == "in_progress":
                in_progress = True
                break
            if tr.json().get("status") == "completed":
                # accidentally too slow; still acceptable for tip
                in_progress = True
                break
        assert in_progress, "Ride never reached in_progress within 2 min"
        # Now tip
        tip_resp = api.post(f"{base_url}/api/rides/{rid}/tip",
                            headers=h(customer["token"]), json={"amount": 5})
        assert tip_resp.status_code == 200, tip_resp.text
        assert tip_resp.json()["tip"] == 5.0
        # GET /track should now expose tip + final_fare
        tr2 = api.get(f"{base_url}/api/rides/{rid}/track", headers=h(customer["token"]))
        assert tr2.status_code == 200
        body = tr2.json()
        assert "tip" in body and "final_fare" in body, f"Missing fields: {body.keys()}"
        assert body["tip"] == 5.0
        assert body["final_fare"] is not None

        # Update tip again -> last write wins
        tip_resp2 = api.post(f"{base_url}/api/rides/{rid}/tip",
                             headers=h(customer["token"]), json={"amount": 7.5})
        assert tip_resp2.status_code == 200
        assert tip_resp2.json()["tip"] == 7.5

    def test_tip_404_unknown_ride(self, base_url, api, customer):
        r = api.post(f"{base_url}/api/rides/does-not-exist/tip",
                     headers=h(customer["token"]), json={"amount": 5})
        assert r.status_code == 404

    def test_tip_requires_auth(self, base_url, api):
        r = api.post(f"{base_url}/api/rides/whatever/tip", json={"amount": 5})
        assert r.status_code == 401
