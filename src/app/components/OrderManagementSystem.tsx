import { useEffect, useMemo, useState } from 'react';
import {
  ClipboardList, Plus, Search, Download, MoreVertical, Eye, Edit, Undo2, XCircle,
  CheckCircle2, Clock, Building2, PackageCheck, AlertTriangle, Trash2, RefreshCw, RotateCcw, ChevronDown, BarChart3, List, Calendar, Inbox, Zap,
} from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';
import { Switch } from './ui/switch';
import { Textarea } from './ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import type { Language } from '../App';
import { useFranchiseFilters } from '../utils/franchiseFilters';
import { SYNC_KEY, resetSampleSyncTimes, sampleFranchise } from '../utils/sampleFranchises';

const API_URL = `https://${projectId}.supabase.co/functions/v1/make-server-77be783d`;
const STORAGE_KEY = 'omsOrders_v2';
const AUTO_ASSIGN_KEY = 'omsAutoAssignOnConfirm';
const CURRENT_USER = 'Admin User';

// ── Types ────────────────────────────────────────────────────────────────────

type Stage = 'pending' | 'confirmed' | 'unassigned' | 'assigned' | 'delivered' | 'cancelled';
type ActiveStage = Exclude<Stage, 'cancelled'>;

interface OrderItem {
  variantId: string; // empty for custom items that are not in the catalogue
  name: string;
  qty: number;
  price: number;
}

interface TimelineEvent {
  at: string;
  by: string;
  action: string;
  note?: string;
}

interface Order {
  id: string;
  source: 'E-commerce' | 'Manual';
  createdAt: string;
  customerName: string;
  phone: string;
  address: string;
  city: string;
  paymentMethod: 'COD'; // COD is the only payment method for now
  items: OrderItem[];
  deliveryCharges: number;
  stage: Stage;
  cancelledFrom?: ActiveStage;
  cancelReason?: string;
  unassignedReason?: string; // why auto-assignment could not place the order, or why it was taken off a franchise
  assignedBy?: 'auto' | 'manual';
  franchiseKey?: string;
  franchiseName?: string;
  zone?: string;
  region?: string;
  salesUnit?: string;
  stockConfirmed?: boolean;
  timeline: TimelineEvent[];
}

interface CatalogueItem { variantId: string; name: string; price: number; stock: number; crops?: string[]; }
interface FranchiseOption { key: string; name: string; zone: string; region: string; salesUnit: string; }

// Stages where an order still needs work. The in-process view shows these whatever their order date.
const PROCESSING: Stage[] = ['pending', 'confirmed', 'unassigned', 'assigned'];

type DateFilter = 'all' | 'today' | 'last7' | 'mtd' | 'ytd' | 'custom';
const DATE_FILTERS: [DateFilter, string, string][] = [
  ['all', 'All Time', 'All Time'], ['today', 'Today', 'Today'], ['last7', '7 Days', 'Last 7 Days'],
  ['mtd', 'MTD', 'Month to Date'], ['ytd', 'YTD', 'Year to Date'], ['custom', 'Custom', 'Custom Range'],
];

type DialogState =
  | { type: 'add' }
  | { type: 'details' | 'edit'; id: string }
  | { type: 'assign' | 'cancel' | 'revert'; ids: string[] }
  | null;

// ── Constants ────────────────────────────────────────────────────────────────

const FLOW: ActiveStage[] = ['pending', 'confirmed', 'unassigned', 'assigned', 'delivered'];

const STAGE_META: Record<Stage, { label: string; badge: string; icon: typeof Clock; hint: string }> = {
  pending:   { label: 'Pending',   badge: 'bg-amber-100 text-amber-800 border-amber-200',   icon: Clock,        hint: 'Awaiting confirmation' },
  confirmed: { label: 'Confirmed', badge: 'bg-blue-100 text-blue-800 border-blue-200',      icon: CheckCircle2, hint: 'Awaiting auto-assign' },
  unassigned:{ label: 'Unassigned',badge: 'bg-orange-100 text-orange-800 border-orange-200', icon: Inbox,       hint: 'Needs manual assign' },
  assigned:  { label: 'Assigned',  badge: 'bg-purple-100 text-purple-800 border-purple-200', icon: Building2,    hint: 'With franchise' },
  delivered: { label: 'Delivered', badge: 'bg-green-100 text-green-800 border-green-200',   icon: PackageCheck, hint: 'Completed' },
  cancelled: { label: 'Cancelled', badge: 'bg-red-100 text-red-800 border-red-200',         icon: XCircle,      hint: 'With reason' },
};

const NEXT_ACTION: Partial<Record<Stage, string>> = {
  pending: 'Confirm',
  confirmed: 'Auto-assign',
  unassigned: 'Assign',
  assigned: 'Mark Delivered',
};

const CANCEL_REASONS = [
  'Customer unreachable', 'Customer requested cancellation', 'Out of stock', 'Wrong / incomplete address',
  'Duplicate order', 'Outside delivery area', 'Fake / test order', 'Other',
];
const REVERT_REASONS = [
  'Updated in error', 'Customer changed request', 'Franchise could not fulfil',
  'Stock not available', 'Delivery failed', 'Other',
];
const EDIT_REASONS = [
  'Delivery charges changed', 'Product not available', 'Quantity changed by customer',
  'Product replaced', 'Price correction', 'Customer details corrected', 'Other',
];

// ── Helpers ──────────────────────────────────────────────────────────────────

const money = (n: number) => `PKR ${Math.round(n).toLocaleString()}`;
const subtotalOf = (o: Pick<Order, 'items'>) => o.items.reduce((s, i) => s + i.qty * i.price, 0);
const totalOf = (o: Pick<Order, 'items' | 'deliveryCharges'>) => subtotalOf(o) + o.deliveryCharges;
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const event = (action: string, note?: string, at = new Date().toISOString(), by = CURRENT_USER): TimelineEvent =>
  ({ at, by, action, ...(note ? { note } : {}) });

function loadOrders(): Order[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    // Orders saved before payment became COD-only may still say Prepaid.
    return raw ? (JSON.parse(raw) as Order[]).map(o => ({ ...o, paymentMethod: 'COD' as const })) : null;
  } catch { return null; }
}

// The franchise master holds one row per village, so the same franchise repeats.
function loadFranchiseOptions(): FranchiseOption[] {
  try {
    const rows: any[] = JSON.parse(localStorage.getItem('franchiseMaster') || '[]');
    const seen = new Map<string, FranchiseOption>();
    rows.forEach(r => {
      if (!r.franchiseName || (r.franchiseStatus || '').toLowerCase() === 'inactive') return;
      const key = r.associatedFranchiseId || r.franchiseName;
      if (!seen.has(key)) {
        seen.set(key, { key, name: r.franchiseName, zone: r.zone || '', region: r.region || '', salesUnit: r.salesUnit || '' });
      }
    });
    return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
  } catch { return []; }
}

const FALLBACK_CATALOGUE: CatalogueItem[] = [
  { variantId: '', name: 'Sample Fungicide 200ml', price: 2850, stock: 0 },
  { variantId: '', name: 'Sample Insecticide 100ml', price: 1950, stock: 0 },
  { variantId: '', name: 'Sample Herbicide 1L', price: 3400, stock: 0 },
  { variantId: '', name: 'Sample Biostimulant 500ml', price: 2200, stock: 0 },
  { variantId: '', name: 'Sample Seed Pack 2kg', price: 5600, stock: 0 },
];

// ── Auto-assignment ──────────────────────────────────────────────────────────

// A franchise that has not synced for this long is treated as offline and skipped.
const OFFLINE_AFTER_MINUTES = 3 * 24 * 60;

type AutoAssignResult = { franchise: FranchiseOption; note: string } | { reason: string };

// Stand-in rule until polygon / nearest-location rules exist: the order's city is matched against each
// franchise's district, tehsil and village names. Inactive and offline franchises are skipped, and the
// most recently synced match wins.
function autoAssign(city: string): AutoAssignResult {
  let rows: any[] = [];
  try { rows = JSON.parse(localStorage.getItem('franchiseMaster') || '[]'); } catch { /* treat as no franchises */ }
  const target = city.trim().toLowerCase();
  const byKey = new Map<string, any>();
  rows.filter(r => [r.district, r.tehsil, r.villageName].some(v => v && String(v).trim().toLowerCase() === target))
    .forEach(r => { const key = r.associatedFranchiseId || r.franchiseName; if (!byKey.has(key)) byKey.set(key, { ...r, key }); });
  const matches = Array.from(byKey.values());
  if (matches.length === 0) return { reason: `No franchise covers ${city}` };

  const active = matches.filter(r => (r.franchiseStatus || '').toLowerCase() !== 'inactive');
  if (active.length === 0) return { reason: `${matches.map(r => r.franchiseName).join(', ')} ${matches.length === 1 ? 'is' : 'are'} inactive` };

  const minutesSince = (key: string) => (Date.now() - new Date(getLastSync(key)).getTime()) / 60_000;
  const online = active.filter(r => minutesSince(r.key) < OFFLINE_AFTER_MINUTES);
  if (online.length === 0) {
    return { reason: active.map(r => `${r.franchiseName} is offline (last synced ${syncStatus(getLastSync(r.key)).label})`).join('; ') };
  }
  const best = online.sort((a, b) => minutesSince(a.key) - minutesSince(b.key))[0];
  return {
    franchise: { key: best.key, name: best.franchiseName, zone: best.zone || '', region: best.region || '', salesUnit: best.salesUnit || '' },
    note: `Matched by city: ${city}`,
  };
}

// ── Sample orders ────────────────────────────────────────────────────────────

type StockKind = 'in' | 'out' | 'low' | 'any';
type SampleStep =
  | { do: 'confirm'; note?: string }
  | { do: 'auto'; key: string }
  | { do: 'autoFail'; reason: string }
  | { do: 'assign'; key: string }
  | { do: 'reassign'; key: string; reason: string }
  | { do: 'unassign'; reason: string }
  | { do: 'edit'; reason: string; delivery: number }
  | { do: 'deliver' }
  | { do: 'cancel'; reason: string }
  | { do: 'restore'; reason: string };

interface SampleOrder {
  customer: [string, string, string, string]; // name, phone, address, city
  hoursAgo: number;
  source?: 'Manual';
  items: [StockKind, number][];
  steps: SampleStep[];
}

const AUTO_OFF = 'Auto-assign on confirm was switched off';

// Each sample shows one situation the admin will meet. Ages spread across today, this week, this month,
// this year and last year so every date filter has something to show.
const SAMPLE_ORDERS: SampleOrder[] = [
  // Pending
  { customer: ['Muhammad Aslam', '0300-0000101', 'Chak 12, Near Canal Road', 'Sahiwal'], hoursAgo: 2, items: [['in', 2]], steps: [] },
  { customer: ['Hamza Raza', '0314-0000115', 'Shop 3, Ferozepur Road', 'Lahore'], hoursAgo: 1, source: 'Manual', items: [['in', 1], ['any', 1]], steps: [] },
  { customer: ['Imran Chaudhry', '0303-0000104', 'Chak 88 JB', 'Faisalabad'], hoursAgo: 50, items: [['any', 3]], steps: [] },
  // Confirmed, waiting for auto-assignment
  { customer: ['Rana Shahid', '0302-0000103', 'Street 4, Model Town', 'Okara'], hoursAgo: 26, items: [['in', 1]], steps: [{ do: 'confirm', note: AUTO_OFF }] },
  { customer: ['Tariq Hussain', '0308-0000109', 'Mohalla Islamabad, GT Road', 'Gujranwala'], hoursAgo: 70, items: [['any', 2], ['any', 1]], steps: [{ do: 'confirm', note: AUTO_OFF }] },
  // Unassigned: each reason auto-assignment can fail, plus an order taken off its franchise
  { customer: ['Ghulam Rasool', '0301-0000102', 'Mouza Kot Addu, Main Bazar', 'Muzaffargarh'], hoursAgo: 20, items: [['any', 2]], steps: [{ do: 'confirm' }, { do: 'autoFail', reason: 'No franchise covers Muzaffargarh' }] },
  { customer: ['Asif Javed', '0312-0000113', 'Main Road, Mian Channu', 'Khanewal'], hoursAgo: 44, items: [['in', 1]], steps: [{ do: 'confirm' }, { do: 'autoFail', reason: 'Naya Savera Khanewal is offline (last synced 4 days ago)' }] },
  { customer: ['Khalid Mehmood', '0307-0000108', 'Adda Pul Bagar', 'Bahawalpur'], hoursAgo: 90, items: [['any', 1]], steps: [{ do: 'confirm' }, { do: 'autoFail', reason: 'Naya Savera Bahawalpur is inactive' }] },
  { customer: ['Abdul Ghaffar', '0304-0000105', 'Basti Malook, Multan Road', 'Multan'], hoursAgo: 120, items: [['in', 2]], steps: [{ do: 'confirm' }, { do: 'auto', key: 'FR-105' }, { do: 'unassign', reason: 'Franchise could not fulfil' }] },
  // Assigned: every sync state, stock in / short / out, manual, reassigned, edited and restored orders
  { customer: ['Farooq Ahmad', '0310-0000111', 'Village Dera Rahim', 'Sahiwal'], hoursAgo: 5, items: [['in', 1], ['in', 2]], steps: [{ do: 'confirm' }, { do: 'auto', key: 'FR-101' }] },
  { customer: ['Bilal Tariq', '0313-0000114', 'Chak 9 Pull', 'Okara'], hoursAgo: 30, items: [['out', 2]], steps: [{ do: 'confirm' }, { do: 'auto', key: 'FR-102' }] },
  { customer: ['Shahbaz Anjum', '0315-0000116', 'Chak 204 RB', 'Faisalabad'], hoursAgo: 60, items: [['low', 3]], steps: [{ do: 'confirm' }, { do: 'auto', key: 'FR-103' }] },
  { customer: ['Naveed Akhtar', '0306-0000107', 'Chak 45 SB', 'Sargodha'], hoursAgo: 75, items: [['in', 1]], steps: [{ do: 'confirm' }, { do: 'auto', key: 'FR-104' }] },
  { customer: ['Mazhar Iqbal', '0316-0000117', 'Bosan Road', 'Multan'], hoursAgo: 100, items: [['in', 2]], steps: [{ do: 'confirm' }, { do: 'auto', key: 'FR-105' }, { do: 'edit', reason: 'Delivery charges changed', delivery: 400 }] },
  { customer: ['Sajid Ali', '0309-0000110', 'Chak 7 Faiz', 'Rahim Yar Khan'], hoursAgo: 140, items: [['in', 1]], steps: [{ do: 'confirm' }, { do: 'autoFail', reason: 'No franchise covers Rahim Yar Khan' }, { do: 'assign', key: 'FR-107' }] },
  { customer: ['Nadeem Shah', '0317-0000118', 'Chak 99 NB', 'Sargodha'], hoursAgo: 160, items: [['any', 2]], steps: [{ do: 'confirm' }, { do: 'auto', key: 'FR-104' }, { do: 'reassign', key: 'FR-103', reason: 'Franchise could not fulfil' }] },
  { customer: ['Usman Ghani', '0318-0000119', 'Satellite Town', 'Gujranwala'], hoursAgo: 180, items: [['in', 1]], steps: [{ do: 'confirm' }, { do: 'auto', key: 'FR-109' }, { do: 'cancel', reason: 'Customer requested cancellation' }, { do: 'restore', reason: 'Customer changed request' }] },
  { customer: ['Iftikhar Ahmed', '0319-0000120', 'Mian Channu Bypass', 'Khanewal'], hoursAgo: 200, items: [['in', 1]], steps: [{ do: 'confirm' }, { do: 'auto', key: 'FR-106' }] },
  // Delivered
  { customer: ['Zafar Iqbal', '0305-0000106', 'Village Jhok Sial', 'Vehari'], hoursAgo: 240, items: [['in', 1], ['any', 1]], steps: [{ do: 'confirm' }, { do: 'auto', key: 'FR-107' }, { do: 'deliver' }] },
  { customer: ['Hamid Khan', '0321-0000122', 'Shujabad Road', 'Multan'], hoursAgo: 360, source: 'Manual', items: [['in', 1], ['any', 2]], steps: [{ do: 'confirm' }, { do: 'auto', key: 'FR-105' }, { do: 'deliver' }] },
  { customer: ['Rizwan Haider', '0320-0000121', 'Chak 5/11L', 'Sahiwal'], hoursAgo: 600, items: [['any', 2]], steps: [{ do: 'confirm' }, { do: 'auto', key: 'FR-101' }, { do: 'deliver' }] },
  { customer: ['Akram Bhatti', '0322-0000123', 'Chak 61 JB', 'Faisalabad'], hoursAgo: 7200, items: [['any', 1]], steps: [{ do: 'confirm' }, { do: 'auto', key: 'FR-103' }, { do: 'deliver' }] },
  // Cancelled from each stage it can be cancelled from
  { customer: ['Waseem Abbas', '0311-0000112', 'Chak 130 EB', 'Vehari'], hoursAgo: 150, items: [['any', 1]], steps: [{ do: 'cancel', reason: 'Customer unreachable' }] },
  { customer: ['Pervaiz Akhtar', '0325-0000126', 'Kot Momin', 'Sargodha'], hoursAgo: 110, items: [['any', 1]], steps: [{ do: 'confirm', note: AUTO_OFF }, { do: 'cancel', reason: 'Duplicate order' }] },
  { customer: ['Shakeel Ahmad', '0323-0000124', 'Jamal Din Wali', 'Rahim Yar Khan'], hoursAgo: 220, items: [['any', 2]], steps: [{ do: 'confirm' }, { do: 'autoFail', reason: 'No franchise covers Rahim Yar Khan' }, { do: 'cancel', reason: 'Outside delivery area' }] },
  { customer: ['Kashif Mehmood', '0324-0000125', 'Renala Khurd', 'Okara'], hoursAgo: 960, items: [['out', 1]], steps: [{ do: 'confirm' }, { do: 'auto', key: 'FR-102' }, { do: 'cancel', reason: 'Out of stock' }] },
];

const NO_FRANCHISE = { franchiseKey: undefined, franchiseName: undefined, zone: undefined, region: undefined, salesUnit: undefined, stockConfirmed: undefined, assignedBy: undefined };
const franchiseFields = (f: FranchiseOption, by: 'auto' | 'manual') => ({
  franchiseKey: f.key, franchiseName: f.name, zone: f.zone, region: f.region, salesUnit: f.salesUnit,
  assignedBy: by, stockConfirmed: by === 'manual', unassignedReason: undefined,
});

function applySampleStep(o: Order, step: SampleStep, at: string): Order {
  const log = (action: string, note?: string) => [...o.timeline, event(action, note, at)];
  switch (step.do) {
    case 'confirm':
      return { ...o, stage: 'confirmed', timeline: log('Confirmed', step.note) };
    case 'auto': {
      const f = sampleFranchise(step.key);
      return { ...o, ...franchiseFields(f, 'auto'), stage: 'assigned', timeline: [...o.timeline, event(`Auto-assigned to ${f.name}`, `Matched by city: ${o.city}`, at, 'System')] };
    }
    case 'autoFail':
      return { ...o, stage: 'unassigned', unassignedReason: step.reason, timeline: [...o.timeline, event('Moved to Unassigned', step.reason, at, 'System')] };
    case 'assign': {
      const f = sampleFranchise(step.key);
      return { ...o, ...franchiseFields(f, 'manual'), stage: 'assigned', timeline: log(`Assigned to ${f.name}`, 'Manual assignment. Stock confirmed with franchise') };
    }
    case 'reassign': {
      const f = sampleFranchise(step.key);
      return { ...o, ...franchiseFields(f, 'manual'), timeline: log(`Reassigned from ${o.franchiseName} to ${f.name}`, `${step.reason}. Stock confirmed with franchise`) };
    }
    case 'unassign':
      return { ...o, ...NO_FRANCHISE, stage: 'unassigned', unassignedReason: `Removed from ${o.franchiseName}: ${step.reason}`, timeline: log('Reverted from Assigned to Unassigned', step.reason) };
    case 'edit': {
      const next = { ...o, deliveryCharges: step.delivery };
      return { ...next, timeline: log('Order edited', `${step.reason}. Total ${money(totalOf(o))} → ${money(totalOf(next))}`) };
    }
    case 'deliver':
      return { ...o, stage: 'delivered', timeline: log('Delivered') };
    case 'cancel':
      return { ...o, stage: 'cancelled', cancelledFrom: o.stage as ActiveStage, cancelReason: step.reason, timeline: log(`Cancelled from ${STAGE_META[o.stage].label}`, step.reason) };
    case 'restore': {
      const back = o.cancelledFrom ?? 'pending';
      return { ...o, stage: back, cancelledFrom: undefined, cancelReason: undefined, timeline: log(`Restored to ${STAGE_META[back].label}`, step.reason) };
    }
  }
}

function seedOrders(catalogue: CatalogueItem[]): Order[] {
  const products = catalogue.length ? catalogue : FALLBACK_CATALOGUE;
  const turn: Record<StockKind, number> = { in: 0, out: 0, low: 0, any: 0 };
  const pick = (kind: StockKind, qty: number): OrderItem => {
    const fits = (c: CatalogueItem) =>
      kind === 'in' ? c.stock >= qty + 2 : kind === 'out' ? c.stock === 0 : kind === 'low' ? c.stock > 0 && c.stock < qty : true;
    // Typical retail prices only, so a one-off item like farm machinery doesn't skew the sample totals.
    const typical = products.filter(c => c.price >= 300 && c.price <= 15000);
    const base = typical.length ? typical : products;
    const pool = catalogue.length ? base.filter(fits) : [];
    const list = pool.length ? pool : base;
    const p = list[turn[kind]++ % list.length];
    return { variantId: p.variantId, name: p.name, price: p.price, qty };
  };
  // Oldest first so order numbers rise with order date.
  return [...SAMPLE_ORDERS].sort((a, b) => b.hoursAgo - a.hoursAgo).map((sample, i) => {
    const [customerName, phone, address, city] = sample.customer;
    const createdMs = Date.now() - sample.hoursAgo * 3600_000;
    const createdAt = new Date(createdMs).toISOString();
    const gap = (sample.hoursAgo * 3600_000) / (sample.steps.length + 1);
    const start: Order = {
      id: `ORD-${1001 + i}`, source: sample.source ?? 'E-commerce', createdAt,
      customerName, phone, address, city, paymentMethod: 'COD',
      items: sample.items.map(([kind, qty]) => pick(kind, qty)), deliveryCharges: 250, stage: 'pending',
      timeline: [sample.source === 'Manual'
        ? event('Order created manually', undefined, createdAt)
        : event('Order received from e-commerce', undefined, createdAt, 'System')],
    };
    return sample.steps.reduce((o, step, k) => applySampleStep(o, step, new Date(createdMs + gap * (k + 1)).toISOString()), start);
  });
}

const unitsOf = (o: Pick<Order, 'items'>) => o.items.reduce((s, i) => s + i.qty, 0);

// When the order reached a stage, taken from its timeline. Blank if it is not at or past that stage now.
function stageReachedAt(o: Order, stage: Stage): string {
  const lastEvent = (...prefixes: string[]) =>
    [...o.timeline].reverse().find(t => prefixes.some(p => t.action.startsWith(p)))?.at;
  if (stage === 'cancelled') {
    const at = o.stage === 'cancelled' ? lastEvent('Cancelled') : undefined;
    return at ? fmtDate(at) : '';
  }
  const current = o.stage === 'cancelled' ? (o.cancelledFrom ?? 'pending') : o.stage;
  if (FLOW.indexOf(current) < FLOW.indexOf(stage)) return '';
  const at = stage === 'pending' ? o.createdAt
    : stage === 'confirmed' ? lastEvent('Confirmed')
    : stage === 'unassigned' ? lastEvent('Moved to Unassigned', 'Reverted from Assigned to Unassigned')
    : stage === 'assigned' ? lastEvent('Assigned to', 'Auto-assigned to', 'Reassigned')
    : lastEvent('Delivered');
  return at ? fmtDate(at) : '';
}

function downloadCSV(filename: string, rows: (string | number)[][]) {
  const csv = rows.map(r => r.map(csvCell).join(',')).join('\n');
  // BOM so Excel reads Urdu text and the arrow/dash characters correctly
  const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Stock is checked against the assigned franchise, so it only means something once an order is assigned.
const showsStock = (o: Pick<Order, 'stage'>) => o.stage === 'assigned';

// When the franchise POS last synced. Placeholder until the POS sync API exists: sample franchises get
// set times (see utils/sampleFranchises); any other franchise gets a sample time the first time it is seen.
// Times are stored so they age naturally between visits.
function getLastSync(franchiseKey: string): string {
  let map: Record<string, string> = {};
  try { map = JSON.parse(localStorage.getItem(SYNC_KEY) || '{}'); } catch { /* start fresh */ }
  if (!map[franchiseKey]) {
    const hash = [...franchiseKey].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
    const minutesAgo = [3, 8, 45, 150, 420, 1500, 2900, 5200][hash % 8];
    map[franchiseKey] = new Date(Date.now() - minutesAgo * 60_000).toISOString();
    try { localStorage.setItem(SYNC_KEY, JSON.stringify(map)); } catch { /* keep in-memory value only */ }
  }
  return map[franchiseKey];
}

function syncStatus(iso: string): { label: string; tone: 'ok' | 'neutral' | 'warn' | 'bad' } {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins < 15) return { label: 'Online now', tone: 'ok' };
  if (mins < 60) return { label: `${mins} min ago`, tone: 'neutral' };
  const hours = Math.round(mins / 60);
  if (hours < 24) return { label: `${hours} hr ago`, tone: 'neutral' };
  const days = Math.round(hours / 24);
  return { label: `${days} day${days === 1 ? '' : 's'} ago`, tone: days >= 3 ? 'bad' : 'warn' };
}

function LastSync({ franchiseKey }: { franchiseKey: string }) {
  const iso = getLastSync(franchiseKey);
  const st = syncStatus(iso);
  const dot = { ok: 'bg-green-500', neutral: 'bg-gray-400', warn: 'bg-amber-500', bad: 'bg-red-500' }[st.tone];
  const text = { ok: 'text-green-700', neutral: 'text-gray-700', warn: 'text-amber-700', bad: 'text-red-700' }[st.tone];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap ${text}`} title={`Last synced ${fmtDate(iso)}`}>
      <span className={`size-2 rounded-full ${dot}`} /> {st.label}
    </span>
  );
}

function csvCell(v: string | number) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// ── Small presentational pieces ──────────────────────────────────────────────

function StageBadge({ stage }: { stage: Stage }) {
  return <Badge variant="outline" className={STAGE_META[stage].badge}>{STAGE_META[stage].label}</Badge>;
}

function ReasonFields({ reasons, reason, note, onReason, onNote }: {
  reasons: string[]; reason: string; note: string; onReason: (v: string) => void; onNote: (v: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label className="text-xs">Reason *</Label>
        <Select value={reason} onValueChange={onReason}>
          <SelectTrigger><SelectValue placeholder="Select a reason" /></SelectTrigger>
          <SelectContent>
            {reasons.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Note {reason === 'Other' ? '*' : '(optional)'}</Label>
        <Textarea value={note} onChange={e => onNote(e.target.value)} rows={2} placeholder="Add details" />
      </div>
    </div>
  );
}

const reasonValid = (reason: string, note: string) => !!reason && (reason !== 'Other' || !!note.trim());
const reasonText = (reason: string, note: string) => (note.trim() ? `${reason} — ${note.trim()}` : reason);

// ── Component ────────────────────────────────────────────────────────────────

export function OrderManagementSystem({ language }: { language: Language }) {
  const [orders, setOrders] = useState<Order[]>(() => loadOrders() ?? []);
  const [catalogue, setCatalogue] = useState<CatalogueItem[]>([]);
  const [catalogueLoaded, setCatalogueLoaded] = useState(false);
  const [franchises] = useState<FranchiseOption[]>(loadFranchiseOptions);
  const franchiseFilters = useFranchiseFilters();

  const [stageFilter, setStageFilter] = useState<Stage | 'all'>('all');
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [inProcessOnly, setInProcessOnly] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<DialogState>(null);
  const [view, setView] = useState<'orders' | 'analytics'>('orders');
  const [autoAssignOn, setAutoAssignOn] = useState(() => {
    try { return localStorage.getItem(AUTO_ASSIGN_KEY) !== 'off'; } catch { return true; }
  });
  const toggleAutoAssign = (on: boolean) => {
    setAutoAssignOn(on);
    try { localStorage.setItem(AUTO_ASSIGN_KEY, on ? 'on' : 'off'); } catch { /* setting lasts for this visit only */ }
  };

  const persist = (next: Order[]) => {
    setOrders(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  // Catalogue doubles as the stock source: franchise-level stock is not available,
  // so availability is checked against central inventory.
  useEffect(() => {
    (async () => {
      let items: CatalogueItem[] = [];
      try {
        const res = await fetch(`${API_URL}/products`, {
          headers: { Authorization: `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' },
        });
        const data = await res.json();
        items = (data.products || []).flatMap((p: any) =>
          (p.variants || []).map((v: any) => ({
            variantId: v.id,
            crops: p.crops || [],
            name: `${p.name} ${v.name}`.trim(),
            price: v.price || v.batches?.[0]?.price || 0,
            // Inventory can carry negative balances; for availability that means none on hand.
            stock: Math.max(0, (v.batches || []).reduce((s: number, b: any) => s + (b.quantity || 0), 0)),
          }))
        );
      } catch (error) {
        console.error('OMS - could not load product catalogue:', error);
      }
      setCatalogue(items);
      setCatalogueLoaded(true);
      if (loadOrders() === null) persist(seedOrders(items));
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stockMap = useMemo(() => new Map(catalogue.map(c => [c.variantId, c.stock])), [catalogue]);

  const stockStatus = (item: OrderItem): { label: string; tone: 'ok' | 'warn' | 'bad' | 'none' } => {
    if (!catalogueLoaded || catalogue.length === 0) return { label: 'Not checked', tone: 'none' };
    if (!item.variantId || !stockMap.has(item.variantId)) return { label: 'Not in catalogue', tone: 'none' };
    const available = stockMap.get(item.variantId)!;
    if (available === 0) return { label: 'Out of stock', tone: 'bad' };
    if (available < item.qty) return { label: `Only ${available} in stock`, tone: 'warn' };
    return { label: `In stock (${available})`, tone: 'ok' };
  };
  const hasStockIssue = (o: Order) => o.items.some(i => ['bad', 'warn'].includes(stockStatus(i).tone));
  const toneClass = { ok: 'text-green-700', warn: 'text-amber-700', bad: 'text-red-700', none: 'text-gray-400' };

  // ── Mutations ──────────────────────────────────────────────────────────────

  const applyTo = (ids: string[], fn: (o: Order) => Order | null) => {
    let applied = 0;
    const next = orders.map(o => {
      if (!ids.includes(o.id)) return o;
      const updated = fn(o);
      if (!updated) return o;
      applied++;
      return updated;
    });
    persist(next);
    return applied;
  };

  const report = (verb: string, applied: number, requested: number) => {
    const skipped = requested - applied;
    if (applied === 0) toast.error(`No orders could be ${verb} from their current stage`);
    else toast.success(`${applied} order${applied !== 1 ? 's' : ''} ${verb}${skipped ? `, ${skipped} skipped` : ''}`);
  };

  // Runs the assignment rules on one order: Assigned if a franchise matches, otherwise Unassigned with the reason.
  const runAutoAssign = (o: Order): Order => {
    const result = autoAssign(o.city);
    if ('franchise' in result) {
      return { ...o, ...franchiseFields(result.franchise, 'auto'), stage: 'assigned',
        timeline: [...o.timeline, event(`Auto-assigned to ${result.franchise.name}`, result.note, undefined, 'System')] };
    }
    return { ...o, stage: 'unassigned', unassignedReason: result.reason,
      timeline: [...o.timeline, event('Moved to Unassigned', result.reason, undefined, 'System')] };
  };

  const reportAutoAssign = (verb: string, before: Order[], ids: string[]) => {
    const after = new Map(before.map(o => [o.id, o]));
    const changed = ids.map(id => after.get(id)).filter(Boolean) as Order[];
    const assigned = changed.filter(o => o.stage === 'assigned').length;
    const unassigned = changed.filter(o => o.stage === 'unassigned').length;
    const skipped = ids.length - changed.length;
    if (changed.length === 0) { toast.error(`No orders could be ${verb} from their current stage`); return; }
    toast.success(`${changed.length} order${changed.length !== 1 ? 's' : ''} ${verb}: ${assigned} auto-assigned, ${unassigned} moved to Unassigned${skipped ? `, ${skipped} skipped` : ''}`);
  };

  const confirmOrders = (ids: string[]) => {
    const changed: Order[] = [];
    applyTo(ids, o => {
      if (o.stage !== 'pending') return null;
      const confirmed: Order = { ...o, stage: 'confirmed', timeline: [...o.timeline, event('Confirmed', autoAssignOn ? undefined : AUTO_OFF)] };
      const next = autoAssignOn ? runAutoAssign(confirmed) : confirmed;
      changed.push(next);
      return next;
    });
    if (autoAssignOn) reportAutoAssign('confirmed', changed, ids);
    else report('confirmed', changed.length, ids.length);
  };

  // Confirmed orders waiting for the rules, or Unassigned orders being retried.
  const autoAssignOrders = (ids: string[]) => {
    const changed: Order[] = [];
    applyTo(ids, o => {
      if (o.stage !== 'confirmed' && o.stage !== 'unassigned') return null;
      const next = runAutoAssign(o);
      changed.push(next);
      return next;
    });
    reportAutoAssign('processed', changed, ids);
  };

  const deliverOrders = (ids: string[]) => {
    const n = applyTo(ids, o => o.stage !== 'assigned' ? null
      : { ...o, stage: 'delivered', timeline: [...o.timeline, event('Delivered')] });
    report('marked delivered', n, ids.length);
  };

  const assignOrders = (ids: string[], f: FranchiseOption) => {
    const n = applyTo(ids, o => {
      // Reassigning an already-assigned order is a single-order action only.
      if (o.stage !== 'confirmed' && o.stage !== 'unassigned' && !(ids.length === 1 && o.stage === 'assigned')) return null;
      const action = o.stage === 'assigned' ? `Reassigned from ${o.franchiseName} to ${f.name}` : `Assigned to ${f.name}`;
      return {
        ...o, ...franchiseFields(f, 'manual'), stage: 'assigned',
        timeline: [...o.timeline, event(action, 'Manual assignment. Stock confirmed with franchise')],
      };
    });
    report('assigned', n, ids.length);
  };

  const cancelOrders = (ids: string[], reason: string) => {
    const n = applyTo(ids, o => (o.stage === 'delivered' || o.stage === 'cancelled') ? null : {
      ...o, stage: 'cancelled', cancelledFrom: o.stage, cancelReason: reason,
      timeline: [...o.timeline, event(`Cancelled from ${STAGE_META[o.stage].label}`, reason)],
    });
    report('cancelled', n, ids.length);
  };

  const revertOrders = (ids: string[], reason: string) => {
    const n = applyTo(ids, o => {
      if (o.stage === 'pending') return null;
      if (o.stage === 'cancelled') {
        const back = o.cancelledFrom ?? 'pending';
        return {
          ...o, stage: back, cancelledFrom: undefined, cancelReason: undefined,
          timeline: [...o.timeline, event(`Restored to ${STAGE_META[back].label}`, reason)],
        };
      }
      const back = FLOW[FLOW.indexOf(o.stage) - 1];
      const cleared = o.stage === 'assigned'
        ? { ...NO_FRANCHISE, unassignedReason: `Removed from ${o.franchiseName}: ${reason}` }
        : o.stage === 'unassigned' ? { unassignedReason: undefined } : {};
      return {
        ...o, ...cleared, stage: back,
        timeline: [...o.timeline, event(`Reverted from ${STAGE_META[o.stage].label} to ${STAGE_META[back].label}`, reason)],
      };
    });
    report('reverted', n, ids.length);
  };

  const advance = (o: Order) => {
    if (o.stage === 'pending') confirmOrders([o.id]);
    else if (o.stage === 'confirmed') autoAssignOrders([o.id]);
    else if (o.stage === 'unassigned') setDialog({ type: 'assign', ids: [o.id] });
    else if (o.stage === 'assigned') deliverOrders([o.id]);
  };

  const resetSamples = () => {
    if (!window.confirm('Replace all current orders with fresh sample orders?')) return;
    resetSampleSyncTimes();
    persist(seedOrders(catalogue));
    setSelected(new Set());
    toast.success('Sample orders reset');
  };

  // ── Filtering ──────────────────────────────────────────────────────────────

  // Everything except the stage filter, so the stage counters reflect the other filters.
  const baseFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let from: Date | null = null;
    let to: Date | null = null;
    if (dateFilter === 'today') from = today;
    else if (dateFilter === 'last7') { from = new Date(today); from.setDate(from.getDate() - 7); }
    else if (dateFilter === 'mtd') from = new Date(now.getFullYear(), now.getMonth(), 1);
    else if (dateFilter === 'ytd') from = new Date(now.getFullYear(), 0, 1);
    else if (dateFilter === 'custom') {
      from = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
      to = dateTo ? new Date(`${dateTo}T23:59:59`) : null;
    }
    const ff = franchiseFilters;
    return orders.filter(o => {
      if (q && ![o.id, o.customerName, o.phone, o.city, o.franchiseName || ''].some(v => v.toLowerCase().includes(q))) return false;
      const created = new Date(o.createdAt);
      if (inProcessOnly) {
        if (!PROCESSING.includes(o.stage)) return false;
      } else {
        if (from && created < from) return false;
        if (to && created > to) return false;
      }
      if (ff.zoneFilter !== 'all' && o.zone !== ff.zoneFilter) return false;
      if (ff.regionFilter !== 'all' && o.region !== ff.regionFilter) return false;
      if (ff.salesUnitFilter !== 'all' && o.salesUnit !== ff.salesUnitFilter) return false;
      if (ff.franchiseFilter !== 'all' && o.franchiseName !== ff.franchiseFilter) return false;
      return true;
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [orders, search, dateFilter, dateFrom, dateTo, inProcessOnly,
      franchiseFilters.zoneFilter, franchiseFilters.regionFilter, franchiseFilters.salesUnitFilter, franchiseFilters.franchiseFilter]);

  const filtered = stageFilter === 'all' ? baseFiltered : baseFiltered.filter(o => o.stage === stageFilter);
  const counts = (Object.keys(STAGE_META) as Stage[]).reduce(
    (acc, s) => ({ ...acc, [s]: baseFiltered.filter(o => o.stage === s).length }), {} as Record<Stage, number>);

  const selectedIds = filtered.filter(o => selected.has(o.id)).map(o => o.id);
  const allSelected = filtered.length > 0 && selectedIds.length === filtered.length;
  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const hasFilters = !!search || dateFilter !== 'all' || inProcessOnly || franchiseFilters.hasActiveFranchiseFilter;

  const exportCSV = () => {
    const headers = ['Order ID', 'Date', 'Source', 'Stage', 'Customer', 'Phone', 'Address', 'City', 'Items',
      'Subtotal', 'Delivery Charges', 'Total', 'Payment', 'Franchise', 'Zone', 'Region', 'Sales Unit', 'Cancel Reason'];
    const rows = filtered.map(o => [
      o.id, fmtDate(o.createdAt), o.source, STAGE_META[o.stage].label, o.customerName, o.phone, o.address, o.city,
      o.items.map(i => `${i.name} x${i.qty}`).join('; '),
      subtotalOf(o), o.deliveryCharges, totalOf(o), o.paymentMethod,
      o.franchiseName || '', o.zone || '', o.region || '', o.salesUnit || '', o.cancelReason || '',
    ]);
    downloadCSV(`orders-${new Date().toISOString().split('T')[0]}.csv`, [headers, ...rows]);
    toast.success(`Exported ${filtered.length} orders`);
  };

  // One row per product line, with every order-level field repeated on each line.
  const exportDetailedCSV = () => {
    const headers = [
      'Order ID', 'Order Date', 'Source', 'Stage', 'Cancelled From', 'Cancel Reason', 'Unassigned Reason', 'Assignment Method',
      'Customer', 'Customer Phone', 'Delivery Address', 'City', 'Payment',
      'Franchise ID', 'Franchise', 'Franchise Owner', 'Franchise Phone', 'Franchise Email', 'Franchise Address', 'Franchise Status', 'Franchise Last Synced',
      'Province', 'Zone', 'Region', 'District', 'Tehsil', 'Sales Unit',
      'BSA ID', 'BSA Name', 'BSA Info 1', 'BSA Info 2', 'BSA Info 3', 'Villages Served', 'Stock Confirmed',
      'Line No', 'Product', 'Product ID', 'Qty', 'Unit Price', 'Line Amount',
      'Order Units', 'Order Subtotal', 'Delivery Charges', 'Order Total',
      'Confirmed At', 'Unassigned At', 'Assigned At', 'Delivered At', 'Cancelled At',
      'Last Updated', 'Last Updated By', 'Timeline',
    ];
    // Franchise details beyond what the order stores come from the Franchise Master (one row per village).
    let master: any[] = [];
    try { master = JSON.parse(localStorage.getItem('franchiseMaster') || '[]'); } catch { /* export without master details */ }
    const rows = filtered.flatMap(o => {
      const fRows = o.franchiseKey
        ? master.filter(r => (r.associatedFranchiseId || r.franchiseName) === o.franchiseKey) : [];
      const f = fRows[0] || {};
      const villages = Array.from(new Set(fRows.map(r => r.villageName).filter(Boolean))).join('; ');
      const last = o.timeline[o.timeline.length - 1];
      const timeline = o.timeline
        .map(t => `${fmtDate(t.at)} | ${t.by} | ${t.action}${t.note ? ` | ${t.note}` : ''}`).join('\n');
      return o.items.map((i, n) => [
        o.id, fmtDate(o.createdAt), o.source, STAGE_META[o.stage].label,
        o.cancelledFrom ? STAGE_META[o.cancelledFrom].label : '', o.cancelReason || '',
        o.unassignedReason || '', o.assignedBy === 'auto' ? 'Auto' : o.assignedBy === 'manual' ? 'Manual' : '',
        o.customerName, o.phone, o.address, o.city, o.paymentMethod,
        o.franchiseKey || '', o.franchiseName || '', f.franchiseOwnerName || '', f.franchisePhone || '',
        f.franchiseEmail || '', f.franchiseAddress || '', f.franchiseStatus || '',
        o.franchiseKey ? fmtDate(getLastSync(o.franchiseKey)) : '',
        f.province || '', o.zone || '', o.region || '', f.district || '', f.tehsil || '', o.salesUnit || '',
        f.bsaId || '', f.bsaName || '', f.bsaInfo1 || '', f.bsaInfo2 || '', f.bsaInfo3 || '', villages,
        o.franchiseName ? (o.stockConfirmed ? 'Yes' : 'No') : '',
        n + 1, i.name, i.variantId || 'Custom item', i.qty, i.price, i.qty * i.price,
        unitsOf(o), subtotalOf(o), o.deliveryCharges, totalOf(o),
        stageReachedAt(o, 'confirmed'), stageReachedAt(o, 'unassigned'), stageReachedAt(o, 'assigned'), stageReachedAt(o, 'delivered'), stageReachedAt(o, 'cancelled'),
        last ? fmtDate(last.at) : '', last?.by || '', timeline,
      ]);
    });
    downloadCSV(`order-details-${new Date().toISOString().split('T')[0]}.csv`, [headers, ...rows]);
    toast.success(`Exported ${rows.length} product lines from ${filtered.length} orders`);
  };

  // Same figures as the Sales Analytics tables: delivered orders only, sales exclude delivery charges.
  const exportProductCSV = () => {
    const tags = cropTagsFor(catalogue);
    const cropsOf = new Map<string, string>();
    baseFiltered.forEach(o => o.items.forEach(i => cropsOf.set(i.variantId || i.name, tags(i).join('; '))));
    const rows = deliveredByProduct(baseFiltered).map(([key, r]) => [
      r.name, [...r.ids].join('; '), cropsOf.get(key) || '', r.orders.size, r.units, r.sales,
    ]);
    if (!rows.length) { toast.error('No delivered orders to export in this view'); return; }
    downloadCSV(`product-wise-delivered-sales-${new Date().toISOString().split('T')[0]}.csv`,
      [['Product', 'Product ID', 'Crops', 'Delivered Orders', 'Units', 'Delivered Sales (PKR)'], ...rows]);
    toast.success(`Exported ${rows.length} products`);
  };

  const exportCropCSV = () => {
    const rows = deliveredByCrop(baseFiltered, catalogue).map(([, r]) => [
      r.name, r.orders.size, r.units, r.sales, r.products.size, [...r.products].join('; '),
    ]);
    if (!rows.length) { toast.error('No delivered orders to export in this view'); return; }
    downloadCSV(`crop-wise-delivered-sales-${new Date().toISOString().split('T')[0]}.csv`,
      [['Crop', 'Delivered Orders', 'Units', 'Delivered Sales (PKR)', 'Products Sold', 'Product Names'], ...rows]);
    toast.success(`Exported ${rows.length} crops`);
  };

  const saveNewOrder = (draft: OrderDraft) => {
    const nextNum = Math.max(1000, ...orders.map(o => parseInt(o.id.replace(/\D/g, ''), 10) || 0)) + 1;
    const now = new Date().toISOString();
    persist([{
      ...draft, id: `ORD-${nextNum}`, source: 'Manual', createdAt: now, stage: 'pending',
      timeline: [event('Order created manually', undefined, now)],
    }, ...orders]);
    toast.success(`Order ORD-${nextNum} created`);
    setDialog(null);
  };

  const saveEdit = (id: string, draft: OrderDraft, reason: string) => {
    applyTo([id], o => {
      const before = totalOf(o);
      const after = totalOf(draft);
      const change = before === after ? `Total unchanged at ${money(after)}` : `Total ${money(before)} → ${money(after)}`;
      return { ...o, ...draft, timeline: [...o.timeline, event('Order edited', `${reason}. ${change}`)] };
    });
    toast.success(`Order ${id} updated`);
    setDialog(null);
  };

  const dialogOrder = dialog && 'id' in dialog ? orders.find(o => o.id === dialog.id) : undefined;
  const dialogOrders = dialog && 'ids' in dialog ? orders.filter(o => dialog.ids.includes(o.id)) : [];
  const canEdit = (o: Order) => o.stage !== 'delivered' && o.stage !== 'cancelled';

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4 lg:space-y-6 p-3 lg:p-0">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <h2 className="text-xl lg:text-2xl font-bold text-gray-900 pl-2">Online Orders</h2>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-gray-700 bg-white border rounded-md px-3 h-9 cursor-pointer"
            title="When on, confirming an order runs the assignment rules. Orders they cannot place go to Unassigned.">
            <Zap className="size-4 text-[#C7359C]" /> Auto-assign on confirm
            <Switch checked={autoAssignOn} onCheckedChange={toggleAutoAssign} />
          </label>
          <Button variant="outline" onClick={resetSamples} className="gap-2" title="Replace all orders with fresh sample data">
            <RefreshCw className="size-4" /> <span className="hidden sm:inline">Reset Samples</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={filtered.length === 0} className="gap-2">
                <Download className="size-4" /> Export <ChevronDown className="size-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuItem onClick={exportCSV} className="flex-col items-start gap-0">
                <span className="font-medium">Order list</span>
                <span className="text-xs text-gray-500">One row per order</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportDetailedCSV} className="flex-col items-start gap-0">
                <span className="font-medium">Complete order details</span>
                <span className="text-xs text-gray-500">One row per product line, with every order, customer and franchise field and the timeline</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportProductCSV} className="flex-col items-start gap-0">
                <span className="font-medium">Product-wise delivered sales</span>
                <span className="text-xs text-gray-500">One row per product: delivered orders, units and sales</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportCropCSV} className="flex-col items-start gap-0">
                <span className="font-medium">Crop-wise delivered sales</span>
                <span className="text-xs text-gray-500">One row per crop: delivered orders, units and sales</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={() => setDialog({ type: 'add' })} className="gap-2 bg-[#C7359C] hover:bg-[#9b2b7a] text-white">
            <Plus className="size-4" /> Add Order
          </Button>
        </div>
      </div>

      {/* Franchise Filters — always visible */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <Select value={franchiseFilters.zoneFilter} onValueChange={franchiseFilters.setZoneFilter}>
          <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="All Zones" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Zones</SelectItem>
            {franchiseFilters.zones.map(z => <SelectItem key={z} value={z}>{z}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={franchiseFilters.regionFilter} onValueChange={franchiseFilters.setRegionFilter}>
          <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="All Regions" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Regions</SelectItem>
            {franchiseFilters.regions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={franchiseFilters.salesUnitFilter} onValueChange={franchiseFilters.setSalesUnitFilter}>
          <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="All Sales Units" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sales Units</SelectItem>
            {franchiseFilters.salesUnits.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={franchiseFilters.franchiseFilter} onValueChange={franchiseFilters.setFranchiseFilter}>
          <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="All Franchises" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Franchises</SelectItem>
            {franchiseFilters.franchises.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Date Filter Section — same pattern as the Sales Dashboard */}
      <div className="bg-white rounded-lg border border-gray-200 px-4 py-3">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className={`flex items-center gap-2 flex-wrap ${inProcessOnly ? 'opacity-50' : ''}`}
            title={inProcessOnly ? 'Date filters are ignored while showing all in-process orders' : undefined}>
            <Calendar className="size-4 text-[#C7359C] flex-shrink-0" />
            {DATE_FILTERS.map(([key, label]) => (
              <Button key={key} variant={dateFilter === key ? 'default' : 'outline'} size="sm"
                onClick={() => setDateFilter(key)} disabled={inProcessOnly}
                className={`h-8 px-3 text-xs ${dateFilter === key ? 'bg-[#C7359C] hover:bg-[#a02d7f]' : ''}`}>
                {label}
              </Button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer lg:border-l lg:pl-3"
            title="Shows every Pending, Confirmed, Unassigned and Assigned order, whatever its order date">
            <Checkbox checked={inProcessOnly} onCheckedChange={v => setInProcessOnly(!!v)} />
            All in-process orders
          </label>
          <div className="flex items-center gap-2 text-xs text-gray-600 lg:ml-auto">
            <span className="font-medium text-[#C7359C]">
              {inProcessOnly ? 'In process · any date' : DATE_FILTERS.find(d => d[0] === dateFilter)![2]}
            </span>
            <span className="text-gray-400">•</span>
            <span>{baseFiltered.length} orders</span>
          </div>
        </div>
        {dateFilter === 'custom' && !inProcessOnly && (
          <div className="flex flex-col sm:flex-row gap-2 mt-3 pt-3 border-t border-gray-200">
            <div className="flex-1">
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-8 text-xs" title="Start date" />
            </div>
            <div className="flex-1">
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-8 text-xs" title="End date" />
            </div>
          </div>
        )}
      </div>

      {/* View switch */}
      <div className="inline-flex rounded-lg bg-gray-100 p-1">
        {([['orders', 'Online Orders', List], ['analytics', 'Sales Analytics', BarChart3]] as const).map(([key, label, Icon]) => (
          <button key={key} onClick={() => setView(key)}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              view === key ? 'bg-white text-[#C7359C] shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
            <Icon className="size-4" /> {label}
          </button>
        ))}
      </div>

      {view === 'analytics' ? (
        <OrderAnalytics orders={baseFiltered} totalOrders={orders.length} hasFilters={hasFilters} catalogue={catalogue} />
      ) : (
      <>
      {/* Stage counters — double as stage filter */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <button onClick={() => setStageFilter('all')} className="text-left">
          <Card className={stageFilter === 'all' ? 'border-[#C7359C] ring-1 ring-[#C7359C]' : 'hover:border-gray-300'}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500">All Orders</p>
                <ClipboardList className="size-4 text-[#C7359C]" />
              </div>
              <p className="text-2xl font-bold">{baseFiltered.length}</p>
              <p className="text-xs text-gray-400">Every stage</p>
            </CardContent>
          </Card>
        </button>
        {(Object.keys(STAGE_META) as Stage[]).map(s => {
          const Icon = STAGE_META[s].icon;
          return (
            <button key={s} onClick={() => setStageFilter(s)} className="text-left">
              <Card className={stageFilter === s ? 'border-[#C7359C] ring-1 ring-[#C7359C]' : 'hover:border-gray-300'}>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500">{STAGE_META[s].label}</p>
                    <Icon className="size-4 text-gray-400" />
                  </div>
                  <p className="text-2xl font-bold">{counts[s]}</p>
                  <p className="text-xs text-gray-400">{STAGE_META[s].hint}</p>
                </CardContent>
              </Card>
            </button>
          );
        })}
      </div>

      <Card>
        <CardContent className="pt-5 space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
            <Input placeholder="Search order ID, customer, phone, city, franchise..." value={search}
              onChange={e => setSearch(e.target.value)} className="pl-10 h-9" />
          </div>

          {/* Bulk actions */}
          {selectedIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 bg-pink-50 border border-pink-200 rounded-lg px-3 py-2">
              <span className="text-sm font-semibold text-[#9b2b7a] mr-1">{selectedIds.length} selected</span>
              <Button size="sm" variant="outline" onClick={() => confirmOrders(selectedIds)}>Confirm</Button>
              <Button size="sm" variant="outline" onClick={() => autoAssignOrders(selectedIds)}>Auto-assign</Button>
              <Button size="sm" variant="outline" onClick={() => setDialog({ type: 'assign', ids: selectedIds })}>Assign manually</Button>
              <Button size="sm" variant="outline" onClick={() => deliverOrders(selectedIds)}>Mark Delivered</Button>
              <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => setDialog({ type: 'cancel', ids: selectedIds })}>Cancel Orders</Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear selection</Button>
            </div>
          )}

          {/* Orders table */}
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center py-14 text-center">
              <div className="bg-gray-100 p-5 rounded-full mb-3"><ClipboardList className="size-10 text-gray-400" /></div>
              <p className="text-gray-500">{orders.length === 0 ? 'Loading orders…' : 'No orders match these filters'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="py-2.5 px-3 w-8">
                      <Checkbox checked={allSelected}
                        onCheckedChange={v => setSelected(v ? new Set(filtered.map(o => o.id)) : new Set())} />
                    </th>
                    {['Order', 'Customer', 'Items', 'Total', 'Franchise', ...(stageFilter === 'assigned' ? ['Last Synced'] : []), 'Stage', ''].map(h => (
                      <th key={h} className="text-left py-2.5 px-3 font-semibold text-gray-700 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(o => (
                    <tr key={o.id} className="border-b last:border-0 hover:bg-gray-50 cursor-pointer group"
                      onClick={() => setDialog({ type: 'details', id: o.id })}>
                      <td className="py-2.5 px-3" onClick={e => e.stopPropagation()}><Checkbox checked={selected.has(o.id)} onCheckedChange={() => toggle(o.id)} /></td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <button className="font-semibold text-[#C7359C] hover:underline">{o.id}</button>
                        <p className="text-xs text-gray-400">{fmtDate(o.createdAt)}</p>
                        <p className="text-xs text-gray-400">{o.source}</p>
                      </td>
                      <td className="py-2.5 px-3">
                        <p className="font-medium whitespace-nowrap">{o.customerName}</p>
                        <p className="text-xs text-gray-500 whitespace-nowrap">{o.phone} · {o.city}</p>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span>{o.items.reduce((s, i) => s + i.qty, 0)} units</span>
                        {showsStock(o) && hasStockIssue(o) && (
                          <span className="ml-1.5 inline-flex items-center gap-1 text-xs text-amber-700" title="One or more items are short at the assigned franchise">
                            <AlertTriangle className="size-3.5" /> Stock
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-semibold whitespace-nowrap">{money(totalOf(o))}</td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {o.franchiseName ? (
                          <>
                            <p className="font-medium">{o.franchiseName}</p>
                            <p className="text-xs text-gray-400">{[o.zone, o.region].filter(Boolean).join(' / ')}</p>
                          </>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      {stageFilter === 'assigned' && (
                        <td className="py-2.5 px-3 text-sm">
                          {o.franchiseKey ? <LastSync franchiseKey={o.franchiseKey} /> : <span className="text-gray-300">—</span>}
                        </td>
                      )}
                      <td className="py-2.5 px-3">
                        <StageBadge stage={o.stage} />
                        {o.stage === 'cancelled' && <p className="text-xs text-red-600 mt-1 max-w-[180px] truncate" title={o.cancelReason}>{o.cancelReason}</p>}
                        {o.stage === 'unassigned' && <p className="text-xs text-orange-700 mt-1 max-w-[200px] truncate" title={o.unassignedReason}>{o.unassignedReason}</p>}
                      </td>
                      {/* stopPropagation: buttons and menu items here must not also open the details dialog */}
                      <td className="py-2.5 px-3 sticky right-0 bg-white group-hover:bg-gray-50" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {NEXT_ACTION[o.stage] && (
                            <Button size="sm" onClick={() => advance(o)} className="bg-[#C7359C] hover:bg-[#9b2b7a] text-white whitespace-nowrap">
                              {NEXT_ACTION[o.stage]}
                            </Button>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm"><MoreVertical className="size-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setDialog({ type: 'details', id: o.id })}>
                                <Eye className="size-4 mr-2" /> View details
                              </DropdownMenuItem>
                              {canEdit(o) && (
                                <DropdownMenuItem onClick={() => setDialog({ type: 'edit', id: o.id })}>
                                  <Edit className="size-4 mr-2" /> Edit order
                                </DropdownMenuItem>
                              )}
                              {o.stage === 'assigned' && (
                                <DropdownMenuItem onClick={() => setDialog({ type: 'assign', ids: [o.id] })}>
                                  <Building2 className="size-4 mr-2" /> Reassign franchise
                                </DropdownMenuItem>
                              )}
                              {o.stage === 'confirmed' && (
                                <DropdownMenuItem onClick={() => setDialog({ type: 'assign', ids: [o.id] })}>
                                  <Building2 className="size-4 mr-2" /> Assign manually
                                </DropdownMenuItem>
                              )}
                              {o.stage === 'unassigned' && (
                                <DropdownMenuItem onClick={() => autoAssignOrders([o.id])}>
                                  <Zap className="size-4 mr-2" /> Retry auto-assign
                                </DropdownMenuItem>
                              )}
                              {o.stage !== 'pending' && (
                                <DropdownMenuItem onClick={() => setDialog({ type: 'revert', ids: [o.id] })}>
                                  {o.stage === 'cancelled'
                                    ? <><RotateCcw className="size-4 mr-2" /> Restore order</>
                                    : <><Undo2 className="size-4 mr-2" /> Revert to {STAGE_META[FLOW[FLOW.indexOf(o.stage as ActiveStage) - 1]].label}</>}
                                </DropdownMenuItem>
                              )}
                              {canEdit(o) && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem className="text-red-600" onClick={() => setDialog({ type: 'cancel', ids: [o.id] })}>
                                    <XCircle className="size-4 mr-2" /> Cancel order
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-gray-500">Showing {filtered.length} of {orders.length} orders</p>
        </CardContent>
      </Card>
      </>
      )}

      {/* ── Details ── */}
      <Dialog open={dialog?.type === 'details' && !!dialogOrder} onOpenChange={v => !v && setDialog(null)}>
        <DialogContent className="w-[80vw] max-w-[80vw] sm:max-w-[80vw] max-h-[90vh] overflow-y-auto">
          {dialogOrder && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">{dialogOrder.id} <StageBadge stage={dialogOrder.stage} /></DialogTitle>
                <DialogDescription>{dialogOrder.source} order · {fmtDate(dialogOrder.createdAt)}</DialogDescription>
              </DialogHeader>

              {/* Single wrapper: the dialog is a height-capped grid, which squashes direct children that clip overflow */}
              <div className="space-y-4">
              {/* Flow */}
              {dialogOrder.stage === 'cancelled' ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
                  <p className="font-semibold">Cancelled from {STAGE_META[dialogOrder.cancelledFrom ?? 'pending'].label}</p>
                  <p>{dialogOrder.cancelReason}</p>
                </div>
              ) : (
                <div className="flex items-center">
                  {FLOW.map((s, i) => {
                    const current = FLOW.indexOf(dialogOrder.stage as ActiveStage);
                    const done = i <= current;
                    return (
                      <div key={s} className="flex items-center flex-1 last:flex-none">
                        <div className="flex flex-col items-center">
                          <div className={`size-7 rounded-full flex items-center justify-center text-xs font-bold ${done ? 'bg-[#C7359C] text-white' : 'bg-gray-200 text-gray-500'}`}>{i + 1}</div>
                          <span className={`text-xs mt-1 ${i === current ? 'font-semibold text-[#C7359C]' : 'text-gray-500'}`}>{STAGE_META[s].label}</span>
                        </div>
                        {i < FLOW.length - 1 && <div className={`h-0.5 flex-1 mx-1 mb-5 ${i < current ? 'bg-[#C7359C]' : 'bg-gray-200'}`} />}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Customer</p>
                  <p className="font-medium">{dialogOrder.customerName}</p>
                  <p className="text-gray-600">{dialogOrder.phone}</p>
                  <p className="text-gray-600">{dialogOrder.address}, {dialogOrder.city}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Fulfilment</p>
                  <p>Payment: <span className="font-medium">{dialogOrder.paymentMethod}</span></p>
                  <p className="flex items-center gap-2">Franchise:
                    {dialogOrder.franchiseName ? <span className="font-medium">{dialogOrder.franchiseName}</span>
                      : <span className="text-gray-400">Not yet assigned</span>}
                  </p>
                  {dialogOrder.assignedBy && (
                    <p>Assigned by: <span className="font-medium">{dialogOrder.assignedBy === 'auto' ? 'Auto-assignment rules' : 'Admin (manual)'}</span></p>
                  )}
                  {dialogOrder.unassignedReason && (
                    <div className="mt-2 bg-orange-50 border border-orange-200 rounded-lg p-2 text-orange-800">
                      <p className="font-semibold text-xs uppercase tracking-wide">Why it is unassigned</p>
                      <p>{dialogOrder.unassignedReason}</p>
                    </div>
                  )}
                  {dialogOrder.franchiseName && (
                    <p className="text-gray-600">{[dialogOrder.zone, dialogOrder.region, dialogOrder.salesUnit].filter(Boolean).join(' / ')}</p>
                  )}
                  {dialogOrder.stage === 'assigned' && dialogOrder.franchiseKey && (
                    <p className="flex items-center gap-2">Last synced: <LastSync franchiseKey={dialogOrder.franchiseKey} /></p>
                  )}
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>{['Item', ...(showsStock(dialogOrder) ? [`Stock at ${dialogOrder.franchiseName}`] : []), 'Qty', 'Price', 'Amount'].map(h => <th key={h} className="text-left py-2 px-3 font-semibold text-gray-600">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y">
                    {dialogOrder.items.map((i, n) => {
                      const st = stockStatus(i);
                      return (
                        <tr key={n}>
                          <td className="py-2 px-3">{i.name}</td>
                          {showsStock(dialogOrder) && <td className={`py-2 px-3 text-xs ${toneClass[st.tone]}`}>{st.label}</td>}
                          <td className="py-2 px-3">{i.qty}</td>
                          <td className="py-2 px-3">{money(i.price)}</td>
                          <td className="py-2 px-3 font-medium">{money(i.qty * i.price)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="bg-gray-50 px-3 py-2 text-sm space-y-0.5 border-t">
                  <div className="flex justify-between"><span>Subtotal</span><span>{money(subtotalOf(dialogOrder))}</span></div>
                  <div className="flex justify-between"><span>Delivery charges</span><span>{money(dialogOrder.deliveryCharges)}</span></div>
                  <div className="flex justify-between font-bold"><span>Total</span><span>{money(totalOf(dialogOrder))}</span></div>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Order Timeline</p>
                <ol className="space-y-3 border-l-2 border-pink-200 ml-2 pl-4">
                  {[...dialogOrder.timeline].reverse().map((t, n) => (
                    <li key={n} className="relative text-sm">
                      <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full bg-[#C7359C]" />
                      <p className="font-medium">{t.action}</p>
                      {t.note && <p className="text-gray-600">{t.note}</p>}
                      <p className="text-xs text-gray-400">{fmtDate(t.at)} · {t.by}</p>
                    </li>
                  ))}
                </ol>
              </div>
              </div>

              <DialogFooter className="gap-2">
                {canEdit(dialogOrder) && (
                  <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50"
                    onClick={() => setDialog({ type: 'cancel', ids: [dialogOrder.id] })}>Cancel Order</Button>
                )}
                {dialogOrder.stage !== 'pending' && (
                  <Button variant="outline" onClick={() => setDialog({ type: 'revert', ids: [dialogOrder.id] })}>
                    {dialogOrder.stage === 'cancelled' ? 'Restore Order' : 'Revert Stage'}
                  </Button>
                )}
                {canEdit(dialogOrder) && <Button variant="outline" onClick={() => setDialog({ type: 'edit', id: dialogOrder.id })}>Edit Order</Button>}
                {NEXT_ACTION[dialogOrder.stage] && (
                  <Button className="bg-[#C7359C] hover:bg-[#9b2b7a] text-white" onClick={() => advance(dialogOrder)}>
                    {NEXT_ACTION[dialogOrder.stage]}
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Add / Edit ── */}
      <Dialog open={dialog?.type === 'add' || (dialog?.type === 'edit' && !!dialogOrder)} onOpenChange={v => !v && setDialog(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {dialog?.type === 'add' && (
            <OrderForm catalogue={catalogue} stockStatus={stockStatus} onCancel={() => setDialog(null)} onSave={saveNewOrder} />
          )}
          {dialog?.type === 'edit' && dialogOrder && (
            <OrderForm key={dialogOrder.id} order={dialogOrder} catalogue={catalogue} stockStatus={stockStatus}
              onCancel={() => setDialog(null)} onSave={(draft, reason) => saveEdit(dialogOrder.id, draft, reason)} />
          )}
        </DialogContent>
      </Dialog>

      {/* ── Assign ── */}
      <Dialog open={dialog?.type === 'assign'} onOpenChange={v => !v && setDialog(null)}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          {dialog?.type === 'assign' && (
            <AssignForm orders={dialogOrders} franchises={franchises}
              onCancel={() => setDialog(null)}
              onAssign={f => { assignOrders(dialog.ids, f); setSelected(new Set()); setDialog(null); }} />
          )}
        </DialogContent>
      </Dialog>

      {/* ── Cancel / Revert ── */}
      <Dialog open={dialog?.type === 'cancel' || dialog?.type === 'revert'} onOpenChange={v => !v && setDialog(null)}>
        <DialogContent>
          {(dialog?.type === 'cancel' || dialog?.type === 'revert') && (
            <ReasonForm
              key={dialog.type}
              title={dialog.type === 'cancel'
                ? `Cancel ${dialog.ids.length === 1 ? `order ${dialog.ids[0]}` : `${dialog.ids.length} orders`}`
                : dialogOrders[0]?.stage === 'cancelled' ? `Restore order ${dialog.ids[0]}` : `Revert order ${dialog.ids[0]}`}
              description={dialog.type === 'cancel'
                ? 'Cancelled orders move to the Cancelled state. Delivered orders are skipped.'
                : dialogOrders[0]?.stage === 'cancelled'
                  ? `The order returns to ${STAGE_META[dialogOrders[0].cancelledFrom ?? 'pending'].label}, the stage it was cancelled from.`
                  : dialogOrders[0]?.stage === 'assigned'
                    ? 'The order moves to Unassigned and the franchise assignment is removed. Your reason is shown on the order.'
                    : dialogOrders[0]?.stage === 'unassigned'
                      ? 'The order returns to Confirmed, where it waits for auto-assignment.'
                      : 'The order moves back one stage.'}
              reasons={dialog.type === 'cancel' ? CANCEL_REASONS : REVERT_REASONS}
              confirmLabel={dialog.type === 'cancel' ? 'Cancel Order' : 'Confirm'}
              destructive={dialog.type === 'cancel'}
              onClose={() => setDialog(null)}
              onConfirm={reason => {
                dialog.type === 'cancel' ? cancelOrders(dialog.ids, reason) : revertOrders(dialog.ids, reason);
                setSelected(new Set());
                setDialog(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Sales analytics ──────────────────────────────────────────────────────────

const NO_CROP = 'No crop tagged';

// Delivered sales grouped by a key per product line. An order counts once per group however many lines it has.
type SalesRow = { name: string; orders: Set<string>; units: number; sales: number; ids: Set<string>; products: Set<string> };
function groupDelivered(orders: Order[], keysFor: (i: OrderItem) => { key: string; name: string }[]): [string, SalesRow][] {
  const map = new Map<string, SalesRow>();
  orders.filter(o => o.stage === 'delivered').forEach(o => o.items.forEach(i => keysFor(i).forEach(({ key, name }) => {
    const row = map.get(key) ?? { name, orders: new Set<string>(), units: 0, sales: 0, ids: new Set<string>(), products: new Set<string>() };
    row.orders.add(o.id);
    row.units += i.qty;
    row.sales += i.qty * i.price;
    row.ids.add(i.variantId || 'Custom item');
    row.products.add(i.name);
    map.set(key, row);
  })));
  return Array.from(map.entries()).sort((a, b) => b[1].sales - a[1].sales);
}

const cropTagsFor = (catalogue: CatalogueItem[]) => {
  const byVariant = new Map(catalogue.map(c => [c.variantId, c.crops ?? []]));
  return (i: OrderItem) => (i.variantId && byVariant.get(i.variantId)) || [];
};

const deliveredByProduct = (orders: Order[]) => groupDelivered(orders, i => [{ key: i.variantId || i.name, name: i.name }]);

// Crops come from the product's crop tags in the Products module; a product tagged with several crops counts under each.
function deliveredByCrop(orders: Order[], catalogue: CatalogueItem[]) {
  const tags = cropTagsFor(catalogue);
  return groupDelivered(orders, i => {
    const t = tags(i);
    return t.length ? t.map(c => ({ key: c.toLowerCase(), name: c })) : [{ key: NO_CROP, name: NO_CROP }];
  });
}

function OrderAnalytics({ orders, totalOrders, hasFilters, catalogue }: {
  orders: Order[]; totalOrders: number; hasFilters: boolean; catalogue: CatalogueItem[];
}) {
  const sum = (list: Order[]) => ({ orders: list.length, total: list.reduce((s, o) => s + totalOf(o), 0) });
  const all = sum(orders);
  const delivered = orders.filter(o => o.stage === 'delivered');
  const deliveredSum = sum(delivered);
  const open = sum(orders.filter(o => ['pending', 'confirmed', 'unassigned', 'assigned'].includes(o.stage)));
  const cancelled = sum(orders.filter(o => o.stage === 'cancelled'));
  const pct = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : '0%');

  const products = deliveredByProduct(orders);
  const crops = deliveredByCrop(orders, catalogue);
  const tags = cropTagsFor(catalogue);
  const multiCrop = delivered.some(o => o.items.some(i => tags(i).length > 1));
  const untagged = crops.find(([k]) => k === NO_CROP);

  const tiles = [
    { label: 'Total order value', value: money(all.total), count: all.orders, sub: 'All stages' },
    { label: 'Delivered sales', value: money(deliveredSum.total), count: deliveredSum.orders, sub: `${pct(deliveredSum.orders, all.orders)} of orders` },
    { label: 'Open pipeline', value: money(open.total), count: open.orders, sub: 'Not yet delivered' },
    { label: 'Cancelled value', value: money(cancelled.total), count: cancelled.orders, sub: `${pct(cancelled.orders, all.orders)} of orders` },
  ];
  const th = 'py-2.5 px-3 font-semibold text-gray-700 whitespace-nowrap';
  const num = 'py-2.5 px-3 text-right whitespace-nowrap tabular-nums';

  if (orders.length === 0) {
    return (
      <Card><CardContent className="py-14 text-center text-gray-500">
        No orders match the current filters.
      </CardContent></Card>
    );
  }

  const DeliveredTable = ({ title, firstColumn, note, rows }: {
    title: string; firstColumn: string; note: React.ReactNode; rows: [string, SalesRow][];
  }) => (
    <Card>
      <CardContent className="pt-5 space-y-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <p className="text-xs text-gray-500">{note}</p>
        </div>
        {rows.length === 0 ? (
          <p className="text-sm text-gray-500 border border-dashed rounded-lg p-6 text-center">No delivered orders in this view</p>
        ) : (
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className={`${th} text-left`}>{firstColumn}</th>
                  <th className={`${th} text-right`}>Delivered orders</th>
                  <th className={`${th} text-right`}>Units</th>
                  <th className={`${th} text-right`}>Delivered sales</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(([key, r]) => (
                  <tr key={key} className="border-b last:border-0">
                    <td className={`py-2.5 px-3 ${key === NO_CROP ? 'text-gray-500 italic' : ''}`}>{r.name}</td>
                    <td className={num}>{r.orders.size}</td>
                    <td className={num}>{r.units}</td>
                    <td className={`${num} font-semibold`}>{money(r.sales)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4 lg:space-y-6">
      <p className="text-xs text-gray-500">
        Based on {orders.length} of {totalOrders} orders{hasFilters ? ' matching the current filters' : ''}. Values include delivery charges unless stated.
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {tiles.map(t => (
          <Card key={t.label}>
            <CardContent className="pt-4 pb-3">
              <p className="text-sm lg:text-base font-semibold text-gray-700">{t.label}</p>
              <p className="text-xl lg:text-2xl font-bold text-gray-900">{t.value}</p>
              <div className="mt-2 pt-2 border-t flex items-baseline justify-between gap-2">
                <p className="text-xl lg:text-2xl font-bold text-gray-900 tabular-nums">
                  {t.count} <span className="text-sm font-medium text-gray-600">{t.count === 1 ? 'order' : 'orders'}</span>
                </p>
                <p className="text-xs text-gray-400 text-right">{t.sub}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-6">
        <DeliveredTable
          title="Product-wise delivered sales"
          firstColumn="Product"
          rows={products}
          note="Delivered orders only. Sales exclude delivery charges."
        />
        <DeliveredTable
          title="Crop-wise delivered sales"
          firstColumn="Crop"
          rows={crops}
          note={<>
            Delivered orders only, by the crops tagged on each product in the Products module. Sales exclude delivery charges.
            {multiCrop && ' Products tagged with several crops count under each, so crop totals can add up to more than total sales.'}
            {untagged && ` ${money(untagged[1].sales)} is from products with no crop tagged yet.`}
          </>}
        />
      </div>
    </div>
  );
}

// ── Reason dialog body ───────────────────────────────────────────────────────

function ReasonForm({ title, description, reasons, confirmLabel, destructive, onClose, onConfirm }: {
  title: string; description: string; reasons: string[]; confirmLabel: string; destructive?: boolean;
  onClose: () => void; onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <ReasonFields reasons={reasons} reason={reason} note={note} onReason={setReason} onNote={setNote} />
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Back</Button>
        <Button variant={destructive ? 'destructive' : 'default'} disabled={!reasonValid(reason, note)}
          className={destructive ? '' : 'bg-[#C7359C] hover:bg-[#9b2b7a] text-white'}
          onClick={() => onConfirm(reasonText(reason, note))}>{confirmLabel}</Button>
      </DialogFooter>
    </>
  );
}

// ── Assign dialog body ───────────────────────────────────────────────────────

function AssignForm({ orders, franchises, onCancel, onAssign }: {
  orders: Order[]; franchises: FranchiseOption[];
  onCancel: () => void; onAssign: (f: FranchiseOption) => void;
}) {
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<FranchiseOption | null>(null);
  const [stockConfirmed, setStockConfirmed] = useState(false);

  const eligible = orders.filter(o => o.stage === 'confirmed' || o.stage === 'unassigned' || (orders.length === 1 && o.stage === 'assigned'));
  const matches = franchises.filter(f =>
    [f.name, f.zone, f.region, f.salesUnit].some(v => v.toLowerCase().includes(query.toLowerCase())));

  return (
    <>
      <DialogHeader>
        <DialogTitle>Assign {orders.length === 1 ? `order ${orders[0].id}` : `${orders.length} orders`} to a franchise</DialogTitle>
        <DialogDescription>
          {eligible.length === orders.length
            ? 'Choose the franchise that will fulfil this delivery.'
            : `${eligible.length} of ${orders.length} selected orders are Confirmed or Unassigned and can be assigned. The rest are skipped.`}
        </DialogDescription>
      </DialogHeader>

      {franchises.length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
          No active franchises found. Add franchises in the Franchises module (manually or by bulk upload) before assigning orders.
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
            <Input placeholder="Search franchise, zone, region, sales unit..." value={query} onChange={e => setQuery(e.target.value)} className="pl-10" />
          </div>
          <div className="border rounded-lg max-h-56 overflow-y-auto divide-y">
            {matches.slice(0, 50).map(f => (
              <button key={f.key} onClick={() => setPicked(f)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-pink-50 ${picked?.key === f.key ? 'bg-pink-50 border-l-4 border-[#C7359C]' : ''}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{f.name}</p>
                  <span className="text-xs"><LastSync franchiseKey={f.key} /></span>
                </div>
                <p className="text-xs text-gray-500">{[f.zone, f.region, f.salesUnit].filter(Boolean).join(' / ')}</p>
              </button>
            ))}
            {matches.length === 0 && <p className="px-3 py-4 text-sm text-gray-500 text-center">No franchise matches</p>}
            {matches.length > 50 && <p className="px-3 py-2 text-xs text-gray-400 text-center">Showing first 50 — refine your search</p>}
          </div>

          {/* Stock is only known per franchise, so it is shown on the order after assignment */}
          <div className="border rounded-lg p-3 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Stock check</p>
            <p className="text-sm text-gray-600">Stock at the chosen franchise is shown on the order once it is assigned.</p>
            <label className="flex items-start gap-2 text-sm cursor-pointer pt-1">
              <Checkbox checked={stockConfirmed} onCheckedChange={v => setStockConfirmed(!!v)} className="mt-0.5" />
              <span>I have confirmed with the franchise that the ordered items are available</span>
            </label>
          </div>
        </div>
      )}

      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Back</Button>
        <Button disabled={!picked || !stockConfirmed || eligible.length === 0}
          className="bg-[#C7359C] hover:bg-[#9b2b7a] text-white" onClick={() => picked && onAssign(picked)}>
          Assign{picked ? ` to ${picked.name}` : ''}
        </Button>
      </DialogFooter>
    </>
  );
}

// ── Add / Edit form ──────────────────────────────────────────────────────────

type OrderDraft = Pick<Order, 'customerName' | 'phone' | 'address' | 'city' | 'paymentMethod' | 'items' | 'deliveryCharges'>;

function OrderForm({ order, catalogue, stockStatus, onCancel, onSave }: {
  order?: Order; catalogue: CatalogueItem[];
  stockStatus: (i: OrderItem) => { label: string; tone: 'ok' | 'warn' | 'bad' | 'none' };
  onCancel: () => void; onSave: (draft: OrderDraft, reason: string) => void;
}) {
  const [draft, setDraft] = useState<OrderDraft>(() => order
    ? { customerName: order.customerName, phone: order.phone, address: order.address, city: order.city,
        paymentMethod: order.paymentMethod, items: order.items.map(i => ({ ...i })), deliveryCharges: order.deliveryCharges }
    : { customerName: '', phone: '', address: '', city: '', paymentMethod: 'COD', items: [], deliveryCharges: 250 });
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [pickerKey, setPickerKey] = useState(0);

  const set = <K extends keyof OrderDraft>(k: K, v: OrderDraft[K]) => setDraft(d => ({ ...d, [k]: v }));
  const setItem = (n: number, patch: Partial<OrderItem>) =>
    set('items', draft.items.map((i, idx) => idx === n ? { ...i, ...patch } : i));
  const num = (v: string) => Math.max(0, Number(v) || 0);
  const toneClass = { ok: 'text-green-700', warn: 'text-amber-700', bad: 'text-red-700', none: 'text-gray-400' };

  const addFromCatalogue = (variantId: string) => {
    const p = catalogue.find(c => c.variantId === variantId);
    if (!p) return;
    const existing = draft.items.findIndex(i => i.variantId === variantId);
    if (existing >= 0) setItem(existing, { qty: draft.items[existing].qty + 1 });
    else set('items', [...draft.items, { variantId, name: p.name, price: p.price, qty: 1 }]);
    setPickerKey(k => k + 1); // reset the picker so the same product can be chosen again
  };

  const errors: string[] = [];
  if (!draft.customerName.trim()) errors.push('customer name');
  if (!draft.phone.trim()) errors.push('phone');
  if (!draft.address.trim()) errors.push('address');
  if (!draft.city.trim()) errors.push('city');
  if (draft.items.length === 0) errors.push('at least one item');
  if (draft.items.some(i => !i.name.trim() || i.qty < 1)) errors.push('a name and quantity for every item');
  if (order && !reasonValid(reason, note)) errors.push('a reason for the edit');

  return (
    <>
      <DialogHeader>
        <DialogTitle>{order ? `Edit order ${order.id}` : 'Add New Order'}</DialogTitle>
        <DialogDescription>
          {order ? 'Change items, quantities, prices or delivery charges. The order total updates automatically.'
            : 'Manually created orders start in Pending.'}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-5">
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Customer</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-xs">Customer Name *</Label>
              <Input value={draft.customerName} onChange={e => set('customerName', e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs">Phone *</Label>
              <Input value={draft.phone} onChange={e => set('phone', e.target.value)} placeholder="03xx-xxxxxxx" /></div>
            <div className="space-y-1"><Label className="text-xs">Delivery Address *</Label>
              <Input value={draft.address} onChange={e => set('address', e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs">City *</Label>
              <Input value={draft.city} onChange={e => set('city', e.target.value)} /></div>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Items</p>
          <div className="flex flex-col sm:flex-row gap-2 mb-3">
            <div className="flex-1">
              <Select key={pickerKey} onValueChange={addFromCatalogue} disabled={catalogue.length === 0}>
                <SelectTrigger><SelectValue placeholder={catalogue.length ? 'Add a product from the catalogue' : 'Catalogue unavailable'} /></SelectTrigger>
                <SelectContent>
                  {catalogue.map(c => (
                    <SelectItem key={c.variantId} value={c.variantId}>{c.name} — {money(c.price)}{order && showsStock(order) ? ` (${c.stock} in stock)` : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={() => set('items', [...draft.items, { variantId: '', name: '', price: 0, qty: 1 }])} className="gap-2">
              <Plus className="size-4" /> Custom item
            </Button>
          </div>

          {draft.items.length === 0 ? (
            <p className="text-sm text-gray-500 border border-dashed rounded-lg p-4 text-center">No items yet</p>
          ) : (
            <div className="space-y-2">
              {draft.items.map((i, n) => {
                const st = stockStatus(i);
                return (
                  <div key={n} className="grid grid-cols-12 gap-2 items-start border rounded-lg p-2">
                    <div className="col-span-12 sm:col-span-5">
                      <Input value={i.name} onChange={e => setItem(n, { name: e.target.value })} placeholder="Item name" readOnly={!!i.variantId} />
                      {order && showsStock(order) && <p className={`text-xs mt-1 ${toneClass[st.tone]}`}>{st.label}</p>}
                    </div>
                    <div className="col-span-3 sm:col-span-2">
                      <Input type="number" min={1} value={i.qty} onChange={e => setItem(n, { qty: num(e.target.value) })} title="Quantity" />
                    </div>
                    <div className="col-span-4 sm:col-span-2">
                      <Input type="number" min={0} value={i.price} onChange={e => setItem(n, { price: num(e.target.value) })} title="Unit price (PKR)" />
                    </div>
                    <div className="col-span-3 sm:col-span-2 text-sm font-medium pt-2 text-right">{money(i.qty * i.price)}</div>
                    <div className="col-span-2 sm:col-span-1 flex justify-end">
                      <Button variant="ghost" size="sm" className="text-red-600" onClick={() => set('items', draft.items.filter((_, idx) => idx !== n))} title="Remove item">
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Delivery Charges (PKR)</Label>
            <Input type="number" min={0} value={draft.deliveryCharges} onChange={e => set('deliveryCharges', num(e.target.value))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Payment Method</Label>
            <Input value="Cash on Delivery (COD)" readOnly disabled />
          </div>
        </div>

        <div className="bg-gray-50 border rounded-lg px-3 py-2 text-sm space-y-0.5">
          <div className="flex justify-between"><span>Subtotal</span><span>{money(subtotalOf(draft))}</span></div>
          <div className="flex justify-between"><span>Delivery charges</span><span>{money(draft.deliveryCharges)}</span></div>
          <div className="flex justify-between font-bold"><span>Total</span><span>{money(totalOf(draft))}</span></div>
          {order && totalOf(order) !== totalOf(draft) && (
            <p className="text-xs text-gray-500 pt-1">Previous total {money(totalOf(order))}</p>
          )}
        </div>

        {order && <ReasonFields reasons={EDIT_REASONS} reason={reason} note={note} onReason={setReason} onNote={setNote} />}
      </div>

      <DialogFooter className="flex-col sm:flex-row sm:items-center gap-2">
        {errors.length > 0 && <p className="text-xs text-gray-500 sm:mr-auto">Still needed: {errors.join(', ')}</p>}
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button disabled={errors.length > 0} className="bg-[#C7359C] hover:bg-[#9b2b7a] text-white"
          onClick={() => onSave(draft, order ? reasonText(reason, note) : '')}>
          {order ? 'Save Changes' : 'Create Order'}
        </Button>
      </DialogFooter>
    </>
  );
}
