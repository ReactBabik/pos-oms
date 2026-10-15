import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { X, FileText, Package, RotateCcw, Printer } from 'lucide-react';

interface OrderDetailsDialogProps {
  isOpen: boolean;
  order: any;
  onClose: () => void;
  onReturn: (order: any) => void;
}

export function OrderDetailsDialog({ isOpen, order, onClose, onReturn }: OrderDetailsDialogProps) {
  if (!order) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleReturnClick = () => {
    onReturn(order);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-screen h-screen md:w-[90vw] md:h-[90vh] max-w-none sm:max-w-none max-h-none flex flex-col p-0 md:rounded-lg rounded-none bg-white">
        <DialogHeader className="px-4 md:px-6 py-2.5 bg-[#C7359C] text-white">
          <DialogTitle className="flex items-center gap-2 text-base text-white">
            <FileText className="size-4" />
            Invoice Details: {order.id}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-3">
          {/* Order Header */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5 mb-4">
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Order ID</p>
              <p className="font-semibold text-sm text-gray-900">{order.id}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Customer</p>
              <p className="font-semibold text-sm text-gray-900">{order.customer}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Phone</p>
              <p className="font-semibold text-sm text-gray-900">{order.phone || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Date & Time</p>
              <p className="font-semibold text-sm text-gray-900">
                {new Date(order.date).toLocaleDateString()}
              </p>
              <p className="text-xs text-gray-500">{new Date(order.date).toLocaleTimeString()}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Status</p>
              <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-xs h-5">
                {order.status}
              </Badge>
            </div>
          </div>

          {/* Items List */}
          <div className="mb-4">
            <p className="text-sm font-semibold text-gray-900 mb-2">Order Items ({order.items.length})</p>
            
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              {/* Desktop View */}
              <div className="hidden md:block max-h-[calc(90vh-380px)] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#C7359C] hover:bg-[#C7359C]">
                      <TableHead className="py-2 text-white font-semibold text-xs">Product</TableHead>
                      <TableHead className="text-center py-2 w-20 text-white font-semibold text-xs">Qty</TableHead>
                      <TableHead className="text-center py-2 w-24 text-white font-semibold text-xs">Unit</TableHead>
                      <TableHead className="text-right py-2 w-24 text-white font-semibold text-xs">Price</TableHead>
                      <TableHead className="text-right py-2 w-28 text-white font-semibold text-xs">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {order.items.map((item: any, index: number) => (
                      <TableRow key={item.id || index} className="bg-white hover:bg-gray-50">
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
                            <div>
                              <p className="font-medium text-sm text-gray-900">{item.name}</p>
                              {item.batchId && (
                                <p className="text-xs text-gray-500">Batch: {item.batchId}</p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center py-2">
                          <span className="font-semibold text-sm">{item.quantity}</span>
                        </TableCell>
                        <TableCell className="text-center py-2 text-sm text-gray-700">
                          {item.unit || 'N/A'}
                        </TableCell>
                        <TableCell className="text-right py-2 text-sm text-gray-700">
                          PKR {item.price.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right py-2 font-semibold text-sm text-[#C7359C]">
                          PKR {item.total.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile View */}
              <div className="md:hidden space-y-0 max-h-[calc(100vh-380px)] overflow-y-auto">
                {order.items.map((item: any, index: number) => (
                  <div 
                    key={item.id || index} 
                    className={`p-2.5 ${index > 0 ? 'border-t border-gray-200' : ''} bg-white`}
                  >
                    <div className="flex items-start gap-2.5 mb-2">
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
                        {item.batchId && (
                          <p className="text-xs text-gray-500">Batch: {item.batchId}</p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="text-gray-500 mb-0.5">Quantity</p>
                        <p className="font-semibold text-sm">{item.quantity} {item.unit || ''}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 mb-0.5">Price</p>
                        <p className="font-semibold text-sm">PKR {item.price.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 mb-0.5">Total</p>
                        <p className="font-semibold text-sm text-[#C7359C]">PKR {item.total.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="border-t border-gray-200 pt-3">
            <div className="space-y-2 max-w-md ml-auto">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal:</span>
                <span className="font-semibold">PKR {order.subtotal.toLocaleString()}</span>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Discount:</span>
                  <span className="font-semibold text-green-600">- PKR {order.discount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-base border-t pt-2">
                <span className="font-semibold text-gray-900">Total Amount:</span>
                <span className="font-bold text-lg text-[#C7359C]">PKR {order.total.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm pt-1">
                <span className="text-gray-600">Payment Method:</span>
                <Badge variant={order.payment === 'Cash' ? 'default' : 'secondary'}>
                  {order.payment}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col md:flex-row items-stretch md:items-center justify-between bg-gray-50 px-4 md:px-6 py-2.5 gap-2.5 border-t border-gray-200">
          <div className="flex gap-2 order-2 md:order-1">
            <Button
              variant="outline"
              onClick={handlePrint}
              className="flex-1 md:flex-initial h-9 border-gray-300 hover:bg-white text-sm"
            >
              <Printer className="size-4 mr-2" />
              Print
            </Button>
            <Button
              variant="outline"
              onClick={handleReturnClick}
              className="flex-1 md:flex-initial h-9 border-red-300 text-red-600 hover:bg-red-50 text-sm"
            >
              <RotateCcw className="size-4 mr-2" />
              Process Return
            </Button>
          </div>
          <Button
            variant="outline"
            onClick={onClose}
            className="order-1 md:order-2 h-9 border-gray-300 hover:bg-white text-sm"
          >
            <X className="size-4 mr-2" />
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
