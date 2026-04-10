const API_BASE = '';

async function handleResponse(res: Response) {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
}

export const api = {
  async get<T = unknown>(url: string): Promise<T> {
    const res = await fetch(`${API_BASE}${url}`);
    return handleResponse(res);
  },

  async post<T = unknown>(url: string, data?: unknown): Promise<T> {
    const res = await fetch(`${API_BASE}${url}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: data ? JSON.stringify(data) : undefined,
    });
    return handleResponse(res);
  },

  async put<T = unknown>(url: string, data: unknown): Promise<T> {
    const res = await fetch(`${API_BASE}${url}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },
};

// ── Type definitions ──

export interface Stats {
  total_employees: number;
  active_employees: number;
  excluded_employees: number;
  unassigned_employees: number;
  total_clusters: number;
  total_routes: number;
  total_vehicles: number;
  total_zones: number;
  total_distance_km: number;
  total_duration_min: number;
}

export interface Employee {
  id: number;
  name: string;
  lat: number;
  lon: number;
  zone_id: number | null;
  cluster_id: number | null;
  excluded: boolean;
  exclusion_reason: string | null;
  pickup_point: [number, number] | null;
  has_route?: boolean;
}

export interface Cluster {
  id: number;
  center: [number, number];
  zone_id: number | null;
  employee_count: number;
  has_route: boolean;
  route_distance: number;
  route_duration: number;
  route_stops: [number, number][];
  route_coordinates: [number, number][];
}

export interface ClusterDetail {
  id: number;
  center: [number, number];
  zone_id: number | null;
  employees: { id: number; name: string; lat: number; lon: number; pickup_point: [number, number] | null; walking_distance: number | null }[];
  route: { distance_km: number; duration_min: number; stops: [number, number][]; optimized: boolean } | null;
}

export interface Route {
  cluster_id: number;
  center: [number, number];
  distance_km: number;
  duration_min: number;
  stops: [number, number][];
  bus_stops: [number, number][];
  coordinates: [number, number][];
  stop_count: number;
  bus_stop_count: number;
  employee_count: number;
  optimized: boolean;
}

export interface Vehicle {
  id: number;
  capacity: number;
  vehicle_type: string;
  driver_name: string | null;
  plate_number: string | null;
}

export interface CostReportData {
  system: {
    total_employees: number;
    active_employees: number;
    vehicle_count: number;
    route_count: number;
    total_distance_km: number;
    total_duration_min: number;
    daily_km: number;
    monthly_km: number;
    monthly_trip_count: number;
  };
  params: Record<string, number>;
  breakdown: {
    driver: {
      gross_salary: number;
      sgk_per_driver: number;
      unemployment_per_driver: number;
      effective_driver_count: number;
      total_per_driver: number;
      total: number;
    };
    vehicle: {
      rent_per_vehicle: number;
      rent_total: number;
      maintenance_per_vehicle: number;
      maintenance_total: number;
      mtv_per_vehicle: number;
      mtv_total: number;
      insurance_per_vehicle: number;
      insurance_total: number;
      tyre_per_vehicle: number;
      tyre_total: number;
      total: number;
    };
    fuel: { liters_monthly: number; total: number };
    toll: { daily_total: number; total: number };
    misc_variable: { per_km: number; total: number };
    variable_total: number;
    fixed_total: number;
    fixed_share_pct: number;
    variable_share_pct: number;
    subtotal: number;
    overhead: number;
    net_cost: number;
    profit: number;
    pre_tax_total: number;
    kdv: number;
    grand_total_monthly: number;
  };
  contract: {
    months: number;
    monthly_total: number;
    contract_value: number;
    stamp_tax: number;
    final_total: number;
    per_employee_monthly: number;
    per_vehicle_monthly: number;
    per_km: number;
    per_trip: number;
  };
  sensitivity: {
    base_monthly: number;
    fuel_plus_10: number;
    salary_plus_10: number;
    km_plus_10: number;
    fuel_delta: number;
    salary_delta: number;
    km_delta: number;
  };
}

export interface CityConfigResponse {
  city: 'istanbul_anadolu' | 'istanbul_avrupa' | 'ankara';
  office_location: [number, number];
  osm_file: string;
  load_all_from_db: boolean;
  available_cities: string[];
}

export interface CityConfigUpdateResponse {
  success: boolean;
  city: 'istanbul_anadolu' | 'istanbul_avrupa' | 'ankara';
  office_location: [number, number];
  osm_file: string;
  load_all_from_db: boolean;
}

// ── API functions ──

export const statsApi = {
  get: () => api.get<Stats>('/api/stats'),
};

export const employeesApi = {
  getAll: () => api.get<Employee[]>('/api/employees'),
  getById: (id: number) => api.get<Employee>(`/api/employees/${id}`),
  update: (id: number, data: Partial<Employee>) => api.put<{ success: boolean }>(`/api/employees/${id}`, data),
  updatePickup: (id: number, lat: number, lon: number) => api.put<{ success: boolean }>(`/api/employees/${id}/pickup-point`, { lat, lon }),
};

export const clustersApi = {
  getAll: () => api.get<Cluster[]>('/api/clusters'),
  getById: (id: number) => api.get<ClusterDetail>(`/api/clusters/${id}`),
};

export const routesApi = {
  getAll: (includeBusStops = false) => api.get<Route[]>(`/api/routes?include_bus_stops=${includeBusStops}`),
  getById: (clusterId: number) => api.get<Route>(`/api/routes/${clusterId}`),
  update: (clusterId: number, data: { stops: [number, number][]; coordinates?: [number, number][]; distance_km?: number; duration_min?: number }) =>
    api.put(`/api/routes/${clusterId}`, data),
};

export const vehiclesApi = {
  getAll: () => api.get<Vehicle[]>('/api/vehicles'),
  getById: (id: number) => api.get<Vehicle>(`/api/vehicles/${id}`),
  create: (data: Partial<Vehicle>) => api.post<Vehicle>('/api/vehicles', data),
  update: (id: number, data: Partial<Vehicle>) => api.put<{ success: boolean }>(`/api/vehicles/${id}`, data),
};

export const generateRoutes = (mode: string) =>
  api.post<{ success: boolean; stats: Stats }>('/api/generate-routes', { mode });

export const getOptimizationMode = () =>
  api.get<{ current_mode: string; presets: Record<string, unknown> }>('/api/optimization-mode');

export const getCityConfig = () =>
  api.get<CityConfigResponse>('/api/city-config');

export const updateCityConfig = (city: 'istanbul_anadolu' | 'istanbul_avrupa' | 'ankara') =>
  api.put<CityConfigUpdateResponse>('/api/city-config', { city });

export const getStopNames = (coordinates: [number, number][]) =>
  api.post<Record<string, string>>('/api/stops/names', { coordinates });

export const getCostReport = (params: Record<string, number>) => {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) qs.set(k, String(v));
  return api.get<CostReportData>(`/api/cost-report?${qs.toString()}`);
};

export const getWalkingRoute = (originLat: number, originLon: number, destLat: number, destLon: number) =>
  api.get<{ distance_km: number; duration_min: number; coordinates: [number, number][] }>(
    `/api/walking-route?origin_lat=${originLat}&origin_lon=${originLon}&dest_lat=${destLat}&dest_lon=${destLon}`
  );
