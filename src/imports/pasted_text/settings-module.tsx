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
  CreditCard, Settings2, Package
} from 'lucide-react';
import { toast } from 'sonner';

const PRIMARY = '#C7359C';

// ── Nav sections ─────────────────────────────────────────────────────────────
type Section =
  | 'store' | 'pos' | 'receipt'
  | 'loyalty' | 'credit' | 'segments' | 'notifications' | 'system';

const NAV: { key: Section; label: string; icon: React.ElementType; description: string }[] = [
  { key: 'store',         label: 'Store Information',       icon: Store,       description: 'Business details & contact info' },
  { key: 'pos',           label: 'POS & Display',           icon: ShoppingCart,description: 'Point of sale display preferences' },
  { key: 'receipt',       label: 'Receipt & Printing',      icon: Receipt,     description: 'Receipt content and print options' },
  { key: 'loyalty',       label: 'Loyalty Program',         icon: Gift,        description: 'Points earning & redemption rules' },
  { key: 'credit',        label: 'Credit Management',       icon: CreditCard,  description: 'Credit policy and overdue settings' },
  { key: 'segments',      label: 'Customer Segments',       icon: Users,       description: 'Segment classification criteria' },
  { key: 'notifications', label: 'Notifications & Alerts',  icon: Bell,        description: 'Stock, expiry and sales alerts' },
  { key: 'system',        label: 'System & Data',           icon: Database,    description: 'Backup, export and system info' },
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

  // ── Loyalty ───────────────────────────────────────────────────────────────
  const [loyaltySettings, setLoyaltySettings] = useState(() => {
    const saved = localStorage.getItem('loyaltySettings');
    return saved ? JSON.parse(saved) : {
      enabled: true,
      standardPointsPerRs: 1,       // points earned per Rs spent
      minPurchaseForPoints: 100,     // min order value to earn
      pointsValidityDays: 365,
      redemptionRate: 0.5,           // Rs value per 1 point redeemed
      minPointsToRedeem: 100,
      maxRedemptionPct: 20,          // max % of bill that can be paid by points
      showBalanceOnReceipt: true,
      notifyOnEarning: true,
    };
  });
  const [productOverrides, setProductOverrides] = useState<ProductLoyaltyOverride[]>(() => {
    const saved = localStorage.getItem('loyaltyProductOverrides');
    return saved ? JSON.parse(saved) : [];
  });
  const [newOverride, setNewOverride] = useState({ productName: '', pointsPerUnit: '' });

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
    // Validate segment settings
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
    localStorage.setItem('loyaltySettings', JSON.stringify(loyaltySettings));
    localStorage.setItem('loyaltyProductOverrides', JSON.stringify(productOverrides));
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
    const data = { storeInfo, taxSettings, receiptSettings, posSettings, loyaltySettings, productOverrides, creditSettings, notificationSettings, systemSettings, segmentSettings, exportDate: new Date().toISOString() };
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
    localStorage.removeItem('customerSegmentSettings');
    window.location.reload();
  };

  const addProductOverride = () => {
    if (!newOverride.productName.trim() || !newOverride.pointsPerUnit) {
      toast.error('Enter product name and points per unit');
      return;
    }
    setProductOverrides(prev => [...prev, {
      id: Date.now().toString(),
      productName: newOverride.productName.trim(),
      pointsPerUnit: parseFloat(newOverride.pointsPerUnit),
    }]);
    setNewOverride({ productName: '', pointsPerUnit: '' });
  };

  const removeProductOverride = (id: string) => {
    setProductOverrides(prev => prev.filter(o => o.id !== id));
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

      case 'tax':
        return (
          <>
            <SectionHeader icon={Percent} title="Tax & Currency" description="Configure tax rates applied to sales" />
            <ToggleRow id="enableTax" label="Enable Tax on Sales"
              description="Apply configured tax rate to all transactions"
              checked={taxSettings.enableTax}
              onCheckedChange={v => setTaxSettings({ ...taxSettings, enableTax: v })} />
            {taxSettings.enableTax && (
              <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Tax Rate (%)</Label>
                  <Input type="number" value={taxSettings.taxRate}
                    onChange={e => setTaxSettings({ ...taxSettings, taxRate: parseFloat(e.target.value) })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Tax Label</Label>
                  <Input value={taxSettings.taxLabel}
                    onChange={e => setTaxSettings({ ...taxSettings, taxLabel: e.target.value })}
                    placeholder="GST / VAT / Sales Tax" />
                </div>
              </div>
            )}
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

      case 'loyalty':
        return (
          <>
            <SectionHeader icon={Gift} title="Loyalty Program" description="Configure how customers earn and redeem points" />

            <ToggleRow id="loyaltyEnabled" label="Enable Loyalty Program"
              description="Allow customers to earn and redeem points on purchases"
              checked={loyaltySettings.enabled}
              onCheckedChange={v => setLoyaltySettings({ ...loyaltySettings, enabled: v })} />

            {loyaltySettings.enabled && (
              <div className="space-y-6 pt-4">

                {/* Earning Rules */}
                <div>
                  <p className="text-sm font-semibold text-gray-800 mb-1">Earning Rules</p>
                  <p className="text-xs text-gray-500 mb-4">How customers earn points on purchases</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Standard Points per Rs Spent</Label>
                      <div className="relative">
                        <Input type="number" step="0.1" min="0"
                          value={loyaltySettings.standardPointsPerRs}
                          onChange={e => setLoyaltySettings({ ...loyaltySettings, standardPointsPerRs: parseFloat(e.target.value) })} />
                        <span className="absolute right-3 top-2.5 text-xs text-gray-400">pts / Rs</span>
                      </div>
                      <p className="text-xs text-gray-400">e.g. 1 pt per Rs spent → Rs 500 order = 500 pts</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Minimum Purchase to Earn (Rs)</Label>
                      <Input type="number" min="0"
                        value={loyaltySettings.minPurchaseForPoints}
                        onChange={e => setLoyaltySettings({ ...loyaltySettings, minPurchaseForPoints: parseInt(e.target.value) })} />
                      <p className="text-xs text-gray-400">Orders below this amount earn no points</p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Redemption Rules */}
                <div>
                  <p className="text-sm font-semibold text-gray-800 mb-1">Redemption Rules</p>
                  <p className="text-xs text-gray-500 mb-4">Unified rate at which customers redeem points</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Rs Value per Point Redeemed</Label>
                      <div className="relative">
                        <Input type="number" step="0.01" min="0"
                          value={loyaltySettings.redemptionRate}
                          onChange={e => setLoyaltySettings({ ...loyaltySettings, redemptionRate: parseFloat(e.target.value) })} />
                        <span className="absolute right-3 top-2.5 text-xs text-gray-400">Rs / pt</span>
                      </div>
                      <p className="text-xs text-gray-400">e.g. 0.5 → 100 pts = Rs 50 discount</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Minimum Points to Redeem</Label>
                      <Input type="number" min="1"
                        value={loyaltySettings.minPointsToRedeem}
                        onChange={e => setLoyaltySettings({ ...loyaltySettings, minPointsToRedeem: parseInt(e.target.value) })} />
                    </div>
                  </div>

                  {/* Summary box */}
                  
                </div>

                <Separator />

                {/* Notifications */}
                <div>
                  <p className="text-sm font-semibold text-gray-800 mb-3">Notifications</p>
                  <ToggleRow id="showBalanceOnReceipt" label="Show Points Balance on Receipt"
                    description="Print current points balance and amount earned on each receipt"
                    checked={loyaltySettings.showBalanceOnReceipt}
                    onCheckedChange={v => setLoyaltySettings({ ...loyaltySettings, showBalanceOnReceipt: v })} />
                  <ToggleRow id="notifyOnEarning" label="Notify Customer on Points Earned"
                    description="Show a notification at checkout when points are added"
                    checked={loyaltySettings.notifyOnEarning}
                    onCheckedChange={v => setLoyaltySettings({ ...loyaltySettings, notifyOnEarning: v })} />
                </div>

                <Separator />

                {/* Per-product overrides */}
                <div>
                  <p className="text-sm font-semibold text-gray-800 mb-1">Product-level Earning Overrides</p>
                  <p className="text-xs text-gray-500 mb-4">Override the standard rate for specific products. Leave blank to use the standard rate.</p>

                  {productOverrides.length > 0 && (
                    <div className="border rounded-lg overflow-hidden mb-4">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 border-b text-xs text-gray-500">
                            <th className="text-left px-4 py-2.5 font-medium">Product Name</th>
                            <th className="text-right px-4 py-2.5 font-medium">Points per Unit</th>
                            <th className="px-3 py-2.5 w-10" />
                          </tr>
                        </thead>
                        <tbody>
                          {productOverrides.map(o => (
                            <tr key={o.id} className="border-b last:border-0 hover:bg-gray-50">
                              <td className="px-4 py-2.5 font-medium text-gray-800">{o.productName}</td>
                              <td className="px-4 py-2.5 text-right">
                                <Badge variant="outline" style={{ borderColor: `${PRIMARY}40`, color: PRIMARY }}>
                                  {o.pointsPerUnit} pts
                                </Badge>
                              </td>
                              <td className="px-3 py-2.5">
                                <Button variant="ghost" size="icon" className="size-7 hover:bg-red-50 hover:text-red-600"
                                  onClick={() => removeProductOverride(o.id)}>
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
                    <Input placeholder="Product name" value={newOverride.productName}
                      onChange={e => setNewOverride({ ...newOverride, productName: e.target.value })}
                      className="flex-1" />
                    <Input type="number" placeholder="Points/unit" value={newOverride.pointsPerUnit}
                      onChange={e => setNewOverride({ ...newOverride, pointsPerUnit: e.target.value })}
                      className="w-36" />
                    <Button onClick={addProductOverride} size="sm" style={{ backgroundColor: PRIMARY }} className="hover:opacity-90 text-white">
                      <Plus className="size-4 mr-1" /> Add
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </>
        );

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

      case 'system':
        return (
          <>
            <SectionHeader icon={Database} title="System & Data" description="Backup, export and system information" />
            <ToggleRow id="autoBackup" label="Automatic Backup" description="Periodically back up your data"
              checked={systemSettings.autoBackup}
              onCheckedChange={v => setSystemSettings({ ...systemSettings, autoBackup: v })} />
            {systemSettings.autoBackup && (
              <FieldRow label="Backup Frequency">
                <select value={systemSettings.backupFrequency}
                  onChange={e => setSystemSettings({ ...systemSettings, backupFrequency: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="hourly">Hourly</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </FieldRow>
            )}
            <ToggleRow id="offlineMode" label="Offline Mode" description="Continue operating without internet"
              checked={systemSettings.offlineMode}
              onCheckedChange={v => setSystemSettings({ ...systemSettings, offlineMode: v })} />

            <Separator className="my-4" />

            <p className="text-sm font-semibold text-gray-700 mb-3">Data Management</p>
            <div className="flex gap-2 mb-2">
              <Button variant="outline" onClick={handleExport} className="flex-1">
                <Download className="size-4 mr-2" /> Export Settings
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => {
                const input = document.createElement('input');
                input.type = 'file'; input.accept = '.json';
                input.onchange = (e: any) => {
                  const reader = new FileReader();
                  reader.onload = (ev: any) => {
                    try {
                      const d = JSON.parse(ev.target.result);
                      toast.success('Settings imported — save to apply');
                    } catch { toast.error('Invalid settings file'); }
                  };
                  reader.readAsText(e.target.files[0]);
                };
                input.click();
              }}>
                <Upload className="size-4 mr-2" /> Import Settings
              </Button>
            </div>
            <Button variant="outline" onClick={handleReset} className="w-full text-red-600 hover:bg-red-50 border-red-200">
              <RefreshCw className="size-4 mr-2" /> Reset to Defaults
            </Button>

            <Separator className="my-4" />

            <p className="text-sm font-semibold text-gray-700 mb-3">System Information</p>
            <div className="space-y-2 text-sm">
              {[
                { label: 'Version', value: <Badge variant="outline">v1.0.0</Badge> },
                { label: 'Database', value: <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Connected</Badge> },
                { label: 'Last Backup', value: 'Today, 2:30 PM' },
                { label: 'Storage Used', value: '24.5 MB / 1 GB' },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-center py-1.5 border-b border-gray-50">
                  <span className="text-gray-500">{label}</span>
                  <span className="font-medium">{value}</span>
                </div>
              ))}
            </div>
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
