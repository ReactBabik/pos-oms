import { useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Ban, ShieldAlert, ShieldCheck, Undo2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import {
  PRIMARY, BlacklistEntry, BlacklistScope, FraudCase, FraudStatus, findGrower, getBlacklist, getFraudCases, getFraudRules,
  saveBlacklist, setFraudStatus, normalizeMobile,
} from '../utils/loyaltyStore';

const STATUS_STYLE: Record<FraudStatus, string> = {
  Open: 'bg-red-50 text-red-700 border-red-200',
  'Under review': 'bg-amber-50 text-amber-700 border-amber-200',
  Closed: 'bg-gray-50 text-gray-600 border-gray-200',
};
const scoreColor = (s: number) => s >= 80 ? 'bg-red-500' : s >= 60 ? 'bg-amber-500' : 'bg-yellow-400';

export function LoyaltyRisk() {
  const [cases, setCases] = useState<FraudCase[]>(getFraudCases);
  const [blacklist, setBlacklist] = useState<BlacklistEntry[]>(getBlacklist);
  const [mobile, setMobile] = useState('');
  const [scope, setScope] = useState<BlacklistScope>('Earning & redemption');
  const [reason, setReason] = useState('');
  const rules = getFraudRules();


  const updateStatus = (id: string, s: FraudStatus) => {
    setFraudStatus(id, s);
    setCases(getFraudCases());
    toast.success(`${id} marked ${s}`);
  };

  const block = (m: string, sc: BlacklistScope, why: string) => {
    const g = findGrower(m);
    if (!g) return toast.error('No loyalty member with this number');
    if (!why.trim()) return toast.error('Reason is required');
    if (blacklist.some(b => b.active && normalizeMobile(b.mobile) === normalizeMobile(m))) return toast.error('Number is already blacklisted');
    const next = [{ mobile: g.mobile, growerId: g.growerId, name: g.name, scope: sc, reason: why.trim(), at: new Date().toISOString(), by: 'Admin User', active: true }, ...blacklist];
    saveBlacklist(next); setBlacklist(next);
    toast.success(`${g.mobile} blacklisted (${sc}). POS, checkout and code validation will reject it.`);
  };

  const unblock = (m: string) => {
    const next = blacklist.map(b => b.mobile === m && b.active ? { ...b, active: false, removedAt: new Date().toISOString(), removedBy: 'Admin User' } : b);
    saveBlacklist(next); setBlacklist(next);
    toast.success(`${m} removed from blacklist (logged)`);
  };

  const open = cases.filter(c => c.status === 'Open').length;
  const review = cases.filter(c => c.status === 'Under review').length;
  const active = blacklist.filter(b => b.active);

  return (
    <div className="space-y-6">
      {rules.dashboardAlerts && open > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <ShieldAlert className="size-5 text-red-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <p className="font-semibold text-red-800">{open} open fraud alert{open > 1 ? 's' : ''} need review</p>
            <p className="text-red-700">Flags are raised by the rules in Settings → Fraud Rules & Controls.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { t: 'Open cases', v: open, c: 'text-red-600' },
          { t: 'Under review', v: review, c: 'text-amber-600' },
          { t: 'Blacklisted numbers', v: active.length, c: 'text-gray-900' },
          { t: 'Fraud detection rate', v: `${Math.round((cases.length / 160) * 1000) / 10}%`, c: 'text-[#C7359C]' },
        ].map(k => (
          <Card key={k.t}><CardContent className="pt-5 pb-4">
            <p className="text-xs text-gray-500 mb-1">{k.t}</p>
            <p className={`text-2xl font-bold ${k.c}`}>{k.v}</p>
          </CardContent></Card>
        ))}
      </div>

      {/* Fraud cases */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="size-4" style={{ color: PRIMARY }} /> Fraud Cases</CardTitle>
          <CardDescription>
            Active rules: max {rules.maxRedemptionsPerDay} redemptions / day · high-value redemption above {rules.highValueRedemption.toLocaleString()} pts ·
            {' '}{rules.repeatedReturns}+ returns after earning
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500">
                <tr>{['Case', 'Grower', 'Fraud type', 'Score', 'Franchise', 'Status', 'Action'].map(h => <th key={h} className="text-left px-3 py-2.5 font-medium whitespace-nowrap">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y">
                {cases.map(c => {
                  const isBlocked = active.some(b => normalizeMobile(b.mobile) === normalizeMobile(c.mobile));
                  return (
                    <tr key={c.id} className="hover:bg-gray-50 align-top">
                      <td className="px-3 py-2.5 whitespace-nowrap"><p className="font-medium">{c.id}</p><p className="text-xs text-gray-400">{new Date(c.at).toLocaleDateString()}</p></td>
                      <td className="px-3 py-2.5"><p className="font-medium whitespace-nowrap">{c.name}</p><p className="text-xs text-gray-500 whitespace-nowrap">{c.growerId} · {c.mobile}</p></td>
                      <td className="px-3 py-2.5 min-w-[220px]"><p>{c.type}</p><p className="text-xs text-gray-500">{c.detail}</p></td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-14 h-1.5 rounded-full bg-gray-100"><div className={`h-1.5 rounded-full ${scoreColor(c.score)}`} style={{ width: `${c.score}%` }} /></div>
                          <span className="text-xs font-semibold">{c.score}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-xs whitespace-nowrap">{c.franchise}</td>
                      <td className="px-3 py-2.5">
                        <Select value={c.status} onValueChange={v => updateStatus(c.id, v as FraudStatus)}>
                          <SelectTrigger className={`h-8 w-36 text-xs border ${STATUS_STYLE[c.status]}`}><SelectValue /></SelectTrigger>
                          <SelectContent>{(['Open', 'Under review', 'Closed'] as FraudStatus[]).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-2.5">
                        {isBlocked
                          ? <Badge variant="outline" className="text-red-700 border-red-200 bg-red-50 whitespace-nowrap"><Ban className="size-3 mr-1" />Blacklisted</Badge>
                          : <Button size="sm" variant="outline" className="h-8 text-xs text-red-700 whitespace-nowrap" onClick={() => block(c.mobile, 'Earning & redemption', `Fraud case ${c.id}: ${c.type}`)}><Ban className="size-3.5 mr-1" />Blacklist</Button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div>
        {/* Blacklist */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Ban className="size-4" style={{ color: PRIMARY }} /> User Blacklist</CardTitle>
            <CardDescription>A blacklisted number is rejected at POS, ecommerce checkout and redemption code validation.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-3 gap-3 rounded-lg border bg-gray-50 p-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Mobile number</Label>
                <Input className="h-9 bg-white" placeholder="03XX-XXXXXXX" value={mobile} onChange={e => setMobile(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Block</Label>
                <Select value={scope} onValueChange={v => setScope(v as BlacklistScope)}>
                  <SelectTrigger className="h-9 bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>{(['Earning & redemption', 'Redemption only', 'Earning only'] as BlacklistScope[]).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Reason</Label>
                <Input className="h-9 bg-white" placeholder="Why is this number blocked?" value={reason} onChange={e => setReason(e.target.value)} />
              </div>
              <Button className="sm:col-span-3 text-white hover:opacity-90" style={{ backgroundColor: PRIMARY }}
                onClick={() => { block(mobile, scope, reason); setMobile(''); setReason(''); }}>
                <Ban className="size-4 mr-1.5" /> Add to blacklist
              </Button>
            </div>
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500">
                  <tr>{['Grower', 'Scope', 'Reason', 'Blocked', 'Status', ''].map(h => <th key={h} className="text-left px-3 py-2 font-medium whitespace-nowrap">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y">
                  {blacklist.map((b, i) => (
                    <tr key={b.mobile + i} className="align-top">
                      <td className="px-3 py-2"><p className="font-medium whitespace-nowrap">{b.name}</p><p className="text-xs text-gray-500">{b.mobile}</p></td>
                      <td className="px-3 py-2 text-xs whitespace-nowrap">{b.scope}</td>
                      <td className="px-3 py-2 text-xs min-w-[160px]">{b.reason}</td>
                      <td className="px-3 py-2 text-xs whitespace-nowrap">{new Date(b.at).toLocaleDateString()}<br /><span className="text-gray-400">{b.by}</span></td>
                      <td className="px-3 py-2">{b.active
                        ? <Badge variant="outline" className="text-red-700 border-red-200 bg-red-50">Active</Badge>
                        : <Badge variant="outline" className="text-gray-500" title={`Removed by ${b.removedBy}`}>Removed</Badge>}</td>
                      <td className="px-3 py-2">{b.active && <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => unblock(b.mobile)}><Undo2 className="size-3.5 mr-1" />Unblock</Button>}</td>
                    </tr>
                  ))}
                  {blacklist.length === 0 && <tr><td colSpan={6} className="text-center py-6 text-gray-400"><ShieldCheck className="size-5 mx-auto mb-1" />No blacklisted numbers</td></tr>}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
