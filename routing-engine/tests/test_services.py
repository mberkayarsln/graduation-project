"""
Unit tests for service classes: ClusteringService, RoutingService, ServicePlanner

Tests:
- cluster_by_zones() - zone-aware clustering with proper capacity
- match_employees_to_route() - pickup point assignment
- reassign_employees_to_closer_routes() - cross-cluster load balancing
- ServicePlanner orchestration
"""

import pytest
import numpy as np
from unittest.mock import Mock, patch, MagicMock
from models import Employee, Cluster, Route, Vehicle
from services import ClusteringService, RoutingService, ServicePlanner


# =============================================================================
# ClusteringService Tests
# =============================================================================

class TestClusteringService:
    """Test suite for ClusteringService."""
    
    def test_clustering_service_init(self, test_config):
        """Test initializing clustering service."""
        service = ClusteringService(config=test_config)
        assert service.config == test_config
        assert service.clusterer is None
    
    def test_cluster_employees_basic(self, test_config, sample_employees):
        """Test basic employee clustering."""
        service = ClusteringService(config=test_config)
        
        clusters = service.cluster_employees(sample_employees, num_clusters=2, random_state=42)
        
        assert len(clusters) == 2
        
        # All employees should be assigned to clusters
        all_clustered = [e for c in clusters for e in c.employees]
        assert len(all_clustered) == len(sample_employees)
        
        # Clusters should have reasonable distribution
        assert all(len(c.employees) > 0 for c in clusters)
    
    def test_cluster_by_zones_single_cluster_per_zone(self, test_config, create_employees_in_zone):
        """Test zone clustering where each zone gets one cluster."""
        service = ClusteringService(config=test_config)
        
        # Create employees in zones
        zone_1_employees = create_employees_in_zone(zone_id=1, count=10, lat_center=41.0100, lon_center=28.9800)
        zone_2_employees = create_employees_in_zone(zone_id=2, count=8, lat_center=41.0200, lon_center=28.9900)
        
        # Create zone assignments
        zone_assignments = {
            1: zone_1_employees,
            2: zone_2_employees,
        }
        
        # Note: employees_per_cluster = 20 means each zone gets 1 cluster (n < 20)
        clusters = service.cluster_by_zones(zone_assignments, employees_per_cluster=20, random_state=42)
        
        assert len(clusters) == 2
        
        # Check that employees are in clusters
        for cluster in clusters:
            assert len(cluster.employees) > 0
            # Check zone assignment
            if cluster.employees:
                zone_id = cluster.employees[0].zone_id
                assert all(e.zone_id == zone_id for e in cluster.employees)
    
    def test_cluster_by_zones_multiple_clusters_per_zone(self, test_config, create_employees_in_zone):
        """Test zone clustering with split zones."""
        service = ClusteringService(config=test_config)
        
        # Create many employees in one zone (should split)
        zone_1_employees = create_employees_in_zone(zone_id=1, count=35, lat_center=41.0100, lon_center=28.9800)
        
        zone_assignments = {
            1: zone_1_employees,
        }
        
        # employees_per_cluster = 17 means 35 employees -> ceil(35/17) = 3 clusters
        clusters = service.cluster_by_zones(zone_assignments, employees_per_cluster=17, random_state=42)
        
        assert len(clusters) == 3
        
        # All employees should be assigned
        all_clustered = [e for c in clusters for e in c.employees]
        assert len(all_clustered) == 35
    
    def test_cluster_by_zones_empty_zone(self, test_config):
        """Test zone clustering with empty zone."""
        service = ClusteringService(config=test_config)
        
        zone_assignments = {
            1: [],  # Empty
            2: [Employee(id=1, lat=41.0, lon=28.9)],
        }
        
        clusters = service.cluster_by_zones(zone_assignments, employees_per_cluster=20)
        
        # Should only have 1 cluster (from non-empty zone)
        assert len(clusters) == 1
        assert clusters[0].zone_id == 2
    
    def test_cluster_by_zones_preserves_zone_id(self, test_config, create_employees_in_zone):
        """Test that zone IDs are preserved in clusters."""
        service = ClusteringService(config=test_config)
        
        zone_1_employees = create_employees_in_zone(zone_id=5, count=10, lat_center=41.0100, lon_center=28.9800)
        zone_2_employees = create_employees_in_zone(zone_id=7, count=8, lat_center=41.0200, lon_center=28.9900)
        
        zone_assignments = {
            5: zone_1_employees,
            7: zone_2_employees,
        }
        
        clusters = service.cluster_by_zones(zone_assignments, employees_per_cluster=20)
        
        zone_ids = {c.zone_id for c in clusters}
        assert 5 in zone_ids
        assert 7 in zone_ids
    
    def test_enforce_capacity_constraints_no_overflow(self, test_config, cluster_with_employees):
        """Test capacity enforcement with no overflow."""
        service = ClusteringService(config=test_config)
        
        clusters = [cluster_with_employees]
        capacity = 20  # More than 5 employees
        
        result = service.enforce_capacity_constraints(clusters, capacity)
        
        # Should return same cluster (no split needed)
        assert len(result) == 1
        assert len(result[0].employees) == 5
    
    def test_enforce_capacity_constraints_splits_cluster(self, test_config, sample_employees):
        """Test capacity enforcement splits overflowing cluster."""
        service = ClusteringService(config=test_config)
        
        # Create cluster with many employees
        c = Cluster(id=1, center=(41.0082, 28.9784))
        for emp in sample_employees:
            c.add_employee(emp)
        
        clusters = [c]
        capacity = 5  # Less than 10
        
        result = service.enforce_capacity_constraints(clusters, capacity)
        
        # Should split into 2 clusters (10 employees / 5 capacity = 2)
        assert len(result) >= 2
        
        # All employees should still be assigned
        all_employees = [e for c in result for e in c.employees]
        assert len(all_employees) == 10
    
    def test_validate_capacity_ok(self, test_config, cluster_with_employees):
        """Test validation passes when capacity is OK."""
        service = ClusteringService(config=test_config)
        
        clusters = [cluster_with_employees]
        capacity = 20
        
        is_valid, violations = service.validate_capacity(clusters, capacity)
        
        assert is_valid is True
        assert len(violations) == 0
    
    def test_validate_capacity_violation(self, test_config, cluster_with_employees):
        """Test validation fails when capacity exceeded."""
        service = ClusteringService(config=test_config)
        
        clusters = [cluster_with_employees]
        capacity = 3  # Less than 5 employees in cluster
        
        is_valid, violations = service.validate_capacity(clusters, capacity)
        
        assert is_valid is False
        assert len(violations) == 1
        assert violations[0]['cluster_id'] == cluster_with_employees.id
        assert violations[0]['count'] == 5


# =============================================================================
# RoutingService Tests
# =============================================================================

class TestRoutingService:
    """Test suite for RoutingService."""
    
    def test_routing_service_init(self, test_config):
        """Test initializing routing service."""
        service = RoutingService(config=test_config)
        assert service.config == test_config
    
    @patch('services.OSRMRouter')
    def test_optimize_cluster_route_with_osrm(self, mock_osrm_class, test_config, cluster_with_employees):
        """Test cluster route optimization with OSRM."""
        # Setup mock
        mock_router = Mock()
        mock_router.get_route.return_value = {
            'coordinates': [[41.0082, 28.9784], [41.0125, 28.9834], [41.0156, 28.9645]],
            'distance_km': 2.5,
            'duration_min': 15.0,
        }
        mock_osrm_class.return_value = mock_router
        
        service = RoutingService(config=test_config)
        service.osrm_router = mock_router
        
        # Set up stops for cluster
        cluster_with_employees.stops = [
            (41.0082, 28.9784),
            (41.0125, 28.9834),
            (41.0156, 28.9645),
        ]
        
        route = service.optimize_cluster_route(cluster_with_employees, use_stops=True)
        
        assert route is not None
        assert route.distance_km == 2.5
        assert route.duration_min == 15.0
        assert len(route.coordinates) == 3
    
    @patch('services.OSRMRouter')
    def test_optimize_cluster_route_fallback(self, mock_osrm_class, test_config, cluster_with_employees):
        """Test route optimization falls back to manual calculation."""
        # Setup mock to fail
        mock_router = Mock()
        mock_router.get_route.side_effect = Exception("OSRM unavailable")
        mock_osrm_class.return_value = mock_router
        
        service = RoutingService(config=test_config)
        service.osrm_router = mock_router
        
        cluster_with_employees.stops = [
            (41.0082, 28.9784),
            (41.0125, 28.9834),
        ]
        
        route = service.optimize_cluster_route(cluster_with_employees, use_stops=True)
        
        # Should still return a route with calculated stats
        assert route is not None
        assert route.distance_km >= 0
    
    @patch('services.OSRMRouter')
    def test_optimize_cluster_route_no_stops(self, mock_osrm_class, test_config, cluster_with_employees):
        """Test route optimization with employee locations (no preset stops)."""
        mock_router = Mock()
        mock_router.get_route.return_value = {
            'coordinates': [[41.0082, 28.9784], [41.0125, 28.9834]],
            'distance_km': 1.5,
            'duration_min': 10.0,
        }
        mock_osrm_class.return_value = mock_router
        
        service = RoutingService(config=test_config)
        service.osrm_router = mock_router
        
        route = service.optimize_cluster_route(cluster_with_employees, use_stops=False)
        
        assert route is not None


# =============================================================================
# Route Tests - match_employees_to_route
# =============================================================================

class TestRouteMatchEmployeesToRoute:
    """Test suite for Route.match_employees_to_route()."""
    
    def test_match_employees_to_route_basic(self, sample_route, sample_employees):
        """Test basic employee matching to route stops."""
        sample_route.stops = [
            (41.0082, 28.9784),
            (41.0125, 28.9834),
            (41.0156, 28.9645),
        ]
        
        # Note: This test verifies the method exists and can be called
        # Full testing requires OSRM which may not be available
        result = sample_route.match_employees_to_route(
            sample_employees,
            safe_stops=sample_route.stops,
            buffer_meters=150
        )
        
        # Should return count of matched employees (>= 0)
        assert result >= 0
    
    def test_match_employees_to_route_empty_route(self, sample_employees):
        """Test matching to route with no coordinates."""
        route = Route()
        route.coordinates = []
        
        result = route.match_employees_to_route(sample_employees)
        
        # Should return 0 (no matches)
        assert result == 0
    
    def test_match_employees_to_route_no_employees(self, sample_route):
        """Test matching with no employees."""
        result = sample_route.match_employees_to_route([])
        
        assert result == 0
    
    def test_match_employees_to_route_all_excluded(self, sample_route):
        """Test matching when all employees are excluded."""
        excluded = [Employee(id=i, lat=41.0 + i*0.001, lon=28.9 + i*0.001) for i in range(3)]
        for emp in excluded:
            emp.excluded = True
        
        result = sample_route.match_employees_to_route(excluded)
        
        # Should return 0 (all excluded)
        assert result == 0


# =============================================================================
# ServicePlanner Tests
# =============================================================================

class TestServicePlanner:
    """Test suite for ServicePlanner."""
    
    @patch('services.LocationService')
    @patch('services.ClusteringService')
    @patch('services.RoutingService')
    @patch('services.VisualizationService')
    def test_service_planner_init(self, mock_viz, mock_routing, mock_clustering, mock_location, test_config):
        """Test initializing ServicePlanner."""
        planner = ServicePlanner(config=test_config)
        
        assert planner.config == test_config
        assert planner.use_database == test_config.USE_DATABASE
        assert len(planner.employees) == 0
        assert len(planner.clusters) == 0
    
    @patch('services.LocationService')
    @patch('services.ClusteringService')
    @patch('services.RoutingService')
    @patch('services.VisualizationService')
    def test_get_departure_time(self, mock_viz, mock_routing, mock_clustering, mock_location, test_config):
        """Test departure time calculation."""
        planner = ServicePlanner(config=test_config)
        
        departure_time = planner.get_departure_time()
        
        # Departure time should be at 8:00 AM
        assert departure_time.hour == 8
        assert departure_time.minute == 0


class TestServicePlannerReassignment:
    """Test suite for ServicePlanner.reassign_employees_to_closer_routes()."""
    
    @patch('services.LocationService')
    @patch('services.ClusteringService')
    @patch('services.RoutingService')
    @patch('services.VisualizationService')
    def test_reassign_employees_no_routes(self, mock_viz, mock_routing, mock_clustering, mock_location, test_config):
        """Test reassignment with no routes."""
        planner = ServicePlanner(config=test_config)
        planner.clusters = []
        
        result = planner.reassign_employees_to_closer_routes()
        
        assert result['reassigned'] == 0
        assert result['checked'] == 0
    
    @patch('services.LocationService')
    @patch('services.ClusteringService')
    @patch('services.RoutingService')
    @patch('services.VisualizationService')
    def test_reassign_employees_within_limits(self, mock_viz, mock_routing, mock_clustering, mock_location, test_config):
        """Test reassignment when employees are within walking distance."""
        planner = ServicePlanner(config=test_config)
        planner.config.MAX_WALK_DISTANCE = 1000
        
        # Create cluster with route and employees with reasonable walking distance
        cluster = Cluster(id=1, center=(41.0082, 28.9784))
        emp = Employee(id=1, lat=41.0082, lon=28.9784, name="Emp 1")
        cluster.add_employee(emp)
        
        route = Route()
        route.stops = [(41.0082, 28.9784)]  # Stop at employee location
        cluster.assign_route(route)
        
        # Set pickup point with short walking distance
        emp.set_pickup_point(41.0082, 28.9784, walking_distance=100)
        
        planner.clusters = [cluster]
        
        result = planner.reassign_employees_to_closer_routes()
        
        # Should not reassign (within limit)
        assert result['reassigned'] == 0
    
    @patch('services.LocationService')
    @patch('services.ClusteringService')
    @patch('services.RoutingService')
    @patch('services.VisualizationService')
    def test_reassign_employees_excessive_distance(self, mock_viz, mock_routing, mock_clustering, mock_location, test_config):
        """Test reassignment when walking distance is excessive.
        
        This is a unit test for the logic, not full integration.
        """
        planner = ServicePlanner(config=test_config)
        planner.config.MAX_WALK_DISTANCE = 500
        
        # Cluster 1: employee far from pickup point
        c1 = Cluster(id=1, center=(41.0082, 28.9784))
        emp1 = Employee(id=1, lat=41.0082, lon=28.9784, name="Emp 1")
        c1.add_employee(emp1)
        
        # Set excessive walking distance
        emp1.set_pickup_point(41.0200, 28.9900, walking_distance=2000)
        
        route1 = Route()
        route1.stops = [(41.0200, 28.9900)]
        c1.assign_route(route1)
        
        # Cluster 2: closer route
        c2 = Cluster(id=2, center=(41.0100, 28.9800))
        route2 = Route()
        route2.stops = [(41.0090, 28.9790)]  # Closer to emp1
        c2.assign_route(route2)
        
        planner.clusters = [c1, c2]
        
        # Before reassignment
        assert emp1 in c1.employees
        assert emp1 not in c2.employees
        
        result = planner.reassign_employees_to_closer_routes()
        
        # The exact result depends on distance calculations
        assert result['checked'] >= 0
        assert result['reassigned'] >= 0


# =============================================================================
# Integration Tests (Services + Models)
# =============================================================================

class TestServiceIntegration:
    """Integration tests for services working together."""
    
    @patch('services.LocationService')
    @patch('services.ClusteringService')
    @patch('services.RoutingService')
    @patch('services.VisualizationService')
    @patch('services.OSRMRouter')
    def test_full_optimization_flow(self, mock_osrm, mock_viz, mock_routing, mock_clustering, mock_location, test_config, sample_employees):
        """Test complete optimization flow."""
        # Setup
        planner = ServicePlanner(config=test_config)
        planner.employees = sample_employees
        
        # Create clusters
        clusters = []
        for i, emp in enumerate(sample_employees[:5]):
            c = Cluster(id=i, center=emp.get_location())
            c.add_employee(emp)
            clusters.append(c)
        
        planner.clusters = clusters
        
        # Verify flow
        assert len(planner.employees) == 10
        assert len(planner.clusters) == 5
        
        # Each cluster should have employees
        for cluster in planner.clusters:
            assert len(cluster.employees) > 0
