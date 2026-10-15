import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { 
  ArrowLeft, 
  Plus, 
  Minus,
  Search,
  Loader2,
  ShoppingCart,
  Trash2,
  Send,
  Package,
  X,
  AlertCircle,
  Calendar,
  MapPin,
  FileText,
  Tag,
  Heart
} from 'lucide-react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import type { Language } from '../App';

const API_URL = `https://${projectId}.supabase.co/functions/v1/make-server-77be783d`;

interface ProductVariant {
  id: string;
  name: string;
  unit: string;
  price: number;
  barcode: string;
  qrCode: string;
  batches: any[];
}

interface Product {
  id: string;
  name: string;
  category: string;
  image: string;
  variants?: ProductVariant[];
}

interface FlattenedProduct {
  id: string;
  productId: string;
  variantId: string;
  displayName: string;
  name: string;
  variantName: string;
  category: string;
  unit: string;
  price: number;
  image: string;
}

interface OrderItem {
  productId: string;
  variantId: string;
  productName: string;
  variantName: string;
  productImage: string;
  quantity: number;
  scheme: string;
  price: number;
}

export function OrderCreation({ 
  language, 
  onBack,
  initialItems
}: { 
  language: Language; 
  onBack: () => void;
  initialItems?: any[];
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<FlattenedProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  
  // Order state
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [showCheckoutDialog, setShowCheckoutDialog] = useState(false);
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState<string>('');
  const [deliveryAddress, setDeliveryAddress] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Quantity selection dialog
  const [showQuantityDialog, setShowQuantityDialog] = useState(false);
  const [selectedFlatProduct, setSelectedFlatProduct] = useState<FlattenedProduct | null>(null);
  const [quantityInput, setQuantityInput] = useState<string>('1');

  useEffect(() => {
    fetchProducts();
  }, []);

  // Load initialItems if provided
  useEffect(() => {
    if (initialItems && initialItems.length > 0) {
      setOrderItems(initialItems);
      toast.success(`${initialItems.length} products loaded from inventory`);
    }
  }, [initialItems]);

  useEffect(() => {
    filterProducts();
  }, [searchTerm, selectedCategory, products]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/products`, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setProducts(data.products || []);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error('Error loading products');
    } finally {
      setLoading(false);
    }
  };

  const filterProducts = () => {
    let filtered = products;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.category.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by category
    if (selectedCategory !== 'All') {
      filtered = filtered.filter(p => p.category === selectedCategory);
    }

    // Flatten products with variants
    const flattened: FlattenedProduct[] = filtered.flatMap(product => {
      if (product.variants && product.variants.length > 0) {
        return product.variants.map(variant => ({
          id: `${product.id}-${variant.id}`,
          productId: product.id,
          variantId: variant.id,
          displayName: `${product.name} - ${variant.name}`,
          name: product.name,
          variantName: variant.name,
          category: product.category,
          unit: variant.unit,
          price: variant.price,
          image: product.image
        }));
      } else {
        // Legacy products without variants
        return [{
          id: product.id,
          productId: product.id,
          variantId: '',
          displayName: product.name,
          name: product.name,
          variantName: '',
          category: product.category,
          unit: '',
          price: 0,
          image: product.image
        }];
      }
    });

    setFilteredProducts(flattened);
  };

  const handleProductClick = (product: FlattenedProduct) => {
    setSelectedFlatProduct(product);
    // Check if this variant is already in cart
    const existingItem = orderItems.find(
      item => item.productId === product.productId && item.variantId === product.variantId
    );
    setQuantityInput(existingItem ? existingItem.quantity.toString() : '1');
    setShowQuantityDialog(true);
  };

  const handleAddQuantity = (amount: number) => {
    const currentQty = parseInt(quantityInput) || 0;
    const newQty = currentQty + amount;
    if (newQty > 0) {
      setQuantityInput(newQty.toString());
    }
  };

  const handleSetQuantity = (quantity: number) => {
    setQuantityInput(quantity.toString());
  };

  const handleConfirmQuantity = () => {
    if (!selectedFlatProduct) return;
    
    const quantity = parseInt(quantityInput);
    if (!quantity || quantity <= 0) {
      toast.error('Please enter a valid quantity');
      return;
    }

    const existingIndex = orderItems.findIndex(
      item => item.productId === selectedFlatProduct.productId && item.variantId === selectedFlatProduct.variantId
    );
    
    if (existingIndex >= 0) {
      const updated = [...orderItems];
      updated[existingIndex].quantity = quantity;
      setOrderItems(updated);
      toast.success(`Updated ${selectedFlatProduct.displayName} quantity to ${quantity}`);
    } else {
      const newItem: OrderItem = {
        productId: selectedFlatProduct.productId,
        variantId: selectedFlatProduct.variantId,
        productName: selectedFlatProduct.name,
        variantName: selectedFlatProduct.displayName, // Use full display name: "AXIAL XL 050 EC 330 ML"
        productImage: selectedFlatProduct.image,
        quantity: quantity,
        scheme: '',
        price: selectedFlatProduct.price
      };
      setOrderItems([...orderItems, newItem]);
      toast.success(`Added ${quantity} ${selectedFlatProduct.displayName} to order`);
    }

    setShowQuantityDialog(false);
    setSelectedFlatProduct(null);
    setQuantityInput('1');
  };

  const updateQuantity = (index: number, delta: number) => {
    const updated = [...orderItems];
    const newQuantity = updated[index].quantity + delta;
    
    if (newQuantity <= 0) {
      removeItem(index);
    } else {
      updated[index].quantity = newQuantity;
      setOrderItems(updated);
    }
  };

  const updateScheme = (index: number, scheme: string) => {
    const updated = [...orderItems];
    updated[index].scheme = scheme;
    setOrderItems(updated);
  };

  const removeItem = (index: number) => {
    const updated = orderItems.filter((_, i) => i !== index);
    setOrderItems(updated);
    toast.success('Item removed from order');
  };

  const calculateTotal = () => {
    return orderItems.reduce((sum, item) => sum + (item.quantity * item.price), 0);
  };

  const handleSubmitClick = () => {
    if (orderItems.length === 0) {
      toast.error('Please add at least one product');
      return;
    }
    setShowCheckoutDialog(true);
  };

  const submitOrder = async () => {
    if (!expectedDeliveryDate || !deliveryAddress) {
      toast.error('Please fill in delivery details');
      return;
    }

    setLoading(true);
    try {
      const orderData = {
        orderDate: new Date().toISOString(),
        expectedDeliveryDate,
        status: 'Pending',
        items: orderItems,
        totalAmount: calculateTotal(),
        notes,
        deliveryAddress
      };

      const response = await fetch(`${API_URL}/orders`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(orderData)
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast.success('Order created successfully!');
        setShowCheckoutDialog(false);
        onBack();
      } else {
        toast.error(data.error || 'Failed to create order');
      }
    } catch (error) {
      console.error('Error creating order:', error);
      toast.error('Error creating order');
    } finally {
      setLoading(false);
    }
  };

  const categories = ['All', ...Array.from(new Set(products.map(p => p.category)))];

  return (
    <div className="flex flex-col h-full overflow-hidden bg-gray-50">
      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex gap-3 p-3">
        {/* Left Side - Products */}
        <div className="flex-1 overflow-hidden">
          <Card className="h-full flex flex-col overflow-hidden">
            <CardHeader className="flex-shrink-0 pb-3 p-4">
              <div className="flex items-center gap-3">
                <Button 
                  variant="outline" 
                  onClick={onBack} 
                  size="sm" 
                  className="h-8 px-2"
                >
                  <ArrowLeft className="size-4 mr-1" />
                  Back
                </Button>
                <div className="flex-1">
                  <CardTitle className="text-base">Available Products</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-4 pt-0 flex flex-col gap-3">
              {/* Search */}
              <div className="relative flex-shrink-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                <Input
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-10"
                />
              </div>

              {/* Category Filters */}
              <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 flex-shrink-0">
                {categories.map(cat => (
                  <Button
                    key={cat}
                    variant={selectedCategory === cat ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedCategory(cat)}
                    className={`whitespace-nowrap text-xs h-8 ${
                      selectedCategory === cat 
                        ? 'bg-[#C7359C] hover:bg-[#A62F82] text-white' 
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    {cat}
                  </Button>
                ))}
              </div>

              {/* Products Grid */}
              <div className="flex-1 overflow-y-auto -mr-2 pr-2">
                {loading ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 className="size-10 animate-spin text-[#C7359C]" />
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                    <Package className="size-16 mb-3 opacity-50" />
                    <p className="text-sm">No products found</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-4 pb-2">
                    {filteredProducts.map(product => {
                      const inCart = orderItems.find(
                        item => item.productId === product.productId && item.variantId === product.variantId
                      );
                      return (
                        <div
                          key={product.id}
                          className="bg-white rounded-lg border-2 border-gray-200 hover:border-[#C7359C] active:border-[#C7359C] hover:shadow-lg transition-all duration-200 cursor-pointer p-2 relative group flex flex-col"
                          onClick={() => handleProductClick(product)}
                        >
                          {/* Favorite Icon */}
                          <button 
                            className="absolute top-1.5 right-1.5 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-white rounded-full p-1 shadow-sm hidden sm:block"
                            onClick={(e) => {
                              e.stopPropagation();
                              toast.info('Added to favorites');
                            }}
                          >
                            <Heart className="size-3 text-gray-400 hover:text-[#C7359C] hover:fill-[#C7359C]" />
                          </button>

                          {/* In Cart Badge */}
                          {inCart && (
                            <div className="absolute top-1.5 left-1.5 z-10 bg-[#C7359C] text-white rounded-full px-1.5 py-0.5 text-[9px] font-bold shadow-md">
                              {inCart.quantity}
                            </div>
                          )}

                          {/* Product Image */}
                          <div className="flex items-center justify-center mb-1.5 aspect-square bg-gradient-to-b from-gray-50 to-white rounded overflow-hidden flex-shrink-0">
                            {product.image ? (
                              <img
                                src={product.image}
                                alt={product.displayName}
                                className="w-full h-full object-contain p-1"
                              />
                            ) : (
                              <Package className="size-8 text-gray-300" />
                            )}
                          </div>

                          {/* Product Name */}
                          <div className="h-8 mb-1 flex items-center justify-center flex-shrink-0">
                            <h3 className="text-[10px] font-semibold text-gray-800 line-clamp-2 leading-tight text-center px-0.5">
                              {product.displayName}
                            </h3>
                          </div>

                          {/* Price */}
                          <div className="h-4 flex items-center justify-center mb-0.5 flex-shrink-0">
                            <p className="text-xs font-bold text-[#C7359C]">
                              PKR {product.price.toLocaleString()}
                            </p>
                          </div>

                          {/* Unit */}
                          <div className="h-4 flex items-center justify-center flex-shrink-0">
                            <p className="text-[9px] text-gray-500">
                              {product.unit && <span className="font-semibold text-gray-900">{product.unit}</span>}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Side - Cart Only */}
        <div className="hidden md:flex w-80 lg:w-96 flex-shrink-0">
          <Card className="flex-1 flex flex-col overflow-hidden">
            <CardHeader className="flex-shrink-0 border-b px-3 py-2">
              <div className="flex items-center justify-between w-full">
                <span className="text-sm font-semibold text-[16px]">Cart</span>
                {orderItems.length > 0 && (
                  <Badge variant="default" className="bg-[#C7359C] text-xs py-0.5 px-2 h-5">{orderItems.length} items</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col overflow-hidden p-0">
              {orderItems.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center text-gray-400 p-6">
                    <ShoppingCart className="size-16 mx-auto mb-3 opacity-50" />
                    <p className="font-medium">Cart is empty</p>
                    <p className="text-xs mt-1">Click products to add</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col h-full">
                  {/* Scrollable Cart Items */}
                  <div className="flex-1 overflow-y-auto p-2 pt-1.5">
                    <div className="space-y-1.5">
                      {orderItems.map((item, index) => {
                        const displayName = item.variantName 
                          ? `${item.productName} - ${item.variantName}`
                          : item.productName;
                        
                        return (
                          <div key={index} className="bg-gray-50 rounded-md p-2 border border-gray-200">
                            <div className="flex gap-2">
                              {/* Image */}
                              <div className="w-10 h-10 flex-shrink-0 bg-white rounded overflow-hidden border flex items-center justify-center">
                                {item.productImage ? (
                                  <img 
                                    src={item.productImage} 
                                    alt={displayName}
                                    className="w-full h-full object-contain p-0.5"
                                  />
                                ) : (
                                  <Package className="size-5 text-gray-300" />
                                )}
                              </div>

                              {/* Info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-1 mb-1">
                                  <h4 className="font-semibold text-[11px] text-gray-900 line-clamp-1">
                                    {item.variantName || item.productName}
                                  </h4>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeItem(index)}
                                    className="h-5 w-5 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                                  >
                                    <Trash2 className="size-3" />
                                  </Button>
                                </div>

                                {/* Quantity Controls */}
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1 bg-white rounded p-0.5 border">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => updateQuantity(index, -1)}
                                      className="h-5 w-5 p-0 hover:bg-gray-100"
                                    >
                                      <Minus className="size-2.5" />
                                    </Button>
                                    <Input
                                      type="number"
                                      value={item.quantity}
                                      onChange={(e) => {
                                        const newQty = parseInt(e.target.value);
                                        if (newQty && newQty > 0) {
                                          const updated = [...orderItems];
                                          updated[index].quantity = newQty;
                                          setOrderItems(updated);
                                        } else if (e.target.value === '') {
                                          const updated = [...orderItems];
                                          updated[index].quantity = 0;
                                          setOrderItems(updated);
                                        }
                                      }}
                                      onBlur={(e) => {
                                        if (!e.target.value || parseInt(e.target.value) <= 0) {
                                          const updated = [...orderItems];
                                          updated[index].quantity = 1;
                                          setOrderItems(updated);
                                        }
                                      }}
                                      className="h-5 w-[40px] text-xs font-bold text-center p-0 border-0 focus-visible:ring-1 focus-visible:ring-[#C7359C]"
                                      min="1"
                                    />
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => updateQuantity(index, 1)}
                                      className="h-5 w-5 p-0 hover:bg-gray-100"
                                    >
                                      <Plus className="size-2.5" />
                                    </Button>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-[9px] text-gray-500 leading-none mb-0.5">
                                      {item.price.toLocaleString()} × {item.quantity}
                                    </p>
                                    <p className="font-bold text-[#C7359C] text-xs leading-none">
                                      PKR {(item.quantity * item.price).toLocaleString()}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Total & Submit - Fixed at bottom */}
                  <div className="flex-shrink-0 border-t">
                    {/* Total Section */}
                    <div className="p-3 bg-gradient-to-r from-[#C7359C] to-[#A62F82]">
                      <div className="flex items-center justify-between text-white">
                        <span className="font-semibold text-sm">Total</span>
                        <span className="text-xl font-bold">
                          PKR {calculateTotal().toLocaleString()}
                        </span>
                      </div>
                    </div>
                    {/* Submit Button */}
                    <div className="p-3 bg-gray-50">
                      <Button
                        onClick={handleSubmitClick}
                        className="w-full h-10 bg-[#C7359C] hover:bg-[#A62F82] text-white font-semibold text-sm"
                      >
                        <Send className="size-4 mr-2" />
                        Submit Order
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Checkout Dialog */}
      <Dialog open={showCheckoutDialog} onOpenChange={setShowCheckoutDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="size-5 text-[#C7359C]" />
              Complete Order Details
            </DialogTitle>
            <DialogDescription>
              Please provide delivery information to complete your order
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Order Summary */}
            <div className="bg-gradient-to-r from-[#C7359C] to-[#A62F82] text-white p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">Total Items</p>
                  <p className="text-lg font-bold">{orderItems.length}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm opacity-90">Order Total</p>
                  <p className="text-2xl font-bold">PKR {calculateTotal().toLocaleString()}</p>
                </div>
              </div>
            </div>

            {/* Expected Delivery Date */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <Calendar className="size-4 text-[#C7359C]" />
                Expected Delivery Date
                <span className="text-red-500">*</span>
              </Label>
              <Input
                type="date"
                value={expectedDeliveryDate}
                onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="h-10"
              />
            </div>

            {/* Delivery Address */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <MapPin className="size-4 text-[#C7359C]" />
                Delivery Address
                <span className="text-red-500">*</span>
              </Label>
              <Textarea
                placeholder="Enter complete delivery address with landmarks"
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>

            {/* Order Notes */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <FileText className="size-4 text-[#C7359C]" />
                Order Notes
                <span className="text-xs text-gray-500 font-normal ml-1">(Optional)</span>
              </Label>
              <Textarea
                placeholder="Any special instructions or requests"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="resize-none"
              />
            </div>

            {/* Validation Message */}
            {(!expectedDeliveryDate || !deliveryAddress) && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertCircle className="size-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-800">
                  Please fill in the expected delivery date and delivery address to submit your order
                </p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setShowCheckoutDialog(false)}
              className="flex-1"
              disabled={loading}
            >
              Back to Cart
            </Button>
            <Button
              onClick={submitOrder}
              disabled={loading || !expectedDeliveryDate || !deliveryAddress}
              className="flex-1 bg-[#C7359C] hover:bg-[#A62F82] text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="size-4 mr-2" />
                  Confirm Order
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quantity Dialog */}
      <Dialog open={showQuantityDialog} onOpenChange={setShowQuantityDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="size-5 text-[#C7359C]" />
              Select Quantity
            </DialogTitle>
            <DialogDescription>
              {selectedFlatProduct?.displayName} - PKR {selectedFlatProduct?.price.toLocaleString()}/{selectedFlatProduct?.unit || 'unit'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Manual Quantity Input */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Enter Quantity</Label>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddQuantity(-1)}
                  className="h-10 w-10 p-0"
                >
                  <Minus className="size-4" />
                </Button>
                <Input
                  type="number"
                  value={quantityInput}
                  onChange={(e) => setQuantityInput(e.target.value)}
                  className="h-10 text-center text-lg font-bold flex-1"
                  min="1"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddQuantity(1)}
                  className="h-10 w-10 p-0"
                >
                  <Plus className="size-4" />
                </Button>
              </div>
            </div>

            {/* Quick Preset Buttons */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Quick Select</Label>
              <div className="grid grid-cols-5 gap-2">
                {[5, 10, 25, 50, 100].map(amount => (
                  <Button
                    key={amount}
                    variant="outline"
                    size="sm"
                    onClick={() => handleSetQuantity(amount)}
                    className="h-9 font-semibold hover:bg-[#C7359C] hover:text-white hover:border-[#C7359C]"
                  >
                    {amount}
                  </Button>
                ))}
              </div>
            </div>

            {/* Total Price Preview */}
            {selectedFlatProduct && parseInt(quantityInput) > 0 && (
              <div className="bg-gradient-to-r from-[#C7359C] to-[#A62F82] text-white p-3 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Total Price</span>
                  <span className="text-xl font-bold">
                    PKR {(selectedFlatProduct.price * parseInt(quantityInput)).toLocaleString()}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setShowQuantityDialog(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmQuantity}
              className="flex-1 bg-[#C7359C] hover:bg-[#A62F82] text-white font-semibold"
            >
              <ShoppingCart className="size-4 mr-2" />
              Add to Cart
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}