// Prototype loyalty data layer (BRD v2.1, Section 16).
// Everything here is sample data kept in localStorage so the admin screens can be clicked through.
// In production all of this lives in the Dukan Loyalty Engine and every change fires the Cropwise webhook.

export const PRIMARY = '#C7359C';

// ── Safe storage ─────────────────────────────────────────────────────────────
function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable: keep in memory only */ }
}

// Deterministic pseudo-random so sample data is stable between reloads.
function seeded(seed: number) {
  let s = seed;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

// ── Product catalogue (SKU) ──────────────────────────────────────────────────
export interface CatalogueProduct { sku: string; name: string; category: string; price: number }

export const PRODUCT_CATALOGUE: CatalogueProduct[] = [
  { sku: 'AGI-1001', name: 'Amistar Top 325SC 500ml', category: 'Fungicide', price: 3850 },
  { sku: 'AGI-1002', name: 'Score 250EC 250ml', category: 'Fungicide', price: 1650 },
  { sku: 'AGI-1003', name: 'Ridomil Gold 1kg', category: 'Fungicide', price: 4200 },
  { sku: 'AGI-2001', name: 'Virtako 40WG 60g', category: 'Insecticide', price: 2100 },
  { sku: 'AGI-2002', name: 'Proclaim 1.9EC 200ml', category: 'Insecticide', price: 1450 },
  { sku: 'AGI-2003', name: 'Karate 2.5EC 500ml', category: 'Insecticide', price: 1250 },
  { sku: 'AGI-2004', name: 'Actara 25WG 24g', category: 'Insecticide', price: 980 },
  { sku: 'AGI-3001', name: 'Axial 100EC 1L', category: 'Herbicide', price: 5400 },
  { sku: 'AGI-3002', name: 'Topik 15WP 100g', category: 'Herbicide', price: 1150 },
  { sku: 'AGI-4001', name: 'Isabion 1L', category: 'Biostimulant', price: 3300 },
  { sku: 'AGI-4002', name: 'Quantis 1L', category: 'Biostimulant', price: 2900 },
  { sku: 'AGI-5001', name: 'Cruiser 350FS 500ml', category: 'Seed Care', price: 6100 },
];

// ── Active program (written by Settings → Loyalty Program) ───────────────────
export interface ProductPointsRule {
  id: string;
  sku: string;
  productName: string;
  eligible: boolean;
  pointsPerUnit: number;
}

export interface ActiveProgram {
  enabled: boolean;
  name: string;
  standardPointsPerRs: number;
  minPurchaseForPoints: number;
  pointsValidityDays: number;
  redemptionRate: number; // Rs per point
  unlistedProducts: 'standard' | 'none';
  rules: ProductPointsRule[];
}

export const DEFAULT_PRODUCT_RULES: ProductPointsRule[] = [
  { id: 'r1', sku: 'AGI-1001', productName: 'Amistar Top 325SC 500ml', eligible: true, pointsPerUnit: 40 },
  { id: 'r2', sku: 'AGI-2001', productName: 'Virtako 40WG 60g', eligible: true, pointsPerUnit: 20 },
  { id: 'r3', sku: 'AGI-4001', productName: 'Isabion 1L', eligible: true, pointsPerUnit: 30 },
  { id: 'r4', sku: 'AGI-3002', productName: 'Topik 15WP 100g', eligible: true, pointsPerUnit: 10 },
  { id: 'r5', sku: 'AGI-2004', productName: 'Actara 25WG 24g', eligible: false, pointsPerUnit: 0 },
];

export function getActiveProgram(): ActiveProgram {
  const s = load<Record<string, any>>('loyaltySettings', {});
  const rules = load<ProductPointsRule[]>('loyaltyProductOverrides', DEFAULT_PRODUCT_RULES)
    .map(r => ({ eligible: true, sku: '', ...r }));
  return {
    enabled: s.enabled ?? true,
    name: s.programName ?? 'Rabi Loyalty Program 2026',
    standardPointsPerRs: s.standardPointsPerRs ?? 0.01,
    minPurchaseForPoints: s.minPurchaseForPoints ?? 100,
    pointsValidityDays: s.pointsValidityDays ?? 365,
    redemptionRate: s.redemptionRate ?? 1,
    unlistedProducts: s.unlistedProducts ?? 'standard',
    rules,
  };
}

export interface PointsLine { name: string; qty: number; amount: number; points: number; basis: string }

/** Points a basket earns under the active program: product rule first, otherwise the standard rate. */
export function pointsForItems(items: { name: string; qty: number; price: number; sku?: string }[]) {
  const p = getActiveProgram();
  const subtotal = items.reduce((s, i) => s + i.qty * i.price, 0);
  const lines: PointsLine[] = items.map(i => {
    const amount = i.qty * i.price;
    const rule = p.rules.find(r => (i.sku && r.sku === i.sku) || r.productName.toLowerCase() === i.name.toLowerCase());
    if (rule && !rule.eligible) return { name: i.name, qty: i.qty, amount, points: 0, basis: 'Not eligible' };
    if (rule) return { name: i.name, qty: i.qty, amount, points: Math.floor(rule.pointsPerUnit * i.qty), basis: `${rule.pointsPerUnit} pts / unit` };
    if (p.unlistedProducts === 'none') return { name: i.name, qty: i.qty, amount, points: 0, basis: 'Not in product list' };
    return { name: i.name, qty: i.qty, amount, points: Math.floor(amount * p.standardPointsPerRs), basis: `Standard ${p.standardPointsPerRs} pt / Rs` };
  });
  const total = subtotal < p.minPurchaseForPoints ? 0 : lines.reduce((s, l) => s + l.points, 0);
  return { total, lines, program: p, belowMinimum: subtotal < p.minPurchaseForPoints };
}

// ── Growers ──────────────────────────────────────────────────────────────────
export interface Grower {
  growerId: string; name: string; mobile: string;
  province: string; district: string; tehsil: string; village: string;
  lat: number; lng: number; joined: string;
}

export const GROWERS: Grower[] = [
  { growerId: 'CWG-100231', name: 'Ahmed Khan', mobile: '0300-1234567', province: 'Punjab', district: 'Multan', tehsil: 'Shujabad', village: 'Basti Malook', lat: 29.88, lng: 71.29, joined: '2026-08-02' },
  { growerId: 'CWG-100244', name: 'Fatima Malik', mobile: '0312-9876543', province: 'Punjab', district: 'Faisalabad', tehsil: 'Jaranwala', village: 'Chak 66 GB', lat: 31.33, lng: 73.42, joined: '2026-08-11' },
  { growerId: 'CWG-100259', name: 'Usman Ali', mobile: '0333-5551234', province: 'Sindh', district: 'Hyderabad', tehsil: 'Qasimabad', village: 'Tando Jam', lat: 25.42, lng: 68.53, joined: '2026-08-19' },
  { growerId: 'CWG-100263', name: 'Sara Qureshi', mobile: '0321-7778899', province: 'Punjab', district: 'Sahiwal', tehsil: 'Chichawatni', village: 'Chak 11/14L', lat: 30.53, lng: 72.69, joined: '2026-09-01' },
  { growerId: 'CWG-100270', name: 'Bilal Raza', mobile: '0345-4443322', province: 'Punjab', district: 'Okara', tehsil: 'Renala Khurd', village: 'Kot Mohabbat', lat: 30.88, lng: 73.6, joined: '2026-09-07' },
  { growerId: 'CWG-100288', name: 'Zainab Hassan', mobile: '0301-2223344', province: 'Khyber Pakhtunkhwa', district: 'Mardan', tehsil: 'Takht Bhai', village: 'Lund Khwar', lat: 34.28, lng: 71.95, joined: '2026-09-15' },
  { growerId: 'CWG-100295', name: 'Imran Sheikh', mobile: '0311-6667788', province: 'Sindh', district: 'Mirpur Khas', tehsil: 'Digri', village: 'Jhuddo', lat: 24.96, lng: 69.27, joined: '2026-09-28' },
  { growerId: 'CWG-100301', name: 'Hina Butt', mobile: '0322-9990011', province: 'Punjab', district: 'Vehari', tehsil: 'Burewala', village: 'Chak 130 EB', lat: 30.15, lng: 72.68, joined: '2026-10-05' },
  { growerId: 'CWG-100317', name: 'Kashif Mehmood', mobile: '0324-0000125', province: 'Punjab', district: 'Okara', tehsil: 'Depalpur', village: 'Haveli Lakha', lat: 30.67, lng: 73.65, joined: '2026-10-21' },
  { growerId: 'CWG-100322', name: 'Naveed Akram', mobile: '0347-1112233', province: 'Balochistan', district: 'Nasirabad', tehsil: 'Dera Murad Jamali', village: 'Manjhuti', lat: 28.55, lng: 68.22, joined: '2026-11-02' },
];

export const FRANCHISE_NAMES = ['Main Branch – Karachi', 'Lahore Branch', 'Islamabad Branch', 'Faisalabad Branch'];

export const normalizeMobile = (m: string) => m.replace(/\D/g, '').replace(/^92/, '0');
export const findGrower = (mobile: string) => GROWERS.find(g => normalizeMobile(g.mobile) === normalizeMobile(mobile));

// ── Ledger ───────────────────────────────────────────────────────────────────
export type LedgerType = 'EARN' | 'REDEEM' | 'ADJUST' | 'EXPIRE';

export interface LedgerEntry {
  id: string; at: string; type: LedgerType; channel: 'Online' | 'POS' | 'Admin';
  growerId: string; mobile: string; name: string;
  ref: string; franchise: string; product: string; sku: string; qty: number; unitPrice: number; cartValue: number;
  points: number; // signed
  by: string; lat: number; lng: number;
}

function buildSampleLedger(): LedgerEntry[] {
  const rnd = seeded(42);
  const now = Date.now();
  const out: LedgerEntry[] = [];
  for (let i = 0; i < 160; i++) {
    const g = GROWERS[Math.floor(rnd() * GROWERS.length)];
    const p = PRODUCT_CATALOGUE[Math.floor(rnd() * PRODUCT_CATALOGUE.length)];
    const qty = 1 + Math.floor(rnd() * 4);
    const online = rnd() < 0.45;
    // Every 12th entry is ~11 months old so some points are close to expiry (365-day validity).
    const ageDays = i % 12 === 0 ? 338 + Math.floor(rnd() * 20) : Math.floor(rnd() * 60);
    const at = new Date(now - ageDays * 86400000 - Math.floor(rnd() * 20) * 3600000).toISOString();
    const franchise = FRANCHISE_NAMES[Math.floor(rnd() * FRANCHISE_NAMES.length)];
    const base = { growerId: g.growerId, mobile: g.mobile, name: g.name, franchise, product: p.name, sku: p.sku, qty, unitPrice: p.price, cartValue: qty * p.price, lat: g.lat + (rnd() - 0.5) * 0.1, lng: g.lng + (rnd() - 0.5) * 0.1 };
    const r = rnd();
    if (r < 0.72) {
      out.push({ ...base, id: `L-${5000 + i}`, at, type: 'EARN', channel: online ? 'Online' : 'POS', ref: online ? `ORD-${81000 + i}` : `SL-${10000 + i}`, points: Math.max(5, Math.floor(qty * p.price * 0.01) + (p.sku === 'AGI-1001' ? qty * 30 : 0)), by: online ? 'System (order delivered)' : `${franchise} POS` });
    } else if (r < 0.92) {
      out.push({ ...base, id: `L-${5000 + i}`, at, type: 'REDEEM', channel: online ? 'Online' : 'POS', ref: online ? `ORD-${81000 + i}` : `RC-${400000 + i}`, points: -(50 + Math.floor(rnd() * 250)), by: online ? 'Checkout' : `${franchise} POS` });
    } else {
      out.push({ ...base, id: `L-${5000 + i}`, at, type: 'EXPIRE', channel: 'Admin', ref: 'Expiry job', product: '—', sku: '—', qty: 0, unitPrice: 0, cartValue: 0, points: -(20 + Math.floor(rnd() * 60)), by: 'System (expiry)' });
    }
  }
  return out;
}

const SAMPLE_LEDGER = buildSampleLedger();

export function getLedger(): LedgerEntry[] {
  const adjustments = getAdjustments().map<LedgerEntry>(a => {
    const g = findGrower(a.mobile);
    return {
      id: a.id, at: a.at, type: 'ADJUST', channel: 'Admin', growerId: a.growerId, mobile: a.mobile, name: a.name,
      ref: a.linkedRef || '—', franchise: '—', product: a.type, sku: '—', qty: 0, unitPrice: 0, cartValue: 0,
      points: a.direction === 'add' ? a.points : -a.points, by: a.enteredBy, lat: g?.lat ?? 0, lng: g?.lng ?? 0,
    };
  });
  const posRedemptions = getCodes().filter(c => c.status === 'Used' && c.usedAt).map<LedgerEntry>(c => {
    const g = findGrower(c.mobile);
    return {
      id: `RC-${c.code}`, at: c.usedAt!, type: 'REDEEM', channel: 'POS', growerId: g?.growerId ?? '—', mobile: c.mobile, name: g?.name ?? '—',
      ref: `Code ${c.code}`, franchise: c.usedAt_franchise ?? '—', product: 'Loyalty code redemption', sku: '—', qty: 0, unitPrice: 0, cartValue: 0,
      points: -c.points, by: `${c.usedAt_franchise ?? ''} POS`, lat: g?.lat ?? 0, lng: g?.lng ?? 0,
    };
  });
  return [...SAMPLE_LEDGER, ...adjustments, ...posRedemptions].sort((a, b) => b.at.localeCompare(a.at));
}

export function balanceOf(mobile: string) {
  const n = normalizeMobile(mobile);
  const rows = getLedger().filter(l => normalizeMobile(l.mobile) === n);
  const sum = (t: LedgerType) => rows.filter(r => r.type === t).reduce((s, r) => s + r.points, 0);
  const earned = sum('EARN');
  const redeemed = -sum('REDEEM');
  const expired = -sum('EXPIRE');
  const adjusted = sum('ADJUST');
  const validity = getActiveProgram().pointsValidityDays;
  const soon = Date.now() + 30 * 86400000;
  const expiringSoon = rows.filter(r => r.type === 'EARN' && new Date(r.at).getTime() + validity * 86400000 < soon).reduce((s, r) => s + r.points, 0);
  return { earned, redeemed, expired, adjusted, balance: earned - redeemed - expired + adjusted, expiringSoon: Math.min(expiringSoon, Math.max(0, earned - redeemed - expired + adjusted)), last: rows[0] };
}

// ── Point adjustments ────────────────────────────────────────────────────────
export type AdjustmentType = 'Return reversal' | 'Manual credit' | 'Manual debit' | 'Correction';
export type AdjustmentSource = 'Admin' | 'Franchise return';

// No approval step: every adjustment applies immediately and is logged.
export interface Adjustment {
  id: string; at: string; mobile: string; growerId: string; name: string;
  type: AdjustmentType; direction: 'add' | 'deduct'; points: number;
  linkedRef: string; note: string; source: AdjustmentSource;
  balanceBefore: number; balanceAfter: number; enteredBy: string;
}

const ADJ_KEY = 'loyaltyAdjustments_v2';
const SAMPLE_ADJUSTMENTS: Adjustment[] = [
  { id: 'ADJ-0004', at: new Date(Date.now() - 1 * 86400000).toISOString(), mobile: '0347-1112233', growerId: 'CWG-100322', name: 'Naveed Akram', type: 'Return reversal', direction: 'deduct', points: 900, linkedRef: 'RET-2026-118377', note: 'Cruiser 350FS returned at franchise', source: 'Franchise return', balanceBefore: 1150, balanceAfter: 250, enteredBy: 'Faisalabad Branch' },
  { id: 'ADJ-0003', at: new Date(Date.now() - 2 * 86400000).toISOString(), mobile: '0333-5551234', growerId: 'CWG-100259', name: 'Usman Ali', type: 'Manual credit', direction: 'add', points: 50, linkedRef: 'ORD-81022', note: 'Dispute: delivered order was not credited', source: 'Admin', balanceBefore: 410, balanceAfter: 460, enteredBy: 'Admin User' },
  { id: 'ADJ-0002', at: new Date(Date.now() - 4 * 86400000).toISOString(), mobile: '0321-7778899', growerId: 'CWG-100263', name: 'Sara Qureshi', type: 'Return reversal', direction: 'deduct', points: 40, linkedRef: 'RET-2026-118260', note: 'Amistar Top 1 unit returned', source: 'Franchise return', balanceBefore: 520, balanceAfter: 480, enteredBy: 'Lahore Branch' },
  { id: 'ADJ-0001', at: new Date(Date.now() - 5 * 86400000).toISOString(), mobile: '0312-9876543', growerId: 'CWG-100244', name: 'Fatima Malik', type: 'Correction', direction: 'deduct', points: 100, linkedRef: 'SL-10031', note: 'Dispute at POS: points credited twice', source: 'Admin', balanceBefore: 640, balanceAfter: 540, enteredBy: 'Admin User' },
];

export const getAdjustments = (): Adjustment[] => load(ADJ_KEY, SAMPLE_ADJUSTMENTS);
export const saveAdjustments = (list: Adjustment[]) => save(ADJ_KEY, list);

export function createAdjustment(input: Omit<Adjustment, 'id' | 'at' | 'balanceBefore' | 'balanceAfter'>) {
  const list = getAdjustments();
  const before = balanceOf(input.mobile).balance;
  const signed = input.direction === 'add' ? input.points : -input.points;
  const max = list.reduce((m, a) => Math.max(m, Number(a.id.replace(/\D/g, '')) || 0), 0);
  const adj: Adjustment = { ...input, id: `ADJ-${String(max + 1).padStart(4, '0')}`, at: new Date().toISOString(), balanceBefore: before, balanceAfter: before + signed };
  saveAdjustments([adj, ...list]);
  return adj;
}

export const hasReversalFor = (ref: string) => getAdjustments().some(a => a.type === 'Return reversal' && a.linkedRef === ref);

// ── Blacklist ────────────────────────────────────────────────────────────────
export type BlacklistScope = 'Earning & redemption' | 'Redemption only' | 'Earning only';
export interface BlacklistEntry { mobile: string; growerId: string; name: string; scope: BlacklistScope; reason: string; at: string; by: string; active: boolean; removedAt?: string; removedBy?: string }

const BL_KEY = 'loyaltyBlacklist_v1';
const SAMPLE_BLACKLIST: BlacklistEntry[] = [
  { mobile: '0324-0000125', growerId: 'CWG-100317', name: 'Kashif Mehmood', scope: 'Earning & redemption', reason: 'Franchise owner family number – redemption analysis', at: new Date(Date.now() - 9 * 86400000).toISOString(), by: 'Admin User', active: true },
];
export const getBlacklist = (): BlacklistEntry[] => load(BL_KEY, SAMPLE_BLACKLIST);
export const saveBlacklist = (l: BlacklistEntry[]) => save(BL_KEY, l);
export const blacklistFor = (mobile: string) => getBlacklist().find(b => b.active && normalizeMobile(b.mobile) === normalizeMobile(mobile));

// ── Fraud ────────────────────────────────────────────────────────────────────
export interface FraudRules {
  maxRedemptionsPerDay: number;
  highValueRedemption: number; // points
  repeatedReturns: number; // returns after earning within 30 days
  dashboardAlerts: boolean;
}
const RULES_KEY = 'loyaltyFraudRules_v2';
export const DEFAULT_FRAUD_RULES: FraudRules = { maxRedemptionsPerDay: 2, highValueRedemption: 1000, repeatedReturns: 2, dashboardAlerts: true };
export const getFraudRules = (): FraudRules => ({ ...DEFAULT_FRAUD_RULES, ...load<Partial<FraudRules>>(RULES_KEY, {}) });
export const saveFraudRules = (r: FraudRules) => save(RULES_KEY, r);

export type FraudStatus = 'Open' | 'Under review' | 'Closed';
export interface FraudCase { id: string; at: string; growerId: string; mobile: string; name: string; type: string; detail: string; score: number; franchise: string; status: FraudStatus }

const FRAUD_KEY = 'loyaltyFraudStatus_v1';
const SAMPLE_FRAUD: FraudCase[] = [
  { id: 'FR-0091', at: new Date(Date.now() - 1 * 86400000).toISOString(), growerId: 'CWG-100322', mobile: '0347-1112233', name: 'Naveed Akram', type: 'Repeated returns after earning', detail: '3 returns in 20 days after points were credited', score: 82, franchise: 'Faisalabad Branch', status: 'Open' },
  { id: 'FR-0090', at: new Date(Date.now() - 2 * 86400000).toISOString(), growerId: 'CWG-100317', mobile: '0324-0000125', name: 'Kashif Mehmood', type: 'Franchise-linked number', detail: 'Number registered to franchise owner family; 9 redemptions at the same franchise', score: 91, franchise: 'Lahore Branch', status: 'Closed' },
  { id: 'FR-0089', at: new Date(Date.now() - 3 * 86400000).toISOString(), growerId: 'CWG-100270', mobile: '0345-4443322', name: 'Bilal Raza', type: 'Redemptions per day above limit', detail: '4 redemptions on the same day (limit 2)', score: 64, franchise: 'Lahore Branch', status: 'Under review' },
  { id: 'FR-0088', at: new Date(Date.now() - 4 * 86400000).toISOString(), growerId: 'CWG-100288', mobile: '0301-2223344', name: 'Zainab Hassan', type: 'High-value redemption', detail: '1,450 points redeemed in one transaction (limit 1,000)', score: 55, franchise: 'Islamabad Branch', status: 'Open' },
  { id: 'FR-0087', at: new Date(Date.now() - 6 * 86400000).toISOString(), growerId: 'CWG-100295', mobile: '0311-6667788', name: 'Imran Sheikh', type: 'Franchise-linked number', detail: '6 numbers redeeming only at this franchise, registered on the same day', score: 71, franchise: 'Main Branch – Karachi', status: 'Open' },
];
export function getFraudCases(): FraudCase[] {
  const status = load<Record<string, FraudStatus>>(FRAUD_KEY, {});
  return SAMPLE_FRAUD.map(f => ({ ...f, status: status[f.id] ?? f.status }));
}
export function setFraudStatus(id: string, s: FraudStatus) {
  save(FRAUD_KEY, { ...load<Record<string, FraudStatus>>(FRAUD_KEY, {}), [id]: s });
}

// ── Redemption codes (generated by the grower in Cropwise, validated at the franchise) ──
export interface RedemptionCode { code: string; mobile: string; points: number; status: 'Active' | 'Used' | 'Expired'; expiresAt: string; usedAt?: string; usedAt_franchise?: string }
const CODE_KEY = 'loyaltyCodes_v1';
const SAMPLE_CODES: RedemptionCode[] = [
  { code: '482913', mobile: '0300-1234567', points: 300, status: 'Active', expiresAt: new Date(Date.now() + 86400000).toISOString() },
  { code: '730551', mobile: '0321-7778899', points: 150, status: 'Active', expiresAt: new Date(Date.now() + 86400000).toISOString() },
  { code: '111111', mobile: '0312-9876543', points: 200, status: 'Used', expiresAt: new Date(Date.now() + 86400000).toISOString(), usedAt: new Date(Date.now() - 3600000).toISOString(), usedAt_franchise: 'Lahore Branch' },
  { code: '909090', mobile: '0333-5551234', points: 120, status: 'Expired', expiresAt: new Date(Date.now() - 86400000).toISOString() },
  { code: '555123', mobile: '0324-0000125', points: 400, status: 'Active', expiresAt: new Date(Date.now() + 86400000).toISOString() },
];
export const getCodes = (): RedemptionCode[] => load(CODE_KEY, SAMPLE_CODES);

export type CodeCheck =
  | { ok: true; code: RedemptionCode; grower: Grower; balance: number }
  | { ok: false; reason: string };

export function checkCode(raw: string): CodeCheck {
  const code = getCodes().find(c => c.code === raw.trim());
  if (!code) return { ok: false, reason: 'Code not found. Ask the grower to generate a new code in Cropwise Grower.' };
  if (code.status === 'Used') return { ok: false, reason: `Already redeemed${code.usedAt_franchise ? ` at ${code.usedAt_franchise}` : ''}. A code can be used only once.` };
  if (code.status === 'Expired' || new Date(code.expiresAt).getTime() < Date.now()) return { ok: false, reason: 'Code expired. Ask the grower to generate a new code.' };
  const grower = findGrower(code.mobile);
  if (!grower) return { ok: false, reason: 'Grower not found.' };
  const bl = blacklistFor(code.mobile);
  if (bl && bl.scope !== 'Earning only') return { ok: false, reason: `This number is blacklisted (${bl.reason}). Redemption is blocked.` };
  return { ok: true, code, grower, balance: balanceOf(code.mobile).balance };
}

export function redeemCode(raw: string, franchise: string) {
  save(CODE_KEY, getCodes().map(c => c.code === raw.trim() ? { ...c, status: 'Used', usedAt: new Date().toISOString(), usedAt_franchise: franchise } : c));
}
