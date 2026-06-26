# Tests for iter7: first/last name + make/model + 3 document uploads on driver register
import os
import uuid
import base64
import pytest

# Tiny 1x1 JPEG
JPEG_B64 = (
    "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEB"
    "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEB"
    "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QA"
    "FQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAA"
    "AAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AL+AB//Z"
)
JPEG_DATAURL = f"data:image/jpeg;base64,{JPEG_B64}"
PDF_DATAURL = "data:application/pdf;base64," + base64.b64encode(b"%PDF-1.4 dummy").decode()


@pytest.fixture(scope="module")
def driver_payload():
    rnd = uuid.uuid4().hex[:8]
    return {
        "email": f"docdriver+{rnd}@getaride.com",
        "password": "Drive1234",
        "name": "Jane Doe",
        "first_name": "Jane",
        "last_name": "Doe",
        "role": "driver",
        "phone": "4075550199",
        "vehicle_make": "Toyota",
        "vehicle_model": "Camry",
        "vehicle_year": "2022",
        "vehicle_color": "Silver",
        "plate": f"FL{rnd[:3].upper()}",
        "license_number": f"D{rnd}",
        "insurance_provider": "GEICO",
        "license_doc": JPEG_DATAURL,
        "insurance_doc": PDF_DATAURL,
        "registration_doc": JPEG_DATAURL,
    }


# --- Driver register persists first/last/docs and stays pending ---
class TestDriverRegister:
    def test_register_driver_returns_token_and_pending(self, api, base_url, driver_payload):
        r = api.post(f"{base_url}/api/auth/register", json=driver_payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "token" in data and "user" in data
        u = data["user"]
        assert u["email"] == driver_payload["email"]
        assert u["role"] == "driver"
        assert u["approval_status"] == "pending"
        assert u.get("vehicle_make") == "Toyota"
        assert u.get("vehicle_model") == "Camry"
        pytest.driver_token = data["token"]
        pytest.driver_id = u["id"]
        pytest.driver_email = driver_payload["email"]

    def test_me_returns_driver(self, api, base_url):
        r = api.get(f"{base_url}/api/auth/me", headers={"Authorization": f"Bearer {pytest.driver_token}"})
        assert r.status_code == 200, r.text
        u = r.json()["user"]
        assert u["id"] == pytest.driver_id
        assert u["approval_status"] == "pending"

    def test_login_returns_driver(self, api, base_url, driver_payload):
        r = api.post(f"{base_url}/api/auth/login", json={"email": driver_payload["email"], "password": driver_payload["password"]})
        assert r.status_code == 200, r.text
        u = r.json()["user"]
        assert u["role"] == "driver" and u["approval_status"] == "pending"


# --- Pending driver blocked from going online ---
class TestDriverOnlineBlocked:
    def test_pending_driver_blocked(self, api, base_url):
        r = api.post(
            f"{base_url}/api/driver/online",
            json={"status": "online"},
            headers={"Authorization": f"Bearer {pytest.driver_token}"},
        )
        assert r.status_code == 403, r.text


# --- Admin sees driver docs ---
class TestAdminUsersDocs:
    @pytest.fixture(scope="class")
    def admin_token(self, api, base_url):
        r = api.post(f"{base_url}/api/auth/login", json={"email": "admin@getaride.com", "password": "Admin1234"})
        assert r.status_code == 200, r.text
        return r.json()["token"]

    def test_admin_users_contains_driver_with_docs(self, api, base_url, admin_token):
        r = api.get(f"{base_url}/api/admin/users", headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200, r.text
        users = r.json()["users"]
        d = next((u for u in users if u.get("id") == pytest.driver_id), None)
        assert d is not None, "newly registered driver not present in admin users"
        assert d.get("first_name") == "Jane"
        assert d.get("last_name") == "Doe"
        assert isinstance(d.get("license_doc"), str) and d["license_doc"].startswith("data:image/jpeg")
        assert isinstance(d.get("insurance_doc"), str) and d["insurance_doc"].startswith("data:application/pdf")
        assert isinstance(d.get("registration_doc"), str) and d["registration_doc"].startswith("data:")

    def test_admin_approve_then_driver_can_go_online(self, api, base_url, admin_token):
        r = api.post(
            f"{base_url}/api/admin/drivers/{pytest.driver_id}/status",
            json={"status": "approved"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert r.status_code == 200, r.text
        # Driver can now go online
        r2 = api.post(
            f"{base_url}/api/driver/online",
            json={"status": "online"},
            headers={"Authorization": f"Bearer {pytest.driver_token}"},
        )
        assert r2.status_code == 200, r2.text
        assert r2.json().get("online") is True
