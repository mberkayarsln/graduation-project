"""
Pytest configuration and shared fixtures for routing engine tests.

Provides:
- Mock configuration objects
- Sample employee, cluster, route, and vehicle data
- Database fixtures (in-memory for testing)
"""

import os
import sys
import pytest
from unittest.mock import Mock, MagicMock
from datetime import datetime

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models import Employee, Cluster, Route, Vehicle
from config import Config


# =============================================================================
# Configuration Fixtures
# =============================================================================

@pytest.fixture
def test_config():
    """Create a test configuration object."""
    config = Mock(spec=Config)
    config.NUM_EMPLOYEES = 100
    config.NUM_CLUSTERS = 10
    config.OFFICE_LOCATION = (41.0082, 28.9784)  # Istanbul, Turkey
    config.OSM_FILE = "data/turkey-latest.osm.pbf"
    config.OPTIMIZATION_PRESETS = {
        "balanced": {
            "EMPLOYEES_PER_CLUSTER": 17,
            "VEHICLE_CAPACITY": 17,
            "MAX_WALK_DISTANCE": 1000,
            "MIN_EMPLOYEES_FOR_SHUTTLE": 1,
        },
        "budget": {
            "EMPLOYEES_PER_CLUSTER": 25,
            "VEHICLE_CAPACITY": 25,
            "MAX_WALK_DISTANCE": 1500,
            "MIN_EMPLOYEES_FOR_SHUTTLE": 5,
        },
        "employee": {
            "EMPLOYEES_PER_CLUSTER": 10,
            "VEHICLE_CAPACITY": 10,
            "MAX_WALK_DISTANCE": 500,
            "MIN_EMPLOYEES_FOR_SHUTTLE": 1,
        },
    }
    config.LOAD_ALL_FROM_DB = False
    config.USE_DATABASE = False
    config.USE_ZONE_PARTITIONING = False
    config.MAX_WALK_DISTANCE = 1000
    config.TRUNCATE_DATABASE_ON_SAVE = False
    return config


# =============================================================================
# Employee Fixtures
# =============================================================================

@pytest.fixture
def sample_employee():
    """Create a single sample employee."""
    emp = Employee(id=1, lat=41.0082, lon=28.9784, name="Employee 1")
    return emp


@pytest.fixture
def sample_employees():
    """Create a list of sample employees with realistic locations in Istanbul."""
    employees = [
        Employee(id=1, lat=41.0082, lon=28.9784, name="Employee 1"),
        Employee(id=2, lat=41.0251, lon=28.9862, name="Employee 2"),
        Employee(id=3, lat=41.0066, lon=28.9927, name="Employee 3"),
        Employee(id=4, lat=41.0125, lon=28.9634, name="Employee 4"),
        Employee(id=5, lat=41.0201, lon=28.9721, name="Employee 5"),
        Employee(id=6, lat=41.0089, lon=28.9654, name="Employee 6"),
        Employee(id=7, lat=41.0145, lon=28.9876, name="Employee 7"),
        Employee(id=8, lat=41.0012, lon=28.9801, name="Employee 8"),
        Employee(id=9, lat=41.0198, lon=28.9732, name="Employee 9"),
        Employee(id=10, lat=41.0156, lon=28.9645, name="Employee 10"),
    ]
    return employees


@pytest.fixture
def excluded_employee():
    """Create an excluded employee."""
    emp = Employee(id=99, lat=41.0082, lon=28.9784, name="Excluded Employee")
    emp.excluded = True
    emp.exclusion_reason = "Out of service area"
    return emp


@pytest.fixture
def employees_with_excluded(sample_employees, excluded_employee):
    """Combine active and excluded employees."""
    return sample_employees + [excluded_employee]


# =============================================================================
# Cluster Fixtures
# =============================================================================

@pytest.fixture
def sample_cluster():
    """Create a single sample cluster."""
    center = (41.0082, 28.9784)
    cluster = Cluster(id=1, center=center)
    return cluster


@pytest.fixture
def cluster_with_employees(sample_cluster, sample_employees):
    """Create a cluster with employees assigned."""
    for emp in sample_employees[:5]:
        sample_cluster.add_employee(emp)
    return sample_cluster


@pytest.fixture
def clusters_list(sample_employees):
    """Create multiple clusters with employees."""
    clusters = []
    
    # Cluster 1: employees 0-3
    c1 = Cluster(id=1, center=(41.0082, 28.9784))
    for emp in sample_employees[0:4]:
        c1.add_employee(emp)
    clusters.append(c1)
    
    # Cluster 2: employees 4-7
    c2 = Cluster(id=2, center=(41.0125, 28.9834))
    for emp in sample_employees[4:8]:
        c2.add_employee(emp)
    clusters.append(c2)
    
    # Cluster 3: employees 8-9
    c3 = Cluster(id=3, center=(41.0156, 28.9645))
    for emp in sample_employees[8:10]:
        c3.add_employee(emp)
    clusters.append(c3)
    
    return clusters


# =============================================================================
# Route Fixtures
# =============================================================================

@pytest.fixture
def sample_route():
    """Create a sample route."""
    route = Route()
    route.stops = [
        (41.0082, 28.9784),
        (41.0125, 28.9834),
        (41.0156, 28.9645),
    ]
    route.coordinates = [
        [41.0082, 28.9784],
        [41.0100, 28.9810],
        [41.0125, 28.9834],
        [41.0140, 28.9740],
        [41.0156, 28.9645],
    ]
    route.distance_km = 2.5
    route.duration_min = 15.0
    route.optimized = True
    return route


@pytest.fixture
def route_with_cluster(cluster_with_employees, sample_route):
    """Create a route assigned to a cluster."""
    sample_route.cluster = cluster_with_employees
    cluster_with_employees.assign_route(sample_route)
    return sample_route


# =============================================================================
# Vehicle Fixtures
# =============================================================================

@pytest.fixture
def sample_minibus():
    """Create a minibus vehicle."""
    vehicle = Vehicle(id=1, capacity=17, vehicle_type="Minibus")
    vehicle.plate_number = "34ABC123"
    vehicle.driver_name = "Driver 1"
    return vehicle


@pytest.fixture
def sample_midibus():
    """Create a midibus vehicle."""
    vehicle = Vehicle(id=2, capacity=27, vehicle_type="Midibus")
    vehicle.plate_number = "34DEF456"
    vehicle.driver_name = "Driver 2"
    return vehicle


@pytest.fixture
def sample_vehicles():
    """Create a fleet of vehicles."""
    vehicles = []
    
    # Minibuses (17 seats)
    for i in range(1, 4):
        v = Vehicle(id=i, capacity=17, vehicle_type="Minibus")
        v.plate_number = f"34ABC{100+i}"
        v.driver_name = f"Driver {i}"
        vehicles.append(v)
    
    # Midibuses (27 seats)
    for i in range(4, 7):
        v = Vehicle(id=i, capacity=27, vehicle_type="Midibus")
        v.plate_number = f"34DEF{100+i}"
        v.driver_name = f"Driver {i}"
        vehicles.append(v)
    
    return vehicles


# =============================================================================
# Service Fixtures
# =============================================================================

@pytest.fixture
def mock_osrm_router():
    """Create a mock OSRM router."""
    router = Mock()
    router.get_route.return_value = {
        'coordinates': [[41.0082, 28.9784], [41.0125, 28.9834], [41.0156, 28.9645]],
        'distance_km': 2.5,
        'duration_min': 15.0,
    }
    router.snap_to_road.return_value = {'lat': 41.0082, 'lon': 28.9784}
    router.get_walking_route.return_value = {
        'distance_m': 350,
        'duration_s': 420,
        'coordinates': [[41.0082, 28.9784], [41.0100, 28.9800]],
    }
    return router


@pytest.fixture
def mock_data_generator():
    """Create a mock data generator."""
    gen = Mock()
    gen.generate.return_value = Mock()
    gen.get_transit_stops.return_value = [
        (41.0082, 28.9784),
        (41.0125, 28.9834),
        (41.0156, 28.9645),
    ]
    gen.get_transit_stops_with_names.return_value = {
        (41.0082, 28.9784): "Stop A",
        (41.0125, 28.9834): "Stop B",
        (41.0156, 28.9645): "Stop C",
    }
    return gen


@pytest.fixture
def mock_database():
    """Create a mock database."""
    db = Mock()
    db.execute.return_value = None
    db.fetch_one.return_value = None
    db.fetch_all.return_value = []
    db.close.return_value = None
    return db


# =============================================================================
# Test Helpers
# =============================================================================

@pytest.fixture
def haversine_distance():
    """Provide haversine distance calculator for tests."""
    from utils import haversine
    return haversine


@pytest.fixture
def create_employees_in_zone():
    """Factory fixture to create employees in a specific zone."""
    def _create(zone_id: int, count: int, lat_center: float, lon_center: float, radius: float = 0.01):
        """Create employees spread in a geographic zone.
        
        Args:
            zone_id: Zone identifier
            count: Number of employees to create
            lat_center: Center latitude
            lon_center: Center longitude
            radius: Spread radius in degrees (default ~1.1km at equator)
        """
        import random
        random.seed(42)
        employees = []
        for i in range(count):
            lat = lat_center + random.uniform(-radius, radius)
            lon = lon_center + random.uniform(-radius, radius)
            emp = Employee(id=len(employees) + 1, lat=lat, lon=lon, name=f"Emp_{zone_id}_{i}")
            emp.zone_id = zone_id
            employees.append(emp)
        return employees
    
    return _create


@pytest.fixture
def assert_employee_in_cluster():
    """Fixture for asserting employee is in cluster."""
    def _assert(employee: Employee, cluster: Cluster):
        assert employee in cluster.employees
        assert employee.cluster_id == cluster.id
    return _assert
