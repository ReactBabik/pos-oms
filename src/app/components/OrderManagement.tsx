import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { 
  Plus, 
  Package, 
  ShoppingCart, 
  Truck,
  CheckCircle2,
  Clock,
  XCircle,
  Search,
  Loader2,
  Calendar,
  FileText,
  AlertCircle,
  Download,
  Eye,
  Trash2,
  RefreshCw,
  PackageCheck,
  Send
} from 'lucide-react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import type { Language } from '../App';
import { OrderCreation } from './OrderCreation';

const API_URL = `https://${projectId}.supabase.co/functions/v1/make-server-77be783d`;

interface Product {
  id: string;
  name: string;
  category: string;
  unit: string;
  defaultPrice: number;
  image: string;
}

interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  scheme: string;
  price: number;
}

interface Order {
  id: string;
  orderDate: string;
  expectedDeliveryDate: string;
  status: 'Pending' | 'Confirmed' | 'Processing' | 'Shipped' | 'Delivered' | 'Cancelled';
  items: OrderItem[];
  totalAmount: number;
  notes: string;
  deliveryAddress: string;
  receivedDate?: string;
  createdAt: string;
}

const statusColors = {
  Pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  Confirmed: 'bg-blue-100 text-blue-800 border-blue-300',
  Processing: 'bg-purple-100 text-purple-800 border-purple-300',
  Shipped: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  Delivered: 'bg-green-100 text-green-800 border-green-300',
  Cancelled: 'bg-red-100 text-red-800 border-red-300',
};

const statusIcons = {
  Pending: Clock,
  Confirmed: CheckCircle2,
  Processing: Package,
  Shipped: Truck,
  Delivered: PackageCheck,
  Cancelled: XCircle,
};

export function OrderManagement({ language, preSelectedItems, onItemsUsed }: { 
  language: Language; 
  preSelectedItems?: any[] | null;
  onItemsUsed?: () => void;
}) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'create'>('list');
  
  // Order form state - no longer needed with OrderCreation component
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [scheme, setScheme] = useState<string>('');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState<string>('');
  const [deliveryAddress, setDeliveryAddress] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  useEffect(() => {
    fetchOrders();
    fetchProducts();
  }, []);

  // Auto-navigate to create view if preselected items are passed
  useEffect(() => {
    if (preSelectedItems && preSelectedItems.length > 0) {
      setViewMode('create');
    }
  }, [preSelectedItems]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/orders`, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setOrders(data.orders || []);
      } else {
        toast.error('Failed to load orders');
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast.error('Error loading orders');
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
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
    }
  };

  const addOrderItem = () => {
    if (!selectedProduct || quantity <= 0) {
      toast.error('Please select a product and enter quantity');
      return;
    }

    const product = products.find(p => p.id === selectedProduct);
    if (!product) return;

    const existingItemIndex = orderItems.findIndex(item => item.productId === selectedProduct && item.scheme === scheme);
    
    if (existingItemIndex >= 0) {
      const updatedItems = [...orderItems];
      updatedItems[existingItemIndex].quantity += quantity;
      setOrderItems(updatedItems);
      toast.success('Quantity updated');
    } else {
      const newItem: OrderItem = {
        productId: product.id,
        productName: product.name,
        quantity,
        scheme: scheme || 'Standard',
        price: product.defaultPrice
      };
      setOrderItems([...orderItems, newItem]);
      toast.success('Product added to order');
    }

    // Reset form
    setSelectedProduct('');
    setQuantity(1);
    setScheme('');
  };

  const removeOrderItem = (index: number) => {
    const updatedItems = orderItems.filter((_, i) => i !== index);
    setOrderItems(updatedItems);
    toast.success('Item removed');
  };

  const calculateTotal = () => {
    return orderItems.reduce((sum, item) => sum + (item.quantity * item.price), 0);
  };

  const createOrder = async () => {
    if (orderItems.length === 0) {
      toast.error('Please add at least one product');
      return;
    }

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
        setShowCreateDialog(false);
        resetOrderForm();
        fetchOrders();
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

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/orders/${orderId}/status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast.success(`Order ${newStatus.toLowerCase()}`);
        fetchOrders();
        if (selectedOrder?.id === orderId) {
          setSelectedOrder({ ...selectedOrder, status: newStatus as any });
        }
      } else {
        toast.error(data.error || 'Failed to update order status');
      }
    } catch (error) {
      console.error('Error updating order status:', error);
      toast.error('Error updating order status');
    } finally {
      setLoading(false);
    }
  };

  const markAsReceived = async (orderId: string) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/orders/${orderId}/receive`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast.success('Order marked as received! Inventory updated.');
        fetchOrders();
        setShowDetailDialog(false);
      } else {
        toast.error(data.error || 'Failed to mark order as received');
      }
    } catch (error) {
      console.error('Error marking order as received:', error);
      toast.error('Error marking order as received');
    } finally {
      setLoading(false);
    }
  };

  const deleteOrder = async (orderId: string) => {
    if (!confirm('Are you sure you want to delete this order? If the order was delivered, inventory will be reversed.')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/orders/${orderId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast.success(data.message || 'Order deleted successfully');
        fetchOrders();
        setShowDetailDialog(false);
      } else {
        toast.error(data.error || 'Failed to delete order');
      }
    } catch (error) {
      console.error('Error deleting order:', error);
      toast.error('Error deleting order');
    } finally {
      setLoading(false);
    }
  };

  const resetOrderForm = () => {
    setOrderItems([]);
    setSelectedProduct('');
    setQuantity(1);
    setScheme('');
    setExpectedDeliveryDate('');
    setDeliveryAddress('');
    setNotes('');
  };

  // Filter orders
  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.items.some(item => item.productName.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Calculate statistics
  const totalOrders = orders.length;
  const pendingOrders = orders.filter(o => o.status === 'Pending').length;
  const shippedOrders = orders.filter(o => o.status === 'Shipped').length;
  const deliveredOrders = orders.filter(o => o.status === 'Delivered').length;
  const totalValue = orders.reduce((sum, o) => sum + o.totalAmount, 0);

  // Show create order screen
  if (viewMode === 'create') {
    return (
      <OrderCreation 
        language={language} 
        initialItems={preSelectedItems || undefined}
        onBack={() => {
          setViewMode('list');
          if (onItemsUsed) onItemsUsed();
          fetchOrders(); // Refresh orders when coming back
        }} 
      />
    );
  }

  return (
    <div className="space-y-4 lg:space-y-6 p-3 lg:p-0">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <h2 className="text-xl lg:text-2xl font-bold text-gray-900 pl-2">Order Management</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={fetchOrders}
            disabled={loading}
          >
            <RefreshCw className={`size-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button 
            size="sm" 
            className="bg-purple-600 hover:bg-purple-700"
            onClick={() => setViewMode('create')}
          >
            <Plus className="size-4 mr-2" />
            New Order
          </Button>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 lg:gap-4">
        <Card>
          <CardContent className="pt-4 lg:pt-6">
            <div className="flex flex-col gap-1">
              <ShoppingCart className="size-5 lg:size-6 text-blue-600 mb-2" />
              <p className="text-xs lg:text-sm text-gray-600">Total Orders</p>
              <p className="text-xl lg:text-2xl font-bold">{totalOrders}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 lg:pt-6">
            <div className="flex flex-col gap-1">
              <Clock className="size-5 lg:size-6 text-yellow-600 mb-2" />
              <p className="text-xs lg:text-sm text-gray-600">Pending</p>
              <p className="text-xl lg:text-2xl font-bold text-yellow-600">{pendingOrders}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 lg:pt-6">
            <div className="flex flex-col gap-1">
              <Truck className="size-5 lg:size-6 text-indigo-600 mb-2" />
              <p className="text-xs lg:text-sm text-gray-600">Shipped</p>
              <p className="text-xl lg:text-2xl font-bold text-indigo-600">{shippedOrders}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 lg:pt-6">
            <div className="flex flex-col gap-1">
              <PackageCheck className="size-5 lg:size-6 text-green-600 mb-2" />
              <p className="text-xs lg:text-sm text-gray-600">Delivered</p>
              <p className="text-xl lg:text-2xl font-bold text-green-600">{deliveredOrders}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-2 lg:col-span-1">
          <CardContent className="pt-4 lg:pt-6">
            <div className="flex flex-col gap-1">
              <FileText className="size-5 lg:size-6 text-purple-600 mb-2" />
              <p className="text-xs lg:text-sm text-gray-600">Total Value</p>
              <p className="text-lg lg:text-xl font-bold text-purple-600">
                PKR {(totalValue / 1000).toFixed(0)}K
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Orders List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Orders</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="lg:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
              <Input
                placeholder="Search orders by ID or product name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Orders</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Confirmed">Confirmed</SelectItem>
                <SelectItem value="Processing">Processing</SelectItem>
                <SelectItem value="Shipped">Shipped</SelectItem>
                <SelectItem value="Delivered">Delivered</SelectItem>
                <SelectItem value="Cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Orders Table/Cards */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-8 animate-spin text-purple-600" />
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <ShoppingCart className="size-12 mb-3 opacity-50" />
              <p className="text-sm">No orders found</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-3"
                onClick={() => setShowCreateDialog(true)}
              >
                Create your first order
              </Button>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden lg:block border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="font-semibold">Order ID</TableHead>
                      <TableHead className="font-semibold">Order Date</TableHead>
                      <TableHead className="font-semibold">Products</TableHead>
                      <TableHead className="font-semibold">Expected Delivery</TableHead>
                      <TableHead className="font-semibold text-right">Total Amount</TableHead>
                      <TableHead className="font-semibold">Status</TableHead>
                      <TableHead className="font-semibold text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((order) => {
                      const StatusIcon = statusIcons[order.status];
                      return (
                        <TableRow key={order.id}>
                          <TableCell className="font-mono font-semibold text-sm">
                            {order.id}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Calendar className="size-3 text-gray-400" />
                              <span className="text-sm">
                                {new Date(order.orderDate).toLocaleDateString()}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="text-sm font-semibold">{order.items.length} items</p>
                              <p className="text-xs text-gray-600 truncate max-w-[200px]">
                                {order.items.map(i => i.productName).join(', ')}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">
                              {new Date(order.expectedDeliveryDate).toLocaleDateString()}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-semibold text-purple-600">
                            PKR {order.totalAmount.toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Badge className={`${statusColors[order.status]} border flex items-center gap-1 w-fit`}>
                              <StatusIcon className="size-3" />
                              {order.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedOrder(order);
                                setShowDetailDialog(true);
                              }}
                            >
                              <Eye className="size-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Cards */}
              <div className="lg:hidden space-y-3">
                {filteredOrders.map((order) => {
                  const StatusIcon = statusIcons[order.status];
                  return (
                    <Card key={order.id} className="overflow-hidden">
                      <CardHeader className="pb-3 bg-gray-50">
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-sm font-mono">{order.id}</CardTitle>
                            <p className="text-xs text-gray-600 mt-1">
                              {new Date(order.orderDate).toLocaleDateString()}
                            </p>
                          </div>
                          <Badge className={`${statusColors[order.status]} border text-xs`}>
                            <StatusIcon className="size-3 mr-1" />
                            {order.status}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-3">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Products:</span>
                            <span className="font-semibold">{order.items.length} items</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Total:</span>
                            <span className="font-bold text-purple-600">PKR {order.totalAmount.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Expected Delivery:</span>
                            <span className="font-semibold">{new Date(order.expectedDeliveryDate).toLocaleDateString()}</span>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full mt-2"
                            onClick={() => {
                              setSelectedOrder(order);
                              setShowDetailDialog(true);
                            }}
                          >
                            <Eye className="size-4 mr-2" />
                            View Details
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Order Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedOrder && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <DialogTitle className="font-mono">{selectedOrder.id}</DialogTitle>
                    <DialogDescription>Order Details and Status</DialogDescription>
                  </div>
                  <Badge className={`${statusColors[selectedOrder.status]} border`}>
                    {React.createElement(statusIcons[selectedOrder.status], { className: 'size-3 mr-1' })}
                    {selectedOrder.status}
                  </Badge>
                </div>
              </DialogHeader>

              <div className="space-y-4 mt-4">
                {/* Order Info */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Order Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Order Date:</span>
                      <span className="font-semibold">{new Date(selectedOrder.orderDate).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Expected Delivery:</span>
                      <span className="font-semibold">{new Date(selectedOrder.expectedDeliveryDate).toLocaleDateString()}</span>
                    </div>
                    {selectedOrder.receivedDate && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Received Date:</span>
                        <span className="font-semibold text-green-600">
                          {new Date(selectedOrder.receivedDate).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between pt-2 border-t">
                      <span className="text-gray-600">Total Amount:</span>
                      <span className="font-bold text-lg text-purple-600">
                        PKR {selectedOrder.totalAmount.toLocaleString()}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* Order Items */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Order Items ({selectedOrder.items.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {selectedOrder.items.map((item, index) => (
                        <div key={index} className="p-3 bg-gray-50 rounded-lg border">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="font-semibold text-sm">{item.productName}</p>
                              <p className="text-xs text-gray-600 mt-1">
                                Quantity: {item.quantity} × PKR {item.price.toLocaleString()}
                              </p>
                              {item.scheme && item.scheme !== 'Standard' && (
                                <Badge variant="outline" className="text-xs mt-1">
                                  {item.scheme}
                                </Badge>
                              )}
                            </div>
                            <p className="font-bold text-purple-600">
                              PKR {(item.quantity * item.price).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Delivery Details */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Delivery Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div>
                      <p className="text-gray-600 mb-1">Address:</p>
                      <p className="font-semibold">{selectedOrder.deliveryAddress}</p>
                    </div>
                    {selectedOrder.notes && (
                      <div>
                        <p className="text-gray-600 mb-1">Notes:</p>
                        <p className="text-sm">{selectedOrder.notes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Actions */}
                <div className="flex flex-col gap-2 pt-2">
                  {/* Pending → Confirmed */}
                  {selectedOrder.status === 'Pending' && (
                    <div className="space-y-2">
                      <Button 
                        onClick={() => updateOrderStatus(selectedOrder.id, 'Confirmed')}
                        disabled={loading}
                        className="w-full bg-blue-600 hover:bg-blue-700"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="size-4 mr-2 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="size-4 mr-2" />
                            Confirm Order
                          </>
                        )}
                      </Button>
                      <Button 
                        variant="destructive"
                        onClick={() => updateOrderStatus(selectedOrder.id, 'Cancelled')}
                        disabled={loading}
                        className="w-full"
                      >
                        <XCircle className="size-4 mr-2" />
                        Cancel Order
                      </Button>
                    </div>
                  )}

                  {/* Confirmed → Processing */}
                  {selectedOrder.status === 'Confirmed' && (
                    <Button 
                      onClick={() => updateOrderStatus(selectedOrder.id, 'Processing')}
                      disabled={loading}
                      className="w-full bg-purple-600 hover:bg-purple-700"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="size-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Package className="size-4 mr-2" />
                          Mark as Processing
                        </>
                      )}
                    </Button>
                  )}

                  {/* Processing → Shipped */}
                  {selectedOrder.status === 'Processing' && (
                    <Button 
                      onClick={() => updateOrderStatus(selectedOrder.id, 'Shipped')}
                      disabled={loading}
                      className="w-full bg-indigo-600 hover:bg-indigo-700"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="size-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Truck className="size-4 mr-2" />
                          Mark as Shipped
                        </>
                      )}
                    </Button>
                  )}

                  {/* Shipped → Delivered (Mark as Received) */}
                  {selectedOrder.status === 'Shipped' && (
                    <Button 
                      onClick={() => markAsReceived(selectedOrder.id)}
                      disabled={loading}
                      className="w-full bg-green-600 hover:bg-green-700"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="size-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <PackageCheck className="size-4 mr-2" />
                          Mark as Received & Add to Inventory
                        </>
                      )}
                    </Button>
                  )}
                  
                  {/* Show confirmation message for delivered orders */}
                  {selectedOrder.status === 'Delivered' && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                      <PackageCheck className="size-8 text-green-600 mx-auto mb-2" />
                      <p className="font-semibold text-green-800">Order Delivered</p>
                      <p className="text-sm text-green-600 mt-1">
                        Inventory has been updated
                      </p>
                    </div>
                  )}

                  {/* Show cancellation message */}
                  {selectedOrder.status === 'Cancelled' && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                      <XCircle className="size-8 text-red-600 mx-auto mb-2" />
                      <p className="font-semibold text-red-800">Order Cancelled</p>
                      <p className="text-sm text-red-600 mt-1">
                        This order has been cancelled
                      </p>
                    </div>
                  )}

                  {/* Delete Order */}
                  <Button 
                    variant="destructive"
                    onClick={() => deleteOrder(selectedOrder.id)}
                    disabled={loading}
                    className="w-full"
                  >
                    <Trash2 className="size-4 mr-2" />
                    Delete Order
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}