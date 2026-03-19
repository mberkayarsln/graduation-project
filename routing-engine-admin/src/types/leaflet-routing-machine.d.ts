/* eslint-disable @typescript-eslint/no-explicit-any */
import * as L from 'leaflet';

declare module 'leaflet' {
  namespace Routing {
    interface RoutingControlOptions {
      router?: any;
      waypoints?: L.LatLng[];
      routeWhileDragging?: boolean;
      draggableWaypoints?: boolean;
      addWaypoints?: boolean;
      fitSelectedRoutes?: boolean;
      showAlternatives?: boolean;
      lineOptions?: {
        styles?: L.PathOptions[];
        extendToWaypoints?: boolean;
        missingRouteTolerance?: number;
      };
      createMarker?: (i: number, waypoint: { latLng: L.LatLng }, n: number) => L.Marker;
    }

    interface RouteSummary {
      totalDistance: number;
      totalTime: number;
    }

    interface IRoute {
      coordinates: L.LatLng[];
      summary: RouteSummary;
    }

    interface RoutingEvent {
      routes: IRoute[];
    }

    interface Waypoint {
      latLng: L.LatLng | null;
    }

    interface Control extends L.Control {
      getWaypoints(): Waypoint[];
      setWaypoints(waypoints: (L.LatLng | Waypoint)[]): this;
      on(event: 'routesfound', fn: (e: RoutingEvent) => void): this;
    }

    function control(options: RoutingControlOptions): Control;
    function osrmv1(options: { serviceUrl: string }): any;
  }
}
