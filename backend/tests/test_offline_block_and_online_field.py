"""
Iteration 3 — Tests for new backend behavior:
  - POST /api/driver/online offline blocked when driver has accepted/arrived/in_progress ride
  - GET /api/driver/active returns 'online' field
  - GET /api/auth/me 'user.online' present
"""
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


@pytest.fixture(scope="module")
def customer(base_url, api):
    email = f"TEST_c_{_suffix()}@test.com"
    r = api.post(f"{base_url}/api/auth/register", json={
        "email": email, "password": "pass1234", "name": "C", "role": "customer"
    })
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="module")
def driver(base_url, api):
    email = f"TEST_d_{_suffix()}@test.com"
    r = api.post(f"{base_url}/api/auth/register", json={
        "email": email, "password": "pass1234", "name": "D", "role": "driver",
        "vehicle": "Toyota Camry", "plate": "FL 123A"
    })
    assert r.status_code == 200, r.text
    return r.json()


class TestOnlineFieldExposure:
    """auth/me and driver/active must include online field."""

    def test_me_includes_online_field(self, base_url, api, driver):
        r = api.get(f"{base_url}/api/auth/me", headers=h(driver["token"]))
        assert r.status_code == 200, r.text
        user = r.json()["user"]
        assert "online" in user, "auth/me must include 'online' field"
        assert isinstance(user["online"], bool)
        # Newly registered driver should default to offline
        assert user["online"] is False

    def test_driver_active_includes_online_no_ride(self, base_url, api, driver):
        r = api.get(f"{base_url}/api/driver/active", headers=h(driver["token"]))
        assert r.status_code == 200, r.text
        body = r.json()
        assert "online" in body, "driver/active must include 'online' field"
        assert isinstance(body["online"], bool)


class TestOnlineToggle:
    def test_go_offline_when_no_active_ride_ok(self, base_url, api, driver):
        # ensure online first
        r1 = api.post(f"{base_url}/api/driver/online", headers=h(driver["token"]),
                      json={"status": "online"})
        assert r1.status_code == 200
        assert r1.json()["online"] is True

        # auth/me online=True
        me = api.get(f"{base_url}/api/auth/me", headers=h(driver["token"]))
        assert me.json()["user"]["online"] is True

        # driver/active online=True
        ac = api.get(f"{base_url}/api/driver/active", headers=h(driver["token"]))
        assert ac.json()["online"] is True

        # offline without active ride should succeed
        r2 = api.post(f"{base_url}/api/driver/online", headers=h(driver["token"]),
                      json={"status": "offline"})
        assert r2.status_code == 200, r2.text
        assert r2.json()["online"] is False

        # auth/me reflects offline
        me2 = api.get(f"{base_url}/api/auth/me", headers=h(driver["token"]))
        assert me2.json()["user"]["online"] is False


class TestOfflineBlockedDuringActiveTrip:
    def test_offline_blocked_when_driver_has_accepted_ride(self, base_url, api, customer, driver):
        # Driver online
        r = api.post(f"{base_url}/api/driver/online", headers=h(driver["token"]),
                     json={"status": "online"})
        assert r.status_code == 200

        # Driver fetches seeded requests, bids on one
        # Need at least one searching ride
        for _ in range(3):
            req = api.get(f"{base_url}/api/driver/requests", headers=h(driver["token"]))
            assert req.status_code == 200
            reqs = req.json()["requests"]
            if reqs:
                break
            time.sleep(1)
        assert reqs, "No simulated requests available to bid on"
        ride = reqs[0]
        ride_id = ride["id"]

        bid = api.post(f"{base_url}/api/rides/{ride_id}/bid", headers=h(driver["token"]),
                       json={"fare": ride["recommended_fare"]})
        assert bid.status_code == 200, bid.text

        # Wait for auto-accept (~5s)
        accepted = False
        for _ in range(10):
            time.sleep(1)
            ac = api.get(f"{base_url}/api/driver/active", headers=h(driver["token"]))
            assert ac.status_code == 200
            if ac.json()["ride"] and ac.json()["ride"]["status"] == "accepted":
                accepted = True
                break
        assert accepted, "Ride did not auto-accept within 10s"

        # Now try to go offline → must be blocked with HTTP 400
        off = api.post(f"{base_url}/api/driver/online", headers=h(driver["token"]),
                       json={"status": "offline"})
        assert off.status_code == 400, f"Expected 400, got {off.status_code}: {off.text}"
        assert "Finish your active trip" in off.text

        # And online should still be true
        me = api.get(f"{base_url}/api/auth/me", headers=h(driver["token"]))
        assert me.json()["user"]["online"] is True

        # Try in 'arrived' and 'in_progress'
        for status in ("arrived", "in_progress"):
            s = api.post(f"{base_url}/api/rides/{ride_id}/driver-status",
                         headers=h(driver["token"]), json={"status": status})
            assert s.status_code == 200, s.text
            off2 = api.post(f"{base_url}/api/driver/online", headers=h(driver["token"]),
                            json={"status": "offline"})
            assert off2.status_code == 400, (
                f"Going offline during status={status} should be blocked, got {off2.status_code}: {off2.text}"
            )

        # Complete the ride
        c = api.post(f"{base_url}/api/rides/{ride_id}/driver-status",
                     headers=h(driver["token"]), json={"status": "completed"})
        assert c.status_code == 200

        # Driver should still be online (per item 5a)
        me3 = api.get(f"{base_url}/api/auth/me", headers=h(driver["token"]))
        assert me3.json()["user"]["online"] is True, "Driver must remain online after trip completion"
        ac3 = api.get(f"{base_url}/api/driver/active", headers=h(driver["token"]))
        assert ac3.json()["online"] is True
        # No active ride
        assert ac3.json()["ride"] is None

        # Now offline succeeds
        off3 = api.post(f"{base_url}/api/driver/online", headers=h(driver["token"]),
                       json={"status": "offline"})
        assert off3.status_code == 200, off3.text
        assert off3.json()["online"] is False
