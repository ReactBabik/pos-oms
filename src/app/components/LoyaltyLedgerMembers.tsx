import { useMemo, useState } from 'react';
import { Download, Search, Ban, MapPin } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { GROWERS, LedgerType, balanceOf, blacklistFor, getLedger } from '../utils/loyaltyStore';

const PAGE = 25;
const TYPE_STYLE: Record<LedgerType, string> = {
  EARN: 'bg-[#C7359C]/10 text-[#C7359C] border-[#C7359C]/20',
  REDEEM: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  ADJUST: 'bg-blue-50 text-blue-700 border-blue-200',
  EXPIRE: 'bg-gray-100 text-gray-600 border-gray-200',
};

function exportCSV(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(','), ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(','))].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = filename;
  a.click();
}

/** Transaction ledger / audit log. */
export function LoyaltyLedger() {
  const [q, setQ] = useState('');
  const [type, setType] = useState('all');
  const [channel, setChannel] = useState('all');
  const [page, setPage] = useState(1);
  const all = useMemo(getLedger, []);
  const rows = all.filter(l =>
    (type === 'all' || l.type === type) && (channel === 'all' || l.channel === channel) &&
    (!q || [l.name, l.mobile, l.growerId, l.ref, l.product, l.sku].some(v => v.toLowerCase().includes(q.toLowerCase()))));
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const shown = rows.slice((page - 1) * PAGE, page * PAGE);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Loyalty Ledger (Audit Log)</CardTitle>
            <CardDescription>Every earn, redeem, adjust and expire entry. Entries are never edited; corrections are new entries.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => exportCSV(rows.map(l => ({
            'Date & Time': new Date(l.at).toLocaleString(), 'Grower ID': l.growerId, Grower: l.name, Mobile: l.mobile, Type: l.type, Channel: l.channel,
            'Order / Sale': l.ref, Franchise: l.franchise, Product: l.product, SKU: l.sku, Qty: l.qty, 'Unit Price': l.unitPrice, 'Cart Value': l.cartValue,
            Points: l.points, Latitude: l.lat.toFixed(4), Longitude: l.lng.toFixed(4), User: l.by,
          })), 'loyalty-ledger.csv')}>
            <Download className="size-4 mr-1.5" /> Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 size-4" />
            <Input placeholder="Search grower, mobile, Grower ID, order, product, SKU…" value={q} onChange={e => { setQ(e.target.value); setPage(1); }} className="pl-10 h-9" />
          </div>
          <Select value={type} onValueChange={v => { setType(v); setPage(1); }}>
            <SelectTrigger className="w-full sm:w-40 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="EARN">Earn</SelectItem>
              <SelectItem value="REDEEM">Redeem</SelectItem>
              <SelectItem value="ADJUST">Adjust</SelectItem>
              <SelectItem value="EXPIRE">Expire</SelectItem>
            </SelectContent>
          </Select>
          <Select value={channel} onValueChange={v => { setChannel(v); setPage(1); }}>
            <SelectTrigger className="w-full sm:w-40 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All channels</SelectItem>
              <SelectItem value="Online">Online (Cropwise)</SelectItem>
              <SelectItem value="POS">POS (Franchise)</SelectItem>
              <SelectItem value="Admin">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>{['Date & Time', 'Grower', 'Type', 'Channel', 'Order / Sale', 'Product / SKU', 'Qty × Price', 'Cart', 'Points', 'Franchise', 'Location', 'User'].map(h => <th key={h} className="text-left px-3 py-2.5 font-medium whitespace-nowrap">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y">
              {shown.map(l => (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{new Date(l.at).toLocaleString()}</td>
                  <td className="px-3 py-2 whitespace-nowrap"><p className="font-medium">{l.name}</p><p className="text-xs text-gray-400">{l.growerId} · {l.mobile}</p></td>
                  <td className="px-3 py-2"><Badge variant="outline" className={`${TYPE_STYLE[l.type]} text-xs`}>{l.type}</Badge></td>
                  <td className="px-3 py-2 text-xs">{l.channel}</td>
                  <td className="px-3 py-2 font-mono text-xs text-gray-500 whitespace-nowrap">{l.ref}</td>
                  <td className="px-3 py-2 whitespace-nowrap"><p className="text-xs">{l.product}</p><p className="text-xs text-gray-400">{l.sku}</p></td>
                  <td className="px-3 py-2 text-xs whitespace-nowrap">{l.qty ? `${l.qty} × ${l.unitPrice.toLocaleString()}` : '—'}</td>
                  <td className="px-3 py-2 text-xs whitespace-nowrap">{l.cartValue ? `PKR ${l.cartValue.toLocaleString()}` : '—'}</td>
                  <td className={`px-3 py-2 font-semibold whitespace-nowrap ${l.points >= 0 ? 'text-[#C7359C]' : 'text-emerald-700'}`}>{l.points > 0 ? '+' : ''}{l.points}</td>
                  <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{l.franchise}</td>
                  <td className="px-3 py-2 text-xs text-gray-400 whitespace-nowrap"><MapPin className="size-3 inline mr-0.5" />{l.lat.toFixed(2)}, {l.lng.toFixed(2)}</td>
                  <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{l.by}</td>
                </tr>
              ))}
              {shown.length === 0 && <tr><td colSpan={12} className="text-center py-10 text-gray-400">No ledger entries found</td></tr>}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-gray-500">Showing {(page - 1) * PAGE + 1}–{Math.min(page * PAGE, rows.length)} of {rows.length}</p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Previous</Button>
              <span className="text-sm text-gray-600">{page} / {pages}</span>
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}>Next</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Members with Grower ID, location, lifetime points, expiry and status (Master Loyalty Report). */
export function LoyaltyMembers() {
  const [q, setQ] = useState('');
  const members = useMemo(() => GROWERS.map(g => ({ ...g, ...balanceOf(g.mobile), blocked: blacklistFor(g.mobile) }))
    .sort((a, b) => b.balance - a.balance), []);
  const rows = members.filter(m => !q || [m.name, m.mobile, m.growerId, m.district, m.province].some(v => v.toLowerCase().includes(q.toLowerCase())));

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Loyalty Members</CardTitle>
            <CardDescription>Growers keyed by mobile number and Cropwise Grower ID. Points stay with the number if a membership is cancelled.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => exportCSV(rows.map(m => ({
            'Grower ID': m.growerId, Name: m.name, Mobile: m.mobile, Province: m.province, District: m.district, Tehsil: m.tehsil, Village: m.village,
            Latitude: m.lat, Longitude: m.lng, Earned: m.earned, Redeemed: m.redeemed, Adjusted: m.adjusted, Expired: m.expired, Balance: m.balance,
            'Expiring in 30 days': m.expiringSoon, Status: m.blocked ? 'Blacklisted' : 'Active',
          })), 'loyalty-members.csv')}>
            <Download className="size-4 mr-1.5" /> Export
          </Button>
        </div>
        <div className="relative pt-2">
          <Search className="absolute left-3 top-1/2 translate-y-[-25%] text-gray-400 size-4" />
          <Input placeholder="Search name, mobile, Grower ID, district…" value={q} onChange={e => setQ(e.target.value)} className="pl-10 h-9" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>{['Grower', 'Location', 'Earned', 'Redeemed', 'Adjusted', 'Expired', 'Balance', 'Expiring (30d)', 'Status'].map(h => <th key={h} className="text-left px-3 py-2.5 font-medium whitespace-nowrap">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y">
              {rows.map(m => (
                <tr key={m.growerId} className="hover:bg-gray-50">
                  <td className="px-3 py-2 whitespace-nowrap"><p className="font-medium">{m.name}</p><p className="text-xs text-gray-400">{m.growerId} · {m.mobile}</p></td>
                  <td className="px-3 py-2 text-xs whitespace-nowrap"><p>{m.village}, {m.tehsil}</p><p className="text-gray-400">{m.district}, {m.province}</p></td>
                  <td className="px-3 py-2 text-[#C7359C] font-semibold">{m.earned.toLocaleString()}</td>
                  <td className="px-3 py-2 text-emerald-600">{m.redeemed.toLocaleString()}</td>
                  <td className={`px-3 py-2 ${m.adjusted < 0 ? 'text-red-600' : 'text-blue-600'}`}>{m.adjusted > 0 ? '+' : ''}{m.adjusted}</td>
                  <td className="px-3 py-2 text-gray-500">{m.expired.toLocaleString()}</td>
                  <td className="px-3 py-2"><Badge className={m.balance > 0 ? 'bg-[#C7359C]/10 text-[#C7359C] border-[#C7359C]/20 font-bold' : 'bg-red-50 text-red-600 border-red-200'}>{m.balance.toLocaleString()} pts</Badge></td>
                  <td className="px-3 py-2">{m.expiringSoon > 0 ? <span className="text-amber-600 font-medium">{m.expiringSoon}</span> : <span className="text-gray-300">—</span>}</td>
                  <td className="px-3 py-2">{m.blocked
                    ? <Badge variant="outline" className="text-red-700 border-red-200 bg-red-50 whitespace-nowrap"><Ban className="size-3 mr-1" />Blacklisted</Badge>
                    : <Badge variant="outline" className="text-green-700 border-green-200 bg-green-50">Active</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
