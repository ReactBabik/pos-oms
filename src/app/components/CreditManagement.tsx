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
import { Search, DollarSign, AlertCircle, CheckCircle, Clock, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import type { Language } from '../App';
import { useFranchiseFilters } from '../utils/franchiseFilters';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_URL = `https://${projectId}.supabase.co/functions/v1/make-server-77be783d`;

interface Customer {
  id: string;
  name: string;
  phone: string;
  village: string;
  commissionShop?: string;
  creditLimit: number;
  currentBalance: number;
  overdueAmount: number;
  lastPayment: string;
  transactions: any[];
  totalPurchases?: number;
  purchaseCount?: number;
}

export function CreditManagement({ language }: { language: Language}) {
  const [searchTerm, setSearchTerm] = useState('');
  const franchiseFilters = useFranchiseFilters();
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [expandedShops, setExpandedShops] = useState<{ [key: string]: boolean }>({});
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedArthi, setSelectedArthi] = useState<any>(null);
  const [showArthiDetailsDialog, setShowArthiDetailsDialog] = useState(false);
  const [showEditArthiDialog, setShowEditArthiDialog] = useState(false);
  const [editingArthi, setEditingArthi] = useState<any>(null);
  const [arthiInfoMap, setArthiInfoMap] = useState<{ [key: string]: any }>({});
  const [customerDialogPage, setCustomerDialogPage] = useState(1);
  const TRANSACTIONS_PER_PAGE = 10;
  
  // Load credit settings
  const [overdueDays, setOverdueDays] = useState(() => {
    const saved = localStorage.getItem('creditSettings');
    return saved ? JSON.parse(saved).overdueDays : 30;
  });

  // Fetch stored Arthi information
  const fetchArthiInfo = async () => {
    try {
      const response = await fetch(`${API_URL}/arthis`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });
      const result = await response.json();
      
      if (result.success && result.arthis) {
        const infoMap: { [key: string]: any } = {};
        result.arthis.forEach((arthi: any) => {
          infoMap[arthi.id] = arthi;
        });
        setArthiInfoMap(infoMap);
        console.log('✅ Loaded Arthi info:', infoMap);
      }
    } catch (error) {
      console.error('Error fetching arthi info:', error);
    }
  };

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
        // Build customer profiles from sales data
        const customerMap = new Map<string, Customer>();
        
        salesResult.sales.forEach((sale: any) => {
          const customerKey = sale.phone || sale.customer;
          
          if (!customerMap.has(customerKey)) {
            customerMap.set(customerKey, {
              id: customerKey,
              name: sale.customer,
              phone: sale.phone || 'N/A',
              village: sale.address || sale.village || 'N/A',
              commissionShop: sale.commissionShop || undefined, // Get from sale data
              creditLimit: 0,
              currentBalance: 0,
              overdueAmount: 0,
              lastPayment: '',
              transactions: [],
              totalPurchases: 0,
              purchaseCount: 0,
            });
          }
          
          const customer = customerMap.get(customerKey)!;
          
          // Update commission shop if this sale has one and customer doesn't yet
          if (sale.commissionShop && !customer.commissionShop) {
            customer.commissionShop = sale.commissionShop;
          }
          
          customer.transactions.push(sale);
          customer.totalPurchases = (customer.totalPurchases || 0) + sale.total;
          customer.purchaseCount = (customer.purchaseCount || 0) + 1;
          
          if (sale.payment === 'Credit') {
            customer.currentBalance += sale.total;
          }
        });
        
        // Subtract payments from credit balances
        if (paymentsResult.success && paymentsResult.payments) {
          paymentsResult.payments.forEach((payment: any) => {
            const customerKey = payment.customerPhone || payment.customerId;
            const customer = customerMap.get(customerKey);
            
            if (customer) {
              customer.currentBalance -= payment.amount;
              
              // Add payment to transaction history
              customer.transactions.push({
                ...payment,
                type: 'payment',
                date: payment.date,
                total: payment.amount,
                payment: 'Payment Received'
              });
              
              // Track last payment date
              if (!customer.lastPayment || new Date(payment.date) > new Date(customer.lastPayment)) {
                customer.lastPayment = payment.date;
              }
            }
          });
        }
        
        // Sort each customer's transactions by date (newest first)
        customerMap.forEach(customer => {
          customer.transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        });
        
        // Calculate overdue amounts for each customer
        const today = new Date();
        customerMap.forEach(customer => {
          let overdueAmount = 0;
          
          customer.transactions.forEach((txn: any) => {
            // Only count credit transactions (not payments)
            if (txn.type !== 'payment' && txn.payment === 'Credit') {
              const txnDate = new Date(txn.date);
              const daysSince = Math.floor((today.getTime() - txnDate.getTime()) / (1000 * 60 * 60 * 24));
              
              // If transaction is older than the configured overdue days, add to overdue
              if (daysSince > overdueDays) {
                overdueAmount += txn.total || 0;
              }
            }
          });
          
          customer.overdueAmount = overdueAmount;
        });
        
        const customersArray = Array.from(customerMap.values());
        setCustomers(customersArray);
        console.log('✅ Credit customers loaded from sales:', customersArray.length);
        console.log('📊 Sales data with commission shops:', salesResult.sales.map((s: any) => ({
          customer: s.customer,
          phone: s.phone,
          commissionShop: s.commissionShop,
          payment: s.payment
        })));
        console.log(' Customer map with commission shops:', Array.from(customerMap.values()).map(c => ({
          name: c.name,
          phone: c.phone,
          commissionShop: c.commissionShop,
          currentBalance: c.currentBalance
        })));
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
    fetchArthiInfo();
  }, []);

  // Group customers by commission shop
  const customersByShop = customers.reduce((acc: { [key: string]: any[] }, customer) => {
    const shop = customer.commissionShop || 'No Commission Shop';
    if (!acc[shop]) {
      acc[shop] = [];
    }
    acc[shop].push(customer);
    return acc;
  }, {});

  const filteredCustomers = customers.filter(
    customer =>
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.phone.includes(searchTerm) ||
      customer.village.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalCreditOutstanding = customers.reduce(
    (sum, customer) => sum + customer.currentBalance,
    0
  );

  const totalOverdue = customers.reduce(
    (sum, customer) => sum + customer.overdueAmount,
    0
  );

  const toggleShopExpansion = (shopName: string) => {
    setExpandedShops(prev => ({
      ...prev,
      [shopName]: !prev[shopName]
    }));
  };

  const getShopSummary = (shopName: string) => {
    const customers = customersByShop[shopName] || [];
    const totalBalance = customers.reduce((sum, c) => sum + c.currentBalance, 0);
    const totalOverdue = customers.reduce((sum, c) => sum + c.overdueAmount, 0);
    const farmerCount = customers.length;
    return { totalBalance, totalOverdue, farmerCount };
  };

  // Generate Arthi (Commission Shop) data from real customer data
  const arthiData = Object.keys(customersByShop)
    .filter(shop => shop !== 'No Commission Shop') // Exclude customers without commission shops
    .map(shopName => {
      const shopCustomers = customersByShop[shopName];
      const totalBalance = shopCustomers.reduce((sum, c) => sum + c.currentBalance, 0);
      const totalOverdue = shopCustomers.reduce((sum, c) => sum + c.overdueAmount, 0);
      const totalCreditLimit = shopCustomers.reduce((sum, c) => sum + c.creditLimit, 0);
      
      // Check if we have stored info for this arthi
      const storedInfo = arthiInfoMap[shopName];
      
      return {
        id: shopName,
        name: shopName,
        phone: storedInfo?.phone || shopCustomers[0]?.phone || '', // Blank instead of N/A
        location: storedInfo?.location || shopCustomers[0]?.village || '', // Blank instead of N/A
        creditLimit: storedInfo?.creditLimit || totalCreditLimit || 0,
        currentBalance: totalBalance,
        overdueAmount: totalOverdue,
        lastPayment: shopCustomers[0]?.lastPayment || '',
        totalCustomers: shopCustomers.length,
      };
    })
    .sort((a, b) => b.currentBalance - a.currentBalance); // Sort by highest balance first

  console.log('🏪 Commission shop grouping:', customersByShop);
  console.log('📈 Arthi data:', arthiData);

  const handlePayment = async () => {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    const amount = parseFloat(paymentAmount);
    if (amount > selectedCustomer.currentBalance) {
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

  const getCreditStatus = (customer: any) => {
    const usagePercent = (customer.currentBalance / customer.creditLimit) * 100;
    if (customer.overdueAmount > 0) return { label: 'Overdue', color: 'destructive' };
    if (usagePercent >= 90) return { label: 'High', color: 'destructive' };
    if (usagePercent >= 70) return { label: 'Medium', color: 'default' };
    return { label: 'Good', color: 'default' };
  };

  return (
    <div className="space-y-6 p-3 lg:p-0">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <h2 className="text-xl lg:text-2xl font-bold text-gray-900 pl-2">Credit Management</h2>
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

      <Tabs defaultValue="customers" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="customers">Customer Credit (Khaata)</TabsTrigger>
          <TabsTrigger value="arthis">Arthi Credit</TabsTrigger>
        </TabsList>

        {/* Customer Credit Tab */}
        <TabsContent value="customers" className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Outstanding</p>
                    <p className="text-2xl font-bold">PKR {totalCreditOutstanding.toLocaleString()}</p>
                  </div>
                  <DollarSign className="size-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Overdue Amount</p>
                    <p className="text-2xl font-bold text-red-600">PKR {totalOverdue.toLocaleString()}</p>
                  </div>
                  <AlertCircle className="size-8 text-red-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Active Customers</p>
                    <p className="text-2xl font-bold">{customers.length}</p>
                  </div>
                  <CheckCircle className="size-8 text-green-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Customer List */}
          <Card>
            <CardHeader>
              <CardTitle>Credit Customers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-3 size-4 text-gray-400" />
                <Input
                  placeholder="Search by name, phone, or village..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Customer Table */}
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Current Balance</TableHead>
                      <TableHead>Overdue</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCustomers
                      .filter(customer => 
                        !customer.commissionShop && // Only customers WITHOUT commission shop (individual credit customers)
                        (customer.currentBalance > 0 || 
                        customer.transactions.some((txn: any) => txn.payment === 'Credit'))
                      )
                      .map((customer) => {
                        const status = getCreditStatus(customer);
                        return (
                          <TableRow key={customer.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{customer.name}</p>
                                <p className="text-xs text-gray-500">{customer.village}</p>
                              </div>
                            </TableCell>
                            <TableCell>{customer.phone}</TableCell>
                            <TableCell className="font-semibold">
                              PKR {customer.currentBalance.toLocaleString()}
                            </TableCell>
                            <TableCell>
                              {customer.overdueAmount > 0 ? (
                                <span className="text-red-600 font-semibold">
                                  PKR {customer.overdueAmount.toLocaleString()}
                                </span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant={status.color as any}>{status.label}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        setSelectedCustomer(customer);
                                        setCustomerDialogPage(1); // Reset to first page
                                      }}
                                    >
                                      View Details
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent className="max-w-2xl">
                                    <DialogHeader>
                                      <div className="flex justify-between items-start">
                                        <div>
                                          <DialogTitle>{customer.name} - Credit Ledger</DialogTitle>
                                          <DialogDescription>
                                            View transaction history and make payments
                                          </DialogDescription>
                                        </div>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => {
                                            // Export customer ledger to CSV
                                            const csvRows = [];
                                            csvRows.push(['Date', 'Invoice #', 'Type', 'Amount (PKR)', 'Status']);
                                            
                                            customer.transactions.forEach((txn: any) => {
                                              csvRows.push([
                                                new Date(txn.date).toLocaleDateString('en-GB'),
                                                txn.id || txn.invoice || 'N/A',
                                                txn.type === 'payment' ? 'Payment' : 'Sale',
                                                txn.type === 'payment' ? `-${txn.total}` : txn.total,
                                                txn.type === 'payment' ? 'Payment Received' : (txn.payment || 'Credit')
                                              ]);
                                            });
                                            
                                            const csvContent = csvRows.map(row => row.join(',')).join('\n');
                                            const blob = new Blob([csvContent], { type: 'text/csv' });
                                            const url = window.URL.createObjectURL(blob);
                                            const a = document.createElement('a');
                                            a.href = url;
                                            a.download = `${customer.name}_Ledger_${new Date().toISOString().split('T')[0]}.csv`;
                                            a.click();
                                            window.URL.revokeObjectURL(url);
                                            toast.success('Ledger exported successfully');
                                          }}
                                        >
                                          Export CSV
                                        </Button>
                                      </div>
                                    </DialogHeader>
                                    <div className="space-y-4">
                                      {/* Customer Info */}
                                      <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                                        <div>
                                          <p className="text-sm text-gray-600">Current Balance</p>
                                          <p className="text-xl font-bold">PKR {customer.currentBalance.toLocaleString()}</p>
                                        </div>
                                        <div>
                                          <p className="text-sm text-gray-600">Last Payment</p>
                                          <p className="text-sm">{new Date(customer.lastPayment).toLocaleDateString()}</p>
                                        </div>
                                      </div>

                                      {/* Transaction History */}
                                      <div>
                                        <h4 className="font-semibold mb-2">Transaction History</h4>
                                        <Table>
                                          <TableHeader>
                                            <TableRow>
                                              <TableHead>Date</TableHead>
                                              <TableHead>Invoice</TableHead>
                                              <TableHead>Amount</TableHead>
                                              <TableHead>Status</TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {(() => {
                                              const startIdx = (customerDialogPage - 1) * TRANSACTIONS_PER_PAGE;
                                              const endIdx = startIdx + TRANSACTIONS_PER_PAGE;
                                              const paginatedTransactions = customer.transactions.slice(startIdx, endIdx);
                                              
                                              return paginatedTransactions.map((txn: any, index: number) => (
                                                <TableRow key={index} className={txn.type === 'payment' ? 'bg-green-50' : ''}>
                                                  <TableCell>{new Date(txn.date).toLocaleDateString()}</TableCell>
                                                  <TableCell>{txn.id || txn.invoice || 'N/A'}</TableCell>
                                                  <TableCell className={txn.type === 'payment' ? 'text-green-600 font-semibold' : ''}>
                                                    {txn.type === 'payment' ? '-' : ''}PKR {(txn.total || 0).toLocaleString()}
                                                  </TableCell>
                                                  <TableCell>
                                                    <Badge
                                                      variant={
                                                        txn.type === 'payment'
                                                          ? 'default'
                                                          : txn.payment === 'Cash'
                                                          ? 'default'
                                                          : 'secondary'
                                                      }
                                                      className={txn.type === 'payment' ? 'bg-green-600' : ''}
                                                    >
                                                      {txn.type === 'payment' ? 'Payment Received' : (txn.payment || 'Credit')}
                                                    </Badge>
                                                  </TableCell>
                                                </TableRow>
                                              ));
                                            })()}
                                          </TableBody>
                                        </Table>
                                        
                                        {/* Pagination Controls */}
                                        {customer.transactions.length > TRANSACTIONS_PER_PAGE && (
                                          <div className="flex items-center justify-between mt-4">
                                            <p className="text-sm text-gray-600">
                                              Showing {((customerDialogPage - 1) * TRANSACTIONS_PER_PAGE) + 1} to{' '}
                                              {Math.min(customerDialogPage * TRANSACTIONS_PER_PAGE, customer.transactions.length)} of{' '}
                                              {customer.transactions.length} transactions
                                            </p>
                                            <div className="flex gap-2">
                                              <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setCustomerDialogPage(customerDialogPage - 1)}
                                                disabled={customerDialogPage === 1}
                                              >
                                                Previous
                                              </Button>
                                              <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setCustomerDialogPage(customerDialogPage + 1)}
                                                disabled={customerDialogPage * TRANSACTIONS_PER_PAGE >= customer.transactions.length}
                                              >
                                                Next
                                              </Button>
                                            </div>
                                          </div>
                                        )}
                                      </div>

                                    </div>
                                  </DialogContent>
                                </Dialog>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Arthi Credit Tab */}
        <TabsContent value="arthis" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Arthi Credit Management</CardTitle>
            </CardHeader>
            <CardContent>
              {arthiData.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500 text-lg mb-2">No commission shop data yet</p>
                  <p className="text-sm text-gray-400">
                    Commission shops will appear here when customers make credit purchases with a commission shop assigned.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Arthi Name</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Credit Limit</TableHead>
                      <TableHead>Current Balance</TableHead>
                      <TableHead>Overdue</TableHead>
                      <TableHead>Customers</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {arthiData.map((arthi) => (
                      <TableRow key={arthi.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{arthi.name}</p>
                            <p className="text-xs text-gray-500">{arthi.phone}</p>
                          </div>
                        </TableCell>
                        <TableCell>{arthi.location}</TableCell>
                        <TableCell>PKR {arthi.creditLimit.toLocaleString()}</TableCell>
                        <TableCell className="font-semibold">
                          PKR {arthi.currentBalance.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {arthi.overdueAmount > 0 ? (
                            <span className="text-red-600 font-semibold">
                              PKR {arthi.overdueAmount.toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>{arthi.totalCustomers}</TableCell>
                        <TableCell>
                          <Badge variant={arthi.overdueAmount > 0 ? 'destructive' : 'default'}>
                            {arthi.overdueAmount > 0 ? 'Overdue' : 'Good'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedArthi(arthi);
                                setShowArthiDetailsDialog(true);
                              }}
                            >
                              View Details
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Receive Payment</DialogTitle>
            <DialogDescription>
              Record payment from {selectedCustomer?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">Current Balance</p>
              <p className="text-2xl font-bold">
                PKR {selectedCustomer?.currentBalance.toLocaleString()}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment">Payment Amount</Label>
              <Input
                id="payment"
                type="number"
                placeholder="Enter amount"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
              />
            </div>

            <Button className="w-full" onClick={handlePayment}>
              Confirm Payment
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Arthi Details Dialog */}
      <Dialog open={showArthiDetailsDialog} onOpenChange={setShowArthiDetailsDialog}>
        <DialogContent className="!w-[95vw] !h-[95vh] !max-w-[95vw] !max-h-[95vh] overflow-hidden flex flex-col p-6">
          <DialogHeader>
            <div className="flex justify-between items-start">
              <div>
                <DialogTitle className="text-2xl">{selectedArthi?.name} - Detailed Ledger</DialogTitle>
                <DialogDescription>
                  Complete breakdown of all customers and transactions under this commission shop
                </DialogDescription>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  if (!selectedArthi) return;
                  
                  // Prepare CSV data
                  const csvRows = [];
                  csvRows.push(['Date', 'Invoice #', 'Customer Name', 'Phone', 'Village', 'Products', 'Quantity', 'Amount (PKR)']);
                  
                  customersByShop[selectedArthi.name]?.forEach((customer: Customer) => {
                    const creditTransactions = customer.transactions.filter((txn: any) => txn.payment === 'Credit');
                    creditTransactions.forEach((txn: any) => {
                      txn.items?.forEach((item: any) => {
                        csvRows.push([
                          new Date(txn.date).toLocaleDateString('en-GB'),
                          txn.id,
                          customer.name,
                          customer.phone,
                          customer.village || 'N/A',
                          `${item.productName} (${item.unit})`,
                          item.quantity,
                          txn.total
                        ]);
                      });
                    });
                  });
                  
                  // Convert to CSV string
                  const csvContent = csvRows.map(row => row.join(',')).join('\n');
                  const blob = new Blob([csvContent], { type: 'text/csv' });
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${selectedArthi.name}_Ledger_${new Date().toISOString().split('T')[0]}.csv`;
                  a.click();
                  window.URL.revokeObjectURL(url);
                  toast.success('Ledger exported successfully');
                }}
              >
                Export to CSV
              </Button>
            </div>
          </DialogHeader>
          
          {selectedArthi && (
            <div className="flex-1 overflow-hidden flex flex-col space-y-4">
              {/* Summary Section - More Compact */}
              <div className="grid grid-cols-4 gap-3 p-3 bg-gradient-to-r from-purple-50 to-yellow-50 rounded-lg border border-[#C7359C]">
                <div>
                  <p className="text-xs text-gray-600">Total Credit Balance</p>
                  <p className="text-lg font-bold text-[#C7359C]">
                    PKR {selectedArthi.currentBalance.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Total Customers</p>
                  <p className="text-lg font-bold">{selectedArthi.totalCustomers}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Total Transactions</p>
                  <p className="text-lg font-bold">
                    {customersByShop[selectedArthi.name]?.reduce((sum: number, c: Customer) => 
                      sum + c.transactions.filter((t: any) => t.payment === 'Credit').length, 0
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Overdue Amount</p>
                  <p className="text-lg font-bold text-red-600">
                    PKR {selectedArthi.overdueAmount.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Compact Tabular View with Pagination */}
              <div className="flex-1 overflow-auto border rounded-lg">
                <Table>
                  <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
                    <TableRow>
                      <TableHead className="w-[90px]">Date</TableHead>
                      <TableHead className="w-[130px]">Invoice #</TableHead>
                      <TableHead className="w-[150px]">Customer</TableHead>
                      <TableHead className="w-[120px]">Phone</TableHead>
                      <TableHead className="w-[100px]">Village</TableHead>
                      <TableHead className="min-w-[250px]">Products</TableHead>
                      <TableHead className="w-[80px] text-right">Qty</TableHead>
                      <TableHead className="w-[120px] text-right">Amount</TableHead>
                      <TableHead className="w-[100px] text-right">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(() => {
                      // Flatten all transactions into rows
                      const allRows: any[] = [];
                      
                      customersByShop[selectedArthi.name]?.forEach((customer: Customer) => {
                        const creditTransactions = customer.transactions.filter((txn: any) => txn.payment === 'Credit');
                        
                        creditTransactions.forEach((txn: any) => {
                          // Create one row per transaction with all items listed
                          allRows.push({
                            date: txn.date,
                            invoiceId: txn.id,
                            customerName: customer.name,
                            phone: customer.phone,
                            village: customer.village || 'N/A',
                            items: txn.items || [],
                            total: txn.total,
                            customerBalance: customer.currentBalance
                          });
                        });
                      });
                      
                      // Sort by date descending
                      allRows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                      
                      // Pagination - show all rows for now, can add pagination later
                      return allRows.map((row, idx) => (
                        <TableRow key={idx} className="hover:bg-gray-50">
                          <TableCell className="text-xs">
                            {new Date(row.date).toLocaleDateString('en-GB')}
                          </TableCell>
                          <TableCell className="text-xs font-mono">
                            {row.invoiceId}
                          </TableCell>
                          <TableCell className="text-xs font-medium">
                            {row.customerName}
                          </TableCell>
                          <TableCell className="text-xs">
                            {row.phone}
                          </TableCell>
                          <TableCell className="text-xs">
                            {row.village}
                          </TableCell>
                          <TableCell className="text-xs">
                            <div className="space-y-0.5">
                              {row.items.map((item: any, itemIdx: number) => (
                                <div key={itemIdx} className="flex justify-between items-center">
                                  <span className="truncate mr-2">
                                    {item.productName} ({item.unit})
                                  </span>
                                  <span className="text-gray-500 text-[10px] whitespace-nowrap">
                                    ×{item.quantity}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-right">
                            {row.items.reduce((sum: number, item: any) => sum + item.quantity, 0)}
                          </TableCell>
                          <TableCell className="text-xs text-right font-semibold">
                            {row.total.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-xs text-right font-semibold text-[#C7359C]">
                            {row.customerBalance.toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ));
                    })()}
                  </TableBody>
                </Table>
              </div>

              {/* Footer with Grand Total */}
              <div className="p-3 bg-[#C7359C] text-white rounded-lg flex justify-between items-center">
                <div>
                  <p className="text-xs opacity-90">Grand Total - {selectedArthi.name}</p>
                  <p className="text-[10px] opacity-75 mt-0.5">
                    {selectedArthi.totalCustomers} customers • {' '}
                    {customersByShop[selectedArthi.name]?.reduce((sum: number, c: Customer) => 
                      sum + c.transactions.filter((t: any) => t.payment === 'Credit').length, 0
                    )} transactions
                  </p>
                </div>
                <p className="text-2xl font-bold">
                  PKR {selectedArthi.currentBalance.toLocaleString()}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Arthi Info Dialog */}
      <Dialog open={showEditArthiDialog} onOpenChange={setShowEditArthiDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Arthi Information</DialogTitle>
            <DialogDescription>
              Update contact details for {editingArthi?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="arthi-phone">Phone Number</Label>
              <Input
                id="arthi-phone"
                type="tel"
                placeholder="Enter phone number"
                value={editingArthi?.phone || ''}
                onChange={(e) => setEditingArthi({ ...editingArthi, phone: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="arthi-location">Location / Village</Label>
              <Input
                id="arthi-location"
                type="text"
                placeholder="Enter location"
                value={editingArthi?.location || ''}
                onChange={(e) => setEditingArthi({ ...editingArthi, location: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="arthi-credit-limit">Credit Limit (PKR)</Label>
              <Input
                id="arthi-credit-limit"
                type="number"
                placeholder="Enter credit limit"
                value={editingArthi?.creditLimit || ''}
                onChange={(e) => setEditingArthi({ ...editingArthi, creditLimit: parseFloat(e.target.value) || 0 })}
              />
            </div>

            <Button
              className="w-full"
              onClick={async () => {
                try {
                  const response = await fetch(`${API_URL}/arthis`, {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${publicAnonKey}`,
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                      id: editingArthi.id,
                      name: editingArthi.name,
                      phone: editingArthi.phone,
                      location: editingArthi.location,
                      creditLimit: editingArthi.creditLimit
                    })
                  });

                  const result = await response.json();

                  if (result.success) {
                    toast.success(`✅ Updated information for ${editingArthi.name}`);
                    await fetchArthiInfo(); // Reload arthi info
                    setShowEditArthiDialog(false);
                    setEditingArthi(null);
                  } else {
                    throw new Error(result.error || 'Failed to update arthi info');
                  }
                } catch (error) {
                  console.error('Error updating arthi info:', error);
                  toast.error('Failed to update information. Please try again.');
                }
              }}
            >
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}