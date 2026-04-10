import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { updateCityConfig } from '../services/api';

export type CityKey = 'istanbul_anadolu' | 'istanbul_avrupa' | 'ankara';

type CityConfig = {
  office: [number, number];
  mapCenter: [number, number];
  zoom: number;
};

type CityContextValue = {
  city: CityKey;
  setCity: (city: CityKey) => void;
  cityConfig: CityConfig;
};

const CITY_STORAGE_KEY = 'routing-engine-admin-city';

const CITY_CONFIGS: Record<CityKey, CityConfig> = {
  istanbul_anadolu: {
    office: [40.837384, 29.412109],
    mapCenter: [40.95, 29.2],
    zoom: 11,
  },
  istanbul_avrupa: {
    office: [41.10773366862954, 29.032271965999033],
    mapCenter: [41.03, 28.9],
    zoom: 11,
  },
  ankara: {
    office: [39.910180932947206, 32.80887467021701],
    mapCenter: [39.95, 32.85],
    zoom: 11,
  },
};

const CityContext = createContext<CityContextValue | null>(null);

function getInitialCity(): CityKey {
  const stored = localStorage.getItem(CITY_STORAGE_KEY);
  if (stored === 'istanbul') return 'istanbul_anadolu';
  if (stored === 'istanbul_anadolu' || stored === 'istanbul_avrupa' || stored === 'ankara') return stored;
  return 'istanbul_anadolu';
}

export function CityProvider({ children }: { children: React.ReactNode }) {
  const [city, setCity] = useState<CityKey>(getInitialCity);

  useEffect(() => {
    localStorage.setItem(CITY_STORAGE_KEY, city);
  }, [city]);

  useEffect(() => {
    let cancelled = false;

    const syncBackendCity = async () => {
      try {
        await updateCityConfig(city);
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to sync city configuration to backend:', error);
        }
      }
    };

    syncBackendCity();

    return () => {
      cancelled = true;
    };
  }, [city]);

  const value = useMemo(
    () => ({ city, setCity, cityConfig: CITY_CONFIGS[city] }),
    [city],
  );

  return <CityContext.Provider value={value}>{children}</CityContext.Provider>;
}

export function useCity() {
  const context = useContext(CityContext);
  if (!context) {
    throw new Error('useCity must be used within a CityProvider');
  }
  return context;
}
