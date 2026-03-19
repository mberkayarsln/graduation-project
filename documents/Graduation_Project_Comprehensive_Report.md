# Graduation Project Comprehensive Documentation

## 1. Project Title and Purpose

**Project Name:** Employee Shuttle Route Optimization and Operations Platform

**Main Objective:**
This project optimizes company shuttle operations end-to-end by:
- Generating and optimizing routes from employee locations
- Assigning employees to practical pickup points
- Managing clusters, routes, and vehicles through an admin panel
- Providing driver and employee mobile experiences for live trip operations
- Producing operational and financial decision-support outputs (including a cost report)

This is a full-stack system with geospatial optimization, web management UI, mobile field apps, and real-time trip communication.

---

## 2. Overall System Architecture

The solution is organized into four primary parts:

1. **Routing Engine Backend**
- Folder: `routing-engine`
- Stack: Python, Flask, PostgreSQL, OSRM, Socket.IO
- Responsibility: route generation, optimization, API layer, realtime trip events, trip history, cost calculation

2. **Admin Web Panel**
- Folder: `routing-engine-admin`
- Stack: React, TypeScript, Vite, Leaflet, Recharts
- Responsibility: operational management, route editing, cluster/vehicle/employee views, dashboard, cost report

3. **Mobile App (Driver + Employee)**
- Folder: `routing-engine-mobile`
- Stack: Expo, React Native, TypeScript, Socket.IO client
- Responsibility: driver navigation/boarding flow, employee tracking/history/profile, local notifications

4. **OSRM Infrastructure**
- Folder: `osrm-data`
- Stack: Docker + OSRM backend
- Responsibility: route, table (distance matrix), nearest-road queries using Turkey map data

---

## 3. Repository and Folder Summary

### 3.1 Backend (`routing-engine`)

Important modules:
- `api/app.py`: Flask API + Socket.IO realtime hub
- `services.py`: Service orchestration pipeline (`ServicePlanner`) and core business logic
- `routing.py`: OSRM integration with local cache support
- `models.py`: domain models (`Employee`, `Cluster`, `Route`, `Vehicle`)
- `db/repositories/*`: data persistence layer
- `config.py`: central optimization and runtime parameters

### 3.2 Admin (`routing-engine-admin`)

Important UI pages:
- `src/pages/Dashboard.tsx`
- `src/pages/Employees.tsx`
- `src/pages/Clusters.tsx`
- `src/pages/Routes.tsx`
- `src/pages/RouteEdit.tsx`
- `src/pages/Vehicles.tsx`
- `src/pages/CostReport.tsx`

### 3.3 Mobile (`routing-engine-mobile`)

Employee module pages:
- `app/(employee)/home.tsx`
- `app/(employee)/tracking.tsx`
- `app/(employee)/history.tsx`
- `app/(employee)/schedule.tsx`
- `app/(employee)/profile.tsx`

Driver module pages:
- `app/(driver)/route.tsx`
- `app/(driver)/navigation.tsx`
- `app/(driver)/trip_summary.tsx`
- `app/(driver)/history.tsx`
- `app/(driver)/profile.tsx`

Shared mobile services:
- `services/api.ts`
- `services/SocketService.ts`
- `services/NotificationService.ts`
- `services/EmployeeRealtimeService.ts`

### 3.4 OSRM (`osrm-data`)

- `docker-compose.yml` runs `osrm-routed` and exposes it at `5001`
- Turkey route graph files are preloaded in this folder

---

## 4. Backend Technical Details

## 4.1 Core Pipeline (`ServicePlanner`)

The route generation pipeline in `services.py` executes the following flow:

1. Load safe pickup points (transit stops)
2. Generate or load employees
3. Create zone partitions (optional, road-barrier aware)
4. Create clusters and enforce vehicle capacity constraints
5. Generate initial route stops
6. Optimize routes using OSRM
7. Match employees to route-side stops
8. Reassign employees across clusters if a closer valid stop exists
9. Assign vehicles by cluster load profile
10. Save all artifacts to PostgreSQL

This pipeline is launched through `main.py`.

## 4.2 Routing and Geospatial Logic

Implemented capabilities include:
- Distance matrix based stop matching
- Cluster-center snapping to nearest drivable road
- Route corridor stop discovery with buffer controls
- Same-side-of-road stop filtering
- Capacity-driven cluster split logic
- Cross-cluster reassignment for high walking distances

## 4.3 API Surface (Flask)

Main API groups in `api/app.py`:

- **Auth/Login**
  - `POST /api/auth/login`

- **System/Optimization**
  - `GET /api/stats`
  - `GET /api/optimization-mode`
  - `POST /api/generate-routes`

- **Employees**
  - `GET /api/employees`
  - `GET /api/employees/<id>`
  - `PUT /api/employees/<id>`
  - `PUT /api/employees/<id>/pickup-point`

- **Routing Data**
  - `GET /api/clusters`
  - `GET /api/clusters/<id>`
  - `GET /api/routes`
  - `GET /api/routes/<cluster_id>`
  - `PUT /api/routes/<cluster_id>`
  - `GET /api/walking-route`
  - `POST /api/stops/names`

- **Vehicles**
  - `GET /api/vehicles`
  - `GET /api/vehicles/<id>`
  - `PUT /api/vehicles/<id>`

- **Cost Reporting**
  - `GET /api/cost-report`

- **Trip History**
  - `POST /api/trips`
  - `GET /api/trips/driver/<driver_id>`
  - `GET /api/trips/employee/<employee_id>`
  - `GET /api/trips/<trip_id>`

## 4.4 Realtime (Socket.IO)

Trip realtime channel model:
- Room model: each route has room `route_<id>`
- Driver emits: `trip_start`, `location_update`, `trip_end`, `boarding_check`
- Employee emits: `boarding_update`
- Server broadcasts: `trip_started`, `trip_update`, `trip_ended`, `boarding_check_started`, `boarding_changed`

---

## 5. Admin Web Panel Details

## 5.1 Frontend Routing

`src/App.tsx` binds all main admin pages under layout routing:
- Dashboard
- Employees
- Clusters
- Routes
- Route Edit
- Vehicles
- Cost Report

## 5.2 Functional Scope

Admin panel supports:
- Operational KPIs and quick health overview
- Employee inclusion/exclusion and pickup management
- Cluster inspection and route metrics
- Route map editing and route stop updates
- Vehicle assignment visibility and updates
- Cost analysis with contract-level economics and sensitivity figures

## 5.3 Cost Report Capability

Cost report includes:
- System metrics (active employees, route/vehicle totals, distance)
- Driver and vehicle monthly breakdown
- Fixed vs variable cost split
- Tax/profit layers and grand total
- Contract projections and per-unit costs (per employee, vehicle, km, trip)
- What-if sensitivity section (fuel/salary/km +10%)

---

## 6. Mobile Application Details

## 6.1 Employee Experience

Employee app supports:
- Home: own route and pickup context
- Live tracking: realtime shuttle movement and status
- Boarding response: confirm/decline
- History: past trips
- Profile/settings/help/report pages
- Schedule screen currently uses static weekly timetable UI

## 6.2 Driver Experience

Driver app supports:
- Assigned route view
- Navigation-style live route execution
- Stop-by-stop boarding checks
- Trip completion/termination flow
- Trip summary and trip history persistence

## 6.3 Mobile Realtime and Notifications

- Socket connection is centralized in `SocketService`
- Local push notifications handled by `NotificationService`
- Employee notifications (trip started / approaching / completed) are now initialized at employee layout level via `EmployeeRealtimeService`, so tracking page does not need to be open

---

## 7. OSRM and Data Layer

## 7.1 OSRM Runtime

`osrm-data/docker-compose.yml` runs:
- Image: `osrm/osrm-backend`
- Service name: `osrm`
- Port mapping: `5001:5000`
- Data source: `turkey-latest.osrm`

## 7.2 Data Persistence

PostgreSQL repositories persist:
- employees
- clusters
- routes
- route_stops
- vehicles
- trip_history
- trip_passengers
- zones and assignment-related tables

Backend supports both generated and DB-loaded operation modes via config flags.

---

## 8. Technology Stack Summary

## 8.1 Backend
- Python 3.x
- Flask + Flask-SocketIO
- psycopg2 / PostgreSQL
- geospatial libs: Shapely, Pyrosm
- scientific stack: NumPy, Pandas, scikit-learn
- OR-Tools (dependency present)

## 8.2 Admin
- React 19
- TypeScript
- Vite
- Leaflet + React Leaflet
- Recharts
- i18next
- jsPDF

## 8.3 Mobile
- Expo + React Native
- Expo Router
- Expo Notifications
- React Native Maps
- Socket.IO client

## 8.4 Infrastructure
- Dockerized OSRM
- OSM map files and preprocessed routing graph

---

## 9. Quality and Validation Status

Latest validation run produced:

1. **Backend tests:**
- `pytest` passed
- 77 tests passed

2. **Admin build:**
- production build succeeded

3. **Mobile lint:**
- no blocking errors
- warnings remain (hook dependency/unused variable style warnings)

Interpretation:
- System is functionally stable for demonstration and advisor review.
- Remaining warnings are mostly code quality hygiene, not immediate blockers.

---

## 10. Known Gaps and Next Roadmap

Current open items (from analysis document):
- Employee schedule page live data integration
- Dashboard chart expansion
- Multi-shift support
- Traffic-aware routing pilot

Practical next sprint proposal:
1. Connect schedule page to backend route departure data
2. Add 2 dashboard analytics charts (distance distribution + cost category split)
3. Introduce traffic-aware ETA calibration for peak/non-peak windows

---

## 11. Demo Walkthrough (For Advisor Presentation)

Recommended demonstration sequence:

1. **Architecture introduction (1-2 min)**
- Explain backend + admin + mobile + OSRM architecture

2. **Optimization run (2-3 min)**
- Trigger route generation
- Show stats update in dashboard

3. **Admin operations (3-4 min)**
- Employees page (inclusion/exclusion)
- Routes page + route edit flow
- Vehicles page assignment view

4. **Cost report (2-3 min)**
- Show monthly and contract totals
- Show sensitivity analysis

5. **Mobile field flow (4-5 min)**
- Driver starts trip
- Employee receives realtime updates and notifications
- Boarding confirmation and trip completion

6. **Trip history verification (1-2 min)**
- Show persisted history on both roles

This sequence demonstrates both algorithmic depth and operational usability.

---

## 12. Final Evaluation

The project already demonstrates:
- Real geospatial optimization pipeline
- End-to-end operational workflow
- Role-based mobile/web user journeys
- Realtime trip communication
- Financial reporting suitable for managerial decision making

In its current state, it is a strong graduation-project-level integrated system and presentation-ready for academic review.
