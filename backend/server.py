from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header, Request
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import math
import asyncio
import random
import re
import uuid
import time
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import List, Optional

import jwt
import bcrypt
from pydantic import BaseModel, EmailStr, Field

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALG = "HS256"
JWT_EXP_DAYS = 30

from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout, CheckoutSessionRequest,
)
STRIPE_API_KEY = os.environ.get("STRIPE_API_KEY", "")

# --- Card-on-file (own Stripe keys): authorize-on-accept, capture-on-completion ---
import stripe as stripe_sdk
STRIPE_SECRET_KEY = os.environ.get("STRIPE_SECRET_KEY", "").strip()
CARD_ON_FILE_ENABLED = (
    STRIPE_SECRET_KEY.startswith("sk_") and not STRIPE_SECRET_KEY.endswith("emergent")
)
if CARD_ON_FILE_ENABLED:
    stripe_sdk.api_key = STRIPE_SECRET_KEY

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("getaride")

# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------
ORLANDO = {"lat": 28.5384, "lng": -81.3789}

SIM_DRIVERS = [
    {"name": "Marcus Bell", "photo": "https://images.pexels.com/photos/10816007/pexels-photo-10816007.jpeg?auto=compress&cs=tinysrgb&w=300", "rating": 4.9, "vehicle": "Tesla Model 3", "color": "White", "trips": 1840},
    {"name": "Aisha Reed", "photo": "https://images.pexels.com/photos/31869537/pexels-photo-31869537.jpeg?auto=compress&cs=tinysrgb&w=300", "rating": 4.8, "vehicle": "Toyota Camry", "color": "Silver", "trips": 932},
    {"name": "Diego Santos", "photo": "https://images.pexels.com/photos/14589344/pexels-photo-14589344.jpeg?auto=compress&cs=tinysrgb&w=300", "rating": 4.7, "vehicle": "Honda Accord", "color": "Black", "trips": 2210},
    {"name": "Tasha Moore", "photo": "https://images.pexels.com/photos/31869537/pexels-photo-31869537.jpeg?auto=compress&cs=tinysrgb&w=300", "rating": 5.0, "vehicle": "Hyundai Sonata", "color": "Blue", "trips": 410},
    {"name": "Liam Walsh", "photo": "https://images.pexels.com/photos/10816007/pexels-photo-10816007.jpeg?auto=compress&cs=tinysrgb&w=300", "rating": 4.6, "vehicle": "Ford Escape", "color": "Gray", "trips": 1325},
]

SIM_CUSTOMERS = ["Jordan P.", "Emily R.", "Carlos M.", "Nina S.", "Derek T.", "Olivia W."]

ORLANDO_PLACES = [
    {"label": "Orlando Intl Airport (MCO)", "lat": 28.4312, "lng": -81.3081, "airport": True, "iata": "MCO"},
    {"label": "Orlando Sanford Intl Airport (SFB)", "lat": 28.7776, "lng": -81.2375, "airport": True, "iata": "SFB"},
    # Disney resorts
    {"label": "Disney's Grand Floridian Resort & Spa", "lat": 28.4108, "lng": -81.5866},
    {"label": "Disney's Contemporary Resort", "lat": 28.4153, "lng": -81.5739},
    {"label": "Disney's Polynesian Village Resort", "lat": 28.4071, "lng": -81.5829},
    {"label": "Disney's Animal Kingdom Lodge", "lat": 28.3553, "lng": -81.6019},
    {"label": "Disney's Caribbean Beach Resort", "lat": 28.3861, "lng": -81.5497},
    {"label": "Disney's Coronado Springs Resort", "lat": 28.3578, "lng": -81.5727},
    {"label": "Disney's Pop Century Resort", "lat": 28.3527, "lng": -81.5418},
    # Universal & area resorts
    {"label": "Loews Portofino Bay Hotel (Universal)", "lat": 28.4727, "lng": -81.4651},
    {"label": "Hard Rock Hotel (Universal)", "lat": 28.4744, "lng": -81.4671},
    {"label": "Universal's Cabana Bay Beach Resort", "lat": 28.4660, "lng": -81.4628},
    {"label": "Loews Royal Pacific Resort (Universal)", "lat": 28.4690, "lng": -81.4690},
    # Hotels & resorts
    {"label": "Hilton Orlando Bonnet Creek", "lat": 28.3506, "lng": -81.5366},
    {"label": "Waldorf Astoria Orlando", "lat": 28.3470, "lng": -81.5380},
    {"label": "Gaylord Palms Resort & Convention Center", "lat": 28.3380, "lng": -81.5052},
    {"label": "JW Marriott Orlando Grande Lakes", "lat": 28.3811, "lng": -81.4439},
    {"label": "The Ritz-Carlton Orlando, Grande Lakes", "lat": 28.3776, "lng": -81.4416},
    {"label": "Rosen Shingle Creek", "lat": 28.3839, "lng": -81.4290},
    {"label": "Hyatt Regency Orlando", "lat": 28.4256, "lng": -81.4699},
    {"label": "Orlando World Center Marriott", "lat": 28.3618, "lng": -81.5008},
    {"label": "Caribe Royale Orlando", "lat": 28.3573, "lng": -81.4760},
    {"label": "Wyndham Grand Orlando Resort Bonnet Creek", "lat": 28.3502, "lng": -81.5300},
    {"label": "DoubleTree by Hilton Orlando at SeaWorld", "lat": 28.4133, "lng": -81.4615},
    {"label": "Renaissance Orlando at SeaWorld", "lat": 28.4116, "lng": -81.4612},
    {"label": "Hilton Orlando", "lat": 28.4256, "lng": -81.4536},
    {"label": "Marriott's Grande Vista", "lat": 28.4290, "lng": -81.4790},
    {"label": "Floridays Resort Orlando", "lat": 28.3958, "lng": -81.4760},
    {"label": "Westgate Lakes Resort & Spa", "lat": 28.4078, "lng": -81.4880},
    {"label": "Holiday Inn Orlando – Disney Springs Area", "lat": 28.3700, "lng": -81.5180},
    {"label": "Motel 6 Orlando – International Drive", "lat": 28.4500, "lng": -81.4690},
    {"label": "Super 8 by Wyndham Kissimmee/Maingate", "lat": 28.3380, "lng": -81.4810},
    {"label": "Days Inn by Wyndham Orlando International Drive", "lat": 28.4520, "lng": -81.4700},
    # Landmarks
    {"label": "Universal Studios Florida", "lat": 28.4754, "lng": -81.4685},
    {"label": "Universal's Islands of Adventure", "lat": 28.4719, "lng": -81.4716},
    {"label": "Walt Disney World", "lat": 28.3852, "lng": -81.5639},
    {"label": "Disney Springs", "lat": 28.3700, "lng": -81.5180},
    {"label": "SeaWorld Orlando", "lat": 28.4112, "lng": -81.4615},
    {"label": "Orange County Convention Center", "lat": 28.4264, "lng": -81.4690},
    {"label": "Lake Eola Park", "lat": 28.5439, "lng": -81.3729},
    {"label": "Amway Center", "lat": 28.5392, "lng": -81.3839},
    {"label": "Winter Park Village", "lat": 28.5997, "lng": -81.3517},
    {"label": "ICON Park", "lat": 28.4429, "lng": -81.4685},
    {"label": "UCF Main Campus", "lat": 28.6024, "lng": -81.2001},
    {"label": "Orlando Premium Outlets", "lat": 28.4242, "lng": -81.4709},
    {"label": "Dr. Phillips Center", "lat": 28.5378, "lng": -81.3776},
]


def now_ts() -> float:
    return time.time()


def haversine_miles(a, b) -> float:
    R = 3958.8
    lat1, lon1, lat2, lon2 = map(math.radians, [a["lat"], a["lng"], b["lat"], b["lng"]])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return R * 2 * math.asin(math.sqrt(h))


def round_half(x: float) -> float:
    return round(x * 2) / 2


# Service area: trips must start or end at Orlando International Airport (MCO).
SERVICE_RADIUS_MILES = 100.0
MCO = {"lat": 28.4312, "lng": -81.3081}


def path_distance(pickup, destination, stops) -> float:
    pts = [pickup] + list(stops or []) + [destination]
    total = 0.0
    for i in range(len(pts) - 1):
        total += haversine_miles(pts[i], pts[i + 1])
    return total


def compute_fare(pickup, destination, stops):
    dist = max(0.6, path_distance(pickup, destination, stops))
    duration_min = dist / 30.0 * 60.0
    recommended = 2.75 + 1.65 * dist + 0.32 * duration_min
    recommended = max(7.0, round_half(recommended))
    return {
        "distance_miles": round(dist, 1),
        "duration_min": round(duration_min),
        "recommended_fare": recommended,
        "fare_min": round_half(recommended * 0.7),
        "fare_max": round_half(recommended * 1.6),
    }


def interp(a, b, t):
    t = max(0.0, min(1.0, t))
    return {"lat": a["lat"] + (b["lat"] - a["lat"]) * t, "lng": a["lng"] + (b["lng"] - a["lng"]) * t}


def public_user(u: dict) -> dict:
    return {
        "id": u["id"],
        "email": u["email"],
        "name": u["name"],
        "role": u["role"],
        "phone": u.get("phone"),
        "photo": u.get("photo"),
        "rating": u.get("rating", 5.0),
        "vehicle": u.get("vehicle"),
        "plate": u.get("plate"),
        "online": u.get("online", False),
        "approval_status": u.get("approval_status", "approved"),
        "color": u.get("color"),
        "first_name": u.get("first_name"),
        "last_name": u.get("last_name"),
        "vehicle_make": u.get("vehicle_make"),
        "vehicle_model": u.get("vehicle_model"),
        "vehicle_year": u.get("vehicle_year"),
        "license_number": u.get("license_number"),
        "ssn_last4": u.get("ssn_last4"),
        "agreed_terms": u.get("agreed_terms"),
    }


def verify_ssn(ssn: str) -> bool:
    """Structural validation of a US Social Security Number.
    NOTE: This validates the SSN format/structure against official issuance
    rules. A real existence check requires a paid SSA / third-party verification
    service, which is not integrated here."""
    digits = re.sub(r"\D", "", ssn or "")
    if len(digits) != 9:
        return False
    area, group, serial = digits[:3], digits[3:5], digits[5:]
    if area in ("000", "666") or area[0] == "9":
        return False
    if group == "00" or serial == "0000":
        return False
    # Reject obvious placeholders / known invalids.
    if digits in ("078051120", "219099999", "123456789") or len(set(digits)) == 1:
        return False
    return True


def make_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXP_DAYS)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing authorization token")
    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.PyJWTError:
        raise HTTPException(401, "Invalid or expired token")
    user = await db.users.find_one({"id": payload["sub"]})
    if not user:
        raise HTTPException(401, "User not found")
    return user


# --------------------------------------------------------------------------
# Models
# --------------------------------------------------------------------------
class RegisterReq(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str  # customer | driver
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    photo: Optional[str] = None
    vehicle: Optional[str] = None
    plate: Optional[str] = None
    vehicle_make: Optional[str] = None
    vehicle_model: Optional[str] = None
    vehicle_year: Optional[str] = None
    vehicle_color: Optional[str] = None
    license_number: Optional[str] = None
    ssn: Optional[str] = None
    agreed_terms: Optional[bool] = False
    license_doc: Optional[str] = None
    insurance_doc: Optional[str] = None
    registration_doc: Optional[str] = None


class LoginReq(BaseModel):
    email: EmailStr
    password: str


class Place(BaseModel):
    label: str
    lat: float
    lng: float
    airport: Optional[bool] = False


class AirportInfo(BaseModel):
    direction: str  # "to" | "from"
    airline: str
    bags: int = 0
    flight_number: Optional[str] = None
    terminal: Optional[str] = None       # A | B | C (arrival/pickup only)
    baggage_claim: Optional[str] = None  # baggage carousel number (arrival/pickup only)


class RideReq(BaseModel):
    pickup: Place
    destination: Place
    stops: List[Place] = []
    when: str = "now"  # now | scheduled
    scheduled_time: Optional[str] = None
    airport_info: Optional[AirportInfo] = None


class SelectReq(BaseModel):
    offer_id: str


class BidReq(BaseModel):
    fare: float


class StatusReq(BaseModel):
    status: str


class MessageReq(BaseModel):
    text: str


class TipReq(BaseModel):
    amount: float


# --------------------------------------------------------------------------
# AI vehicle image generation (Gemini Nano Banana) — cached per description
# --------------------------------------------------------------------------
async def generate_vehicle_image(desc: str) -> Optional[str]:
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        api_key = os.getenv("EMERGENT_LLM_KEY")
        if not api_key:
            return None
        chat = LlmChat(
            api_key=api_key,
            session_id=f"veh-{uuid.uuid4()}",
            system_message="You generate clean, realistic product photos of cars.",
        )
        chat.with_model("gemini", "gemini-3.1-flash-image-preview").with_params(modalities=["image", "text"])
        prompt = (
            f"A realistic, high-quality photograph of a {desc} car. "
            "Front three-quarter angle, the whole car centered and fully in frame, "
            "parked on a plain soft light-gray studio background, even soft lighting, "
            "no people, no text, no watermark, no license plate text."
        )
        text, images = await chat.send_message_multimodal_response(UserMessage(text=prompt))
        if images:
            img = images[0]
            return f"data:{img['mime_type']};base64,{img['data']}"
    except Exception as e:
        logger.warning(f"vehicle image generation failed: {e}")
    return None


@api_router.get("/vehicle-image")
async def vehicle_image(desc: str, user=Depends(get_current_user)):
    key = " ".join(desc.strip().lower().split())
    if not key:
        raise HTTPException(400, "desc is required")
    cached = await db.vehicle_images.find_one({"key": key})
    if cached and cached.get("image"):
        return {"image": cached["image"], "cached": True}
    image = await generate_vehicle_image(key)
    if image:
        await db.vehicle_images.update_one(
            {"key": key},
            {"$set": {"key": key, "image": image, "created_at": now_ts()}},
            upsert=True,
        )
    return {"image": image, "cached": False}


# --------------------------------------------------------------------------
# Auth routes
# --------------------------------------------------------------------------
@api_router.post("/auth/register")
async def register(req: RegisterReq):
    if req.role not in ("customer", "driver"):
        raise HTTPException(400, "Invalid role")
    existing = await db.users.find_one({"email": req.email.lower()})
    if existing:
        raise HTTPException(409, "An account with this email already exists")
    if not req.photo:
        raise HTTPException(400, "A profile photo is required.")
    hashed = bcrypt.hashpw(req.password.encode(), bcrypt.gensalt()).decode()
    is_driver = req.role == "driver"
    vehicle = req.vehicle
    if is_driver:
        # Vehicle cannot be older than 2010.
        try:
            yr = int(req.vehicle_year or 0)
        except ValueError:
            yr = 0
        if yr < 2010:
            raise HTTPException(400, "Vehicle cannot be older than 2010.")
        # Social Security Number must be present and structurally valid.
        if not verify_ssn(req.ssn or ""):
            raise HTTPException(400, "The Social Security Number could not be verified. Please check and try again.")
        if not req.agreed_terms:
            raise HTTPException(400, "You must accept the Driver Agreement to continue.")
    if not vehicle and is_driver and (req.vehicle_make or req.vehicle_model):
        vehicle = " ".join([p for p in [req.vehicle_year, req.vehicle_make, req.vehicle_model] if p]).strip()
    user = {
        "id": str(uuid.uuid4()),
        "email": req.email.lower(),
        "password": hashed,
        "name": req.name,
        "first_name": req.first_name,
        "last_name": req.last_name,
        "role": req.role,
        "phone": req.phone,
        "photo": req.photo,
        "rating": 5.0,
        "vehicle": vehicle if is_driver else None,
        "plate": req.plate if is_driver else None,
        "color": req.vehicle_color if is_driver else None,
        "vehicle_make": req.vehicle_make if is_driver else None,
        "vehicle_model": req.vehicle_model if is_driver else None,
        "vehicle_year": req.vehicle_year if is_driver else None,
        "license_number": req.license_number if is_driver else None,
        "ssn_last4": (req.ssn or "")[-4:] if is_driver else None,
        "agreed_terms": bool(req.agreed_terms) if is_driver else None,
        "license_doc": req.license_doc if is_driver else None,
        "insurance_doc": req.insurance_doc if is_driver else None,
        "registration_doc": req.registration_doc if is_driver else None,
        "approval_status": "pending" if is_driver else "approved",
        "online": False,
        "created_at": now_ts(),
    }
    await db.users.insert_one(user)
    return {"token": make_token(user["id"]), "user": public_user(user)}


@api_router.post("/auth/login")
async def login(req: LoginReq):
    user = await db.users.find_one({"email": req.email.lower()})
    if not user or not bcrypt.checkpw(req.password.encode(), user["password"].encode()):
        raise HTTPException(401, "Invalid email or password")
    return {"token": make_token(user["id"]), "user": public_user(user)}


@api_router.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return {"user": public_user(user)}


# --------------------------------------------------------------------------
# Customer ride routes
# --------------------------------------------------------------------------
def build_offers(ride: dict) -> List[dict]:
    rec = ride["recommended_fare"]
    pickup = ride["pickup"]
    drivers = random.sample(SIM_DRIVERS, k=min(5, len(SIM_DRIVERS)))
    offers = []
    for i, d in enumerate(drivers):
        # driver starts somewhere near pickup
        start = {"lat": pickup["lat"] + random.uniform(-0.03, 0.03),
                 "lng": pickup["lng"] + random.uniform(-0.03, 0.03)}
        fare = round_half(rec * random.uniform(0.9, 1.38))
        eta = random.randint(2, 9)
        offers.append({
            "id": str(uuid.uuid4()),
            "ride_id": ride["id"],
            "driver": {**d, "id": "sim_" + str(uuid.uuid4())[:8], "start": start},
            "fare": fare,
            "eta_minutes": eta,
            "reveal_at": now_ts() + i * 1.6,  # progressive reveal
            "created_at": now_ts(),
        })
    return offers


@api_router.post("/rides")
async def create_ride(req: RideReq, user=Depends(get_current_user)):
    if user["role"] != "customer":
        raise HTTPException(403, "Only customers can request rides")
    if CARD_ON_FILE_ENABLED and not user.get("default_payment_method"):
        raise HTTPException(402, "Please add a payment method before requesting a ride.")
    # Airport-only service: every trip must start OR end at MCO (Orlando Intl Airport).
    pu, de = req.pickup.dict(), req.destination.dict()
    if (haversine_miles(pu, MCO) > 2.0 and haversine_miles(de, MCO) > 2.0):
        raise HTTPException(400, "All trips must start or end at Orlando International Airport (MCO).")
    fare = compute_fare(pu, de, [s.dict() for s in req.stops])
    ride = {
        "id": str(uuid.uuid4()),
        "source": "customer",
        "customer_id": user["id"],
        "customer_name": user["name"],
        "customer_rating": user.get("rating", 5.0),
        "pickup": req.pickup.dict(),
        "destination": req.destination.dict(),
        "stops": [s.dict() for s in req.stops],
        "when": req.when,
        "scheduled_time": req.scheduled_time,
        "airport_info": req.airport_info.dict() if req.airport_info else None,
        "status": "searching",
        "assigned_driver": None,
        "selected_offer_id": None,
        "accepted_at": None,
        "final_fare": None,
        "tip": 0,
        **fare,
        "created_at": now_ts(),
        "created_iso": datetime.now(timezone.utc).isoformat(),
    }
    await db.rides.insert_one(ride)
    offers = build_offers(ride)
    if offers:
        await db.offers.insert_many(offers)
    ride.pop("_id", None)
    return {"ride": ride}


@api_router.get("/rides/{ride_id}")
async def get_ride(ride_id: str, user=Depends(get_current_user)):
    ride = await db.rides.find_one({"id": ride_id}, {"_id": 0})
    if not ride:
        raise HTTPException(404, "Ride not found")
    return {"ride": ride}


@api_router.get("/rides/{ride_id}/offers")
async def get_offers(ride_id: str, user=Depends(get_current_user)):
    cursor = db.offers.find({"ride_id": ride_id, "reveal_at": {"$lte": now_ts()}}, {"_id": 0})
    offers = await cursor.to_list(20)
    offers.sort(key=lambda o: o["fare"])
    return {"offers": offers[:5]}


@api_router.post("/rides/{ride_id}/select")
async def select_offer(ride_id: str, req: SelectReq, user=Depends(get_current_user)):
    ride = await db.rides.find_one({"id": ride_id})
    if not ride:
        raise HTTPException(404, "Ride not found")
    offer = await db.offers.find_one({"id": req.offer_id, "ride_id": ride_id}, {"_id": 0})
    if not offer:
        raise HTTPException(404, "Offer not found")
    driver = offer["driver"]
    # Authorize a hold on the rider's saved card before assigning the driver.
    auth_pi_id = None
    if CARD_ON_FILE_ENABLED:
        auth_pi_id = await authorize_ride_hold(ride, offer["fare"])
    assigned = {
        "id": driver["id"],
        "name": driver["name"],
        "photo": driver["photo"],
        "rating": driver["rating"],
        "vehicle": driver["vehicle"],
        "color": driver.get("color"),
        "plate": "FL " + str(random.randint(100, 999)) + random.choice("ABCDEFGHJKLMNP"),
        "trips": driver.get("trips", 0),
        "start": driver["start"],
        "eta_minutes": offer["eta_minutes"],
    }
    await db.rides.update_one({"id": ride_id}, {"$set": {
        "status": "driver_enroute",
        "assigned_driver": assigned,
        "selected_offer_id": offer["id"],
        "final_fare": offer["fare"],
        "accepted_at": now_ts(),
        "payment_intent_id": auth_pi_id,
        "payment_status": "authorized" if auth_pi_id else "unpaid",
    }})
    ride = await db.rides.find_one({"id": ride_id}, {"_id": 0})
    return {"ride": ride}


@api_router.post("/rides/{ride_id}/cancel")
async def cancel_ride(ride_id: str, user=Depends(get_current_user)):
    await db.rides.update_one({"id": ride_id}, {"$set": {"status": "cancelled"}})
    return {"ok": True}


@api_router.get("/me/rides")
async def my_rides(user=Depends(get_current_user)):
    if user["role"] == "customer":
        cursor = db.rides.find({"customer_id": user["id"]}, {"_id": 0}).sort("created_at", -1)
    else:
        cursor = db.rides.find({"assigned_driver.id": user["id"]}, {"_id": 0}).sort("created_at", -1)
    rides = await cursor.to_list(100)
    return {"rides": rides}


# --------------------------------------------------------------------------
# Live tracking (simulated driver movement + status progression)
# --------------------------------------------------------------------------
def compute_track(ride: dict) -> dict:
    accepted_at = ride.get("accepted_at")
    driver = ride.get("assigned_driver") or {}
    pickup = ride["pickup"]
    dest = ride["destination"]
    start = driver.get("start", pickup)
    if not accepted_at:
        return {"status": ride["status"], "driver_location": start, "eta_minutes": driver.get("eta_minutes", 0)}
    elapsed = now_ts() - accepted_at
    ENROUTE = 25.0
    ARRIVED = 30.0
    TRIP = 85.0
    if elapsed < ENROUTE:
        status = "driver_enroute"
        loc = interp(start, pickup, elapsed / ENROUTE)
        eta = max(1, round((ENROUTE - elapsed) / 60 * driver.get("eta_minutes", 5) + 1))
    elif elapsed < ARRIVED:
        status = "arrived"
        loc = pickup
        eta = 0
    elif elapsed < TRIP:
        status = "in_progress"
        loc = interp(pickup, dest, (elapsed - ARRIVED) / (TRIP - ARRIVED))
        eta = max(1, round((TRIP - elapsed) / 60 * (ride.get("duration_min") or 10)))
    else:
        status = "completed"
        loc = dest
        eta = 0
    return {"status": status, "driver_location": loc, "eta_minutes": eta}


@api_router.get("/rides/{ride_id}/track")
async def track_ride(ride_id: str, user=Depends(get_current_user)):
    ride = await db.rides.find_one({"id": ride_id})
    if not ride:
        raise HTTPException(404, "Ride not found")
    if ride["status"] in ("searching", "cancelled"):
        return {"status": ride["status"], "driver_location": None, "eta_minutes": 0,
                "pickup": ride["pickup"], "destination": ride["destination"]}
    track = compute_track(ride)
    if track["status"] != ride["status"]:
        await db.rides.update_one({"id": ride_id}, {"$set": {"status": track["status"]}})
        ride["status"] = track["status"]
    # Capture the fare hold (and charge any tip) once the trip completes.
    if track["status"] == "completed" and CARD_ON_FILE_ENABLED and ride.get("payment_intent_id") and not ride.get("fare_captured"):
        await capture_ride_payment(ride)
        ride = await db.rides.find_one({"id": ride_id})
    return {**track, "pickup": ride["pickup"], "destination": ride["destination"],
            "assigned_driver": ride.get("assigned_driver"), "tip": ride.get("tip", 0),
            "final_fare": ride.get("final_fare"), "payment_status": ride.get("payment_status", "unpaid")}


@api_router.post("/rides/{ride_id}/tip")
async def add_tip(ride_id: str, req: TipReq, user=Depends(get_current_user)):
    ride = await db.rides.find_one({"id": ride_id})
    if not ride:
        raise HTTPException(404, "Ride not found")
    if ride.get("customer_id") != user["id"]:
        raise HTTPException(403, "Only the rider can tip on this trip.")
    if ride.get("status") not in ("in_progress", "completed"):
        raise HTTPException(400, "You can tip during the trip or after it's completed.")
    amount = max(0.0, round(float(req.amount), 2))
    await db.rides.update_one({"id": ride_id}, {"$set": {"tip": amount}})
    # If the trip is already completed, charge the tip immediately (off-session).
    if CARD_ON_FILE_ENABLED and amount > 0 and ride.get("status") == "completed" and not ride.get("tip_charged"):
        try:
            await charge_tip({**ride, "tip": amount}, amount)
            await db.rides.update_one({"id": ride_id}, {"$set": {"tip_charged": True}})
            return {"tip": amount, "charged": True}
        except Exception as e:
            logger.warning(f"Tip charge failed for {ride_id}: {e}")
            raise HTTPException(402, "We couldn't charge the tip to your card. Please try again.")
    return {"tip": amount}


# --------------------------------------------------------------------------
# Driver routes
# --------------------------------------------------------------------------
async def ensure_driver_requests():
    open_count = await db.rides.count_documents({"source": "sim", "status": "searching"})
    for _ in range(max(0, 5 - open_count)):
        pickup, dest = random.sample(ORLANDO_PLACES, 2)
        fare = compute_fare(pickup, dest, [])
        ride = {
            "id": str(uuid.uuid4()),
            "source": "sim",
            "customer_id": "sim",
            "customer_name": random.choice(SIM_CUSTOMERS),
            "customer_rating": round(random.uniform(4.3, 5.0), 1),
            "pickup": pickup,
            "destination": dest,
            "stops": [],
            "when": "now",
            "scheduled_time": None,
            "status": "searching",
            "assigned_driver": None,
            "driver_bid": None,
            "accept_at": None,
            "accepted_at": None,
            "final_fare": None,
            "pickup_eta_min": random.randint(2, 9),
            **fare,
            "created_at": now_ts(),
            "created_iso": datetime.now(timezone.utc).isoformat(),
        }
        await db.rides.insert_one(ride)


@api_router.post("/driver/online")
async def driver_online(req: StatusReq, user=Depends(get_current_user)):
    online = req.status == "online"
    if online and user.get("approval_status", "approved") != "approved":
        raise HTTPException(403, "Your driver account is not approved yet. Please wait for Getaride to review your application.")
    if not online:
        # Block going offline while an accepted offer / active trip is underway.
        active = await db.rides.find_one({
            "driver_bid.driver_id": user["id"],
            "status": {"$in": ["accepted", "arrived", "in_progress"]},
        })
        if active:
            raise HTTPException(400, "Finish your active trip before going offline.")
    await db.users.update_one({"id": user["id"]}, {"$set": {"online": online, "online_at": now_ts() if online else None}})
    return {"online": online}


@api_router.get("/driver/requests")
async def driver_requests(user=Depends(get_current_user)):
    if user["role"] != "driver":
        raise HTTPException(403, "Driver only")
    # Give drivers a brief buffer after going online before requests start flowing.
    online_at = user.get("online_at")
    if online_at and (now_ts() - online_at) < 5:
        return {"requests": [], "warming_up": True}
    await ensure_driver_requests()
    cursor = db.rides.find({"source": "sim", "status": "searching", "driver_bid": None},
                           {"_id": 0}).sort("created_at", -1)
    rides = await cursor.to_list(10)
    return {"requests": rides}


@api_router.post("/rides/{ride_id}/bid")
async def driver_bid(ride_id: str, req: BidReq, user=Depends(get_current_user)):
    if user["role"] != "driver":
        raise HTTPException(403, "Driver only")
    ride = await db.rides.find_one({"id": ride_id})
    if not ride:
        raise HTTPException(404, "Ride not found")
    if req.fare < ride["fare_min"] or req.fare > ride["fare_max"]:
        raise HTTPException(400, f"Fare must be between ${ride['fare_min']} and ${ride['fare_max']}")
    assigned = {
        "id": user["id"],
        "name": user["name"],
        "photo": user.get("photo"),
        "rating": user.get("rating", 5.0),
        "vehicle": user.get("vehicle") or "Vehicle",
        "plate": user.get("plate") or "FL000",
        "start": {"lat": ride["pickup"]["lat"] + 0.02, "lng": ride["pickup"]["lng"] + 0.02},
        "eta_minutes": random.randint(3, 8),
    }
    await db.rides.update_one({"id": ride_id}, {"$set": {
        "driver_bid": {"driver_id": user["id"], "fare": req.fare, "at": now_ts()},
        "assigned_driver": assigned,
        "final_fare": req.fare,
        "accept_at": now_ts() + 5,  # simulated customer accepts after 5s
    }})
    return {"ok": True, "accept_in": 5}


@api_router.get("/driver/active")
async def driver_active(user=Depends(get_current_user)):
    ride = await db.rides.find_one({
        "source": "sim",
        "driver_bid.driver_id": user["id"],
        "status": {"$nin": ["completed", "cancelled", "declined"]},
    })
    approval = user.get("approval_status", "approved")
    if not ride:
        return {"ride": None, "online": user.get("online", False), "approval_status": approval}
    # auto-accept once accept_at passes
    if ride["status"] == "searching" and ride.get("accept_at") and now_ts() >= ride["accept_at"]:
        await db.rides.update_one({"id": ride["id"]}, {"$set": {"status": "accepted", "accepted_at": now_ts()}})
        ride["status"] = "accepted"
    ride.pop("_id", None)
    return {"ride": ride, "online": user.get("online", False), "approval_status": approval}


@api_router.post("/rides/{ride_id}/driver-status")
async def driver_status(ride_id: str, req: StatusReq, user=Depends(get_current_user)):
    valid = {"arrived", "in_progress", "completed", "cancelled"}
    if req.status not in valid:
        raise HTTPException(400, "Invalid status")
    await db.rides.update_one({"id": ride_id}, {"$set": {"status": req.status}})
    ride = await db.rides.find_one({"id": ride_id}, {"_id": 0})
    return {"ride": ride}


@api_router.get("/driver/trips")
async def driver_trips(user=Depends(get_current_user)):
    cursor = db.rides.find({"driver_bid.driver_id": user["id"]}, {"_id": 0}).sort("created_at", -1)
    rides = await cursor.to_list(100)
    return {"rides": rides}


# --------------------------------------------------------------------------
# Chat
# --------------------------------------------------------------------------
DRIVER_REPLIES = ["On my way!", "I'll be there in a couple minutes.", "I'm pulling up now.",
                  "No problem, see you soon.", "Thanks, almost there."]
CUSTOMER_REPLIES = ["Great, thank you!", "I'm waiting outside.", "Sounds good.",
                    "See you soon!", "I'm wearing a blue jacket."]


@api_router.get("/rides/{ride_id}/messages")
async def get_messages(ride_id: str, user=Depends(get_current_user)):
    cursor = db.messages.find({"ride_id": ride_id}, {"_id": 0}).sort("at", 1)
    msgs = await cursor.to_list(200)
    return {"messages": msgs}


@api_router.post("/rides/{ride_id}/messages")
async def send_message(ride_id: str, req: MessageReq, user=Depends(get_current_user)):
    msg = {
        "id": str(uuid.uuid4()),
        "ride_id": ride_id,
        "sender_role": user["role"],
        "sender_name": user["name"],
        "text": req.text,
        "at": now_ts(),
    }
    await db.messages.insert_one(msg)
    if ride_id.startswith("support-"):
        # Auto-acknowledge from Getaride Support.
        await db.messages.insert_one({
            "id": str(uuid.uuid4()),
            "ride_id": ride_id,
            "sender_id": "support",
            "sender_role": "support",
            "sender_name": "Getaride Support",
            "text": random.choice(SUPPORT_REPLIES),
            "at": now_ts() + 0.5,
        })
        return {"ok": True}
    # simulated reply from the other side
    if user["role"] == "customer":
        reply_role, reply_name, pool = "driver", "Driver", DRIVER_REPLIES
    else:
        reply_role, reply_name, pool = "customer", "Rider", CUSTOMER_REPLIES
    reply = {
        "id": str(uuid.uuid4()),
        "ride_id": ride_id,
        "sender_role": reply_role,
        "sender_name": reply_name,
        "text": random.choice(pool),
        "at": now_ts() + 0.5,
    }
    await db.messages.insert_one(reply)
    return {"ok": True}


@api_router.get("/driver/earnings")
async def driver_earnings(user=Depends(get_current_user)):
    from datetime import datetime, timedelta
    cursor = db.rides.find({"driver_bid.driver_id": user["id"], "status": "completed"}, {"_id": 0}).sort("created_at", -1)
    rides = await cursor.to_list(300)
    now = datetime.now()
    sow = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    sow_ts = sow.timestamp()
    today_ts = now.replace(hour=0, minute=0, second=0, microsecond=0).timestamp()
    month_ts = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).timestamp()
    labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    days = [{"label": l[0], "full": l, "amount": 0.0} for l in labels]
    week_total = 0.0
    week_trips = 0
    week_minutes = 0
    today_total = 0.0
    today_trips = 0
    month_total = 0.0
    month_trips = 0
    lifetime = 0.0
    breakdown = []
    for r in rides:
        fare = float(r.get("final_fare") or r.get("recommended_fare") or 0)
        tip = float(r.get("tip") or 0)
        earn = fare + tip
        lifetime += earn
        ct = float(r.get("created_at") or 0)
        dur = int(r.get("duration_min") or 0)
        if ct >= sow_ts:
            idx = min(6, max(0, int((ct - sow_ts) // 86400)))
            days[idx]["amount"] = round(days[idx]["amount"] + earn, 2)
            week_total += earn
            week_trips += 1
            week_minutes += dur
        if ct >= today_ts:
            today_total += earn
            today_trips += 1
        if ct >= month_ts:
            month_total += earn
            month_trips += 1
        breakdown.append({
            "id": r["id"], "customer_name": r.get("customer_name"),
            "pickup": r["pickup"]["label"], "destination": r["destination"]["label"],
            "fare": round(fare, 2), "tip": round(tip, 2), "total": round(earn, 2),
            "distance_miles": r.get("distance_miles"), "at": ct,
        })
    return {
        "week_total": round(week_total, 2),
        "week_trips": week_trips,
        "today_total": round(today_total, 2),
        "today_trips": today_trips,
        "month_total": round(month_total, 2),
        "month_trips": month_trips,
        "online_hours": round(week_minutes / 60, 1),
        "points": int(week_total * 2),
        "lifetime": round(lifetime, 2),
        "days": days,
        "trips": breakdown[:40],
    }


# --------------------------------------------------------------------------
# Inbox (conversations) — per-user soft delete; admin always sees everything
# --------------------------------------------------------------------------
@api_router.get("/inbox")
async def inbox(user=Depends(get_current_user)):
    if user["role"] == "driver":
        q = {"driver_bid.driver_id": user["id"]}
    else:
        q = {"customer_id": user["id"]}
    rides = await db.rides.find(q, {"_id": 0}).sort("created_at", -1).to_list(100)
    deletes = await db.conversation_deletes.find({"user_id": user["id"]}, {"_id": 0}).to_list(500)
    del_map = {d["ride_id"]: d["deleted_at"] for d in deletes}
    convos = []
    for r in rides:
        last = await db.messages.find({"ride_id": r["id"]}, {"_id": 0}).sort("at", -1).to_list(1)
        if not last:
            continue
        m = last[0]
        d_at = del_map.get(r["id"])
        if d_at and m["at"] <= d_at:
            continue
        other = (r.get("customer_name") or "Rider") if user["role"] == "driver" else ((r.get("assigned_driver") or {}).get("name") or "Driver")
        convos.append({
            "ride_id": r["id"],
            "other_name": other,
            "last_text": m["text"],
            "last_at": m["at"],
            "route": f'{r["pickup"]["label"]} → {r["destination"]["label"]}',
            "status": r.get("status"),
        })
    convos.sort(key=lambda c: c["last_at"], reverse=True)
    # Surface the user's Support thread (if any messages and not deleted).
    srid = f"support-{user['id']}"
    s_last = await db.messages.find({"ride_id": srid}, {"_id": 0}).sort("at", -1).to_list(1)
    if s_last:
        sm = s_last[0]
        s_del = del_map.get(srid)
        if not (s_del and sm["at"] <= s_del):
            convos.insert(0, {
                "ride_id": srid,
                "other_name": "Getaride Support",
                "last_text": sm["text"],
                "last_at": sm["at"],
                "route": "Support",
                "status": "support",
                "is_support": True,
            })
    return {"conversations": convos}


@api_router.delete("/inbox/{ride_id}")
async def delete_conversation(ride_id: str, user=Depends(get_current_user)):
    await db.conversation_deletes.update_one(
        {"user_id": user["id"], "ride_id": ride_id},
        {"$set": {"user_id": user["id"], "ride_id": ride_id, "deleted_at": now_ts()}},
        upsert=True,
    )
    return {"ok": True}


# --------------------------------------------------------------------------
# Support chat — a dedicated thread per user (ride_id = "support-<user_id>")
# --------------------------------------------------------------------------
SUPPORT_REPLIES = [
    "Thanks for reaching out to Getaride Support! How can we help you today?",
    "We've received your message and a support specialist will follow up shortly.",
    "Got it — we're looking into this for you. Is there anything else we can help with?",
]


@api_router.post("/support/start")
async def support_start(user=Depends(get_current_user)):
    rid = f"support-{user['id']}"
    existing = await db.messages.find_one({"ride_id": rid})
    if not existing:
        await db.messages.insert_one({
            "id": str(uuid.uuid4()),
            "ride_id": rid,
            "sender_id": "support",
            "sender_role": "support",
            "sender_name": "Getaride Support",
            "text": "Hi! 👋 You're chatting with Getaride Support. Tell us how we can help and we'll get right back to you.",
            "at": now_ts(),
        })
    # Make sure it's no longer soft-deleted from the user's inbox.
    await db.conversation_deletes.delete_one({"user_id": user["id"], "ride_id": rid})
    return {"ride_id": rid}


# --------------------------------------------------------------------------
# Admin dashboard
# --------------------------------------------------------------------------
async def require_admin(user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin access only")
    return user


@api_router.get("/admin/overview")
async def admin_overview(admin=Depends(require_admin)):
    drivers = await db.users.count_documents({"role": "driver"})
    customers = await db.users.count_documents({"role": "customer"})
    online = await db.users.count_documents({"role": "driver", "online": True})
    completed = await db.rides.find({"status": "completed", "source": {"$ne": "sim"}}, {"_id": 0}).to_list(2000)
    revenue = sum(float(r.get("final_fare") or 0) + float(r.get("tip") or 0) for r in completed)
    tips = sum(float(r.get("tip") or 0) for r in completed)
    active = await db.rides.count_documents({"source": {"$ne": "sim"}, "status": {"$in": ["accepted", "arrived", "in_progress", "driver_enroute"]}})
    total_rides = await db.rides.count_documents({"source": {"$ne": "sim"}})
    return {
        "drivers": drivers, "customers": customers, "drivers_online": online,
        "total_rides": total_rides, "active_rides": active,
        "completed_trips": len(completed), "revenue": round(revenue, 2), "tips": round(tips, 2),
    }


@api_router.get("/admin/conversations")
async def admin_conversations(admin=Depends(require_admin)):
    ride_ids = await db.messages.distinct("ride_id")
    out = []
    for rid in ride_ids:
        msgs = await db.messages.find({"ride_id": rid}, {"_id": 0}).sort("at", 1).to_list(500)
        if not msgs:
            continue
        if str(rid).startswith("support-"):
            uid = str(rid).split("support-", 1)[1]
            u = await db.users.find_one({"id": uid}, {"_id": 0})
            out.append({
                "ride_id": rid,
                "customer_name": (u or {}).get("name") or "User",
                "driver_name": "Getaride Support",
                "route": f'Support · {(u or {}).get("role", "user")}',
                "is_support": True,
                "messages": msgs,
                "last_at": msgs[-1]["at"],
            })
            continue
        ride = await db.rides.find_one({"id": rid}, {"_id": 0})
        out.append({
            "ride_id": rid,
            "customer_name": (ride or {}).get("customer_name") or "Rider",
            "driver_name": ((ride or {}).get("assigned_driver") or {}).get("name") or "Driver",
            "route": (f'{ride["pickup"]["label"]} → {ride["destination"]["label"]}' if ride else ""),
            "messages": msgs,
            "last_at": msgs[-1]["at"],
        })
    out.sort(key=lambda c: c["last_at"], reverse=True)
    return {"conversations": out}


@api_router.get("/admin/users")
async def admin_users(admin=Depends(require_admin)):
    users = await db.users.find({}, {"_id": 0, "password": 0}).sort("created_at", -1).to_list(500)
    return {"users": users}


@api_router.get("/admin/rides")
async def admin_rides(admin=Depends(require_admin)):
    rides = await db.rides.find({"source": {"$ne": "sim"}}, {"_id": 0}).sort("created_at", -1).to_list(300)
    return {"rides": rides}


class AdminStatusReq(BaseModel):
    status: str  # approved | declined | deactivated | pending


class ProfileUpdateReq(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    vehicle: Optional[str] = None
    plate: Optional[str] = None
    color: Optional[str] = None
    rating: Optional[float] = None


class SupportMsgReq(BaseModel):
    text: str


@api_router.post("/admin/drivers/{driver_id}/status")
async def admin_set_driver_status(driver_id: str, req: AdminStatusReq, admin=Depends(require_admin)):
    if req.status not in ("approved", "declined", "deactivated", "pending"):
        raise HTTPException(400, "Invalid status")
    d = await db.users.find_one({"id": driver_id, "role": "driver"})
    if not d:
        raise HTTPException(404, "Driver not found")
    upd = {"approval_status": req.status}
    if req.status in ("declined", "deactivated", "pending"):
        upd["online"] = False
    await db.users.update_one({"id": driver_id}, {"$set": upd})
    return {"ok": True, "approval_status": req.status}


@api_router.patch("/admin/users/{user_id}")
async def admin_update_user(user_id: str, req: ProfileUpdateReq, admin=Depends(require_admin)):
    u = await db.users.find_one({"id": user_id})
    if not u:
        raise HTTPException(404, "User not found")
    upd = {k: v for k, v in req.dict().items() if v is not None}
    if upd:
        await db.users.update_one({"id": user_id}, {"$set": upd})
    u = await db.users.find_one({"id": user_id})
    return {"ok": True, "user": public_user(u)}


@api_router.get("/admin/rides/{ride_id}")
async def admin_ride_detail(ride_id: str, admin=Depends(require_admin)):
    r = await db.rides.find_one({"id": ride_id}, {"_id": 0})
    if not r:
        raise HTTPException(404, "Ride not found")
    msg_count = await db.messages.count_documents({"ride_id": ride_id})
    return {"ride": r, "message_count": msg_count}


@api_router.get("/admin/live")
async def admin_live(admin=Depends(require_admin)):
    rides = await db.rides.find(
        {"source": {"$ne": "sim"}, "status": {"$in": ["driver_enroute", "arrived", "in_progress", "accepted"]}},
        {"_id": 0},
    ).sort("accepted_at", -1).to_list(100)
    out = []
    for r in rides:
        out.append({
            "id": r["id"], "status": r.get("status"),
            "customer_name": r.get("customer_name"),
            "driver_name": (r.get("assigned_driver") or {}).get("name"),
            "pickup": r["pickup"], "destination": r["destination"],
            "fare": r.get("final_fare") or r.get("recommended_fare"),
        })
    return {"live": out}


@api_router.post("/admin/conversations/{ride_id}/message")
async def admin_support_message(ride_id: str, req: SupportMsgReq, admin=Depends(require_admin)):
    msg = {
        "id": str(uuid.uuid4()), "ride_id": ride_id,
        "sender_id": "support", "sender_role": "support", "sender_name": "Getaride Support",
        "text": req.text, "at": now_ts(),
    }
    await db.messages.insert_one(dict(msg))
    msg.pop("_id", None)
    return {"message": msg}


@api_router.get("/")
async def root():
    return {"message": "Getaride Orlando API"}


@api_router.get("/places")
async def places(q: str = "", user=Depends(get_current_user)):
    ql = q.lower().strip()
    items = [p for p in ORLANDO_PLACES if ql in p["label"].lower()] if ql else ORLANDO_PLACES
    return {"places": items}


# --------------------------------------------------------------------------
# Payments (Stripe Checkout — test mode)
# --------------------------------------------------------------------------
class CheckoutReq(BaseModel):
    ride_id: str
    origin_url: str


def ride_amount_due(ride: dict) -> float:
    """Server-authoritative amount = final fare (or recommended) + tip."""
    fare = ride.get("final_fare") or ride.get("recommended_fare") or 0.0
    tip = ride.get("tip", 0.0) or 0.0
    return round(float(fare) + float(tip), 2)


@api_router.post("/payments/checkout/session")
async def create_checkout_session(req: CheckoutReq, request: Request, user=Depends(get_current_user)):
    ride = await db.rides.find_one({"id": req.ride_id})
    if not ride:
        raise HTTPException(404, "Ride not found")
    if ride.get("customer_id") != user["id"]:
        raise HTTPException(403, "Only the rider can pay for this trip.")
    if ride.get("status") != "completed":
        raise HTTPException(400, "Payment is available once the trip is completed.")
    if ride.get("payment_status") == "paid":
        raise HTTPException(400, "This trip has already been paid.")

    amount = ride_amount_due(ride)
    if amount <= 0:
        raise HTTPException(400, "Nothing to charge for this trip.")

    host_url = req.origin_url.rstrip("/")
    success_url = f"{host_url}/payment-return?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{host_url}/ride/{req.ride_id}"

    stripe = StripeCheckout(api_key=STRIPE_API_KEY)
    session = await stripe.create_checkout_session(CheckoutSessionRequest(
        amount=amount,
        currency="usd",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={"ride_id": req.ride_id, "user_id": user["id"], "kind": "ride_payment"},
    ))

    await db.payment_transactions.insert_one({
        "id": str(uuid.uuid4()),
        "session_id": session.session_id,
        "ride_id": req.ride_id,
        "user_id": user["id"],
        "amount": amount,
        "currency": "usd",
        "payment_status": "initiated",
        "status": "open",
        "created_at": now_ts(),
    })
    return {"url": session.url, "session_id": session.session_id}


@api_router.get("/payments/checkout/status/{session_id}")
async def checkout_status(session_id: str, user=Depends(get_current_user)):
    txn = await db.payment_transactions.find_one({"session_id": session_id})
    if not txn:
        raise HTTPException(404, "Payment session not found")

    stripe = StripeCheckout(api_key=STRIPE_API_KEY)
    result = await stripe.get_checkout_status(session_id)

    # Only transition to paid once; keep updates idempotent.
    if result.payment_status == "paid" and txn.get("payment_status") != "paid":
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {"payment_status": "paid", "status": result.status, "paid_at": now_ts()}},
        )
        await db.rides.update_one(
            {"id": txn["ride_id"]},
            {"$set": {"payment_status": "paid", "paid_amount": txn["amount"], "paid_at": now_ts()}},
        )
    else:
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {"payment_status": result.payment_status, "status": result.status}},
        )

    return {
        "status": result.status,
        "payment_status": result.payment_status,
        "amount_total": result.amount_total,
        "currency": result.currency,
        "ride_id": txn["ride_id"],
    }


@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig = request.headers.get("Stripe-Signature")
    stripe = StripeCheckout(api_key=STRIPE_API_KEY)
    try:
        event = await stripe.handle_webhook(payload, sig)
    except Exception as e:
        logger.warning(f"Stripe webhook error: {e}")
        raise HTTPException(400, "Invalid webhook")
    if event.payment_status == "paid" and event.session_id:
        txn = await db.payment_transactions.find_one({"session_id": event.session_id})
        if txn and txn.get("payment_status") != "paid":
            await db.payment_transactions.update_one(
                {"session_id": event.session_id},
                {"$set": {"payment_status": "paid", "status": "complete", "paid_at": now_ts()}},
            )
            await db.rides.update_one(
                {"id": txn["ride_id"]},
                {"$set": {"payment_status": "paid", "paid_amount": txn["amount"], "paid_at": now_ts()}},
            )
    return {"received": True}


# --------------------------------------------------------------------------
# Card on file (own Stripe keys): SetupIntent + authorize-on-accept + capture
# --------------------------------------------------------------------------
class SetupCompleteReq(BaseModel):
    setup_intent_id: str


async def get_or_create_stripe_customer(user: dict) -> str:
    if user.get("stripe_customer_id"):
        return user["stripe_customer_id"]
    cust = await asyncio.to_thread(
        lambda: stripe_sdk.Customer.create(
            email=user.get("email"), name=user.get("name"),
            metadata={"user_id": user["id"]},
        )
    )
    await db.users.update_one({"id": user["id"]}, {"$set": {"stripe_customer_id": cust.id}})
    return cust.id


@api_router.get("/payments/method")
async def get_payment_method(user=Depends(get_current_user)):
    return {
        "enabled": CARD_ON_FILE_ENABLED,
        "has_card": bool(user.get("default_payment_method")),
        "brand": user.get("card_brand"),
        "last4": user.get("card_last4"),
    }


@api_router.post("/payments/setup-intent")
async def create_setup_intent(user=Depends(get_current_user)):
    if not CARD_ON_FILE_ENABLED:
        raise HTTPException(400, "Card payments are not configured yet.")
    customer_id = await get_or_create_stripe_customer(user)
    si = await asyncio.to_thread(
        lambda: stripe_sdk.SetupIntent.create(
            customer=customer_id,
            automatic_payment_methods={"enabled": True},
            usage="off_session",
            metadata={"user_id": user["id"]},
        )
    )
    return {"client_secret": si.client_secret, "customer_id": customer_id}


@api_router.post("/payments/setup-complete")
async def complete_setup(req: SetupCompleteReq, user=Depends(get_current_user)):
    if not CARD_ON_FILE_ENABLED:
        raise HTTPException(400, "Card payments are not configured yet.")
    si = await asyncio.to_thread(lambda: stripe_sdk.SetupIntent.retrieve(req.setup_intent_id))
    pm_id = si.payment_method
    if not pm_id:
        raise HTTPException(400, "No card was saved. Please try again.")
    customer_id = si.customer or await get_or_create_stripe_customer(user)
    pm = await asyncio.to_thread(lambda: stripe_sdk.PaymentMethod.retrieve(pm_id))
    card = getattr(pm, "card", None)
    brand = card.brand if card else None
    last4 = card.last4 if card else None
    await asyncio.to_thread(
        lambda: stripe_sdk.Customer.modify(
            customer_id, invoice_settings={"default_payment_method": pm_id}
        )
    )
    await db.users.update_one({"id": user["id"]}, {"$set": {
        "stripe_customer_id": customer_id,
        "default_payment_method": pm_id,
        "card_brand": brand,
        "card_last4": last4,
    }})
    return {"has_card": True, "brand": brand, "last4": last4}


async def authorize_ride_hold(ride: dict, fare: float):
    """Place an off-session manual-capture hold for `fare` on the rider's card."""
    customer = await db.users.find_one({"id": ride["customer_id"]})
    pm = (customer or {}).get("default_payment_method")
    cust_id = (customer or {}).get("stripe_customer_id")
    if not pm or not cust_id:
        raise HTTPException(402, "Please add a payment method before accepting an offer.")
    amount_cents = int(round(float(fare) * 100))
    try:
        pi = await asyncio.to_thread(
            lambda: stripe_sdk.PaymentIntent.create(
                amount=amount_cents, currency="usd", customer=cust_id, payment_method=pm,
                confirm=True, off_session=True, capture_method="manual",
                metadata={"ride_id": ride["id"], "kind": "ride_authorization"},
            )
        )
    except Exception as e:
        raise HTTPException(402, "Your card was declined or could not be authorized. Please update your payment method.")
    if pi.status != "requires_capture":
        raise HTTPException(402, "Card authorization failed. Please use a different card.")
    return pi.id


async def capture_ride_payment(ride: dict):
    """Capture the fare hold and charge any tip once the trip is completed (idempotent)."""
    if not CARD_ON_FILE_ENABLED:
        return
    ride_id = ride["id"]
    updates: dict = {}
    pi_id = ride.get("payment_intent_id")
    if pi_id and not ride.get("fare_captured"):
        try:
            pi = await asyncio.to_thread(lambda: stripe_sdk.PaymentIntent.capture(pi_id))
            updates["fare_captured"] = True
            updates["payment_status"] = "paid"
            updates["captured_amount"] = (getattr(pi, "amount_received", 0) or 0) / 100
            updates["paid_at"] = now_ts()
        except Exception as e:
            logger.warning(f"Fare capture failed for {ride_id}: {e}")
    tip = float(ride.get("tip", 0) or 0)
    if tip > 0 and not ride.get("tip_charged"):
        try:
            await charge_tip(ride, tip)
            updates["tip_charged"] = True
        except Exception as e:
            logger.warning(f"Tip charge failed for {ride_id}: {e}")
    if updates:
        await db.rides.update_one({"id": ride_id}, {"$set": updates})


async def charge_tip(ride: dict, amount: float):
    customer = await db.users.find_one({"id": ride["customer_id"]})
    pm = (customer or {}).get("default_payment_method")
    cust_id = (customer or {}).get("stripe_customer_id")
    if not pm or not cust_id:
        raise HTTPException(402, "No saved card to charge the tip.")
    tip_pi = await asyncio.to_thread(
        lambda: stripe_sdk.PaymentIntent.create(
            amount=int(round(amount * 100)), currency="usd", customer=cust_id,
            payment_method=pm, confirm=True, off_session=True,
            metadata={"ride_id": ride["id"], "kind": "tip"},
        )
    )
    await db.rides.update_one({"id": ride["id"]}, {"$set": {"tip_payment_intent_id": tip_pi.id}})
    return tip_pi.id


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def seed_admin():
    existing = await db.users.find_one({"email": "admin@getaride.com"})
    if not existing:
        hashed = bcrypt.hashpw("Admin1234".encode(), bcrypt.gensalt()).decode()
        await db.users.insert_one({
            "id": str(uuid.uuid4()), "email": "admin@getaride.com", "password": hashed,
            "name": "Getaride Admin", "role": "admin", "phone": None, "photo": None,
            "rating": 5.0, "vehicle": None, "plate": None, "online": False, "created_at": now_ts(),
        })


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
