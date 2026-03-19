"""Integration-style tests for Flask API endpoints with mocked repositories."""

from types import SimpleNamespace
from unittest.mock import Mock, patch

import pytest

from api import app as app_module


@pytest.fixture
def client(monkeypatch):
    app_module.app.config["TESTING"] = True

    # Avoid expensive cache computations during tests.
    monkeypatch.setattr(app_module, "_transit_stops_cache", [])
    monkeypatch.setattr(app_module, "_transit_stop_names_cache", {})
    monkeypatch.setattr(app_module, "_bus_stops_cache", {})

    with app_module.app.test_client() as c:
        yield c


class TestEmployeeEndpoints:
    def test_get_employees(self, client, monkeypatch):
        employees = [
            SimpleNamespace(
                id=1,
                name="Employee 1",
                lat=41.0,
                lon=29.0,
                zone_id=1,
                cluster_id=10,
                excluded=False,
                exclusion_reason="",
                pickup_point=(41.001, 29.001),
            )
        ]
        clusters = [SimpleNamespace(id=10)]

        employee_repo = Mock(find_all=Mock(return_value=employees))
        cluster_repo = Mock(find_all=Mock(return_value=clusters))
        route_repo = Mock(find_by_cluster=Mock(return_value=SimpleNamespace(distance_km=1.2, duration_min=5, stops=[], coordinates=[], optimized=True)))

        monkeypatch.setattr(app_module, "employee_repo", employee_repo)
        monkeypatch.setattr(app_module, "cluster_repo", cluster_repo)
        monkeypatch.setattr(app_module, "route_repo", route_repo)

        resp = client.get("/api/employees")
        assert resp.status_code == 200
        payload = resp.get_json()
        assert payload[0]["id"] == 1
        assert payload[0]["has_route"] is True

    def test_get_employee_by_id(self, client, monkeypatch):
        emp = SimpleNamespace(
            id=1,
            name="Employee 1",
            lat=41.0,
            lon=29.0,
            zone_id=1,
            cluster_id=10,
            excluded=False,
            exclusion_reason="",
            pickup_point=(41.001, 29.001),
        )
        monkeypatch.setattr(app_module, "employee_repo", Mock(find_by_id=Mock(return_value=emp)))

        resp = client.get("/api/employees/1")
        assert resp.status_code == 200
        assert resp.get_json()["id"] == 1


class TestClusterEndpoints:
    def test_get_clusters(self, client, monkeypatch):
        cluster = SimpleNamespace(id=1, center=(41.0, 29.0), zone_id=3, employees=[SimpleNamespace(id=1)])
        route = SimpleNamespace(distance_km=2.2, duration_min=10.0, stops=[(41.0, 29.0)], coordinates=[[41.0, 29.0]])

        monkeypatch.setattr(app_module, "cluster_repo", Mock(find_all=Mock(return_value=[cluster])))
        monkeypatch.setattr(app_module, "route_repo", Mock(find_by_cluster=Mock(return_value=route)))

        resp = client.get("/api/clusters")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data[0]["id"] == 1
        assert data[0]["employee_count"] == 1

    def test_get_cluster_by_id(self, client, monkeypatch):
        cluster = SimpleNamespace(id=1, center=(41.0, 29.0), zone_id=3, employees=[])
        route = SimpleNamespace(distance_km=1.0, duration_min=5.0, stops=[], coordinates=[], optimized=True)

        monkeypatch.setattr(app_module, "cluster_repo", Mock(find_by_id=Mock(return_value=cluster)))
        monkeypatch.setattr(app_module, "route_repo", Mock(find_by_cluster=Mock(return_value=route)))

        resp = client.get("/api/clusters/1")
        assert resp.status_code == 200
        assert resp.get_json()["id"] == 1


class TestRouteEndpoints:
    def test_get_routes(self, client, monkeypatch):
        cluster = SimpleNamespace(id=1, center=(41.0, 29.0))
        route = SimpleNamespace(
            distance_km=3.5,
            duration_min=12.5,
            stops=[(41.0, 29.0)],
            coordinates=[[41.0, 29.0]],
            optimized=True,
        )

        monkeypatch.setattr(app_module, "cluster_repo", Mock(find_all=Mock(return_value=[cluster])))
        monkeypatch.setattr(app_module, "route_repo", Mock(find_by_cluster=Mock(return_value=route)))
        monkeypatch.setattr(app_module, "employee_repo", Mock(count_by_cluster=Mock(return_value=7)))
        monkeypatch.setattr(app_module, "db", Mock(fetchone=Mock(return_value={"vehicle_id": 2, "driver_name": "A", "plate_number": "34ABC123"})))

        resp = client.get("/api/routes")
        assert resp.status_code == 200
        assert resp.get_json()[0]["employee_count"] == 7

    def test_get_route_by_cluster_id(self, client, monkeypatch):
        cluster = SimpleNamespace(id=1, center=(41.0, 29.0))
        route = SimpleNamespace(
            distance_km=3.5,
            duration_min=12.5,
            stops=[(41.0, 29.0)],
            coordinates=[[41.0, 29.0]],
            optimized=True,
        )

        monkeypatch.setattr(app_module, "_bus_stops_cache", {1: []})
        monkeypatch.setattr(app_module, "cluster_repo", Mock(find_by_id=Mock(return_value=cluster)))
        monkeypatch.setattr(app_module, "route_repo", Mock(find_by_cluster=Mock(return_value=route)))
        monkeypatch.setattr(app_module, "employee_repo", Mock(count_by_cluster=Mock(return_value=7)))
        monkeypatch.setattr(app_module, "db", Mock(fetchone=Mock(return_value={"vehicle_id": 2, "driver_name": "A", "plate_number": "34ABC123"})))

        resp = client.get("/api/routes/1")
        assert resp.status_code == 200
        assert resp.get_json()["cluster_id"] == 1


class TestVehicleEndpoints:
    def test_get_vehicles(self, client, monkeypatch):
        vehicles = [
            SimpleNamespace(id=1, capacity=17, vehicle_type="Minibus", driver_name="D1", plate_number="34ABC123")
        ]
        monkeypatch.setattr(app_module, "vehicle_repo", Mock(find_all=Mock(return_value=vehicles)))

        resp = client.get("/api/vehicles")
        assert resp.status_code == 200
        assert resp.get_json()[0]["plate_number"] == "34ABC123"

    def test_get_vehicle_by_id(self, client, monkeypatch):
        vehicle = SimpleNamespace(id=1, capacity=17, vehicle_type="Minibus", driver_name="D1", plate_number="34ABC123")
        monkeypatch.setattr(app_module, "vehicle_repo", Mock(find_by_id=Mock(return_value=vehicle)))

        resp = client.get("/api/vehicles/1")
        assert resp.status_code == 200
        assert resp.get_json()["id"] == 1


class TestTripEndpoints:
    def test_create_trip(self, client, monkeypatch):
        trip_repo = Mock(save_trip=Mock(return_value=123))
        monkeypatch.setattr(app_module, "trip_history_repo", trip_repo)

        payload = {
            "routeId": 1,
            "driverId": 2,
            "vehicleId": 3,
            "distanceKm": 5.2,
            "durationMin": 14,
        }
        resp = client.post("/api/trips", json=payload)
        assert resp.status_code == 201
        assert resp.get_json()["id"] == 123

    def test_get_trips_for_driver(self, client, monkeypatch):
        trip_repo = Mock(find_by_driver=Mock(return_value=[{"id": 1, "driver_id": 2, "started_at": None}]))
        monkeypatch.setattr(app_module, "trip_history_repo", trip_repo)

        resp = client.get("/api/trips/driver/2")
        assert resp.status_code == 200
        assert resp.get_json()[0]["id"] == 1

    def test_get_trips_for_employee(self, client, monkeypatch):
        trip_repo = Mock(find_by_employee=Mock(return_value=[{"id": 1, "employee_id": 9, "started_at": None}]))
        monkeypatch.setattr(app_module, "trip_history_repo", trip_repo)

        resp = client.get("/api/trips/employee/9")
        assert resp.status_code == 200
        assert resp.get_json()[0]["id"] == 1


class TestWalkingRouteAndAuth:
    def test_get_walking_route(self, client):
        with patch("routing.OSRMRouter") as router_cls:
            router = Mock()
            router.get_route.return_value = {"distance_km": 1.2, "duration_min": 3.0, "coordinates": [[41.0, 29.0], [41.01, 29.01]]}
            router_cls.return_value = router

            resp = client.get(
                "/api/walking-route",
                query_string={
                    "origin_lat": 41.0,
                    "origin_lon": 29.0,
                    "dest_lat": 41.01,
                    "dest_lon": 29.01,
                },
            )
            assert resp.status_code == 200
            assert "distance_km" in resp.get_json()

    def test_login_employee(self, client, monkeypatch):
        emp = SimpleNamespace(
            id=7,
            name="Employee 7",
            lat=41.0,
            lon=29.0,
            cluster_id=3,
            pickup_point=(41.0, 29.0),
            zone_id=2,
            excluded=False,
        )
        monkeypatch.setattr(app_module, "employee_repo", Mock(find_by_id=Mock(return_value=emp)))

        resp = client.post("/api/auth/login", json={"role": "employee", "identifier": "7"})
        assert resp.status_code == 200
        assert resp.get_json()["success"] is True


class TestErrorHandling:
    def test_404_not_found(self, client):
        resp = client.get("/api/nonexistent")
        assert resp.status_code == 404

    def test_invalid_json_returns_server_error(self, client):
        # Endpoint currently catches JSON parse exceptions and returns 500.
        resp = client.put("/api/employees/1", data="invalid json", content_type="application/json")
        assert resp.status_code == 500