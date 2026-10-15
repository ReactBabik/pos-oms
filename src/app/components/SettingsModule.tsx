import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Label } from './ui/label';
import { Separator } from './ui/separator';
import { Switch } from './ui/switch';
import {
  Store, Receipt, Printer, DollarSign, Bell, Shield, Database,
  Download, Upload, Save, RefreshCw, Percent, Clock, Phone,
  MapPin, Mail, FileText, ShoppingCart, Users, Award, Star,
  AlertCircle, UserX, Gift, Plus, Trash2, ChevronRight,
  CreditCard, Settings2, Package, Eye, Copy, Calendar, CheckCircle,
  XCircle
} from 'lucide-react';
import { toast } from 'sonner';

const PRIMARY = '#C7359C';

// ── Nav sections ─────────────────────────────────────────────────────────────
type Section =
  | 'store' | 'pos' | 'receipt'
  | 'loyalty' | 'credit' | 'segments' | 'notifications';

const NAV: { key: Section; label: string; icon: React.ElementType; description: string }[] = [
  { key: 'store',         label: 'Store Information',       icon: Store,       description: 'Business details & contact info' },
  { key: 'pos',           label: 'POS & Display',           icon: ShoppingCart,description: 'Point of sale display preferences' },
  { key: 'receipt',       label: 'Receipt & Printing',      icon: Receipt,     description: 'Receipt content and print options' },
  { key: 'loyalty',       label: 'Loyalty Program',         icon: Gift,        description: 'Points earning & redemption rules' },
  { key: 'credit',        label: 'Credit Management',       icon: CreditCard,  description: 'Credit policy and overdue settings' },
  { key: 'segments',      label: 'Customer Segments',       icon: Users,       description: 'Segment classification criteria' },
  { key: 'notifications', label: 'Notifications & Alerts',  icon: Bell,        description: 'Stock, expiry and sales alerts' },
];

// ── Row helper ────────────────────────────────────────────────────────────────
function ToggleRow({ id, label, description, checked, onCheckedChange }: {
  id: string; label: string; description?: string;
  checked: boolean; onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <div>
        <Label htmlFor={id} className="text-sm font-medium text-gray-800 cursor-pointer">{label}</Label>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function FieldRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="py-3 border-b border-gray-100 last:border-0">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-800">{label}</p>
          {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
        </div>
        <div className="sm:w-64 flex-shrink-0">{children}</div>
      </div>
    </div>
  );
}

function SectionHeader({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
  return (
    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
      <div className="p-2.5 rounded-xl" style={{ backgroundColor: `${PRIMARY}18` }}>
        <Icon className="size-5" style={{ color: PRIMARY }} />
      </div>
      <div>
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
    </div>
  );
}

interface ProductLoyaltyOverride {
  id: string;
  productName: string;
  pointsPerUnit: number;
}

interface LoyaltyProgram {
  id: string;
  name: string;
  fromDate: string;
  toDate: string;
  active: boolean;
  createdAt: string;
  standardPointsPerRs: number;
  minPurchaseForPoints: number;
  pointsValidityDays: number;
  redemptionRate: number;
  minPointsToRedeem: number;
  maxRedemptionPct: number;
  showBalanceOnReceipt: boolean;
  notifyOnEarning: boolean;
  productOverrides: ProductLoyaltyOverride[];
}

const EMPTY_PROGRAM: Omit<LoyaltyProgram, 'id' | 'createdAt' | 'active'> = {
  name: '',
  fromDate: '',
  toDate: '',
  standardPointsPerRs: 1,
  minPurchaseForPoints: 100,
  pointsValidityDays: 365,
  redemptionRate: 0.5,
  minPointsToRedeem: 100,
  maxRedemptionPct: 20,
  showBalanceOnReceipt: true,
  notifyOnEarning: true,
  productOverrides: [],
};

export function SettingsModule() {
  const [activeSection, setActiveSection] = useState<Section>('store');

  // ── Store ─────────────────────────────────────────────────────────────────
  const [storeInfo, setStoreInfo] = useState({
    name: 'Naya Savera Agro Store',
    phone: '+92 300 1234567',
    email: 'contact@nayasavera.pk',
    address: 'Main Bazar, Village Name, District, Pakistan',
    taxId: 'NTN-1234567-8',
  });

  // ── Tax ───────────────────────────────────────────────────────────────────
  const [taxSettings, setTaxSettings] = useState({ enableTax: true, taxRate: 17, taxLabel: 'GST' });

  // ── Receipt ───────────────────────────────────────────────────────────────
  const [receiptSettings, setReceiptSettings] = useState({
    showLogo: true, showTaxId: true,
    footerMessage: 'Thank you for your business!',
    printAutomatically: false, smsReceipt: true,
  });

  // ── POS ───────────────────────────────────────────────────────────────────
  const [posSettings, setPosSettings] = useState(() => {
    const saved = localStorage.getItem('posDisplaySettings');
    return saved ? JSON.parse(saved) : { showOutOfStock: false, currency: 'PKR', currencySymbol: 'PKR', currencyPosition: 'before' };
  });

  // ── Loyalty Programs ──────────────────────────────────────────────────────
  const [loyaltyPrograms, setLoyaltyPrograms] = useState<LoyaltyProgram[]>(() => {
    const saved = localStorage.getItem('loyaltyPrograms');
    if (saved) return JSON.parse(saved);
    // Migrate legacy single loyaltySettings if present
    const legacy = localStorage.getItem('loyaltySettings');
    if (legacy) {
      const s = JSON.parse(legacy);
      const migrated: LoyaltyProgram = {
        id: 'prog-legacy',
        name: 'Default Program',
        fromDate: '',
        toDate: '',
        active: s.enabled ?? true,
        createdAt: new Date().toISOString(),
        standardPointsPerRs: s.standardPointsPerRs ?? 1,
        minPurchaseForPoints: s.minPurchaseForPoints ?? 100,
        pointsValidityDays: s.pointsValidityDays ?? 365,
        redemptionRate: s.redemptionRate ?? 0.5,
        minPointsToRedeem: s.minPointsToRedeem ?? 100,
        maxRedemptionPct: s.maxRedemptionPct ?? 20,
        showBalanceOnReceipt: s.showBalanceOnReceipt ?? true,
        notifyOnEarning: s.notifyOnEarning ?? true,
        productOverrides: JSON.parse(localStorage.getItem('loyaltyProductOverrides') ?? '[]'),
      };
      return [migrated];
    }
    return [];
  });
  // UI state for the loyalty sub-screen
  type LoyaltyView = 'list' | 'form' | 'view';
  const [loyaltyView, setLoyaltyView] = useState<LoyaltyView>('list');
  const [loyaltyFormData, setLoyaltyFormData] = useState<Omit<LoyaltyProgram, 'id' | 'createdAt' | 'active'>>(EMPTY_PROGRAM);
  const [loyaltyViewProgram, setLoyaltyViewProgram] = useState<LoyaltyProgram | null>(null);
  const [loyaltyFormOverride, setLoyaltyFormOverride] = useState({ productName: '', pointsPerUnit: '' });

  // Keep legacy loyaltySettings key in sync so POSMain / CampaignModule continue to work
  const syncLegacySettings = (programs: LoyaltyProgram[]) => {
    const active = programs.find(p => p.active);
    if (active) {
      localStorage.setItem('loyaltySettings', JSON.stringify({
        enabled: true,
        standardPointsPerRs: active.standardPointsPerRs,
        minPurchaseForPoints: active.minPurchaseForPoints,
        pointsValidityDays: active.pointsValidityDays,
        redemptionRate: active.redemptionRate,
        minPointsToRedeem: active.minPointsToRedeem,
        maxRedemptionPct: active.maxRedemptionPct,
        showBalanceOnReceipt: active.showBalanceOnReceipt,
        notifyOnEarning: active.notifyOnEarning,
      }));
      localStorage.setItem('loyaltyProductOverrides', JSON.stringify(active.productOverrides));
    } else {
      localStorage.setItem('loyaltySettings', JSON.stringify({ enabled: false }));
    }
  };

  // Loyalty form helpers
  const loyaltyAddOverride = () => {
    if (!loyaltyFormOverride.productName.trim() || !loyaltyFormOverride.pointsPerUnit) {
      toast.error('Enter product name and points per unit'); return;
    }
    setLoyaltyFormData(prev => ({
      ...prev,
      productOverrides: [...prev.productOverrides, {
        id: Date.now().toString(),
        productName: loyaltyFormOverride.productName.trim(),
        pointsPerUnit: parseFloat(loyaltyFormOverride.pointsPerUnit),
      }],
    }));
    setLoyaltyFormOverride({ productName: '', pointsPerUnit: '' });
  };

  const loyaltyRemoveOverride = (id: string) => {
    setLoyaltyFormData(prev => ({ ...prev, productOverrides: prev.productOverrides.filter(o => o.id !== id) }));
  };

  const loyaltySaveProgram = (makeActive: boolean) => {
    if (!loyaltyFormData.name.trim()) { toast.error('Program name is required'); return; }
    if (!loyaltyFormData.fromDate) { toast.error('Start date is required'); return; }

    const newProg: LoyaltyProgram = {
      ...loyaltyFormData,
      id: `prog-${Date.now()}`,
      createdAt: new Date().toISOString(),
      active: makeActive,
    };

    setLoyaltyPrograms(prev => {
      // If making active, deactivate all others
      const updated = makeActive ? prev.map(p => ({ ...p, active: false })) : [...prev];
      const final = [...updated, newProg];
      localStorage.setItem('loyaltyPrograms', JSON.stringify(final));
      syncLegacySettings(final);
      return final;
    });
    setLoyaltyView('list');
    setLoyaltyFormData(EMPTY_PROGRAM);
    toast.success(makeActive ? 'Loyalty program created and activated' : 'Loyalty program saved as inactive');
  };

  const loyaltyDeactivate = (id: string) => {
    setLoyaltyPrograms(prev => {
      const updated = prev.map(p => p.id === id ? { ...p, active: false } : p);
      localStorage.setItem('loyaltyPrograms', JSON.stringify(updated));
      syncLegacySettings(updated);
      return updated;
    });
    toast.success('Loyalty program deactivated');
  };

  const loyaltyDuplicate = (prog: LoyaltyProgram) => {
    setLoyaltyFormData({
      name: `${prog.name} (Copy)`,
      fromDate: '',
      toDate: '',
      standardPointsPerRs: prog.standardPointsPerRs,
      minPurchaseForPoints: prog.minPurchaseForPoints,
      pointsValidityDays: prog.pointsValidityDays,
      redemptionRate: prog.redemptionRate,
      minPointsToRedeem: prog.minPointsToRedeem,
      maxRedemptionPct: prog.maxRedemptionPct,
      showBalanceOnReceipt: prog.showBalanceOnReceipt,
      notifyOnEarning: prog.notifyOnEarning,
      productOverrides: prog.productOverrides.map(o => ({ ...o, id: Date.now().toString() + Math.random() })),
    });
    setLoyaltyView('form');
  };


  // ── Credit ────────────────────────────────────────────────────────────────
  const [creditSettings, setCreditSettings] = useState(() => {
    const saved = localStorage.getItem('creditSettings');
    return saved ? JSON.parse(saved) : { overdueDays: '30' };
  });

  // ── Notifications ─────────────────────────────────────────────────────────
  const [notificationSettings, setNotificationSettings] = useState({
    lowStockAlerts: true, lowStockThreshold: 10,
    expiryAlerts: true, expiryDaysBefore: 30, salesNotifications: true,
  });

  // ── System ────────────────────────────────────────────────────────────────
  const [systemSettings, setSystemSettings] = useState({
    autoBackup: true, backupFrequency: 'daily', offlineMode: true,
  });

  // ── Segments ──────────────────────────────────────────────────────────────
  const [segmentSettings, setSegmentSettings] = useState(() => {
    const saved = localStorage.getItem('customerSegmentSettings');
    return saved ? JSON.parse(saved) : {
      vipMinSpend: '100000', vipMinOrders: '10',
      regularMinVisitsPerMonth: '2', newMaxPurchases: '3',
      atRiskMinDays: '30', atRiskMaxDays: '90', inactiveDays: '90',
    };
  });

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = () => {
    const { atRiskMinDays, atRiskMaxDays, vipMinSpend, vipMinOrders,
      regularMinVisitsPerMonth, newMaxPurchases, inactiveDays } = segmentSettings;
    const errors: string[] = [];
    if (parseInt(atRiskMinDays) >= parseInt(atRiskMaxDays))
      errors.push('At Risk Max Days must be greater than Min Days');
    if (parseInt(vipMinSpend) < 0) errors.push('VIP Min Spend must be ≥ 0');
    if (parseInt(vipMinOrders) < 1) errors.push('VIP Min Orders must be ≥ 1');
    if (errors.length) { errors.forEach(e => toast.error(e)); return; }

    localStorage.setItem('posDisplaySettings', JSON.stringify(posSettings));
    localStorage.setItem('creditSettings', JSON.stringify(creditSettings));
    localStorage.setItem('loyaltyPrograms', JSON.stringify(loyaltyPrograms));
    syncLegacySettings(loyaltyPrograms);
    localStorage.setItem('customerSegmentSettings', JSON.stringify({
      vipMinSpend: parseInt(vipMinSpend), vipMinOrders: parseInt(vipMinOrders),
      regularMinVisitsPerMonth: parseInt(regularMinVisitsPerMonth),
      newMaxPurchases: parseInt(newMaxPurchases),
      atRiskMinDays: parseInt(atRiskMinDays), atRiskMaxDays: parseInt(atRiskMaxDays),
      inactiveDays: parseInt(inactiveDays),
    }));
    toast.success('Settings saved successfully');
  };

  const handleExport = () => {
    const data = { storeInfo, taxSettings, receiptSettings, posSettings, loyaltyPrograms, creditSettings, notificationSettings, systemSettings, segmentSettings, exportDate: new Date().toISOString() };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    a.download = `naya-savera-settings-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    toast.success('Settings exported');
  };

  const handleReset = () => {
    if (!confirm('Reset all settings to defaults? This cannot be undone.')) return;
    localStorage.removeItem('posDisplaySettings');
    localStorage.removeItem('creditSettings');
    localStorage.removeItem('loyaltySettings');
    localStorage.removeItem('loyaltyProductOverrides');
    localStorage.removeItem('loyaltyPrograms');
    localStorage.removeItem('customerSegmentSettings');
    window.location.reload();
  };


  // ── Section content ───────────────────────────────────────────────────────
  const renderSection = () => {
    switch (activeSection) {

      case 'store':
        return (
          <>
            <SectionHeader icon={Store} title="Store Information" description="Your business details shown on receipts and reports" />
            <div className="space-y-0">
              <FieldRow label="Store Name">
                <Input value={storeInfo.name} onChange={e => setStoreInfo({ ...storeInfo, name: e.target.value })} />
              </FieldRow>
              <FieldRow label="Phone Number">
                <Input value={storeInfo.phone} onChange={e => setStoreInfo({ ...storeInfo, phone: e.target.value })} />
              </FieldRow>
              <FieldRow label="Email Address">
                <Input type="email" value={storeInfo.email} onChange={e => setStoreInfo({ ...storeInfo, email: e.target.value })} />
              </FieldRow>
              <FieldRow label="Tax ID / NTN">
                <Input value={storeInfo.taxId} onChange={e => setStoreInfo({ ...storeInfo, taxId: e.target.value })} />
              </FieldRow>
              <FieldRow label="Business Address" description="Printed on customer receipts">
                <Input value={storeInfo.address} onChange={e => setStoreInfo({ ...storeInfo, address: e.target.value })} />
              </FieldRow>
            </div>
          </>
        );

      case 'pos':
        return (
          <>
            <SectionHeader icon={ShoppingCart} title="POS & Display" description="Configure the point-of-sale screen behaviour" />
            <ToggleRow id="showOutOfStock" label="Show Out-of-Stock Products"
              description="Display products with zero inventory on the POS screen"
              checked={posSettings.showOutOfStock}
              onCheckedChange={v => { const s = { ...posSettings, showOutOfStock: v }; setPosSettings(s); localStorage.setItem('posDisplaySettings', JSON.stringify(s)); }} />
            <div className="pt-4">
              <p className="text-sm font-semibold text-gray-700 mb-3">Currency Display</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Currency Code</Label>
                  <Input value={posSettings.currency} onChange={e => setPosSettings({ ...posSettings, currency: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Symbol</Label>
                  <Input value={posSettings.currencySymbol} onChange={e => setPosSettings({ ...posSettings, currencySymbol: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Position</Label>
                  <select value={posSettings.currencyPosition}
                    onChange={e => setPosSettings({ ...posSettings, currencyPosition: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value="before">Before (PKR 1,000)</option>
                    <option value="after">After (1,000 PKR)</option>
                  </select>
                </div>
              </div>
              <div className="mt-3 p-3 rounded-lg border" style={{ backgroundColor: `${PRIMARY}08`, borderColor: `${PRIMARY}30` }}>
                <p className="text-xs text-gray-500 mb-0.5">Preview</p>
                <p className="text-lg font-bold" style={{ color: PRIMARY }}>
                  {posSettings.currencyPosition === 'before' ? `${posSettings.currencySymbol} 1,234` : `1,234 ${posSettings.currencySymbol}`}
                </p>
              </div>
            </div>
          </>
        );

      case 'receipt':
        return (
          <>
            <SectionHeader icon={Receipt} title="Receipt & Printing" description="Customise what appears on customer receipts" />
            <ToggleRow id="showLogo" label="Show Store Logo" description="Display your logo at the top of receipts"
              checked={receiptSettings.showLogo} onCheckedChange={v => setReceiptSettings({ ...receiptSettings, showLogo: v })} />
            <ToggleRow id="showTaxId" label="Show Tax ID / NTN" description="Print NTN number on receipt"
              checked={receiptSettings.showTaxId} onCheckedChange={v => setReceiptSettings({ ...receiptSettings, showTaxId: v })} />
            <ToggleRow id="printAuto" label="Auto Print After Checkout" description="Automatically send to printer on sale completion"
              checked={receiptSettings.printAutomatically} onCheckedChange={v => setReceiptSettings({ ...receiptSettings, printAutomatically: v })} />
            <ToggleRow id="smsReceipt" label="SMS Receipt" description="Send receipt to customer via SMS"
              checked={receiptSettings.smsReceipt} onCheckedChange={v => setReceiptSettings({ ...receiptSettings, smsReceipt: v })} />
            <FieldRow label="Footer Message" description="Custom message printed at the bottom of receipts">
              <Input value={receiptSettings.footerMessage}
                onChange={e => setReceiptSettings({ ...receiptSettings, footerMessage: e.target.value })}
                placeholder="Thank you for your business!" />
            </FieldRow>
          </>
        );

      case 'loyalty': {
        // ── VIEW: Program details (read-only) ─────────────────────────────
        if (loyaltyView === 'view' && loyaltyViewProgram) {
          const vp = loyaltyViewProgram;
          return (
            <>
              <div className="flex items-center gap-3 mb-6">
                <Button variant="ghost" size="sm" onClick={() => { setLoyaltyView('list'); setLoyaltyViewProgram(null); }}
                  className="text-gray-500 hover:text-gray-800 -ml-2">
                  ← Back
                </Button>
                <SectionHeader icon={Gift} title={vp.name} description="Program details (read-only)" />
              </div>

              <div className="space-y-4 max-w-2xl">
                <div className="grid grid-cols-2 gap-4 p-4 rounded-xl border bg-gray-50">
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Status</p>
                    {vp.active
                      ? <Badge className="bg-green-100 text-green-700 border-green-200"><CheckCircle className="size-3 mr-1" />Active</Badge>
                      : <Badge variant="outline" className="text-gray-500"><XCircle className="size-3 mr-1" />Inactive</Badge>}
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Created</p>
                    <p className="text-sm font-medium">{new Date(vp.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">From Date</p>
                    <p className="text-sm font-medium">{vp.fromDate || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">To Date</p>
                    <p className="text-sm font-medium">{vp.toDate || '—'}</p>
                  </div>
                </div>

                <Separator />
                <p className="text-sm font-semibold text-gray-800">Earning Rules</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg border bg-gray-50">
                    <p className="text-xs text-gray-400">Points per Rs Spent</p>
                    <p className="text-lg font-bold" style={{ color: PRIMARY }}>{vp.standardPointsPerRs} pts</p>
                  </div>
                  <div className="p-3 rounded-lg border bg-gray-50">
                    <p className="text-xs text-gray-400">Min Purchase to Earn</p>
                    <p className="text-lg font-bold text-gray-800">Rs {vp.minPurchaseForPoints.toLocaleString()}</p>
                  </div>
                  <div className="p-3 rounded-lg border bg-gray-50">
                    <p className="text-xs text-gray-400">Points Validity</p>
                    <p className="text-lg font-bold text-gray-800">{vp.pointsValidityDays} days</p>
                  </div>
                </div>

                <Separator />
                <p className="text-sm font-semibold text-gray-800">Redemption Rules</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg border bg-gray-50">
                    <p className="text-xs text-gray-400">Rs Value per Point</p>
                    <p className="text-lg font-bold" style={{ color: PRIMARY }}>Rs {vp.redemptionRate}</p>
                  </div>
                  <div className="p-3 rounded-lg border bg-gray-50">
                    <p className="text-xs text-gray-400">Min Points to Redeem</p>
                    <p className="text-lg font-bold text-gray-800">{vp.minPointsToRedeem} pts</p>
                  </div>
                  <div className="p-3 rounded-lg border bg-gray-50">
                    <p className="text-xs text-gray-400">Max Redemption % of Bill</p>
                    <p className="text-lg font-bold text-gray-800">{vp.maxRedemptionPct}%</p>
                  </div>
                </div>

                {vp.productOverrides.length > 0 && (
                  <>
                    <Separator />
                    <p className="text-sm font-semibold text-gray-800">Product Overrides</p>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 border-b text-xs text-gray-500">
                            <th className="text-left px-4 py-2.5 font-medium">Product</th>
                            <th className="text-right px-4 py-2.5 font-medium">Points/Unit</th>
                          </tr>
                        </thead>
                        <tbody>
                          {vp.productOverrides.map(o => (
                            <tr key={o.id} className="border-b last:border-0">
                              <td className="px-4 py-2.5 text-gray-800">{o.productName}</td>
                              <td className="px-4 py-2.5 text-right">
                                <Badge variant="outline" style={{ borderColor: `${PRIMARY}40`, color: PRIMARY }}>{o.pointsPerUnit} pts</Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                <div className="flex gap-2 pt-2">
                  <Button variant="outline" size="sm" onClick={() => loyaltyDuplicate(vp)}>
                    <Copy className="size-3.5 mr-1.5" /> Duplicate as New
                  </Button>
                </div>
              </div>
            </>
          );
        }

        // ── VIEW: New program form ─────────────────────────────────────────
        if (loyaltyView === 'form') {
          const fd = loyaltyFormData;
          const setFd = (patch: Partial<typeof loyaltyFormData>) => setLoyaltyFormData(prev => ({ ...prev, ...patch }));
          return (
            <>
              <div className="flex items-center gap-3 mb-2">
                <Button variant="ghost" size="sm" onClick={() => { setLoyaltyView('list'); setLoyaltyFormData(EMPTY_PROGRAM); }}
                  className="text-gray-500 hover:text-gray-800 -ml-2">
                  ← Back
                </Button>
              </div>
              <SectionHeader icon={Gift} title="New Loyalty Program" description="Configure earning and redemption rules for this program" />

              <div className="space-y-6 max-w-2xl">
                {/* Identity */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Program Name *</Label>
                  <Input placeholder="e.g. Summer Harvest 2026" value={fd.name}
                    onChange={e => setFd({ name: e.target.value })} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium flex items-center gap-1">
                      <Calendar className="size-3" /> Start Date *
                    </Label>
                    <Input type="date" value={fd.fromDate} onChange={e => setFd({ fromDate: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium flex items-center gap-1">
                      <Calendar className="size-3" /> End Date (optional)
                    </Label>
                    <Input type="date" value={fd.toDate} onChange={e => setFd({ toDate: e.target.value })} />
                  </div>
                </div>

                <Separator />

                {/* Earning */}
                <div>
                  <p className="text-sm font-semibold text-gray-800 mb-1">Earning Rules</p>
                  <p className="text-xs text-gray-500 mb-4">How customers earn points on purchases</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Standard Points per Rs Spent</Label>
                      <div className="relative">
                        <Input type="number" step="0.1" min="0" value={fd.standardPointsPerRs}
                          onChange={e => setFd({ standardPointsPerRs: parseFloat(e.target.value) })} />
                        <span className="absolute right-3 top-2.5 text-xs text-gray-400">pts / Rs</span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Min Purchase to Earn (Rs)</Label>
                      <Input type="number" min="0" value={fd.minPurchaseForPoints}
                        onChange={e => setFd({ minPurchaseForPoints: parseInt(e.target.value) })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Points Validity (Days)</Label>
                      <Input type="number" min="1" value={fd.pointsValidityDays}
                        onChange={e => setFd({ pointsValidityDays: parseInt(e.target.value) })} />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Redemption */}
                <div>
                  <p className="text-sm font-semibold text-gray-800 mb-1">Redemption Rules</p>
                  <p className="text-xs text-gray-500 mb-4">Rate at which customers redeem points</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Rs Value per Point Redeemed</Label>
                      <div className="relative">
                        <Input type="number" step="0.01" min="0" value={fd.redemptionRate}
                          onChange={e => setFd({ redemptionRate: parseFloat(e.target.value) })} />
                        <span className="absolute right-3 top-2.5 text-xs text-gray-400">Rs / pt</span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Min Points to Redeem</Label>
                      <Input type="number" min="1" value={fd.minPointsToRedeem}
                        onChange={e => setFd({ minPointsToRedeem: parseInt(e.target.value) })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Max Redemption % of Bill</Label>
                      <div className="relative">
                        <Input type="number" min="1" max="100" value={fd.maxRedemptionPct}
                          onChange={e => setFd({ maxRedemptionPct: parseInt(e.target.value) })} />
                        <span className="absolute right-3 top-2.5 text-xs text-gray-400">%</span>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Notifications */}
                <div>
                  <p className="text-sm font-semibold text-gray-800 mb-3">Notifications</p>
                  <ToggleRow id="lpShowBalance" label="Show Points Balance on Receipt"
                    description="Print current balance and amount earned on each receipt"
                    checked={fd.showBalanceOnReceipt}
                    onCheckedChange={v => setFd({ showBalanceOnReceipt: v })} />
                  <ToggleRow id="lpNotifyEarn" label="Notify Customer on Points Earned"
                    description="Show a notification at checkout when points are added"
                    checked={fd.notifyOnEarning}
                    onCheckedChange={v => setFd({ notifyOnEarning: v })} />
                </div>

                <Separator />

                {/* Product overrides */}
                <div>
                  <p className="text-sm font-semibold text-gray-800 mb-1">Product-level Earning Overrides</p>
                  <p className="text-xs text-gray-500 mb-4">Override the standard rate for specific products.</p>
                  {fd.productOverrides.length > 0 && (
                    <div className="border rounded-lg overflow-hidden mb-4">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 border-b text-xs text-gray-500">
                            <th className="text-left px-4 py-2.5 font-medium">Product Name</th>
                            <th className="text-right px-4 py-2.5 font-medium">Points/Unit</th>
                            <th className="px-3 py-2.5 w-10" />
                          </tr>
                        </thead>
                        <tbody>
                          {fd.productOverrides.map(o => (
                            <tr key={o.id} className="border-b last:border-0 hover:bg-gray-50">
                              <td className="px-4 py-2.5 font-medium text-gray-800">{o.productName}</td>
                              <td className="px-4 py-2.5 text-right">
                                <Badge variant="outline" style={{ borderColor: `${PRIMARY}40`, color: PRIMARY }}>{o.pointsPerUnit} pts</Badge>
                              </td>
                              <td className="px-3 py-2.5">
                                <Button variant="ghost" size="icon" className="size-7 hover:bg-red-50 hover:text-red-600"
                                  onClick={() => loyaltyRemoveOverride(o.id)}>
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Input placeholder="Product name" value={loyaltyFormOverride.productName}
                      onChange={e => setLoyaltyFormOverride({ ...loyaltyFormOverride, productName: e.target.value })}
                      className="flex-1" />
                    <Input type="number" placeholder="Points/unit" value={loyaltyFormOverride.pointsPerUnit}
                      onChange={e => setLoyaltyFormOverride({ ...loyaltyFormOverride, pointsPerUnit: e.target.value })}
                      className="w-36" />
                    <Button onClick={loyaltyAddOverride} size="sm" style={{ backgroundColor: PRIMARY }} className="hover:opacity-90 text-white">
                      <Plus className="size-4 mr-1" /> Add
                    </Button>
                  </div>
                </div>

                {/* Save actions */}
                <div className="flex gap-2 pt-2 border-t">
                  <Button onClick={() => loyaltySaveProgram(true)}
                    style={{ backgroundColor: PRIMARY }} className="hover:opacity-90 text-white">
                    <CheckCircle className="size-4 mr-1.5" /> Save & Activate
                  </Button>
                  <Button variant="outline" onClick={() => loyaltySaveProgram(false)}>
                    <Save className="size-4 mr-1.5" /> Save as Inactive
                  </Button>
                  <Button variant="ghost" onClick={() => { setLoyaltyView('list'); setLoyaltyFormData(EMPTY_PROGRAM); }}
                    className="text-gray-500 ml-auto">
                    Cancel
                  </Button>
                </div>
              </div>
            </>
          );
        }

        // ── VIEW: Program listing (default) ───────────────────────────────
        return (
          <>
            <div className="flex items-center justify-between mb-6 pb-4 border-b">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl" style={{ backgroundColor: `${PRIMARY}18` }}>
                  <Gift className="size-5" style={{ color: PRIMARY }} />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Loyalty Programs</h3>
                  <p className="text-xs text-gray-500">Only one program can be active at a time. Inactive programs are kept for history.</p>
                </div>
              </div>
              <Button size="sm" style={{ backgroundColor: PRIMARY }} className="hover:opacity-90 text-white"
                onClick={() => { setLoyaltyFormData(EMPTY_PROGRAM); setLoyaltyView('form'); }}>
                <Plus className="size-4 mr-1.5" /> New Program
              </Button>
            </div>

            {loyaltyPrograms.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Gift className="size-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">No loyalty programs yet</p>
                <p className="text-xs mt-1">Create your first program to start rewarding customers</p>
                <Button size="sm" className="mt-4" style={{ backgroundColor: PRIMARY }}
                  onClick={() => { setLoyaltyFormData(EMPTY_PROGRAM); setLoyaltyView('form'); }}>
                  <Plus className="size-4 mr-1.5" /> Create First Program
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {loyaltyPrograms.map(prog => (
                  <div key={prog.id}
                    className={`rounded-xl border p-4 flex items-start gap-4 ${prog.active ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-white'}`}>
                    {/* Status icon */}
                    <div className="mt-0.5 flex-shrink-0">
                      {prog.active
                        ? <CheckCircle className="size-5 text-green-600" />
                        : <XCircle className="size-5 text-gray-300" />}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900 text-sm">{prog.name}</span>
                        {prog.active
                          ? <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">Active</Badge>
                          : <Badge variant="outline" className="text-gray-400 text-xs">Inactive</Badge>}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-gray-500 flex-wrap">
                        {(prog.fromDate || prog.toDate) && (
                          <span className="flex items-center gap-1">
                            <Calendar className="size-3" />
                            {prog.fromDate || '—'} → {prog.toDate || 'ongoing'}
                          </span>
                        )}
                        <span>{prog.standardPointsPerRs} pts/Rs</span>
                        <span>Redeem @ Rs {prog.redemptionRate}/pt</span>
                        {prog.productOverrides.length > 0 && (
                          <span>{prog.productOverrides.length} overrides</span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button variant="ghost" size="sm" className="text-gray-500 hover:text-gray-800"
                        onClick={() => { setLoyaltyViewProgram(prog); setLoyaltyView('view'); }}>
                        <Eye className="size-4 mr-1" /> View
                      </Button>
                      <Button variant="ghost" size="sm" className="text-gray-500 hover:text-gray-800"
                        onClick={() => loyaltyDuplicate(prog)}>
                        <Copy className="size-4 mr-1" /> Duplicate
                      </Button>
                      {prog.active && (
                        <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => loyaltyDeactivate(prog.id)}>
                          <XCircle className="size-4 mr-1" /> Deactivate
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        );
      }

      case 'credit':
        return (
          <>
            <SectionHeader icon={CreditCard} title="Credit Management" description="Configure credit policies and overdue thresholds" />
            <FieldRow label="Overdue Period (Days)" description="Credit transactions older than this will be flagged as overdue">
              <Input type="number" value={creditSettings.overdueDays}
                onChange={e => setCreditSettings({ ...creditSettings, overdueDays: e.target.value })} />
            </FieldRow>
            <div className="mt-4 p-3 rounded-lg border text-sm" style={{ backgroundColor: `${PRIMARY}08`, borderColor: `${PRIMARY}30` }}>
              Credit transactions older than <span className="font-bold" style={{ color: PRIMARY }}>{creditSettings.overdueDays} days</span> will be marked as overdue.
            </div>
          </>
        );

      case 'segments':
        return (
          <>
            <SectionHeader icon={Users} title="Customer Segments" description="Define criteria for automatic customer classification" />
            <div className="space-y-4">
              {/* VIP */}
              <div className="p-4 rounded-xl border-l-4 border border-purple-200 bg-purple-50" style={{ borderLeftColor: '#8b5cf6' }}>
                <div className="flex items-center gap-2 mb-3">
                  <Award className="size-4 text-purple-600" />
                  <p className="font-semibold text-purple-900 text-sm">VIP Customers</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Min Total Spend (PKR)</Label>
                    <Input type="number" value={segmentSettings.vipMinSpend}
                      onChange={e => setSegmentSettings({ ...segmentSettings, vipMinSpend: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Min Orders</Label>
                    <Input type="number" value={segmentSettings.vipMinOrders}
                      onChange={e => setSegmentSettings({ ...segmentSettings, vipMinOrders: e.target.value })} />
                  </div>
                </div>
              </div>
              {/* Regular */}
              <div className="p-4 rounded-xl border-l-4 border border-blue-200 bg-blue-50" style={{ borderLeftColor: '#3b82f6' }}>
                <div className="flex items-center gap-2 mb-3">
                  <Users className="size-4 text-blue-600" />
                  <p className="font-semibold text-blue-900 text-sm">Regular Customers</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Min Visits per Month</Label>
                  <Input type="number" value={segmentSettings.regularMinVisitsPerMonth}
                    onChange={e => setSegmentSettings({ ...segmentSettings, regularMinVisitsPerMonth: e.target.value })} />
                </div>
              </div>
              {/* New */}
              <div className="p-4 rounded-xl border-l-4 border border-green-200 bg-green-50" style={{ borderLeftColor: '#10b981' }}>
                <div className="flex items-center gap-2 mb-3">
                  <Star className="size-4 text-green-600" />
                  <p className="font-semibold text-green-900 text-sm">New Customers</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Max Purchases to be Considered New</Label>
                  <Input type="number" value={segmentSettings.newMaxPurchases}
                    onChange={e => setSegmentSettings({ ...segmentSettings, newMaxPurchases: e.target.value })} />
                </div>
              </div>
              {/* At Risk */}
              <div className="p-4 rounded-xl border-l-4 border border-orange-200 bg-orange-50" style={{ borderLeftColor: '#f59e0b' }}>
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle className="size-4 text-orange-600" />
                  <p className="font-semibold text-orange-900 text-sm">At Risk Customers</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Min Days Since Last Purchase</Label>
                    <Input type="number" value={segmentSettings.atRiskMinDays}
                      onChange={e => setSegmentSettings({ ...segmentSettings, atRiskMinDays: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Max Days Since Last Purchase</Label>
                    <Input type="number" value={segmentSettings.atRiskMaxDays}
                      onChange={e => setSegmentSettings({ ...segmentSettings, atRiskMaxDays: e.target.value })} />
                  </div>
                </div>
              </div>
              {/* Inactive */}
              <div className="p-4 rounded-xl border-l-4 border border-gray-200 bg-gray-50" style={{ borderLeftColor: '#9ca3af' }}>
                <div className="flex items-center gap-2 mb-3">
                  <UserX className="size-4 text-gray-500" />
                  <p className="font-semibold text-gray-800 text-sm">Inactive Customers</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Inactive After (Days)</Label>
                  <Input type="number" value={segmentSettings.inactiveDays}
                    onChange={e => setSegmentSettings({ ...segmentSettings, inactiveDays: e.target.value })} />
                </div>
              </div>
            </div>
          </>
        );

      case 'notifications':
        return (
          <>
            <SectionHeader icon={Bell} title="Notifications & Alerts" description="Configure stock, expiry and sales alerts" />
            <ToggleRow id="lowStockAlerts" label="Low Stock Alerts" description="Get notified when inventory drops below threshold"
              checked={notificationSettings.lowStockAlerts}
              onCheckedChange={v => setNotificationSettings({ ...notificationSettings, lowStockAlerts: v })} />
            {notificationSettings.lowStockAlerts && (
              <FieldRow label="Low Stock Threshold" description="Alert when any product falls below this quantity">
                <Input type="number" value={notificationSettings.lowStockThreshold}
                  onChange={e => setNotificationSettings({ ...notificationSettings, lowStockThreshold: parseInt(e.target.value) })} />
              </FieldRow>
            )}
            <ToggleRow id="expiryAlerts" label="Expiry Alerts" description="Alert for products approaching expiry date"
              checked={notificationSettings.expiryAlerts}
              onCheckedChange={v => setNotificationSettings({ ...notificationSettings, expiryAlerts: v })} />
            {notificationSettings.expiryAlerts && (
              <FieldRow label="Alert Days Before Expiry">
                <Input type="number" value={notificationSettings.expiryDaysBefore}
                  onChange={e => setNotificationSettings({ ...notificationSettings, expiryDaysBefore: parseInt(e.target.value) })} />
              </FieldRow>
            )}
            <ToggleRow id="salesNotifications" label="Daily Sales Summary" description="Receive a daily summary of sales performance"
              checked={notificationSettings.salesNotifications}
              onCheckedChange={v => setNotificationSettings({ ...notificationSettings, salesNotifications: v })} />
          </>
        );

    }
  };

  const activeNav = NAV.find(n => n.key === activeSection)!;

  return (
    <div className="p-3 lg:p-0">
      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-xl lg:text-2xl font-bold text-gray-900 pl-2">System Settings</h2>
          <p className="text-sm text-gray-500 pl-2 mt-0.5">Manage your store configuration and preferences</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="size-4 mr-2" /> Export
          </Button>
          <Button size="sm" onClick={handleSave} style={{ backgroundColor: PRIMARY }} className="text-white hover:opacity-90">
            <Save className="size-4 mr-2" /> Save Changes
          </Button>
        </div>
      </div>

      {/* ── Layout ── */}
      <div className="flex gap-5 min-h-[600px]">

        {/* ── Left nav ── */}
        <nav className="hidden md:flex flex-col w-56 flex-shrink-0 gap-0.5">
          {NAV.map(({ key, label, icon: Icon }) => {
            const active = key === activeSection;
            return (
              <button key={key} onClick={() => setActiveSection(key)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all text-sm ${active ? 'text-white font-medium shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}
                style={active ? { backgroundColor: PRIMARY } : {}}>
                <Icon className="size-4 flex-shrink-0" />
                <span>{label}</span>
                {!active && <ChevronRight className="size-3.5 ml-auto text-gray-300" />}
              </button>
            );
          })}
        </nav>

        {/* ── Mobile nav (horizontal scroll) ── */}
        <div className="md:hidden flex gap-2 overflow-x-auto pb-2 mb-4 w-full">
          {NAV.map(({ key, label, icon: Icon }) => {
            const active = key === activeSection;
            return (
              <button key={key} onClick={() => setActiveSection(key)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg whitespace-nowrap text-sm font-medium flex-shrink-0 transition-all ${active ? 'text-white' : 'bg-gray-100 text-gray-600'}`}
                style={active ? { backgroundColor: PRIMARY } : {}}>
                <Icon className="size-3.5" />
                {label}
              </button>
            );
          })}
        </div>

        {/* ── Content panel ── */}
        <div className="flex-1 min-w-0">
          <Card>
            <CardContent className="p-5 lg:p-6">
              {renderSection()}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
