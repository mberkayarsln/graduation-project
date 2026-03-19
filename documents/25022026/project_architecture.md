# Route Optimization Engine — Architecture Document

## System Overview

The routing engine generates optimized shuttle routes for employees. It takes employee GPS locations, groups them into clusters, finds bus stops along optimal driving paths, and assigns each employee to the nearest stop.

```mermaid
graph LR
    A["OSM Map Data"] --> B["DataGenerator"]
    B --> C["ServicePlanner"]
    C --> D["OSRM Router<br/>:5001"]
    C --> E["PostgreSQL"]
```

---

## Domain Models (`models.py`)

```mermaid
classDiagram
    class Employee {
        +int id
        +float lat, lon
        +str name
        +tuple pickup_point
        +float walking_distance
        +set_pickup_point(lat, lon)
        +distance_to(lat, lon)
    }

    class Cluster {
        +int id
        +tuple center
        +list~Employee~ employees
        +Route route
        +Vehicle vehicle
        +add_employee(employee)
        +get_active_employees()
        +assign_route(route)
        +assign_vehicle(vehicle)
    }

    class Route {
        +list stops
        +list bus_stops
        +list coordinates
        +float distance_km
        +float duration_min
        +find_all_stops_along_route(all_stops)
        +match_employees_to_route(employees)
    }

    class Vehicle {
        +int id
        +int capacity
        +str vehicle_type
        +str driver_name
    }

    Cluster "1" --> "*" Employee : contains
    Cluster "1" --> "1" Route : has
    Cluster "1" --> "1" Vehicle : assigned
```

---

## Route Generation Pipeline

The `ServicePlanner` class orchestrates the full pipeline:

```mermaid
flowchart TD
    A["1. generate_employees()"] --> B["2. create_zones()"]
    B --> C["3. create_clusters()"]
    C --> D["4. generate_stops()"]
    D --> E["5. optimize_routes()"]
    E --> F["6. reassign_employees()"]
    F --> G["7. assign_vehicles()"]
    G --> H["8. save_to_db()"]

    style A fill:#E8F5E9
    style H fill:#E3F2FD
```

### Step-by-Step

| # | Method | Service Used | What It Does |
|---|--------|-------------|-------------|
| 1 | `generate_employees()` | LocationService | Generates random employee locations within OSM residential areas, or loads from database |
| 2 | `create_zones()` | ZoneService | Splits the map into walkable zones using major road barriers (highways, motorways) so employees don't have to cross them |
| 3 | `create_clusters()` | ClusteringService | Groups employees within each zone using **KMeans clustering**, then enforces vehicle capacity constraints |
| 4 | `generate_stops()` | Route | Finds real bus stops (from OSM) that fall within a buffer of each cluster's route path |
| 5 | `optimize_routes()` | RoutingService → OSRM | Sends stop coordinates to OSRM to get the optimal driving route (distance, duration, polyline) |
| 6 | `reassign_employees()` | ServicePlanner | If an employee is too far from their assigned stop, checks if a closer stop exists on a neighboring cluster's route |
| 7 | `assign_vehicles()` | ServicePlanner | Creates a vehicle for each cluster based on `VEHICLE_CAPACITY` |
| 8 | `save_to_db()` | Repositories | Persists employees, clusters, routes, vehicles, and zones to PostgreSQL |

---

## Service Responsibilities

### LocationService
Generates employee locations using OpenStreetMap data.
- `generate_employees(count)` — random points within residential areas
- `get_transit_stops()` — extracts bus stop coordinates from OSM

### ClusteringService
Groups employees into shuttle-sized clusters.
- `cluster_employees(employees, n)` — KMeans on GPS coordinates
- `cluster_by_zones(zones)` — per-zone clustering
- `snap_centers_to_roads(clusters)` — moves cluster centers to the nearest road via OSRM
- `enforce_capacity_constraints(clusters, cap)` — splits oversized clusters

### RoutingService
Calculates optimized driving routes.
- `optimize_cluster_route(cluster)` — sends cluster stops to OSRM, gets the optimal route with coordinates, distance, and duration

### ZoneService
Partitions the map using road barriers.
- `load_barrier_roads()` — extracts highway/motorway geometries from OSM
- `create_zones(employees)` — Voronoi-like partitioning around barriers
- `assign_employees_to_zones(employees)` — assigns zone_id to each employee

---

## OSRM Router (`routing.py`)

Communicates with the self-hosted OSRM Docker container.

| Method | Purpose |
|--------|---------|
| `get_route(points, profile)` | Optimal route through waypoints → returns `{coordinates, distance_km, duration_min}` |
| `get_distance_matrix(origins, dests)` | Walking distance matrix between employees and stops |
| `snap_to_road(lat, lon)` | Snaps a coordinate to the nearest road |

Results are cached in `APICache` (file-based JSON) to avoid redundant API calls.

---

## Key Algorithms

### Employee-to-Stop Matching (`Route.match_employees_to_route`)

```mermaid
flowchart TD
    A["For each employee"] --> B["Find nearest bus stop<br/>on the route"]
    B --> C{"Walking distance<br/>< MAX_WALK_DISTANCE?"}
    C -->|Yes| D["Assign employee<br/>to that stop"]
    C -->|No| E["Check neighboring<br/>cluster routes"]
    E --> F{"Found closer stop?"}
    F -->|Yes| G["Reassign to<br/>other cluster"]
    F -->|No| H["Keep original<br/>assignment"]
```

### Bus Stop Discovery (`Route.find_all_stops_along_route`)
1. Build a Shapely `LineString` from route coordinates
2. Buffer the line by `ROUTE_STOP_BUFFER_METERS` (default: 30m)
3. Filter all OSM bus stops that fall within the buffer
4. Optionally filter to same-side-of-road stops only
5. Order stops by position along the route

---

## Configuration (`config.py`)

| Parameter | Default | Description |
|-----------|---------|-------------|
| `NUM_EMPLOYEES` | 500 | Employees to generate |
| `EMPLOYEES_PER_CLUSTER` | 17 | Max per shuttle |
| `MAX_WALK_DISTANCE` | 1000m | Max walk to a stop |
| `ROUTE_STOP_BUFFER_METERS` | 15m | Distance from route to assign stops |
| `BUS_STOP_DISCOVERY_BUFFER_METERS` | 30m | Distance to discover stops along route |
| `OPTIMIZATION_MODE` | balanced | `budget` / `balanced` / `employee` |

### Optimization Modes

| Mode | Cluster Size | Walk Distance | Effect |
|------|-------------|---------------|--------|
| **budget** | 25 | 1500m | Fewer vehicles, longer walks |
| **balanced** | 17 | 1000m | Default |
| **employee** | 10 | 500m | More vehicles, shorter walks |

---

## Data Flow

```mermaid
sequenceDiagram
    participant SP as ServicePlanner
    participant LS as LocationService
    participant ZS as ZoneService
    participant CS as ClusteringService
    participant RS as RoutingService
    participant OSRM as OSRM Server
    participant DB as PostgreSQL

    SP->>LS: generate_employees(500)
    LS-->>SP: List of Employee objects

    SP->>ZS: create_zones(employees)
    ZS-->>SP: Zone assignments

    SP->>CS: cluster_by_zones(zones)
    CS->>OSRM: snap_to_road() for each center
    CS-->>SP: List of Cluster objects

    loop For each cluster
        SP->>RS: optimize_cluster_route(cluster)
        RS->>OSRM: get_route(stops)
        OSRM-->>RS: coordinates + distance + duration
        RS-->>SP: Optimized Route
    end

    SP->>SP: reassign_employees_to_closer_routes()
    SP->>SP: assign_vehicles()
    SP->>DB: save_to_db()
```

---

## Database Schema

```mermaid
erDiagram
    employees {
        int id PK
        varchar name
        float lat
        float lon
        int cluster_id FK
        int zone_id FK
        float pickup_lat
        float pickup_lon
        float walking_distance
        boolean excluded
    }

    clusters {
        int id PK
        float center_lat
        float center_lon
        int zone_id FK
    }

    routes {
        int id PK
        int cluster_id FK
        json stops
        json bus_stops
        json coordinates
        float distance_km
        float duration_min
    }

    vehicles {
        int id PK
        int cluster_id FK
        int capacity
        varchar vehicle_type
        varchar driver_name
    }

    zones {
        int id PK
        json geometry
    }

    clusters ||--o{ employees : "has"
    clusters ||--|| routes : "has"
    clusters ||--|| vehicles : "assigned"
    zones ||--o{ clusters : "contains"
    zones ||--o{ employees : "contains"
```
