/**
 * Territory Hierarchy store + upload UI
 * Data model: Zone → Region[] → SalesUnit[]
 * Persisted in localStorage under 'territoryHierarchy'.
 * Consumed by Inventory filters and rendered in Settings.
 */
import { useState, useRef } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Upload, ChevronRight, Trash2, Download, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

// ── Types ────────────────────────────────────────────────────────────────────

export interface SalesUnit {
  id: string;
  name: string;
}

export interface Region {
  id: string;
  name: string;
  salesUnits: SalesUnit[];
}

export interface Zone {
  id: string;
  name: string;
  regions: Region[];
}

export type TerritoryData = Zone[];

// ── Storage helpers ──────────────────────────────────────────────────────────

const STORAGE_KEY = 'territoryHierarchy';

export function loadTerritoryData(): TerritoryData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveTerritoryData(data: TerritoryData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// ── Excel parser (CSV fallback — no external lib needed) ─────────────────────
// Expected columns (case-insensitive): Zone | Region | Sales Unit
// Rows with the same Zone/Region are grouped automatically.

function parseCSV(text: string): TerritoryData {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) throw new Error('File appears empty');

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, ' '));
  const zoneIdx = headers.findIndex(h => h === 'zone');
  const regionIdx = headers.findIndex(h => h === 'region');
  const suIdx = headers.findIndex(h => h.includes('sales unit') || h === 'sales_unit' || h === 'salesunit');

  if (zoneIdx === -1 || regionIdx === -1 || suIdx === -1)
    throw new Error('Columns not found. Expected: Zone, Region, Sales Unit');

  const zoneMap = new Map<string, Map<string, Set<string>>>();

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    const zone = cols[zoneIdx];
    const region = cols[regionIdx];
    const su = cols[suIdx];
    if (!zone || !region || !su) continue;

    if (!zoneMap.has(zone)) zoneMap.set(zone, new Map());
    const regionMap = zoneMap.get(zone)!;
    if (!regionMap.has(region)) regionMap.set(region, new Set());
    regionMap.get(region)!.add(su);
  }

  const result: TerritoryData = [];
  zoneMap.forEach((regionMap, zoneName) => {
    const regions: Region[] = [];
    regionMap.forEach((suSet, regionName) => {
      const salesUnits: SalesUnit[] = Array.from(suSet).map((name, i) => ({
        id: `${zoneName}-${regionName}-${i}`.replace(/\s+/g, '-').toLowerCase(),
        name,
      }));
      regions.push({
        id: `${zoneName}-${regionName}`.replace(/\s+/g, '-').toLowerCase(),
        name: regionName,
        salesUnits,
      });
    });
    result.push({
      id: zoneName.replace(/\s+/g, '-').toLowerCase(),
      name: zoneName,
      regions,
    });
  });

  return result;
}

// ── Template download ────────────────────────────────────────────────────────

function downloadTemplate() {
  const csv = `Zone,Region,Sales Unit
North Zone,Islamabad Region,ISB - Capital Sales Unit
North Zone,Islamabad Region,ISB - Rawalpindi Sales Unit
North Zone,Lahore Region,LHR - Central Sales Unit
South Zone,Karachi Region,KHI - East Sales Unit
South Zone,Karachi Region,KHI - West Sales Unit
South Zone,Hyderabad Region,HYD - North Sales Unit`;
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'territory-hierarchy-template.csv';
  a.click();
}

// ── Component ────────────────────────────────────────────────────────────────

interface Props {
  onSaved?: (data: TerritoryData) => void;
}

export function TerritoryHierarchyManager({ onSaved }: Props) {
  const [data, setData] = useState<TerritoryData>(loadTerritoryData);
  const [preview, setPreview] = useState<TerritoryData | null>(null);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [expandedZone, setExpandedZone] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setError('');
    setPreview(null);
    setFileName(file.name);

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'csv') {
      setError('Please upload a CSV file. Export your Excel sheet as CSV first (File → Save As → CSV).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = parseCSV(e.target!.result as string);
        if (parsed.length === 0) throw new Error('No valid rows found. Check column names.');
        setPreview(parsed);
      } catch (err: any) {
        setError(err.message || 'Failed to parse file.');
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const confirmImport = () => {
    if (!preview) return;
    saveTerritoryData(preview);
    setData(preview);
    setPreview(null);
    setFileName('');
    toast.success(`Imported ${preview.length} zones successfully`);
    onSaved?.(preview);
  };

  const clearAll = () => {
    saveTerritoryData([]);
    setData([]);
    setPreview(null);
    toast.success('Territory hierarchy cleared');
    onSaved?.([]);
  };

  const totalRegions = data.reduce((s, z) => s + z.regions.length, 0);
  const totalSU = data.reduce((s, z) => s + z.regions.reduce((r, rg) => r + rg.salesUnits.length, 0), 0);

  return (
    <div className="space-y-5">

      {/* Stats row */}
      {data.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <div className="bg-pink-50 border border-pink-100 rounded-lg px-4 py-2 text-center">
            <p className="text-xl font-bold text-[#C7359C]">{data.length}</p>
            <p className="text-xs text-gray-500">Zones</p>
          </div>
          <div className="bg-pink-50 border border-pink-100 rounded-lg px-4 py-2 text-center">
            <p className="text-xl font-bold text-[#C7359C]">{totalRegions}</p>
            <p className="text-xs text-gray-500">Regions</p>
          </div>
          <div className="bg-pink-50 border border-pink-100 rounded-lg px-4 py-2 text-center">
            <p className="text-xl font-bold text-[#C7359C]">{totalSU}</p>
            <p className="text-xs text-gray-500">Sales Units</p>
          </div>
        </div>
      )}

      {/* Upload zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => fileRef.current?.click()}
        className="border-2 border-dashed border-pink-200 hover:border-[#C7359C] rounded-xl p-6 text-center cursor-pointer transition-colors bg-pink-50/40 hover:bg-pink-50"
      >
        <Upload className="size-8 text-[#C7359C] mx-auto mb-2" />
        <p className="text-sm font-semibold text-gray-800">Drop CSV file here or click to upload</p>
        <p className="text-xs text-gray-500 mt-1">Columns required: <span className="font-mono bg-gray-100 px-1 rounded">Zone</span>, <span className="font-mono bg-gray-100 px-1 rounded">Region</span>, <span className="font-mono bg-gray-100 px-1 rounded">Sales Unit</span></p>
        {fileName && <p className="text-xs text-[#C7359C] mt-2 font-medium">{fileName}</p>}
        <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
      </div>

      {/* Template download */}
      <button
        onClick={(e) => { e.stopPropagation(); downloadTemplate(); }}
        className="flex items-center gap-2 text-xs text-[#C7359C] font-medium hover:underline"
      >
        <Download className="size-3.5" />
        Download CSV template
      </button>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
          <AlertCircle className="size-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Preview before confirming */}
      {preview && (
        <div className="border border-green-200 rounded-xl overflow-hidden">
          <div className="bg-green-50 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="size-4 text-green-600" />
              <span className="text-sm font-semibold text-green-800">
                Preview — {preview.length} zones, {preview.reduce((s,z) => s+z.regions.length,0)} regions, {preview.reduce((s,z) => s+z.regions.reduce((r,rg)=>r+rg.salesUnits.length,0),0)} sales units
              </span>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setPreview(null)}>Cancel</Button>
              <Button size="sm" className="bg-[#C7359C] hover:bg-[#9b2b7a] text-white" onClick={confirmImport}>
                Confirm Import
              </Button>
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto divide-y divide-gray-100">
            {preview.map(zone => (
              <div key={zone.id} className="px-4 py-2">
                <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">{zone.name}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {zone.regions.map(r => (
                    <span key={r.id} className="text-xs bg-gray-100 rounded px-2 py-0.5 text-gray-600">
                      {r.name} <span className="text-gray-400">({r.salesUnits.length} SU)</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Current hierarchy tree */}
      {data.length > 0 && !preview && (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="bg-gray-50 px-4 py-2.5 flex items-center justify-between border-b border-gray-200">
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Current Hierarchy</span>
            <button onClick={clearAll} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-medium">
              <Trash2 className="size-3" /> Clear all
            </button>
          </div>
          <div className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
            {data.map(zone => (
              <div key={zone.id}>
                <button
                  onClick={() => setExpandedZone(expandedZone === zone.id ? null : zone.id)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">{zone.name}</span>
                    <Badge variant="secondary" className="text-xs">{zone.regions.length} regions</Badge>
                  </div>
                  <ChevronRight className={`size-4 text-gray-400 transition-transform ${expandedZone === zone.id ? 'rotate-90' : ''}`} />
                </button>
                {expandedZone === zone.id && (
                  <div className="bg-gray-50 px-4 pb-3 space-y-2">
                    {zone.regions.map(region => (
                      <div key={region.id} className="pl-3 border-l-2 border-pink-200">
                        <p className="text-xs font-semibold text-gray-700">{region.name}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {region.salesUnits.map(su => (
                            <span key={su.id} className="text-xs bg-white border border-gray-200 rounded px-2 py-0.5 text-gray-600">
                              {su.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {data.length === 0 && !preview && (
        <p className="text-sm text-gray-400 text-center py-2">No territory hierarchy loaded yet.</p>
      )}
    </div>
  );
}
