import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ArrowDownRight, ArrowUpRight, Download, Search, SlidersHorizontal, AlertTriangle, Ban, Store } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import {
  PRIMARY, Adjustment, AdjustmentType, balanceOf, blacklistFor, createAdjustment, findGrower, getAdjustments, getLedger, hasReversalFor,
} from '../utils/loyaltyStore';

const TYPES: { value: AdjustmentType; direction: 'add' | 'deduct' | 'either'; hint: string }[] = [
  { value: 'Manual credit', direction: 'add', hint: 'Points missed, e.g. a dispute at the POS or franchise' },
  { value: 'Manual debit', direction: 'deduct', hint: 'Points credited by mistake' },
  { value: 'Correction', direction: 'either', hint: 'Fix a wrong earn or redeem entry' },
  { value: 'Return reversal', direction: 'deduct', hint: 'Product returned. Returns processed at a franchise are reversed automatically.' },
];

function exportCSV(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(','), ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(','))].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = filename;
  a.click();
}

export function LoyaltyAdjustments() {
  const [list, setList] = useState<Adjustment[]>(getAdjustments);
  const [mobile, setMobile] = useState('');
  const [type, setType] = useState<AdjustmentType>('Manual credit');
  const [direction, setDirection] = useState<'add' | 'deduct'>('deduct');
  const [points, setPoints] = useState('');
  const [linkedRef, setLinkedRef] = useState('');
  const [note, setNote] = useState('');
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');

  const grower = mobile.replace(/\D/g, '').length >= 10 ? findGrower(mobile) : undefined;
  const bal = grower ? balanceOf(grower.mobile) : null;
  const blocked = grower ? blacklistFor(grower.mobile) : undefined;
  const recent = useMemo(() => grower ? getLedger().filter(l => l.growerId === grower.growerId && l.type === 'EARN').slice(0, 5) : [], [grower, list]);
  const typeMeta = TYPES.find(t => t.value === type)!;
  const effectiveDirection = typeMeta.direction === 'either' ? direction : typeMeta.direction;
  const pts = Number(points);
  const validPoints = Number.isInteger(pts) && pts > 0;
  const after = bal && validPoints ? bal.balance + (effectiveDirection === 'add' ? pts : -pts) : null;
  const duplicate = type === 'Return reversal' && linkedRef.trim() !== '' && hasReversalFor(linkedRef.trim());

  const reset = () => { setMobile(''); setPoints(''); setLinkedRef(''); setNote(''); setType('Manual credit'); };

  const submit = () => {
    if (!grower || !bal) return toast.error('Enter a registered mobile number');
    if (!validPoints) return toast.error('Points must be a whole number above zero');
    if (duplicate) return toast.error(`Points for ${linkedRef} were already reversed`);
    const adj = createAdjustment({
      mobile: grower.mobile, growerId: grower.growerId, name: grower.name, type, direction: effectiveDirection,
      points: pts, linkedRef: linkedRef.trim(), note: note.trim(), source: 'Admin', enteredBy: 'Admin User',
    });
    setList(getAdjustments());
    reset();
    toast.success(`${adj.id}: ${effectiveDirection === 'add' ? '+' : '−'}${pts} points applied. The grower's balance is updated.`);
  };

  const rows = list.filter(a =>
    (sourceFilter === 'all' || a.source === sourceFilter) &&
    (!search || [a.mobile, a.name, a.growerId, a.linkedRef, a.id, a.enteredBy].some(v => v.toLowerCase().includes(search.toLowerCase()))));
  const fromReturns = list.filter(a => a.source === 'Franchise return').length;
  const deducted = list.filter(a => a.direction === 'deduct').reduce((s, a) => s + a.points, 0);
  const added = list.filter(a => a.direction === 'add').reduce((s, a) => s + a.points, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { t: 'Adjustments', v: list.length, s: 'all time', c: 'text-gray-900' },
          { t: 'From franchise returns', v: fromReturns, s: 'reversed automatically', c: 'text-[#C7359C]' },
          { t: 'Points deducted', v: deducted, s: 'returns, debits, corrections', c: 'text-red-600' },
          { t: 'Points added', v: added, s: 'credits, corrections', c: 'text-emerald-600' },
        ].map(k => (
          <Card key={k.t}><CardContent className="pt-5 pb-4">
            <p className="text-xs text-gray-500 mb-1">{k.t}</p>
            <p className={`text-2xl font-bold ${k.c}`}>{k.v.toLocaleString()}</p>
            <p className="text-xs text-gray-400 mt-0.5">{k.s}</p>
          </CardContent></Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Form */}
        <Card className="lg:col-span-2 border-[#C7359C]/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><SlidersHorizontal className="size-4" style={{ color: PRIMARY }} /> New Point Adjustment</CardTitle>
            <CardDescription>Add or deduct points against a grower's mobile number, e.g. to settle a dispute at the POS or franchise. Every adjustment is logged.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Mobile number *</Label>
              <Input placeholder="03XX-XXXXXXX" value={mobile} onChange={e => setMobile(e.target.value)} />
              {mobile.replace(/\D/g, '').length >= 10 && !grower && <p className="text-xs text-red-600">No loyalty member with this number.</p>}
              {!mobile && <p className="text-xs text-gray-400">Try 0312-9876543 or 0300-1234567</p>}
            </div>

            {grower && bal && (
              <div className="rounded-lg border bg-gray-50 p-3 text-sm space-y-2">
                <div className="flex justify-between gap-2">
                  <div>
                    <p className="font-semibold text-gray-900">{grower.name}</p>
                    <p className="text-xs text-gray-500">{grower.growerId} · {grower.district}, {grower.province}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Current balance</p>
                    <p className="text-lg font-bold" style={{ color: PRIMARY }}>{bal.balance.toLocaleString()} pts</p>
                  </div>
                </div>
                {blocked && <p className="text-xs text-red-700 flex items-center gap-1"><Ban className="size-3.5" /> Blacklisted: {blocked.reason}</p>}
                {recent.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Recent earnings (click to reverse)</p>
                    <div className="space-y-1">
                      {recent.map(r => (
                        <button key={r.id} type="button"
                          onClick={() => { setType('Return reversal'); setLinkedRef(r.ref); setPoints(String(r.points)); }}
                          className="w-full flex justify-between text-xs bg-white border rounded px-2 py-1 hover:border-[#C7359C]">
                          <span className="truncate">{r.ref} · {r.product} × {r.qty}</span>
                          <span className="font-semibold text-[#C7359C] ml-2">+{r.points}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Type *</Label>
                <Select value={type} onValueChange={v => setType(v as AdjustmentType)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.value}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Points (whole number) *</Label>
                <Input type="number" min={1} step={1} placeholder="e.g. 100" value={points} onChange={e => setPoints(e.target.value)} />
              </div>
            </div>
            <p className="text-xs text-gray-500 -mt-2">{typeMeta.hint}</p>

            {typeMeta.direction === 'either' ? (
              <div className="flex gap-2">
                {(['deduct', 'add'] as const).map(d => (
                  <button key={d} type="button" onClick={() => setDirection(d)}
                    className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg border-2 py-2 text-sm font-medium ${direction === d ? 'border-[#C7359C] bg-[#C7359C]/5 text-[#C7359C]' : 'border-gray-200 text-gray-600'}`}>
                    {d === 'add' ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />} {d === 'add' ? 'Add points' : 'Deduct points'}
                  </button>
                ))}
              </div>
            ) : (
              <Badge variant="outline" className={effectiveDirection === 'add' ? 'text-emerald-700 border-emerald-200 bg-emerald-50' : 'text-red-700 border-red-200 bg-red-50'}>
                {effectiveDirection === 'add' ? 'Adds points' : 'Deducts points'}
              </Badge>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Order / sale / return ID</Label>
              <Input placeholder="ORD-…, SL-… or RET-…" value={linkedRef} onChange={e => setLinkedRef(e.target.value)} />
            </div>
            {duplicate && <p className="text-xs text-red-600 flex items-center gap-1"><AlertTriangle className="size-3.5" /> Points for this return were already reversed.</p>}

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Note (optional)</Label>
              <Textarea rows={2} placeholder="e.g. Dispute at Lahore Branch, order was not credited" value={note} onChange={e => setNote(e.target.value)} />
            </div>

            {bal && after !== null && (
              <div className="rounded-lg border-2 border-dashed p-3 text-sm flex items-center justify-between">
                <span className="text-gray-600">Balance</span>
                <span className="font-semibold">{bal.balance.toLocaleString()} → <span className={after < 0 ? 'text-red-600' : 'text-[#C7359C]'}>{after.toLocaleString()} pts</span></span>
              </div>
            )}
            {after !== null && after < 0 && <p className="text-xs text-amber-700">Points were already redeemed. The balance goes negative and is recovered from the next earning.</p>}

            <Button onClick={submit} disabled={!grower || !validPoints} className="w-full text-white hover:opacity-90" style={{ backgroundColor: PRIMARY }}>
              Apply adjustment
            </Button>
          </CardContent>
        </Card>

        {/* History */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base">Adjustment History</CardTitle>
                <CardDescription>Admin adjustments and points reversed automatically when a franchise processes a return</CardDescription>
              </div>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => exportCSV(rows.map(a => ({
                ID: a.id, Date: new Date(a.at).toLocaleString(), Source: a.source, Mobile: a.mobile, 'Grower ID': a.growerId, Grower: a.name, Type: a.type,
                Points: a.direction === 'add' ? a.points : -a.points, 'Linked ID': a.linkedRef, Note: a.note,
                'Balance Before': a.balanceBefore, 'Balance After': a.balanceAfter, 'Entered By': a.enteredBy,
              })), 'point-adjustments.csv')}>
                <Download className="size-4" /> Export
              </Button>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 size-4 text-gray-400" />
                <Input placeholder="Search mobile, grower, franchise, ID…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
              </div>
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger className="h-9 sm:w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sources</SelectItem>
                  <SelectItem value="Franchise return">Franchise returns</SelectItem>
                  <SelectItem value="Admin">Admin adjustments</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500">
                  <tr>{['ID / Date', 'Grower', 'Type', 'Points', 'Linked ID', 'Balance', 'Source'].map(h => <th key={h} className="text-left px-3 py-2.5 font-medium whitespace-nowrap">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map(a => (
                    <tr key={a.id} className="hover:bg-gray-50 align-top">
                      <td className="px-3 py-2.5 whitespace-nowrap"><p className="font-medium">{a.id}</p><p className="text-xs text-gray-400">{new Date(a.at).toLocaleDateString()}</p></td>
                      <td className="px-3 py-2.5"><p className="font-medium whitespace-nowrap">{a.name}</p><p className="text-xs text-gray-500">{a.mobile}</p></td>
                      <td className="px-3 py-2.5"><p className="whitespace-nowrap">{a.type}</p>{a.note && <p className="text-xs text-gray-400 max-w-[200px] truncate" title={a.note}>{a.note}</p>}</td>
                      <td className={`px-3 py-2.5 font-semibold whitespace-nowrap ${a.direction === 'add' ? 'text-emerald-600' : 'text-red-600'}`}>{a.direction === 'add' ? '+' : '−'}{a.points}</td>
                      <td className="px-3 py-2.5 text-xs whitespace-nowrap">{a.linkedRef || '—'}</td>
                      <td className="px-3 py-2.5 text-xs whitespace-nowrap">{a.balanceBefore} → {a.balanceAfter}</td>
                      <td className="px-3 py-2.5 text-xs">
                        {a.source === 'Franchise return'
                          ? <Badge variant="outline" className="bg-[#C7359C]/5 text-[#C7359C] border-[#C7359C]/20 whitespace-nowrap"><Store className="size-3 mr-1" />{a.enteredBy}</Badge>
                          : <span className="whitespace-nowrap text-gray-600">{a.enteredBy}</span>}
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && <tr><td colSpan={7} className="text-center py-10 text-gray-400">No adjustments match</td></tr>}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
