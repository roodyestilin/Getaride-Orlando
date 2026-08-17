"""
Iteration 13 backend tests — Card-on-Accept flow (own Stripe TEST keys)

Requirements under test:
1) A customer can REQUEST a ride WITHOUT a saved card (no 402 at POST /rides).
2) Card-on-file is ENABLED (GET /payments/method returns enabled:true).
3) POST /payments/setup-intent returns a card-only client_secret.
4) End-to-end (using Stripe TEST PaymentMethod tokens):
   - Attach a PaymentMethod to the rider (setup-intent -> setup-complete).
   - GET /payments/method returns has_card:true and brand/last4 populated.
   - POST /rides/{id}/select authorizes a hold (payment_status='authorized',
     payment_intent_id set).
   - After trip auto-completes, GET /rides/{id}/track captures the hold
     (payment_status='paid', fare_captured=True, captured_amount set).
"""
import os
import time
import uuid
import pytest
import requests
import stripe

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL",
                          "https://react-native-rides-3.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

RIDER_EMAIL = "rider@getaride.com"
RIDER_PASS = "Ride1234"

# Orlando area coords (MCO airport -> Universal Studios) — well within service area
PICKUP = {"lat": 28.4312, "lng": -81.3081, "label": "Orlando International Airport (MCO)"}
DESTINATION = {"lat": 28.4743, "lng": -81.4678, "label": "Universal Studios Florida"}


# ---------------- shared session ----------------
def _headers(tok):
    return {"Content-Type": "application/json", "Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="module")
def rider_token():
    # Try login; if creds ever rotate we create a fresh account
    r = requests.post(f"{API}/auth/login",
                      json={"email": RIDER_EMAIL, "password": RIDER_PASS}, timeout=15)
    if r.status_code != 200:
        # fallback: register a fresh test rider
        email = f"TEST_iter13_{uuid.uuid4().hex[:6]}@example.com"
        r = requests.post(f"{API}/auth/register", json={
            "email": email, "password": "Ride1234", "name": "Iter13 Rider",
            "role": "customer", "photo": None,
        }, timeout=15)
        assert r.status_code in (200, 201), r.text
    data = r.json()
    return data["token"]


@pytest.fixture(scope="module")
def stripe_secret():
    key = os.environ.get("STRIPE_SECRET_KEY")
    if not key:
        # read backend .env directly
        env_path = "/app/backend/.env"
        if os.path.exists(env_path):
            for line in open(env_path):
                if line.startswith("STRIPE_SECRET_KEY="):
                    key = line.split("=", 1)[1].strip().strip('"').strip("'")
                    break
    if not key or not key.startswith("sk_"):
        pytest.skip("STRIPE_SECRET_KEY not configured")
    stripe.api_key = key
    return key


# ---------------- Tests ----------------
def test_health():
    r = requests.get(f"{API}/", timeout=10)
    assert r.status_code == 200


def test_payments_method_enabled_before_any_card(rider_token):
    """CARD_ON_FILE feature is ON, but this rider may or may not have a card yet."""
    r = requests.get(f"{API}/payments/method", headers=_headers(rider_token), timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("enabled") is True, f"Card-on-file must be enabled, got {body}"
    # `has_card` may be True from a prior run; we don't assert value here.
    assert "has_card" in body


def test_create_ride_without_card_is_allowed(rider_token):
    """
    Requirement (1): ride creation must NOT require a saved card anymore.
    Even if a prior test attached one, the server logic must NOT gate ride
    creation on has_card. We verify status is 200 either way.
    """
    payload = {
        "pickup": PICKUP, "destination": DESTINATION, "vehicle_class": "standard",
        "stops": [], "bags": 0,
    }
    r = requests.post(f"{API}/rides", headers=_headers(rider_token), json=payload, timeout=20)
    assert r.status_code == 200, f"Ride creation should not 402 without card: {r.status_code} {r.text}"
    ride = r.json()["ride"]
    assert ride["status"] == "searching"
    assert ride.get("customer_id")
    # persistence check
    g = requests.get(f"{API}/rides/{ride['id']}", headers=_headers(rider_token), timeout=15)
    assert g.status_code == 200
    assert g.json()["ride"]["id"] == ride["id"]


def test_setup_intent_returns_card_only_secret(rider_token):
    r = requests.post(f"{API}/payments/setup-intent", headers=_headers(rider_token), timeout=20)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("client_secret", "").startswith("seti_"), body
    assert body.get("customer_id", "").startswith("cus_"), body


def _attach_test_card(stripe_secret, client_secret, customer_id):
    """
    Create a Stripe TEST PaymentMethod using the tokenized test card `pm_card_visa`
    and confirm the SetupIntent server-side (no browser Elements needed).
    Returns setup_intent_id.
    """
    si_id = client_secret.split("_secret_")[0]
    # Confirm the SetupIntent with the test payment method token
    si = stripe.SetupIntent.confirm(si_id, payment_method="pm_card_visa")
    assert si.status == "succeeded", f"SetupIntent status {si.status}"
    return si.id


@pytest.fixture(scope="module")
def rider_with_card(rider_token, stripe_secret):
    """Attach a card if the rider doesn't have one; return the same token."""
    r = requests.get(f"{API}/payments/method", headers=_headers(rider_token), timeout=15).json()
    if not r.get("has_card"):
        si_resp = requests.post(f"{API}/payments/setup-intent",
                                headers=_headers(rider_token), timeout=20).json()
        si_id = _attach_test_card(stripe_secret, si_resp["client_secret"], si_resp["customer_id"])
        complete = requests.post(f"{API}/payments/setup-complete",
                                 headers=_headers(rider_token),
                                 json={"setup_intent_id": si_id}, timeout=20)
        assert complete.status_code == 200, complete.text
        body = complete.json()
        assert body.get("has_card") is True
        assert body.get("brand")  # 'visa'
        assert body.get("last4")  # '4242'
    return rider_token


def test_setup_complete_persists_card(rider_with_card):
    r = requests.get(f"{API}/payments/method", headers=_headers(rider_with_card), timeout=15)
    assert r.status_code == 200
    body = r.json()
    assert body["has_card"] is True
    assert body["brand"], body
    assert body["last4"], body


def _create_ride_and_wait_for_offers(token):
    payload = {"pickup": PICKUP, "destination": DESTINATION,
               "vehicle_class": "standard", "stops": [], "bags": 0}
    r = requests.post(f"{API}/rides", headers=_headers(token), json=payload, timeout=20)
    assert r.status_code == 200, r.text
    ride = r.json()["ride"]
    ride_id = ride["id"]
    # Poll offers up to ~10s
    offers = []
    deadline = time.time() + 12
    while time.time() < deadline:
        o = requests.get(f"{API}/rides/{ride_id}/offers",
                         headers=_headers(token), timeout=10).json()
        offers = o.get("offers", [])
        if offers:
            break
        time.sleep(1.0)
    assert offers, "No offers revealed within 12s"
    return ride_id, offers


def test_select_authorizes_hold(rider_with_card):
    ride_id, offers = _create_ride_and_wait_for_offers(rider_with_card)
    offer = offers[0]
    r = requests.post(f"{API}/rides/{ride_id}/select",
                      headers=_headers(rider_with_card),
                      json={"offer_id": offer["id"]}, timeout=25)
    assert r.status_code == 200, r.text
    ride = r.json()["ride"]
    assert ride["status"] == "driver_enroute"
    assert ride.get("payment_status") == "authorized", ride
    assert ride.get("payment_intent_id", "").startswith("pi_"), ride
    assert ride.get("final_fare") == offer["fare"]

    # Persistence via GET
    g = requests.get(f"{API}/rides/{ride_id}", headers=_headers(rider_with_card), timeout=15).json()
    assert g["ride"]["payment_status"] == "authorized"
    assert g["ride"]["payment_intent_id"].startswith("pi_")


def test_full_ride_capture_on_completion(rider_with_card, stripe_secret):
    """
    Create -> select -> wait for the simulated trip to reach 'completed'
    (~85s after accept) then verify capture flipped payment_status to 'paid'.
    """
    ride_id, offers = _create_ride_and_wait_for_offers(rider_with_card)
    offer = offers[0]
    sel = requests.post(f"{API}/rides/{ride_id}/select",
                        headers=_headers(rider_with_card),
                        json={"offer_id": offer["id"]}, timeout=25)
    assert sel.status_code == 200
    pi_id = sel.json()["ride"]["payment_intent_id"]

    # Poll /track for up to 130s
    deadline = time.time() + 130
    last = None
    while time.time() < deadline:
        t = requests.get(f"{API}/rides/{ride_id}/track",
                         headers=_headers(rider_with_card), timeout=15).json()
        last = t
        if t.get("status") == "completed":
            break
        time.sleep(3)
    assert last and last.get("status") == "completed", f"Ride never completed: {last}"

    # Give the capture path one more track call so it can run
    t2 = requests.get(f"{API}/rides/{ride_id}/track",
                      headers=_headers(rider_with_card), timeout=15).json()
    assert t2.get("payment_status") == "paid", t2

    # DB-level assertions via /rides/{id}
    ride = requests.get(f"{API}/rides/{ride_id}",
                        headers=_headers(rider_with_card), timeout=15).json()["ride"]
    assert ride.get("payment_status") == "paid"
    assert ride.get("fare_captured") is True
    assert (ride.get("captured_amount") or 0) > 0

    # Stripe-side check: PaymentIntent captured
    pi = stripe.PaymentIntent.retrieve(pi_id)
    assert pi.status == "succeeded", f"Stripe PI status={pi.status}"
    assert pi.amount_received > 0
