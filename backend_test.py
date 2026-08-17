#!/usr/bin/env python3
"""
Backend API Testing for Getaride Orlando
Tests the refactored endpoints and core regression scenarios
"""
import requests
import time
import json
from typing import Optional

# Backend URL
BASE_URL = "https://fullstack-web-deploy.preview.emergentagent.com/api"

# Test credentials
RIDER_EMAIL = "rider@test.com"
RIDER_PASSWORD = "Test1234"
DRIVER_EMAIL = "driver@test.com"
DRIVER_PASSWORD = "Test1234"
ADMIN_EMAIL = "admin@getaride.com"
ADMIN_PASSWORD = "Admin1234"

# MCO Airport coordinates (required for rides)
MCO_AIRPORT = {
    "label": "Orlando International Airport (MCO)",
    "lat": 28.4312,
    "lng": -81.3081,
    "airport": True
}

# Disney destination
DISNEY_DESTINATION = {
    "label": "Walt Disney World",
    "lat": 28.3852,
    "lng": -81.5639,
    "airport": False
}

class TestResults:
    def __init__(self):
        self.passed = []
        self.failed = []
        self.warnings = []
    
    def add_pass(self, test_name: str, details: str = ""):
        self.passed.append(f"✅ {test_name}" + (f": {details}" if details else ""))
        print(f"✅ PASS: {test_name}" + (f" - {details}" if details else ""))
    
    def add_fail(self, test_name: str, error: str):
        self.failed.append(f"❌ {test_name}: {error}")
        print(f"❌ FAIL: {test_name} - {error}")
    
    def add_warning(self, test_name: str, warning: str):
        self.warnings.append(f"⚠️  {test_name}: {warning}")
        print(f"⚠️  WARNING: {test_name} - {warning}")
    
    def summary(self):
        print("\n" + "="*80)
        print("TEST SUMMARY")
        print("="*80)
        print(f"✅ Passed: {len(self.passed)}")
        print(f"❌ Failed: {len(self.failed)}")
        print(f"⚠️  Warnings: {len(self.warnings)}")
        print("="*80)
        
        if self.failed:
            print("\n❌ FAILED TESTS:")
            for fail in self.failed:
                print(f"  {fail}")
        
        if self.warnings:
            print("\n⚠️  WARNINGS:")
            for warn in self.warnings:
                print(f"  {warn}")
        
        print("\n")
        return len(self.failed) == 0

results = TestResults()

def login(email: str, password: str) -> Optional[str]:
    """Login and return JWT token"""
    try:
        response = requests.post(
            f"{BASE_URL}/auth/login",
            json={"email": email, "password": password},
            timeout=10
        )
        if response.status_code == 200:
            data = response.json()
            return data.get("token")
        else:
            print(f"Login failed for {email}: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"Login exception for {email}: {e}")
        return None

def test_auth():
    """Test authentication for all roles"""
    print("\n" + "="*80)
    print("PRIORITY 2: TESTING AUTHENTICATION")
    print("="*80)
    
    # Test rider login
    rider_token = login(RIDER_EMAIL, RIDER_PASSWORD)
    if rider_token:
        results.add_pass("Rider login", f"Token received: {rider_token[:20]}...")
    else:
        results.add_fail("Rider login", "Failed to get token")
        return None, None, None
    
    # Test driver login
    driver_token = login(DRIVER_EMAIL, DRIVER_PASSWORD)
    if driver_token:
        results.add_pass("Driver login", f"Token received: {driver_token[:20]}...")
    else:
        results.add_fail("Driver login", "Failed to get token")
        return rider_token, None, None
    
    # Test admin login
    admin_token = login(ADMIN_EMAIL, ADMIN_PASSWORD)
    if admin_token:
        results.add_pass("Admin login", f"Token received: {admin_token[:20]}...")
    else:
        results.add_fail("Admin login", "Failed to get token")
        return rider_token, driver_token, None
    
    # Test /auth/me for each role
    for role, token, expected_role in [
        ("rider", rider_token, "customer"),
        ("driver", driver_token, "driver"),
        ("admin", admin_token, "admin")
    ]:
        try:
            response = requests.get(
                f"{BASE_URL}/auth/me",
                headers={"Authorization": f"Bearer {token}"},
                timeout=10
            )
            if response.status_code == 200:
                data = response.json()
                user = data.get("user", {})
                actual_role = user.get("role")
                if actual_role == expected_role:
                    results.add_pass(f"GET /auth/me ({role})", f"Role: {actual_role}")
                else:
                    results.add_fail(f"GET /auth/me ({role})", f"Expected role '{expected_role}', got '{actual_role}'")
            else:
                results.add_fail(f"GET /auth/me ({role})", f"Status {response.status_code}: {response.text}")
        except Exception as e:
            results.add_fail(f"GET /auth/me ({role})", str(e))
    
    return rider_token, driver_token, admin_token

def test_ride_creation_and_offers(rider_token: str):
    """PRIORITY 1: Test ride creation and offers endpoint"""
    print("\n" + "="*80)
    print("PRIORITY 1: TESTING RIDE CREATION & OFFERS")
    print("="*80)
    
    # Create a ride from MCO to Disney
    ride_data = {
        "pickup": MCO_AIRPORT,
        "destination": DISNEY_DESTINATION,
        "stops": [],
        "when": "now",
        "passengers": 2,
        "bags": 2
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/rides",
            json=ride_data,
            headers={"Authorization": f"Bearer {rider_token}"},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            ride = data.get("ride", {})
            ride_id = ride.get("id")
            
            if not ride_id:
                results.add_fail("POST /rides", "No ride ID in response")
                return None
            
            # Verify ride data
            if ride.get("pickup", {}).get("label") == MCO_AIRPORT["label"]:
                results.add_pass("POST /rides - pickup", f"Pickup: {ride['pickup']['label']}")
            else:
                results.add_fail("POST /rides - pickup", f"Pickup mismatch: {ride.get('pickup')}")
            
            if ride.get("destination", {}).get("label") == DISNEY_DESTINATION["label"]:
                results.add_pass("POST /rides - destination", f"Destination: {ride['destination']['label']}")
            else:
                results.add_fail("POST /rides - destination", f"Destination mismatch: {ride.get('destination')}")
            
            if ride.get("status") in ["searching", "scheduled"]:
                results.add_pass("POST /rides - status", f"Status: {ride['status']}")
            else:
                results.add_warning("POST /rides - status", f"Unexpected status: {ride.get('status')}")
            
            results.add_pass("POST /rides", f"Ride created: {ride_id}")
            
            # Test GET /rides/{id}/offers - poll until offers appear
            print("\nPolling for offers (max 15 seconds)...")
            offers = []
            for attempt in range(15):
                try:
                    offers_response = requests.get(
                        f"{BASE_URL}/rides/{ride_id}/offers",
                        headers={"Authorization": f"Bearer {rider_token}"},
                        timeout=10
                    )
                    
                    if offers_response.status_code == 200:
                        offers_data = offers_response.json()
                        offers = offers_data.get("offers", [])
                        
                        if offers:
                            results.add_pass("GET /rides/{id}/offers", f"Found {len(offers)} offers")
                            
                            # Verify offer structure
                            first_offer = offers[0]
                            if "id" in first_offer and "fare" in first_offer and "driver" in first_offer:
                                results.add_pass("GET /rides/{id}/offers - structure", f"Offer has id, fare, driver")
                            else:
                                results.add_fail("GET /rides/{id}/offers - structure", f"Missing fields in offer: {first_offer.keys()}")
                            
                            return ride_id, first_offer.get("id")
                        else:
                            print(f"  Attempt {attempt + 1}: No offers yet...")
                            time.sleep(1)
                    else:
                        results.add_fail("GET /rides/{id}/offers", f"Status {offers_response.status_code}: {offers_response.text}")
                        return ride_id, None
                except Exception as e:
                    results.add_fail("GET /rides/{id}/offers", str(e))
                    return ride_id, None
            
            results.add_fail("GET /rides/{id}/offers", "No offers appeared after 15 seconds")
            return ride_id, None
            
        else:
            results.add_fail("POST /rides", f"Status {response.status_code}: {response.text}")
            return None, None
            
    except Exception as e:
        results.add_fail("POST /rides", str(e))
        return None, None

def test_select_offer(rider_token: str, ride_id: str, offer_id: str):
    """PRIORITY 1: Test selecting an offer"""
    print("\n" + "="*80)
    print("PRIORITY 1: TESTING OFFER SELECTION")
    print("="*80)
    
    try:
        response = requests.post(
            f"{BASE_URL}/rides/{ride_id}/select",
            json={"offer_id": offer_id},
            headers={"Authorization": f"Bearer {rider_token}"},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            ride = data.get("ride", {})
            
            if ride.get("selected_offer_id") == offer_id:
                results.add_pass("POST /rides/{id}/select - offer_id", f"Offer selected: {offer_id}")
            else:
                results.add_fail("POST /rides/{id}/select - offer_id", f"Expected {offer_id}, got {ride.get('selected_offer_id')}")
            
            if ride.get("assigned_driver"):
                results.add_pass("POST /rides/{id}/select - driver", f"Driver assigned: {ride['assigned_driver'].get('name')}")
            else:
                results.add_fail("POST /rides/{id}/select - driver", "No driver assigned")
            
            if ride.get("final_fare"):
                results.add_pass("POST /rides/{id}/select - fare", f"Final fare: ${ride['final_fare']}")
            else:
                results.add_fail("POST /rides/{id}/select - fare", "No final fare set")
            
            results.add_pass("POST /rides/{id}/select", "Offer selected successfully")
            return True
        else:
            results.add_fail("POST /rides/{id}/select", f"Status {response.status_code}: {response.text}")
            return False
    except Exception as e:
        results.add_fail("POST /rides/{id}/select", str(e))
        return False

def test_chat_messages(rider_token: str, ride_id: str):
    """PRIORITY 1: Test chat messages"""
    print("\n" + "="*80)
    print("PRIORITY 1: TESTING CHAT MESSAGES")
    print("="*80)
    
    # Send a message
    test_message = "On my way to pickup location"
    try:
        response = requests.post(
            f"{BASE_URL}/rides/{ride_id}/messages",
            json={"text": test_message},
            headers={"Authorization": f"Bearer {rider_token}"},
            timeout=10
        )
        
        if response.status_code == 200:
            results.add_pass("POST /rides/{id}/messages", f"Message sent: '{test_message}'")
        else:
            results.add_fail("POST /rides/{id}/messages", f"Status {response.status_code}: {response.text}")
            return False
    except Exception as e:
        results.add_fail("POST /rides/{id}/messages", str(e))
        return False
    
    # Wait a moment for simulated reply
    time.sleep(2)
    
    # Get messages
    try:
        response = requests.get(
            f"{BASE_URL}/rides/{ride_id}/messages",
            headers={"Authorization": f"Bearer {rider_token}"},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            messages = data.get("messages", [])
            
            if not messages:
                results.add_fail("GET /rides/{id}/messages", "No messages returned")
                return False
            
            results.add_pass("GET /rides/{id}/messages", f"Retrieved {len(messages)} messages")
            
            # Verify our message is there
            our_message = None
            simulated_reply = None
            for msg in messages:
                if msg.get("text") == test_message and msg.get("sender_role") == "customer":
                    our_message = msg
                elif msg.get("sender_role") == "driver":
                    simulated_reply = msg
            
            if our_message:
                results.add_pass("GET /rides/{id}/messages - persistence", "Sent message persists in conversation")
            else:
                results.add_fail("GET /rides/{id}/messages - persistence", "Sent message not found in conversation")
            
            if simulated_reply:
                results.add_pass("GET /rides/{id}/messages - reply", f"Simulated reply received: '{simulated_reply.get('text')}'")
            else:
                results.add_warning("GET /rides/{id}/messages - reply", "No simulated driver reply found")
            
            return True
        else:
            results.add_fail("GET /rides/{id}/messages", f"Status {response.status_code}: {response.text}")
            return False
    except Exception as e:
        results.add_fail("GET /rides/{id}/messages", str(e))
        return False

def test_inbox(rider_token: str, ride_id: str):
    """PRIORITY 1: Test inbox endpoint (refactored with batched queries)"""
    print("\n" + "="*80)
    print("PRIORITY 1: TESTING INBOX (REFACTORED ENDPOINT)")
    print("="*80)
    
    try:
        response = requests.get(
            f"{BASE_URL}/inbox",
            headers={"Authorization": f"Bearer {rider_token}"},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            conversations = data.get("conversations", [])
            
            results.add_pass("GET /inbox", f"Retrieved {len(conversations)} conversations")
            
            # Find our ride's conversation
            our_convo = None
            for convo in conversations:
                if convo.get("ride_id") == ride_id:
                    our_convo = convo
                    break
            
            if not our_convo:
                results.add_fail("GET /inbox - ride conversation", f"Ride {ride_id} not found in inbox")
                return False
            
            # Verify conversation structure
            if "last_text" in our_convo:
                results.add_pass("GET /inbox - last_text", f"Last text: '{our_convo['last_text'][:50]}...'")
            else:
                results.add_fail("GET /inbox - last_text", "Missing last_text field")
            
            if "route" in our_convo:
                expected_route = f"{MCO_AIRPORT['label']} → {DISNEY_DESTINATION['label']}"
                if our_convo["route"] == expected_route:
                    results.add_pass("GET /inbox - route", f"Route: {our_convo['route']}")
                else:
                    results.add_fail("GET /inbox - route", f"Expected '{expected_route}', got '{our_convo['route']}'")
            else:
                results.add_fail("GET /inbox - route", "Missing route field")
            
            if "other_name" in our_convo:
                results.add_pass("GET /inbox - other_name", f"Other party: {our_convo['other_name']}")
            else:
                results.add_fail("GET /inbox - other_name", "Missing other_name field")
            
            if "last_at" in our_convo:
                results.add_pass("GET /inbox - last_at", f"Timestamp: {our_convo['last_at']}")
            else:
                results.add_fail("GET /inbox - last_at", "Missing last_at field")
            
            return True
        else:
            results.add_fail("GET /inbox", f"Status {response.status_code}: {response.text}")
            return False
    except Exception as e:
        results.add_fail("GET /inbox", str(e))
        return False

def test_admin_conversations(admin_token: str, ride_id: str):
    """PRIORITY 1: Test admin conversations endpoint (refactored with batched queries)"""
    print("\n" + "="*80)
    print("PRIORITY 1: TESTING ADMIN CONVERSATIONS (REFACTORED ENDPOINT)")
    print("="*80)
    
    try:
        response = requests.get(
            f"{BASE_URL}/admin/conversations",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            conversations = data.get("conversations", [])
            
            results.add_pass("GET /admin/conversations", f"Retrieved {len(conversations)} conversations")
            
            # Find our ride's conversation
            our_convo = None
            for convo in conversations:
                if convo.get("ride_id") == ride_id:
                    our_convo = convo
                    break
            
            if not our_convo:
                results.add_fail("GET /admin/conversations - ride", f"Ride {ride_id} not found")
                return False
            
            # Verify conversation structure
            if "messages" in our_convo and isinstance(our_convo["messages"], list):
                msg_count = len(our_convo["messages"])
                results.add_pass("GET /admin/conversations - messages", f"Full message list: {msg_count} messages")
            else:
                results.add_fail("GET /admin/conversations - messages", "Missing or invalid messages field")
            
            if "customer_name" in our_convo:
                results.add_pass("GET /admin/conversations - customer_name", f"Customer: {our_convo['customer_name']}")
            else:
                results.add_fail("GET /admin/conversations - customer_name", "Missing customer_name field")
            
            if "driver_name" in our_convo:
                results.add_pass("GET /admin/conversations - driver_name", f"Driver: {our_convo['driver_name']}")
            else:
                results.add_fail("GET /admin/conversations - driver_name", "Missing driver_name field")
            
            if "route" in our_convo:
                results.add_pass("GET /admin/conversations - route", f"Route: {our_convo['route']}")
            else:
                results.add_fail("GET /admin/conversations - route", "Missing route field")
            
            return True
        else:
            results.add_fail("GET /admin/conversations", f"Status {response.status_code}: {response.text}")
            return False
    except Exception as e:
        results.add_fail("GET /admin/conversations", str(e))
        return False

def test_ride_tracking(rider_token: str, ride_id: str):
    """PRIORITY 2: Test ride tracking"""
    print("\n" + "="*80)
    print("PRIORITY 2: TESTING RIDE TRACKING")
    print("="*80)
    
    try:
        response = requests.get(
            f"{BASE_URL}/rides/{ride_id}/track",
            headers={"Authorization": f"Bearer {rider_token}"},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            
            if "status" in data:
                results.add_pass("GET /rides/{id}/track - status", f"Status: {data['status']}")
            else:
                results.add_fail("GET /rides/{id}/track - status", "Missing status field")
            
            if "driver_location" in data:
                loc = data["driver_location"]
                if isinstance(loc, dict) and "lat" in loc and "lng" in loc:
                    results.add_pass("GET /rides/{id}/track - driver_location", f"Location: ({loc['lat']}, {loc['lng']})")
                else:
                    results.add_fail("GET /rides/{id}/track - driver_location", f"Invalid location format: {loc}")
            else:
                results.add_fail("GET /rides/{id}/track - driver_location", "Missing driver_location field")
            
            results.add_pass("GET /rides/{id}/track", "Tracking data retrieved")
            return True
        else:
            results.add_fail("GET /rides/{id}/track", f"Status {response.status_code}: {response.text}")
            return False
    except Exception as e:
        results.add_fail("GET /rides/{id}/track", str(e))
        return False

def test_driver_flow(driver_token: str):
    """PRIORITY 2: Test driver flow"""
    print("\n" + "="*80)
    print("PRIORITY 2: TESTING DRIVER FLOW")
    print("="*80)
    
    # Test going online
    try:
        response = requests.post(
            f"{BASE_URL}/driver/online",
            json={"status": "online"},
            headers={"Authorization": f"Bearer {driver_token}"},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get("online") == True:
                results.add_pass("POST /driver/online", "Driver went online")
            else:
                results.add_fail("POST /driver/online", f"Expected online=true, got {data}")
        else:
            results.add_fail("POST /driver/online", f"Status {response.status_code}: {response.text}")
            return None
    except Exception as e:
        results.add_fail("POST /driver/online", str(e))
        return None
    
    # Wait for warming up period
    time.sleep(6)
    
    # Test getting requests
    try:
        response = requests.get(
            f"{BASE_URL}/driver/requests",
            headers={"Authorization": f"Bearer {driver_token}"},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            requests_list = data.get("requests", [])
            
            if data.get("warming_up"):
                results.add_warning("GET /driver/requests", "Still warming up")
                return None
            
            results.add_pass("GET /driver/requests", f"Retrieved {len(requests_list)} ride requests")
            
            if not requests_list:
                results.add_warning("GET /driver/requests", "No ride requests available")
                return None
            
            # Try to bid on first request
            first_request = requests_list[0]
            request_id = first_request.get("id")
            fare_min = first_request.get("fare_min", 10)
            fare_max = first_request.get("fare_max", 50)
            bid_fare = (fare_min + fare_max) / 2
            
            try:
                bid_response = requests.post(
                    f"{BASE_URL}/rides/{request_id}/bid",
                    json={"fare": bid_fare},
                    headers={"Authorization": f"Bearer {driver_token}"},
                    timeout=10
                )
                
                if bid_response.status_code == 200:
                    results.add_pass("POST /rides/{id}/bid", f"Bid placed: ${bid_fare} (range: ${fare_min}-${fare_max})")
                    return request_id
                else:
                    results.add_fail("POST /rides/{id}/bid", f"Status {bid_response.status_code}: {bid_response.text}")
                    return None
            except Exception as e:
                results.add_fail("POST /rides/{id}/bid", str(e))
                return None
        else:
            results.add_fail("GET /driver/requests", f"Status {response.status_code}: {response.text}")
            return None
    except Exception as e:
        results.add_fail("GET /driver/requests", str(e))
        return None

def test_admin_endpoints(admin_token: str):
    """PRIORITY 2: Test admin endpoints"""
    print("\n" + "="*80)
    print("PRIORITY 2: TESTING ADMIN ENDPOINTS")
    print("="*80)
    
    # Test admin overview
    try:
        response = requests.get(
            f"{BASE_URL}/admin/overview",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            
            required_fields = ["drivers", "customers", "drivers_online", "total_rides", "active_rides", "completed_trips", "revenue", "tips"]
            missing_fields = [f for f in required_fields if f not in data]
            
            if not missing_fields:
                results.add_pass("GET /admin/overview", f"All fields present: drivers={data['drivers']}, customers={data['customers']}, revenue=${data['revenue']}")
            else:
                results.add_fail("GET /admin/overview", f"Missing fields: {missing_fields}")
        else:
            results.add_fail("GET /admin/overview", f"Status {response.status_code}: {response.text}")
    except Exception as e:
        results.add_fail("GET /admin/overview", str(e))
    
    # Test admin users
    try:
        response = requests.get(
            f"{BASE_URL}/admin/users",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            users = data.get("users", [])
            
            if users:
                results.add_pass("GET /admin/users", f"Retrieved {len(users)} users")
            else:
                results.add_warning("GET /admin/users", "No users returned")
        else:
            results.add_fail("GET /admin/users", f"Status {response.status_code}: {response.text}")
    except Exception as e:
        results.add_fail("GET /admin/users", str(e))

def main():
    print("\n" + "="*80)
    print("GETARIDE ORLANDO - BACKEND API TESTING")
    print("Testing refactored endpoints and core regression")
    print("="*80)
    
    # Test authentication first
    rider_token, driver_token, admin_token = test_auth()
    
    if not rider_token:
        print("\n❌ CRITICAL: Rider authentication failed. Cannot continue with ride tests.")
        results.summary()
        return
    
    # PRIORITY 1: Test refactored endpoints
    ride_id, offer_id = test_ride_creation_and_offers(rider_token)
    
    if ride_id and offer_id:
        test_select_offer(rider_token, ride_id, offer_id)
        test_chat_messages(rider_token, ride_id)
        test_inbox(rider_token, ride_id)
        
        if admin_token:
            test_admin_conversations(admin_token, ride_id)
    else:
        print("\n⚠️  WARNING: Could not complete ride creation/offers tests. Skipping dependent tests.")
    
    # PRIORITY 2: Test core regression
    if ride_id:
        test_ride_tracking(rider_token, ride_id)
    
    if driver_token:
        test_driver_flow(driver_token)
    
    if admin_token:
        test_admin_endpoints(admin_token)
    
    # Print summary
    success = results.summary()
    
    if success:
        print("✅ ALL TESTS PASSED")
    else:
        print("❌ SOME TESTS FAILED - See details above")

if __name__ == "__main__":
    main()
