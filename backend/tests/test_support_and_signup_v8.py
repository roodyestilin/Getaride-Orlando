"""Iteration 8 backend tests:
- Required profile photo for all roles
- Driver new fields: vehicle_year >= 2010, SSN structural validation,
  agreed_terms, ssn_last4 (not full SSN) stored, photo persisted
- Pending driver still cannot go online
- Support chat: /support/start, /rides/support-<uid>/messages, auto-replies,
  /inbox surfaces support thread at top, /admin/conversations labels it
"""
import os
import secrets
import time
import pytest
import requests

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://fare-compare-30.preview.emergentagent.com').rstrip('/')
TINY_JPEG_DATAURL = (
    "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYE"
    "BAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBA"
    "gEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/"
    "wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAr/xAAUEAEAAAAAAAAAAAAAAAA"
    "AAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/"
    "AL+P/9k="
)


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": "admin@getaride.com", "password": "Admin1234"})
    assert r.status_code == 200, r.text
    return r.json()["token"]


def _rand_email(prefix):
    return f"TEST_{prefix}+{secrets.token_hex(4)}@getaride.com"


# ---------------- Photo requirement ----------------
class TestPhotoRequired:
    def test_register_customer_without_photo_400(self):
        r = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": _rand_email("nophoto"), "password": "Ride1234",
            "name": "No Photo", "role": "customer",
            "first_name": "No", "last_name": "Photo",
        })
        assert r.status_code == 400
        assert "photo" in r.json().get("detail", "").lower()

    def test_register_customer_with_photo_200(self):
        email = _rand_email("rider")
        r = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email, "password": "Ride1234",
            "name": "Test Rider", "role": "customer",
            "first_name": "Test", "last_name": "Rider",
            "photo": TINY_JPEG_DATAURL,
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["user"]["role"] == "customer"
        assert data["user"]["photo"] == TINY_JPEG_DATAURL
        assert data["user"]["approval_status"] == "approved"

    def test_register_driver_without_photo_400(self):
        r = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": _rand_email("drv-nophoto"), "password": "Drive1234",
            "name": "D N", "role": "driver",
            "first_name": "D", "last_name": "N",
            "vehicle_make": "Toyota", "vehicle_model": "Camry",
            "vehicle_year": "2022", "vehicle_color": "Silver",
            "plate": "FL999", "license_number": "DL1",
            "ssn": "152-45-6789", "agreed_terms": True,
        })
        assert r.status_code == 400
        assert "photo" in r.json().get("detail", "").lower()


# ---------------- Driver validations ----------------
def _driver_payload(**overrides):
    base = {
        "email": _rand_email("drv"),
        "password": "Drive1234",
        "name": "Test Drv",
        "role": "driver",
        "first_name": "Test", "last_name": "Drv",
        "photo": TINY_JPEG_DATAURL,
        "vehicle_make": "Toyota", "vehicle_model": "Camry",
        "vehicle_year": "2022", "vehicle_color": "Silver",
        "plate": "FL777", "license_number": "DLTEST",
        "ssn": "152-45-6789",
        "agreed_terms": True,
        "license_doc": TINY_JPEG_DATAURL,
        "insurance_doc": TINY_JPEG_DATAURL,
        "registration_doc": TINY_JPEG_DATAURL,
    }
    base.update(overrides)
    return base


class TestDriverYear:
    def test_year_2009_rejected(self):
        r = requests.post(f"{BASE_URL}/api/auth/register",
                          json=_driver_payload(vehicle_year="2009"))
        assert r.status_code == 400
        assert "2010" in r.json().get("detail", "")

    def test_year_2010_accepted(self):
        r = requests.post(f"{BASE_URL}/api/auth/register",
                          json=_driver_payload(vehicle_year="2010"))
        assert r.status_code == 200, r.text


class TestDriverSSN:
    @pytest.mark.parametrize("bad", ["000-12-3456", "666-12-3456",
                                     "999-12-3456", "111-11-1111",
                                     "123-45-6789"])
    def test_invalid_ssn_rejected(self, bad):
        r = requests.post(f"{BASE_URL}/api/auth/register",
                          json=_driver_payload(ssn=bad))
        assert r.status_code == 400, r.text
        assert "Social Security" in r.json().get("detail", "")

    def test_missing_agreed_terms_rejected(self):
        r = requests.post(f"{BASE_URL}/api/auth/register",
                          json=_driver_payload(agreed_terms=False))
        assert r.status_code == 400
        assert "Driver Agreement" in r.json().get("detail", "")


@pytest.fixture(scope="module")
def fresh_driver():
    payload = _driver_payload()
    r = requests.post(f"{BASE_URL}/api/auth/register", json=payload)
    assert r.status_code == 200, r.text
    data = r.json()
    return {"token": data["token"], "user": data["user"], "email": payload["email"], "ssn": payload["ssn"]}


class TestDriverPersistence:
    def test_pending_status(self, fresh_driver):
        assert fresh_driver["user"]["approval_status"] == "pending"
        assert fresh_driver["user"]["ssn_last4"] == "6789"

    def test_only_last4_in_admin(self, fresh_driver, admin_token):
        r = requests.get(f"{BASE_URL}/api/admin/users",
                         headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200
        users = r.json()["users"]
        me = next((u for u in users if u["id"] == fresh_driver["user"]["id"]), None)
        assert me is not None
        assert me.get("ssn_last4") == "6789"
        # Full SSN must NOT be present
        assert "ssn" not in me or me.get("ssn") is None
        assert fresh_driver["ssn"] not in str(me)
        assert me.get("agreed_terms") is True
        assert me.get("photo") == TINY_JPEG_DATAURL

    def test_pending_driver_cannot_go_online(self, fresh_driver):
        r = requests.post(f"{BASE_URL}/api/driver/online",
                          json={"status": "online"},
                          headers={"Authorization": f"Bearer {fresh_driver['token']}"})
        assert r.status_code == 403
        assert "approved" in r.json().get("detail", "").lower() or \
               "approval" in r.json().get("detail", "").lower() or \
               "review" in r.json().get("detail", "").lower()


# ---------------- Support chat ----------------
@pytest.fixture(scope="module")
def customer_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": "rider@getaride.com", "password": "Ride1234"})
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="module")
def driver_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": "driver@getaride.com", "password": "Drive1234"})
    assert r.status_code == 200, r.text
    return r.json()


class TestSupportChat:
    def test_customer_support_start_creates_thread(self, customer_token):
        tok = customer_token["token"]
        uid = customer_token["user"]["id"]
        r = requests.post(f"{BASE_URL}/api/support/start",
                          headers={"Authorization": f"Bearer {tok}"})
        assert r.status_code == 200
        assert r.json()["ride_id"] == f"support-{uid}"

        # welcome message
        r2 = requests.get(f"{BASE_URL}/api/rides/support-{uid}/messages",
                          headers={"Authorization": f"Bearer {tok}"})
        assert r2.status_code == 200
        msgs = r2.json()["messages"]
        assert len(msgs) >= 1
        assert msgs[0]["sender_role"] == "support"
        assert "Getaride Support" in msgs[0]["sender_name"]

    def test_customer_send_auto_reply(self, customer_token):
        tok = customer_token["token"]
        uid = customer_token["user"]["id"]
        unique_text = f"TEST_help_{secrets.token_hex(3)}"
        r = requests.post(f"{BASE_URL}/api/rides/support-{uid}/messages",
                          json={"text": unique_text},
                          headers={"Authorization": f"Bearer {tok}"})
        assert r.status_code == 200
        time.sleep(1.0)
        r2 = requests.get(f"{BASE_URL}/api/rides/support-{uid}/messages",
                          headers={"Authorization": f"Bearer {tok}"})
        msgs = r2.json()["messages"]
        texts = [m["text"] for m in msgs]
        assert unique_text in texts
        # auto-reply: at least one new support message exists after the user msg
        support_msgs = [m for m in msgs if m["sender_role"] == "support"]
        assert len(support_msgs) >= 2

    def test_inbox_lists_support_at_top(self, customer_token):
        tok = customer_token["token"]
        uid = customer_token["user"]["id"]
        r = requests.get(f"{BASE_URL}/api/inbox",
                         headers={"Authorization": f"Bearer {tok}"})
        assert r.status_code == 200
        convos = r.json()["conversations"]
        assert len(convos) >= 1
        top = convos[0]
        assert top["ride_id"] == f"support-{uid}"
        assert top["other_name"] == "Getaride Support"
        assert top.get("is_support") is True

    def test_driver_support_thread(self, driver_token):
        tok = driver_token["token"]
        uid = driver_token["user"]["id"]
        r = requests.post(f"{BASE_URL}/api/support/start",
                          headers={"Authorization": f"Bearer {tok}"})
        assert r.status_code == 200
        # send a message as driver
        r2 = requests.post(f"{BASE_URL}/api/rides/support-{uid}/messages",
                          json={"text": "TEST_driver_help"},
                          headers={"Authorization": f"Bearer {tok}"})
        assert r2.status_code == 200
        time.sleep(0.8)
        r3 = requests.get(f"{BASE_URL}/api/inbox",
                          headers={"Authorization": f"Bearer {tok}"})
        convos = r3.json()["conversations"]
        # support should be at top
        assert convos[0]["ride_id"] == f"support-{uid}"
        assert convos[0]["other_name"] == "Getaride Support"

    def test_admin_conversations_includes_support(self, admin_token, customer_token):
        r = requests.get(f"{BASE_URL}/api/admin/conversations",
                         headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200
        convos = r.json()["conversations"]
        uid = customer_token["user"]["id"]
        match = next((c for c in convos if c["ride_id"] == f"support-{uid}"), None)
        assert match is not None
        assert match["driver_name"] == "Getaride Support"
        assert match.get("is_support") is True
        # customer_name should be the user's name (not "Rider" default)
        assert match["customer_name"]
