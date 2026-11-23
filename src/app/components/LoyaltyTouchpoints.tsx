// Loyalty touchpoints outside the Loyalty module: POS code redemption, order details, sales returns.
import { useState } from 'react';
import { toast } from 'sonner';
import { Gift, QrCode, CheckCircle2, XCircle, Coins, Ban, RotateCcw } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Checkbox } from './ui/checkbox';
import { PRIMARY, CodeCheck, blacklistFor, checkCode, createAdjustment, findGrower, pointsForItems, redeemCode } from '../utils/loyaltyStore';

/** POS → Redeem Loyalty Code. Used, expired and blacklisted codes are rejected. */
export function LoyaltyRedeemDialog({ open, onOpenChange, franchise = 'Main Branch – Karachi' }: { open: boolean; onOpenChange: (o: boolean) => void; franchise?: string }) {
  const [code, setCode] = useState('');
  const [result, setResult] = useState<CodeCheck | null>(null);

  const close = (o: boolean) => { if (!o) { setCode(''); setResult(null); } onOpenChange(o); };
  const validate = () => setResult(checkCode(code));
  const confirm = () => {
    if (!result?.ok) return;
    redeemCode(code, franchise);
    toast.success(`${result.code.points} points redeemed for ${result.grower.name}. PKR ${result.code.points} discount applied. Cropwise balance updated.`);
    close(false);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Gift className="size-5" style={{ color: PRIMARY }} /> Redeem Loyalty Code</DialogTitle>
          <DialogDescription>Enter or scan the code the grower generated in Cropwise Grower.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input autoFocus inputMode="numeric" maxLength={6} placeholder="6-digit code" value={code}
              onChange={e => { setCode(e.target.value.replace(/\D/g, '')); setResult(null); }}
              onKeyDown={e => e.key === 'Enter' && code.length === 6 && validate()}
              className="text-center text-xl tracking-[0.4em] font-mono h-12" />
            <Button variant="outline" className="h-12" onClick={() => toast.info('Opens the QR scanner (same as product scan)')}><QrCode className="size-5" /></Button>
          </div>
          <Button className="w-full text-white hover:opacity-90" style={{ backgroundColor: PRIMARY }} disabled={code.length !== 6} onClick={validate}>Validate code</Button>
          <p className="text-xs text-gray-400 text-center">Demo codes: 482913 valid · 111111 already used · 909090 expired · 555123 blacklisted</p>

          {result && !result.ok && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 flex gap-2">
              <XCircle className="size-5 flex-shrink-0" /> <span>{result.reason}</span>
            </div>
          )}
          {result?.ok && (
            <div className="rounded-lg border-2 border-green-200 bg-green-50 p-4 space-y-3">
              <div className="flex items-center gap-2 text-green-800 font-semibold"><CheckCircle2 className="size-5" /> Code valid</div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-xs text-gray-500">Grower</p><p className="font-medium">{result.grower.name}</p><p className="text-xs text-gray-500">{result.grower.mobile}</p></div>
                <div><p className="text-xs text-gray-500">Grower ID</p><p className="font-medium">{result.grower.growerId}</p><p className="text-xs text-gray-500">{result.grower.district}</p></div>
                <div><p className="text-xs text-gray-500">Points to redeem</p><p className="text-xl font-bold" style={{ color: PRIMARY }}>{result.code.points}</p></div>
                <div><p className="text-xs text-gray-500">Discount</p><p className="text-xl font-bold text-gray-900">PKR {result.code.points}</p></div>
              </div>
              <p className="text-xs text-gray-500">Balance after: {(result.balance - result.code.points).toLocaleString()} points. Points earned on today's products are added after checkout.</p>
              <Button className="w-full bg-green-600 hover:bg-green-700 text-white" onClick={confirm}>Confirm redemption</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Online Orders → Order details: points the order earns. */
export function OrderLoyaltyPanel({ order }: { order: { id: string; phone: string; stage: string; items: { name: string; qty: number; price: number }[] } }) {
  const calc = pointsForItems(order.items);
  const grower = findGrower(order.phone);
  const blocked = blacklistFor(order.phone);
  const earnBlocked = blocked && blocked.scope !== 'Redemption only';
  const status =
    order.stage === 'cancelled' ? { text: 'No points: order cancelled', tone: 'text-gray-500' }
      : earnBlocked ? { text: 'Earning blocked: number is blacklisted', tone: 'text-red-600' }
        : order.stage === 'delivered' ? { text: `${calc.total} points credited on delivery`, tone: 'text-green-700' }
            : { text: `${calc.total} points will be credited when the order is delivered`, tone: 'text-[#C7359C]' };

  return (
    <div className="rounded-lg border border-[#C7359C]/30 bg-[#C7359C]/5 p-3 text-sm space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1"><Coins className="size-3.5" style={{ color: PRIMARY }} /> Loyalty Points</p>
          <p className={`font-medium ${status.tone}`}>{earnBlocked && <Ban className="size-3.5 inline mr-1" />}{status.text}</p>
          <p className="text-xs text-gray-500">{grower ? grower.growerId : `Credited to ${order.phone}`} · {calc.program.name}</p>
        </div>
        <p className="text-2xl font-bold flex-shrink-0" style={{ color: PRIMARY }}>{order.stage === 'cancelled' || earnBlocked ? 0 : calc.total}<span className="text-xs font-medium text-gray-500 ml-1">pts</span></p>
      </div>
      <div className="grid gap-1">
        {calc.lines.map((l, i) => (
          <div key={i} className="flex justify-between text-xs text-gray-600">
            <span className="truncate">{l.name} × {l.qty} <span className="text-gray-400">({l.basis})</span></span>
            <span className="font-medium ml-2">{l.points}</span>
          </div>
        ))}
      </div>
      {calc.belowMinimum && <p className="text-xs text-amber-700">Below the minimum purchase of Rs {calc.program.minPurchaseForPoints}: no points.</p>}
    </div>
  );
}

/** Sales return dialog: reverse the points earned on the returned items (logged in Loyalty → Adjustments). */
export function useReturnPointsReversal(order: { id: string; phone?: string; customer: string } | null, items: { name: string; quantity: number; price: number }[], franchise = 'Main Branch – Karachi') {
  const [reverse, setReverse] = useState(true);
  // Points live against the mobile number, so any sale with a phone number can be reversed.
  const grower = order?.phone ? (findGrower(order.phone) ?? { growerId: '—', name: order.customer, mobile: order.phone }) : undefined;
  const points = pointsForItems(items.map(i => ({ name: i.name, qty: i.quantity, price: i.price }))).total;

  const notice = !order ? null : (
    <div className="rounded-lg border border-[#C7359C]/30 bg-[#C7359C]/5 p-3 text-sm">
      <p className="font-semibold text-gray-900 flex items-center gap-1.5"><RotateCcw className="size-4" style={{ color: PRIMARY }} /> Loyalty points</p>
      {!grower ? (
        <p className="text-xs text-gray-500 mt-1">No mobile number on this sale, so no loyalty points were earned.</p>
      ) : points === 0 ? (
        <p className="text-xs text-gray-500 mt-1">The returned items earned no points.</p>
      ) : (
        <label className="flex items-start gap-2 mt-1.5 cursor-pointer">
          <Checkbox checked={reverse} onCheckedChange={v => setReverse(v === true)} className="mt-0.5" />
          <span className="text-xs text-gray-700">
            Reverse <b style={{ color: PRIMARY }}>{points} points</b> earned on these items from {grower.name} ({grower.mobile}).
            The reversal is listed in Loyalty → Adjustments and the grower's balance updates.
          </span>
        </label>
      )}
    </div>
  );

  const apply = (returnRef: string) => {
    if (!grower || !reverse || points === 0) return;
    const adj = createAdjustment({
      mobile: grower.mobile, growerId: grower.growerId, name: grower.name, type: 'Return reversal', direction: 'deduct',
      points, linkedRef: returnRef, note: `Returned at franchise (sale ${order!.id})`, source: 'Franchise return', enteredBy: franchise,
    });
    toast.success(`${points} loyalty points reversed (${adj.id})`);
  };

  return { notice, apply };
}
