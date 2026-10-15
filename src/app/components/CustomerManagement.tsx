import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { ScrollArea } from './ui/scroll-area';
import { 
  Search, 
  DollarSign, 
  AlertCircle, 
  CheckCircle, 
  Clock,
  Users,
  TrendingUp,
  Award,
  ShoppingBag,
  Calendar,
  Phone,
  MapPin,
  History,
  Star,
  UserPlus,
  Filter,
  Download,
  X
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';
import { toast } from 'sonner';
import type { Language } from '../App';
import { useFranchiseFilters } from '../utils/franchiseFilters';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_URL = `https://${projectId}.supabase.co/functions/v1/make-server-77be783d`;

// Customer segments
type CustomerSegment = 'VIP' | 'Regular' | 'New' | 'At Risk' | 'Inactive';

interface Customer {
  id: string;
  name: string;
  phone: string;
  village: string;
  creditLimit: number;
  currentBalance: number;
  overdueAmount: number;
  lastPayment: string;
  transactions: any[];
  totalPurchases?: number;
  purchaseCount?: number;
  averageOrderValue?: number;
  lastPurchaseDate?: string;
  segment?: CustomerSegment;
  loyaltyPoints?: number;
  creditHistory?: CreditHistoryEntry[];
}

interface CreditHistoryEntry {
  id: string;
  date: string;
  type: 'credit' | 'payment';
  amount: number;
  description: string;
  balance: number;
}

const SEGMENT_COLORS = {
  'VIP': '#C7359C',
  'Regular': '#3b82f6',
  'New': '#10b981',
  'At Risk': '#f59e0b',
  'Inactive': '#6b7280'
};

export function CustomerManagement({ language }: { language: Language }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showCustomerDialog, setShowCustomerDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [segmentFilter, setSegmentFilter] = useState<string>('all');
  const franchiseFilters = useFranchiseFilters();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [purchaseHistoryPage, setPurchaseHistoryPage] = useState(1);
  const PURCHASE_HISTORY_PER_PAGE = 10;
  
  // New customer form
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    phone: '',
    village: '',
    creditLimit: '0'
  });

  // Fetch customers from sales data
  const fetchCustomersFromSales = async () => {
    try {
      setIsLoading(true);
      
      // Fetch both sales and payments
      const [salesResponse, paymentsResponse] = await Promise.all([
        fetch(`${API_URL}/sales`, {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }),
        fetch(`${API_URL}/payments`, {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        })
      ]);

      const salesResult = await salesResponse.json();
      const paymentsResult = await paymentsResponse.json();

      if (salesResult.success && salesResult.sales) {
        setOrders(salesResult.sales);
        
        // Store payments
        if (paymentsResult.success && paymentsResult.payments) {
          setPayments(paymentsResult.payments);
        }
        
        // Build customer profiles from sales data
        const customerMap = new Map<string, Customer>();
        
        salesResult.sales.forEach((sale: any) => {
          const customerKey = sale.phone || sale.customer;
          
          if (!customerMap.has(customerKey)) {
            customerMap.set(customerKey, {
              id: customerKey,
              name: sale.customer,
              phone: sale.phone || 'N/A',
              village: 'N/A',
              creditLimit: 0,
              currentBalance: 0,
              overdueAmount: 0,
              lastPayment: '',
              transactions: [],
              totalPurchases: 0,
              purchaseCount: 0,
              averageOrderValue: 0,
              lastPurchaseDate: '',
              loyaltyPoints: 0
            });
          }
          
          const customer = customerMap.get(customerKey)!;
          customer.transactions.push(sale);
          customer.totalPurchases = (customer.totalPurchases || 0) + sale.total;
          customer.purchaseCount = (customer.purchaseCount || 0) + 1;
          
          if (sale.payment === 'Credit') {
            customer.currentBalance += sale.total;
          }
          
          // Update last purchase date
          if (!customer.lastPurchaseDate || new Date(sale.date) > new Date(customer.lastPurchaseDate)) {
            customer.lastPurchaseDate = sale.date;
          }
        });
        
        // Subtract payments from credit balances
        if (paymentsResult.success && paymentsResult.payments) {
          paymentsResult.payments.forEach((payment: any) => {
            const customerKey = payment.customerPhone || payment.customerId;
            const customer = customerMap.get(customerKey);
            
            if (customer) {
              customer.currentBalance -= payment.amount;
              
              // Track last payment date
              if (!customer.lastPayment || new Date(payment.date) > new Date(customer.lastPayment)) {
                customer.lastPayment = payment.date;
              }
            }
          });
        }
        
        // Calculate derived metrics and assign segments
        const customersArray = Array.from(customerMap.values()).map(customer => {
          customer.averageOrderValue = customer.totalPurchases! / (customer.purchaseCount || 1);
          customer.loyaltyPoints = Math.floor(customer.totalPurchases! / 100);
          customer.segment = determineSegment(customer);
          return customer;
        });
        
        setCustomers(customersArray);
        console.log('✅ Customers loaded from sales:', customersArray.length);
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
      toast.error('Failed to load customer data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomersFromSales();
  }, []);

  // Determine customer segment based on behavior
  const determineSegment = (customer: Customer): CustomerSegment => {
    const daysSinceLastPurchase = customer.lastPurchaseDate 
      ? Math.floor((Date.now() - new Date(customer.lastPurchaseDate).getTime()) / (1000 * 60 * 60 * 24))
      : 999;
    
    // VIP: High purchase value and frequent purchases
    if ((customer.totalPurchases || 0) > 100000 && (customer.purchaseCount || 0) > 10) {
      return 'VIP';
    }
    
    // At Risk: Haven't purchased in 30+ days but were active before
    if (daysSinceLastPurchase > 30 && daysSinceLastPurchase < 90 && (customer.purchaseCount || 0) > 3) {
      return 'At Risk';
    }
    
    // Inactive: Haven't purchased in 90+ days
    if (daysSinceLastPurchase > 90) {
      return 'Inactive';
    }
    
    // New: Less than 3 purchases
    if ((customer.purchaseCount || 0) <= 3) {
      return 'New';
    }
    
    // Regular: Default for active customers
    return 'Regular';
  };

  const filteredCustomers = customers.filter(customer => {
    const matchesSearch = 
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.phone.includes(searchTerm) ||
      customer.village.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesSegment = segmentFilter === 'all' || customer.segment === segmentFilter;
    
    return matchesSearch && matchesSegment;
  });

  const totalCreditOutstanding = customers.reduce(
    (sum, customer) => sum + customer.currentBalance,
    0
  );

  const totalOverdue = customers.reduce(
    (sum, customer) => sum + customer.overdueAmount,
    0
  );

  const totalRevenue = customers.reduce(
    (sum, customer) => sum + (customer.totalPurchases || 0),
    0
  );

  // Segment statistics
  const segmentStats = customers.reduce((acc, customer) => {
    const segment = customer.segment || 'Regular';
    if (!acc[segment]) {
      acc[segment] = { count: 0, revenue: 0 };
    }
    acc[segment].count++;
    acc[segment].revenue += customer.totalPurchases || 0;
    return acc;
  }, {} as Record<string, { count: number; revenue: number }>);

  const segmentData = Object.entries(segmentStats).map(([name, data]) => ({
    name,
    count: data.count,
    revenue: data.revenue
  }));

  const handlePayment = async () => {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    const amount = parseFloat(paymentAmount);
    if (amount > (selectedCustomer?.currentBalance || 0)) {
      toast.error('Payment amount cannot exceed current balance');
      return;
    }

    try {
      // Create payment record
      const paymentRecord = {
        id: `payment_${Date.now()}`,
        customerId: selectedCustomer?.id,
        customerName: selectedCustomer?.name,
        customerPhone: selectedCustomer?.phone,
        amount: amount,
        date: new Date().toISOString(),
        previousBalance: selectedCustomer?.currentBalance,
        newBalance: (selectedCustomer?.currentBalance || 0) - amount,
        type: 'payment'
      };

      // Save payment to backend
      const response = await fetch(`${API_URL}/payments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(paymentRecord)
      });

      const result = await response.json();

      if (result.success) {
        toast.success(`✅ Payment of PKR ${amount.toLocaleString()} received from ${selectedCustomer?.name}`);
        
        // Refresh customer data to reflect the payment
        await fetchCustomersFromSales();
        
        setShowPaymentDialog(false);
        setPaymentAmount('');
        setSelectedCustomer(null);
      } else {
        throw new Error(result.error || 'Failed to record payment');
      }
    } catch (error) {
      console.error('Error recording payment:', error);
      toast.error('Failed to record payment. Please try again.');
    }
  };

  const handleAddCustomer = () => {
    if (!newCustomer.name || !newCustomer.phone) {
      toast.error('Please fill in required fields');
      return;
    }

    toast.success(`Customer ${newCustomer.name} added successfully`);
    setShowCustomerDialog(false);
    setNewCustomer({ name: '', phone: '', village: '', creditLimit: '0' });
  };

  const getCreditStatus = (customer: Customer) => {
    if (customer.creditLimit === 0) return { label: 'Cash Only', color: 'secondary' };
    const usagePercent = (customer.currentBalance / customer.creditLimit) * 100;
    if (customer.overdueAmount > 0) return { label: 'Overdue', color: 'destructive' };
    if (usagePercent >= 90) return { label: 'High', color: 'destructive' };
    if (usagePercent >= 70) return { label: 'Medium', color: 'default' };
    return { label: 'Good', color: 'default' };
  };

  const getSegmentIcon = (segment?: CustomerSegment) => {
    switch (segment) {
      case 'VIP': return <Award className="size-4 text-purple-600" />;
      case 'Regular': return <Users className="size-4 text-blue-600" />;
      case 'New': return <Star className="size-4 text-green-600" />;
      case 'At Risk': return <AlertCircle className="size-4 text-orange-600" />;
      case 'Inactive': return <Clock className="size-4 text-gray-600" />;
      default: return <Users className="size-4" />;
    }
  };

  const exportCustomers = () => {
    const headers = ['Name', 'Phone', 'Village', 'Segment', 'Total Purchases', 'Order Count', 'Avg Order', 'Credit Balance', 'Loyalty Points'];
    const rows = filteredCustomers.map(c => [
      c.name,
      c.phone,
      c.village,
      c.segment,
      c.totalPurchases,
      c.purchaseCount,
      c.averageOrderValue?.toFixed(2),
      c.currentBalance,
      c.loyaltyPoints
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `customers_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success('Customer data exported successfully');
  };

  return (
    <div className="space-y-6 p-3 lg:p-0">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <h2 className="text-xl lg:text-2xl font-bold text-gray-900 pl-2">Customer Management</h2>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCustomers} className="gap-2">
            <Download className="size-4" />
            Export
          </Button>
          <Button onClick={() => setShowCustomerDialog(true)} className="gap-2 bg-[#C7359C] hover:bg-purple-600">
            <UserPlus className="size-4" />
            Add Customer
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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 gap-2 h-auto md:grid-cols-3 md:gap-0 md:h-10">
          <TabsTrigger value="overview" className="whitespace-nowrap">Overview</TabsTrigger>
          <TabsTrigger value="customers" className="whitespace-nowrap">Customers</TabsTrigger>
          <TabsTrigger value="segmentation" className="whitespace-nowrap">Segmentation</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card 
              className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-blue-400"
              onClick={() => {
                setSegmentFilter('all');
                setActiveTab('customers');
              }}
            >
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Customers</p>
                    <p className="text-2xl font-bold">{customers.length}</p>
                    <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
                      <TrendingUp className="size-3" />
                      Active customers
                    </p>
                  </div>
                  <Users className="size-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card 
              className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-green-400"
              onClick={() => {
                setSegmentFilter('all');
                setActiveTab('customers');
              }}
            >
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Revenue</p>
                    <p className="text-2xl font-bold">PKR {totalRevenue.toLocaleString()}</p>
                    <p className="text-xs text-gray-500 mt-1">Lifetime value</p>
                  </div>
                  <DollarSign className="size-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card 
              className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-orange-400"
              onClick={() => {
                setSegmentFilter('all');
                setActiveTab('customers');
              }}
            >
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Credit Outstanding</p>
                    <p className="text-2xl font-bold">PKR {totalCreditOutstanding.toLocaleString()}</p>
                    <p className="text-xs text-gray-500 mt-1">To be collected</p>
                  </div>
                  <DollarSign className="size-8 text-orange-600" />
                </div>
              </CardContent>
            </Card>

            <Card 
              className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-purple-400"
              onClick={() => {
                setSegmentFilter('VIP');
                setActiveTab('customers');
              }}
            >
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">VIP Customers</p>
                    <p className="text-2xl font-bold">{segmentStats.VIP?.count || 0}</p>
                    <p className="text-xs text-purple-600 flex items-center gap-1 mt-1">
                      <Award className="size-3" />
                      Top tier
                    </p>
                  </div>
                  <Award className="size-8 text-purple-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Segment Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Customer Segments</CardTitle>
                <CardDescription>Distribution by segment type</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={segmentData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={100}
                      dataKey="count"
                    >
                      {segmentData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={SEGMENT_COLORS[entry.name as CustomerSegment] || '#3b82f6'} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Revenue by Segment */}
            <Card>
              <CardHeader>
                <CardTitle>Revenue by Segment</CardTitle>
                <CardDescription>Contribution to total revenue</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={segmentData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" fontSize={12} />
                    <YAxis fontSize={12} tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(value: any) => `PKR ${value.toLocaleString()}`} />
                    <Bar dataKey="revenue" fill="#C7359C" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Top Customers */}
          <Card>
            <CardHeader>
              <CardTitle>Top 10 Customers by Revenue</CardTitle>
              <CardDescription>Your most valuable customers</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rank</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Segment</TableHead>
                    <TableHead className="text-right">Total Purchases</TableHead>
                    <TableHead className="text-center">Orders</TableHead>
                    <TableHead className="text-right">Avg Order</TableHead>
                    <TableHead className="text-center">Loyalty Points</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers
                    .sort((a, b) => (b.totalPurchases || 0) - (a.totalPurchases || 0))
                    .slice(0, 10)
                    .map((customer, index) => (
                      <TableRow key={customer.id}>
                        <TableCell className="font-bold text-[#C7359C]">#{index + 1}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{customer.name}</p>
                            <p className="text-xs text-gray-500">{customer.phone}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge style={{ backgroundColor: SEGMENT_COLORS[customer.segment || 'Regular'] }}>
                            {customer.segment}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          PKR {(customer.totalPurchases || 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-center">{customer.purchaseCount}</TableCell>
                        <TableCell className="text-right">
                          PKR {(customer.averageOrderValue || 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="gap-1">
                            <Star className="size-3 fill-yellow-400 text-yellow-400" />
                            {customer.loyaltyPoints}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Customers Tab */}
        <TabsContent value="customers" className="space-y-6">
          {/* Search and Filter */}
          <Card>
            <CardContent className="pt-6 space-y-3">
              {/* Search + Segment */}
              <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 size-4 text-gray-400" />
                  <Input
                    placeholder="Search by name, phone, or village..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={segmentFilter} onValueChange={setSegmentFilter}>
                  <SelectTrigger className="w-full md:w-[200px]">
                    <Filter className="size-4 mr-2" />
                    <SelectValue placeholder="All Segments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Segments</SelectItem>
                    <SelectItem value="VIP">VIP</SelectItem>
                    <SelectItem value="Regular">Regular</SelectItem>
                    <SelectItem value="New">New</SelectItem>
                    <SelectItem value="At Risk">At Risk</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Customer List */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>All Customers ({filteredCustomers.length})</CardTitle>
                <Badge className="bg-gradient-to-r from-[#C7359C] to-purple-600">
                  {filteredCustomers.length} of {customers.length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Segment</TableHead>
                      <TableHead className="text-right">Total Purchases</TableHead>
                      <TableHead className="text-center">Orders</TableHead>
                      <TableHead className="text-right">Credit Balance</TableHead>
                      <TableHead className="text-center">Last Purchase</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCustomers.map((customer) => (
                      <TableRow 
                        key={customer.id}
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => {
                          setSelectedCustomer(customer);
                          setPurchaseHistoryPage(1);
                          setShowDetailsDialog(true);
                        }}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getSegmentIcon(customer.segment)}
                            <div>
                              <p className="font-medium">{customer.name}</p>
                              <p className="text-xs text-gray-500">{customer.village}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <Phone className="size-3" />
                            {customer.phone}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge style={{ backgroundColor: SEGMENT_COLORS[customer.segment || 'Regular'] }}>
                            {customer.segment}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          PKR {(customer.totalPurchases || 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline">{customer.purchaseCount}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {customer.currentBalance > 0 ? (
                            <span className="text-orange-600 font-semibold">
                              PKR {customer.currentBalance.toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center text-sm">
                          {customer.lastPurchaseDate 
                            ? new Date(customer.lastPurchaseDate).toLocaleDateString()
                            : '-'}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedCustomer(customer);
                              setPurchaseHistoryPage(1);
                              setShowDetailsDialog(true);
                            }}
                          >
                            View Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Customer Details Dialog */}
          <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
                {selectedCustomer && (
                  <DialogContent aria-describedby={undefined} className="w-full max-w-full h-[100dvh] md:w-[90vw] md:h-[90vh] md:max-w-4xl md:rounded-lg overflow-y-auto p-4 md:p-6">
                              <DialogHeader>
                                <div className="mb-4">
                                  <DialogTitle className="flex items-center gap-2 text-lg md:text-xl font-semibold">
                                    {getSegmentIcon(selectedCustomer.segment)}
                                    <span className="truncate">{selectedCustomer.name}</span>
                                  </DialogTitle>
                                </div>
                              </DialogHeader>
                              
                              {/* Content */}
                              <div className="space-y-4 md:space-y-6">
                                  {/* Quick Stats Grid */}
                                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
                                    <Card className="border-purple-200">
                                      <CardContent className="pt-4 pb-3 h-[100px] flex flex-col justify-between">
                                        <div className="flex items-center justify-between mb-1">
                                          <p className="text-xs md:text-sm text-gray-600">Total Spent</p>
                                          <DollarSign className="size-4 md:size-5 text-purple-600" />
                                        </div>
                                        <p className="text-lg md:text-2xl font-bold text-purple-600">
                                          PKR {(selectedCustomer.totalPurchases || 0).toLocaleString()}
                                        </p>
                                      </CardContent>
                                    </Card>
                                    
                                    <Card className="border-blue-200">
                                      <CardContent className="pt-4 pb-3 h-[100px] flex flex-col justify-between">
                                        <div className="flex items-center justify-between mb-1">
                                          <p className="text-xs md:text-sm text-gray-600">Total Orders</p>
                                          <ShoppingBag className="size-4 md:size-5 text-blue-600" />
                                        </div>
                                        <p className="text-lg md:text-2xl font-bold text-blue-600">{selectedCustomer.purchaseCount}</p>
                                      </CardContent>
                                    </Card>
                                    
                                    <Card className="border-green-200">
                                      <CardContent className="pt-4 pb-3 h-[100px] flex flex-col justify-between">
                                        <div className="flex items-center justify-between mb-1">
                                          <p className="text-xs md:text-sm text-gray-600">Avg Order</p>
                                          <TrendingUp className="size-4 md:size-5 text-green-600" />
                                        </div>
                                        <p className="text-lg md:text-2xl font-bold text-green-600">
                                          PKR {Math.round(selectedCustomer.averageOrderValue || 0).toLocaleString()}
                                        </p>
                                      </CardContent>
                                    </Card>
                                    
                                    <Card className="border-yellow-200">
                                      <CardContent className="pt-4 pb-3 h-[100px] flex flex-col justify-between">
                                        <div className="flex items-center justify-between mb-1">
                                          <p className="text-xs md:text-sm text-gray-600">Loyalty Points</p>
                                          <Star className="size-4 md:size-5 text-yellow-600 fill-yellow-600" />
                                        </div>
                                        <p className="text-lg md:text-2xl font-bold text-yellow-600">{selectedCustomer.loyaltyPoints}</p>
                                      </CardContent>
                                    </Card>
                                  </div>

                                  {/* Customer Details */}
                                  <Card>
                                    <CardHeader>
                                      <CardTitle className="text-base md:text-lg">Customer Information</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="flex items-start gap-3">
                                          <Phone className="size-5 text-gray-500 mt-0.5 flex-shrink-0" />
                                          <div>
                                            <p className="text-xs md:text-sm text-gray-500">Phone</p>
                                            <p className="text-sm md:text-base font-medium">{selectedCustomer.phone}</p>
                                          </div>
                                        </div>
                                        <div className="flex items-start gap-3">
                                          <MapPin className="size-5 text-gray-500 mt-0.5 flex-shrink-0" />
                                          <div>
                                            <p className="text-xs md:text-sm text-gray-500">Village</p>
                                            <p className="text-sm md:text-base font-medium">{selectedCustomer.village}</p>
                                          </div>
                                        </div>
                                        <div className="flex items-start gap-3">
                                          <Award className="size-5 text-gray-500 mt-0.5 flex-shrink-0" />
                                          <div>
                                            <p className="text-xs md:text-sm text-gray-500">Segment</p>
                                            <Badge className="mt-1" style={{ backgroundColor: SEGMENT_COLORS[selectedCustomer.segment || 'Regular'] }}>
                                              {selectedCustomer.segment}
                                            </Badge>
                                          </div>
                                        </div>
                                        <div className="flex items-start gap-3">
                                          <Calendar className="size-5 text-gray-500 mt-0.5 flex-shrink-0" />
                                          <div>
                                            <p className="text-xs md:text-sm text-gray-500">Last Purchase</p>
                                            <p className="text-sm md:text-base font-medium">
                                              {selectedCustomer.lastPurchaseDate 
                                                ? new Date(selectedCustomer.lastPurchaseDate).toLocaleDateString()
                                                : 'Never'}
                                            </p>
                                          </div>
                                        </div>
                                      </div>
                                    </CardContent>
                                  </Card>

                                  {/* Credit Info */}
                                  {selectedCustomer.currentBalance > 0 && (
                                    <Card className="border-2 border-orange-200 bg-orange-50">
                                      <CardHeader>
                                        <CardTitle className="text-base md:text-lg flex items-center gap-2 text-orange-700">
                                          <DollarSign className="size-5" />
                                          Credit Information
                                        </CardTitle>
                                      </CardHeader>
                                      <CardContent className="space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                          <div>
                                            <p className="text-sm text-gray-600">Current Balance</p>
                                            <p className="text-xl md:text-2xl font-bold text-orange-600">
                                              PKR {selectedCustomer.currentBalance.toLocaleString()}
                                            </p>
                                          </div>
                                          <div>
                                            <p className="text-sm text-gray-600">Credit Limit</p>
                                            <p className="text-xl md:text-2xl font-bold">
                                              PKR {selectedCustomer.creditLimit.toLocaleString()}
                                            </p>
                                          </div>
                                        </div>
                                        <Button
                                          className="w-full bg-orange-600 hover:bg-orange-700"
                                          onClick={() => {
                                            setShowPaymentDialog(true);
                                          }}
                                        >
                                          <DollarSign className="size-4 mr-2" />
                                          Receive Payment
                                        </Button>
                                      </CardContent>
                                    </Card>
                                  )}

                                  {/* Purchase History */}
                                  <Card>
                                    <CardHeader>
                                      <CardTitle className="text-base md:text-lg flex items-center gap-2">
                                        <History className="size-5 text-[#C7359C]" />
                                        Purchase History
                                        <Badge variant="outline" className="ml-auto">{selectedCustomer.transactions.length} orders</Badge>
                                      </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                      {/* Mobile: Card Layout */}
                                      <div className="md:hidden space-y-2">
                                        {(() => {
                                          const startIdx = (purchaseHistoryPage - 1) * PURCHASE_HISTORY_PER_PAGE;
                                          const endIdx = startIdx + PURCHASE_HISTORY_PER_PAGE;
                                          const sortedTransactions = selectedCustomer.transactions
                                            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                                          const paginatedTransactions = sortedTransactions.slice(startIdx, endIdx);
                                          
                                          return paginatedTransactions.map((txn: any, index: number) => (
                                            <div key={index} className="bg-gray-50 border rounded-lg p-3 space-y-2">
                                              <div className="flex items-start justify-between">
                                                <div>
                                                  <p className="text-xs text-gray-500">{new Date(txn.date).toLocaleDateString()}</p>
                                                  <p className="font-semibold text-[#C7359C] text-sm">{txn.id}</p>
                                                </div>
                                                <Badge variant={txn.payment === 'Cash' ? 'default' : 'secondary'} className="text-xs">
                                                  {txn.payment}
                                                </Badge>
                                              </div>
                                              <div className="flex items-center justify-between pt-2 border-t">
                                                <div className="flex items-center gap-2">
                                                  <ShoppingBag className="size-4 text-gray-400" />
                                                  <span className="text-xs text-gray-600">{txn.items?.length || 0} items</span>
                                                </div>
                                                <p className="font-bold text-sm">PKR {txn.total.toLocaleString()}</p>
                                              </div>
                                            </div>
                                          ));
                                        })()}
                                      </div>
                                      
                                      {/* Desktop: Table Layout */}
                                      <div className="hidden md:block border rounded-lg overflow-hidden">
                                        <Table>
                                          <TableHeader>
                                            <TableRow>
                                              <TableHead>Date</TableHead>
                                              <TableHead>Invoice</TableHead>
                                              <TableHead>Items</TableHead>
                                              <TableHead className="text-right">Amount</TableHead>
                                              <TableHead>Payment</TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {(() => {
                                              const startIdx = (purchaseHistoryPage - 1) * PURCHASE_HISTORY_PER_PAGE;
                                              const endIdx = startIdx + PURCHASE_HISTORY_PER_PAGE;
                                              const sortedTransactions = selectedCustomer.transactions
                                                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                                              const paginatedTransactions = sortedTransactions.slice(startIdx, endIdx);
                                              
                                              return paginatedTransactions.map((txn: any, index: number) => (
                                                <TableRow key={index}>
                                                  <TableCell className="text-sm md:text-base">
                                                    {new Date(txn.date).toLocaleDateString()}
                                                  </TableCell>
                                                  <TableCell className="font-medium text-[#C7359C] text-sm md:text-base">
                                                    {txn.id}
                                                  </TableCell>
                                                  <TableCell>
                                                    <Badge variant="outline">{txn.items?.length || 0}</Badge>
                                                  </TableCell>
                                                  <TableCell className="text-right font-semibold text-sm md:text-base">
                                                    PKR {txn.total.toLocaleString()}
                                                  </TableCell>
                                                  <TableCell>
                                                    <Badge variant={txn.payment === 'Cash' ? 'default' : 'secondary'}>
                                                      {txn.payment}
                                                    </Badge>
                                                  </TableCell>
                                                </TableRow>
                                              ));
                                            })()}
                                          </TableBody>
                                        </Table>
                                      </div>

                                      {/* Pagination Controls */}
                                      {selectedCustomer.transactions.length > PURCHASE_HISTORY_PER_PAGE && (
                                        <div className="flex items-center justify-between mt-4 pt-4 border-t">
                                          <p className="text-sm text-gray-600">
                                            Showing {((purchaseHistoryPage - 1) * PURCHASE_HISTORY_PER_PAGE) + 1} to{' '}
                                            {Math.min(purchaseHistoryPage * PURCHASE_HISTORY_PER_PAGE, selectedCustomer.transactions.length)} of{' '}
                                            {selectedCustomer.transactions.length} transactions
                                          </p>
                                          <div className="flex gap-2">
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              onClick={() => setPurchaseHistoryPage(purchaseHistoryPage - 1)}
                                              disabled={purchaseHistoryPage === 1}
                                            >
                                              Previous
                                            </Button>
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              onClick={() => setPurchaseHistoryPage(purchaseHistoryPage + 1)}
                                              disabled={purchaseHistoryPage * PURCHASE_HISTORY_PER_PAGE >= selectedCustomer.transactions.length}
                                            >
                                              Next
                                            </Button>
                                          </div>
                                        </div>
                                      )}
                                    </CardContent>
                                  </Card>
                              </div>
                            </DialogContent>
                          )}
                        </Dialog>
        </TabsContent>

        {/* Segmentation Tab */}
        <TabsContent value="segmentation" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Object.entries(segmentStats).map(([segment, data]) => (
              <Card key={segment} className="border-2" style={{ borderColor: SEGMENT_COLORS[segment as CustomerSegment] }}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {getSegmentIcon(segment as CustomerSegment)}
                    {segment} Customers
                  </CardTitle>
                  <CardDescription>
                    {data.count} customers • PKR {data.revenue.toLocaleString()} revenue
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Count</span>
                      <span className="font-bold text-lg">{data.count}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Revenue</span>
                      <span className="font-bold text-lg">PKR {data.revenue.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Avg Revenue</span>
                      <span className="font-bold text-lg">
                        PKR {Math.round(data.revenue / data.count).toLocaleString()}
                      </span>
                    </div>
                    <Button 
                      variant="outline" 
                      className="w-full mt-2"
                      onClick={() => {
                        setSegmentFilter(segment);
                        setActiveTab('customers');
                      }}
                    >
                      View {segment} Customers
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Segment Descriptions */}
          <Card>
            <CardHeader>
              <CardTitle>Segment Definitions</CardTitle>
              <CardDescription>How customers are automatically categorized</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-3 p-3 border rounded-lg">
                  <Award className="size-8 text-purple-600 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-purple-600">VIP Customers</h4>
                    <p className="text-sm text-gray-600">
                      High-value customers with total purchases over PKR 100,000 and more than 10 orders. 
                      These are your most valuable customers deserving special attention.
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-3 p-3 border rounded-lg">
                  <Users className="size-8 text-blue-600 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-blue-600">Regular Customers</h4>
                    <p className="text-sm text-gray-600">
                      Active customers who purchase regularly and maintain consistent engagement with your business.
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-3 p-3 border rounded-lg">
                  <Star className="size-8 text-green-600 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-green-600">New Customers</h4>
                    <p className="text-sm text-gray-600">
                      Recently acquired customers with 3 or fewer purchases. Focus on building relationships.
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-3 p-3 border rounded-lg">
                  <AlertCircle className="size-8 text-orange-600 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-orange-600">At Risk Customers</h4>
                    <p className="text-sm text-gray-600">
                      Previously active customers who haven't purchased in 30-90 days. Consider re-engagement campaigns.
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-3 p-3 border rounded-lg">
                  <Clock className="size-8 text-gray-600 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-gray-600">Inactive Customers</h4>
                    <p className="text-sm text-gray-600">
                      No purchases in over 90 days. May require special offers or communication to win back.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Customer Dialog */}
      <Dialog open={showCustomerDialog} onOpenChange={setShowCustomerDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Customer</DialogTitle>
            <DialogDescription>
              Create a new customer profile
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Customer Name *</Label>
              <Input
                id="name"
                placeholder="Enter customer name"
                value={newCustomer.name}
                onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number *</Label>
              <Input
                id="phone"
                placeholder="0300-1234567"
                value={newCustomer.phone}
                onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="village">Village/Location</Label>
              <Input
                id="village"
                placeholder="Enter village or area"
                value={newCustomer.village}
                onChange={(e) => setNewCustomer({ ...newCustomer, village: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="creditLimit">Credit Limit (PKR)</Label>
              <Input
                id="creditLimit"
                type="number"
                placeholder="0"
                value={newCustomer.creditLimit}
                onChange={(e) => setNewCustomer({ ...newCustomer, creditLimit: e.target.value })}
              />
            </div>

            <Button className="w-full bg-[#C7359C] hover:bg-purple-600" onClick={handleAddCustomer}>
              Add Customer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] md:max-h-[98vh] w-[98vw] md:w-[95vw] flex flex-col p-4 md:p-6">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Receive Payment</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 md:gap-4 flex-1 min-h-0">
            <div className="p-3 md:p-4 bg-gray-50 rounded-lg flex-shrink-0">
              <p className="text-xs md:text-sm text-gray-600">Current Balance</p>
              <p className="text-xl md:text-2xl font-bold">
                PKR {selectedCustomer?.currentBalance.toLocaleString()}
              </p>
            </div>

            {/* Credit History */}
            {selectedCustomer && (
              <div className="border rounded-lg p-3 md:p-4 bg-white flex-1 flex flex-col min-h-0">
                <h4 className="font-semibold mb-2 md:mb-3 flex items-center gap-2 text-[#C7359C] flex-shrink-0">
                  <History className="size-4 md:size-5" />
                  <span className="text-sm md:text-base">Credit History</span>
                </h4>
                <ScrollArea className="flex-1 min-h-0">
                  <div className="space-y-2 pr-4">
                    {/* Combine credit transactions and payments, then sort by date */}
                    {[
                      ...selectedCustomer.transactions
                        .filter((txn: any) => txn.payment === 'Credit')
                        .map((txn: any) => ({ ...txn, type: 'credit' })),
                      ...payments
                        .filter((payment: any) => 
                          payment.customerPhone === selectedCustomer.phone || 
                          payment.customerId === selectedCustomer.id
                        )
                        .map((payment: any) => ({ ...payment, type: 'payment' }))
                    ]
                      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map((entry: any, index: number) => {
                        if (entry.type === 'credit') {
                          return (
                            <div key={`credit-${index}`} className="flex items-center justify-between p-2 md:p-3 bg-orange-50 border border-orange-200 rounded-lg">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1 md:gap-2 flex-wrap">
                                  <Badge variant="destructive" className="text-xs flex-shrink-0">Credit Added</Badge>
                                  <span className="text-xs md:text-sm text-gray-600">
                                    {new Date(entry.date).toLocaleDateString()} {new Date(entry.date).toLocaleTimeString()}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-600 mt-1 truncate">Invoice: {entry.id}</p>
                              </div>
                              <div className="text-right flex-shrink-0 ml-2">
                                <p className="text-base md:text-lg font-bold text-orange-600 whitespace-nowrap">+ PKR {entry.total.toLocaleString()}</p>
                              </div>
                            </div>
                          );
                        } else {
                          return (
                            <div key={`payment-${index}`} className="flex items-center justify-between p-2 md:p-3 bg-green-50 border border-green-200 rounded-lg">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1 md:gap-2 flex-wrap">
                                  <Badge className="bg-green-600 text-xs flex-shrink-0">Payment Received</Badge>
                                  <span className="text-xs md:text-sm text-gray-600">
                                    {new Date(entry.date).toLocaleDateString()} {new Date(entry.date).toLocaleTimeString()}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-600 mt-1 truncate">Payment ID: {entry.id}</p>
                              </div>
                              <div className="text-right flex-shrink-0 ml-2">
                                <p className="text-base md:text-lg font-bold text-green-600 whitespace-nowrap">- PKR {entry.amount.toLocaleString()}</p>
                              </div>
                            </div>
                          );
                        }
                      })}
                  </div>

                  {selectedCustomer.transactions.filter((txn: any) => txn.payment === 'Credit').length === 0 && 
                   payments.filter((payment: any) => payment.customerPhone === selectedCustomer.phone || payment.customerId === selectedCustomer.id).length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <History className="size-10 md:size-12 mx-auto mb-2 text-gray-300" />
                      <p className="text-xs md:text-sm">No credit history found</p>
                    </div>
                  )}
                </ScrollArea>
              </div>
            )}

            {/* Payment Amount and Button side by side */}
            <div className="flex flex-col md:flex-row gap-2 md:gap-3 flex-shrink-0">
              <div className="flex-1 space-y-2">
                <Label htmlFor="payment" className="text-sm">Payment Amount</Label>
                <Input
                  id="payment"
                  type="number"
                  placeholder="Enter amount"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="text-base h-10 md:h-11"
                />
              </div>
              <div className="flex items-end md:w-[200px]">
                <Button className="w-full bg-[#C7359C] hover:bg-purple-600 h-10 md:h-11" onClick={handlePayment}>
                  Confirm Payment
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}