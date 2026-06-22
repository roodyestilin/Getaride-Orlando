"""Backend tests for Getaride Orlando - covers auth, customer rides, driver flow, chat, history."""
import time
import uuid
import pytest
import requests

# ---------- Auth ----------
def _suffix():
    return uuid.uuid4().hex[:8]


@pytest.fixture(scope="module")
def customer(base_url, api):
    email = f"TEST_cust_{_suffix()}@test.com"
    r = api.post(f"{base_url}/api/auth/register", json={
        "email": email, "password": "pass1234", "name": "Test Customer", "role": "customer"
    })
    assert r.status_code == 200, r.text
    data = r.json()
    return {"email": email, "token": data["token"], "user": data["user"]}


@pytest.fixture(scope="module")
def driver(base_url, api):
    email = f"TEST_drv_{_suffix()}@test.com"
    r = api.post(f"{base_url}/api/auth/register", json={
        "email": email, "password": "pass1234", "name": "Test Driver", "role": "driver",
        "vehicle": "Toyota Camry", "plate": "FL 123A"
    })
    assert r.status_code == 200, r.text
    data = r.json()
    return {"email": email, "token": data["token"], "user": data["user"]}


def h(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


class TestAuth:
    def test_register_duplicate(self, base_url, api, customer):
        r = api.post(f"{base_url}/api/auth/register", json={
            "email": customer["email"], "password": "pass1234", "name": "Dup", "role": "customer"
        })
        assert r.status_code == 409

    def test_register_invalid_role(self, base_url, api):
        r = api.post(f"{base_url}/api/auth/register", json={
            "email": f"TEST_bad_{_suffix()}@test.com", "password": "pass1234", "name": "X", "role": "admin"
        })
        assert r.status_code == 400

    def test_login_success(self, base_url, api, customer):
        r = api.post(f"{base_url}/api/auth/login", json={
            "email": customer["email"], "password": "pass1234"
        })
        assert r.status_code == 200
        assert "token" in r.json()
        assert r.json()["user"]["role"] == "customer"

    def test_login_wrong_password(self, base_url, api, customer):
        r = api.post(f"{base_url}/api/auth/login", json={
            "email": customer["email"], "password": "wrongpass"
        })
        assert r.status_code == 401

    def test_me(self, base_url, api, customer):
        r = api.get(f"{base_url}/api/auth/me", headers=h(customer["token"]))
        assert r.status_code == 200
        assert r.json()["user"]["email"] == customer["email"].lower()

    def test_me_no_token(self, base_url, api):
        r = api.get(f"{base_url}/api/auth/me")
        assert r.status_code == 401


# ---------- Customer Ride Flow ----------
PICKUP = {"label": "Lake Eola Park", "lat": 28.5439, "lng": -81.3729}
DEST = {"label": "Orlando Intl Airport (MCO)", "lat": 28.4312, "lng": -81.3081}


class TestCustomerRide:
    ride_id = None
    offer_id = None

    def test_create_ride(self, base_url, api, customer):
        r = api.post(f"{base_url}/api/rides", headers=h(customer["token"]), json={
            "pickup": PICKUP, "destination": DEST, "stops": [], "when": "now"
        })
        assert r.status_code == 200, r.text
        ride = r.json()["ride"]
        assert ride["status"] == "searching"
        assert ride["recommended_fare"] > 0
        assert ride["fare_min"] < ride["recommended_fare"] < ride["fare_max"]
        TestCustomerRide.ride_id = ride["id"]

    def test_create_ride_driver_forbidden(self, base_url, api, driver):
        r = api.post(f"{base_url}/api/rides", headers=h(driver["token"]), json={
            "pickup": PICKUP, "destination": DEST, "stops": [], "when": "now"
        })
        assert r.status_code == 403

    def test_offers_progressive_reveal(self, base_url, api, customer):
        # First call shortly after creation reveals 1-2
        r1 = api.get(f"{base_url}/api/rides/{TestCustomerRide.ride_id}/offers",
                     headers=h(customer["token"]))
        assert r1.status_code == 200
        first = r1.json()["offers"]
        assert len(first) >= 1
        # Wait so more offers reveal
        time.sleep(9)
        r2 = api.get(f"{base_url}/api/rides/{TestCustomerRide.ride_id}/offers",
                     headers=h(customer["token"]))
        offers = r2.json()["offers"]
        assert len(offers) >= 3, f"Expected progressive reveal of 5 offers, got {len(offers)}"
        # Sorted by fare ascending
        fares = [o["fare"] for o in offers]
        assert fares == sorted(fares)
        TestCustomerRide.offer_id = offers[0]["id"]

    def test_select_offer(self, base_url, api, customer):
        r = api.post(f"{base_url}/api/rides/{TestCustomerRide.ride_id}/select",
                     headers=h(customer["token"]),
                     json={"offer_id": TestCustomerRide.offer_id})
        assert r.status_code == 200, r.text
        ride = r.json()["ride"]
        assert ride["status"] == "driver_enroute"
        assert ride["assigned_driver"] is not None
        assert ride["final_fare"] is not None

    def test_track_driver_enroute(self, base_url, api, customer):
        r = api.get(f"{base_url}/api/rides/{TestCustomerRide.ride_id}/track",
                    headers=h(customer["token"]))
        assert r.status_code == 200
        data = r.json()
        assert data["status"] in ("driver_enroute", "arrived")
        assert data["driver_location"] is not None


# ---------- Driver Flow ----------
class TestDriverFlow:
    ride_id = None

    def test_go_online(self, base_url, api, driver):
        r = api.post(f"{base_url}/api/driver/online", headers=h(driver["token"]),
                     json={"status": "online"})
        assert r.status_code == 200
        assert r.json()["online"] is True

    def test_requests(self, base_url, api, driver):
        r = api.get(f"{base_url}/api/driver/requests", headers=h(driver["token"]))
        assert r.status_code == 200
        reqs = r.json()["requests"]
        assert len(reqs) >= 1
        ride = reqs[0]
        assert "fare_min" in ride and "fare_max" in ride
        TestDriverFlow.ride_id = ride["id"]
        TestDriverFlow.fare_min = ride["fare_min"]
        TestDriverFlow.fare_max = ride["fare_max"]
        TestDriverFlow.recommended = ride["recommended_fare"]

    def test_bid_out_of_range(self, base_url, api, driver):
        r = api.post(f"{base_url}/api/rides/{TestDriverFlow.ride_id}/bid",
                     headers=h(driver["token"]),
                     json={"fare": TestDriverFlow.fare_max + 100})
        assert r.status_code == 400

    def test_bid_success(self, base_url, api, driver):
        r = api.post(f"{base_url}/api/rides/{TestDriverFlow.ride_id}/bid",
                     headers=h(driver["token"]),
                     json={"fare": TestDriverFlow.recommended})
        assert r.status_code == 200
        assert r.json()["ok"] is True

    def test_active_auto_accept(self, base_url, api, driver):
        # initially still searching
        r1 = api.get(f"{base_url}/api/driver/active", headers=h(driver["token"]))
        assert r1.status_code == 200
        assert r1.json()["ride"]["status"] == "searching"
        time.sleep(6)
        r2 = api.get(f"{base_url}/api/driver/active", headers=h(driver["token"]))
        assert r2.json()["ride"]["status"] == "accepted"

    def test_advance_statuses(self, base_url, api, driver):
        for status in ["arrived", "in_progress", "completed"]:
            r = api.post(f"{base_url}/api/rides/{TestDriverFlow.ride_id}/driver-status",
                         headers=h(driver["token"]), json={"status": status})
            assert r.status_code == 200
            assert r.json()["ride"]["status"] == status

    def test_invalid_status(self, base_url, api, driver):
        r = api.post(f"{base_url}/api/rides/{TestDriverFlow.ride_id}/driver-status",
                     headers=h(driver["token"]), json={"status": "garbage"})
        assert r.status_code == 400


# ---------- Chat ----------
class TestChat:
    def test_send_and_autoreply(self, base_url, api, customer):
        rid = TestCustomerRide.ride_id
        assert rid is not None
        r = api.post(f"{base_url}/api/rides/{rid}/messages",
                     headers=h(customer["token"]), json={"text": "Hi there"})
        assert r.status_code == 200
        time.sleep(1)
        r2 = api.get(f"{base_url}/api/rides/{rid}/messages", headers=h(customer["token"]))
        msgs = r2.json()["messages"]
        assert len(msgs) >= 2
        roles = {m["sender_role"] for m in msgs}
        assert "customer" in roles and "driver" in roles


# ---------- History ----------
class TestHistory:
    def test_customer_rides(self, base_url, api, customer):
        r = api.get(f"{base_url}/api/me/rides", headers=h(customer["token"]))
        assert r.status_code == 200
        assert len(r.json()["rides"]) >= 1

    def test_driver_trips(self, base_url, api, driver):
        r = api.get(f"{base_url}/api/driver/trips", headers=h(driver["token"]))
        assert r.status_code == 200
        assert len(r.json()["rides"]) >= 1


# ---------- Places ----------
class TestPlaces:
    def test_places_query(self, base_url, api, customer):
        r = api.get(f"{base_url}/api/places?q=disney", headers=h(customer["token"]))
        assert r.status_code == 200
        items = r.json()["places"]
        assert any("Disney" in p["label"] for p in items)
