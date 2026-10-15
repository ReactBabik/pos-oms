import { useState, useRef } from 'react';
import {
  Building2, Plus, Search, RefreshCcw, Users, UserCheck,
  MapPin, Phone, Mail, Calendar, Edit, Trash2, MoreVertical,
  Upload, Download, CheckCircle, AlertCircle, ChevronRight, FileSpreadsheet
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { toast } from 'sonner';
import { Language } from '../App';

// ── Types ────────────────────────────────────────────────────────────────────

export interface FranchiseMaster {
  // BSA Coordinates
  province: string;
  zone: string;
  region: string;
  district: string;
  tehsil: string;
  salesUnit: string;
  bsaId: string;
  bsaName: string;
  bsaInfo1: string;
  bsaInfo2: string;
  bsaInfo3: string;
  // Franchise Info
  associatedFranchiseId: string;
  franchiseName: string;
  franchiseOwnerName: string;
  franchisePhone: string;
  franchiseEmail: string;
  franchiseAddress: string;
  franchiseStatus: string;
  // Village
  villageId: string;
  villageName: string;
  villageInfo1: string;
  villageInfo2: string;
  // Internal
  id: string;
}

const BULK_COLUMNS: { key: keyof FranchiseMaster; label: string }[] = [
  { key: 'province',             label: 'Province' },
  { key: 'zone',                 label: 'Zone' },
  { key: 'region',               label: 'Region' },
  { key: 'district',             label: 'District' },
  { key: 'tehsil',               label: 'Tehsil' },
  { key: 'salesUnit',            label: 'Sales Unit' },
  { key: 'bsaId',                label: 'BSA ID' },
  { key: 'bsaName',              label: 'BSA Name' },
  { key: 'bsaInfo1',             label: 'BSA Info 1' },
  { key: 'bsaInfo2',             label: 'BSA Info 2' },
  { key: 'bsaInfo3',             label: 'BSA Info 3' },
  { key: 'associatedFranchiseId',label: 'Associated Franchise ID' },
  { key: 'franchiseName',        label: 'Franchise Name' },
  { key: 'franchiseOwnerName',   label: 'Franchise Owner Name' },
  { key: 'franchisePhone',       label: 'Franchise Phone' },
  { key: 'franchiseEmail',       label: 'Franchise Email' },
  { key: 'franchiseAddress',     label: 'Franchise Address' },
  { key: 'franchiseStatus',      label: 'Franchise Status' },
  { key: 'villageId',            label: 'Village Id' },
  { key: 'villageName',          label: 'Village Name' },
  { key: 'villageInfo1',         label: 'Village Info 1' },
  { key: 'villageInfo2',         label: 'Village Info 2' },
];

const STORAGE_KEY = 'franchiseMaster';

function loadFranchises(): FranchiseMaster[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
}
function saveFranchises(data: FranchiseMaster[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// ── CSV parser ───────────────────────────────────────────────────────────────

function parseCSV(text: string): FranchiseMaster[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) throw new Error('File appears empty');

  const rawHeaders = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());

  const colMap: Record<string, number> = {};
  BULK_COLUMNS.forEach(({ key, label }) => {
    const idx = rawHeaders.findIndex(h =>
      h === label.toLowerCase() || h === key.toLowerCase()
    );
    if (idx !== -1) colMap[key] = idx;
  });

  const missing = BULK_COLUMNS.filter(c => colMap[c.key] === undefined).map(c => c.label);
  if (missing.length > 0) throw new Error(`Missing columns: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '…' : ''}`);

  const records: FranchiseMaster[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    if (cols.every(c => !c)) continue;
    const rec: any = { id: `${Date.now()}-${i}` };
    BULK_COLUMNS.forEach(({ key }) => { rec[key] = cols[colMap[key]] || ''; });
    records.push(rec as FranchiseMaster);
  }
  return records;
}

function downloadTemplate() {
  const headers = BULK_COLUMNS.map(c => c.label).join(',');
  const sample = BULK_COLUMNS.map(c => {
    const ex: Record<string, string> = {
      Province: 'Punjab', Zone: 'North Zone', Region: 'Lahore Region',
      District: 'Lahore', Tehsil: 'Lahore City', 'Sales Unit': 'LHR Central SU',
      'BSA ID': 'BSA-001', 'BSA Name': 'Ahmed BSA', 'BSA Info 1': 'Info A',
      'BSA Info 2': 'Info B', 'BSA Info 3': 'Info C',
      'Associated Franchise ID': 'FR-001', 'Franchise Name': 'Naya Savera Store',
      'Franchise Owner Name': 'Muhammad Ali', 'Franchise Phone': '+92 300 0000001',
      'Franchise Email': 'store@example.com', 'Franchise Address': 'Main Bazar',
      'Franchise Status': 'Active', 'Village Id': 'VLG-001',
      'Village Name': 'Chak 10', 'Village Info 1': 'Near Canal', 'Village Info 2': '',
    };
    return ex[c.label] || '';
  }).join(',');

  const blob = new Blob([`${headers}\n${sample}`], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url;
  a.download = 'franchise-master-template.csv'; a.click();
}

// ── Empty form ────────────────────────────────────────────────────────────────

const emptyForm = (): Omit<FranchiseMaster, 'id'> => ({
  province: '', zone: '', region: '', district: '', tehsil: '', salesUnit: '',
  bsaId: '', bsaName: '', bsaInfo1: '', bsaInfo2: '', bsaInfo3: '',
  associatedFranchiseId: '', franchiseName: '', franchiseOwnerName: '',
  franchisePhone: '', franchiseEmail: '', franchiseAddress: '', franchiseStatus: 'Active',
  villageId: '', villageName: '', villageInfo1: '', villageInfo2: '',
});

// ── Component ─────────────────────────────────────────────────────────────────

export function FranchiseManagement({ language }: { language: Language }) {
  const [franchises, setFranchises] = useState<FranchiseMaster[]>(loadFranchises);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Omit<FranchiseMaster, 'id'>>(emptyForm());

  // Bulk upload state
  const [bulkPreview, setBulkPreview] = useState<FranchiseMaster[] | null>(null);
  const [bulkFileName, setBulkFileName] = useState('');
  const [bulkError, setBulkError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const persist = (data: FranchiseMaster[]) => { setFranchises(data); saveFranchises(data); };

  const field = (k: keyof Omit<FranchiseMaster,'id'>, v: string) =>
    setFormData(f => ({ ...f, [k]: v }));

  // ── Bulk upload handlers ──────────────────────────────────────────────────

  const handleFile = (file: File) => {
    setBulkError(''); setBulkPreview(null); setBulkFileName(file.name);
    if (!file.name.endsWith('.csv')) {
      setBulkError('Please upload a CSV file. In Excel: File → Save As → CSV (Comma delimited).');
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const parsed = parseCSV(e.target!.result as string);
        if (!parsed.length) throw new Error('No valid rows found.');
        setBulkPreview(parsed);
      } catch (err: any) { setBulkError(err.message); }
    };
    reader.readAsText(file);
  };

  const confirmBulk = (mode: 'replace' | 'append') => {
    if (!bulkPreview) return;
    const next = mode === 'replace' ? bulkPreview : [...franchises, ...bulkPreview];
    persist(next);
    setBulkPreview(null); setBulkFileName('');
    toast.success(`${mode === 'replace' ? 'Replaced' : 'Appended'} ${bulkPreview.length} franchise records`);
  };

  // ── CRUD ──────────────────────────────────────────────────────────────────

  const handleSave = () => {
    if (!formData.franchiseName.trim()) { toast.error('Franchise Name is required'); return; }
    if (editingId) {
      persist(franchises.map(f => f.id === editingId ? { ...f, ...formData } : f));
      toast.success('Franchise updated');
    } else {
      persist([...franchises, { ...formData, id: Date.now().toString() }]);
      toast.success('Franchise added');
    }
    setShowAddDialog(false); setEditingId(null); setFormData(emptyForm());
  };

  const handleDelete = () => {
    if (!deleteId) return;
    persist(franchises.filter(f => f.id !== deleteId));
    toast.success('Franchise deleted');
    setShowDeleteDialog(false); setDeleteId(null);
  };

  const openEdit = (f: FranchiseMaster) => {
    setEditingId(f.id);
    const { id, ...rest } = f; setFormData(rest);
    setShowAddDialog(true);
  };

  // ── Filter ────────────────────────────────────────────────────────────────

  const filtered = franchises.filter(f =>
    [f.franchiseName, f.franchiseOwnerName, f.franchisePhone, f.zone, f.region,
     f.salesUnit, f.bsaName, f.villageName, f.associatedFranchiseId]
      .some(v => v.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const stats = {
    total: franchises.length,
    active: franchises.filter(f => f.franchiseStatus.toLowerCase() === 'active').length,
    zones: new Set(franchises.map(f => f.zone).filter(Boolean)).size,
    salesUnits: new Set(franchises.map(f => f.salesUnit).filter(Boolean)).size,
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col gap-5">
      <h1 className="text-2xl font-bold text-gray-900">Franchises</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Franchises', value: stats.total, icon: Building2 },
          { label: 'Active', value: stats.active, icon: UserCheck },
          { label: 'Zones', value: stats.zones, icon: MapPin },
          { label: 'Sales Units', value: stats.salesUnits, icon: Users },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardHeader className="pb-2">
              <CardDescription>{label}</CardDescription>
              <div className="flex items-center justify-between">
                <CardTitle className="text-3xl font-bold">{value}</CardTitle>
                <div className="bg-pink-50 p-3 rounded-lg"><Icon className="size-5 text-[#C7359C]" /></div>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="list" className="flex-1 flex flex-col">
        <TabsList className="w-full max-w-xs">
          <TabsTrigger value="list" className="flex-1">Franchise List</TabsTrigger>
          <TabsTrigger value="bulk" className="flex-1">Bulk Upload</TabsTrigger>
        </TabsList>

        {/* ── LIST TAB ── */}
        <TabsContent value="list" className="flex-1 mt-4">
          <Card className="flex-1">
            <CardHeader>
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                <div className="relative flex-1 w-full sm:max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                  <Input placeholder="Search name, zone, region, BSA, village…" value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)} className="pl-10" />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setSearchQuery('')}>
                    <RefreshCcw className="size-4 mr-2" /> Refresh
                  </Button>
                  <Button onClick={() => { setFormData(emptyForm()); setEditingId(null); setShowAddDialog(true); }}
                    className="bg-gradient-to-r from-[#C7359C] to-[#9b2b7a] text-white">
                    <Plus className="size-4 mr-2" /> Add Franchise
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="bg-gray-100 p-6 rounded-full mb-4">
                    <Building2 className="size-12 text-gray-400" />
                  </div>
                  <p className="text-gray-500">No franchises yet — add one manually or use Bulk Upload</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        {['Franchise', 'Zone / Region / SU', 'BSA', 'Village', 'Owner', 'Phone', 'Status', ''].map(h => (
                          <th key={h} className="text-left py-2.5 px-3 font-semibold text-gray-700 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(f => (
                        <tr key={f.id} className="border-b hover:bg-gray-50">
                          <td className="py-2.5 px-3">
                            <p className="font-semibold">{f.franchiseName}</p>
                            <p className="text-xs text-gray-400 font-mono">{f.associatedFranchiseId}</p>
                          </td>
                          <td className="py-2.5 px-3 text-xs">
                            <p className="font-medium">{f.zone}</p>
                            <p className="text-gray-500">{f.region} / {f.salesUnit}</p>
                          </td>
                          <td className="py-2.5 px-3 text-xs">
                            <p className="font-medium">{f.bsaName}</p>
                            <p className="text-gray-400 font-mono">{f.bsaId}</p>
                          </td>
                          <td className="py-2.5 px-3 text-xs">
                            <p>{f.villageName}</p>
                            <p className="text-gray-400">{f.villageId}</p>
                          </td>
                          <td className="py-2.5 px-3">{f.franchiseOwnerName}</td>
                          <td className="py-2.5 px-3 text-xs">{f.franchisePhone}</td>
                          <td className="py-2.5 px-3">
                            <Badge variant={f.franchiseStatus.toLowerCase() === 'active' ? 'default' : 'secondary'}>
                              {f.franchiseStatus}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm"><MoreVertical className="size-4" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEdit(f)}>
                                  <Edit className="size-4 mr-2" /> Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setDeleteId(f.id); setShowDeleteDialog(true); }} className="text-red-600">
                                  <Trash2 className="size-4 mr-2" /> Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── BULK UPLOAD TAB ── */}
        <TabsContent value="bulk" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="size-5 text-[#C7359C]" />
                Bulk Upload — Franchise Master
              </CardTitle>
              <CardDescription>
                Upload a CSV with all 22 required columns. Download the template below, fill it in Excel, then save as CSV.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">

              {/* Required columns reference */}
              <div className="bg-gray-50 border rounded-lg p-4">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Required Columns ({BULK_COLUMNS.length})</p>
                <div className="flex flex-wrap gap-1.5">
                  {BULK_COLUMNS.map(c => (
                    <span key={c.key} className="text-xs bg-white border border-gray-200 rounded px-2 py-0.5 text-gray-700">{c.label}</span>
                  ))}
                </div>
              </div>

              {/* Template download */}
              <Button variant="outline" onClick={downloadTemplate} className="gap-2">
                <Download className="size-4" /> Download CSV Template
              </Button>

              {/* Drop zone */}
              <div
                onDrop={e => { e.preventDefault(); e.dataTransfer.files[0] && handleFile(e.dataTransfer.files[0]); }}
                onDragOver={e => e.preventDefault()}
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-pink-200 hover:border-[#C7359C] rounded-xl p-8 text-center cursor-pointer transition-colors bg-pink-50/30 hover:bg-pink-50"
              >
                <Upload className="size-8 text-[#C7359C] mx-auto mb-2" />
                <p className="text-sm font-semibold text-gray-800">Drop CSV file here or click to select</p>
                <p className="text-xs text-gray-500 mt-1">Accepts .csv files only</p>
                {bulkFileName && <p className="text-xs text-[#C7359C] mt-2 font-medium">{bulkFileName}</p>}
                <input ref={fileRef} type="file" accept=".csv" className="hidden"
                  onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
              </div>

              {/* Error */}
              {bulkError && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
                  <AlertCircle className="size-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{bulkError}</p>
                </div>
              )}

              {/* Preview */}
              {bulkPreview && (
                <div className="border border-green-200 rounded-xl overflow-hidden">
                  <div className="bg-green-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="size-4 text-green-600" />
                      <span className="text-sm font-semibold text-green-800">
                        {bulkPreview.length} records ready to import
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => { setBulkPreview(null); setBulkFileName(''); }}>
                        Cancel
                      </Button>
                      <Button size="sm" variant="outline"
                        onClick={() => confirmBulk('append')}
                        className="border-[#C7359C] text-[#C7359C] hover:bg-pink-50">
                        Append to existing
                      </Button>
                      <Button size="sm" onClick={() => confirmBulk('replace')}
                        className="bg-[#C7359C] hover:bg-[#9b2b7a] text-white">
                        Replace all
                      </Button>
                    </div>
                  </div>

                  {/* Preview table — first 5 rows */}
                  <div className="overflow-x-auto max-h-56">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          {['Franchise Name', 'Zone', 'Region', 'Sales Unit', 'BSA Name', 'Village', 'Status'].map(h => (
                            <th key={h} className="text-left py-2 px-3 font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {bulkPreview.slice(0, 5).map((r, i) => (
                          <tr key={i}>
                            <td className="py-1.5 px-3">{r.franchiseName}</td>
                            <td className="py-1.5 px-3">{r.zone}</td>
                            <td className="py-1.5 px-3">{r.region}</td>
                            <td className="py-1.5 px-3">{r.salesUnit}</td>
                            <td className="py-1.5 px-3">{r.bsaName}</td>
                            <td className="py-1.5 px-3">{r.villageName}</td>
                            <td className="py-1.5 px-3">{r.franchiseStatus}</td>
                          </tr>
                        ))}
                        {bulkPreview.length > 5 && (
                          <tr><td colSpan={7} className="py-2 px-3 text-gray-400 text-center">
                            …and {bulkPreview.length - 5} more rows
                          </td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {franchises.length > 0 && !bulkPreview && (
                <p className="text-xs text-gray-500">
                  Currently <strong>{franchises.length}</strong> franchise record{franchises.length !== 1 ? 's' : ''} loaded.
                  Uploading with "Replace all" will overwrite them.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Add / Edit Dialog ── */}
      <Dialog open={showAddDialog} onOpenChange={v => { setShowAddDialog(v); if (!v) { setEditingId(null); setFormData(emptyForm()); } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Franchise' : 'Add New Franchise'}</DialogTitle>
            <DialogDescription>Fill in the franchise master details</DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 py-2">
            {/* BSA Coordinates */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">BSA Coordinates</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {(['province','zone','region','district','tehsil','salesUnit'] as const).map(k => (
                  <div key={k} className="space-y-1">
                    <Label className="text-xs">{BULK_COLUMNS.find(c=>c.key===k)!.label}</Label>
                    <Input value={formData[k]} onChange={e => field(k, e.target.value)} placeholder={BULK_COLUMNS.find(c=>c.key===k)!.label} />
                  </div>
                ))}
              </div>
            </div>

            {/* BSA Info */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">BSA Info</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {(['bsaId','bsaName','bsaInfo1','bsaInfo2','bsaInfo3'] as const).map(k => (
                  <div key={k} className="space-y-1">
                    <Label className="text-xs">{BULK_COLUMNS.find(c=>c.key===k)!.label}</Label>
                    <Input value={formData[k]} onChange={e => field(k, e.target.value)} placeholder={BULK_COLUMNS.find(c=>c.key===k)!.label} />
                  </div>
                ))}
              </div>
            </div>

            {/* Franchise Info */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Franchise Info</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {(['associatedFranchiseId','franchiseName','franchiseOwnerName','franchisePhone','franchiseEmail','franchiseAddress'] as const).map(k => (
                  <div key={k} className="space-y-1">
                    <Label className="text-xs">{BULK_COLUMNS.find(c=>c.key===k)!.label}</Label>
                    <Input value={formData[k]} onChange={e => field(k, e.target.value)} placeholder={BULK_COLUMNS.find(c=>c.key===k)!.label} />
                  </div>
                ))}
                <div className="space-y-1">
                  <Label className="text-xs">Franchise Status</Label>
                  <Select value={formData.franchiseStatus} onValueChange={v => field('franchiseStatus', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Village */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Village</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {(['villageId','villageName','villageInfo1','villageInfo2'] as const).map(k => (
                  <div key={k} className="space-y-1">
                    <Label className="text-xs">{BULK_COLUMNS.find(c=>c.key===k)!.label}</Label>
                    <Input value={formData[k]} onChange={e => field(k, e.target.value)} placeholder={BULK_COLUMNS.find(c=>c.key===k)!.label} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddDialog(false); setEditingId(null); setFormData(emptyForm()); }}>Cancel</Button>
            <Button onClick={handleSave} className="bg-gradient-to-r from-[#C7359C] to-[#9b2b7a] text-white">
              {editingId ? 'Save Changes' : 'Add Franchise'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm ── */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Franchise</DialogTitle>
            <DialogDescription>Are you sure? This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
