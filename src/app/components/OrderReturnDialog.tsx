import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { ScrollArea } from './ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Checkbox } from './ui/checkbox';
import { Textarea } from './ui/textarea';
import { useState } from 'react';
import { Package, AlertCircle, RotateCcw, X } from 'lucide-react';
import { toast } from 'sonner';

interface OrderItem {
  id: string;
  productId?: string;
  name: string;
  quantity: number;
  price: number;
  total: number;
  image?: string;
  batchId?: string;
}

interface Order {
  id: string;
  date: string;
  customer: string;
  phone?: string;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  total: number;
  payment: string;
  status: string;
}

interface OrderReturnDialogProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  onReturn: (returnData: {
    orderId: string;
    returnType: 'complete' | 'partial';
    items: { id: string; name: string; quantity: number; amount: number }[];
    reason: string;
    totalAmount: number;
  }) => void;
}

export function OrderReturnDialog({
  isOpen,
  onClose,
  order,
  onReturn
}: OrderReturnDialogProps) {
  const [returnType, setReturnType] = useState<'complete' | 'partial'>('complete');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({});
  const [reason, setReason] = useState('');

  if (!order) return null;

  const handleToggleItem = (itemId: string, maxQuantity: number) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
      const newQuantities = { ...returnQuantities };
      delete newQuantities[itemId];
      setReturnQuantities(newQuantities);
    } else {
      newSelected.add(itemId);
      setReturnQuantities({
        ...returnQuantities,
        [itemId]: maxQuantity
      });
    }
    setSelectedItems(newSelected);
  };

  const handleQuantityChange = (itemId: string, value: number, maxQuantity: number) => {
    setReturnQuantities({
      ...returnQuantities,
      [itemId]: Math.min(Math.max(1, value), maxQuantity)
    });
  };

  const handleSelectAll = () => {
    if (selectedItems.size === order.items.length) {
      setSelectedItems(new Set());
      setReturnQuantities({});
    } else {
      const allIds = new Set(order.items.map(item => item.id));
      setSelectedItems(allIds);
      const newQuantities: Record<string, number> = {};
      order.items.forEach(item => {
        newQuantities[item.id] = item.quantity;
      });
      setReturnQuantities(newQuantities);
    }
  };

  const calculateReturnAmount = () => {
    if (returnType === 'complete') {
      return order.total;
    }
    
    return order.items.reduce((sum, item) => {
      if (selectedItems.has(item.id)) {
        const quantity = returnQuantities[item.id] || item.quantity;
        return sum + (item.price * quantity);
      }
      return sum;
    }, 0);
  };

  const handleReturn = () => {
    if (returnType === 'partial' && selectedItems.size === 0) {
      toast.error('Please select at least one item to return');
      return;
    }

    if (!reason.trim()) {
      toast.error('Please provide a reason for the return');
      return;
    }

    console.log('🔄 Processing return for order:', order.id);
    console.log('Return type:', returnType);
    console.log('Selected items:', Array.from(selectedItems));
    console.log('Order items:', order.items);

    const returnItems = returnType === 'complete' 
      ? order.items.map(item => ({
          id: item.id,
          productId: item.productId,
          name: item.name,
          productName: item.name,
          quantity: item.quantity,
          amount: item.total,
          batchId: item.batchId
        }))
      : Array.from(selectedItems).map(itemId => {
          const item = order.items.find(i => i.id === itemId)!;
          const quantity = returnQuantities[itemId] || item.quantity;
          return {
            id: item.id,
            productId: item.productId,
            name: item.name,
            productName: item.name,
            quantity: quantity,
            amount: item.price * quantity,
            batchId: item.batchId
          };
        });

    console.log('Return items to send:', returnItems);

    onReturn({
      orderId: order.id,
      returnType,
      items: returnItems,
      reason,
      totalAmount: calculateReturnAmount()
    });

    // Reset state
    setReturnType('complete');
    setSelectedItems(new Set());
    setReturnQuantities({});
    setReason('');
    onClose();
  };

  const handleClose = () => {
    setReturnType('complete');
    setSelectedItems(new Set());
    setReturnQuantities({});
    setReason('');
    onClose();
  };

  const returnAmount = calculateReturnAmount();

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="w-screen h-screen md:w-[90vw] md:h-[90vh] max-w-none sm:max-w-none max-h-none flex flex-col p-0 md:rounded-lg rounded-none bg-white">
        <DialogHeader className="px-4 md:px-6 py-2.5 bg-[#C7359C] text-white">
          <DialogTitle className="flex items-center gap-2 text-base text-white">
            <RotateCcw className="size-4" />
            Return Order: {order.id}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-3">
          {/* Order Summary */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5 mb-4">
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Customer</p>
              <p className="font-semibold text-sm text-gray-900">{order.customer}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Phone</p>
              <p className="font-semibold text-sm text-gray-900">{order.phone || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Date</p>
              <p className="font-semibold text-sm text-gray-900">{new Date(order.date).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Payment</p>
              <Badge variant="outline" className="text-xs h-5 border-[#C7359C] text-[#C7359C]">{order.payment}</Badge>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Amount</p>
              <p className="font-semibold text-sm text-[#C7359C]">PKR {order.total.toLocaleString()}</p>
            </div>
          </div>

          {/* Return Type Selection */}
          <div className="mb-4">
            <Label className="text-sm font-semibold text-gray-900 mb-2 block">Return Type</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              <div
                onClick={() => setReturnType('complete')}
                className={`p-2.5 border-2 rounded-lg cursor-pointer transition-all ${
                  returnType === 'complete'
                    ? 'border-[#C7359C] bg-purple-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    returnType === 'complete' ? 'border-[#C7359C]' : 'border-gray-300'
                  }`}>
                    {returnType === 'complete' && (
                      <div className="w-2 h-2 rounded-full bg-[#C7359C]" />
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-gray-900">Complete Return</p>
                    <p className="text-xs text-gray-500">Return all items</p>
                  </div>
                </div>
              </div>

              <div
                onClick={() => setReturnType('partial')}
                className={`p-2.5 border-2 rounded-lg cursor-pointer transition-all ${
                  returnType === 'partial'
                    ? 'border-[#C7359C] bg-purple-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    returnType === 'partial' ? 'border-[#C7359C]' : 'border-gray-300'
                  }`}>
                    {returnType === 'partial' && (
                      <div className="w-2 h-2 rounded-full bg-[#C7359C]" />
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-gray-900">Partial Return</p>
                    <p className="text-xs text-gray-500">Select specific items</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Items List */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-semibold text-gray-900">Order Items ({order.items.length})</Label>
              {returnType === 'partial' && (
                <div className="flex items-center gap-1.5">
                  <Checkbox
                    id="select-all"
                    checked={selectedItems.size === order.items.length}
                    onCheckedChange={handleSelectAll}
                  />
                  <label htmlFor="select-all" className="text-xs font-medium cursor-pointer text-gray-700">
                    Select All ({selectedItems.size}/{order.items.length})
                  </label>
                </div>
              )}
            </div>

            <div className="border border-gray-200 rounded-lg overflow-hidden">
              {/* Desktop View */}
              <div className="hidden md:block max-h-[calc(90vh-420px)] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#C7359C] hover:bg-[#C7359C]">
                      {returnType === 'partial' && <TableHead className="w-10 py-2 text-white"></TableHead>}
                      <TableHead className="py-2 text-white font-semibold text-xs">Product</TableHead>
                      <TableHead className="text-center py-2 w-20 text-white font-semibold text-xs">Qty</TableHead>
                      {returnType === 'partial' && <TableHead className="text-center py-2 w-24 text-white font-semibold text-xs">Return</TableHead>}
                      <TableHead className="text-right py-2 w-24 text-white font-semibold text-xs">Price</TableHead>
                      <TableHead className="text-right py-2 w-28 text-white font-semibold text-xs">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {order.items.map((item) => {
                      const isSelected = returnType === 'complete' || selectedItems.has(item.id);
                      const returnQty = returnType === 'complete' ? item.quantity : (returnQuantities[item.id] || item.quantity);
                      
                      return (
                        <TableRow key={item.id} className={`${isSelected ? 'bg-purple-50' : 'bg-white hover:bg-gray-50'}`}>
                          {returnType === 'partial' && (
                            <TableCell className="py-2">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => handleToggleItem(item.id, item.quantity)}
                              />
                            </TableCell>
                          )}
                          <TableCell className="py-2">
                            <div className="flex items-center gap-2.5">
                              <div className="flex-shrink-0">
                                <div className="w-[45px] h-[45px] rounded-md bg-gray-50 border border-gray-200 overflow-hidden">
                                  {item.image ? (
                                    <img 
                                      src={item.image} 
                                      alt={item.name}
                                      className="w-full h-full object-contain"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                                      <Package className="size-4" />
                                    </div>
                                  )}
                                </div>
                              </div>
                              <p className="font-medium text-sm text-gray-900">{item.name}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-center py-2">
                            <span className="font-semibold text-sm">{item.quantity}</span>
                          </TableCell>
                          {returnType === 'partial' && (
                            <TableCell className="text-center py-2">
                              {isSelected ? (
                                <Input
                                  type="number"
                                  min="1"
                                  max={item.quantity}
                                  value={returnQty}
                                  onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value) || 1, item.quantity)}
                                  className="w-16 h-7 text-sm mx-auto border-gray-200 focus:border-[#C7359C] focus:ring-[#C7359C]"
                                />
                              ) : (
                                <span className="text-gray-400 text-sm">-</span>
                              )}
                            </TableCell>
                          )}
                          <TableCell className="text-right py-2 text-sm text-gray-700">PKR {item.price.toLocaleString()}</TableCell>
                          <TableCell className="text-right py-2 font-semibold text-sm text-[#C7359C]">
                            PKR {(item.price * (returnType === 'partial' && isSelected ? returnQty : item.quantity)).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile View */}
              <div className="md:hidden space-y-0 max-h-[calc(100vh-420px)] overflow-y-auto">
                {order.items.map((item, index) => {
                  const isSelected = returnType === 'complete' || selectedItems.has(item.id);
                  const returnQty = returnType === 'complete' ? item.quantity : (returnQuantities[item.id] || item.quantity);
                  
                  return (
                    <div 
                      key={item.id} 
                      className={`p-2.5 ${index > 0 ? 'border-t border-gray-200' : ''} ${isSelected ? 'bg-purple-50' : 'bg-white'}`}
                    >
                      <div className="flex items-start gap-2.5 mb-2">
                        {returnType === 'partial' && (
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => handleToggleItem(item.id, item.quantity)}
                            className="mt-1"
                          />
                        )}
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          <div className="flex-shrink-0">
                            <div className="w-[45px] h-[45px] rounded-md bg-gray-50 border border-gray-200 overflow-hidden">
                              {item.image ? (
                                <img 
                                  src={item.image} 
                                  alt={item.name}
                                  className="w-full h-full object-contain"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-400">
                                  <Package className="size-4" />
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate text-gray-900">{item.name}</p>
                            <p className="text-xs text-gray-500 mt-0.5">PKR {item.price.toLocaleString()}</p>
                          </div>
                        </div>
                      </div>

                      <div className={`grid grid-cols-2 gap-2.5 text-xs ${returnType === 'partial' ? 'pl-8' : ''}`}>
                        <div>
                          <p className="text-gray-500 mb-0.5">Quantity</p>
                          <p className="font-semibold text-sm">{item.quantity}</p>
                        </div>
                        {returnType === 'partial' && (
                          <div>
                            <p className="text-gray-500 mb-0.5">Return</p>
                            {isSelected ? (
                              <Input
                                type="number"
                                min="1"
                                max={item.quantity}
                                value={returnQty}
                                onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value) || 1, item.quantity)}
                                className="w-full h-7 text-sm border-gray-200 focus:border-[#C7359C] focus:ring-[#C7359C]"
                              />
                            ) : (
                              <p className="text-gray-400 text-sm">-</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Return Reason */}
          <div>
            <Label htmlFor="reason" className="text-sm font-semibold text-gray-900 flex items-center gap-1 mb-1.5">
              Reason for Return <span className="text-[#C7359C]">*</span>
            </Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Provide a reason for the return..."
              className="min-h-[60px] text-sm border-gray-200 focus:border-[#C7359C] focus:ring-[#C7359C]"
            />
          </div>
        </div>

        <DialogFooter className="flex flex-col md:flex-row items-stretch md:items-center justify-between bg-gray-50 px-4 md:px-6 py-2.5 gap-2.5 border-t border-gray-200">
          <div className="text-center md:text-left">
            <p className="text-xs text-gray-600 mb-0.5">Total Return Amount</p>
            <p className="text-xl font-bold text-[#C7359C]">PKR {returnAmount.toLocaleString()}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose} className="flex-1 md:flex-initial h-9 border-gray-300 hover:bg-white text-sm">
              <X className="size-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={handleReturn}
              className="bg-[#C7359C] hover:bg-purple-700 text-white flex-1 md:flex-initial h-9 text-sm"
            >
              <RotateCcw className="size-4 mr-2" />
              Process Return
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}