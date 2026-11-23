import { useMemo, useState } from 'react';
import { Download, FileBarChart } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import {
  PRIMARY, GROWERS, LedgerEntry, balanceOf, getActiveProgram, getAdjustments, getBlacklist, getFraudCases, getLedger,
} from '../utils/loyaltyStore';

type Row = Record<string, string | number>;
interface ReportDef { key: string; name: string; purpose: string; frequency: string; build: (ledger: LedgerEntry[]) => Row[] }

const day = (iso: string) => iso.slice(0, 10);
const sumPts = (rows: LedgerEntry[], t: LedgerEntry['type']) => rows.filter(r => r.type === t).reduce((s, r) => s + Math.abs(r.points), 0);

const REPORTS: ReportDef[] = [
  {
    key: 'daily', name: 'Daily Loyalty Summary', purpose: 'Day-by-day points movement and new members', frequency: 'Daily',
    build: ledger => {
      const days = Array.from(new Set(ledger.map(l => day(l.at)))).sort().reverse();
      return days.map(d => {
        const rows = ledger.filter(l => day(l.at) === d);
        return {
          Date: d, 'New Members': GROWERS.filter(g => g.joined === d).length,
          'Points Issued': sumPts(rows, 'EARN'), 'Points Redeemed': sumPts(rows, 'REDEEM'), 'Points Adjusted': rows.filter(r => r.type === 'ADJUST').reduce((s, r) => s + r.points, 0),
          'Points Expired': sumPts(rows, 'EXPIRE'), 'Active Growers': new Set(rows.map(r => r.growerId)).size,
        };
      });
    },
  },
  {
    key: 'master', name: 'Master Loyalty Report', purpose: 'One row per grower with location and lifetime points', frequency: 'On demand',
    build: () => GROWERS.map(g => {
      const b = balanceOf(g.mobile);
      const bl = getBlacklist().find(x => x.active && x.mobile === g.mobile);
      return {
        'Grower ID': g.growerId, Name: g.name, Mobile: g.mobile, Province: g.province, District: g.district, Tehsil: g.tehsil, Village: g.village,
        Latitude: g.lat, Longitude: g.lng, Earned: b.earned, Redeemed: b.redeemed, Adjusted: b.adjusted, Expired: b.expired, Balance: b.balance,
        Status: bl ? 'Blacklisted' : 'Active', 'Last Activity': b.last ? day(b.last.at) : '—',
      };
    }),
  },
  {
    key: 'ledger', name: 'Transaction Ledger (Audit Log)', purpose: 'Every earn, redeem, adjust and expire entry', frequency: 'On demand',
    build: ledger => ledger.map(l => ({
      'Date & Time': new Date(l.at).toLocaleString(), 'Grower ID': l.growerId, Mobile: l.mobile, Type: l.type, Channel: l.channel, 'Order / Sale': l.ref,
      Franchise: l.franchise, Product: l.product, SKU: l.sku, Qty: l.qty, 'Unit Price': l.unitPrice, 'Cart Value': l.cartValue, Points: l.points,
      Lat: l.lat.toFixed(3), Long: l.lng.toFixed(3), User: l.by,
    })),
  },
  {
    key: 'franchise', name: 'Franchise Ledger Report', purpose: 'Points issued and redeemed per franchise', frequency: 'Weekly / monthly',
    build: ledger => Array.from(new Set(ledger.map(l => l.franchise).filter(f => f !== '—'))).map(f => {
      const rows = ledger.filter(l => l.franchise === f);
      const redeemed = sumPts(rows.filter(r => r.channel === 'POS'), 'REDEEM');
      const pkr = redeemed * getActiveProgram().redemptionRate;
      return { Franchise: f, 'Points Issued': sumPts(rows, 'EARN'), 'Points Redeemed (POS)': redeemed, 'Redemption Value (PKR)': pkr, Members: new Set(rows.map(r => r.growerId)).size };
    }),
  },
  {
    key: 'product', name: 'Product Performance Report', purpose: 'Sales and points issued by product', frequency: 'Monthly',
    build: ledger => {
      const rules = getActiveProgram().rules;
      return Array.from(new Set(ledger.filter(l => l.type === 'EARN').map(l => l.sku))).map(sku => {
        const rows = ledger.filter(l => l.type === 'EARN' && l.sku === sku);
        const rule = rules.find(r => r.sku === sku);
        return { Product: rows[0].product, SKU: sku, 'Units Sold': rows.reduce((s, r) => s + r.qty, 0), 'Sales Value (PKR)': rows.reduce((s, r) => s + r.cartValue, 0), 'Points / Unit': rule ? (rule.eligible ? rule.pointsPerUnit : 'Not eligible') : 'Standard rate', 'Points Issued': sumPts(rows, 'EARN') };
      }).sort((a, b) => (b['Sales Value (PKR)'] as number) - (a['Sales Value (PKR)'] as number));
    },
  },
  {
    key: 'program', name: 'Loyalty Program Performance', purpose: 'Results of the active loyalty program', frequency: 'Per program',
    build: ledger => {
      const p = getActiveProgram();
      const earn = ledger.filter(l => l.type === 'EARN');
      return [{ Program: p.name, Participants: new Set(earn.map(e => e.growerId)).size, 'Revenue (PKR)': earn.reduce((s, r) => s + r.cartValue, 0), 'Points Issued': sumPts(ledger, 'EARN'), 'Points Redeemed': sumPts(ledger, 'REDEEM'), 'Earn Rate': `${p.standardPointsPerRs} pt / Rs`, 'Rs per Point': p.redemptionRate }];
    },
  },
  {
    key: 'adjust', name: 'Point Adjustment Report', purpose: 'Admin adjustments and franchise return reversals', frequency: 'On demand',
    build: () => getAdjustments().map(a => ({ Date: day(a.at), ID: a.id, Origin: a.source, Mobile: a.mobile, 'Grower ID': a.growerId, Type: a.type, Points: a.direction === 'add' ? a.points : -a.points, 'Linked ID': a.linkedRef, Note: a.note, 'Entered By': a.enteredBy })),
  },
  {
    key: 'expiry', name: 'Points Expiry Report', purpose: 'Points expiring in the next 30 days and already expired', frequency: 'Monthly',
    build: () => GROWERS.map(g => { const b = balanceOf(g.mobile); return { 'Grower ID': g.growerId, Name: g.name, Mobile: g.mobile, Balance: b.balance, 'Expiring in 30 days': b.expiringSoon, 'Expired Points': b.expired, 'Validity (days)': getActiveProgram().pointsValidityDays }; })
      .sort((a, b) => (b['Expiring in 30 days'] as number) - (a['Expiring in 30 days'] as number)),
  },
  {
    key: 'fraud', name: 'Fraud Report', purpose: 'Flagged growers with fraud type, score and status', frequency: 'Daily',
    build: () => getFraudCases().map(f => ({ Case: f.id, Date: day(f.at), 'Grower ID': f.growerId, Mobile: f.mobile, 'Fraud Type': f.type, 'Fraud Score': f.score, Franchise: f.franchise, Status: f.status })),
  },
  {
    key: 'blacklist', name: 'Blacklist Report', purpose: 'Blocked numbers and history', frequency: 'On demand',
    build: () => getBlacklist().map(b => ({ Mobile: b.mobile, 'Grower ID': b.growerId, Name: b.name, Scope: b.scope, Reason: b.reason, 'Blocked By': b.by, Date: day(b.at), Status: b.active ? 'Active' : 'Removed' })),
  },
];

function exportCSV(rows: Row[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(','), ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(','))].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = filename;
  a.click();
}

export function LoyaltyReports() {
  const [active, setActive] = useState('daily');
  const [range, setRange] = useState('30');
  const def = REPORTS.find(r => r.key === active)!;
  const rows = useMemo(() => {
    const from = Date.now() - Number(range) * 86400000;
    return def.build(getLedger().filter(l => new Date(l.at).getTime() >= from));
  }, [def, range]);
  const headers = rows.length ? Object.keys(rows[0]) : [];
  const shown = rows.slice(0, 50);

  return (
    <div className="grid lg:grid-cols-4 gap-6">
      <Card className="lg:col-span-1 h-fit">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><FileBarChart className="size-4" style={{ color: PRIMARY }} /> Reports</CardTitle>
          <CardDescription>{REPORTS.length} reports · preview and export</CardDescription>
        </CardHeader>
        <CardContent className="p-2">
          {REPORTS.map(r => (
            <button key={r.key} type="button" onClick={() => setActive(r.key)}
              className={`w-full text-left rounded-lg px-3 py-2 mb-0.5 transition-colors ${active === r.key ? 'bg-[#C7359C]/10 text-[#C7359C]' : 'hover:bg-gray-50 text-gray-700'}`}>
              <p className="text-sm font-medium">{r.name}</p>
              <p className="text-xs text-gray-400">{r.frequency}</p>
            </button>
          ))}
        </CardContent>
      </Card>

      <Card className="lg:col-span-3">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">{def.name}</CardTitle>
              <CardDescription>{def.purpose}</CardDescription>
              <div className="flex gap-1.5 mt-2">
                <Badge variant="outline">{def.frequency}</Badge>
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={range} onValueChange={setRange}>
                <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="60">Last 60 days</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={() => exportCSV(rows, `${def.key}-report.csv`)}>
                <Download className="size-4" /> CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500">
                <tr>{headers.map(h => <th key={h} className="text-left px-3 py-2.5 font-medium whitespace-nowrap">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y">
                {shown.map((r, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    {headers.map(h => <td key={h} className="px-3 py-2 whitespace-nowrap">{typeof r[h] === 'number' ? (r[h] as number).toLocaleString() : r[h]}</td>)}
                  </tr>
                ))}
                {rows.length === 0 && <tr><td className="text-center py-10 text-gray-400">No data in this period</td></tr>}
              </tbody>
            </table>
          </div>
          {rows.length > shown.length && <p className="text-xs text-gray-400 px-3 py-2 border-t">Showing 50 of {rows.length} rows. Export CSV for all.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
