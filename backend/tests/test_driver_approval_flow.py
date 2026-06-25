"""
Iteration 6 tests — Driver approval / multi-step signup / admin actions.

Covers:
- POST /api/auth/register (driver) with multi-step fields -> approval_status='pending'
- POST /api/driver/online 'online' on a pending driver -> 403
- POST /api/admin/drivers/{id}/status approve -> driver can now go online
- decline / deactivate / reactivate transitions
- GET /api/driver/active returns approval_status field
- Admin dashboard endpoints (overview, users, rides, conversations, live) -> 200
- GET /api/driver/earnings -> 200 with breakdown
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@getaride.com"
ADMIN_PASSWORD = "Admin1234"
SEED_DRIVER_EMAIL = "driver@getaride.com"
SEED_DRIVER_PASSWORD = "Drive1234"


def _post(path, body=None, token=None, expected=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    r = requests.post(f"{API}{path}", json=body or {}, headers=headers, timeout=20)
    if expected is not None:
        assert r.status_code == expected, f"POST {path} -> {r.status_code} {r.text}"
    return r


def _get(path, token=None, expected=200):
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    r = requests.get(f"{API}{path}", headers=headers, timeout=20)
    assert r.status_code == expected, f"GET {path} -> {r.status_code} {r.text}"
    return r


# ---------------- Fixtures ----------------
@pytest.fixture(scope="module")
def admin_token():
    r = _post("/auth/login", {"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, expected=200)
    return r.json()["token"]


@pytest.fixture(scope="module")
def new_pending_driver():
    """Register a brand-new driver with the multi-step payload."""
    suffix = uuid.uuid4().hex[:8]
    email = f"TEST_pendingdriver+{suffix}@getaride.com"
    payload = {
        "email": email,
        "password": "Drive1234",
        "name": "TEST Pending Driver",
        "role": "driver",
        "phone": "(407) 555-0123",
        "vehicle_make": "Honda",
        "vehicle_model": "Civic",
        "vehicle_year": "2022",
        "vehicle_color": "Silver",
        "plate": f"FL{suffix[:5].upper()}",
        "license_number": f"D{suffix}",
        "insurance_provider": "GEICO",
    }
    r = _post("/auth/register", payload, expected=200)
    data = r.json()
    return {"token": data["token"], "user": data["user"], "email": email, "payload": payload}


# ---------------- Auth / Register ----------------
class TestDriverRegisterMultiStep:
    def test_register_sets_approval_pending(self, new_pending_driver):
        u = new_pending_driver["user"]
        assert u["role"] == "driver"
        assert u["approval_status"] == "pending"
        # multi-step persisted
        assert u["vehicle_make"] == "Honda"
        assert u["vehicle_model"] == "Civic"
        assert u["vehicle_year"] == "2022"
        assert u["license_number"].startswith("D")
        assert u["insurance_provider"] == "GEICO"
        # combined "vehicle" string is populated for backward compat
        assert u.get("vehicle") and "Honda" in u["vehicle"] and "Civic" in u["vehicle"]
        assert "token" in new_pending_driver and new_pending_driver["token"]

    def test_me_returns_pending(self, new_pending_driver):
        r = _get("/auth/me", token=new_pending_driver["token"])
        assert r.json()["user"]["approval_status"] == "pending"


# ---------------- Pending driver blocked from going online ----------------
class TestOnlineBlockedWhilePending:
    def test_pending_driver_cannot_go_online(self, new_pending_driver):
        r = _post("/driver/online", {"status": "online"}, token=new_pending_driver["token"])
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text}"
        body = r.json()
        msg = (body.get("detail") or "").lower()
        assert "approved" in msg or "pending" in msg or "review" in msg, body

    def test_driver_active_returns_approval_status(self, new_pending_driver):
        r = _get("/driver/active", token=new_pending_driver["token"])
        body = r.json()
        assert "approval_status" in body
        assert body["approval_status"] == "pending"
        assert body["online"] is False


# ---------------- Admin approval flow ----------------
class TestAdminApprovalTransitions:
    def test_admin_approve_then_driver_can_go_online(self, admin_token, new_pending_driver):
        driver_id = new_pending_driver["user"]["id"]
        # 1. approve
        r = _post(f"/admin/drivers/{driver_id}/status", {"status": "approved"}, token=admin_token)
        assert r.status_code == 200, r.text
        assert r.json()["approval_status"] == "approved"

        # 2. verify approval persisted via /auth/me
        me = _get("/auth/me", token=new_pending_driver["token"]).json()["user"]
        assert me["approval_status"] == "approved"

        # 3. driver can now go online
        r2 = _post("/driver/online", {"status": "online"}, token=new_pending_driver["token"])
        assert r2.status_code == 200, r2.text
        assert r2.json()["online"] is True

        # bring back offline (no active trip) for clean state
        _post("/driver/online", {"status": "offline"}, token=new_pending_driver["token"])

    def test_admin_deactivate_blocks_online(self, admin_token, new_pending_driver):
        driver_id = new_pending_driver["user"]["id"]
        r = _post(f"/admin/drivers/{driver_id}/status", {"status": "deactivated"}, token=admin_token)
        assert r.status_code == 200
        # going online must be blocked
        blocked = _post("/driver/online", {"status": "online"}, token=new_pending_driver["token"])
        assert blocked.status_code == 403, blocked.text
        # /driver/active reflects deactivated state and offline forced
        active = _get("/driver/active", token=new_pending_driver["token"]).json()
        assert active["approval_status"] == "deactivated"
        assert active["online"] is False

    def test_admin_reactivate_after_decline(self, admin_token, new_pending_driver):
        driver_id = new_pending_driver["user"]["id"]
        # decline
        r = _post(f"/admin/drivers/{driver_id}/status", {"status": "declined"}, token=admin_token)
        assert r.status_code == 200
        assert r.json()["approval_status"] == "declined"
        blocked = _post("/driver/online", {"status": "online"}, token=new_pending_driver["token"])
        assert blocked.status_code == 403
        # reactivate
        r2 = _post(f"/admin/drivers/{driver_id}/status", {"status": "approved"}, token=admin_token)
        assert r2.status_code == 200
        ok = _post("/driver/online", {"status": "online"}, token=new_pending_driver["token"])
        assert ok.status_code == 200
        _post("/driver/online", {"status": "offline"}, token=new_pending_driver["token"])

    def test_invalid_status_400(self, admin_token, new_pending_driver):
        driver_id = new_pending_driver["user"]["id"]
        r = _post(f"/admin/drivers/{driver_id}/status", {"status": "bogus"}, token=admin_token)
        assert r.status_code == 400

    def test_non_admin_cannot_set_status(self, new_pending_driver):
        driver_id = new_pending_driver["user"]["id"]
        r = _post(f"/admin/drivers/{driver_id}/status", {"status": "approved"}, token=new_pending_driver["token"])
        assert r.status_code == 403


# ---------------- Admin dashboard endpoints ----------------
class TestAdminDashboard:
    def test_admin_overview(self, admin_token):
        r = _get("/admin/overview", token=admin_token).json()
        for k in ("drivers", "customers", "drivers_online", "total_rides", "active_rides",
                  "completed_trips", "revenue", "tips"):
            assert k in r, f"missing {k}"
        assert isinstance(r["revenue"], (int, float))

    def test_admin_users_no_password(self, admin_token):
        r = _get("/admin/users", token=admin_token).json()
        users = r["users"]
        assert isinstance(users, list) and len(users) > 0
        for u in users:
            assert "password" not in u, "password should be stripped"

    def test_admin_rides(self, admin_token):
        r = _get("/admin/rides", token=admin_token).json()
        assert isinstance(r.get("rides"), list)

    def test_admin_conversations(self, admin_token):
        r = _get("/admin/conversations", token=admin_token).json()
        assert isinstance(r.get("conversations"), list)

    def test_admin_live(self, admin_token):
        r = _get("/admin/live", token=admin_token).json()
        assert isinstance(r.get("live"), list)

    def test_non_admin_blocked(self):
        # use the seeded approved driver
        tok = _post("/auth/login", {"email": SEED_DRIVER_EMAIL, "password": SEED_DRIVER_PASSWORD}, expected=200).json()["token"]
        for path in ("/admin/overview", "/admin/users", "/admin/rides", "/admin/conversations", "/admin/live"):
            r = requests.get(f"{API}{path}", headers={"Authorization": f"Bearer {tok}"}, timeout=15)
            assert r.status_code == 403, f"{path} expected 403 got {r.status_code}"


# ---------------- Driver Earnings ----------------
class TestDriverEarnings:
    def test_earnings_for_seed_driver(self):
        tok = _post("/auth/login", {"email": SEED_DRIVER_EMAIL, "password": SEED_DRIVER_PASSWORD}, expected=200).json()["token"]
        r = _get("/driver/earnings", token=tok).json()
        for k in ("week_total", "week_trips", "today_total", "month_total",
                  "online_hours", "points", "lifetime", "days", "trips"):
            assert k in r, f"missing {k} in earnings"
        assert isinstance(r["days"], list) and len(r["days"]) == 7
        for d in r["days"]:
            assert "label" in d and "amount" in d
        assert isinstance(r["trips"], list)
