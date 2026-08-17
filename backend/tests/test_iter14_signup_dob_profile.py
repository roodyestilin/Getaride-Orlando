"""
Iteration 14 backend tests:
- POST /api/auth/register (role=customer): phone + DOB (YYYY-MM-DD) + age >= 18 enforcement
- GET /api/me/profile: total_rides / rating / created_at (customer and driver)
- public_user response now returns date_of_birth + created_at fields
"""
import os
import time
import uuid
import base64
import pytest
import requests

BASE_URL = os.environ.get(
    "EXPO_PUBLIC_BACKEND_URL",
    "https://react-native-rides-3.preview.emergentagent.com",
).rstrip("/")

# 1x1 transparent PNG base64 for the profile photo
TINY_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="


def _rand_email(tag: str) -> str:
    return f"TEST_iter14_{tag}_{uuid.uuid4().hex[:8]}@getaride.com"


class TestCustomerRegistrationDOBEnforcement:
    """Register endpoint DOB / phone / age >= 18 validation for customers"""

    def test_missing_phone_returns_400(self):
        payload = {
            "email": _rand_email("nophone"),
            "password": "Ride1234",
            "first_name": "No",
            "last_name": "Phone",
            "name": "No Phone",
            "role": "customer",
            "photo": TINY_PNG,
            "date_of_birth": "1995-01-01",
            # phone omitted
        }
        r = requests.post(f"{BASE_URL}/api/auth/register", json=payload, timeout=20)
        assert r.status_code == 400, f"Expected 400, got {r.status_code}: {r.text}"
        assert "phone" in r.text.lower()

    def test_under_18_returns_403(self):
        # 5 years ago
        five_yrs_ago = f"{time.gmtime().tm_year - 5}-01-01"
        payload = {
            "email": _rand_email("minor"),
            "password": "Ride1234",
            "first_name": "Too",
            "last_name": "Young",
            "name": "Too Young",
            "role": "customer",
            "photo": TINY_PNG,
            "phone": "4075550123",
            "date_of_birth": five_yrs_ago,
        }
        r = requests.post(f"{BASE_URL}/api/auth/register", json=payload, timeout=20)
        assert r.status_code == 403, f"Expected 403, got {r.status_code}: {r.text}"
        assert "at least 18" in r.text.lower() or "18" in r.text

    def test_valid_adult_registration_returns_token_and_public_user(self):
        payload = {
            "email": _rand_email("adult"),
            "password": "Ride1234",
            "first_name": "Adult",
            "last_name": "Rider",
            "name": "Adult Rider",
            "role": "customer",
            "photo": TINY_PNG,
            "phone": "4075550123",
            "date_of_birth": "1995-06-15",
        }
        r = requests.post(f"{BASE_URL}/api/auth/register", json=payload, timeout=20)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert "token" in data and isinstance(data["token"], str) and data["token"]
        assert "user" in data
        u = data["user"]
        assert u["email"] == payload["email"].lower()
        assert u["role"] == "customer"
        # New public_user fields required by iteration 14
        assert u.get("date_of_birth") == "1995-06-15", f"date_of_birth missing/wrong: {u.get('date_of_birth')}"
        assert u.get("created_at") is not None, "created_at missing from public_user"
        assert isinstance(u["created_at"], (int, float))

    def test_missing_dob_returns_400(self):
        payload = {
            "email": _rand_email("nodob"),
            "password": "Ride1234",
            "first_name": "No",
            "last_name": "Dob",
            "name": "No Dob",
            "role": "customer",
            "photo": TINY_PNG,
            "phone": "4075550123",
            # date_of_birth omitted
        }
        r = requests.post(f"{BASE_URL}/api/auth/register", json=payload, timeout=20)
        assert r.status_code == 400, f"Expected 400 (missing DOB), got {r.status_code}: {r.text}"

    def test_missing_photo_returns_400(self):
        payload = {
            "email": _rand_email("nophoto"),
            "password": "Ride1234",
            "first_name": "No",
            "last_name": "Photo",
            "name": "No Photo",
            "role": "customer",
            "phone": "4075550123",
            "date_of_birth": "1995-01-01",
        }
        r = requests.post(f"{BASE_URL}/api/auth/register", json=payload, timeout=20)
        assert r.status_code == 400, f"Expected 400, got {r.status_code}"
        assert "photo" in r.text.lower()


class TestMeProfileEndpoint:
    """GET /api/me/profile — new endpoint returning stats for account screen"""

    @pytest.fixture(scope="class")
    def customer_token(self):
        r = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "rider@getaride.com", "password": "Ride1234"},
            timeout=20,
        )
        assert r.status_code == 200, f"seeded customer login failed: {r.text}"
        return r.json()["token"]

    @pytest.fixture(scope="class")
    def driver_token(self):
        r = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "driver@getaride.com", "password": "Drive1234"},
            timeout=20,
        )
        assert r.status_code == 200, f"seeded driver login failed: {r.text}"
        return r.json()["token"]

    def test_customer_profile_returns_expected_shape(self, customer_token):
        r = requests.get(
            f"{BASE_URL}/api/me/profile",
            headers={"Authorization": f"Bearer {customer_token}"},
            timeout=20,
        )
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        p = r.json()
        assert "total_rides" in p and isinstance(p["total_rides"], int)
        assert p["total_rides"] >= 0
        assert "rating" in p and isinstance(p["rating"], (int, float))
        assert "created_at" in p and isinstance(p["created_at"], (int, float))

    def test_driver_profile_returns_expected_shape(self, driver_token):
        r = requests.get(
            f"{BASE_URL}/api/me/profile",
            headers={"Authorization": f"Bearer {driver_token}"},
            timeout=20,
        )
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        p = r.json()
        assert isinstance(p["total_rides"], int) and p["total_rides"] >= 0
        assert isinstance(p["rating"], (int, float))
        assert isinstance(p["created_at"], (int, float))

    def test_profile_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/me/profile", timeout=20)
        assert r.status_code in (401, 403), f"Expected 401/403, got {r.status_code}"


class TestRideRequestRegressionSmoke:
    """iter13 regression: ride request works without card (card-on-accept)"""

    def test_create_ride_no_card_ok(self):
        # login as rider
        rl = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "rider@getaride.com", "password": "Ride1234"},
            timeout=20,
        )
        assert rl.status_code == 200
        tok = rl.json()["token"]
        # request a ride (Orlando area lat/lng)
        payload = {
            "pickup": {"label": "Orlando Intl Airport", "address": "Orlando Intl Airport", "lat": 28.4312, "lng": -81.3081},
            "destination": {"label": "Universal Studios Florida", "address": "Universal Studios Florida", "lat": 28.4743, "lng": -81.4676},
        }
        r = requests.post(
            f"{BASE_URL}/api/rides",
            json=payload,
            headers={"Authorization": f"Bearer {tok}"},
            timeout=25,
        )
        assert r.status_code in (200, 201), f"Ride create failed: {r.status_code} {r.text}"
        data = r.json()
        # returns a ride
        assert data.get("id") or (data.get("ride") or {}).get("id"), f"No ride id in response: {data}"
