#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: "Rebuild the frontend as a Next.js web app while reusing the existing FastAPI/MongoDB backend (Getaride Orlando ride-sharing). Phase 1 scope: marketing landing, auth (rider + driver signup/login), rider core journey (book ride -> compare driver offers -> select -> live tracking + chat -> rate/tip), and driver core journey (go online -> nearby requests -> bid -> run trip -> earnings). Match existing branding (purple). Mapbox for maps. Tailwind + shadcn-style UI."

metadata:
  created_by: "main_agent"
  version: "1.0"
  test_sequence: 0
  run_ui: false

frontend:
  - task: "Next.js scaffold served on port 3000 (supervisor program 'nextjs'), reuses backend at same-origin /api"
    implemented: true
    working: "NA"
    file: "web/ (Next.js 15 App Router), /etc/supervisor/conf.d/nextjs.conf"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "New Next.js app in /app/web. Expo program stopped; nextjs runs `next dev -p 3000`. Landing renders (screenshot verified). Backend /api reachable via preview (login/me/rides/offers return 200 via curl)."
  - task: "Auth (login + rider/driver signup with base64 photo)"
    implemented: true
    working: "NA"
    file: "web/app/login/page.tsx, web/app/signup/page.tsx, web/src/lib/auth.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "JWT stored in localStorage. Role toggle on signup; photo upload -> base64. Login API verified 200 via curl. Full form click-through needs UI test (screenshot tool interactions were unreliable due to async issue in that tool)."
  - task: "Rider journey: book -> offers -> select -> track -> chat -> rate/tip"
    implemented: true
    working: "NA"
    file: "web/app/rider/*"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Booking form enforces MCO (to/from airport toggle). Offers poll every 2s, tracking every 2.5s, chat every 3s. Backend create-ride + offers verified via curl."
  - task: "Driver journey: online toggle -> requests -> bid -> trip control (arrived/PIN/start/complete) -> earnings"
    implemented: true
    working: "NA"
    file: "web/app/driver/*"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Approval gate for non-approved drivers. Custom-fare bidding within range + Accept Recommended. PIN shown as demo hint (rider simulated). Earnings chart from /driver/earnings."

test_plan:
  current_focus:
    - "Auth (login + rider/driver signup with base64 photo)"
    - "Rider journey: book -> offers -> select -> track -> chat -> rate/tip"
    - "Driver journey: online toggle -> requests -> bid -> trip control -> earnings"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    -agent: "main"
    -message: "Phase 1 Next.js rebuild complete and live on port 3000. Backend UNCHANGED (only installed missing 'sendgrid' dep). Test credentials in /app/memory/test_credentials.md (rider@test.com / driver@test.com, both password Test1234; driver is approved). Please E2E test rider + driver flows through the preview URL root. Note: rides must start or end at MCO; the booking UI enforces this via a to/from airport toggle."