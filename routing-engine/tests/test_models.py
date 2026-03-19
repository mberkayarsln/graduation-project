"""
Unit tests for domain models: Employee, Cluster, Route, Vehicle

Tests:
- Employee location management and exclusion logic
- Cluster membership and capacity
- Route optimization and matching
- Vehicle assignment
"""

import pytest
import math
from models import Employee, Cluster, Route, Vehicle


# =============================================================================
# Employee Tests
# =============================================================================

class TestEmployee:
    """Test suite for Employee model."""
    
    def test_employee_creation(self, sample_employee):
        """Test creating an employee."""
        assert sample_employee.id == 1
        assert sample_employee.lat == 41.0082
        assert sample_employee.lon == 28.9784
        assert sample_employee.name == "Employee 1"
        assert sample_employee.excluded is False
    
    def test_employee_default_name(self):
        """Test employee gets default name if not provided."""
        emp = Employee(id=5, lat=41.0, lon=28.9)
        assert "Employee" in emp.name
    
    def test_employee_exclusion(self, sample_employee):
        """Test excluding an employee."""
        sample_employee.excluded = True
        sample_employee.exclusion_reason = "Out of service"
        assert sample_employee.excluded is True
        assert sample_employee.exclusion_reason == "Out of service"
    
    def test_employee_pickup_point(self, sample_employee):
        """Test setting pickup point."""
        sample_employee.set_pickup_point(41.0100, 28.9800, type="stop", walking_distance=250)
        assert sample_employee.pickup_point == (41.0100, 28.9800)
        assert sample_employee.walking_distance == 250
    
    def test_employee_distance_calculation(self, sample_employee, haversine_distance):
        """Test distance calculation between employees."""
        other_lat, other_lon = 41.0100, 28.9800
        distance = sample_employee.distance_to(other_lat, other_lon)
        
        # Verify it returns a positive number (in meters)
        assert distance > 0
        assert isinstance(distance, float)
        
        # Distance should be similar to haversine result
        expected = haversine_distance(sample_employee.lat, sample_employee.lon, other_lat, other_lon)
        assert abs(distance - expected) < 1  # Allow small floating point difference
    
    def test_employee_get_location(self, sample_employee):
        """Test getting employee location as tuple."""
        location = sample_employee.get_location()
        assert location == (41.0082, 28.9784)
    
    def test_employee_cluster_assignment(self, sample_employee):
        """Test employee cluster assignment."""
        assert sample_employee.cluster_id is None
        
        cluster = Cluster(id=1, center=(41.0082, 28.9784))
        cluster.add_employee(sample_employee)
        
        assert sample_employee.cluster_id == 1
        assert sample_employee in cluster.employees
    
    def test_employee_zone_assignment(self, sample_employee):
        """Test employee zone assignment."""
        sample_employee.zone_id = 5
        assert sample_employee.zone_id == 5
    
    def test_employee_repr(self, sample_employee):
        """Test employee string representation."""
        repr_str = repr(sample_employee)
        assert "Employee" in repr_str
        assert "1" in repr_str


# =============================================================================
# Cluster Tests
# =============================================================================

class TestCluster:
    """Test suite for Cluster model."""
    
    def test_cluster_creation(self, sample_cluster):
        """Test creating a cluster."""
        assert sample_cluster.id == 1
        assert sample_cluster.center == (41.0082, 28.9784)
        assert len(sample_cluster.employees) == 0
    
    def test_cluster_add_employee(self, sample_cluster, sample_employee):
        """Test adding employee to cluster."""
        sample_cluster.add_employee(sample_employee)
        
        assert sample_employee in sample_cluster.employees
        assert sample_employee.cluster_id == sample_cluster.id
    
    def test_cluster_add_multiple_employees(self, sample_cluster, sample_employees):
        """Test adding multiple employees."""
        for emp in sample_employees:
            sample_cluster.add_employee(emp)
        
        assert len(sample_cluster.employees) == len(sample_employees)
        for emp in sample_employees:
            assert emp.cluster_id == sample_cluster.id
    
    def test_cluster_get_active_employees(self, sample_cluster, employees_with_excluded):
        """Test getting only active (non-excluded) employees."""
        for emp in employees_with_excluded:
            sample_cluster.add_employee(emp)
        
        active = sample_cluster.get_active_employees()
        assert len(active) == len(employees_with_excluded) - 1  # One is excluded
        
        for emp in active:
            assert emp.excluded is False
    
    def test_cluster_get_employee_count(self, cluster_with_employees):
        """Test getting employee count."""
        assert cluster_with_employees.get_employee_count(include_excluded=False) == 5
    
    def test_cluster_get_employee_count_with_excluded(self, sample_cluster, employees_with_excluded):
        """Test employee count including/excluding excluded employees."""
        for emp in employees_with_excluded:
            sample_cluster.add_employee(emp)
        
        # Without excluded
        active_count = sample_cluster.get_employee_count(include_excluded=False)
        assert active_count == 10  # 10 active + 1 excluded
        
        # With excluded
        total_count = sample_cluster.get_employee_count(include_excluded=True)
        assert total_count == 11
    
    def test_cluster_get_employee_locations(self, cluster_with_employees):
        """Test getting all locations in cluster."""
        locations = cluster_with_employees.get_employee_locations(include_excluded=False)
        
        assert len(locations) == 5
        for loc in locations:
            assert isinstance(loc, tuple)
            assert len(loc) == 2  # (lat, lon)
    
    def test_cluster_assign_route(self, sample_cluster, sample_route):
        """Test assigning route to cluster."""
        sample_cluster.assign_route(sample_route)
        
        assert sample_cluster.route == sample_route
        assert sample_route.cluster == sample_cluster
    
    def test_cluster_assign_vehicle(self, sample_cluster, sample_minibus):
        """Test assigning vehicle to cluster."""
        sample_cluster.assign_vehicle(sample_minibus)
        
        assert sample_cluster.vehicle == sample_minibus
        assert sample_minibus.cluster == sample_cluster
    
    def test_cluster_set_stops(self, sample_cluster, sample_employees):
        """Test setting stops for cluster."""
        stops = [(41.0082, 28.9784), (41.0125, 28.9834)]
        assignments = [0, 1, 0, 1, 0]  # Which stop each employee uses
        stop_loads = [3, 2]  # Passengers at each stop
        
        # Add employees first
        for emp in sample_employees[:5]:
            sample_cluster.add_employee(emp)
        
        sample_cluster.set_stops(stops, assignments, stop_loads)
        
        assert sample_cluster.stops == stops
        assert sample_cluster.stop_loads == stop_loads
        assert len(sample_cluster.stop_assignments) == 5
    
    def test_cluster_has_stops(self, sample_cluster):
        """Test checking if cluster has stops."""
        assert sample_cluster.has_stops() is False
        
        sample_cluster.stops = [(41.0082, 28.9784)]
        assert sample_cluster.has_stops() is True
    
    def test_cluster_repr(self, cluster_with_employees):
        """Test cluster string representation."""
        repr_str = repr(cluster_with_employees)
        assert "Cluster" in repr_str
        assert "1" in repr_str
        assert "5" in repr_str


# =============================================================================
# Route Tests
# =============================================================================

class TestRoute:
    """Test suite for Route model."""
    
    def test_route_creation(self):
        """Test creating a route."""
        route = Route()
        assert route.cluster is None
        assert route.distance_km == 0.0
        assert route.duration_min == 0.0
        assert route.optimized is False
    
    def test_route_with_cluster(self, route_with_cluster, cluster_with_employees):
        """Test route assigned to cluster."""
        assert route_with_cluster.cluster == cluster_with_employees
    
    def test_route_set_stops(self, sample_route):
        """Test setting route stops."""
        stops = [(41.0082, 28.9784), (41.0125, 28.9834), (41.0156, 28.9645)]
        sample_route.set_stops(stops)
        
        assert sample_route.stops == stops
    
    def test_route_calculate_stats_from_stops(self):
        """Test calculating route stats from stops."""
        route = Route()
        stops = [
            (41.0082, 28.9784),  # Istanbul
            (41.0125, 28.9834),
            (41.0156, 28.9645),
        ]
        route.set_stops(stops)
        route.calculate_stats_from_stops()
        
        assert route.distance_km > 0
        assert route.duration_min > 0
    
    def test_route_calculate_stats_empty_stops(self):
        """Test calculating stats with empty stops."""
        route = Route()
        route.set_stops([])
        route.calculate_stats_from_stops()
        
        assert route.distance_km == 0
        assert route.duration_min == 0
    
    def test_route_calculate_stats_single_stop(self):
        """Test calculating stats with only one stop."""
        route = Route()
        route.set_stops([(41.0082, 28.9784)])
        route.calculate_stats_from_stops()
        
        assert route.distance_km == 0
        assert route.duration_min == 0
    
    def test_route_find_all_stops_along_route(self, sample_route):
        """Test finding stops along route.
        
        This tests the geometry-based stop finding with buffer.
        """
        all_stops = [
            (41.0082, 28.9784),  # Start - should be included
            (41.0100, 28.9810),  # Near route - should be included within buffer
            (41.0156, 28.9645),  # End - should be included
            (41.5, 29.5),         # Far away - should not be included
        ]
        
        found_stops = sample_route.find_all_stops_along_route(
            all_stops, 
            buffer_meters=500,
            same_side_only=False
        )
        
        # Should find at least the start and end points
        assert len(found_stops) >= 2
        
        # Far stop should not be included
        assert (41.5, 29.5) not in found_stops
    
    def test_route_properties(self, sample_route):
        """Test route properties."""
        assert sample_route.distance_km == 2.5
        assert sample_route.duration_min == 15.0
        assert sample_route.optimized is True
        assert sample_route.has_traffic_data is False


# =============================================================================
# Vehicle Tests
# =============================================================================

class TestVehicle:
    """Test suite for Vehicle model."""
    
    def test_vehicle_creation_minibus(self, sample_minibus):
        """Test creating a minibus."""
        assert sample_minibus.id == 1
        assert sample_minibus.plate_number == "34ABC123"
        assert sample_minibus.capacity == 17
        assert sample_minibus.vehicle_type == "Minibus"
        assert sample_minibus.driver_name == "Driver 1"
    
    def test_vehicle_creation_midibus(self, sample_midibus):
        """Test creating a midibus."""
        assert sample_midibus.id == 2
        assert sample_midibus.plate_number == "34DEF456"
        assert sample_midibus.capacity == 27
        assert sample_midibus.vehicle_type == "Midibus"
        assert sample_midibus.driver_name == "Driver 2"
    
    def test_vehicle_plate_number_uniqueness(self, sample_vehicles):
        """Test that all vehicles have unique plate numbers."""
        plate_numbers = [v.plate_number for v in sample_vehicles]
        assert len(plate_numbers) == len(set(plate_numbers))
    
    def test_vehicle_cluster_assignment(self, sample_minibus):
        """Test assigning vehicle to cluster."""
        cluster = Cluster(id=1, center=(41.0082, 28.9784))
        sample_minibus.cluster = cluster
        
        assert sample_minibus.cluster == cluster
    
    def test_vehicle_fleet_composition(self, sample_vehicles):
        """Test fleet composition."""
        minibuses = [v for v in sample_vehicles if v.vehicle_type == "Minibus"]
        midibuses = [v for v in sample_vehicles if v.vehicle_type == "Midibus"]
        
        assert len(minibuses) == 3
        assert len(midibuses) == 3
        assert len(sample_vehicles) == 6
    
    def test_vehicle_properties(self, sample_minibus):
        """Test vehicle basic properties."""
        assert hasattr(sample_minibus, 'id')
        assert hasattr(sample_minibus, 'plate_number')
        assert hasattr(sample_minibus, 'capacity')
        assert hasattr(sample_minibus, 'vehicle_type')
        assert hasattr(sample_minibus, 'driver_name')


# =============================================================================
# Integration Tests (Multiple Models)
# =============================================================================

class TestModelIntegration:
    """Integration tests involving multiple models."""
    
    def test_employee_to_cluster_to_route(self, sample_employees, sample_cluster):
        """Test complete flow: employee -> cluster -> route."""
        # Add employees to cluster
        for emp in sample_employees[:3]:
            sample_cluster.add_employee(emp)
        
        # Create route for cluster
        route = Route(cluster=sample_cluster)
        sample_cluster.assign_route(route)
        
        # Verify connections
        assert all(emp.cluster_id == sample_cluster.id for emp in sample_cluster.employees)
        assert sample_cluster.route == route
        assert route.cluster == sample_cluster
    
    def test_vehicle_assignment_flow(self, cluster_with_employees, sample_minibus):
        """Test vehicle assignment to cluster with employees."""
        # Assign vehicle
        cluster_with_employees.assign_vehicle(sample_minibus)
        
        # Verify
        assert cluster_with_employees.vehicle == sample_minibus
        assert sample_minibus.cluster == cluster_with_employees
        
        # Check capacity constraint
        assert len(cluster_with_employees.get_active_employees()) <= sample_minibus.capacity
    
    def test_multiple_clusters_multiple_vehicles(self, clusters_list, sample_vehicles):
        """Test multiple clusters with vehicle assignments."""
        # Assign vehicles to clusters
        for i, cluster in enumerate(clusters_list):
            cluster.assign_vehicle(sample_vehicles[i])
        
        # Verify all clusters have vehicles
        assert all(c.vehicle is not None for c in clusters_list)
        
        # Verify vehicle-cluster pairing
        for cluster, vehicle in zip(clusters_list, sample_vehicles):
            assert cluster.vehicle == vehicle
            assert vehicle.cluster == cluster
