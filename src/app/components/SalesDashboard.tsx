import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { 
  TrendingUp, 
  DollarSign, 
  ShoppingBag, 
  Users, 
  FileText, 
  Filter, 
  Download, 
  X, 
  Search, 
  RotateCcw,
  Calendar
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  PieChart, 
  Pie, 
  Cell, 
  BarChart, 
  Bar, 
  CartesianGrid, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend 
} from 'recharts';
import { OrderReturnDialog } from './OrderReturnDialog';
import { OrderDetailsDialog } from './OrderDetailsDialog';
import { ReturnsReport } from './ReturnsReport';
import { toast } from 'sonner';
import { ScrollArea } from './ui/scroll-area';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import type { Language } from '../App';
import { useFranchiseFilters } from '../utils/franchiseFilters';

const API_URL = `https://${projectId}.supabase.co/functions/v1/make-server-77be783d`;

// Interface for products
interface Product {
  id: string;
  name: string;
  category: string;
  unit: string;
  defaultPrice: number;
  image?: string;
  batches?: any[];
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'];

export function SalesDashboard({ language }: { language: Language }) {
  const [dateRange, setDateRange] = useState('week');
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [isReturnDialogOpen, setIsReturnDialogOpen] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [returns, setReturns] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Main date filter states (for dashboard KPIs and charts)
  const [dashboardDateFilter, setDashboardDateFilter] = useState<'today' | 'mtd' | 'last7' | 'last30' | 'custom'>('mtd');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  
  const franchiseFilters = useFranchiseFilters();

  // Filter states (for Order-Wise Report table)
  const [showFilters, setShowFilters] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');

  // Fetch sales from database
  const fetchSales = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_URL}/sales`, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`
        }
      });

      const result = await response.json();

      if (result.success && result.sales) {
        // Transform sales data to match order format
        const transformedOrders = result.sales.map((sale: any) => ({
          id: sale.id,
          date: sale.date,
          customer: sale.customer,
          phone: sale.phone,
          items: sale.items.map((item: any) => ({
            id: item.productId || `item-${Date.now()}`,
            productId: item.productId,
            productName: item.productName,
            name: item.productName,
            quantity: item.quantity,
            price: item.price,
            total: item.price * item.quantity,
            image: item.image,
            batchId: item.batchId,
            unit: item.unit,
            expiry: item.expiry
          })),
          subtotal: sale.subtotal || sale.total,
          discount: sale.discount || 0,
          total: sale.total,
          payment: sale.payment,
          status: sale.status || 'Completed'
        }));
        
        setOrders(transformedOrders);
      } else {
        console.error('Failed to fetch sales:', result.error);
        toast.error('Failed to load sales data');
      }
    } catch (error) {
      console.error('Error fetching sales:', error);
      toast.error('Error loading sales data');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch products from database
  const fetchProducts = async () => {
    try {
      const response = await fetch(`${API_URL}/products`, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`
        }
      });

      const result = await response.json();

      if (result.success && result.products) {
        setProducts(result.products);
        console.log('✅ Products loaded successfully:', result.products.length);
      } else {
        console.error('Failed to fetch products:', result.error);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  // Fetch returns from database
  const fetchReturns = async () => {
    try {
      const response = await fetch(`${API_URL}/returns`, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`
        }
      });

      const result = await response.json();

      if (result.success && result.returns) {
        setReturns(result.returns);
        console.log('✅ Returns loaded successfully:', result.returns.length);
      } else {
        console.error('Failed to fetch returns:', result.error);
      }
    } catch (error) {
      console.error('Error fetching returns:', error);
    }
  };

  // Load sales and products on mount
  useEffect(() => {
    fetchSales();
    fetchProducts();
    fetchReturns();
  }, []);

  // Helper function to get date range based on filter
  const getDateRangeForFilter = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let startDate: Date;
    let endDate: Date = now;

    switch (dashboardDateFilter) {
      case 'today':
        startDate = today;
        break;
      case 'mtd':
        // Month to date - from 1st of current month
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'last7':
        startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'last30':
        startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 30);
        break;
      case 'custom':
        if (customStartDate && customEndDate) {
          startDate = new Date(customStartDate);
          endDate = new Date(customEndDate);
          endDate.setHours(23, 59, 59, 999);
        } else {
          // Default to MTD if custom dates not set
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        }
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    return { startDate, endDate };
  };

  // Get the label for KPI cards based on filter
  const getDateRangeLabel = () => {
    switch (dashboardDateFilter) {
      case 'today':
        return 'Today';
      case 'mtd':
        return 'Month to Date';
      case 'last7':
        return 'Last 7 Days';
      case 'last30':
        return 'Last 30 Days';
      case 'custom':
        if (customStartDate && customEndDate) {
          return `${new Date(customStartDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${new Date(customEndDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
        }
        return 'Custom Range';
      default:
        return 'Month to Date';
    }
  };

  // Calculate statistics from live data
  const { startDate: filterStartDate, endDate: filterEndDate } = getDateRangeForFilter();

  // Filter orders based on dashboard date filter
  const filteredDashboardOrders = orders.filter(order => {
    const orderDate = new Date(order.date);
    return orderDate >= filterStartDate && orderDate <= filterEndDate;
  });

  // Calculate total sales for the selected period
  const totalSalesAmount = filteredDashboardOrders.reduce((sum, order) => sum + order.total, 0);

  // Total transactions
  const totalTransactions = filteredDashboardOrders.length;

  // Unique customers
  const uniqueCustomers = new Set(filteredDashboardOrders.map(order => order.customer)).size;

  // Calculate daily sales for chart based on filter
  const calculateDailySalesData = () => {
    const dailySalesMap = new Map<string, { sales: number; transactions: number }>();
    
    filteredDashboardOrders.forEach(order => {
      const orderDate = new Date(order.date);
      const dateKey = orderDate.toISOString().split('T')[0];
      
      if (!dailySalesMap.has(dateKey)) {
        dailySalesMap.set(dateKey, { sales: 0, transactions: 0 });
      }
      
      const dayData = dailySalesMap.get(dateKey)!;
      dayData.sales += order.total;
      dayData.transactions += 1;
    });

    // Convert map to array and sort by date
    const dailySalesData = Array.from(dailySalesMap.entries())
      .map(([date, data]) => ({
        date,
        sales: data.sales,
        transactions: data.transactions
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return dailySalesData;
  };

  const dailySalesData = calculateDailySalesData();

  // Calculate category sales
  const productMapById = new Map(products.map(p => [p.id, p]));
  const productMapByName = new Map(products.map(p => [p.name, p]));
  
  const categorySales: { [key: string]: { value: number; count: number } } = {};
  
  // Enhanced debugging
  console.log('=== CATEGORY SALES DEBUG ===');
  console.log('Total products loaded:', products.length);
  console.log('Total orders:', orders.length);
  console.log('Filtered dashboard orders:', filteredDashboardOrders.length);
  
  if (products.length > 0) {
    console.log('Sample products (first 3):', products.slice(0, 3).map(p => ({ 
      id: p.id, 
      name: p.name, 
      category: p.category 
    })));
  }
  
  if (orders.length > 0 && orders[0].items.length > 0) {
    console.log('Sample order items (first order):', orders[0].items.map(i => ({ 
      productId: i.productId, 
      productName: i.productName,
      name: i.name 
    })));
  }
  
  filteredDashboardOrders.forEach((order, orderIndex) => {
    order.items.forEach((item, itemIndex) => {
      // Try to get product category by ID first, then by name
      let product = item.productId ? productMapById.get(item.productId) : null;
      let matchMethod = 'none';
      
      if (product) {
        matchMethod = 'by-id';
      } else {
        product = productMapByName.get(item.name);
        if (product) {
          matchMethod = 'by-name';
        }
      }
      
      const category = product?.category || 'Uncategorized';
      
      // Debug first few items
      if (orderIndex === 0 && itemIndex < 3) {
        console.log(`Item ${itemIndex}:`, {
          productId: item.productId,
          name: item.name,
          matchMethod,
          foundProduct: product ? { id: product.id, name: product.name, category: product.category } : null,
          finalCategory: category
        });
      }
      
      if (!categorySales[category]) {
        categorySales[category] = { value: 0, count: 0 };
      }
      categorySales[category].value += item.total;
      categorySales[category].count += item.quantity;
    });
  });
  
  const categorySalesData = Object.entries(categorySales).map(([name, data]) => ({
    name,
    value: data.value,
    count: data.count
  }));

  console.log('Final category sales:', categorySalesData);
  console.log('Category sales breakdown:', categorySales);
  console.log('========================');

  // Calculate top products based on filtered data
  const productSales: { [key: string]: { units: number; revenue: number } } = {};
  filteredDashboardOrders.forEach(order => {
    order.items.forEach(item => {
      if (!productSales[item.name]) {
        productSales[item.name] = { units: 0, revenue: 0 };
      }
      productSales[item.name].units += item.quantity;
      productSales[item.name].revenue += item.total;
    });
  });
  
  const topProductsData = Object.entries(productSales)
    .map(([name, data]) => ({
      name,
      units: data.units,
      revenue: data.revenue
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  // Get recent transactions (last 5 orders)
  const recentTransactions = [...orders]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5)
    .map(order => ({
      id: order.id,
      date: new Date(order.date).toLocaleString(),
      customer: order.customer,
      items: order.items.length,
      total: order.total,
      payment: order.payment
    }));

  // Filter orders based on criteria
  const filteredOrders = orders.filter(order => {
    // Date filter
    if (dateFrom) {
      const orderDate = new Date(order.date);
      const fromDate = new Date(dateFrom);
      if (orderDate < fromDate) return false;
    }
    if (dateTo) {
      const orderDate = new Date(order.date);
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999); // Include the entire day
      if (orderDate > toDate) return false;
    }

    // Customer search
    if (customerSearch && !order.customer.toLowerCase().includes(customerSearch.toLowerCase())) {
      return false;
    }

    // Product search
    if (productSearch) {
      const hasProduct = order.items.some(item => 
        item.name.toLowerCase().includes(productSearch.toLowerCase())
      );
      if (!hasProduct) return false;
    }

    // Payment filter
    if (paymentFilter !== 'all' && order.payment !== paymentFilter) {
      return false;
    }

    // Amount filter
    if (minAmount && order.total < parseFloat(minAmount)) {
      return false;
    }
    if (maxAmount && order.total > parseFloat(maxAmount)) {
      return false;
    }

    return true;
  });

  const clearFilters = () => {
    setDateFrom('');
    setDateTo('');
    setCustomerSearch('');
    setProductSearch('');
    setPaymentFilter('all');
    setMinAmount('');
    setMaxAmount('');
    franchiseFilters.clearFranchiseFilters();
  };

  const activeFiltersCount = [
    dateFrom,
    dateTo,
    customerSearch,
    productSearch,
    paymentFilter !== 'all',
    minAmount,
    maxAmount
  ].filter(Boolean).length;

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['Order ID', 'Date', 'Time', 'Customer', 'Items Count', 'Amount (PKR)', 'Payment', 'Status'];
    const rows = filteredOrders.map(order => [
      order.id,
      new Date(order.date).toLocaleDateString(),
      new Date(order.date).toLocaleTimeString(),
      order.customer,
      order.items.length,
      order.total,
      order.payment,
      order.status
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `orders_report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success('Report exported successfully', {
      description: `${filteredOrders.length} orders exported to CSV`
    });
  };

  // Export to Excel (detailed)
  const exportToExcel = () => {
    const headers = ['Order ID', 'Date', 'Time', 'Customer', 'Product', 'Quantity', 'Price', 'Subtotal', 'Discount', 'Total', 'Payment', 'Status'];
    const rows: any[] = [];

    filteredOrders.forEach(order => {
      order.items.forEach((item, index) => {
        rows.push([
          index === 0 ? order.id : '',
          index === 0 ? new Date(order.date).toLocaleDateString() : '',
          index === 0 ? new Date(order.date).toLocaleTimeString() : '',
          index === 0 ? order.customer : '',
          item.name,
          item.quantity,
          item.price,
          index === 0 ? order.subtotal : '',
          index === 0 ? order.discount : '',
          index === 0 ? order.total : '',
          index === 0 ? order.payment : '',
          index === 0 ? order.status : ''
        ]);
      });
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `orders_detailed_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success('Detailed report exported successfully', {
      description: `${filteredOrders.length} orders with item details exported`
    });
  };

  const handleOrderClick = (order: any) => {
    setSelectedOrder(order);
    setIsDetailsDialogOpen(true);
  };

  const handleReturnClick = (order: any) => {
    console.log('🔄 Return button clicked for order:', order.id);
    console.log('Order data:', order);
    setSelectedOrder(order);
    setIsReturnDialogOpen(true);
    console.log('Return dialog should be open now');
  };

  const handleReturn = async (returnData: any) => {
    try {
      console.log('📤 Sending return request to backend:', returnData);
      console.log('API URL:', `${API_URL}/sales/${returnData.orderId}/return`);
      
      const response = await fetch(`${API_URL}/sales/${returnData.orderId}/return`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify(returnData)
      });

      console.log('📥 Response status:', response.status);
      const result = await response.json();
      console.log('📥 Response data:', result);

      if (result.success) {
        toast.success(`Return processed successfully for ${returnData.orderId}`, {
          description: `Amount: PKR ${returnData.totalAmount.toLocaleString()}`
        });
        
        // Refresh sales data to show updated statuses
        await fetchSales();
        await fetchReturns();
      } else {
        throw new Error(result.error || 'Failed to process return');
      }
    } catch (error) {
      console.error('❌ Error processing return:', error);
      toast.error('Failed to process return', {
        description: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  };

  return (
    <div className="space-y-6 p-3 lg:p-0">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <h2 className="text-xl lg:text-2xl font-bold text-gray-900 pl-2">Sales Dashboard</h2>
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

      {/* Date Filter Section */}
      <div className="bg-white rounded-lg border border-gray-200 px-4 py-3">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          {/* Quick Filter Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <Calendar className="size-4 text-[#C7359C] flex-shrink-0" />
            <Button
              variant={dashboardDateFilter === 'today' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDashboardDateFilter('today')}
              className={`h-8 px-3 text-xs ${dashboardDateFilter === 'today' ? 'bg-[#C7359C] hover:bg-[#a02d7f]' : ''}`}
            >
              Today
            </Button>
            <Button
              variant={dashboardDateFilter === 'mtd' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDashboardDateFilter('mtd')}
              className={`h-8 px-3 text-xs ${dashboardDateFilter === 'mtd' ? 'bg-[#C7359C] hover:bg-[#a02d7f]' : ''}`}
            >
              MTD
            </Button>
            <Button
              variant={dashboardDateFilter === 'last7' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDashboardDateFilter('last7')}
              className={`h-8 px-3 text-xs ${dashboardDateFilter === 'last7' ? 'bg-[#C7359C] hover:bg-[#a02d7f]' : ''}`}
            >
              Last 7 Days
            </Button>
            <Button
              variant={dashboardDateFilter === 'last30' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDashboardDateFilter('last30')}
              className={`h-8 px-3 text-xs ${dashboardDateFilter === 'last30' ? 'bg-[#C7359C] hover:bg-[#a02d7f]' : ''}`}
            >
              Last 30 Days
            </Button>
            <Button
              variant={dashboardDateFilter === 'custom' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDashboardDateFilter('custom')}
              className={`h-8 px-3 text-xs ${dashboardDateFilter === 'custom' ? 'bg-[#C7359C] hover:bg-[#a02d7f]' : ''}`}
            >
              Custom
            </Button>
          </div>

          {/* Display selected date range */}
          <div className="flex items-center gap-2 text-xs text-gray-600 lg:ml-auto">
            <span className="font-medium text-[#C7359C]">{getDateRangeLabel()}</span>
            <span className="text-gray-400">•</span>
            <span>{filteredDashboardOrders.length} transactions</span>
          </div>
        </div>

        {/* Custom Date Range Inputs */}
        {dashboardDateFilter === 'custom' && (
          <div className="flex flex-col sm:flex-row gap-2 mt-3 pt-3 border-t border-gray-200">
            <div className="flex-1">
              <Input
                id="custom-start-date"
                type="date"
                placeholder="Start Date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="flex-1">
              <Input
                id="custom-end-date"
                type="date"
                placeholder="End Date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Sales</p>
                <p className="text-2xl font-bold">PKR {totalSalesAmount.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">{getDateRangeLabel()}</p>
              </div>
              <DollarSign className="size-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Transactions</p>
                <p className="text-2xl font-bold">{totalTransactions}</p>
                <p className="text-xs text-gray-500 mt-1">{getDateRangeLabel()}</p>
              </div>
              <ShoppingBag className="size-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Unique Customers</p>
                <p className="text-2xl font-bold">{uniqueCustomers}</p>
                <p className="text-xs text-gray-500 mt-1">{getDateRangeLabel()}</p>
              </div>
              <Users className="size-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg Transaction</p>
                <p className="text-2xl font-bold">
                  PKR {totalTransactions > 0 ? Math.round(totalSalesAmount / totalTransactions).toLocaleString() : '0'}
                </p>
                <p className="text-xs text-gray-500 mt-1">{getDateRangeLabel()}</p>
              </div>
              <TrendingUp className="size-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Trend - MINIMALISTIC */}
        <Card>
          <CardHeader>
            <CardTitle>Sales Trend</CardTitle>
            <CardDescription>{getDateRangeLabel()}</CardDescription>
          </CardHeader>
          <CardContent>
            {dailySalesData.length === 0 ? (
              <div className="flex items-center justify-center h-[300px] text-gray-500">
                <div className="text-center">
                  <TrendingUp className="size-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm">No sales data available</p>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dailySalesData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    stroke="#9ca3af"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                    stroke="#9ca3af"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    formatter={(value: any) => [`PKR ${value.toLocaleString()}`, 'Sales']}
                    labelFormatter={(label) => new Date(label).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                    }}
                    cursor={{ stroke: '#C7359C', strokeWidth: 1, strokeDasharray: '5 5' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="sales"
                    stroke="#C7359C"
                    strokeWidth={3}
                    dot={{ fill: '#C7359C', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, fill: '#C7359C', stroke: '#fff', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Category Distribution - MINIMALISTIC */}
        <Card>
          <CardHeader>
            <CardTitle>Category Sales</CardTitle>
            <CardDescription>Revenue by category</CardDescription>
          </CardHeader>
          <CardContent>
            {categorySalesData.length === 0 ? (
              <div className="flex items-center justify-center h-[300px] text-gray-500">
                <div className="text-center">
                  <ShoppingBag className="size-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm">No category data available</p>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={categorySalesData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                      const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                      const x = cx + radius * Math.cos(-midAngle * Math.PI / 180);
                      const y = cy + radius * Math.sin(-midAngle * Math.PI / 180);
                      
                      return percent > 0.05 ? (
                        <text 
                          x={x} 
                          y={y} 
                          fill="white" 
                          textAnchor="middle" 
                          dominantBaseline="central"
                          fontSize={14}
                          fontWeight="600"
                        >
                          {`${(percent * 100).toFixed(0)}%`}
                        </text>
                      ) : null;
                    }}
                    outerRadius={100}
                    innerRadius={60}
                    dataKey="value"
                    paddingAngle={3}
                  >
                    {categorySalesData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={COLORS[index % COLORS.length]}
                        stroke="none"
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any, name, props) => [
                      `PKR ${value.toLocaleString()}`,
                      `${props.payload.count} units`
                    ]}
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                    }}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={50}
                    iconType="circle"
                    formatter={(value) => {
                      const categoryData = categorySalesData.find(d => d.name === value);
                      return `${value}`;
                    }}
                    wrapperStyle={{ fontSize: '13px', paddingTop: '10px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Products and Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products - HORIZONTAL BAR CHART */}
        <Card>
          <CardHeader>
            <CardTitle>Top 10 Products</CardTitle>
            <CardDescription>Best sellers by revenue</CardDescription>
          </CardHeader>
          <CardContent>
            {topProductsData.length === 0 ? (
              <div className="flex items-center justify-center h-[400px] text-gray-500">
                <div className="text-center">
                  <ShoppingBag className="size-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm">No product data available</p>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={400}>
                <BarChart 
                  data={topProductsData} 
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis 
                    type="number" 
                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                    stroke="#9ca3af"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    width={150}
                    fontSize={11}
                    stroke="#9ca3af"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => {
                      const maxLength = 20;
                      return value.length > maxLength ? value.substring(0, maxLength) + '...' : value;
                    }}
                  />
                  <Tooltip
                    formatter={(value: any, name, props) => {
                      if (name === 'revenue') {
                        return [`PKR ${value.toLocaleString()}`, 'Revenue'];
                      }
                      return value;
                    }}
                    labelFormatter={(label) => label}
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                    }}
                    cursor={{ fill: 'rgba(199, 53, 156, 0.05)' }}
                  />
                  <Bar 
                    dataKey="revenue" 
                    fill="#C7359C" 
                    radius={[0, 4, 4, 0]}
                    label={{
                      position: 'right',
                      fontSize: 10,
                      fill: '#6b7280',
                      formatter: (value: number) => `${(value / 1000).toFixed(0)}k`
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Recent Transactions */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Payment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentTransactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell className="font-medium">{transaction.id}</TableCell>
                    <TableCell>{transaction.customer}</TableCell>
                    <TableCell>{transaction.items}</TableCell>
                    <TableCell>PKR {transaction.total.toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant={transaction.payment === 'Cash' ? 'default' : 'secondary'}>
                        {transaction.payment}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Order-Wise Report */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="size-5 text-[#C7359C]" />
                  Order-Wise Report
                </CardTitle>
                <CardDescription className="mt-1">
                  View detailed order information and process returns
                </CardDescription>
              </div>
              <Badge className="bg-gradient-to-r from-[#C7359C] to-purple-600">
                {filteredOrders.length} of {orders.length} Orders
              </Badge>
            </div>

            {/* Filter and Export Controls */}
            <div className="flex flex-col md:flex-row gap-3">
              {/* Filter Toggle Button */}
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2"
              >
                <Filter className="size-4" />
                Filters
                {activeFiltersCount > 0 && (
                  <Badge variant="secondary" className="ml-1">{activeFiltersCount}</Badge>
                )}
              </Button>

              {/* Export Buttons */}
              <div className="flex gap-2 flex-1 md:flex-initial">
                <Button
                  variant="outline"
                  onClick={exportToCSV}
                  className="flex items-center gap-2 flex-1 md:flex-initial"
                >
                  <Download className="size-4" />
                  <span className="hidden md:inline">Export CSV</span>
                  <span className="md:hidden">CSV</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={exportToExcel}
                  className="flex items-center gap-2 flex-1 md:flex-initial"
                >
                  <Download className="size-4" />
                  <span className="hidden md:inline">Export Detailed</span>
                  <span className="md:hidden">Detailed</span>
                </Button>
              </div>

              {/* Clear Filters */}
              {activeFiltersCount > 0 && (
                <Button
                  variant="ghost"
                  onClick={clearFilters}
                  className="flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <X className="size-4" />
                  Clear All
                </Button>
              )}
            </div>

            {/* Filter Panel */}
            {showFilters && (
              <div className="border rounded-lg p-4 bg-gray-50 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Date From */}
                  <div className="space-y-2">
                    <Label htmlFor="date-from" className="text-sm font-medium">
                      Date From
                    </Label>
                    <Input
                      id="date-from"
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="w-full"
                    />
                  </div>

                  {/* Date To */}
                  <div className="space-y-2">
                    <Label htmlFor="date-to" className="text-sm font-medium">
                      Date To
                    </Label>
                    <Input
                      id="date-to"
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="w-full"
                    />
                  </div>

                  {/* Payment Method */}
                  <div className="space-y-2">
                    <Label htmlFor="payment-filter" className="text-sm font-medium">
                      Payment Method
                    </Label>
                    <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                      <SelectTrigger id="payment-filter">
                        <SelectValue placeholder="All Methods" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Methods</SelectItem>
                        <SelectItem value="Cash">Cash</SelectItem>
                        <SelectItem value="Credit">Credit</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Customer Search */}
                  <div className="space-y-2">
                    <Label htmlFor="customer-search" className="text-sm font-medium">
                      Customer Name
                    </Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 size-4 text-gray-400" />
                      <Input
                        id="customer-search"
                        type="text"
                        placeholder="Search customer..."
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  {/* Product Search */}
                  <div className="space-y-2">
                    <Label htmlFor="product-search" className="text-sm font-medium">
                      Product Name
                    </Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 size-4 text-gray-400" />
                      <Input
                        id="product-search"
                        type="text"
                        placeholder="Search product..."
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  {/* Amount Range */}
                  <div className="space-y-2 md:col-span-2 lg:col-span-1">
                    <Label className="text-sm font-medium">Amount Range (PKR)</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        placeholder="Min"
                        value={minAmount}
                        onChange={(e) => setMinAmount(e.target.value)}
                        className="flex-1"
                      />
                      <span className="flex items-center text-gray-500">to</span>
                      <Input
                        type="number"
                        placeholder="Max"
                        value={maxAmount}
                        onChange={(e) => setMaxAmount(e.target.value)}
                        className="flex-1"
                      />
                    </div>
                  </div>
                </div>

                {/* Filter Summary */}
                {activeFiltersCount > 0 && (
                  <div className="pt-3 border-t border-gray-200">
                    <p className="text-sm text-gray-600">
                      <strong>{filteredOrders.length}</strong> orders found matching your filters
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px] pr-4">
            {/* Desktop View */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order ID</TableHead>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-center">Items</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-center">Payment</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => (
                    <TableRow key={order.id} className="hover:bg-gray-50">
                      <TableCell>
                        <button
                          onClick={() => handleOrderClick(order)}
                          className="font-semibold text-[#C7359C] hover:text-purple-600 hover:underline transition-colors"
                        >
                          {order.id}
                        </button>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p className="font-medium">{new Date(order.date).toLocaleDateString()}</p>
                          <p className="text-gray-500 text-xs">{new Date(order.date).toLocaleTimeString()}</p>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{order.customer}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{order.items.length}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        PKR {order.total.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={order.payment === 'Cash' ? 'default' : 'secondary'}>
                          {order.payment}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                          {order.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <button
                          onClick={() => handleReturnClick(order)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors"
                        >
                          <RotateCcw className="size-4" />
                          Return
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile View */}
            <div className="md:hidden space-y-3">
              {filteredOrders.map((order) => (
                <div
                  key={order.id}
                  className="border rounded-lg p-4 space-y-3 hover:border-[#C7359C] transition-colors"
                >
                  {/* Order Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <button
                        onClick={() => handleOrderClick(order)}
                        className="font-semibold text-[#C7359C] hover:text-purple-600 hover:underline text-base"
                      >
                        {order.id}
                      </button>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(order.date).toLocaleDateString()} • {new Date(order.date).toLocaleTimeString()}
                      </p>
                    </div>
                    <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                      {order.status}
                    </Badge>
                  </div>

                  {/* Order Details */}
                  <div className="grid grid-cols-2 gap-3 pt-3 border-t">
                    <div>
                      <p className="text-xs text-gray-500">Customer</p>
                      <p className="text-sm font-semibold">{order.customer}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Items</p>
                      <Badge variant="outline" className="mt-1">{order.items.length}</Badge>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Payment</p>
                      <Badge variant={order.payment === 'Cash' ? 'default' : 'secondary'} className="mt-1">
                        {order.payment}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Amount</p>
                      <p className="text-sm font-semibold">PKR {order.total.toLocaleString()}</p>
                    </div>
                  </div>

                  {/* Action Button */}
                  <button
                    onClick={() => handleReturnClick(order)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 border border-red-200 rounded-md transition-colors"
                  >
                    <RotateCcw className="size-4" />
                    Process Return
                  </button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Returns Report */}
      <ReturnsReport returns={returns} />

      {/* Order Return Dialog */}
      {isReturnDialogOpen && selectedOrder && (
        <OrderReturnDialog
          isOpen={isReturnDialogOpen}
          order={selectedOrder}
          onClose={() => setIsReturnDialogOpen(false)}
          onReturn={handleReturn}
        />
      )}

      {/* Order Details Dialog */}
      {isDetailsDialogOpen && selectedOrder && (
        <OrderDetailsDialog
          isOpen={isDetailsDialogOpen}
          order={selectedOrder}
          onClose={() => setIsDetailsDialogOpen(false)}
          onReturn={handleReturnClick}
        />
      )}
    </div>
  );
}