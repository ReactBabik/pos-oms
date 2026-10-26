import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  Package, 
  QrCode, 
  Barcode, 
  Save,
  RefreshCw,
  Upload,
  Tag,
  Sprout,
  Star
} from 'lucide-react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import productImg1 from 'figma:asset/af1f57e40da11e117eb40a873e92e4e1383d482c.png';
import productImg2 from 'figma:asset/79e9316f2141aad01fb899a670136c3e8e63b05b.png';
import productImg3 from 'figma:asset/24bd79d11f624743962fb0e43db9b5538e21e2d3.png';
import { CategoryManagement } from './CategoryManagement';
import { CropManagement, CropTagInput } from './CropManagement';
import { Switch } from './ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

const productImages = [productImg1, productImg2, productImg3];

interface Batch {
  id: string;
  quantity: number;
  price: number;
  expiry: string;
}

interface ProductVariant {
  id: string;
  name: string; // e.g., "1L", "330ML", "5KG"
  unit: string;
  price: number;
  agiCode: string;
  qrCode: string;
  batches: Batch[]; // Batches are now per variant
}

interface Product {
  id: string;
  name: string;
  category: string;
  image: string;
  variants?: ProductVariant[]; // Variants contain all the pricing and inventory info
  featured?: boolean; // shown in the Featured section of the Online Store
  crops?: string[]; // crop names from the crop master
  createdAt?: string;
  updatedAt?: string;
}

const API_URL = `https://${projectId}.supabase.co/functions/v1/make-server-77be783d`;

export function ProductManagement() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<string>('name');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showCategoryManagement, setShowCategoryManagement] = useState(false);
  const [showCropManagement, setShowCropManagement] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [formData, setFormData] = useState<Product>({
    id: '',
    name: '',
    category: '',
    image: '',
    variants: [],
    featured: false,
    crops: []
  });
  const [batchForm, setBatchForm] = useState<Batch>({
    id: '',
    quantity: 0,
    price: 0,
    expiry: ''
  });
  const [variantForm, setVariantForm] = useState<ProductVariant>({
    id: '',
    name: '',
    unit: 'L',
    price: 0,
    agiCode: '',
    qrCode: '',
    batches: []
  });
  const [editingVariantIndex, setEditingVariantIndex] = useState<number | null>(null);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await fetch(`${API_URL}/categories`, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setCategories(data.categories.map((cat: any) => cat.name));
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

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
        toast.success('Products loaded successfully');
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

  const handleSaveProduct = async () => {
    if (!formData.name || !formData.category || !formData.id) {
      toast.error('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      // Debug: Log the product data being saved
      console.log('ProductManagement - Saving product:', formData);
      
      const url = editingProduct 
        ? `${API_URL}/products/${formData.id}`
        : `${API_URL}/products`;
      
      const method = editingProduct ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast.success(editingProduct ? 'Product updated!' : 'Product created!');
        setShowAddDialog(false);
        setEditingProduct(null);
        resetForm();
        fetchProducts();
      } else {
        toast.error(data.error || 'Failed to save product');
      }
    } catch (error) {
      console.error('Error saving product:', error);
      toast.error('Error saving product');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/products/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast.success('Product deleted!');
        fetchProducts();
      } else {
        toast.error(data.error || 'Failed to delete product');
      }
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('Error deleting product');
    } finally {
      setLoading(false);
    }
  };

  // Saves only the featured flag; the update endpoint merges it into the stored product.
  const handleToggleFeatured = async (product: Product, featured: boolean) => {
    setProducts(prev => prev.map(p => p.id === product.id ? { ...p, featured } : p));
    try {
      const response = await fetch(`${API_URL}/products/${product.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ featured })
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      toast.success(featured ? `${product.name} is featured on the Online Store` : `${product.name} removed from featured`);
    } catch (error) {
      console.error('Error updating featured flag:', error);
      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, featured: !featured } : p));
      toast.error('Could not update featured status');
    }
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setFormData(product);
    setShowAddDialog(true);
  };

  const generateProductId = () => {
    // Find the highest product number with SYN- prefix
    const synProducts = products.filter(p => p.id.startsWith('SYN-'));
    let maxNumber = 0;
    
    synProducts.forEach(p => {
      const num = parseInt(p.id.replace('SYN-', ''));
      if (!isNaN(num) && num > maxNumber) {
        maxNumber = num;
      }
    });
    
    // Generate next ID with zero padding
    const nextNumber = maxNumber + 1;
    const paddedNumber = nextNumber.toString().padStart(3, '0');
    return `SYN-${paddedNumber}`;
  };

  const resetForm = () => {
    setFormData({
      id: '',
      name: '',
      category: '',
      image: '',
      variants: [],
      featured: false,
      crops: []
    });
    setBatchForm({
      id: '',
      quantity: 0,
      price: 0,
      expiry: ''
    });
    setVariantForm({
      id: '',
      name: '',
      unit: 'L',
      price: 0,
      agiCode: '',
      qrCode: '',
      batches: []
    });
    setEditingVariantIndex(null);
  };

  const handleAddBatch = () => {
    if (!batchForm.id || !batchForm.price || !batchForm.quantity) {
      toast.error('Please fill in all batch fields');
      return;
    }

    setVariantForm({
      ...variantForm,
      batches: [...variantForm.batches, batchForm]
    });

    setBatchForm({
      id: '',
      quantity: 0,
      price: 0,
      expiry: ''
    });

    toast.success('Batch added');
  };

  const handleRemoveBatch = (index: number) => {
    setVariantForm({
      ...variantForm,
      batches: variantForm.batches.filter((_, i) => i !== index)
    });
  };

  // Variant management functions
  const handleAddVariant = () => {
    if (!variantForm.name || !variantForm.price) {
      toast.error('Please fill in variant name and price');
      return;
    }

    if (editingVariantIndex !== null) {
      // Update existing variant
      const updatedVariants = [...(formData.variants || [])];
      updatedVariants[editingVariantIndex] = variantForm;
      
      setFormData({
        ...formData,
        variants: updatedVariants
      });
      
      setEditingVariantIndex(null);
      toast.success('Variant updated');
    } else {
      // Add new variant
      const newVariant = {
        ...variantForm,
        id: `${formData.id}-V${(formData.variants?.length || 0) + 1}`
      };

      setFormData({
        ...formData,
        variants: [...(formData.variants || []), newVariant]
      });
      
      toast.success('Variant added');
    }

    // Reset form
    setVariantForm({
      id: '',
      name: '',
      unit: 'L',
      price: 0,
      agiCode: '',
      qrCode: '',
      batches: []
    });
  };

  const handleEditVariant = (index: number) => {
    const variant = formData.variants?.[index];
    if (variant) {
      setVariantForm(variant);
      setEditingVariantIndex(index);
      toast.info('Editing variant - make changes and click Update Variant');
    }
  };

  const handleCancelEditVariant = () => {
    setVariantForm({
      id: '',
      name: '',
      unit: 'L',
      price: 0,
      agiCode: '',
      qrCode: '',
      batches: []
    });
    setEditingVariantIndex(null);
    toast.info('Edit cancelled');
  };

  const handleRemoveVariant = (index: number) => {
    setFormData({
      ...formData,
      variants: (formData.variants || []).filter((_, i) => i !== index)
    });
    
    // If we were editing this variant, cancel the edit
    if (editingVariantIndex === index) {
      handleCancelEditVariant();
    } else if (editingVariantIndex !== null && editingVariantIndex > index) {
      // Adjust the editing index if we removed a variant before it
      setEditingVariantIndex(editingVariantIndex - 1);
    }
    
    toast.success('Variant removed');
  };

  const generateVariantAGICode = () => {
    const agiCode = Math.floor(1000000000000 + Math.random() * 9000000000000).toString();
    setVariantForm({ ...variantForm, agiCode });
    toast.success('Variant AGI code generated');
  };

  const generateVariantQR = () => {
    const qr = `QR${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
    setVariantForm({ ...variantForm, qrCode: qr });
    toast.success('Variant QR code generated');
  };

  const generateRandomQR = () => {
    const qr = `QR${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
    setFormData({ ...formData, qrCode: qr });
    toast.success('QR Code generated');
  };

  const generateRandomAGICode = () => {
    const agiCode = Math.floor(1000000000000 + Math.random() * 9000000000000).toString();
    setFormData({ ...formData, agiCode });
    toast.success('AGI Code generated');
  };

  const handleCSVImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast.error('Please upload a CSV file');
      return;
    }

    setLoading(true);
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        toast.error('CSV file is empty or invalid');
        setLoading(false);
        return;
      }

      // Parse CSV header
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      // Expected columns: id, name, category, unit, defaultPrice, qrCode, agiCode, image
      // Optional batch columns: batchId, batchQuantity, batchPrice, batchExpiry
      const products: Product[] = [];
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        if (values.length === 0 || !values[0]) continue;

        const productData: any = {};
        headers.forEach((header, index) => {
          productData[header] = values[index] || '';
        });

        // Build product object
        const product: Product = {
          id: productData.id || `${i}`,
          name: productData.name || '',
          category: productData.category || '',
          image: productData.image || '',
          variants: []
        };

        // Add batch if batch data is present
        if (productData.batchid) {
          const variant: ProductVariant = {
            id: `${productData.id}-V1`,
            name: productData.name || '',
            unit: productData.unit || 'L',
            price: parseFloat(productData.batchprice || productData.defaultprice || '0'),
            agiCode: productData.agicode || '',
            qrCode: productData.qrcode || '',
            batches: [{
              id: productData.batchid,
              quantity: parseInt(productData.batchquantity || '0'),
              price: parseFloat(productData.batchprice || productData.defaultprice || '0'),
              expiry: productData.batchexpiry || ''
            }]
          };
          product.variants.push(variant);
        }

        products.push(product);
      }

      if (products.length === 0) {
        toast.error('No valid products found in CSV');
        setLoading(false);
        return;
      }

      // Send to backend
      const response = await fetch(`${API_URL}/products/bulk`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ products })
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast.success(`Successfully imported ${products.length} products!`);
        fetchProducts();
      } else {
        toast.error(data.error || 'Failed to import products');
      }
    } catch (error) {
      console.error('Error importing CSV:', error);
      toast.error('Error parsing CSV file');
    } finally {
      setLoading(false);
      // Reset file input
      event.target.value = '';
    }
  };

  const filteredProducts = products.filter(p =>
    p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.variants?.some(v => 
      v.qrCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.agiCode?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  // Sort products
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return (a.name || '').trim().toLowerCase().localeCompare((b.name || '').trim().toLowerCase());
      case 'price-asc':
        return (a.defaultPrice || 0) - (b.defaultPrice || 0);
      case 'price-desc':
        return (b.defaultPrice || 0) - (a.defaultPrice || 0);
      case 'stock-asc':
        const stockA = (a.batches || []).reduce((sum, batch) => sum + batch.quantity, 0);
        const stockB = (b.batches || []).reduce((sum, batch) => sum + batch.quantity, 0);
        return stockA - stockB;
      case 'stock-desc':
        const stockDescA = (a.batches || []).reduce((sum, batch) => sum + batch.quantity, 0);
        const stockDescB = (b.batches || []).reduce((sum, batch) => sum + batch.quantity, 0);
        return stockDescB - stockDescA;
      case 'date-new':
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      case 'date-old':
        return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      case 'batches-desc':
        return (b.batches?.length || 0) - (a.batches?.length || 0);
      case 'batches-asc':
        return (a.batches?.length || 0) - (b.batches?.length || 0);
      default:
        return 0;
    }
  });

  // Calculate stats
  const totalVariants = products.reduce((sum, p) => sum + (p.variants?.length || 0), 0);
  const totalBatches = products.reduce((sum, p) => 
    sum + (p.variants?.reduce((vSum, v) => vSum + (v.batches?.length || 0), 0) || 0), 0
  );
  const totalValue = products.reduce((sum, p) => 
    sum + (p.variants?.reduce((vSum, v) => 
      vSum + (v.batches?.reduce((bSum, b) => bSum + (b.quantity * b.price), 0) || 0), 0
    ) || 0), 0
  );
  const uniqueCategories = [...new Set(products.map(p => p.category))].length;

  return (
    <div className="space-y-6 p-3 lg:p-0">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <h2 className="text-xl lg:text-2xl font-bold text-gray-900 pl-2">Product Management</h2>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Products</p>
                <p className="text-2xl font-bold">{products.length}</p>
              </div>
              <Package className="size-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Batches</p>
                <p className="text-2xl font-bold">{totalBatches}</p>
              </div>
              <Package className="size-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Inventory Value</p>
                <p className="text-2xl font-bold">PKR {totalValue.toLocaleString()}</p>
              </div>
              <Package className="size-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Categories</p>
                <p className="text-2xl font-bold">{uniqueCategories}</p>
              </div>
              <Package className="size-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Featured on Store</p>
                <p className="text-2xl font-bold">{products.filter(p => p.featured).length}</p>
              </div>
              <Star className="size-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Product Management Card */}
      <Card>
        <CardContent className="space-y-4 pt-6">
          {/* Search and Actions */}
          <div className="flex gap-2 lg:gap-3 flex-wrap lg:flex-nowrap items-center">
            <div className="relative flex-1 min-w-[200px] lg:min-w-[180px] max-w-full lg:max-w-[220px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 size-4" />
              <Input
                placeholder="Search by name, AGI code, QR code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-10 border-gray-300 focus:border-[#C7359C] focus:ring-[#C7359C]"
              />
            </div>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[140px] lg:w-[150px] h-10 border-gray-300 hover:border-gray-400 focus:border-[#C7359C] focus:ring-[#C7359C]">
                <SelectValue placeholder="Sort By" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name (A-Z)</SelectItem>
                <SelectItem value="price-asc">Price (Low-High)</SelectItem>
                <SelectItem value="price-desc">Price (High-Low)</SelectItem>
                <SelectItem value="stock-desc">Stock (High-Low)</SelectItem>
                <SelectItem value="stock-asc">Stock (Low-High)</SelectItem>
                <SelectItem value="batches-desc">Batches (Most)</SelectItem>
                <SelectItem value="batches-asc">Batches (Least)</SelectItem>
                <SelectItem value="date-new">Newest First</SelectItem>
                <SelectItem value="date-old">Oldest First</SelectItem>
              </SelectContent>
            </Select>
            <div className="hidden lg:block flex-1"></div>
            <Button
              onClick={fetchProducts}
              variant="outline"
              className="h-10 px-3 lg:px-4 border-gray-300 hover:border-[#C7359C] hover:text-[#C7359C] hover:bg-purple-50 transition-all"
              disabled={loading}
            >
              <RefreshCw className={`size-4 lg:mr-2 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden lg:inline">Refresh</span>
            </Button>
            <div className="relative">
              <input
                type="file"
                accept=".csv"
                onChange={handleCSVImport}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                disabled={loading}
              />
              <Button
                variant="outline"
                className="h-10 px-3 lg:px-4 border-gray-300 hover:border-[#C7359C] hover:text-[#C7359C] hover:bg-purple-50 transition-all"
                disabled={loading}
              >
                <Upload className="size-4 lg:mr-2" />
                <span className="hidden lg:inline">Import CSV</span>
              </Button>
            </div>
            <Button
              onClick={() => setShowCategoryManagement(true)}
              variant="outline"
              className="h-10 px-3 lg:px-4 border-gray-300 hover:border-[#C7359C] hover:text-[#C7359C] hover:bg-purple-50 transition-all"
            >
              <Tag className="size-4 lg:mr-2" />
              <span className="hidden lg:inline">Manage Categories</span>
            </Button>
            <Button
              onClick={() => setShowCropManagement(true)}
              variant="outline"
              className="h-10 px-3 lg:px-4 border-gray-300 hover:border-[#C7359C] hover:text-[#C7359C] hover:bg-purple-50 transition-all"
            >
              <Sprout className="size-4 lg:mr-2" />
              <span className="hidden lg:inline">Manage Crops</span>
            </Button>
            <Dialog open={showAddDialog} onOpenChange={(open) => {
              setShowAddDialog(open);
              if (!open) {
                setEditingProduct(null);
                resetForm();
              } else if (!editingProduct) {
                // Auto-generate product ID when opening dialog for new product
                const newId = generateProductId();
                setFormData(prev => ({ ...prev, id: newId }));
              }
            }}>
              <DialogTrigger asChild>
                <Button className="h-10 px-3 lg:px-4 bg-gradient-to-r from-[#C7359C] to-purple-600 hover:from-purple-700 hover:to-[#C7359C] text-white shadow-md hover:shadow-lg transition-all whitespace-nowrap">
                  <Plus className="size-4 lg:mr-2" />
                  <span className="hidden lg:inline">Add Product</span>
                  <span className="lg:hidden">Add</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[90vw] max-w-[90vw] h-[90vh] max-h-[90vh] flex flex-col p-0 gap-0">
                <DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
                  <DialogTitle className="flex items-center gap-2">
                    <Package className="size-5 text-[#C7359C]" />
                    {editingProduct ? 'Edit Product' : 'Add New Product'}
                  </DialogTitle>
                  <DialogDescription>
                    AGI Code is the unique identifier for each product variant
                  </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto px-6 py-4">
                  <div className="max-w-3xl mx-auto space-y-5">
                    {/* Basic Product Info */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Product Name *</Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder="e.g., Axial Herbicide"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="category">Category *</Label>
                        <Select
                          value={formData.category}
                          onValueChange={(value) => setFormData({ ...formData, category: value })}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select a category">
                              {formData.category}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map(cat => (
                              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Image URL */}
                    <div className="space-y-2">
                      <Label htmlFor="image">Image URL (optional)</Label>
                      <div className="flex items-center gap-3">
                        <Input
                          id="image"
                          value={formData.image}
                          onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                          placeholder="Image URL or leave empty for default"
                          className="flex-1"
                        />
                        {formData.image && (
                          <img src={formData.image} alt="Preview" className="w-12 h-12 object-cover rounded flex-shrink-0" />
                        )}
                      </div>
                    </div>

                    {/* Crops */}
                    <div className="space-y-2">
                      <Label>Crops</Label>
                      <CropTagInput
                        value={formData.crops || []}
                        onChange={(crops) => setFormData({ ...formData, crops })}
                      />
                      <p className="text-xs text-gray-500">Type to search crops, press Enter to add. New names are added to the crop list.</p>
                    </div>

                    {/* Featured */}
                    <label className="flex items-center justify-between gap-4 border rounded-lg p-3 cursor-pointer">
                      <div>
                        <p className="text-sm font-medium flex items-center gap-2"><Star className="size-4 text-amber-500" /> Featured on Online Store</p>
                        <p className="text-xs text-gray-500">Shows this product in the store's featured section</p>
                      </div>
                      <Switch
                        checked={!!formData.featured}
                        onCheckedChange={(featured) => setFormData({ ...formData, featured })}
                      />
                    </label>

                    {/* Variants Section */}
                    <Separator />
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-sm">Product Variants</h4>
                        <Badge variant="outline">{formData.variants?.length || 0} variants</Badge>
                      </div>

                      {/* Variant Form */}
                      <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
                        <h5 className="text-sm font-medium">
                          {editingVariantIndex !== null ? 'Edit Variant' : 'Add Variant'}
                        </h5>

                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-2">
                            <Label>Variant Name *</Label>
                            <Input
                              placeholder="e.g., 1L, 330ML"
                              value={variantForm.name}
                              onChange={(e) => setVariantForm({ ...variantForm, name: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Unit *</Label>
                            <Input
                              placeholder="e.g., L, ML, KG"
                              value={variantForm.unit}
                              onChange={(e) => setVariantForm({ ...variantForm, unit: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Price (PKR) *</Label>
                            <Input
                              type="number"
                              placeholder="0"
                              value={variantForm.price || ''}
                              onChange={(e) => setVariantForm({ ...variantForm, price: parseFloat(e.target.value) || 0 })}
                            />
                          </div>
                        </div>

                        {/* AGI Code — unique identifier */}
                        <div className="space-y-2">
                          <Label className="flex items-center gap-1 font-semibold">
                            <Barcode className="size-3 text-[#C7359C]" />
                            AGI Code <span className="text-[#C7359C]">*</span>
                            <span className="ml-1 text-xs font-normal text-gray-400">(unique identifier per variant)</span>
                          </Label>
                          <div className="flex gap-2">
                            <Input
                              placeholder="Enter or generate AGI Code"
                              value={variantForm.agiCode}
                              onChange={(e) => setVariantForm({ ...variantForm, agiCode: e.target.value })}
                              className="font-mono"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={generateVariantAGICode}
                              title="Generate AGI Code"
                            >
                              <Barcode className="size-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="flex gap-2 pt-1">
                          <Button
                            type="button"
                            variant="default"
                            size="sm"
                            onClick={handleAddVariant}
                            className="flex-1 bg-gradient-to-r from-[#C7359C] to-purple-600"
                          >
                            {editingVariantIndex !== null ? (
                              <><Save className="size-4 mr-2" />Update Variant</>
                            ) : (
                              <><Plus className="size-4 mr-2" />Add Variant to Product</>
                            )}
                          </Button>
                          {editingVariantIndex !== null && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={handleCancelEditVariant}
                            >
                              Cancel Edit
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* List of Added Variants */}
                      {formData.variants && formData.variants.length > 0 && (
                        <div className="space-y-2">
                          <h5 className="text-sm font-medium">Added Variants</h5>
                          {formData.variants.map((variant, index) => (
                            <Card key={index} className="border-2">
                              <CardContent className="p-3">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <h6 className="font-semibold">{variant.name}</h6>
                                        <Badge variant="outline" className="text-xs">{variant.unit}</Badge>
                                      </div>
                                      <p className="text-sm text-gray-600 mt-0.5">
                                        PKR {variant.price.toLocaleString()}
                                      </p>
                                    </div>
                                    {variant.agiCode && (
                                      <Badge className="bg-[#C7359C]/10 text-[#C7359C] border-[#C7359C]/20 font-mono text-xs">
                                        <Barcode className="size-3 mr-1" />
                                        {variant.agiCode}
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex gap-1 flex-shrink-0">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleEditVariant(index)}
                                      disabled={editingVariantIndex !== null}
                                      title="Edit variant"
                                    >
                                      <Edit className="size-4 text-purple-600" />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleRemoveVariant(index)}
                                      title="Remove variant"
                                    >
                                      <Trash2 className="size-4 text-red-500" />
                                    </Button>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 px-6 py-4 border-t flex-shrink-0 bg-white">
                  <Button
                    onClick={handleSaveProduct}
                    className="flex-1 bg-gradient-to-r from-[#C7359C] to-purple-600"
                    disabled={loading}
                  >
                    <Save className="size-4 mr-2" />
                    {editingProduct ? 'Update' : 'Create'} Product
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowAddDialog(false);
                      setEditingProduct(null);
                      resetForm();
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Products List */}
          <ScrollArea className="flex-1 h-full">
            <div className="pr-4">
            {loading && products.length === 0 ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <RefreshCw className="size-8 animate-spin text-purple-500 mx-auto mb-2" />
                  <p className="text-gray-500">Loading products...</p>
                </div>
              </div>
            ) : sortedProducts.length === 0 ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <Package className="size-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 mb-2">No products found</p>
                  <p className="text-sm text-gray-400">
                    {searchTerm ? 'Try a different search term' : 'Add your first product to get started'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
                {sortedProducts.map((product) => (
                  <Card key={product.id} className="hover:shadow-lg transition-shadow border-2 hover:border-purple-300">
                    <CardContent className="p-4">
                      <div className="flex gap-3">
                        <img
                          src={product.image || productImages[parseInt(product.id) % 3]}
                          alt={product.name}
                          className="w-20 h-20 object-cover rounded"
                        />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-sm truncate">{product.name}</h3>
                          <Badge variant="outline" className="mt-1 text-xs">
                            {product.category}
                          </Badge>
                          {/* Display AGI Codes for variants */}
                          {product.variants && product.variants.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {product.variants.slice(0, 2).map((variant, idx) => (
                                variant.agiCode && (
                                  <div key={idx} className="flex items-center gap-1 text-xs text-gray-600">
                                    <Barcode className="size-3" />
                                    <span className="font-mono font-semibold">{variant.agiCode}</span>
                                    <span className="text-gray-400">({variant.name})</span>
                                  </div>
                                )
                              ))}
                              {product.variants.length > 2 && (
                                <div className="text-xs text-gray-400">
                                  +{product.variants.length - 2} more variant(s)
                                </div>
                              )}
                            </div>
                          )}
                          {product.crops && product.crops.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {product.crops.slice(0, 3).map(crop => (
                                <span key={crop} className="inline-flex items-center gap-1 rounded-full bg-green-50 border border-green-200 text-green-800 text-[11px] px-2 py-0.5">
                                  <Sprout className="size-3" />{crop}
                                </span>
                              ))}
                              {product.crops.length > 3 && (
                                <span className="text-[11px] text-gray-500 px-1 py-0.5">+{product.crops.length - 3} more</span>
                              )}
                            </div>
                          )}
                          <p className="text-xs text-gray-600 mt-2">
                            {product.variants?.length || 0} variant(s)
                          </p>
                          <p className="text-xs text-gray-500">
                            {product.variants?.reduce((sum, v) => sum + (v.batches?.length || 0), 0) || 0} batch(es)
                          </p>
                        </div>
                      </div>
                      <label className="flex items-center justify-between mt-3 pt-3 border-t text-xs cursor-pointer">
                        <span className={`flex items-center gap-1.5 font-medium ${product.featured ? 'text-amber-700' : 'text-gray-600'}`}>
                          <Star className={`size-3.5 ${product.featured ? 'fill-amber-400 text-amber-500' : 'text-gray-400'}`} />
                          Featured on Online Store
                        </span>
                        <Switch
                          checked={!!product.featured}
                          onCheckedChange={(featured) => handleToggleFeatured(product, featured)}
                        />
                      </label>
                      <div className="flex gap-2 mt-3">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => handleEditProduct(product)}
                        >
                          <Edit className="size-3 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-500 hover:bg-red-50"
                          onClick={() => handleDeleteProduct(product.id)}
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Category Management Dialog */}
      <CategoryManagement
        open={showCategoryManagement}
        onClose={() => setShowCategoryManagement(false)}
        onCategoriesUpdated={fetchCategories}
      />

      <CropManagement
        open={showCropManagement}
        onClose={() => setShowCropManagement(false)}
      />
    </div>
  );
}