// Franchise settlement (reimbursement for loyalty points redeemed at franchises). Prototype sample data.
// Flow: redemptions are collected per franchise per period → statement Pending review → Finance approves
// (held lines excluded) → Finance marks it Paid with a payment reference.

export type SettlementStatus = 'Pending review' | 'Approved' | 'Paid';
export type PaymentMethod = 'Bank transfer' | 'Credit note';

export interface Statement {
  id: string; period: string; franchiseId: string; franchise: string; zone: string; region: string; district: string;
  redemptions: number; points: number; gross: number; held: number; payable: number;
  status: SettlementStatus; approvedBy?: string; approvedAt?: string; paidAt?: string; paymentRef?: string; method?: PaymentMethod;
}

export interface StatementLine { date: string; ref: string; channel: 'POS code' | 'Online order'; mobile: string; points: number; amount: number; check: string; held: boolean }

export const PERIODS = ['Nov 2026', 'Oct 2026', 'Sep 2026'];

const REGIONS: { zone: string; region: string; districts: string[] }[] = [
  { zone: 'North', region: 'Lahore', districts: ['Lahore', 'Kasur', 'Sheikhupura', 'Okara'] },
  { zone: 'North', region: 'Gujranwala', districts: ['Gujranwala', 'Sialkot', 'Hafizabad', 'Narowal'] },
  { zone: 'North', region: 'Peshawar', districts: ['Peshawar', 'Mardan', 'Charsadda', 'Swabi'] },
  { zone: 'Central', region: 'Faisalabad', districts: ['Faisalabad', 'Jhang', 'Toba Tek Singh', 'Chiniot'] },
  { zone: 'Central', region: 'Sahiwal', districts: ['Sahiwal', 'Pakpattan', 'Vehari', 'Khanewal'] },
  { zone: 'Central', region: 'Sargodha', districts: ['Sargodha', 'Khushab', 'Mandi Bahauddin', 'Bhakkar'] },
  { zone: 'South', region: 'Multan', districts: ['Multan', 'Lodhran', 'Muzaffargarh', 'Layyah'] },
  { zone: 'South', region: 'Bahawalpur', districts: ['Bahawalpur', 'Rahim Yar Khan', 'Bahawalnagar', 'Rajanpur'] },
  { zone: 'Sindh', region: 'Hyderabad', districts: ['Hyderabad', 'Mirpur Khas', 'Sanghar', 'Badin'] },
  { zone: 'Sindh', region: 'Sukkur', districts: ['Sukkur', 'Khairpur', 'Ghotki', 'Nawabshah'] },
];
export const ZONES = Array.from(new Set(REGIONS.map(r => r.zone)));
export const REGION_NAMES = REGIONS.map(r => r.region);

function seeded(seed: number) {
  let s = seed % 233280;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

const FRANCHISES = Array.from({ length: 1000 }, (_, i) => {
  const r = REGIONS[i % REGIONS.length];
  const district = r.districts[Math.floor(i / REGIONS.length) % r.districts.length];
  return { id: `FR-${String(i + 1).padStart(4, '0')}`, name: `Naya Savera ${district} ${Math.floor(i / 40) + 1}`, zone: r.zone, region: r.region, district };
});

const KEY = 'loyaltySettlements_v1';
type Override = Pick<Statement, 'status' | 'approvedBy' | 'approvedAt' | 'paidAt' | 'paymentRef' | 'method'>;
function loadOverrides(): Record<string, Override> {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
}
function saveOverrides(o: Record<string, Override>) {
  try { localStorage.setItem(KEY, JSON.stringify(o)); } catch { /* keep in memory only */ }
}

const HOLD_REASONS = ['Sale returned after redemption', 'Open fraud case on grower', 'Above daily redemption limit', 'Grower number blacklisted'];
const LINES: Record<string, StatementLine[]> = {};

function makeLines(rnd: () => number, count: number, period: string, withHolds: boolean): StatementLine[] {
  const lines: StatementLine[] = [];
  for (let i = 0; i < count; i++) {
    const pts = 50 + Math.floor(rnd() * 400);
    const held = withHolds && (rnd() < 0.2 || (i === count - 1 && !lines.some(l => l.held)));
    const online = rnd() < 0.3;
    lines.push({
      date: `${String(1 + Math.floor(rnd() * 28)).padStart(2, '0')} ${period}`,
      ref: online ? `ORD-${80000 + Math.floor(rnd() * 9999)}` : `Code ${100000 + Math.floor(rnd() * 899999)}`,
      channel: online ? 'Online order' : 'POS code', mobile: `03${Math.floor(rnd() * 5)}X-XXX${1000 + Math.floor(rnd() * 8999)}`,
      points: pts, amount: pts, check: held ? HOLD_REASONS[Math.floor(rnd() * HOLD_REASONS.length)] : 'Cleared', held,
    });
  }
  return lines.sort((a, b) => a.date.localeCompare(b.date));
}

function baseStatements(period: string): Statement[] {
  const p = PERIODS.indexOf(period);
  const out: Statement[] = [];
  FRANCHISES.forEach((f, i) => {
    const rnd = seeded(i * 31 + p * 7919 + 17);
    const redemptions = Math.floor(rnd() * rnd() * 60);
    if (redemptions === 0) return;
    const lines = makeLines(rnd, redemptions, period, rnd() < 0.09);
    const points = lines.reduce((a, l) => a + l.points, 0);
    const held = lines.filter(l => l.held).reduce((a, l) => a + l.amount, 0);
    const roll = rnd();
    const status: SettlementStatus = p === 0 ? 'Pending review' : p === 1 ? (roll < 0.35 ? 'Pending review' : roll < 0.7 ? 'Approved' : 'Paid') : (roll < 0.06 ? 'Approved' : 'Paid');
    const monthNo = 11 - p;
    const st: Statement = {
      id: `ST-26${String(monthNo).padStart(2, '0')}-${f.id.slice(3)}`, period, franchiseId: f.id, franchise: f.name, zone: f.zone, region: f.region, district: f.district,
      redemptions, points, gross: points, held, payable: points - held, status,
    };
    if (status !== 'Pending review') { st.approvedBy = 'Finance – Sana Tariq'; st.approvedAt = `2026-${String(monthNo + 1).padStart(2, '0')}-0${3 + (i % 5)}`; }
    if (status === 'Paid') { st.paidAt = `2026-${String(monthNo + 1).padStart(2, '0')}-1${i % 9}`; st.method = i % 3 === 0 ? 'Credit note' : 'Bank transfer'; st.paymentRef = `${st.method === 'Credit note' ? 'CN' : 'BT'}-26${String(monthNo).padStart(2, '0')}-${f.id.slice(3)}`; }
    LINES[st.id] = lines;
    out.push(st);
  });
  return out;
}

const cache: Record<string, Statement[]> = {};
export function getStatements(period: string): Statement[] {
  cache[period] ??= baseStatements(period);
  const o = loadOverrides();
  return cache[period].map(s => (o[s.id] ? { ...s, ...o[s.id] } : s));
}

export function approveStatements(ids: string[], by: string) {
  const o = loadOverrides();
  const today = new Date().toISOString().slice(0, 10);
  ids.forEach(id => { o[id] = { ...(o[id] ?? {}), status: 'Approved', approvedBy: by, approvedAt: today } as Override; });
  saveOverrides(o);
}

export function markPaid(ids: string[], method: PaymentMethod, ref: string, by: string) {
  const o = loadOverrides();
  const today = new Date().toISOString().slice(0, 10);
  ids.forEach((id, n) => {
    o[id] = { ...(o[id] ?? {}), status: 'Paid', approvedBy: o[id]?.approvedBy ?? by, approvedAt: o[id]?.approvedAt ?? today, paidAt: today, method, paymentRef: ids.length > 1 ? `${ref}-${n + 1}` : ref } as Override;
  });
  saveOverrides(o);
}

export const statementLines = (s: Statement): StatementLine[] => LINES[s.id] ?? [];
