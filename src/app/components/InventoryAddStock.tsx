import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent } from './ui/card';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Plus, Trash2, Package, Loader2, Save, Search, ShoppingCart, PackagePlus } from 'lucide-react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_URL = `https://${projectId}.supabase.co/functions/v1/make-server-77be783d`;

interface Batch {
  id: string;
  quantity: number;
  price: number;
  expiry: string;
}

interface ProductVariant {
  id: string;
  name: string;
  size: number;
  unit: string;
  price: number;
  barcode: string;
  qrCode: string;
  batches: Batch[];
}

interface Product {
  id: string;
  name: string;
  category: string;
  image: string;
  variants?: ProductVariant[];
}

interface InventoryRow {
  rowId: string;
  product: Product | null;
  selectedVariantId: string;
  batchId: string;
  quantity: number;
  price: number;
  expiry: string;
}

interface InventoryAddStockProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function InventoryAddStock({ isOpen, onClose, onSuccess }: InventoryAddStockProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showProductModal, setShowProductModal] = useState(false);
  const [selectingForRowId, setSelectingForRowId] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  
  const [rows, setRows] = useState<InventoryRow[]>([
    {
      rowId: `row-${Date.now()}`,
      product: null,
      selectedVariantId: '',
      batchId: '',
      quantity: 0,
      price: 0,
      expiry: ''
    }
  ]);

  useEffect(() => {
    if (isOpen) {
      fetchProducts();
    }
  }, [isOpen]);

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
      } else {
        toast.error('Failed to load products');
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error('Error loading products');
    } finally {
      setLoading(false);
    }
  };

  const openProductSelector = (rowId: string) => {
    setSelectingForRowId(rowId);
    setShowProductModal(true);
    setSearchTerm('');
  };

  const handleProductSelect = (product: Product) => {
    if (!selectingForRowId) return;

    setRows(prev => prev.map(row => {
      if (row.rowId === selectingForRowId) {
        const firstVariant = product.variants?.[0];
        return {
          ...row,
          product,
          selectedVariantId: firstVariant?.id || '',
          price: firstVariant?.price || 0
        };
      }
      return row;
    }));

    setShowProductModal(false);
    setSelectingForRowId(null);
  };

  const updateRow = (rowId: string, field: keyof InventoryRow, value: any) => {
    setRows(prev => prev.map(row => {
      if (row.rowId === rowId) {
        // If changing variant, update price
        if (field === 'selectedVariantId') {
          const variant = row.product?.variants?.find(v => v.id === value);
          return {
            ...row,
            [field]: value,
            price: variant?.price || row.price
          };
        }
        return { ...row, [field]: value };
      }
      return row;
    }));
  };

  const addRow = () => {
    const newRow: InventoryRow = {
      rowId: `row-${Date.now()}-${Math.random()}`,
      product: null,
      selectedVariantId: '',
      batchId: '',
      quantity: 0,
      price: 0,
      expiry: ''
    };
    setRows([...rows, newRow]);
  };

  const removeRow = (rowId: string) => {
    if (rows.length === 1) {
      toast.error('At least one row is required');
      return;
    }
    setRows(rows.filter(row => row.rowId !== rowId));
  };

  const validateForm = (): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];
    let hasValidRow = false;

    rows.forEach((row, idx) => {
      // Skip completely empty rows
      const isEmpty = !row.product && !row.batchId && !row.quantity && !row.expiry;
      if (isEmpty) return;

      hasValidRow = true;

      if (!row.product) {
        errors.push(`Row ${idx + 1}: Product is required`);
      }

      if (!row.selectedVariantId) {
        errors.push(`Row ${idx + 1}: Variant must be selected`);
      }

      if (!row.batchId.trim()) {
        errors.push(`Row ${idx + 1}: Batch ID is required`);
      }

      if (!row.quantity || row.quantity <= 0) {
        errors.push(`Row ${idx + 1}: Quantity must be greater than 0`);
      }

      if (!row.price || row.price <= 0) {
        errors.push(`Row ${idx + 1}: Price must be greater than 0`);
      }

      if (!row.expiry) {
        errors.push(`Row ${idx + 1}: Expiry date is required`);
      }
    });

    if (!hasValidRow) {
      errors.push('Please add at least one item');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  };

  const handleSave = async () => {
    const validation = validateForm();
    
    if (!validation.valid) {
      toast.error(validation.errors[0]);
      return;
    }

    setSaving(true);

    try {
      // Group by product
      const productGroups = new Map<string, InventoryRow[]>();
      
      rows.forEach(row => {
        if (row.product && row.selectedVariantId && row.batchId && row.quantity > 0) {
          const productId = row.product.id;
          if (!productGroups.has(productId)) {
            productGroups.set(productId, []);
          }
          productGroups.get(productId)!.push(row);
        }
      });

      // Send requests for each product
      const promises = Array.from(productGroups.entries()).map(([productId, productRows]) => {
        const product = productRows[0].product!;
        const batches = productRows.map(row => {
          const variant = product.variants?.find(v => v.id === row.selectedVariantId);
          return {
            variantId: row.selectedVariantId,
            variantName: variant?.name || '',
            batchId: row.batchId.trim(),
            quantity: Number(row.quantity),
            price: Number(row.price),
            expiry: row.expiry
          };
        });

        return fetch(`${API_URL}/inventory/add`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({
            productId: product.id,
            productName: product.name,
            batches
          })
        });
      });

      const results = await Promise.all(promises);
      const jsonResults = await Promise.all(results.map(r => r.json()));

      const failed = jsonResults.filter(r => !r.success);
      if (failed.length > 0) {
        throw new Error(failed[0].error || 'Some items failed to save');
      }

      const totalItems = rows.filter(r => r.product && r.batchId && r.quantity > 0).length;
      const totalQuantity = rows.reduce((sum, r) => sum + (r.quantity || 0), 0);
      
      toast.success(`Successfully added ${totalQuantity} units across ${totalItems} batch(es)!`);
      
      if (onSuccess) {
        onSuccess();
      }
      
      handleClose();
    } catch (error) {
      console.error('Error adding inventory:', error);
      toast.error('Failed to add inventory: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (!saving) {
      setRows([
        {
          rowId: `row-${Date.now()}`,
          product: null,
          selectedVariantId: '',
          batchId: '',
          quantity: 0,
          price: 0,
          expiry: ''
        }
      ]);
      setSearchTerm('');
      setShowProductModal(false);
      setSelectingForRowId(null);
      setShowSummary(false);
      onClose();
    }
  };

  const handleReview = () => {
    const validation = validateForm();
    
    if (!validation.valid) {
      toast.error(validation.errors[0]);
      return;
    }

    setShowSummary(true);
  };

  const getValidRows = () => {
    return rows.filter(row => row.product && row.selectedVariantId && row.batchId && row.quantity > 0);
  };

  const getTotalQuantity = () => {
    return getValidRows().reduce((sum, r) => sum + r.quantity, 0);
  };

  const getTotalValue = () => {
    return getValidRows().reduce((sum, r) => sum + (r.quantity * r.price), 0);
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
      {/* Main Dialog */}
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="w-[95vw] max-w-[95vw] lg:w-[90vw] lg:max-w-[90vw] h-[90vh] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-[#C7359C] flex items-center gap-2">
              <PackagePlus className="size-6" />
              Add Stock to Inventory
            </DialogTitle>
            <DialogDescription>
              Add multiple products and batches in a table format
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 flex flex-col min-h-0">
            {/* Table Header - Desktop Only */}
            <div className="hidden md:block bg-gray-50 border rounded-lg p-3 mb-3 flex-shrink-0">
              <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-gray-700">
                <div className="col-span-3">Product / Variant</div>
                <div className="col-span-2">Batch ID</div>
                <div className="col-span-2">Quantity</div>
                <div className="col-span-2">Price (PKR)</div>
                <div className="col-span-2">Expiry Date</div>
                <div className="col-span-1 text-center">Action</div>
              </div>
            </div>

            {/* Table Rows - Scrollable */}
            <ScrollArea className="flex-1 min-h-0">
              <div className="space-y-2 pr-4 pb-4">
                {rows.map((row, index) => {
                  const selectedVariant = row.product?.variants?.find(v => v.id === row.selectedVariantId);
                  
                  return (
                    <Card key={row.rowId} className="border-2 border-gray-200 hover:border-purple-300 transition-colors">
                      <CardContent className="p-3">
                        {/* Mobile Layout - Stacked */}
                        <div className="md:hidden space-y-3">
                          {/* Row Number & Delete */}
                          <div className="flex items-center justify-between pb-2 border-b">
                            <span className="text-xs font-semibold text-gray-700">Item #{index + 1}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeRow(row.rowId)}
                              disabled={saving || rows.length === 1}
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>

                          {/* Product & Variant Selection */}
                          <div className="space-y-2">
                            <Label className="text-xs font-semibold text-gray-700">Product / Variant</Label>
                            {!row.product ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => openProductSelector(row.rowId)}
                                disabled={saving}
                                className="w-full h-16 border-dashed border-2 hover:border-[#C7359C] hover:bg-purple-50"
                              >
                                <div className="flex flex-col items-center gap-1">
                                  <ShoppingCart className="size-4 text-gray-400" />
                                  <span className="text-xs">Select Product</span>
                                </div>
                              </Button>
                            ) : (
                              <div className="space-y-2">
                                <div 
                                  className="flex items-center gap-2 p-2 bg-purple-50 rounded border border-purple-200 cursor-pointer hover:bg-purple-100"
                                  onClick={() => openProductSelector(row.rowId)}
                                >
                                  {row.product.image && (
                                    <img 
                                      src={row.product.image} 
                                      alt={row.product.name}
                                      className="size-12 rounded object-cover flex-shrink-0"
                                    />
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-gray-900 line-clamp-2">
                                      {row.product.name}
                                    </p>
                                    <Badge variant="secondary" className="text-[10px] px-1 py-0 mt-1">
                                      {row.product.category}
                                    </Badge>
                                  </div>
                                </div>
                                
                                {row.product.variants && row.product.variants.length > 0 && (
                                  <Select 
                                    value={row.selectedVariantId} 
                                    onValueChange={(val) => updateRow(row.rowId, 'selectedVariantId', val)}
                                    disabled={saving}
                                  >
                                    <SelectTrigger className="h-9 text-sm">
                                      <SelectValue placeholder="Select variant" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {row.product.variants.map(variant => (
                                        <SelectItem key={variant.id} value={variant.id} className="text-sm">
                                          {variant.name} ({variant.size} {variant.unit})
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                                
                                {selectedVariant && (
                                  <p className="text-xs text-blue-600">
                                    📦 Current Stock: {selectedVariant.batches?.reduce((sum, b) => sum + b.quantity, 0) || 0} units
                                  </p>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Batch ID */}
                          <div className="space-y-1">
                            <Label className="text-xs font-semibold text-gray-700">Batch ID</Label>
                            <Input
                              placeholder="BATCH001"
                              value={row.batchId}
                              onChange={(e) => updateRow(row.rowId, 'batchId', e.target.value)}
                              disabled={saving || !row.product}
                              className="h-9 text-sm"
                            />
                          </div>

                          {/* Quantity & Price Row */}
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <Label className="text-xs font-semibold text-gray-700">Quantity</Label>
                              <Input
                                type="number"
                                min="0"
                                placeholder="50"
                                value={row.quantity || ''}
                                onChange={(e) => updateRow(row.rowId, 'quantity', parseFloat(e.target.value) || 0)}
                                disabled={saving || !row.product}
                                className="h-9 text-sm"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs font-semibold text-gray-700">Price (PKR)</Label>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="2500"
                                value={row.price || ''}
                                onChange={(e) => updateRow(row.rowId, 'price', parseFloat(e.target.value) || 0)}
                                disabled={saving || !row.product}
                                className="h-9 text-sm"
                              />
                            </div>
                          </div>

                          {/* Expiry Date */}
                          <div className="space-y-1">
                            <Label className="text-xs font-semibold text-gray-700">Expiry Date</Label>
                            <Input
                              type="date"
                              value={row.expiry}
                              onChange={(e) => updateRow(row.rowId, 'expiry', e.target.value)}
                              disabled={saving || !row.product}
                              className="h-9 text-sm"
                            />
                          </div>
                        </div>

                        {/* Desktop Layout - Grid */}
                        <div className="hidden md:grid grid-cols-12 gap-2 items-start">
                          {/* Product & Variant Selection */}
                          <div className="col-span-3 space-y-2">
                            {!row.product ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => openProductSelector(row.rowId)}
                                disabled={saving}
                                className="w-full h-20 border-dashed border-2 hover:border-[#C7359C] hover:bg-purple-50"
                              >
                                <div className="flex flex-col items-center gap-1">
                                  <ShoppingCart className="size-5 text-gray-400" />
                                  <span className="text-xs">Select Product</span>
                                </div>
                              </Button>
                            ) : (
                              <div className="space-y-2">
                                <div 
                                  className="flex items-center gap-2 p-2 bg-purple-50 rounded border border-purple-200 cursor-pointer hover:bg-purple-100"
                                  onClick={() => openProductSelector(row.rowId)}
                                >
                                  {row.product.image && (
                                    <img 
                                      src={row.product.image} 
                                      alt={row.product.name}
                                      className="size-10 rounded object-cover flex-shrink-0"
                                    />
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold text-gray-900 truncate">
                                      {row.product.name}
                                    </p>
                                    <Badge variant="secondary" className="text-[10px] px-1 py-0">
                                      {row.product.category}
                                    </Badge>
                                  </div>
                                </div>
                                
                                {row.product.variants && row.product.variants.length > 0 && (
                                  <Select 
                                    value={row.selectedVariantId} 
                                    onValueChange={(val) => updateRow(row.rowId, 'selectedVariantId', val)}
                                    disabled={saving}
                                  >
                                    <SelectTrigger className="h-8 text-xs">
                                      <SelectValue placeholder="Select variant" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {row.product.variants.map(variant => (
                                        <SelectItem key={variant.id} value={variant.id} className="text-xs">
                                          {variant.name} ({variant.size} {variant.unit})
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                                
                                {selectedVariant && (
                                  <p className="text-[10px] text-gray-600">
                                    📦 Current: {selectedVariant.batches?.reduce((sum, b) => sum + b.quantity, 0) || 0} units
                                  </p>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Batch ID */}
                          <div className="col-span-2">
                            <Input
                              placeholder="BATCH001"
                              value={row.batchId}
                              onChange={(e) => updateRow(row.rowId, 'batchId', e.target.value)}
                              disabled={saving || !row.product}
                              className="h-9 text-sm"
                            />
                          </div>

                          {/* Quantity */}
                          <div className="col-span-2">
                            <Input
                              type="number"
                              min="0"
                              placeholder="50"
                              value={row.quantity || ''}
                              onChange={(e) => updateRow(row.rowId, 'quantity', parseFloat(e.target.value) || 0)}
                              disabled={saving || !row.product}
                              className="h-9 text-sm"
                            />
                          </div>

                          {/* Price */}
                          <div className="col-span-2">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="2500"
                              value={row.price || ''}
                              onChange={(e) => updateRow(row.rowId, 'price', parseFloat(e.target.value) || 0)}
                              disabled={saving || !row.product}
                              className="h-9 text-sm"
                            />
                          </div>

                          {/* Expiry Date */}
                          <div className="col-span-2">
                            <Input
                              type="date"
                              value={row.expiry}
                              onChange={(e) => updateRow(row.rowId, 'expiry', e.target.value)}
                              disabled={saving || !row.product}
                              className="h-9 text-sm"
                            />
                          </div>

                          {/* Delete Button */}
                          <div className="col-span-1 flex justify-center">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeRow(row.rowId)}
                              disabled={saving || rows.length === 1}
                              className="h-9 w-9 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>

            {/* Add Row Button */}
            <div className="mt-3 flex-shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addRow}
                disabled={saving}
                className="w-full gap-2 border-dashed border-2 h-10"
              >
                <Plus className="size-4" />
                Add Another Row
              </Button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t flex-shrink-0">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={saving}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleReview}
              disabled={saving}
              className="flex-1 bg-[#C7359C] hover:bg-purple-700 gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="size-4" />
                  Add All to Inventory
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Product Selection Modal */}
      <Dialog open={showProductModal} onOpenChange={(open) => {
        if (!open) {
          setShowProductModal(false);
          setSelectingForRowId(null);
        }
      }}>
        <DialogContent className="max-w-5xl h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[#C7359C] flex items-center gap-2">
              <Package className="size-5" />
              Select Product
            </DialogTitle>
            <DialogDescription>
              Choose a product to add to inventory
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 flex flex-col min-h-0">
            {/* Search Bar */}
            <div className="relative mb-4 flex-shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
              <Input
                placeholder="Search products by name, category, or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Products Grid */}
            <ScrollArea className="flex-1 min-h-0">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="size-8 animate-spin text-purple-600" />
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                  <Package className="size-12 mb-3 opacity-50" />
                  <p className="text-sm">No products found</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 pr-4 pb-4">
                  {filteredProducts.map(product => (
                    <Card 
                      key={product.id} 
                      className="cursor-pointer hover:shadow-md transition-all hover:border-[#C7359C] group"
                      onClick={() => handleProductSelect(product)}
                    >
                      <CardContent className="p-3">
                        <div className="flex flex-col gap-2">
                          {product.image && (
                            <div className="w-full aspect-square rounded overflow-hidden bg-gray-100">
                              <img 
                                src={product.image} 
                                alt={product.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                          <div className="space-y-1">
                            <h3 className="font-semibold text-xs line-clamp-2 group-hover:text-[#C7359C] min-h-[2rem] leading-tight">
                              {product.name}
                            </h3>
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              {product.category}
                            </Badge>
                            <p className="text-[10px] text-gray-500">
                              {product.variants?.length || 0} variant(s)
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          <div className="flex gap-3 pt-4 border-t flex-shrink-0">
            <Button
              variant="outline"
              onClick={() => {
                setShowProductModal(false);
                setSelectingForRowId(null);
              }}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Summary Modal */}
      <Dialog open={showSummary} onOpenChange={(open) => {
        if (!open && !saving) {
          setShowSummary(false);
        }
      }}>
        <DialogContent className="w-[95vw] max-w-[95vw] md:max-w-4xl h-[85vh] max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-xl md:text-2xl font-bold text-[#C7359C] flex items-center gap-2">
              <Package className="size-5 md:size-6" />
              Review Inventory Addition
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 flex flex-col min-h-0">
            {/* Invoice Header */}
            <div className="bg-gradient-to-r from-purple-50 to-yellow-50 border-2 border-[#C7359C] rounded-lg p-2 md:p-3 mb-2 flex-shrink-0">
              <div className="flex justify-between items-start mb-1">
                <div>
                  <h3 className="text-base md:text-lg font-bold text-gray-900">Stock Addition Summary</h3>
                  <p className="text-xs text-gray-600">Date: {new Date().toLocaleDateString('en-PK')}</p>
                </div>
                <Badge className="bg-[#C7359C] text-white text-xs">
                  {getValidRows().length} Item(s)
                </Badge>
              </div>
              <div className="grid grid-cols-3 gap-2 md:gap-3 mt-2 pt-2 border-t border-purple-200">
                <div>
                  <p className="text-xs text-gray-600">Batches</p>
                  <p className="text-sm md:text-base font-bold text-gray-900">{getValidRows().length}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Quantity</p>
                  <p className="text-sm md:text-base font-bold text-gray-900">{getTotalQuantity()}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Total Value</p>
                  <p className="text-sm md:text-base font-bold text-[#C7359C]">PKR {getTotalValue().toLocaleString()}</p>
                </div>
              </div>
            </div>

            {/* Invoice Table - Desktop */}
            <div className="hidden md:block flex-shrink-0 mb-1">
              <div className="bg-gray-50 border rounded-t-lg p-1.5">
                <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-gray-700">
                  <div className="col-span-4">Product & Variant</div>
                  <div className="col-span-2">Batch ID</div>
                  <div className="col-span-2">Quantity</div>
                  <div className="col-span-2">Price (PKR)</div>
                  <div className="col-span-2">Expiry Date</div>
                </div>
              </div>
            </div>

            {/* Items List */}
            <ScrollArea className="flex-1 min-h-0">
              <div className="space-y-1.5 pr-2 md:pr-4 pb-2">
                {getValidRows().map((row, index) => {
                  const selectedVariant = row.product?.variants?.find(v => v.id === row.selectedVariantId);
                  const rowTotal = row.quantity * row.price;
                  
                  return (
                    <Card key={row.rowId} className="border border-gray-200 hover:shadow-sm transition-all">
                      <CardContent className="p-1.5 md:p-2">
                        {/* Mobile Layout */}
                        <div className="md:hidden space-y-1.5">
                          <div className="flex items-center gap-2 pb-1.5 border-b">
                            <Badge variant="outline" className="text-xs shrink-0">#{index + 1}</Badge>
                            {row.product?.image && (
                              <img 
                                src={row.product.image} 
                                alt={row.product.name}
                                className="size-8 rounded object-cover shrink-0"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-900 line-clamp-1">
                                {row.product?.name}
                              </p>
                              <p className="text-xs text-gray-600">
                                {selectedVariant?.name} ({selectedVariant?.size} {selectedVariant?.unit})
                              </p>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-1.5 text-xs">
                            <div>
                              <span className="text-gray-600">Batch:</span>
                              <p className="font-semibold">{row.batchId}</p>
                            </div>
                            <div>
                              <span className="text-gray-600">Qty:</span>
                              <p className="font-semibold">{row.quantity}</p>
                            </div>
                            <div>
                              <span className="text-gray-600">Price:</span>
                              <p className="font-semibold">PKR {row.price.toLocaleString()}</p>
                            </div>
                            <div>
                              <span className="text-gray-600">Expiry:</span>
                              <p className="font-semibold">{new Date(row.expiry).toLocaleDateString('en-PK')}</p>
                            </div>
                          </div>
                          
                          <div className="pt-1.5 border-t flex justify-between items-center">
                            <span className="text-xs text-gray-600">Subtotal:</span>
                            <span className="text-sm font-bold text-[#C7359C]">PKR {rowTotal.toLocaleString()}</span>
                          </div>
                        </div>

                        {/* Desktop Layout */}
                        <div className="hidden md:grid grid-cols-12 gap-2 items-center text-sm">
                          <div className="col-span-4 flex items-center gap-2">
                            <Badge variant="outline" className="text-xs shrink-0">#{index + 1}</Badge>
                            {row.product?.image && (
                              <img 
                                src={row.product.image} 
                                alt={row.product.name}
                                className="size-8 rounded object-cover shrink-0"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-gray-900 truncate">
                                {row.product?.name}
                              </p>
                              <p className="text-[10px] text-gray-600">
                                {selectedVariant?.name} ({selectedVariant?.size} {selectedVariant?.unit})
                              </p>
                            </div>
                          </div>
                          <div className="col-span-2 flex items-center">
                            <p className="text-xs font-mono bg-gray-50 px-1.5 py-0.5 rounded">{row.batchId}</p>
                          </div>
                          <div className="col-span-2 flex items-center">
                            <p className="text-xs font-semibold">{row.quantity} units</p>
                          </div>
                          <div className="col-span-2 flex items-center">
                            <div>
                              <p className="text-xs font-semibold">PKR {row.price.toLocaleString()}</p>
                              <p className="text-[10px] text-gray-500">Total: PKR {rowTotal.toLocaleString()}</p>
                            </div>
                          </div>
                          <div className="col-span-2 flex items-center">
                            <p className="text-xs">{new Date(row.expiry).toLocaleDateString('en-PK')}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>

            {/* Invoice Footer */}
            <div className="mt-2 flex-shrink-0 border-t-2 border-gray-300 pt-2">
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 md:gap-3 pt-4 border-t flex-shrink-0">
            <Button
              variant="outline"
              onClick={() => setShowSummary(false)}
              disabled={saving}
              className="flex-1"
            >
              ← Back to Edit
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-[#C7359C] hover:bg-purple-700 gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="size-4" />
                  Confirm & Submit
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}