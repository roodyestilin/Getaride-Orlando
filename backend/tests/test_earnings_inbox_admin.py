"""Backend tests for iteration 5: driver earnings, inbox, and admin dashboard."""
import time
import uuid
import pytest


def _suffix():
    return uuid.uuid4().hex[:8]


def h(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


PICKUP = {"label": "Lake Eola Park", "lat": 28.5439, "lng": -81.3729}
DEST = {"label": "Orlando Intl Airport (MCO)", "lat": 28.4312, "lng": -81.3081}


# ---------- Fixtures: real users + a completed ride with chat ----------
@pytest.fixture(scope="module")
def customer(base_url, api):
    email = f"TEST_cust_{_suffix()}@test.com"
    r = api.post(f"{base_url}/api/auth/register", json={
        "email": email, "password": "pass1234", "name": "Test Customer", "role": "customer"
    })
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="module")
def driver(base_url, api):
    email = f"TEST_drv_{_suffix()}@test.com"
    r = api.post(f"{base_url}/api/auth/register", json={
        "email": email, "password": "pass1234", "name": "Test Driver", "role": "driver",
        "vehicle": "Toyota Camry", "plate": "FL 123A"
    })
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="module")
def completed_ride(base_url, api, customer, driver):
    """Create a ride, run driver flow, complete it, send a chat message. Returns ride_id."""
    # Driver online → seeds requests for our customer's ride too once it's created
    r = api.post(f"{base_url}/api/driver/online", headers=h(driver["token"]), json={"status": "online"})
    assert r.status_code == 200

    # Customer creates ride
    r = api.post(f"{base_url}/api/rides", headers=h(customer["token"]),
                 json={"pickup": PICKUP, "destination": DEST, "stops": [], "when": "now"})
    assert r.status_code == 200, r.text
    ride = r.json()["ride"]
    ride_id = ride["id"]

    # Wait for offers (progressive reveal)
    time.sleep(8)
    r = api.get(f"{base_url}/api/rides/{ride_id}/offers", headers=h(customer["token"]))
    offers = r.json()["offers"]
    assert len(offers) >= 1
    offer_id = offers[0]["id"]

    # Customer selects offer → ride becomes driver_enroute. Note: the assigned driver is a sim driver,
    # NOT our test driver. To create rides credited to our test driver, the driver must place a bid
    # on a request that targets him.
    api.post(f"{base_url}/api/rides/{ride_id}/select", headers=h(customer["token"]),
             json={"offer_id": offer_id})

    # Now have the test driver bid on a request → server auto-accepts it after a few seconds
    r = api.get(f"{base_url}/api/driver/requests", headers=h(driver["token"]))
    reqs = r.json()["requests"]
    assert len(reqs) >= 1
    drv_ride = reqs[0]
    drv_ride_id = drv_ride["id"]
    api.post(f"{base_url}/api/rides/{drv_ride_id}/bid", headers=h(driver["token"]),
             json={"fare": drv_ride["recommended_fare"]})
    time.sleep(6)

    # Customer of the seeded ride is a sim customer, so we cannot send chat as our customer there.
    # Instead, send messages on OUR customer's ride (assigned to sim driver) — chat is independent of assignment.
    api.post(f"{base_url}/api/rides/{ride_id}/messages",
             headers=h(customer["token"]), json={"text": "Hi driver"})
    time.sleep(1)

    # Advance driver's ride to completed
    for status in ["arrived", "in_progress", "completed"]:
        api.post(f"{base_url}/api/rides/{drv_ride_id}/driver-status",
                 headers=h(driver["token"]), json={"status": status})

    return {"customer_ride_id": ride_id, "driver_ride_id": drv_ride_id}


# ---------- Driver Earnings ----------
class TestDriverEarnings:
    def test_earnings_shape(self, base_url, api, driver, completed_ride):
        r = api.get(f"{base_url}/api/driver/earnings", headers=h(driver["token"]))
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ["week_total", "week_trips", "online_hours", "points", "lifetime", "days", "trips"]:
            assert k in data, f"missing key {k}"
        assert isinstance(data["days"], list) and len(data["days"]) == 7
        for d in data["days"]:
            assert "label" in d and "full" in d and "amount" in d
        assert isinstance(data["trips"], list)
        # We completed at least one ride for this driver
        assert data["week_trips"] >= 1
        assert data["lifetime"] >= 0
        # Each trip has fare/tip/total
        if data["trips"]:
            t = data["trips"][0]
            for k in ["id", "fare", "tip", "total", "pickup", "destination"]:
                assert k in t

    def test_earnings_customer_forbidden_or_empty(self, base_url, api, customer):
        # Endpoint is open to any auth user but returns empty for a customer because their id won't match driver_bid.driver_id
        r = api.get(f"{base_url}/api/driver/earnings", headers=h(customer["token"]))
        assert r.status_code == 200
        data = r.json()
        assert data["week_trips"] == 0
        assert data["trips"] == []


# ---------- Inbox ----------
class TestInbox:
    def test_inbox_lists_customer_conversation(self, base_url, api, customer, completed_ride):
        r = api.get(f"{base_url}/api/inbox", headers=h(customer["token"]))
        assert r.status_code == 200, r.text
        convos = r.json()["conversations"]
        ride_id = completed_ride["customer_ride_id"]
        assert any(c["ride_id"] == ride_id for c in convos), f"customer ride {ride_id} missing from inbox"
        c = next(c for c in convos if c["ride_id"] == ride_id)
        for k in ["other_name", "last_text", "last_at", "route", "status"]:
            assert k in c

    def test_inbox_soft_delete_then_hidden(self, base_url, api, customer, completed_ride):
        ride_id = completed_ride["customer_ride_id"]
        r = api.delete(f"{base_url}/api/inbox/{ride_id}", headers=h(customer["token"]))
        assert r.status_code == 200
        assert r.json().get("ok") is True
        r2 = api.get(f"{base_url}/api/inbox", headers=h(customer["token"]))
        convos = r2.json()["conversations"]
        assert not any(c["ride_id"] == ride_id for c in convos), "soft-deleted ride still in inbox"

    def test_inbox_requires_auth(self, base_url, api):
        r = api.get(f"{base_url}/api/inbox")
        assert r.status_code == 401


# ---------- Admin ----------
@pytest.fixture(scope="module")
def admin_token(base_url, api):
    r = api.post(f"{base_url}/api/auth/login", json={
        "email": "admin@getaride.com", "password": "Admin1234"
    })
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["user"]["role"] == "admin"
    return data["token"]


class TestAdmin:
    def test_admin_login_role(self, base_url, api):
        r = api.post(f"{base_url}/api/auth/login", json={
            "email": "admin@getaride.com", "password": "Admin1234"
        })
        assert r.status_code == 200
        assert r.json()["user"]["role"] == "admin"

    def test_overview(self, base_url, api, admin_token):
        r = api.get(f"{base_url}/api/admin/overview", headers=h(admin_token))
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ["drivers", "customers", "drivers_online", "total_rides", "active_rides",
                  "completed_trips", "revenue", "tips"]:
            assert k in d

    def test_conversations(self, base_url, api, admin_token, completed_ride, customer):
        r = api.get(f"{base_url}/api/admin/conversations", headers=h(admin_token))
        assert r.status_code == 200
        convos = r.json()["conversations"]
        ride_id = completed_ride["customer_ride_id"]
        # Admin must still see this conversation even though the customer soft-deleted it
        assert any(c["ride_id"] == ride_id for c in convos), (
            f"admin missing conversation for soft-deleted ride {ride_id}"
        )
        match = next(c for c in convos if c["ride_id"] == ride_id)
        assert len(match["messages"]) >= 1

    def test_users(self, base_url, api, admin_token):
        r = api.get(f"{base_url}/api/admin/users", headers=h(admin_token))
        assert r.status_code == 200
        users = r.json()["users"]
        assert isinstance(users, list) and len(users) >= 1
        # password must NOT leak
        assert all("password" not in u for u in users)

    def test_rides(self, base_url, api, admin_token):
        r = api.get(f"{base_url}/api/admin/rides", headers=h(admin_token))
        assert r.status_code == 200
        assert isinstance(r.json()["rides"], list)

    def test_admin_endpoints_forbid_customer(self, base_url, api, customer):
        for path in ["/api/admin/overview", "/api/admin/conversations",
                     "/api/admin/users", "/api/admin/rides"]:
            r = api.get(f"{base_url}{path}", headers=h(customer["token"]))
            assert r.status_code == 403, f"{path} expected 403, got {r.status_code}"

    def test_admin_endpoints_forbid_driver(self, base_url, api, driver):
        for path in ["/api/admin/overview", "/api/admin/conversations",
                     "/api/admin/users", "/api/admin/rides"]:
            r = api.get(f"{base_url}{path}", headers=h(driver["token"]))
            assert r.status_code == 403, f"{path} expected 403, got {r.status_code}"
