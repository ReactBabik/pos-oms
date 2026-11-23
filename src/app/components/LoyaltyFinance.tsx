// Loyalty → Finance: franchise settlement statements. Deliberately neutral, corporate styling (slate palette)
// so it reads as a finance ledger rather than a marketing dashboard.
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Download, Search, ChevronLeft, ChevronRight, ArrowUpDown, CheckCheck, Banknote, X } from 'lucide-react';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from './ui/sheet';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import {
  PERIODS, ZONES, REGION_NAMES, PaymentMethod, SettlementStatus, Statement, approveStatements, getStatements, markPaid, statementLines,
} from '../utils/settlementStore';

const PAGE = 25;
const FINANCE_USER = 'Finance – Sana Tariq';
const pkr = (n: number) => n.toLocaleString('en-PK');

const STATUS_DOT: Record<SettlementStatus, string> = {
  'Pending review': 'bg-amber-500',
  Approved: 'bg-slate-700',
  Paid: 'bg-emerald-600',
};

function StatusLabel({ s }: { s: SettlementStatus }) {
  return <span className="inline-flex items-center gap-1.5 text-xs text-slate-700 whitespace-nowrap"><span className={`size-1.5 rounded-full ${STATUS_DOT[s]}`} />{s}</span>;
}

function Btn({ children, onClick, variant = 'primary', disabled }: { children: React.ReactNode; onClick?: () => void; variant?: 'primary' | 'outline' | 'ghost'; disabled?: boolean }) {
  const cls = variant === 'primary'
    ? 'bg-slate-900 text-white hover:bg-slate-800 border-slate-900'
    : variant === 'outline' ? 'bg-white text-slate-800 border-slate-300 hover:bg-slate-50' : 'bg-transparent text-slate-600 border-transparent hover:bg-slate-100';
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-md border text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed ${cls}`}>
      {children}
    </button>
  );
}

function exportCSV(rows: Statement[], period: string) {
  if (!rows.length) return;
  const head = ['Statement', 'Period', 'Franchise ID', 'Franchise', 'Zone', 'Region', 'District', 'Redemptions', 'Points', 'Gross (PKR)', 'On hold (PKR)', 'Payable (PKR)', 'Status', 'Approved by', 'Approved on', 'Paid on', 'Method', 'Payment ref'];
  const body = rows.map(s => [s.id, s.period, s.franchiseId, s.franchise, s.zone, s.region, s.district, s.redemptions, s.points, s.gross, s.held, s.payable, s.status, s.approvedBy ?? '', s.approvedAt ?? '', s.paidAt ?? '', s.method ?? '', s.paymentRef ?? '']);
  const csv = [head, ...body].map(r => r.map(v => JSON.stringify(v)).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = `franchise-settlements-${period.replace(' ', '-').toLowerCase()}.csv`;
  a.click();
}

export function LoyaltyFinance() {
  const [period, setPeriod] = useState(PERIODS[1]);
  const [version, setVersion] = useState(0);
  const [q, setQ] = useState('');
  const [zone, setZone] = useState('all');
  const [region, setRegion] = useState('all');
  const [status, setStatus] = useState('all');
  const [sortDesc, setSortDesc] = useState(true);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const [payFor, setPayFor] = useState<string[] | null>(null);
  const [method, setMethod] = useState<PaymentMethod>('Bank transfer');
  const [payRef, setPayRef] = useState('');

  const all = useMemo(() => getStatements(period), [period, version]);
  const rows = useMemo(() => all
    .filter(s => (zone === 'all' || s.zone === zone) && (region === 'all' || s.region === region) && (status === 'all' || s.status === status)
      && (!q || `${s.franchise} ${s.franchiseId} ${s.id} ${s.district}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => sortDesc ? b.payable - a.payable : a.payable - b.payable), [all, zone, region, status, q, sortDesc]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const shown = rows.slice((page - 1) * PAGE, page * PAGE);
  const open = openId ? all.find(s => s.id === openId) ?? null : null;

  const sum = (list: Statement[], f: (s: Statement) => number) => list.reduce((a, s) => a + f(s), 0);
  const by = (st: SettlementStatus) => all.filter(s => s.status === st);
  const kpis = [
    { label: 'Statements', value: all.length.toLocaleString(), sub: `${new Set(all.map(s => s.franchiseId)).size.toLocaleString()} franchises` },
    { label: 'Gross redemption value', value: `PKR ${pkr(sum(all, s => s.gross))}`, sub: `${pkr(sum(all, s => s.points))} points` },
    { label: 'Pending review', value: `PKR ${pkr(sum(by('Pending review'), s => s.payable))}`, sub: `${by('Pending review').length} statements` },
    { label: 'Approved, awaiting payment', value: `PKR ${pkr(sum(by('Approved'), s => s.payable))}`, sub: `${by('Approved').length} statements` },
    { label: 'Paid', value: `PKR ${pkr(sum(by('Paid'), s => s.payable))}`, sub: `${by('Paid').length} statements` },
    { label: 'On hold', value: `PKR ${pkr(sum(all, s => s.held))}`, sub: `${all.filter(s => s.held > 0).length} statements with held lines` },
  ];

  const selRows = all.filter(s => selected.has(s.id));
  const canApprove = selRows.filter(s => s.status === 'Pending review');
  const canPay = selRows.filter(s => s.status === 'Approved');
  const refresh = () => { setVersion(v => v + 1); setSelected(new Set()); };
  const toggle = (id: string) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allOnPage = shown.length > 0 && shown.every(s => selected.has(s.id));

  const doApprove = (ids: string[]) => {
    approveStatements(ids, FINANCE_USER);
    refresh();
    toast.success(`${ids.length} statement${ids.length > 1 ? 's' : ''} approved. Held lines are excluded from the payable amount.`);
  };
  const doPay = () => {
    if (!payFor) return;
    if (!payRef.trim()) return toast.error('Enter the payment reference');
    markPaid(payFor, method, payRef.trim(), FINANCE_USER);
    toast.success(`${payFor.length} statement${payFor.length > 1 ? 's' : ''} marked as paid (${method}).`);
    setPayFor(null); setPayRef(''); refresh();
  };
  const resetPage = () => { setPage(1); setSelected(new Set()); };

  const selectCls = 'h-9 bg-white border-slate-300 text-slate-800 text-sm';

  return (
    <div className="rounded-lg border border-slate-200 bg-white text-slate-900 shadow-sm">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3 px-5 pt-5 pb-4 border-b border-slate-200">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Finance</p>
          <h2 className="text-lg font-semibold text-slate-900">Franchise Settlements</h2>
          <p className="text-sm text-slate-500">Reimbursement to franchises for loyalty points redeemed at their outlets. Approve statements, then record payment.</p>
        </div>
        <div className="flex gap-2">
          <Select value={period} onValueChange={v => { setPeriod(v); resetPage(); }}>
            <SelectTrigger className={`${selectCls} w-36`}><SelectValue /></SelectTrigger>
            <SelectContent>{PERIODS.map(p => <SelectItem key={p} value={p}>{p}{p === PERIODS[0] ? ' (open)' : ''}</SelectItem>)}</SelectContent>
          </Select>
          <Btn variant="outline" onClick={() => exportCSV(rows, period)}><Download className="size-4" /> Export</Btn>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 divide-x divide-y xl:divide-y-0 divide-slate-200 border-b border-slate-200">
        {kpis.map(k => (
          <div key={k.label} className="px-5 py-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{k.label}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">{k.value}</p>
            <p className="text-xs text-slate-500 tabular-nums">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-2 px-5 py-3 border-b border-slate-200 bg-slate-50/60">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
          <Input placeholder="Search franchise name, ID, district or statement…" value={q} onChange={e => { setQ(e.target.value); resetPage(); }} className="pl-9 h-9 bg-white border-slate-300" />
        </div>
        <Select value={zone} onValueChange={v => { setZone(v); resetPage(); }}>
          <SelectTrigger className={`${selectCls} lg:w-36`}><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All zones</SelectItem>{ZONES.map(z => <SelectItem key={z} value={z}>{z}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={region} onValueChange={v => { setRegion(v); resetPage(); }}>
          <SelectTrigger className={`${selectCls} lg:w-40`}><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All regions</SelectItem>{REGION_NAMES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={status} onValueChange={v => { setStatus(v); resetPage(); }}>
          <SelectTrigger className={`${selectCls} lg:w-44`}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="Pending review">Pending review</SelectItem>
            <SelectItem value="Approved">Approved</SelectItem>
            <SelectItem value="Paid">Paid</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 px-5 py-2.5 border-b border-slate-200 bg-slate-900 text-white text-sm">
          <span className="tabular-nums">{selected.size} selected · PKR {pkr(sum(selRows, s => s.payable))} payable</span>
          <div className="flex gap-2 ml-auto">
            <button className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-white text-slate-900 text-sm font-medium disabled:opacity-40" disabled={!canApprove.length} onClick={() => doApprove(canApprove.map(s => s.id))}>
              <CheckCheck className="size-4" /> Approve ({canApprove.length})
            </button>
            <button className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-white/40 text-white text-sm font-medium disabled:opacity-40" disabled={!canPay.length} onClick={() => setPayFor(canPay.map(s => s.id))}>
              <Banknote className="size-4" /> Mark as paid ({canPay.length})
            </button>
            <button className="inline-flex items-center h-8 px-2 rounded-md text-white/70 hover:text-white" onClick={() => setSelected(new Set())}><X className="size-4" /></button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <th className="w-10 px-4 py-2.5"><Checkbox checked={allOnPage} onCheckedChange={v => setSelected(prev => { const n = new Set(prev); shown.forEach(s => v ? n.add(s.id) : n.delete(s.id)); return n; })} /></th>
              {['Statement', 'Franchise', 'Zone / Region'].map(h => <th key={h} className="text-left font-medium px-3 py-2.5 whitespace-nowrap">{h}</th>)}
              {['Redemptions', 'Points', 'Gross (PKR)', 'On hold (PKR)'].map(h => <th key={h} className="text-right font-medium px-3 py-2.5 whitespace-nowrap">{h}</th>)}
              <th className="text-right font-medium px-3 py-2.5 whitespace-nowrap">
                <button className="inline-flex items-center gap-1 uppercase tracking-wide hover:text-slate-800" onClick={() => setSortDesc(d => !d)}>Payable (PKR) <ArrowUpDown className="size-3" /></button>
              </th>
              {['Status', 'Last action'].map(h => <th key={h} className="text-left font-medium px-3 py-2.5 whitespace-nowrap">{h}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shown.map(s => (
              <tr key={s.id} className={`hover:bg-slate-50 cursor-pointer ${selected.has(s.id) ? 'bg-slate-50' : ''}`} onClick={() => setOpenId(s.id)}>
                <td className="px-4 py-2.5" onClick={e => e.stopPropagation()}><Checkbox checked={selected.has(s.id)} onCheckedChange={() => toggle(s.id)} /></td>
                <td className="px-3 py-2.5 font-mono text-xs text-slate-600 whitespace-nowrap">{s.id}</td>
                <td className="px-3 py-2.5 whitespace-nowrap"><p className="font-medium text-slate-900">{s.franchise}</p><p className="text-xs text-slate-500">{s.franchiseId} · {s.district}</p></td>
                <td className="px-3 py-2.5 text-xs text-slate-600 whitespace-nowrap">{s.zone} / {s.region}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{s.redemptions}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{pkr(s.points)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{pkr(s.gross)}</td>
                <td className={`px-3 py-2.5 text-right tabular-nums ${s.held ? 'text-slate-900' : 'text-slate-300'}`}>{s.held ? pkr(s.held) : '—'}</td>
                <td className="px-3 py-2.5 text-right tabular-nums font-semibold">{pkr(s.payable)}</td>
                <td className="px-3 py-2.5"><StatusLabel s={s.status} /></td>
                <td className="px-3 py-2.5 text-xs text-slate-500 whitespace-nowrap">
                  {s.status === 'Paid' ? `Paid ${s.paidAt} · ${s.paymentRef}` : s.status === 'Approved' ? `Approved ${s.approvedAt}` : 'Awaiting review'}
                </td>
              </tr>
            ))}
            {shown.length === 0 && <tr><td colSpan={11} className="text-center py-12 text-slate-400">No statements match the filters</td></tr>}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50 text-sm font-semibold">
                <td colSpan={4} className="px-4 py-2.5 text-slate-600">Total ({rows.length.toLocaleString()} statements)</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{pkr(sum(rows, s => s.redemptions))}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{pkr(sum(rows, s => s.points))}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{pkr(sum(rows, s => s.gross))}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{pkr(sum(rows, s => s.held))}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{pkr(sum(rows, s => s.payable))}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 text-sm text-slate-600">
        <span className="tabular-nums">{rows.length ? `${(page - 1) * PAGE + 1}–${Math.min(page * PAGE, rows.length)} of ${rows.length.toLocaleString()}` : '0 of 0'}</span>
        <div className="flex items-center gap-1">
          <Btn variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="size-4" /></Btn>
          <span className="px-3 tabular-nums">Page {page} of {pages}</span>
          <Btn variant="outline" disabled={page === pages} onClick={() => setPage(p => p + 1)}><ChevronRight className="size-4" /></Btn>
        </div>
      </div>

      {/* Statement detail */}
      <Sheet open={!!open} onOpenChange={o => !o && setOpenId(null)}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto bg-white text-slate-900">
          {open && (() => {
            const lines = statementLines(open);
            return (
              <>
                <SheetHeader className="border-b border-slate-200 pb-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Settlement statement · {open.period}</p>
                  <SheetTitle className="text-slate-900">{open.franchise}</SheetTitle>
                  <SheetDescription className="text-slate-500">{open.id} · {open.franchiseId} · {open.district}, {open.region} ({open.zone})</SheetDescription>
                </SheetHeader>
                <div className="px-4 space-y-5 pb-6">
                  <div className="grid grid-cols-2 sm:grid-cols-4 border border-slate-200 rounded-md divide-x divide-slate-200">
                    {[['Gross', open.gross], ['On hold', open.held], ['Payable', open.payable]].map(([l, v]) => (
                      <div key={l as string} className="px-3 py-2.5"><p className="text-[11px] uppercase tracking-wide text-slate-500">{l} (PKR)</p><p className="font-semibold tabular-nums">{pkr(v as number)}</p></div>
                    ))}
                    <div className="px-3 py-2.5"><p className="text-[11px] uppercase tracking-wide text-slate-500">Status</p><StatusLabel s={open.status} /></div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {open.status === 'Pending review' && <Btn onClick={() => doApprove([open.id])}><CheckCheck className="size-4" /> Approve statement</Btn>}
                    {open.status === 'Approved' && <Btn onClick={() => setPayFor([open.id])}><Banknote className="size-4" /> Mark as paid</Btn>}
                    {open.status === 'Paid' && <p className="text-sm text-slate-600">Paid on {open.paidAt} by {open.method} · Ref {open.paymentRef}</p>}
                  </div>

                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2">Redemption lines ({lines.length})</p>
                    <div className="border border-slate-200 rounded-md overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50 text-slate-500 uppercase tracking-wide text-[10px]">
                          <tr>{['Date', 'Reference', 'Channel', 'Grower', 'Points', 'PKR', 'Check'].map(h => <th key={h} className={`px-2.5 py-2 font-medium ${['Points', 'PKR'].includes(h) ? 'text-right' : 'text-left'}`}>{h}</th>)}</tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {lines.map((l, i) => (
                            <tr key={i} className={l.held ? 'bg-amber-50/40' : ''}>
                              <td className="px-2.5 py-1.5 whitespace-nowrap">{l.date}</td>
                              <td className="px-2.5 py-1.5 font-mono whitespace-nowrap">{l.ref}</td>
                              <td className="px-2.5 py-1.5 whitespace-nowrap">{l.channel}</td>
                              <td className="px-2.5 py-1.5 whitespace-nowrap text-slate-500">{l.mobile}</td>
                              <td className="px-2.5 py-1.5 text-right tabular-nums">{l.points}</td>
                              <td className="px-2.5 py-1.5 text-right tabular-nums">{pkr(l.amount)}</td>
                              <td className={`px-2.5 py-1.5 whitespace-nowrap ${l.held ? 'text-amber-800 font-medium' : 'text-slate-500'}`}>{l.held ? `Held – ${l.check}` : 'Cleared'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">Held lines are excluded from the payable amount and released in a later statement once the issue is resolved.</p>
                  </div>

                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2">Audit trail</p>
                    <ol className="text-sm space-y-1.5 text-slate-700">
                      <li>Statement generated at period close · System</li>
                      {open.approvedAt && <li>Approved {open.approvedAt} · {open.approvedBy}</li>}
                      {open.paidAt && <li>Paid {open.paidAt} · {open.method} · {open.paymentRef}</li>}
                    </ol>
                  </div>
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>

      {/* Mark as paid */}
      <Dialog open={!!payFor} onOpenChange={o => !o && setPayFor(null)}>
        <DialogContent className="max-w-md bg-white text-slate-900">
          <DialogHeader>
            <DialogTitle>Record payment</DialogTitle>
            <DialogDescription>
              {payFor?.length} approved statement{(payFor?.length ?? 0) > 1 ? 's' : ''} · PKR {pkr(sum(all.filter(s => payFor?.includes(s.id)), s => s.payable))}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-600">Payment method</Label>
              <Select value={method} onValueChange={v => setMethod(v as PaymentMethod)}>
                <SelectTrigger className={selectCls}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Bank transfer">Bank transfer</SelectItem>
                  <SelectItem value="Credit note">Credit note on stock invoice</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-600">Payment / credit note reference</Label>
              <Input value={payRef} onChange={e => setPayRef(e.target.value)} placeholder={method === 'Bank transfer' ? 'e.g. BT-2611-0042' : 'e.g. CN-2611-0042'} className="border-slate-300" />
              {(payFor?.length ?? 0) > 1 && <p className="text-xs text-slate-500">A number is added per statement, e.g. {payRef || 'REF'}-1, {payRef || 'REF'}-2.</p>}
            </div>
          </div>
          <DialogFooter>
            <Btn variant="outline" onClick={() => setPayFor(null)}>Cancel</Btn>
            <Btn onClick={doPay}><Banknote className="size-4" /> Confirm payment</Btn>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
