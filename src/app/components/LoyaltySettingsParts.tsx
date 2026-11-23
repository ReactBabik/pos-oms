import { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2, Upload, ShieldAlert, Save, Search } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { PRIMARY, PRODUCT_CATALOGUE, ProductPointsRule, FraudRules, getFraudRules, saveFraudRules } from '../utils/loyaltyStore';

/** Settings → Loyalty Program → Product Points & Eligibility. */
export function ProductPointsEditor({ rules, onChange, unlisted, onUnlistedChange, standardRate }: {
  rules: ProductPointsRule[]; onChange: (r: ProductPointsRule[]) => void;
  unlisted: 'standard' | 'none'; onUnlistedChange: (v: 'standard' | 'none') => void; standardRate: number;
}) {
  const [sku, setSku] = useState('');
  const [pts, setPts] = useState('');
  const [q, setQ] = useState('');
  const available = PRODUCT_CATALOGUE.filter(p => !rules.some(r => r.sku === p.sku));

  const add = () => {
    const p = PRODUCT_CATALOGUE.find(x => x.sku === sku);
    if (!p) return toast.error('Pick a product from the catalogue');
    const n = Number(pts);
    if (!Number.isInteger(n) || n < 0) return toast.error('Points per unit must be a whole number');
    onChange([...rules, { id: `r-${Date.now()}`, sku: p.sku, productName: p.name, eligible: true, pointsPerUnit: n }]);
    setSku(''); setPts('');
  };
  const update = (id: string, patch: Partial<ProductPointsRule>) => onChange(rules.map(r => r.id === id ? { ...r, ...patch } : r));
  const shown = rules.filter(r => !q || `${r.productName} ${r.sku}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-1">
        <div>
          <p className="text-sm font-semibold text-gray-800">Product Points &amp; Eligibility</p>
          <p className="text-xs text-gray-500">Choose which products earn points and how many points per unit, e.g. Product A = 10 points.</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 flex-shrink-0"
          onClick={() => toast.info('Bulk upload: CSV with columns SKU, Eligible (Y/N), Points per unit')}>
          <Upload className="size-3.5" /> Bulk CSV
        </Button>
      </div>

      <div className="rounded-lg border bg-gray-50 p-3 my-3 space-y-2">
        <p className="text-xs font-medium text-gray-700">Products not in this list</p>
        <div className="grid sm:grid-cols-2 gap-2">
          {([['standard', `Earn the standard rate (${standardRate} pt / Rs)`], ['none', 'Earn no points']] as const).map(([v, label]) => (
            <button key={v} type="button" onClick={() => onUnlistedChange(v)}
              className={`text-left rounded-lg border-2 px-3 py-2 text-sm bg-white ${unlisted === v ? 'border-[#C7359C] text-[#C7359C] font-medium' : 'border-gray-200 text-gray-600'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <Select value={sku} onValueChange={setSku}>
          <SelectTrigger className="flex-1 h-9"><SelectValue placeholder="Select product (SKU)" /></SelectTrigger>
          <SelectContent>
            {available.map(p => <SelectItem key={p.sku} value={p.sku}>{p.name} · {p.sku}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="number" min={0} step={1} placeholder="Points / unit" value={pts} onChange={e => setPts(e.target.value)} className="sm:w-32 h-9" />
        <Button onClick={add} size="sm" style={{ backgroundColor: PRIMARY }} className="h-9 hover:opacity-90 text-white">
          <Plus className="size-4 mr-1" /> Add
        </Button>
      </div>

      {rules.length > 4 && (
        <div className="relative mb-2">
          <Search className="absolute left-3 top-2.5 size-4 text-gray-400" />
          <Input placeholder="Filter products" value={q} onChange={e => setQ(e.target.value)} className="pl-9 h-9" />
        </div>
      )}

      {rules.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b text-xs text-gray-500">
                <th className="text-left px-3 py-2.5 font-medium">Product</th>
                <th className="text-left px-3 py-2.5 font-medium">SKU</th>
                <th className="text-center px-3 py-2.5 font-medium">Eligible</th>
                <th className="text-right px-3 py-2.5 font-medium">Points / unit</th>
                <th className="px-2 py-2.5 w-10" />
              </tr>
            </thead>
            <tbody>
              {shown.map(r => (
                <tr key={r.id} className={`border-b last:border-0 ${r.eligible ? '' : 'bg-gray-50 text-gray-400'}`}>
                  <td className="px-3 py-2 font-medium">{r.productName}</td>
                  <td className="px-3 py-2 text-xs font-mono">{r.sku || '—'}</td>
                  <td className="px-3 py-2 text-center"><Switch checked={r.eligible} onCheckedChange={v => update(r.id, { eligible: v })} /></td>
                  <td className="px-3 py-2 text-right">
                    {r.eligible
                      ? <Input type="number" min={0} step={1} value={r.pointsPerUnit} onChange={e => update(r.id, { pointsPerUnit: Math.max(0, Math.floor(Number(e.target.value))) })} className="h-8 w-20 ml-auto text-right" />
                      : <Badge variant="outline" className="text-gray-500">No points</Badge>}
                  </td>
                  <td className="px-2 py-2">
                    <Button variant="ghost" size="icon" className="size-7 hover:bg-red-50 hover:text-red-600" onClick={() => onChange(rules.filter(x => x.id !== r.id))}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Settings → Fraud Rules & Controls. */
export function FraudRulesSettings({ SectionHeader }: { SectionHeader: React.ComponentType<{ icon: React.ElementType; title: string; description: string }> }) {
  const [r, setR] = useState<FraudRules>(getFraudRules);
  const num = (k: keyof FraudRules, label: string, desc: string, unit: string) => (
    <div className="py-3 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-800">{label}</p>
        <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
      </div>
      <div className="sm:w-48 relative">
        <Input type="number" min={0} value={r[k] as number} onChange={e => setR({ ...r, [k]: Math.max(0, Number(e.target.value)) })} />
        <span className="absolute right-3 top-2.5 text-xs text-gray-400">{unit}</span>
      </div>
    </div>
  );
  return (
    <>
      <SectionHeader icon={ShieldAlert} title="Fraud Rules & Controls" description="Thresholds that raise fraud flags and cap redemptions" />
      <div className="space-y-1">
        {num('maxRedemptionsPerDay', 'Max redemptions per grower per day', 'More than this raises a flag and blocks further redemption that day', 'per day')}
        {num('highValueRedemption', 'High-value redemption', 'A single redemption above this is flagged as a fraud case', 'points')}
        {num('repeatedReturns', 'Repeated returns after earning', 'Returns within 30 days of earning points that raise a flag', 'returns')}
        <div className="py-3 flex items-center justify-between">
          <div>
            <Label className="text-sm font-medium text-gray-800">Dashboard alerts</Label>
            <p className="text-xs text-gray-500 mt-0.5">Show open fraud flags on Loyalty → Risk &amp; Fraud and the Overview</p>
          </div>
          <Switch checked={r.dashboardAlerts} onCheckedChange={v => setR({ ...r, dashboardAlerts: v })} />
        </div>
      </div>
      <Button className="mt-4 text-white hover:opacity-90" style={{ backgroundColor: PRIMARY }} onClick={() => { saveFraudRules(r); toast.success('Fraud rules saved'); }}>
        <Save className="size-4 mr-1.5" /> Save fraud rules
      </Button>
    </>
  );
}
