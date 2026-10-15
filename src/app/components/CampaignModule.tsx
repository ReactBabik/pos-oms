import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Switch } from './ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from './ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { ScrollArea } from './ui/scroll-area';
import {
  Tag,
  Plus,
  Edit,
  Trash2,
  Copy,
  Power,
  TrendingUp,
  Users,
  DollarSign,
  Calendar,
  Clock,
  Gift,
  Percent,
  Target,
  BarChart3,
  Download,
  Search,
  Filter,
  X,
  Play,
  Pause,
  Eye,
  AlertCircle,
  CheckCircle,
  Activity
} from 'lucide-react';
import { toast } from 'sonner';
import type { Language } from '../App';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';

const API_URL = `https://${projectId}.supabase.co/functions/v1/make-server-77be783d`;

interface Campaign {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  discountType: 'percentage' | 'fixed' | 'buyXgetY' | 'bundlePrice';
  discountValue: number;
  buyQuantity?: number;
  getQuantity?: number;
  bundlePrice?: number;
  minOrderValue: number;
  productEligibility: 'all' | 'specific' | 'category' | 'excluded';
  eligibleProducts: string[];
  eligibleCategories: string[];
  excludedProducts: string[];
  customerEligibility: 'all' | 'new' | 'returning' | 'specific';
  eligibleCustomers: string[];
  startDate: string;
  endDate: string | null;
  recurring: boolean;
  recurringSchedule: string[];
  timeSlots: { start: string; end: string }[];
  globalLimit: number | null;
  perCustomerLimit: number | null;
  allowStacking: boolean;
  priority: number;
  requiresCouponCode: boolean;
  couponCode: string;
  autoApply: boolean;
  salesChannels: string[];
  excludeDiscountedItems: boolean;
  usageCount: number;
  totalDiscountGiven: number;
  totalRevenue: number;
  createdAt: string;
  updatedAt: string;
}

interface DiscountLog {
  id: string;
  campaignId: string;
  campaignName: string;
  saleId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  originalSubtotal: number;
  discountAmount: number;
  finalTotal: number;
  affectedProducts: string[];
  timestamp: string;
  cashier: string;
}

const DISCOUNT_TYPE_LABELS = {
  percentage: 'Percentage Off',
  fixed: 'Fixed Amount Off',
  buyXgetY: 'Buy X Get Y Free',
  bundlePrice: 'Bundle Price'
};

const COLORS = ['#C7359C', '#FFD700', '#10b981', '#3b82f6', '#f59e0b', '#ef4444'];

export function CampaignModule({ language }: { language: Language }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [discountLogs, setDiscountLogs] = useState<DiscountLog[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showLogsDialog, setShowLogsDialog] = useState(false);
  const [analyticsStartDate, setAnalyticsStartDate] = useState('');
  const [analyticsEndDate, setAnalyticsEndDate] = useState('');

  // Form state
  const [formData, setFormData] = useState<Partial<Campaign>>({
    name: '',
    description: '',
    enabled: true,
    discountType: 'percentage',
    discountValue: 0,
    buyQuantity: 0,
    getQuantity: 0,
    bundlePrice: 0,
    minOrderValue: 0,
    productEligibility: 'all',
    eligibleProducts: [],
    eligibleCategories: [],
    excludedProducts: [],
    customerEligibility: 'all',
    eligibleCustomers: [],
    startDate: new Date().toISOString().split('T')[0],
    endDate: null,
    recurring: false,
    recurringSchedule: [],
    timeSlots: [],
    globalLimit: null,
    perCustomerLimit: null,
    allowStacking: false,
    priority: 100,
    requiresCouponCode: false,
    couponCode: '',
    autoApply: true,
    salesChannels: ['in-store'],
    excludeDiscountedItems: false,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [campaignsRes, logsRes, productsRes, categoriesRes] = await Promise.all([
        fetch(`${API_URL}/campaigns`, {
          headers: { Authorization: `Bearer ${publicAnonKey}` },
        }),
        fetch(`${API_URL}/discount-logs`, {
          headers: { Authorization: `Bearer ${publicAnonKey}` },
        }),
        fetch(`${API_URL}/products`, {
          headers: { Authorization: `Bearer ${publicAnonKey}` },
        }),
        fetch(`${API_URL}/categories`, {
          headers: { Authorization: `Bearer ${publicAnonKey}` },
        }),
      ]);

      // Helper function to safely parse JSON responses
      const parseJsonSafely = async (response: Response, name: string) => {
        if (!response.ok) {
          console.error(`Failed to fetch ${name}: ${response.status} ${response.statusText}`);
          return null;
        }
        try {
          const text = await response.text();
          if (!text || text.trim() === '') {
            console.error(`Empty response from ${name}`);
            return null;
          }
          return JSON.parse(text);
        } catch (error) {
          console.error(`Error parsing ${name} response:`, error);
          return null;
        }
      };

      const campaignsData = await parseJsonSafely(campaignsRes, 'campaigns');
      const logsData = await parseJsonSafely(logsRes, 'discount-logs');
      const productsData = await parseJsonSafely(productsRes, 'products');
      const categoriesData = await parseJsonSafely(categoriesRes, 'categories');

      if (campaignsData?.success) setCampaigns(campaignsData.campaigns || []);
      if (logsData?.success) setDiscountLogs(logsData.logs || []);
      if (productsData?.success) setProducts(productsData.products || []);
      if (categoriesData?.success) setCategories(categoriesData.categories || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  };

  const createCampaign = async () => {
    try {
      const res = await fetch(`${API_URL}/campaigns`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Campaign created successfully!');
        setCampaigns([data.campaign, ...campaigns]);
        setShowCreateDialog(false);
        resetForm();
      } else {
        toast.error(data.error || 'Failed to create campaign');
      }
    } catch (error) {
      console.error('Error creating campaign:', error);
      toast.error('Failed to create campaign');
    }
  };

  const updateCampaign = async () => {
    if (!selectedCampaign) return;

    try {
      const res = await fetch(`${API_URL}/campaigns/${selectedCampaign.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Campaign updated successfully!');
        setCampaigns(campaigns.map(c => c.id === data.campaign.id ? data.campaign : c));
        setShowEditDialog(false);
        setSelectedCampaign(null);
        resetForm();
      } else {
        toast.error(data.error || 'Failed to update campaign');
      }
    } catch (error) {
      console.error('Error updating campaign:', error);
      toast.error('Failed to update campaign');
    }
  };

  const toggleCampaign = async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/campaigns/${id}/toggle`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${publicAnonKey}` },
      });

      const data = await res.json();

      if (data.success) {
        toast.success(`Campaign ${data.campaign.enabled ? 'enabled' : 'disabled'}`);
        setCampaigns(campaigns.map(c => c.id === id ? data.campaign : c));
      } else {
        toast.error(data.error || 'Failed to toggle campaign');
      }
    } catch (error) {
      console.error('Error toggling campaign:', error);
      toast.error('Failed to toggle campaign');
    }
  };

  const deleteCampaign = async (id: string) => {
    if (!confirm('Are you sure you want to delete this campaign? This action cannot be undone.')) {
      return;
    }

    try {
      const res = await fetch(`${API_URL}/campaigns/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${publicAnonKey}` },
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Campaign deleted successfully!');
        setCampaigns(campaigns.filter(c => c.id !== id));
      } else {
        toast.error(data.error || 'Failed to delete campaign');
      }
    } catch (error) {
      console.error('Error deleting campaign:', error);
      toast.error('Failed to delete campaign');
    }
  };

  const cloneCampaign = async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/campaigns/${id}/clone`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${publicAnonKey}` },
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Campaign cloned successfully!');
        setCampaigns([data.campaign, ...campaigns]);
      } else {
        toast.error(data.error || 'Failed to clone campaign');
      }
    } catch (error) {
      console.error('Error cloning campaign:', error);
      toast.error('Failed to clone campaign');
    }
  };

  const openEditDialog = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setFormData(campaign);
    setShowEditDialog(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      enabled: true,
      discountType: 'percentage',
      discountValue: 0,
      buyQuantity: 0,
      getQuantity: 0,
      bundlePrice: 0,
      minOrderValue: 0,
      productEligibility: 'all',
      eligibleProducts: [],
      eligibleCategories: [],
      excludedProducts: [],
      customerEligibility: 'all',
      eligibleCustomers: [],
      startDate: new Date().toISOString().split('T')[0],
      endDate: null,
      recurring: false,
      recurringSchedule: [],
      timeSlots: [],
      globalLimit: null,
      perCustomerLimit: null,
      allowStacking: false,
      priority: 100,
      requiresCouponCode: false,
      couponCode: '',
      autoApply: true,
      salesChannels: ['in-store'],
      excludeDiscountedItems: false,
    });
  };

  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) {
      toast.error('No data to export');
      return;
    }

    const headers = Object.keys(data[0]);
    const csv = [
      headers.join(','),
      ...data.map(row =>
        headers.map(header => {
          const value = row[header];
          if (typeof value === 'string' && value.includes(',')) {
            return `"${value}"`;
          }
          return value;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Data exported successfully!');
  };

  const filteredCampaigns = campaigns.filter(campaign => {
    const matchesSearch = campaign.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      campaign.description.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'active' && campaign.enabled) ||
      (statusFilter === 'inactive' && !campaign.enabled);

    return matchesSearch && matchesStatus;
  });

  // Filter discount logs by date range
  const filteredDiscountLogs = discountLogs.filter(log => {
    const logDate = log.timestamp.split('T')[0];
    const matchesStart = !analyticsStartDate || logDate >= analyticsStartDate;
    const matchesEnd = !analyticsEndDate || logDate <= analyticsEndDate;
    return matchesStart && matchesEnd;
  });

  // Analytics calculations from filtered logs
  const totalDiscountGiven = filteredDiscountLogs.reduce((sum, log) => sum + (log.discountAmount || 0), 0);
  const totalRevenue = filteredDiscountLogs.reduce((sum, log) => sum + (log.finalTotal || 0), 0);
  const totalUsageCount = filteredDiscountLogs.length;
  const activeCampaigns = campaigns.filter(c => c.enabled).length;

  // Top campaigns by usage
  const topCampaignsByUsage = [...campaigns]
    .sort((a, b) => b.usageCount - a.usageCount)
    .slice(0, 5);

  // Top campaigns by discount given
  const topCampaignsByDiscount = [...campaigns]
    .sort((a, b) => b.totalDiscountGiven - a.totalDiscountGiven)
    .slice(0, 5);

  // Usage over time (last 7 days)
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    return date.toISOString().split('T')[0];
  });

  const usageByDay = last7Days.map(date => {
    const logsForDay = filteredDiscountLogs.filter(log =>
      log.timestamp.split('T')[0] === date
    );
    return {
      date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      count: logsForDay.length,
      discount: logsForDay.reduce((sum, log) => sum + log.discountAmount, 0),
    };
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-bold text-gray-900 flex items-center gap-2 text-[24px]">
            Campaign Management
          </h1>
          
        </div>
        <Button
          onClick={() => {
            resetForm();
            setShowCreateDialog(true);
          }}
          className="bg-gradient-to-r from-[#C7359C] to-[#A62F82] hover:from-[#A62F82] hover:to-[#8B2770] text-white"
        >
          <Plus className="size-4 mr-2" />
          Create Campaign
        </Button>
      </div>

      <Tabs defaultValue="campaigns" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto">
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="logs">Usage Logs</TabsTrigger>
        </TabsList>

        {/* Campaigns Tab */}
        <TabsContent value="campaigns" className="space-y-4">
          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Campaigns</CardTitle>
                <Activity className="size-4 text-[#C7359C]" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{activeCampaigns}</div>
                <p className="text-xs text-gray-600">of {campaigns.length} total</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Usage</CardTitle>
                <Users className="size-4 text-[#FFD700]" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalUsageCount.toLocaleString()}</div>
                <p className="text-xs text-gray-600">discount applications</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Discounts</CardTitle>
                <DollarSign className="size-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">PKR {totalDiscountGiven.toLocaleString()}</div>
                <p className="text-xs text-gray-600">given to customers</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Revenue Generated</CardTitle>
                <TrendingUp className="size-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">PKR {totalRevenue.toLocaleString()}</div>
                <p className="text-xs text-gray-600">with discounts applied</p>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 size-4" />
                  <Input
                    placeholder="Search campaigns..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Campaigns</SelectItem>
                    <SelectItem value="active">Active Only</SelectItem>
                    <SelectItem value="inactive">Inactive Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Campaigns List */}
          <div className="grid gap-4">
            {loading ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#C7359C] mx-auto"></div>
                  <p className="text-gray-600 mt-4">Loading campaigns...</p>
                </CardContent>
              </Card>
            ) : filteredCampaigns.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Gift className="size-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No campaigns found</p>
                  <Button
                    onClick={() => {
                      resetForm();
                      setShowCreateDialog(true);
                    }}
                    className="mt-4 bg-gradient-to-r from-[#C7359C] to-[#A62F82] hover:from-[#A62F82] hover:to-[#8B2770] text-white"
                  >
                    <Plus className="size-4 mr-2" />
                    Create Your First Campaign
                  </Button>
                </CardContent>
              </Card>
            ) : (
              filteredCampaigns.map((campaign) => (
                <Card key={campaign.id} className={campaign.enabled ? 'border-l-4 border-l-[#C7359C]' : 'opacity-60'}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <CardTitle className="text-xl">{campaign.name}</CardTitle>
                          <Badge variant={campaign.enabled ? 'default' : 'secondary'} className={campaign.enabled ? 'bg-green-600' : ''}>
                            {campaign.enabled ? 'Active' : 'Inactive'}
                          </Badge>
                          <Badge variant="outline">
                            {DISCOUNT_TYPE_LABELS[campaign.discountType]}
                          </Badge>
                        </div>
                        <CardDescription>{campaign.description}</CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleCampaign(campaign.id)}
                          title={campaign.enabled ? 'Disable' : 'Enable'}
                        >
                          {campaign.enabled ? <Pause className="size-4" /> : <Play className="size-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(campaign)}
                          title="Edit"
                        >
                          <Edit className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => cloneCampaign(campaign.id)}
                          title="Clone"
                        >
                          <Copy className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteCampaign(campaign.id)}
                          title="Delete"
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-gray-600">Discount</p>
                        <p className="font-semibold">
                          {campaign.discountType === 'percentage' && `${campaign.discountValue}%`}
                          {campaign.discountType === 'fixed' && `PKR ${campaign.discountValue}`}
                          {campaign.discountType === 'buyXgetY' && `Buy ${campaign.buyQuantity} Get ${campaign.getQuantity}`}
                          {campaign.discountType === 'bundlePrice' && `PKR ${campaign.bundlePrice}`}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Usage Count</p>
                        <p className="font-semibold">
                          {campaign.usageCount}
                          {campaign.globalLimit && ` / ${campaign.globalLimit}`}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Total Discount</p>
                        <p className="font-semibold text-orange-600">PKR {campaign.totalDiscountGiven.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Revenue</p>
                        <p className="font-semibold text-green-600">PKR {campaign.totalRevenue.toLocaleString()}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 text-sm">
                      {campaign.minOrderValue > 0 && (
                        <Badge variant="outline">Min Order: PKR {campaign.minOrderValue}</Badge>
                      )}
                      {campaign.requiresCouponCode && (
                        <Badge variant="outline">Code: {campaign.couponCode}</Badge>
                      )}
                      {campaign.productEligibility !== 'all' && (
                        <Badge variant="outline">
                          {campaign.productEligibility === 'specific' && `${campaign.eligibleProducts.length} Products`}
                          {campaign.productEligibility === 'category' && `${campaign.eligibleCategories.length} Categories`}
                          {campaign.productEligibility === 'excluded' && `${campaign.excludedProducts.length} Excluded`}
                        </Badge>
                      )}
                      {campaign.recurring && (
                        <Badge variant="outline">Recurring</Badge>
                      )}
                      {campaign.endDate && (
                        <Badge variant="outline">Until {new Date(campaign.endDate).toLocaleDateString()}</Badge>
                      )}
                    </div>

                    <div className="mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedCampaign(campaign);
                          setShowLogsDialog(true);
                        }}
                      >
                        <Eye className="size-4 mr-2" />
                        View Usage Logs
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          {/* Date Filter */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4 items-end">
                <div className="flex-1">
                  <Label htmlFor="analytics-start-date">Start Date</Label>
                  <Input
                    id="analytics-start-date"
                    type="date"
                    value={analyticsStartDate}
                    onChange={(e) => setAnalyticsStartDate(e.target.value)}
                  />
                </div>
                <div className="flex-1">
                  <Label htmlFor="analytics-end-date">End Date</Label>
                  <Input
                    id="analytics-end-date"
                    type="date"
                    value={analyticsEndDate}
                    onChange={(e) => setAnalyticsEndDate(e.target.value)}
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    setAnalyticsStartDate('');
                    setAnalyticsEndDate('');
                  }}
                >
                  Clear Filter
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Summary Stats */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Usage</CardTitle>
                <Users className="size-4 text-[#FFD700]" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalUsageCount.toLocaleString()}</div>
                <p className="text-xs text-gray-600">discount applications</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Discounts</CardTitle>
                <DollarSign className="size-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">PKR {totalDiscountGiven.toLocaleString()}</div>
                <p className="text-xs text-gray-600">given to customers</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Revenue Generated</CardTitle>
                <TrendingUp className="size-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">PKR {totalRevenue.toLocaleString()}</div>
                <p className="text-xs text-gray-600">with discounts applied</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Top Campaigns by Usage */}
            <Card>
              <CardHeader>
                <CardTitle>Top Campaigns by Usage</CardTitle>
                <CardDescription>Most frequently applied discounts</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {topCampaignsByUsage.map((campaign, index) => (
                    <div key={campaign.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        >
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium">{campaign.name}</p>
                          <p className="text-sm text-gray-600">{campaign.usageCount} times used</p>
                        </div>
                      </div>
                      <Badge>{DISCOUNT_TYPE_LABELS[campaign.discountType]}</Badge>
                    </div>
                  ))}
                  {topCampaignsByUsage.length === 0 && (
                    <p className="text-gray-600 text-center py-4">No usage data yet</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Top Campaigns by Discount Given */}
            <Card>
              <CardHeader>
                <CardTitle>Top Campaigns by Discount</CardTitle>
                <CardDescription>Highest total discount amount</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {topCampaignsByDiscount.map((campaign, index) => (
                    <div key={campaign.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        >
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium">{campaign.name}</p>
                          <p className="text-sm text-gray-600">PKR {campaign.totalDiscountGiven.toLocaleString()}</p>
                        </div>
                      </div>
                      <Badge>{DISCOUNT_TYPE_LABELS[campaign.discountType]}</Badge>
                    </div>
                  ))}
                  {topCampaignsByDiscount.length === 0 && (
                    <p className="text-gray-600 text-center py-4">No discount data yet</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Usage Over Time Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Usage Trends (Last 7 Days)</CardTitle>
              <CardDescription>Daily discount applications and amounts</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={usageByDay}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="count"
                    stroke="#C7359C"
                    name="Usage Count"
                    strokeWidth={2}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="discount"
                    stroke="#FFD700"
                    name="Discount Amount (PKR)"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Export Button */}
          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={() => {
                const exportData = campaigns.map(c => ({
                  Name: c.name,
                  Type: DISCOUNT_TYPE_LABELS[c.discountType],
                  'Usage Count': c.usageCount,
                  'Total Discount': c.totalDiscountGiven,
                  'Total Revenue': c.totalRevenue,
                  Status: c.enabled ? 'Active' : 'Inactive',
                }));
                exportToCSV(exportData, `campaigns-analytics-${new Date().toISOString().split('T')[0]}.csv`);
              }}
            >
              <Download className="size-4 mr-2" />
              Export Analytics
            </Button>
          </div>
        </TabsContent>

        {/* Usage Logs Tab */}
        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Discount Usage Logs</CardTitle>
                  <CardDescription>Complete history of all discount applications</CardDescription>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    const exportData = discountLogs.map(log => ({
                      Date: new Date(log.timestamp).toLocaleString(),
                      Campaign: log.campaignName,
                      'Sale ID': log.saleId,
                      Customer: log.customerName || log.customerPhone,
                      'Customer Number': log.customerPhone,
                      'Original Total': log.originalSubtotal,
                      'Discount Amount': log.discountAmount,
                      'Final Total': log.finalTotal,
                      Cashier: log.cashier,
                    }));
                    exportToCSV(exportData, `discount-logs-${new Date().toISOString().split('T')[0]}.csv`);
                  }}
                >
                  <Download className="size-4 mr-2" />
                  Export Logs
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date & Time</TableHead>
                      <TableHead>Campaign</TableHead>
                      <TableHead>Sale ID</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Customer Number</TableHead>
                      <TableHead>Original</TableHead>
                      <TableHead>Discount</TableHead>
                      <TableHead>Final</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {discountLogs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-gray-600">
                          No discount usage logs yet
                        </TableCell>
                      </TableRow>
                    ) : (
                      discountLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleString()}
                          </TableCell>
                          <TableCell>{log.campaignName}</TableCell>
                          <TableCell className="font-mono text-sm">{log.saleId}</TableCell>
                          <TableCell>
                            {log.customerName || log.customerPhone || 'Walk-in'}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {log.customerPhone || '-'}
                          </TableCell>
                          <TableCell>PKR {log.originalSubtotal.toLocaleString()}</TableCell>
                          <TableCell className="text-orange-600 font-semibold">
                            -PKR {log.discountAmount.toLocaleString()}
                          </TableCell>
                          <TableCell className="font-semibold">
                            PKR {log.finalTotal.toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create/Edit Campaign Dialog */}
      <Dialog open={showCreateDialog || showEditDialog} onOpenChange={(open) => {
        if (!open) {
          setShowCreateDialog(false);
          setShowEditDialog(false);
          setSelectedCampaign(null);
          resetForm();
        }
      }}>
        <DialogContent className="!w-[95vw] !max-w-[95vw] !h-[95vh] !max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {showEditDialog ? 'Edit Campaign' : 'Create New Campaign'}
            </DialogTitle>
            <DialogDescription>
              Configure discount rules and conditions
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="grid md:grid-cols-2 gap-x-8 gap-y-7">
              {/* Left Column */}
              <div className="space-y-7">
                {/* Basic Information */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg border-b pb-2">Basic Information</h3>

                  <div className="grid gap-4">
                    <div>
                      <Label htmlFor="name">Campaign Name *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g., Summer Sale 2025"
                      />
                    </div>

                    <div>
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Brief description of this campaign"
                        rows={2}
                      />
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch
                        id="enabled"
                        checked={formData.enabled}
                        onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
                      />
                      <Label htmlFor="enabled">Enable campaign immediately</Label>
                    </div>
                  </div>
                </div>

                {/* Discount Configuration */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg border-b pb-2">Discount Configuration</h3>

                  <div className="grid gap-4">
                    <div>
                      <Label htmlFor="discountType">Discount Type *</Label>
                      <Select
                        value={formData.discountType}
                        onValueChange={(value: any) => setFormData({ ...formData, discountType: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percentage">Percentage Off</SelectItem>
                          <SelectItem value="fixed">Fixed Amount Off</SelectItem>
                          <SelectItem value="buyXgetY">Buy X Get Y Free</SelectItem>
                          <SelectItem value="bundlePrice">Bundle Price</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {formData.discountType === 'percentage' && (
                      <div>
                        <Label htmlFor="discountValue">Percentage Off (%)</Label>
                        <Input
                          id="discountValue"
                          type="number"
                          min="0"
                          max="100"
                          step="any"
                          value={formData.discountValue || ''}
                          onChange={(e) => setFormData({ ...formData, discountValue: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                        />
                      </div>
                    )}

                    {formData.discountType === 'fixed' && (
                      <div>
                        <Label htmlFor="discountValue">Fixed Discount Amount (PKR)</Label>
                        <Input
                          id="discountValue"
                          type="number"
                          min="0"
                          step="any"
                          value={formData.discountValue || ''}
                          onChange={(e) => setFormData({ ...formData, discountValue: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                        />
                      </div>
                    )}

                    {formData.discountType === 'buyXgetY' && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="buyQuantity">Buy Quantity (X)</Label>
                          <Input
                            id="buyQuantity"
                            type="number"
                            min="1"
                            step="1"
                            value={formData.buyQuantity || ''}
                            onChange={(e) => setFormData({ ...formData, buyQuantity: e.target.value === '' ? 0 : parseInt(e.target.value) })}
                          />
                        </div>
                        <div>
                          <Label htmlFor="getQuantity">Get Quantity (Y)</Label>
                          <Input
                            id="getQuantity"
                            type="number"
                            min="1"
                            step="1"
                            value={formData.getQuantity || ''}
                            onChange={(e) => setFormData({ ...formData, getQuantity: e.target.value === '' ? 0 : parseInt(e.target.value) })}
                          />
                        </div>
                      </div>
                    )}

                    {formData.discountType === 'bundlePrice' && (
                      <div>
                        <Label htmlFor="bundlePrice">Bundle Price (PKR)</Label>
                        <Input
                          id="bundlePrice"
                          type="number"
                          min="0"
                          step="any"
                          value={formData.bundlePrice || ''}
                          onChange={(e) => setFormData({ ...formData, bundlePrice: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                        />
                      </div>
                    )}

                    <div>
                      <Label htmlFor="minOrderValue">Minimum Order Value (PKR)</Label>
                      <Input
                        id="minOrderValue"
                        type="number"
                        min="0"
                        step="any"
                        value={formData.minOrderValue || ''}
                        onChange={(e) => setFormData({ ...formData, minOrderValue: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                        placeholder="0 for no minimum"
                      />
                    </div>
                  </div>
                </div>

                {/* Product Eligibility */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg border-b pb-2">Product Eligibility</h3>

                  <div className="grid gap-4">
                    <div>
                      <Label htmlFor="productEligibility">Applies To</Label>
                      <Select
                        value={formData.productEligibility}
                        onValueChange={(value: any) => setFormData({ ...formData, productEligibility: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Products</SelectItem>
                          <SelectItem value="specific">Specific Products</SelectItem>
                          <SelectItem value="category">Specific Categories</SelectItem>
                          <SelectItem value="excluded">All Except Excluded</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {formData.productEligibility === 'specific' && (
                      <div>
                        <Label htmlFor="eligibleProducts">Eligible Products (AGI Codes, comma-separated)</Label>
                        <Textarea
                          id="eligibleProducts"
                          value={formData.eligibleProducts?.join(', ')}
                          onChange={(e) => setFormData({
                            ...formData,
                            eligibleProducts: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                          })}
                          placeholder="e.g., AGI-001, AGI-002, AGI-003"
                          rows={2}
                        />
                      </div>
                    )}

                    {formData.productEligibility === 'category' && (
                      <div>
                        <Label htmlFor="eligibleCategories">Eligible Categories (comma-separated)</Label>
                        <Textarea
                          id="eligibleCategories"
                          value={formData.eligibleCategories?.join(', ')}
                          onChange={(e) => setFormData({
                            ...formData,
                            eligibleCategories: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                          })}
                          placeholder="e.g., Fungicide, Herbicide, Insecticide"
                          rows={2}
                        />
                        <p className="text-sm text-gray-600 mt-1">
                          Available: {categories.map(c => c.name).join(', ')}
                        </p>
                      </div>
                    )}

                    {formData.productEligibility === 'excluded' && (
                      <div>
                        <Label htmlFor="excludedProducts">Excluded Products (AGI Codes, comma-separated)</Label>
                        <Textarea
                          id="excludedProducts"
                          value={formData.excludedProducts?.join(', ')}
                          onChange={(e) => setFormData({
                            ...formData,
                            excludedProducts: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                          })}
                          placeholder="e.g., AGI-001, AGI-002"
                          rows={2}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-7">
                {/* Time Constraints */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg border-b pb-2">Time Constraints</h3>

                  <div className="grid gap-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="startDate">Start Date</Label>
                        <Input
                          id="startDate"
                          type="date"
                          value={formData.startDate?.split('T')[0] || ''}
                          onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="endDate">End Date (Optional)</Label>
                        <Input
                          id="endDate"
                          type="date"
                          value={formData.endDate?.split('T')[0] || ''}
                          onChange={(e) => setFormData({ ...formData, endDate: e.target.value || null })}
                        />
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch
                        id="recurring"
                        checked={formData.recurring}
                        onCheckedChange={(checked) => setFormData({ ...formData, recurring: checked })}
                      />
                      <Label htmlFor="recurring">Recurring schedule (specific days)</Label>
                    </div>

                    {formData.recurring && (
                      <div>
                        <Label>Recurring Days (comma-separated)</Label>
                        <Input
                          value={formData.recurringSchedule?.join(', ')}
                          onChange={(e) => setFormData({
                            ...formData,
                            recurringSchedule: e.target.value.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
                          })}
                          placeholder="e.g., monday, tuesday, weekend, weekday"
                        />
                        <p className="text-sm text-gray-600 mt-1">
                          Use: monday, tuesday, etc., or 'weekend' / 'weekday'
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Usage Limits */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg border-b pb-2">Usage Limits</h3>

                  <div className="grid gap-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="globalLimit">Global Usage Limit</Label>
                        <Input
                          id="globalLimit"
                          type="number"
                          min="0"
                          value={formData.globalLimit || ''}
                          onChange={(e) => setFormData({
                            ...formData,
                            globalLimit: e.target.value ? parseInt(e.target.value) : null
                          })}
                          placeholder="Unlimited"
                        />
                      </div>
                      <div>
                        <Label htmlFor="perCustomerLimit">Per Customer Limit</Label>
                        <Input
                          id="perCustomerLimit"
                          type="number"
                          min="0"
                          value={formData.perCustomerLimit || ''}
                          onChange={(e) => setFormData({
                            ...formData,
                            perCustomerLimit: e.target.value ? parseInt(e.target.value) : null
                          })}
                          placeholder="Unlimited"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="priority">Priority (higher = higher priority)</Label>
                      <Input
                        id="priority"
                        type="number"
                        min="0"
                        value={formData.priority}
                        onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 100 })}
                      />
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch
                        id="allowStacking"
                        checked={formData.allowStacking}
                        onCheckedChange={(checked) => setFormData({ ...formData, allowStacking: checked })}
                      />
                      <Label htmlFor="allowStacking">Allow stacking with other discounts</Label>
                    </div>
                  </div>
                </div>

                {/* Coupon Code */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg border-b pb-2">Coupon Settings</h3>

                  <div className="grid gap-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="requiresCouponCode"
                        checked={formData.requiresCouponCode}
                        onCheckedChange={(checked) => setFormData({ ...formData, requiresCouponCode: checked })}
                      />
                      <Label htmlFor="requiresCouponCode">Require coupon code</Label>
                    </div>

                    {formData.requiresCouponCode && (
                      <div>
                        <Label htmlFor="couponCode">Coupon Code</Label>
                        <Input
                          id="couponCode"
                          value={formData.couponCode}
                          onChange={(e) => setFormData({ ...formData, couponCode: e.target.value.toUpperCase() })}
                          placeholder="e.g., SUMMER25"
                        />
                      </div>
                    )}

                    {!formData.requiresCouponCode && (
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="autoApply"
                          checked={formData.autoApply}
                          onCheckedChange={(checked) => setFormData({ ...formData, autoApply: checked })}
                        />
                        <Label htmlFor="autoApply">Auto-apply at checkout</Label>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateDialog(false);
                setShowEditDialog(false);
                setSelectedCampaign(null);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={showEditDialog ? updateCampaign : createCampaign}
              className="bg-gradient-to-r from-[#C7359C] to-[#A62F82] hover:from-[#A62F82] hover:to-[#8B2770] text-white"
              disabled={!formData.name}
            >
              {showEditDialog ? 'Update Campaign' : 'Create Campaign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Campaign Logs Dialog */}
      <Dialog open={showLogsDialog} onOpenChange={setShowLogsDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Usage Logs: {selectedCampaign?.name}</DialogTitle>
            <DialogDescription>
              All discount applications for this campaign
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Sale ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Final Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {discountLogs
                  .filter(log => log.campaignId === selectedCampaign?.id)
                  .map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{log.saleId}</TableCell>
                      <TableCell>{log.customerName || log.customerPhone || 'Walk-in'}</TableCell>
                      <TableCell className="text-orange-600 font-semibold">
                        -PKR {log.discountAmount.toLocaleString()}
                      </TableCell>
                      <TableCell className="font-semibold">
                        PKR {log.finalTotal.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                {discountLogs.filter(log => log.campaignId === selectedCampaign?.id).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-gray-600">
                      No usage logs for this campaign yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
