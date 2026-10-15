import { useState, useEffect } from 'react';

export interface FranchiseMasterRow {
  id: string;
  province: string;
  zone: string;
  region: string;
  district: string;
  tehsil: string;
  salesUnit: string;
  bsaId: string;
  bsaName: string;
  associatedFranchiseId: string;
  franchiseName: string;
  franchiseOwnerName: string;
  franchiseStatus: string;
  villageName: string;
  [key: string]: string;
}

function load(): FranchiseMasterRow[] {
  try { return JSON.parse(localStorage.getItem('franchiseMaster') || '[]'); }
  catch { return []; }
}

function unique(arr: string[]) {
  return Array.from(new Set(arr.filter(Boolean))).sort();
}

export interface FranchiseFilterState {
  zoneFilter: string;
  regionFilter: string;
  salesUnitFilter: string;
  franchiseFilter: string;
  setZoneFilter: (v: string) => void;
  setRegionFilter: (v: string) => void;
  setSalesUnitFilter: (v: string) => void;
  setFranchiseFilter: (v: string) => void;
  zones: string[];
  regions: string[];
  salesUnits: string[];
  franchises: string[];
  clearFranchiseFilters: () => void;
  hasActiveFranchiseFilter: boolean;
}

export function useFranchiseFilters(): FranchiseFilterState {
  const [master, setMaster] = useState<FranchiseMasterRow[]>(load);
  const [zoneFilter, setZoneFilterRaw] = useState('all');
  const [regionFilter, setRegionFilterRaw] = useState('all');
  const [salesUnitFilter, setSalesUnitFilterRaw] = useState('all');
  const [franchiseFilter, setFranchiseFilterRaw] = useState('all');

  useEffect(() => {
    const handler = () => setMaster(load());
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  // Cascading: each level filters the next
  const filtered1 = zoneFilter === 'all' ? master : master.filter(r => r.zone === zoneFilter);
  const filtered2 = regionFilter === 'all' ? filtered1 : filtered1.filter(r => r.region === regionFilter);
  const filtered3 = salesUnitFilter === 'all' ? filtered2 : filtered2.filter(r => r.salesUnit === salesUnitFilter);

  const zones = unique(master.map(r => r.zone));
  const regions = unique(filtered1.map(r => r.region));
  const salesUnits = unique(filtered2.map(r => r.salesUnit));
  const franchises = unique(filtered3.map(r => r.franchiseName));

  const setZoneFilter = (v: string) => {
    setZoneFilterRaw(v);
    setRegionFilterRaw('all');
    setSalesUnitFilterRaw('all');
    setFranchiseFilterRaw('all');
  };
  const setRegionFilter = (v: string) => {
    setRegionFilterRaw(v);
    setSalesUnitFilterRaw('all');
    setFranchiseFilterRaw('all');
  };
  const setSalesUnitFilter = (v: string) => {
    setSalesUnitFilterRaw(v);
    setFranchiseFilterRaw('all');
  };

  const clearFranchiseFilters = () => {
    setZoneFilterRaw('all'); setRegionFilterRaw('all');
    setSalesUnitFilterRaw('all'); setFranchiseFilterRaw('all');
  };

  const hasActiveFranchiseFilter =
    zoneFilter !== 'all' || regionFilter !== 'all' ||
    salesUnitFilter !== 'all' || franchiseFilter !== 'all';

  return {
    zoneFilter, regionFilter, salesUnitFilter, franchiseFilter,
    setZoneFilter, setRegionFilter, setSalesUnitFilter, setFranchiseFilter: setFranchiseFilterRaw,
    zones, regions, salesUnits, franchises,
    clearFranchiseFilters, hasActiveFranchiseFilter,
  };
}
