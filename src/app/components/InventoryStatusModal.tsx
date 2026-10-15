import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';
import { ScrollArea } from './ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Input } from './ui/input';
import { useState } from 'react';
import { 
  Package, 
  Calendar, 
  TrendingDown, 
  AlertCircle, 
  Clock, 
  AlertTriangle,
  ShoppingCart,
  X
} from 'lucide-react';
import { toast } from 'sonner';

interface Batch {
  id: string;
  quantity: number;
  purchasePrice: number;
  salePrice: number;
  expiry: string;
  supplier: string;
  price: number;
}

interface FlattenedVariant {
  variantId: string;
  displayName: string;
  productId: string;
  productName: string;
  variantName: string;
  category: string;
  image?: string;
  unit: string;
  price: number;
  barcode: string;
  qrCode: string;
  batches: Batch[];
}

interface InventoryStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: 'low' | 'out' | 'expiring' | 'expired' | null;
  products: FlattenedVariant[];
  onCreateOrder: (selectedProducts: { productId: string; productName: string; quantity: number }[]) => void;
}

export function InventoryStatusModal({
  isOpen,
  onClose,
  status,
  products,
  onCreateOrder
}: InventoryStatusModalProps) {
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const getStatusConfig = () => {
    switch (status) {
      case 'low':
        return {
          title: 'Low Stock Products',
          description: 'Products that need to be reordered',
          icon: TrendingDown,
          color: 'text-orange-600',
          bgColor: 'bg-orange-50',
          borderColor: 'border-orange-200'
        };
      case 'out':
        return {
          title: 'Out of Stock Products',
          description: 'Products with zero inventory - urgent reorder required',
          icon: AlertCircle,
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200'
        };
      case 'expiring':
        return {
          title: 'Expiring Soon Products',
          description: 'Products expiring within 60 days',
          icon: Clock,
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200'
        };
      case 'expired':
        return {
          title: 'Expired Products',
          description: 'Products that have expired and need removal',
          icon: AlertTriangle,
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200'
        };
      default:
        return {
          title: 'Products',
          description: '',
          icon: Package,
          color: 'text-gray-600',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200'
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  const getTotalQuantity = (batches: Batch[]) => {
    return batches.reduce((sum, batch) => sum + batch.quantity, 0);
  };

  const isExpiringSoon = (expiryDate: string) => {
    const expiry = new Date(expiryDate);
    const today = new Date();
    const daysUntilExpiry = Math.floor((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 60 && daysUntilExpiry >= 0;
  };

  const isExpired = (expiryDate: string) => {
    const expiry = new Date(expiryDate);
    const today = new Date();
    return expiry < today;
  };

  const getReorderQuantity = (product: FlattenedVariant) => {
    const currentStock = getTotalQuantity(product.batches);
    const minStock = 10; // Default minimum stock
    
    // For out of stock, suggest minimum stock level
    if (currentStock === 0) {
      return minStock;
    }
    
    // For low stock, suggest enough to reach 2x minimum stock
    return Math.max(minStock * 2 - currentStock, minStock);
  };

  const handleToggleProduct = (variantId: string) => {
    const newSelected = new Set(selectedProducts);
    if (newSelected.has(variantId)) {
      newSelected.delete(variantId);
      const newQuantities = { ...quantities };
      delete newQuantities[variantId];
      setQuantities(newQuantities);
    } else {
      newSelected.add(variantId);
      const product = products.find(p => p.variantId === variantId);
      if (product) {
        setQuantities({
          ...quantities,
          [variantId]: getReorderQuantity(product)
        });
      }
    }
    setSelectedProducts(newSelected);
  };

  const handleQuantityChange = (variantId: string, value: number) => {
    setQuantities({
      ...quantities,
      [variantId]: Math.max(1, value)
    });
  };

  const handleSelectAll = () => {
    if (selectedProducts.size === products.length) {
      setSelectedProducts(new Set());
      setQuantities({});
    } else {
      const allIds = new Set(products.map(p => p.variantId));
      setSelectedProducts(allIds);
      const newQuantities: Record<string, number> = {};
      products.forEach(product => {
        newQuantities[product.variantId] = getReorderQuantity(product);
      });
      setQuantities(newQuantities);
    }
  };

  const handleCreateOrder = () => {
    if (selectedProducts.size === 0) {
      toast.error('Please select at least one product');
      return;
    }

    const orderItems = Array.from(selectedProducts).map(variantId => {
      const product = products.find(p => p.variantId === variantId);
      return {
        productId: product?.variantId || variantId,
        productName: product?.displayName || '',
        quantity: quantities[variantId] || 1
      };
    });

    onCreateOrder(orderItems);
    
    // Reset state
    setSelectedProducts(new Set());
    setQuantities({});
    onClose();
  };

  const handleClose = () => {
    setSelectedProducts(new Set());
    setQuantities({});
    onClose();
  };

  if (!status) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="w-screen h-screen md:w-[70vw] md:h-[95vh] max-w-none sm:max-w-none max-h-none flex flex-col p-6 md:rounded-lg rounded-none">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className={`size-5 ${config.color}`} />
            {config.title}
          </DialogTitle>
          <DialogDescription>
            {config.description}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {products.length === 0 ? (
            <div className={`p-8 rounded-lg ${config.bgColor} border ${config.borderColor} text-center`}>
              <Icon className={`size-12 mx-auto mb-3 ${config.color} opacity-50`} />
              <p className="text-gray-600">No products found in this category</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="select-all"
                    checked={selectedProducts.size === products.length}
                    onCheckedChange={handleSelectAll}
                  />
                  <label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                    Select All ({selectedProducts.size} of {products.length})
                  </label>
                </div>
                <Badge variant="outline" className={`${config.color}`}>
                  {products.length} Products
                </Badge>
              </div>

              <ScrollArea className="h-[calc(100vh-250px)] md:h-[calc(95vh-250px)] pr-4">
                {/* Desktop Table View */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">Select</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Current Stock</TableHead>
                        {(status === 'expiring' || status === 'expired') && (
                          <TableHead>Expiry Info</TableHead>
                        )}
                        <TableHead className="text-right">Order Qty</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {products.map((product) => {
                        const isSelected = selectedProducts.has(product.variantId);
                        const currentStock = getTotalQuantity(product.batches);
                        
                        return (
                          <TableRow key={product.variantId} className={isSelected ? 'bg-purple-50' : ''}>
                            <TableCell>
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => handleToggleProduct(product.variantId)}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {/* Product Image */}
                                <div className="flex-shrink-0">
                                  <div className="w-[53px] h-[53px] rounded-md bg-gray-100 border overflow-hidden">
                                    {product.image ? (
                                      <img 
                                        src={product.image} 
                                        alt={product.displayName}
                                        className="w-full h-full object-contain"
                                      />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                                        <Package className="size-6" />
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div>
                                  <p className="font-medium">{product.displayName}</p>
                                  <p className="text-xs text-gray-500">Unit: {product.unit || 'N/A'}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <span className={currentStock === 0 ? 'text-red-600 font-semibold' : ''}>
                                {currentStock}
                              </span>
                            </TableCell>
                            {(status === 'expiring' || status === 'expired') && (
                              <TableCell>
                                {product.batches
                                  .filter(batch => 
                                    status === 'expiring' ? isExpiringSoon(batch.expiry) : isExpired(batch.expiry)
                                  )
                                  .map((batch, idx) => (
                                    <div key={idx} className="flex items-center gap-2 text-xs mb-1">
                                      <Calendar className="size-3" />
                                      <span className={isExpired(batch.expiry) ? 'text-red-600 font-semibold' : 'text-yellow-600'}>
                                        {new Date(batch.expiry).toLocaleDateString()}
                                      </span>
                                      <span className="text-gray-500">({batch.quantity} units)</span>
                                    </div>
                                  ))}
                              </TableCell>
                            )}
                            <TableCell className="text-right">
                              {isSelected ? (
                                <Input
                                  type="number"
                                  min="1"
                                  value={quantities[product.variantId] || 0}
                                  onChange={(e) => handleQuantityChange(product.variantId, parseInt(e.target.value) || 0)}
                                  className="w-20 ml-auto"
                                />
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden space-y-3">
                  {products.map((product) => {
                    const isSelected = selectedProducts.has(product.variantId);
                    const currentStock = getTotalQuantity(product.batches);
                    
                    return (
                      <div 
                        key={product.variantId} 
                        className={`border rounded-lg p-3 ${isSelected ? 'bg-purple-50 border-purple-300' : 'border-gray-200'}`}
                      >
                        {/* Header with Checkbox and Product Info */}
                        <div className="flex items-start gap-3 mb-3">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => handleToggleProduct(product.variantId)}
                            className="mt-1"
                          />
                          <div className="flex items-center gap-2 flex-1">
                            <div className="flex-shrink-0">
                              <div className="w-[53px] h-[53px] rounded-md bg-gray-100 border overflow-hidden">
                                {product.image ? (
                                  <img 
                                    src={product.image} 
                                    alt={product.displayName}
                                    className="w-full h-full object-contain"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                                    <Package className="size-6" />
                                  </div>
                                )}
                              </div>
                            </div>
                            <div>
                              <p className="font-medium text-sm">{product.displayName}</p>
                              <p className="text-xs text-gray-500">Unit: {product.unit || 'N/A'}</p>
                            </div>
                          </div>
                        </div>

                        {/* Stock and Order Info */}
                        <div className="grid grid-cols-2 gap-3 pl-8">
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Current Stock</p>
                            <p className={`text-sm font-semibold ${currentStock === 0 ? 'text-red-600' : 'text-gray-900'}`}>
                              {currentStock} units
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Order Qty</p>
                            {isSelected ? (
                              <Input
                                type="number"
                                min="1"
                                value={quantities[product.variantId] || 0}
                                onChange={(e) => handleQuantityChange(product.variantId, parseInt(e.target.value) || 0)}
                                className="w-full h-8 text-sm"
                              />
                            ) : (
                              <p className="text-sm text-gray-400">-</p>
                            )}
                          </div>
                        </div>

                        {/* Expiry Info for mobile */}
                        {(status === 'expiring' || status === 'expired') && (
                          <div className="pl-8 mt-3 pt-3 border-t border-gray-200">
                            <p className="text-xs text-gray-500 mb-2">Expiry Info</p>
                            {product.batches
                              .filter(batch => 
                                status === 'expiring' ? isExpiringSoon(batch.expiry) : isExpired(batch.expiry)
                              )
                              .map((batch, idx) => (
                                <div key={idx} className="flex items-center gap-2 text-xs mb-1">
                                  <Calendar className="size-3" />
                                  <span className={isExpired(batch.expiry) ? 'text-red-600 font-semibold' : 'text-yellow-600'}>
                                    {new Date(batch.expiry).toLocaleDateString()}
                                  </span>
                                  <span className="text-gray-500">({batch.quantity} units)</span>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between border-t pt-4">
          <div className="text-sm text-gray-600">
            {selectedProducts.size > 0 && (
              <span>
                Total items to order: <strong>{selectedProducts.size}</strong> products, 
                <strong className="ml-1">
                  {Object.values(quantities).reduce((sum, qty) => sum + qty, 0)}
                </strong> units
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose}>
              <X className="size-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={handleCreateOrder}
              disabled={selectedProducts.size === 0}
              className="bg-gradient-to-r from-[#C7359C] to-purple-600"
            >
              <ShoppingCart className="size-4 mr-2" />
              Create Order to Syngenta ({selectedProducts.size})
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}