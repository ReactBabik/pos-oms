import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ScrollArea } from './ui/scroll-area';
import { 
  Search, 
  AlertTriangle, 
  Package, 
  TrendingDown, 
  TrendingUp,
  Filter,
  Download,
  RefreshCw,
  Calendar,
  DollarSign,
  Boxes,
  AlertCircle,
  CheckCircle2,
  Clock,
  BarChart3,
  FileDown,
  Loader2,
  History,
  ArrowUpCircle,
  ArrowDownCircle,
  Edit,
  ShoppingCart,
  Upload,
  ChevronDown
} from 'lucide-react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import type { Language } from '../App';
import { useFranchiseFilters } from '../utils/franchiseFilters';
import { InventoryMovementLogs } from './InventoryMovementLogs';
import { InventoryStatusModal } from './InventoryStatusModal';
import { BulkInventoryUpload } from './BulkInventoryUpload';
import { InventoryAddStock } from './InventoryAddStock';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Label } from "./ui/label";

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
  unit: string;
  price: number;
  agiCode: string;
  qrCode: string;
  batches: Batch[];
}

interface Product {
  id: string;
  name: string;
  category: string;
  image: string;
  variants?: ProductVariant[];
  createdAt?: string;
  updatedAt?: string;
}

export function Inventory({ language, onCreateOrderFromInventory }: { language: Language; onCreateOrderFromInventory?: (items: any[]) => void }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<string>('all');
  const [expiryFilter, setExpiryFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('name');

  const franchiseFilters = useFranchiseFilters();

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<'low' | 'out' | 'expiring' | 'expired' | null>(null);
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const [manualAddOpen, setManualAddOpen] = useState(false);
  const [showDateDialog, setShowDateDialog] = useState(false);
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setDate(1)).toISOString().split('T')[0], // First day of month
    end: new Date().toISOString().split('T')[0] // Today
  });

  useEffect(() => {
    fetchProducts();
  }, []);

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
        // Debug: Log products to check if AGI codes are present
        console.log('Inventory - Loaded products:', data.products);
        setProducts(data.products || []);
      } else {
        toast.error('Failed to load inventory');
      }
    } catch (error) {
      console.error('Error fetching inventory:', error);
      toast.error('Error loading inventory');
    } finally {
      setLoading(false);
    }
  };

  // Flatten products to variants for display
  const flattenedVariants = products.flatMap(product => {
    if (!product.variants || product.variants.length === 0) {
      // For backward compatibility with old products without variants
      return [{
        variantId: product.id,
        displayName: product.name,
        productId: product.id,
        productName: product.name,
        variantName: '',
        category: product.category,
        image: product.image,
        unit: '',
        price: 0,
        barcode: '',
        qrCode: '',
        batches: []
      }];
    }
    
    return product.variants.map(variant => ({
      ...variant,
      variantId: variant.id,
      displayName: `${product.name} ${variant.name}`,
      productId: product.id,
      productName: product.name,
      variantName: variant.name,
      category: product.category,
      image: product.image,
    }));
  });

  const getTotalQuantity = (batches: Batch[]) => {
    return batches.reduce((sum, batch) => sum + batch.quantity, 0);
  };

  const getTotalValue = (variant: any) => {
    return variant.batches.reduce((sum: number, batch: Batch) => sum + batch.quantity * batch.price, 0);
  };

  const getAveragePrice = (batches: Batch[]) => {
    if (batches.length === 0) return 0;
    const totalValue = batches.reduce((sum, batch) => sum + batch.quantity * batch.price, 0);
    const totalQuantity = batches.reduce((sum, batch) => sum + batch.quantity, 0);
    return totalQuantity > 0 ? totalValue / totalQuantity : 0;
  };

  const isLowStock = (variant: any) => {
    const totalStock = getTotalQuantity(variant.batches);
    // Consider low stock if less than 20 units
    return totalStock < 20 && totalStock > 0;
  };

  const isOutOfStock = (variant: any) => {
    return getTotalQuantity(variant.batches) === 0;
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

  const hasExpiringSoonBatch = (variant: any) => {
    return variant.batches.some((batch: Batch) => isExpiringSoon(batch.expiry));
  };

  const hasExpiredBatch = (variant: any) => {
    return variant.batches.some((batch: Batch) => isExpired(batch.expiry));
  };

  // Get unique categories
  const categories = Array.from(new Set(products.map(p => p.category))).filter(Boolean);

  // Apply filters
  const filteredVariants = flattenedVariants.filter(variant => {
    // Search filter
    const matchesSearch = 
      variant.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      variant.productId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      variant.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      variant.agiCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      variant.qrCode?.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    // Category filter
    if (categoryFilter !== 'all' && variant.category !== categoryFilter) return false;

    // Stock filter
    if (stockFilter === 'low' && !isLowStock(variant)) return false;
    if (stockFilter === 'out' && !isOutOfStock(variant)) return false;
    if (stockFilter === 'in' && isOutOfStock(variant)) return false;

    // Expiry filter
    if (expiryFilter === 'expiring' && !hasExpiringSoonBatch(variant)) return false;
    if (expiryFilter === 'expired' && !hasExpiredBatch(variant)) return false;


    return true;
  });

  // Sort variants
  const sortedVariants = [...filteredVariants].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return (a.displayName || '').trim().toLowerCase().localeCompare((b.displayName || '').trim().toLowerCase());
      case 'stock-asc':
        return getTotalQuantity(a.batches) - getTotalQuantity(b.batches);
      case 'stock-desc':
        return getTotalQuantity(b.batches) - getTotalQuantity(a.batches);
      case 'value-desc':
        return getTotalValue(b) - getTotalValue(a);
      case 'value-asc':
        return getTotalValue(a) - getTotalValue(b);
      default:
        return 0;
    }
  });

  // Calculate statistics based on variants
  const totalInventoryValue = flattenedVariants.reduce((sum, variant) => sum + getTotalValue(variant), 0);
  const lowStockCount = flattenedVariants.filter(isLowStock).length;
  const outOfStockCount = flattenedVariants.filter(isOutOfStock).length;
  const expiringCount = flattenedVariants.filter(hasExpiringSoonBatch).length;
  const expiredCount = flattenedVariants.filter(hasExpiredBatch).length;
  const totalProducts = products.length;
  const totalVariants = flattenedVariants.length;
  const totalUnits = flattenedVariants.reduce((sum, v) => sum + getTotalQuantity(v.batches), 0);

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['Product Name', 'SKU', 'Category', 'Batch ID', 'Quantity', 'Unit', 'Price', 'Value', 'Expiry Date', 'Status'];
    const rows = sortedVariants.flatMap(variant =>
      variant.batches.map(batch => [
        variant.displayName,
        variant.variantId,
        variant.category,
        batch.id,
        batch.quantity,
        variant.unit,
        batch.price,
        batch.quantity * batch.price,
        new Date(batch.expiry).toLocaleDateString(),
        isExpired(batch.expiry) ? 'Expired' : isExpiringSoon(batch.expiry) ? 'Expiring Soon' : 'Good'
      ])
    );

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success('Inventory exported successfully!');
  };

  // Export to CSV - Current Stock format
  const exportCurrentStock = () => {
    const headers = ['AGI Code', 'Name', 'Type', 'Batch', 'Expiry Date', 'Closing Units', 'Closing Carton', 'Closing Value'];
    const rows = sortedVariants.flatMap(variant =>
      variant.batches.map(batch => [
        variant.agiCode || variant.variantId,
        variant.displayName,
        variant.variantName || variant.unit,
        batch.id,
        new Date(batch.expiry).toLocaleDateString(),
        batch.quantity,
        Math.floor(batch.quantity / (variant.unitsPerCarton || 1)), // Calculate cartons
        batch.quantity * batch.price
      ])
    );

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `current-stock-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success('Current stock exported successfully!');
  };

  // Export to CSV - Sales and Stock format (requires date range)
  const exportSalesAndStock = async (startDate: string, endDate: string) => {
    try {
      // Fetch inventory movements for the date range
      const response = await fetch(`${API_URL}/inventory-movements`, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (!data.success) {
        toast.error('Failed to fetch movement data');
        return;
      }

      const movements = data.movements || [];
      
      // Filter movements by date range
      const filteredMovements = movements.filter((m: any) => {
        const movementDate = new Date(m.timestamp);
        return movementDate >= new Date(startDate) && movementDate <= new Date(endDate);
      });

      // Calculate aggregates for each variant
      const variantAggregates = new Map<string, {
        agiCode: string;
        name: string;
        stockIn: number;
        sales: number;
        salesReturn: number;
        adjustment: number;
        openingInventory: number;
      }>();

      // Initialize with current inventory
      sortedVariants.forEach(variant => {
        const currentQty = getTotalQuantity(variant.batches);
        
        // Calculate opening inventory by reversing movements
        let opening = currentQty;
        filteredMovements.filter((m: any) => m.variantId === variant.variantId).forEach((m: any) => {
          if (m.type === 'IN') opening -= m.quantity;
          if (m.type === 'OUT') opening += m.quantity;
          if (m.type === 'ADJUSTMENT') opening -= m.quantity; // Reverse adjustment
        });

        variantAggregates.set(variant.variantId, {
          agiCode: variant.agiCode || variant.variantId,
          name: variant.displayName,
          stockIn: 0,
          sales: 0,
          salesReturn: 0,
          adjustment: 0,
          openingInventory: Math.max(0, opening)
        });
      });

      // Process movements
      filteredMovements.forEach((movement: any) => {
        const variantData = variantAggregates.get(movement.variantId);
        if (variantData) {
          if (movement.type === 'IN') {
            if (movement.reason?.toLowerCase().includes('return')) {
              variantData.salesReturn += movement.quantity;
            } else {
              variantData.stockIn += movement.quantity;
            }
          } else if (movement.type === 'OUT') {
            variantData.sales += movement.quantity;
          } else if (movement.type === 'ADJUSTMENT') {
            variantData.adjustment += movement.quantity;
          }
        }
      });

      // Generate CSV
      const headers = ['AGI Code', 'Name', 'Opening Inventory', 'Stock In', 'Sales', 'Sales Return', 'Adjustment', 'Closing Inventory'];
      const rows = Array.from(variantAggregates.values()).map(agg => {
        const closing = agg.openingInventory + agg.stockIn - agg.sales + agg.salesReturn + agg.adjustment;
        return [
          agg.agiCode,
          agg.name,
          agg.openingInventory,
          agg.stockIn,
          agg.sales,
          agg.salesReturn,
          agg.adjustment,
          Math.max(0, closing)
        ];
      });

      const csvContent = [
        `Sales and Stock Report (${startDate} to ${endDate})`,
        headers.join(','),
        ...rows.map(row => row.join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sales-and-stock-${startDate}-to-${endDate}.csv`;
      a.click();
      toast.success('Sales and stock report exported successfully!');
    } catch (error) {
      console.error('Error exporting sales and stock:', error);
      toast.error('Failed to export sales and stock report');
    }
  };

  // Handle status card click
  const handleStatusCardClick = (status: 'low' | 'out' | 'expiring' | 'expired') => {
    setSelectedStatus(status);
    setModalOpen(true);
  };

  // Get filtered products based on status
  const getFilteredProductsByStatus = (status: 'low' | 'out' | 'expiring' | 'expired' | null) => {
    if (!status) return [];
    
    switch (status) {
      case 'low':
        return flattenedVariants.filter(isLowStock);
      case 'out':
        return flattenedVariants.filter(isOutOfStock);
      case 'expiring':
        return flattenedVariants.filter(hasExpiringSoonBatch);
      case 'expired':
        return flattenedVariants.filter(hasExpiredBatch);
      default:
        return [];
    }
  };

  // Handle create order from modal
  const handleCreateOrder = async (selectedProducts: { productId: string; productName: string; quantity: number }[]) => {
    if (!onCreateOrderFromInventory) {
      toast.error('Order creation not available');
      return;
    }

    // Format the order items for the Order Management component
    const orderItems = selectedProducts.map(item => {
      const product = products.find(p => p.id === item.productId);
      return {
        productId: item.productId,
        productName: item.productName,
        productImage: product?.image || '',
        quantity: item.quantity,
        scheme: '',
        price: product?.defaultPrice || 0
      };
    });

    // Pass the items to the OrderManagement component via App.tsx
    onCreateOrderFromInventory(orderItems);
    toast.success(`Redirecting to create order with ${selectedProducts.length} products...`);
  };

  return (
    <div className="space-y-4 lg:space-y-6 p-3 lg:p-0">
      {/* Header with Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <h2 className="text-xl lg:text-2xl font-bold text-gray-900 pl-2">Inventory Management</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={fetchProducts}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
                size="sm"
                disabled={sortedVariants.length === 0}
                className="flex items-center gap-2"
              >
                <FileDown className="size-4" />
                <span className="hidden sm:inline">Export</span>
                <ChevronDown className="size-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={exportToCSV}>
                <FileDown className="size-4 mr-2" />
                Inventory (Detailed)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowDateDialog(true)}>
                <BarChart3 className="size-4 mr-2" />
                Sales and Stock
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportCurrentStock}>
                <Package className="size-4 mr-2" />
                Current Stock
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="h-6 w-px bg-gray-300 mx-1 hidden sm:block" />
          <Button
            size="sm"
            onClick={() => setBulkUploadOpen(true)}
            className="flex items-center gap-2 bg-[#FFD700] hover:bg-yellow-500 text-gray-900"
          >
            <Upload className="size-4" />
            <span>Bulk Upload</span>
          </Button>
        </div>
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

      {/* Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 lg:gap-4">
        <Card className="col-span-1">
          <CardContent className="pt-4 lg:pt-6">
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <Package className="size-5 lg:size-6 text-blue-600" />
              </div>
              <p className="text-xs lg:text-sm text-gray-600 mt-1">Total Products</p>
              <p className="text-xl lg:text-2xl font-bold">{totalProducts}</p>
              <p className="text-xs text-gray-500">{totalVariants} variants | {totalUnits.toLocaleString()} units</p>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardContent className="pt-4 lg:pt-6">
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <DollarSign className="size-5 lg:size-6 text-green-600" />
              </div>
              <p className="text-xs lg:text-sm text-gray-600 mt-1">Total Value</p>
              <p className="text-lg lg:text-xl font-bold">PKR {totalInventoryValue.toLocaleString()}</p>
              <p className="text-xs text-gray-500">Inventory worth</p>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1 cursor-pointer hover:shadow-lg transition-shadow" onClick={() => handleStatusCardClick('low')}>
          <CardContent className="pt-4 lg:pt-6">
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <TrendingDown className="size-5 lg:size-6 text-orange-600" />
              </div>
              <p className="text-xs lg:text-sm text-gray-600 mt-1">Low Stock</p>
              <p className="text-xl lg:text-2xl font-bold text-orange-600">{lowStockCount}</p>
              <p className="text-xs text-gray-500">Need reorder</p>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1 cursor-pointer hover:shadow-lg transition-shadow" onClick={() => handleStatusCardClick('out')}>
          <CardContent className="pt-4 lg:pt-6">
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <AlertCircle className="size-5 lg:size-6 text-red-600" />
              </div>
              <p className="text-xs lg:text-sm text-gray-600 mt-1">Out of Stock</p>
              <p className="text-xl lg:text-2xl font-bold text-red-600">{outOfStockCount}</p>
              <p className="text-xs text-gray-500">Urgent</p>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1 cursor-pointer hover:shadow-lg transition-shadow" onClick={() => handleStatusCardClick('expiring')}>
          <CardContent className="pt-4 lg:pt-6">
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <Clock className="size-5 lg:size-6 text-yellow-600" />
              </div>
              <p className="text-xs lg:text-sm text-gray-600 mt-1">Expiring Soon</p>
              <p className="text-xl lg:text-2xl font-bold text-yellow-600">{expiringCount}</p>
              <p className="text-xs text-gray-500">Within 60 days</p>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1 cursor-pointer hover:shadow-lg transition-shadow" onClick={() => handleStatusCardClick('expired')}>
          <CardContent className="pt-4 lg:pt-6">
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <AlertTriangle className="size-5 lg:size-6 text-red-600" />
              </div>
              <p className="text-xs lg:text-sm text-gray-600 mt-1">Expired</p>
              <p className="text-xl lg:text-2xl font-bold text-red-600">{expiredCount}</p>
              <p className="text-xs text-gray-500">Remove now</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Tabs defaultValue="inventory" className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
          <TabsTrigger value="inventory" className="flex items-center gap-2">
            <Package className="size-4" />
            <span>Inventory</span>
          </TabsTrigger>
          <TabsTrigger value="movements" className="flex items-center gap-2">
            <History className="size-4" />
            <span>Movement Logs</span>
          </TabsTrigger>
        </TabsList>

        {/* Inventory Tab */}
        <TabsContent value="inventory" className="mt-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div>
              <CardTitle className="text-lg">Inventory Details</CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
            <Input
              placeholder="Search by name, SKU, AGI code, QR code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-9 lg:h-10"
            />
          </div>


          {/* Filters Row */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 lg:gap-3">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-9 text-xs lg:text-sm">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={stockFilter} onValueChange={setStockFilter}>
              <SelectTrigger className="h-9 text-xs lg:text-sm">
                <SelectValue placeholder="Stock Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stock</SelectItem>
                <SelectItem value="in">In Stock</SelectItem>
                <SelectItem value="low">Low Stock</SelectItem>
                <SelectItem value="out">Out of Stock</SelectItem>
              </SelectContent>
            </Select>

            <Select value={expiryFilter} onValueChange={setExpiryFilter}>
              <SelectTrigger className="h-9 text-xs lg:text-sm">
                <SelectValue placeholder="Expiry Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Expiry</SelectItem>
                <SelectItem value="expiring">Expiring Soon</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="h-9 text-xs lg:text-sm col-span-2 lg:col-span-1">
                <SelectValue placeholder="Sort By" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name (A-Z)</SelectItem>
                <SelectItem value="stock-desc">Stock (High-Low)</SelectItem>
                <SelectItem value="stock-asc">Stock (Low-High)</SelectItem>
                <SelectItem value="value-desc">Value (High-Low)</SelectItem>
                <SelectItem value="value-asc">Value (Low-High)</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchTerm('');
                setCategoryFilter('all');
                setStockFilter('all');
                setExpiryFilter('all');
                setSortBy('name');
                franchiseFilters.clearFranchiseFilters();
              }}
              className="h-9 text-xs lg:text-sm col-span-2 lg:col-span-1"
            >
              <RefreshCw className="size-3 lg:size-4 mr-1" />
              Clear Filters
            </Button>
          </div>

          {/* Inventory Table */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-8 animate-spin text-purple-600" />
            </div>
          ) : sortedVariants.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <Package className="size-12 mb-3 opacity-50" />
              <p className="text-sm">No products found</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              {/* Desktop Table View */}
              <div className="hidden lg:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="font-semibold">Product</TableHead>
                      <TableHead className="font-semibold">Category</TableHead>
                      <TableHead className="font-semibold">Batch ID</TableHead>
                      <TableHead className="font-semibold text-right">Stock</TableHead>
                      <TableHead className="font-semibold text-right">Price/Unit</TableHead>
                      <TableHead className="font-semibold text-right">Batch Value</TableHead>
                      <TableHead className="font-semibold">Expiry Date</TableHead>
                      <TableHead className="font-semibold">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedVariants.map((variant) => {
                      const totalStock = getTotalQuantity(variant.batches);
                      const totalValue = getTotalValue(variant);
                      
                      if (variant.batches.length === 0) {
                        return (
                          <TableRow key={`${variant.variantId}-empty`}>
                            <TableCell className="font-medium">
                              <div>
                                <p className="font-semibold">{variant.displayName}</p>
                                {variant.agiCode ? (
                                  <p className="text-xs text-gray-500 font-mono">AGI: {variant.agiCode}</p>
                                ) : (
                                  <p className="text-xs text-gray-500">{variant.variantId}</p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="text-xs">{variant.category}</Badge>
                            </TableCell>
                            <TableCell colSpan={5} className="text-center text-gray-500">
                              <div className="flex items-center justify-center gap-2">
                                <AlertCircle className="size-4 text-red-600" />
                                <span className="text-sm">No batches available - Out of stock</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="destructive" className="text-xs">Out of Stock</Badge>
                            </TableCell>
                          </TableRow>
                        );
                      }

                      return variant.batches.map((batch, index) => (
                        <TableRow key={`${variant.variantId}-${batch.id}`}>
                          {index === 0 && (
                            <>
                              <TableCell rowSpan={variant.batches.length} className="font-medium border-r">
                                <div className="flex items-start gap-3">
                                  {variant.image && (
                                    <img 
                                      src={variant.image} 
                                      alt={variant.productName}
                                      className="size-10 rounded object-cover"
                                    />
                                  )}
                                  <div>
                                    <p className="font-semibold">{variant.displayName}</p>
                                    {variant.agiCode ? (
                                      <p className="text-xs text-gray-500 font-mono">AGI: {variant.agiCode}</p>
                                    ) : (
                                      <p className="text-xs text-gray-500">{variant.variantId}</p>
                                    )}
                                    <div className="flex items-center gap-2 mt-1">
                                      {isLowStock(variant) && (
                                        <Badge variant="outline" className="text-[10px] text-orange-600 border-orange-300">
                                          Low Stock
                                        </Badge>
                                      )}
                                      {hasExpiringSoonBatch(variant) && (
                                        <Badge variant="outline" className="text-[10px] text-yellow-600 border-yellow-300">
                                          Expiring Soon
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell rowSpan={variant.batches.length} className="border-r">
                                <Badge variant="secondary" className="text-xs">{variant.category}</Badge>
                                <p className="text-xs text-gray-500 mt-1">
                                  Total: {totalStock}
                                </p>
                                <p className="text-xs font-semibold text-purple-600 mt-1">
                                  PKR {totalValue.toLocaleString()}
                                </p>
                              </TableCell>
                            </>
                          )}
                          <TableCell className="font-mono text-xs">
                            {batch.id}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {batch.quantity}
                          </TableCell>
                          <TableCell className="text-right">
                            PKR {batch.price.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-purple-600">
                            PKR {(batch.quantity * batch.price).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Calendar className="size-3 text-gray-400" />
                              <span className={
                                isExpired(batch.expiry) ? 'text-red-600 font-semibold' :
                                isExpiringSoon(batch.expiry) ? 'text-yellow-600 font-semibold' : 
                                'text-gray-700'
                              }>
                                {new Date(batch.expiry).toLocaleDateString()}
                              </span>
                            </div>
                            {isExpiringSoon(batch.expiry) && !isExpired(batch.expiry) && (
                              <p className="text-[10px] text-yellow-600 mt-1">
                                {Math.floor((new Date(batch.expiry).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days left
                              </p>
                            )}
                          </TableCell>
                          <TableCell>
                            {isExpired(batch.expiry) ? (
                              <Badge variant="destructive" className="text-xs flex items-center gap-1 w-fit">
                                <AlertTriangle className="size-3" />
                                Expired
                              </Badge>
                            ) : isExpiringSoon(batch.expiry) ? (
                              <Badge className="text-xs bg-yellow-500 hover:bg-yellow-600 flex items-center gap-1 w-fit">
                                <Clock className="size-3" />
                                Expiring Soon
                              </Badge>
                            ) : totalStock < 10 ? (
                              <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">
                                Low Qty
                              </Badge>
                            ) : totalStock < 20 ? (
                              <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-300">
                                Getting Low
                              </Badge>
                            ) : (
                              <Badge className="text-xs bg-green-600 hover:bg-green-700 flex items-center gap-1 w-fit">
                                <CheckCircle2 className="size-3" />
                                Good
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ));
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Card View */}
              <div className="lg:hidden space-y-3 p-3">
                {sortedVariants.map((variant) => {
                  const totalStock = getTotalQuantity(variant.batches);
                  const totalValue = getTotalValue(variant);
                  
                  return (
                    <Card key={`mobile-${variant.variantId}`} className="overflow-hidden">
                      <CardHeader className="pb-3 bg-gray-50 border-b">
                        <div className="flex items-start gap-3">
                          {variant.image && (
                            <img 
                              src={variant.image} 
                              alt={variant.productName}
                              className="size-12 rounded object-cover flex-shrink-0"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-sm font-semibold truncate">{variant.displayName}</CardTitle>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="secondary" className="text-[10px]">{variant.category}</Badge>
                              {variant.agiCode ? (
                                <span className="text-xs text-gray-500 font-mono">AGI: {variant.agiCode}</span>
                              ) : (
                                <span className="text-xs text-gray-500">{variant.variantId}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                              <div className="text-xs">
                                <span className="text-gray-600">Stock:</span>
                                <span className="font-semibold ml-1">{totalStock} {variant.unit}</span>
                              </div>
                              <div className="text-xs">
                                <span className="text-gray-600">Value:</span>
                                <span className="font-semibold text-purple-600 ml-1">PKR {totalValue.toLocaleString()}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {isOutOfStock(variant) && (
                            <Badge variant="destructive" className="text-[10px]">Out of Stock</Badge>
                          )}
                          {isLowStock(variant) && !isOutOfStock(variant) && (
                            <Badge variant="outline" className="text-[10px] text-orange-600 border-orange-300">Low Stock</Badge>
                          )}
                          {hasExpiringSoonBatch(variant) && (
                            <Badge variant="outline" className="text-[10px] text-yellow-600 border-yellow-300">Expiring Soon</Badge>
                          )}
                          {hasExpiredBatch(variant) && (
                            <Badge variant="destructive" className="text-[10px]">Has Expired Batch</Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="p-3">
                        {variant.batches.length === 0 ? (
                          <div className="text-center py-4 text-gray-500 text-sm">
                            <AlertCircle className="size-8 mx-auto mb-2 text-red-600" />
                            No batches available
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-xs font-semibold text-gray-700 mb-2">Batches ({variant.batches.length})</p>
                            {variant.batches.map((batch) => (
                              <div key={`${variant.variantId}-${batch.id}`} className="bg-gray-50 rounded-lg p-2 border">
                                <div className="flex items-start justify-between mb-2">
                                  <div>
                                    <p className="text-xs font-mono font-semibold text-gray-700">{batch.id}</p>
                                    <p className="text-xs text-gray-600 mt-0.5">
                                      {batch.quantity} {variant.unit} × PKR {batch.price.toLocaleString()}
                                    </p>
                                  </div>
                                  <p className="text-xs font-bold text-purple-600">
                                    PKR {(batch.quantity * batch.price).toLocaleString()}
                                  </p>
                                </div>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1 text-xs">
                                    <Calendar className="size-3 text-gray-400" />
                                    <span className={
                                      isExpired(batch.expiry) ? 'text-red-600 font-semibold' :
                                      isExpiringSoon(batch.expiry) ? 'text-yellow-600 font-semibold' : 
                                      'text-gray-600'
                                    }>
                                      {new Date(batch.expiry).toLocaleDateString()}
                                    </span>
                                  </div>
                                  {isExpired(batch.expiry) ? (
                                    <Badge variant="destructive" className="text-[10px]">Expired</Badge>
                                  ) : isExpiringSoon(batch.expiry) ? (
                                    <Badge className="text-[10px] bg-yellow-500">Expiring</Badge>
                                  ) : (
                                    <Badge className="text-[10px] bg-green-600">Good</Badge>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
        </TabsContent>

        {/* Movement Logs Tab */}
        <TabsContent value="movements" className="mt-4">
          <InventoryMovementLogs />
        </TabsContent>
      </Tabs>

      {/* Inventory Status Modal */}
      <InventoryStatusModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedStatus(null);
        }}
        status={selectedStatus}
        products={getFilteredProductsByStatus(selectedStatus)}
        onCreateOrder={handleCreateOrder}
      />

      {/* Bulk Inventory Upload Modal */}
      <BulkInventoryUpload
        isOpen={bulkUploadOpen}
        onClose={() => setBulkUploadOpen(false)}
        onSuccess={fetchProducts}
      />

      {/* Manual Inventory Add Modal */}
      <InventoryAddStock
        isOpen={manualAddOpen}
        onClose={() => setManualAddOpen(false)}
        onSuccess={fetchProducts}
      />

      {/* Date Range Dialog for Sales and Stock Export */}
      <Dialog open={showDateDialog} onOpenChange={setShowDateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="size-5 text-purple-600" />
              Sales and Stock Export
            </DialogTitle>
            <DialogDescription>
              Select the date range for the sales and stock report
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="start-date">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="end-date">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter className="flex-row gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowDateDialog(false)}
              className="flex-1 sm:flex-none"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                exportSalesAndStock(dateRange.start, dateRange.end);
                setShowDateDialog(false);
              }}
              className="flex-1 sm:flex-none bg-[#C7359C] hover:bg-purple-700"
            >
              <FileDown className="size-4 mr-2" />
              Export
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}