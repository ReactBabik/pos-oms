import { useState, useMemo } from 'react';
import {
  Gift, RefreshCw, Activity, BarChart3, Star, Users, Coins,
  ArrowDownRight, ArrowUpRight, TrendingUp, Award, Flame,
  Download, Search, Calendar, Building2,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from './ui/table';
import { ScrollArea } from './ui/scroll-area';
import { Language } from '../App';
import { useFranchiseFilters } from '../utils/franchiseFilters';

const PRIMARY = '#C7359C';
const COLORS = [PRIMARY, '#FFD700', '#10b981', '#3b82f6', '#f59e0b', '#8b5cf6'];

const LOG_PAGE_SIZE = 20;

// ── Mock data ─────────────────────────────────────────────────────────────────

const FRANCHISES = [
  { id: '1', name: 'Main Branch – Karachi' },
  { id: '2', name: 'Lahore Branch' },
  { id: '3', name: 'Islamabad Branch' },
  { id: '4', name: 'Faisalabad Branch' },
];

interface LoyaltyTx {
  id: string;
  date: string;
  customer: string;
  phone: string;
  saleId: string;
  purchaseAmount: number;
  pointsEarned: number;
  pointsRedeemed: number;
  loyaltyDiscount: number;
  balanceAfter: number;
  franchiseId: string;
}

function generateMockTx(): LoyaltyTx[] {
  const customers = [
    { name: 'Ahmed Khan', phone: '0300-1234567' },
    { name: 'Fatima Malik', phone: '0312-9876543' },
    { name: 'Usman Ali', phone: '0333-5551234' },
    { name: 'Sara Qureshi', phone: '0321-7778899' },
    { name: 'Bilal Raza', phone: '0345-4443322' },
    { name: 'Zainab Hassan', phone: '0301-2223344' },
    { name: 'Imran Sheikh', phone: '0311-6667788' },
    { name: 'Hina Butt', phone: '0322-9990011' },
  ];
  const txs: LoyaltyTx[] = [];
  const now = Date.now();
  let balanceMap: Record<string, number> = {};
  for (let i = 200; i >= 0; i--) {
    const c = customers[Math.floor(Math.random() * customers.length)];
    const fId = FRANCHISES[Math.floor(Math.random() * FRANCHISES.length)].id;
    const purchase = Math.round((Math.random() * 4500 + 500) / 10) * 10;
    const earned = Math.floor(purchase * 0.05);
    const redeem = Math.random() < 0.2 ? Math.floor(Math.random() * Math.min(earned * 3, 200)) : 0;
    const discount = redeem;
    const key = c.phone;
    balanceMap[key] = (balanceMap[key] ?? 0) + earned - redeem;
    txs.push({
      id: `tx-${i}`,
      date: new Date(now - i * 8 * 3600 * 1000 + Math.random() * 6 * 3600 * 1000).toISOString(),
      customer: c.name,
      phone: c.phone,
      saleId: `SL-${10000 + i}`,
      purchaseAmount: purchase,
      pointsEarned: earned,
      pointsRedeemed: redeem,
      loyaltyDiscount: discount,
      balanceAfter: Math.max(0, balanceMap[key]),
      franchiseId: fId,
    });
  }
  return txs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

const ALL_TX = generateMockTx();

const loyaltySettings = { standardPointsPerRs: 0.05, redemptionRate: 1 };

// ── Helpers ───────────────────────────────────────────────────────────────────

function exportCSV(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(','), ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(','))].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = filename;
  a.click();
}

interface DatePillProps { range: string; active: string; onClick: (r: string) => void; label: string; }
function DatePill({ range, active, onClick, label }: DatePillProps) {
  return (
    <button
      onClick={() => onClick(range)}
      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
        active === range
          ? 'bg-[#C7359C] text-white border-[#C7359C]'
          : 'bg-white text-gray-600 border-gray-200 hover:border-[#C7359C] hover:text-[#C7359C]'
      }`}
    >
      {label}
    </button>
  );
}

function kpiCard(title: string, value: string, sub: string, icon: React.ReactNode, highlight = false) {
  return (
    <Card key={title} className={highlight ? 'border-[#C7359C]/30 bg-[#C7359C]/5' : ''}>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs text-gray-500 mb-1">{title}</p>
            <p className={`text-2xl font-bold ${highlight ? 'text-[#C7359C]' : 'text-gray-900'}`}>{value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
          </div>
          <div className="mt-0.5">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function filterByDateRange(txs: LoyaltyTx[], range: string, customStart: string, customEnd: string) {
  const now = new Date();
  let from: Date;
  let to = new Date(now.getTime() + 86400000);
  if (range === 'today') {
    from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (range === '7d') {
    from = new Date(now.getTime() - 7 * 86400000);
  } else if (range === '30d') {
    from = new Date(now.getTime() - 30 * 86400000);
  } else if (range === 'mtd') {
    from = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (range === 'custom' && customStart && customEnd) {
    from = new Date(customStart);
    to = new Date(customEnd + 'T23:59:59');
  } else {
    from = new Date(now.getTime() - 30 * 86400000);
  }
  return txs.filter(t => { const d = new Date(t.date); return d >= from && d <= to; });
}

// ── Main Component ────────────────────────────────────────────────────────────

interface LoyaltyModuleProps { language: Language; }

export function LoyaltyModule({ language }: LoyaltyModuleProps) {
  const [transactions, setTransactions] = useState<LoyaltyTx[]>(ALL_TX);
  const [dateRange, setDateRange] = useState('30d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [txTypeFilter, setTxTypeFilter] = useState<'all' | 'earn' | 'redeem'>('all');
  const franchiseFilters = useFranchiseFilters();
  const [logPage, setLogPage] = useState(1);

  const loadSales = () => {
    setTransactions([...generateMockTx()]);
  };

  // ── Derived: overview KPIs ────────────────────────────────────────────────
  const totalPointsIssued = useMemo(() => transactions.reduce((s, t) => s + t.pointsEarned, 0), [transactions]);
  const totalPointsRedeemed = useMemo(() => transactions.reduce((s, t) => s + t.pointsRedeemed, 0), [transactions]);
  const totalBalance = totalPointsIssued - totalPointsRedeemed;
  const redemptionRate = totalPointsIssued > 0 ? Math.round((totalPointsRedeemed / totalPointsIssued) * 100) : 0;
  const totalPkrSaved = useMemo(() => transactions.reduce((s, t) => s + t.loyaltyDiscount, 0), [transactions]);

  const customerStats = useMemo(() => {
    const map = new Map<string, { name: string; phone: string; pointsEarned: number; pointsRedeemed: number; balance: number; totalPurchases: number; txCount: number; lastActive: string }>();
    transactions.forEach(t => {
      const k = t.phone || t.customer;
      if (!map.has(k)) map.set(k, { name: t.customer, phone: t.phone, pointsEarned: 0, pointsRedeemed: 0, balance: 0, totalPurchases: 0, txCount: 0, lastActive: t.date });
      const e = map.get(k)!;
      e.pointsEarned += t.pointsEarned;
      e.pointsRedeemed += t.pointsRedeemed;
      e.balance += t.pointsEarned - t.pointsRedeemed;
      e.totalPurchases += t.purchaseAmount;
      e.txCount += 1;
      if (new Date(t.date) > new Date(e.lastActive)) e.lastActive = t.date;
    });
    return Array.from(map.values()).sort((a, b) => b.balance - a.balance);
  }, [transactions]);

  const activeMembers = customerStats.filter(c => c.balance > 0).length;

  // ── Trend (last 30 days) ──────────────────────────────────────────────────
  const trendData = useMemo(() => {
    const days: Record<string, { date: string; earned: number; redeemed: number }> = {};
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      const key = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
      days[key] = { date: key, earned: 0, redeemed: 0 };
    }
    transactions.forEach(t => {
      const d = new Date(t.date);
      const key = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
      if (days[key]) { days[key].earned += t.pointsEarned; days[key].redeemed += t.pointsRedeemed; }
    });
    return Object.values(days);
  }, [transactions]);

  const pieData = [
    { name: 'Redeemed', value: totalPointsRedeemed },
    { name: 'Outstanding', value: totalBalance },
  ].filter(d => d.value > 0);

  // ── Filtered transactions ─────────────────────────────────────────────────
  const filteredTx = useMemo(() => {
    let txs = filterByDateRange(transactions, dateRange, customStart, customEnd);
    if (txTypeFilter === 'earn') txs = txs.filter(t => t.pointsEarned > 0);
    if (txTypeFilter === 'redeem') txs = txs.filter(t => t.pointsRedeemed > 0);
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      txs = txs.filter(t => t.customer.toLowerCase().includes(q) || t.phone.includes(q) || t.saleId.toLowerCase().includes(q));
    }
    return txs;
  }, [transactions, dateRange, customStart, customEnd, txTypeFilter, searchTerm]);

  const filteredEarned = useMemo(() => filteredTx.reduce((s, t) => s + t.pointsEarned, 0), [filteredTx]);
  const filteredRedeemed = useMemo(() => filteredTx.reduce((s, t) => s + t.pointsRedeemed, 0), [filteredTx]);
  const filteredDiscount = useMemo(() => filteredTx.reduce((s, t) => s + t.loyaltyDiscount, 0), [filteredTx]);
  const filteredMembers = useMemo(() => new Set(filteredTx.map(t => t.phone || t.customer)).size, [filteredTx]);

  const analyticsTrend = useMemo(() => {
    const days: Record<string, { date: string; earned: number; redeemed: number }> = {};
    filteredTx.forEach(t => {
      const key = new Date(t.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
      if (!days[key]) days[key] = { date: key, earned: 0, redeemed: 0 };
      days[key].earned += t.pointsEarned;
      days[key].redeemed += t.pointsRedeemed;
    });
    return Object.values(days).sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredTx]);

  const totalLogPages = Math.ceil(filteredTx.length / LOG_PAGE_SIZE);
  const pagedLogs = filteredTx.slice((logPage - 1) * LOG_PAGE_SIZE, logPage * LOG_PAGE_SIZE);

  // ── Franchisee breakdown ──────────────────────────────────────────────────
  const franchiseBreakdown = useMemo(() => {
    return FRANCHISES.map(f => {
      const ftx = transactions.filter(t => t.franchiseId === f.id);
      const ftxFiltered = filterByDateRange(ftx, dateRange, customStart, customEnd);
      const earned = ftx.reduce((s, t) => s + t.pointsEarned, 0);
      const redeemed = ftx.reduce((s, t) => s + t.pointsRedeemed, 0);
      const balance = earned - redeemed;
      const pkrSaved = ftx.reduce((s, t) => s + t.loyaltyDiscount, 0);
      const members = new Set(ftx.map(t => t.phone || t.customer)).size;
      const periodEarned = ftxFiltered.reduce((s, t) => s + t.pointsEarned, 0);
      const periodRedeemed = ftxFiltered.reduce((s, t) => s + t.pointsRedeemed, 0);
      const rate = earned > 0 ? Math.round((redeemed / earned) * 100) : 0;
      return { ...f, earned, redeemed, balance, pkrSaved, members, periodEarned, periodRedeemed, rate, txCount: ftx.length };
    });
  }, [transactions, dateRange, customStart, customEnd]);

  const franchiseChartData = franchiseBreakdown.map(f => ({
    name: f.name.split(' – ')[0].split(' Branch')[0],
    earned: f.periodEarned,
    redeemed: f.periodRedeemed,
    balance: f.balance,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="font-bold text-gray-900 text-2xl flex items-center gap-2">
            <Gift className="size-6 text-[#C7359C]" />
            Loyalty Program
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Earn rate: {loyaltySettings.standardPointsPerRs} pt/PKR &nbsp;·&nbsp;
            Redeem rate: {loyaltySettings.redemptionRate} PKR/pt
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadSales} className="gap-2">
          <RefreshCw className="size-4" /> Refresh
        </Button>
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

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="h-10 flex-wrap">
          <TabsTrigger value="overview" className="gap-2">
            <Activity className="size-4" /> Overview
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-2">
            <BarChart3 className="size-4" /> Analytics
          </TabsTrigger>
          <TabsTrigger value="franchises" className="gap-2">
            <Building2 className="size-4" /> Franchisee Breakdown
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2">
            <Star className="size-4" /> Transaction Logs
          </TabsTrigger>
          <TabsTrigger value="members" className="gap-2">
            <Users className="size-4" /> Members
          </TabsTrigger>
        </TabsList>

        {/* ── OVERVIEW ─────────────────────────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {kpiCard('Total Points Issued', totalPointsIssued.toLocaleString(), 'all time earned', <Coins className="size-4 text-[#C7359C]" />, true)}
            {kpiCard('Points Redeemed', totalPointsRedeemed.toLocaleString(), 'converted to discounts', <ArrowDownRight className="size-4 text-emerald-600" />)}
            {kpiCard('Outstanding Balance', totalBalance.toLocaleString(), 'unredeemed points', <Gift className="size-4 text-amber-500" />)}
            {kpiCard('Redemption Rate', `${redemptionRate}%`, 'of issued points redeemed', <TrendingUp className="size-4 text-blue-500" />)}
            {kpiCard('Active Members', activeMembers.toLocaleString(), 'customers with points', <Users className="size-4 text-purple-500" />)}
            {kpiCard('PKR Saved via Points', `PKR ${totalPkrSaved.toLocaleString()}`, 'total loyalty discounts', <Award className="size-4 text-rose-500" />)}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Points Activity — Last 30 Days</CardTitle>
              <CardDescription>Daily earned vs redeemed points</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="earnGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={PRIMARY} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={PRIMARY} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="redeemGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={4} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="earned" name="Points Earned" stroke={PRIMARY} strokeWidth={2} fill="url(#earnGrad)" />
                  <Area type="monotone" dataKey="redeemed" name="Points Redeemed" stroke="#10b981" strokeWidth={2} fill="url(#redeemGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Flame className="size-4 text-[#C7359C]" /> Top Members by Balance
                </CardTitle>
                <CardDescription>Customers with highest outstanding points</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {customerStats.slice(0, 5).map((c, i) => (
                    <div key={c.phone || c.name} className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }}>
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{c.name}</p>
                        <p className="text-xs text-gray-500">{c.phone}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-bold text-[#C7359C] text-sm">{c.balance.toLocaleString()} pts</p>
                        <p className="text-xs text-gray-400">{c.txCount} orders</p>
                      </div>
                    </div>
                  ))}
                  {customerStats.length === 0 && <p className="text-gray-400 text-sm text-center py-4">No loyalty activity yet</p>}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Points Distribution</CardTitle>
                <CardDescription>Redeemed vs outstanding balance</CardDescription>
              </CardHeader>
              <CardContent>
                {pieData.length > 0 ? (
                  <div className="flex items-center gap-6">
                    <PieChart width={160} height={160}>
                      <Pie data={pieData} cx={75} cy={75} innerRadius={45} outerRadius={72} dataKey="value" strokeWidth={2}>
                        {pieData.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => v.toLocaleString()} />
                    </PieChart>
                    <div className="space-y-3">
                      {pieData.map((d, i) => (
                        <div key={d.name} className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                          <div>
                            <p className="text-sm font-medium">{d.name}</p>
                            <p className="text-xs text-gray-500">{d.value.toLocaleString()} pts</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm text-center py-8">No data yet</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── ANALYTICS ────────────────────────────────────────────────────── */}
        <TabsContent value="analytics" className="space-y-6">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex flex-wrap items-center gap-2">
                <Calendar className="size-4 text-gray-400 flex-shrink-0" />
                <DatePill range="today" active={dateRange} onClick={setDateRange} label="Today" />
                <DatePill range="7d" active={dateRange} onClick={setDateRange} label="Last 7 Days" />
                <DatePill range="30d" active={dateRange} onClick={setDateRange} label="Last 30 Days" />
                <DatePill range="mtd" active={dateRange} onClick={setDateRange} label="This Month" />
                <DatePill range="custom" active={dateRange} onClick={setDateRange} label="Custom" />
                {dateRange === 'custom' && (
                  <div className="flex items-center gap-2 ml-2">
                    <Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="h-8 w-36 text-sm" />
                    <span className="text-gray-400 text-sm">→</span>
                    <Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="h-8 w-36 text-sm" />
                  </div>
                )}
                <span className="ml-auto text-xs text-gray-400">{filteredTx.length} transactions</span>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {kpiCard('Points Earned', filteredEarned.toLocaleString(), 'in selected period', <ArrowUpRight className="size-4 text-[#C7359C]" />, true)}
            {kpiCard('Points Redeemed', filteredRedeemed.toLocaleString(), 'in selected period', <ArrowDownRight className="size-4 text-emerald-600" />)}
            {kpiCard('PKR Discount Given', `PKR ${filteredDiscount.toLocaleString()}`, 'via loyalty redemptions', <Award className="size-4 text-amber-500" />)}
            {kpiCard('Active Customers', filteredMembers.toLocaleString(), 'with loyalty transactions', <Users className="size-4 text-blue-500" />)}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Points Activity Trend</CardTitle>
              <CardDescription>Earned vs redeemed per day in selected period</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={analyticsTrend} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} interval={analyticsTrend.length > 15 ? Math.floor(analyticsTrend.length / 10) : 0} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="earned" name="Points Earned" fill={PRIMARY} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="redeemed" name="Points Redeemed" fill="#10b981" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Top Earners in Period</CardTitle>
                  <CardDescription>Customers who earned the most points</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => exportCSV(filteredTx.map(t => ({ Date: new Date(t.date).toLocaleDateString(), Customer: t.customer, Phone: t.phone, 'Sale ID': t.saleId, 'Purchase Amount': t.purchaseAmount, 'Points Earned': t.pointsEarned, 'Points Redeemed': t.pointsRedeemed, 'PKR Discount': t.loyaltyDiscount })), `loyalty-analytics-${new Date().toISOString().split('T')[0]}.csv`)}>
                  <Download className="size-4 mr-1.5" /> Export
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {(() => {
                const map = new Map<string, { name: string; phone: string; earned: number; redeemed: number }>();
                filteredTx.forEach(t => {
                  const k = t.phone || t.customer;
                  if (!map.has(k)) map.set(k, { name: t.customer, phone: t.phone, earned: 0, redeemed: 0 });
                  const e = map.get(k)!;
                  e.earned += t.pointsEarned;
                  e.redeemed += t.pointsRedeemed;
                });
                const top = Array.from(map.values()).sort((a, b) => b.earned - a.earned).slice(0, 8);
                const maxEarned = top[0]?.earned || 1;
                return top.length > 0 ? (
                  <div className="space-y-3">
                    {top.map(c => (
                      <div key={c.phone || c.name} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium truncate max-w-[160px]">{c.name}</span>
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span className="text-[#C7359C] font-semibold">{c.earned.toLocaleString()} pts</span>
                            {c.redeemed > 0 && <span className="text-emerald-600">-{c.redeemed.toLocaleString()} redeemed</span>}
                          </div>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-[#C7359C]" style={{ width: `${(c.earned / maxEarned) * 100}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-gray-400 text-sm text-center py-6">No activity in this period</p>;
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── FRANCHISEE BREAKDOWN ──────────────────────────────────────────── */}
        <TabsContent value="franchises" className="space-y-6">
          {/* Date filter */}
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex flex-wrap items-center gap-2">
                <Calendar className="size-4 text-gray-400 flex-shrink-0" />
                <DatePill range="today" active={dateRange} onClick={setDateRange} label="Today" />
                <DatePill range="7d" active={dateRange} onClick={setDateRange} label="Last 7 Days" />
                <DatePill range="30d" active={dateRange} onClick={setDateRange} label="Last 30 Days" />
                <DatePill range="mtd" active={dateRange} onClick={setDateRange} label="This Month" />
                <DatePill range="custom" active={dateRange} onClick={setDateRange} label="Custom" />
                {dateRange === 'custom' && (
                  <div className="flex items-center gap-2 ml-2">
                    <Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="h-8 w-36 text-sm" />
                    <span className="text-gray-400 text-sm">→</span>
                    <Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="h-8 w-36 text-sm" />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Summary KPI cards per franchise */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {franchiseBreakdown.map((f, i) => (
              <Card key={f.id} className="border-t-4" style={{ borderTopColor: COLORS[i % COLORS.length] }}>
                <CardContent className="pt-4 pb-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-gray-800 text-sm leading-tight">{f.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{f.txCount} total transactions</p>
                    </div>
                    <Building2 className="size-4 mt-0.5 flex-shrink-0" style={{ color: COLORS[i % COLORS.length] }} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="bg-gray-50 rounded-lg p-2">
                      <p className="text-lg font-bold text-[#C7359C]">{f.periodEarned.toLocaleString()}</p>
                      <p className="text-xs text-gray-400">Earned (period)</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2">
                      <p className="text-lg font-bold text-emerald-600">{f.periodRedeemed.toLocaleString()}</p>
                      <p className="text-xs text-gray-400">Redeemed (period)</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2">
                      <p className="text-lg font-bold text-gray-700">{f.balance.toLocaleString()}</p>
                      <p className="text-xs text-gray-400">Outstanding</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2">
                      <p className="text-lg font-bold text-blue-600">{f.members}</p>
                      <p className="text-xs text-gray-400">Members</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">Redemption rate</span>
                    <span className="font-semibold text-gray-700">{f.rate}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${f.rate}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Comparison bar chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Franchisee Comparison — Selected Period</CardTitle>
              <CardDescription>Points earned and redeemed per franchise</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={franchiseChartData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="earned" name="Points Earned" fill={PRIMARY} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="redeemed" name="Points Redeemed" fill="#10b981" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="balance" name="Outstanding" fill="#FFD700" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Detailed table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Franchisee Loyalty Summary</CardTitle>
                  <CardDescription>All-time metrics per franchise</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => exportCSV(franchiseBreakdown.map(f => ({ Franchise: f.name, 'Total Earned': f.earned, 'Total Redeemed': f.redeemed, 'Outstanding Balance': f.balance, 'PKR Saved': f.pkrSaved, Members: f.members, 'Redemption Rate %': f.rate, 'Total Transactions': f.txCount })), `franchise-loyalty-${new Date().toISOString().split('T')[0]}.csv`)}>
                  <Download className="size-4 mr-1.5" /> Export
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Franchise</TableHead>
                    <TableHead className="text-right">Total Earned</TableHead>
                    <TableHead className="text-right">Total Redeemed</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead className="text-right">PKR Saved</TableHead>
                    <TableHead className="text-right">Members</TableHead>
                    <TableHead className="text-right">Redeem Rate</TableHead>
                    <TableHead className="text-right">Transactions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {franchiseBreakdown.map((f, i) => (
                    <TableRow key={f.id} className="text-sm">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                          <span className="font-medium">{f.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-[#C7359C]">{f.earned.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-emerald-600">{f.redeemed.toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <Badge className="bg-amber-50 text-amber-700 border-amber-200 font-semibold text-xs">
                          {f.balance.toLocaleString()} pts
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-gray-600">PKR {f.pkrSaved.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-blue-600 font-medium">{f.members}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${f.rate}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                          </div>
                          <span className="text-xs font-medium text-gray-600 w-8">{f.rate}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-gray-500">{f.txCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TRANSACTION LOGS ──────────────────────────────────────────────── */}
        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Loyalty Transaction Logs</CardTitle>
                  <CardDescription>Complete earn &amp; redeem history</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => exportCSV(filteredTx.map(t => ({ Date: new Date(t.date).toLocaleString(), Customer: t.customer, Phone: t.phone, 'Sale ID': t.saleId, 'Purchase Amount': t.purchaseAmount, 'Points Earned': t.pointsEarned, 'Points Redeemed': t.pointsRedeemed, 'PKR Discount': t.loyaltyDiscount, 'Balance After': t.balanceAfter ?? '' })), `loyalty-logs-${new Date().toISOString().split('T')[0]}.csv`)}>
                  <Download className="size-4 mr-1.5" /> Export CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 size-4" />
                  <Input placeholder="Search by customer, phone, sale ID..." value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setLogPage(1); }} className="pl-10 h-9" />
                </div>
                <Select value={txTypeFilter} onValueChange={v => { setTxTypeFilter(v as any); setLogPage(1); }}>
                  <SelectTrigger className="w-full sm:w-44 h-9">
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Transactions</SelectItem>
                    <SelectItem value="earn">Earn Only</SelectItem>
                    <SelectItem value="redeem">Redeem Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date &amp; Time</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Sale ID</TableHead>
                      <TableHead>Franchise</TableHead>
                      <TableHead className="text-right">Purchase</TableHead>
                      <TableHead className="text-right">Earned</TableHead>
                      <TableHead className="text-right">Redeemed</TableHead>
                      <TableHead className="text-right">PKR Disc.</TableHead>
                      <TableHead className="text-right">Balance After</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedLogs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-10 text-gray-400">No loyalty transactions found</TableCell>
                      </TableRow>
                    ) : (
                      pagedLogs.map((tx, i) => {
                        const franchise = FRANCHISES.find(f => f.id === tx.franchiseId);
                        return (
                          <TableRow key={`${tx.saleId}-${i}`} className="text-sm">
                            <TableCell className="whitespace-nowrap text-xs text-gray-500">{new Date(tx.date).toLocaleString()}</TableCell>
                            <TableCell className="font-medium">{tx.customer}</TableCell>
                            <TableCell className="font-mono text-xs text-gray-500">{tx.phone || '—'}</TableCell>
                            <TableCell className="font-mono text-xs text-gray-400">{tx.saleId.slice(0, 8)}…</TableCell>
                            <TableCell className="text-xs text-gray-500">{franchise?.name.split(' – ')[0] ?? '—'}</TableCell>
                            <TableCell className="text-right">PKR {tx.purchaseAmount.toLocaleString()}</TableCell>
                            <TableCell className="text-right">
                              {tx.pointsEarned > 0 ? <Badge className="bg-[#C7359C]/10 text-[#C7359C] border-[#C7359C]/20 font-semibold text-xs">+{tx.pointsEarned.toLocaleString()}</Badge> : '—'}
                            </TableCell>
                            <TableCell className="text-right">
                              {tx.pointsRedeemed > 0 ? <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold text-xs">-{tx.pointsRedeemed.toLocaleString()}</Badge> : '—'}
                            </TableCell>
                            <TableCell className="text-right text-emerald-600 font-medium">
                              {tx.loyaltyDiscount > 0 ? `PKR ${tx.loyaltyDiscount.toLocaleString()}` : '—'}
                            </TableCell>
                            <TableCell className="text-right font-semibold text-gray-700">
                              {tx.balanceAfter != null ? tx.balanceAfter.toLocaleString() : '—'}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>

              {totalLogPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-gray-500">
                    Showing {(logPage - 1) * LOG_PAGE_SIZE + 1}–{Math.min(logPage * LOG_PAGE_SIZE, filteredTx.length)} of {filteredTx.length}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setLogPage(p => Math.max(1, p - 1))} disabled={logPage === 1}>Previous</Button>
                    <span className="text-sm text-gray-600">{logPage} / {totalLogPages}</span>
                    <Button variant="outline" size="sm" onClick={() => setLogPage(p => Math.min(totalLogPages, p + 1))} disabled={logPage === totalLogPages}>Next</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── MEMBERS ──────────────────────────────────────────────────────── */}
        <TabsContent value="members" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Loyalty Members</CardTitle>
                  <CardDescription>All customers with loyalty activity, ranked by balance</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => exportCSV(customerStats.map(c => ({ Name: c.name, Phone: c.phone, 'Total Purchases (PKR)': c.totalPurchases, 'Points Earned': c.pointsEarned, 'Points Redeemed': c.pointsRedeemed, 'Current Balance': c.balance, Orders: c.txCount, 'Last Active': c.lastActive ? new Date(c.lastActive).toLocaleDateString() : '' })), `loyalty-members-${new Date().toISOString().split('T')[0]}.csv`)}>
                  <Download className="size-4 mr-1.5" /> Export
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[560px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead className="text-right">Total Spend</TableHead>
                      <TableHead className="text-right">Earned</TableHead>
                      <TableHead className="text-right">Redeemed</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead className="text-right">Orders</TableHead>
                      <TableHead>Last Active</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customerStats.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-10 text-gray-400">No members yet</TableCell>
                      </TableRow>
                    ) : (
                      customerStats.map((c, i) => (
                        <TableRow key={c.phone || c.name} className="text-sm">
                          <TableCell className="text-gray-400 font-medium">{i + 1}</TableCell>
                          <TableCell className="font-medium">{c.name}</TableCell>
                          <TableCell className="font-mono text-xs text-gray-500">{c.phone || '—'}</TableCell>
                          <TableCell className="text-right">PKR {c.totalPurchases.toLocaleString()}</TableCell>
                          <TableCell className="text-right text-[#C7359C] font-semibold">{c.pointsEarned.toLocaleString()}</TableCell>
                          <TableCell className="text-right text-emerald-600">{c.pointsRedeemed.toLocaleString()}</TableCell>
                          <TableCell className="text-right">
                            <Badge className={c.balance > 0 ? 'bg-[#C7359C]/10 text-[#C7359C] border-[#C7359C]/20 font-bold' : 'bg-gray-100 text-gray-400'}>
                              {c.balance.toLocaleString()} pts
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-gray-500">{c.txCount}</TableCell>
                          <TableCell className="text-xs text-gray-400">
                            {c.lastActive ? new Date(c.lastActive).toLocaleDateString() : '—'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
