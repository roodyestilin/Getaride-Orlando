from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import math
import random
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
    {"label": "Orlando Intl Airport (MCO)", "lat": 28.4312, "lng": -81.3081},
    {"label": "Universal Studios Florida", "lat": 28.4754, "lng": -81.4685},
    {"label": "Walt Disney World", "lat": 28.3852, "lng": -81.5639},
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
    }


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
    phone: Optional[str] = None
    vehicle: Optional[str] = None
    plate: Optional[str] = None


class LoginReq(BaseModel):
    email: EmailStr
    password: str


class Place(BaseModel):
    label: str
    lat: float
    lng: float


class RideReq(BaseModel):
    pickup: Place
    destination: Place
    stops: List[Place] = []
    when: str = "now"  # now | scheduled
    scheduled_time: Optional[str] = None


class SelectReq(BaseModel):
    offer_id: str


class BidReq(BaseModel):
    fare: float


class StatusReq(BaseModel):
    status: str


class MessageReq(BaseModel):
    text: str


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
    hashed = bcrypt.hashpw(req.password.encode(), bcrypt.gensalt()).decode()
    user = {
        "id": str(uuid.uuid4()),
        "email": req.email.lower(),
        "password": hashed,
        "name": req.name,
        "role": req.role,
        "phone": req.phone,
        "photo": None,
        "rating": 5.0,
        "vehicle": req.vehicle if req.role == "driver" else None,
        "plate": req.plate if req.role == "driver" else None,
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
    fare = compute_fare(req.pickup.dict(), req.destination.dict(), [s.dict() for s in req.stops])
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
        "status": "searching",
        "assigned_driver": None,
        "selected_offer_id": None,
        "accepted_at": None,
        "final_fare": None,
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
    return {**track, "pickup": ride["pickup"], "destination": ride["destination"],
            "assigned_driver": ride.get("assigned_driver")}


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
            **fare,
            "created_at": now_ts(),
            "created_iso": datetime.now(timezone.utc).isoformat(),
        }
        await db.rides.insert_one(ride)


@api_router.post("/driver/online")
async def driver_online(req: StatusReq, user=Depends(get_current_user)):
    online = req.status == "online"
    await db.users.update_one({"id": user["id"]}, {"$set": {"online": online}})
    if online:
        await ensure_driver_requests()
    return {"online": online}


@api_router.get("/driver/requests")
async def driver_requests(user=Depends(get_current_user)):
    if user["role"] != "driver":
        raise HTTPException(403, "Driver only")
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
    if not ride:
        return {"ride": None}
    # auto-accept once accept_at passes
    if ride["status"] == "searching" and ride.get("accept_at") and now_ts() >= ride["accept_at"]:
        await db.rides.update_one({"id": ride["id"]}, {"$set": {"status": "accepted", "accepted_at": now_ts()}})
        ride["status"] = "accepted"
    ride.pop("_id", None)
    return {"ride": ride}


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


@api_router.get("/")
async def root():
    return {"message": "Getaride Orlando API"}


@api_router.get("/places")
async def places(q: str = "", user=Depends(get_current_user)):
    ql = q.lower().strip()
    items = [p for p in ORLANDO_PLACES if ql in p["label"].lower()] if ql else ORLANDO_PLACES
    return {"places": items}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
