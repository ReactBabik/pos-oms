import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Label } from './ui/label';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Search, Scan, Plus, Minus, Trash2, DollarSign, CreditCard, User, Phone, MapPin, ShoppingCart, Heart, X, RefreshCw, Camera, Mic, Maximize2, Minimize2, Barcode } from 'lucide-react';
import { toast } from 'sonner';
import type { Language } from '../App';
import productImg1 from 'figma:asset/af1f57e40da11e117eb40a873e92e4e1383d482c.png';
import productImg2 from 'figma:asset/79e9316f2141aad01fb899a670136c3e8e63b05b.png';
import productImg3 from 'figma:asset/24bd79d11f624743962fb0e43db9b5538e21e2d3.png';
import whatsappLogo from '../../imports/WA_Logo.png';
import { QRScanner } from './QRScanner';
import { AICamera } from './AICameraCDN';
// Lazy load VoiceToCart to avoid build issues with large TensorFlow packages
import { VoiceToCartLazy } from './VoiceToCartLazy';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_URL = `https://${projectId}.supabase.co/functions/v1/make-server-77be783d`;

// Product images array for cycling
const productImages = [productImg1, productImg2, productImg3];

// Mock product data for backwards compatibility (will be replaced by API data)
const mockProducts: any[] = [
  {
    id: '1',
    name: 'ACANTO PLUS 300SC',
    category: 'Fungicide',
    unit: 'L',
    defaultPrice: 2500,
    image: productImages[0],
    qrCode: 'QR-ACANTO-001',
    barcode: '8901234567890',
    batches: [
      { id: 'B001', quantity: 50, price: 2500, expiry: '2025-06-30' },
      { id: 'B002', quantity: 30, price: 2550, expiry: '2025-08-15' },
    ],
  },
  {
    id: '2',
    name: 'AMPLIGO 150ZC',
    category: 'Insecticide',
    unit: 'L',
    defaultPrice: 3200,
    image: productImages[1],
    qrCode: 'QR-AMPLIGO-002',
    barcode: '8901234567891',
    batches: [
      { id: 'B003', quantity: 40, price: 3200, expiry: '2025-05-20' },
      { id: 'B004', quantity: 25, price: 3250, expiry: '2025-09-10' },
    ],
  },
  {
    id: '3',
    name: 'FORCE 1.5G',
    category: 'Insecticide',
    unit: 'KG',
    defaultPrice: 850,
    image: productImages[2],
    qrCode: 'QR-FORCE-003',
    barcode: '8901234567892',
    batches: [
      { id: 'B005', quantity: 100, price: 850, expiry: '2025-07-15' },
    ],
  },
  {
    id: '4',
    name: 'ELATUS 300OD',
    category: 'Fungicide',
    unit: 'L',
    defaultPrice: 4200,
    image: productImages[0],
    qrCode: 'QR-ELATUS-004',
    barcode: '8901234567893',
    batches: [
      { id: 'B006', quantity: 60, price: 4200, expiry: '2025-04-30' },
      { id: 'B007', quantity: 45, price: 4300, expiry: '2025-10-20' },
    ],
  },
  {
    id: '5',
    name: 'AXIAL XL 050 EC',
    category: 'Herbicide',
    unit: 'L',
    defaultPrice: 1650,
    image: productImages[1],
    qrCode: 'QR-AXIAL-005',
    barcode: '8901234567894',
    batches: [
      { id: 'B008', quantity: 35, price: 1650, expiry: '2025-08-20' },
    ],
  },
  {
    id: '6',
    name: 'LOGRAN 75 WG',
    category: 'Herbicide',
    unit: 'GM',
    defaultPrice: 800,
    image: productImages[2],
    qrCode: 'QR-LOGRAN-006',
    barcode: '8901234567895',
    batches: [
      { id: 'B009', quantity: 80, price: 800, expiry: '2025-09-15' },
    ],
  },
  {
    id: '7',
    name: 'METRIBUZIN 70% WP',
    category: 'Herbicide',
    unit: 'GM',
    defaultPrice: 500,
    image: productImages[0],
    qrCode: 'QR-METRIBUZIN-007',
    barcode: '8901234567896',
    batches: [
      { id: 'B010', quantity: 90, price: 500, expiry: '2025-07-30' },
    ],
  },
  {
    id: '8',
    name: 'ACTARA 25 WG',
    category: 'Insecticide',
    unit: 'GM',
    defaultPrice: 500,
    image: productImages[1],
    qrCode: 'QR-ACTARA-008',
    barcode: '8901234567897',
    batches: [
      { id: 'B011', quantity: 70, price: 500, expiry: '2025-10-05' },
    ],
  },
];

interface CartItem {
  productId: string;
  variantId: string;
  productName: string;
  variantName: string;
  batchId: string;
  quantity: number;
  price: number;
  unit: string;
  expiry: string;
  tempId?: string;
  image?: string;
}

interface Customer {
  name: string;
  phone: string;
  village: string;
  commissionShop?: string;
}

export function POSMain({ 
  language,
  showMobileCart: externalShowMobileCart,
  setShowMobileCart: externalSetShowMobileCart,
  showVoiceRecognition: externalShowVoiceRecognition,
  setShowVoiceRecognition: externalSetShowVoiceRecognition
}: { 
  language: Language;
  showMobileCart?: boolean;
  setShowMobileCart?: (show: boolean) => void;
  showVoiceRecognition?: boolean;
  setShowVoiceRecognition?: (show: boolean) => void;
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCheckout, setShowCheckout] = useState(false);
  const [internalShowMobileCart, setInternalShowMobileCart] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'credit'>('cash');
  const [cashAmount, setCashAmount] = useState<number>(0);
  const [creditAmount, setCreditAmount] = useState<number>(0);
  const [discount, setDiscount] = useState<number>(0);
  const [couponCode, setCouponCode] = useState<string>('');
  const [applicableDiscounts, setApplicableDiscounts] = useState<any[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<any | null>(null);
  const [evaluatingDiscounts, setEvaluatingDiscounts] = useState(false);
  const [customer, setCustomer] = useState<Customer>({ name: '', phone: '03', village: '' });
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastSale, setLastSale] = useState<any>(null);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showAICamera, setShowAICamera] = useState(false);
  const [internalShowVoiceRecognition, setInternalShowVoiceRecognition] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [sortBy, setSortBy] = useState<string>('name');
  const [isCompactView, setIsCompactView] = useState(false);
  const [posDisplaySettings, setPosDisplaySettings] = useState(() => {
    const saved = localStorage.getItem('posDisplaySettings');
    return saved ? JSON.parse(saved) : { showOutOfStock: false };
  });
  const scannerRef = useRef<HTMLDivElement>(null);
  
  // Customer autocomplete states
  const [existingCustomers, setExistingCustomers] = useState<any[]>([]);
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
  const [showCommissionShopSuggestions, setShowCommissionShopSuggestions] = useState(false);
  const customerNameRef = useRef<HTMLDivElement>(null);
  const commissionShopRef = useRef<HTMLDivElement>(null);
  
  // Favorites state - persisted in localStorage
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('posFavorites');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  // Save favorites to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('posFavorites', JSON.stringify(Array.from(favorites)));
  }, [favorites]);

  // Toggle favorite status
  const toggleFavorite = (productId: string) => {
    setFavorites(prev => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(productId)) {
        newFavorites.delete(productId);
        toast.success('Removed from favorites');
      } else {
        newFavorites.add(productId);
        toast.success('Added to favorites');
      }
      return newFavorites;
    });
  };

  // Use external state if provided, otherwise use internal state
  const showMobileCart = externalShowMobileCart !== undefined ? externalShowMobileCart : internalShowMobileCart;
  const setShowMobileCart = externalSetShowMobileCart || setInternalShowMobileCart;
  const showVoiceRecognition = externalShowVoiceRecognition !== undefined ? externalShowVoiceRecognition : internalShowVoiceRecognition;
  const setShowVoiceRecognition = externalSetShowVoiceRecognition || setInternalShowVoiceRecognition;

  // Fetch products and customers from backend on component mount
  useEffect(() => {
    fetchProducts();
    fetchCustomers();
  }, []);

  // Fetch existing customers from sales data
  const fetchCustomers = async () => {
    try {
      const response = await fetch(`${API_URL}/sales`, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`
        }
      });

      const result = await response.json();

      if (result.success && result.sales) {
        // Extract unique customers with their details
        const customerMap = new Map();
        
        result.sales.forEach((sale: any) => {
          const key = sale.phone || sale.customer; // Use phone as primary key
          if (!customerMap.has(key)) {
            customerMap.set(key, {
              name: sale.customer,
              phone: sale.phone,
              village: sale.address || '',
              commissionShop: sale.commissionShop || ''
            });
          }
        });
        
        setExistingCustomers(Array.from(customerMap.values()));
        console.log('✅ Loaded existing customers:', customerMap.size);
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const fetchProducts = async () => {
    setLoadingProducts(true);
    try {
      const response = await fetch(`${API_URL}/products`, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      console.log('📦 Products API Response:', data);
      console.log('📦 Products array:', data.products);
      console.log('📦 Products count:', data.products?.length || 0);
      
      if (data.success) {
        console.log('✅ Using products from API');
        if (data.products && data.products.length > 0) {
          console.log('📦 Sample product from API:', data.products[0]);
        }
        setProducts(data.products || []);
      } else {
        console.error('❌ Failed to fetch products:', data.error);
        toast.error('Failed to load products');
        setProducts([]);
      }
    } catch (error) {
      console.error('❌ Error fetching products:', error);
      toast.error('Error loading products');
      setProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  };

  // Flatten products to variants for display
  // Each variant is treated as a separate item in the POS
  const flattenedVariants = products.flatMap(product => {
    if (!product.variants || product.variants.length === 0) {
      // If no variants, return the product itself (for backward compatibility)
      return [{
        ...product,
        variantId: product.id,
        displayName: product.name,
        productId: product.id,
        productName: product.name,
        variantName: '',
        // For backwards compatibility with old products
        batches: product.batches || [],
        unit: product.unit || '',
        price: product.defaultPrice || 0,
        barcode: product.barcode || '',
        qrCode: product.qrCode || ''
      }];
    }
    
    // Return each variant as a separate item
    return product.variants.map(variant => ({
      ...variant,
      variantId: variant.id,
      displayName: `${product.name} ${variant.name}`,
      productId: product.id,
      productName: product.name,
      variantName: variant.name,
      category: product.category,
      image: product.image,
      // Variant already has: batches, unit, price, barcode, qrCode
    }));
  });

  // Get unique categories from fetched products, add Favorites
  const categories = ['All', 'Favorites', ...Array.from(new Set(products.map(p => p.category)))];

  // Calculate visible favorites count (excluding out of stock if setting is off)
  const visibleFavoritesCount = flattenedVariants.filter(v => {
    const isFavorite = favorites.has(v.productId) || favorites.has(v.variantId);
    if (!isFavorite) return false;

    // Check if out of stock
    const totalStock = (v.batches || []).reduce((sum: number, batch: any) => sum + batch.quantity, 0);
    const isOutOfStock = totalStock === 0;

    // If setting is OFF and variant is out of stock, don't count it
    if (!posDisplaySettings.showOutOfStock && isOutOfStock) {
      return false;
    }

    return true;
  }).length;

  // Listen for setting changes
  useEffect(() => {
    const handleStorageChange = () => {
      const saved = localStorage.getItem('posDisplaySettings');
      if (saved) {
        setPosDisplaySettings(JSON.parse(saved));
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    // Also check on mount and interval for same-tab updates
    const interval = setInterval(handleStorageChange, 500);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  const filteredProducts = flattenedVariants.filter(v => {
    const matchesSearch = v.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.variantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.category.toLowerCase().includes(searchTerm.toLowerCase());

    // Check if variant is out of stock
    const totalStock = (v.batches || []).reduce((sum: number, batch: any) => sum + batch.quantity, 0);
    const isOutOfStock = totalStock === 0;

    // If setting is OFF and variant is out of stock, hide it
    if (!posDisplaySettings.showOutOfStock && isOutOfStock) {
      return false;
    }

    // Handle Favorites category - check both product and variant IDs
    let matchesCategory = true;
    if (selectedCategory === 'Favorites') {
      matchesCategory = favorites.has(v.productId) || favorites.has(v.variantId);
    } else if (selectedCategory !== 'All') {
      matchesCategory = v.category === selectedCategory;
    }
    
    return matchesSearch && matchesCategory;
  });

  // Sort products
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        // Sort by product name first, then variant name
        const productCompare = (a.productName || '').trim().toLowerCase().localeCompare((b.productName || '').trim().toLowerCase());
        if (productCompare !== 0) return productCompare;
        return (a.variantName || '').trim().toLowerCase().localeCompare((b.variantName || '').trim().toLowerCase());
      case 'price-asc':
        const priceA = a.batches?.[0]?.price || a.price || 0;
        const priceB = b.batches?.[0]?.price || b.price || 0;
        return priceA - priceB;
      case 'price-desc':
        const priceDescA = a.batches?.[0]?.price || a.price || 0;
        const priceDescB = b.batches?.[0]?.price || b.price || 0;
        return priceDescB - priceDescA;
      case 'stock-asc':
        const stockA = (a.batches || []).reduce((sum: number, batch: any) => sum + batch.quantity, 0);
        const stockB = (b.batches || []).reduce((sum: number, batch: any) => sum + batch.quantity, 0);
        return stockA - stockB;
      case 'stock-desc':
        const stockDescA = (a.batches || []).reduce((sum: number, batch: any) => sum + batch.quantity, 0);
        const stockDescB = (b.batches || []).reduce((sum: number, batch: any) => sum + batch.quantity, 0);
        return stockDescB - stockDescA;
      case 'date-new':
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      case 'date-old':
        return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      default:
        return 0;
    }
  });

  // Add product to cart with FEFO (First Expiry First Out)
  const addToCart = (variant: any, quantity: number = 1) => {
    // Check if variant has batches
    if (!variant.batches || variant.batches.length === 0) {
      // Use variant price if no batches
      if (!variant.price || variant.price <= 0) {
        toast.error('Variant has no price configured');
        return;
      }

      // Use functional update to avoid stale state issues
      setCart(prevCart => {
        const existingItem = prevCart.find(
          item => item.variantId === variant.variantId && item.batchId === 'DEFAULT'
        );

        if (existingItem) {
          const newQuantity = existingItem.quantity + quantity;
          
          // Update quantity of existing item
          const updatedCart = prevCart.map(item =>
            item.variantId === variant.variantId && item.batchId === 'DEFAULT'
              ? { ...item, quantity: newQuantity }
              : item
          );
          
          if (quantity === 1) {
            toast.success(`Added ${variant.productName} ${variant.variantName} to cart (Total: ${newQuantity})`);
          } else {
            toast.success(`Added ${quantity} × ${variant.productName} ${variant.variantName} to cart (Total: ${newQuantity})`);
          }
          
          return updatedCart;
        } else {
          // Add new item to cart with variant price
          const newItem: CartItem = {
            productId: variant.productId,
            variantId: variant.variantId,
            productName: variant.productName,
            variantName: variant.variantName,
            batchId: 'DEFAULT',
            quantity: quantity,
            price: variant.price,
            unit: variant.unit,
            expiry: 'N/A',
            tempId: `${variant.variantId}-DEFAULT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            image: variant.image,
          };
          
          if (quantity === 1) {
            toast.success(`Added ${variant.productName} ${variant.variantName} to cart`);
          } else {
            toast.success(`Added ${quantity} × ${variant.productName} ${variant.variantName} to cart`);
          }
          
          return [...prevCart, newItem];
        }
      });
      return;
    }

    // Sort batches by expiry date (earliest first) - FEFO
    const sortedBatches = [...variant.batches].sort((a, b) =>
      new Date(a.expiry).getTime() - new Date(b.expiry).getTime()
    );

    const earliestBatch = sortedBatches.find(b => b.quantity > 0);

    if (!earliestBatch) {
      // If no batch stock, check if variant price exists
      if (variant.price && variant.price > 0) {
        toast.warning('No batch stock available, using variant price');
        // Use variant price path
        const tempVariant = { ...variant, batches: [] };
        addToCart(tempVariant, quantity);
        return;
      }
      toast.error('Variant out of stock');
      return;
    }

    // Use functional update to avoid stale state issues
    setCart(prevCart => {
      const existingItem = prevCart.find(
        item => item.variantId === variant.variantId && item.batchId === earliestBatch.id
      );

      if (existingItem) {
        const newQuantity = existingItem.quantity + quantity;
        if (newQuantity > earliestBatch.quantity) {
          toast.error('Insufficient stock in batch');
          return prevCart; // Return unchanged cart
        }
        
        // Update quantity of existing item
        const updatedCart = prevCart.map(item =>
          item.variantId === variant.variantId && item.batchId === earliestBatch.id
            ? { ...item, quantity: newQuantity }
            : item
        );
        
        if (quantity === 1) {
          toast.success(`Added ${variant.productName} ${variant.variantName} to cart (Total: ${newQuantity})`);
        } else {
          toast.success(`Added ${variant.productName} ${variant.variantName} to cart (Total: ${newQuantity})`);
        }
        
        return updatedCart;
      } else {
        // Add new item to cart
        if (quantity > earliestBatch.quantity) {
          toast.error('Insufficient stock in batch');
          return prevCart; // Return unchanged cart
        }
        
        const newItem: CartItem = {
          productId: variant.productId,
          variantId: variant.variantId,
          productName: variant.productName,
          variantName: variant.variantName,
          batchId: earliestBatch.id,
          quantity: quantity,
          price: earliestBatch.price,
          unit: variant.unit,
          expiry: earliestBatch.expiry,
          tempId: `${variant.variantId}-${earliestBatch.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          image: variant.image,
        };
        
        if (quantity === 1) {
          toast.success(`Added ${variant.productName} ${variant.variantName} to cart`);
        } else {
          toast.success(`Added ${quantity} × ${variant.productName} ${variant.variantName} to cart`);
        }
        
        return [...prevCart, newItem];
      }
    });
  };

  const updateQuantity = (variantId: string, batchId: string, delta: number) => {
    setCart(prevCart => prevCart.map(item =>
      item.variantId === variantId && item.batchId === batchId
        ? { ...item, quantity: Math.max(1, item.quantity + delta) }
        : item
    ).filter(item => item.quantity > 0));
  };

  const setQuantityDirectly = (variantId: string, batchId: string, value: string) => {
    const numValue = parseInt(value);
    
    // Allow empty string while typing
    if (value === '') {
      return;
    }
    
    // Validate number
    if (isNaN(numValue) || numValue < 1) {
      toast.error('Quantity must be at least 1');
      return;
    }
    
    if (numValue > 999) {
      toast.error('Maximum quantity is 999');
      return;
    }
    
    // Use prevCart to get the current state
    setCart(prevCart => {
      // Find variant and check stock
      const cartItem = prevCart.find(item => item.variantId === variantId && item.batchId === batchId);
      if (!cartItem) return prevCart;
      
      const variant = flattenedVariants.find(v => v.variantId === variantId);
      const batch = variant?.batches?.find(b => b.id === batchId);
      
      if (batch && numValue > batch.quantity) {
        toast.error(`Only ${batch.quantity} ${cartItem.unit} available in stock`);
        return prevCart;
      }
      
      return prevCart.map(item =>
        item.variantId === variantId && item.batchId === batchId
          ? { ...item, quantity: numValue }
          : item
      );
    });
  };

  const removeItem = (variantId: string, batchId: string) => {
    setCart(prevCart => prevCart.filter(item => !(item.variantId === variantId && item.batchId === batchId)));
    toast.success('Item removed from cart');
  };

  const removeFromCart = (tempId: string) => {
    setCart(prevCart => prevCart.filter(item => item.tempId !== tempId));
    toast.success('Item removed from cart');
  };

  const getTotal = () => {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  };

  const getSubtotal = () => {
    return getTotal();
  };

  const getFinalTotal = () => {
    return Math.max(0, getTotal() - discount);
  };

  const handleCheckout = () => {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }
    const finalTotal = getFinalTotal();
    // Initialize with full cash payment by default
    setCashAmount(finalTotal);
    setCreditAmount(0);
    setDiscount(0); // Reset discount
    setSelectedCampaign(null); // Reset selected campaign
    setShowCheckout(true);
  };

  // Click outside handlers for autocomplete dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (customerNameRef.current && !customerNameRef.current.contains(event.target as Node)) {
        setShowCustomerSuggestions(false);
      }
      if (commissionShopRef.current && !commissionShopRef.current.contains(event.target as Node)) {
        setShowCommissionShopSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Get filtered customer suggestions based on name or phone
  const getCustomerSuggestions = () => {
    if (!customer.name && customer.phone === '03') return [];
    
    // First filter by commission shop if entered
    let filteredCustomers = existingCustomers;
    if (customer.commissionShop && customer.commissionShop.trim()) {
      filteredCustomers = existingCustomers.filter(c => 
        c.commissionShop && 
        c.commissionShop.toLowerCase() === customer.commissionShop!.toLowerCase()
      );
    }
    
    // Then filter by name or phone
    return filteredCustomers.filter(c => {
      const searchName = customer.name.toLowerCase();
      const searchPhone = customer.phone;
      
      return (
        (searchName && c.name.toLowerCase().includes(searchName)) ||
        (searchPhone.length > 2 && c.phone.includes(searchPhone))
      );
    }).slice(0, 5); // Limit to 5 suggestions
  };

  // Get unique commission shops
  const getCommissionShopSuggestions = () => {
    if (!customer.commissionShop) return [];
    
    const uniqueShops = Array.from(new Set(
      existingCustomers
        .map(c => c.commissionShop)
        .filter(shop => shop && shop.toLowerCase().includes(customer.commissionShop!.toLowerCase()))
    )).slice(0, 5);
    
    return uniqueShops;
  };

  // Select customer from suggestions
  const selectCustomer = (selectedCustomer: any) => {
    setCustomer({
      name: selectedCustomer.name,
      phone: selectedCustomer.phone,
      village: selectedCustomer.village,
      commissionShop: selectedCustomer.commissionShop || ''
    });
    setShowCustomerSuggestions(false);
    toast.success('Customer details loaded');
  };

  // Select commission shop from suggestions
  const selectCommissionShop = (shop: string) => {
    setCustomer({ ...customer, commissionShop: shop });
    setShowCommissionShopSuggestions(false);
  };

  // Handle cash amount change
  const handleCashAmountChange = (value: string) => {
    const numValue = parseFloat(value) || 0;
    const finalTotal = getFinalTotal();
    
    if (numValue < 0) {
      toast.error('Cash amount cannot be negative');
      return;
    }
    
    if (numValue > finalTotal) {
      toast.error('Cash amount cannot exceed total');
      return;
    }
    
    setCashAmount(numValue);
    setCreditAmount(finalTotal - numValue);
  };

  // Handle credit amount change
  const handleCreditAmountChange = (value: string) => {
    const numValue = parseFloat(value) || 0;
    const finalTotal = getFinalTotal();
    
    if (numValue < 0) {
      toast.error('Credit amount cannot be negative');
      return;
    }
    
    if (numValue > finalTotal) {
      toast.error('Credit amount cannot exceed total');
      return;
    }
    
    setCreditAmount(numValue);
    setCashAmount(finalTotal - numValue);
  };

  // Handle discount change
  const handleDiscountChange = (value: string) => {
    const numValue = parseFloat(value) || 0;
    const subtotal = getSubtotal();

    if (numValue < 0) {
      toast.error('Discount cannot be negative');
      return;
    }

    if (numValue > subtotal) {
      toast.error('Discount cannot exceed subtotal');
      return;
    }

    setDiscount(numValue);
    // Clear selected campaign if manual discount is applied
    if (numValue > 0 && selectedCampaign) {
      setSelectedCampaign(null);
    }
    // Update payment amounts to match new total
    const newFinalTotal = subtotal - numValue;
    if (cashAmount > 0 && creditAmount === 0) {
      // If paying all cash, update cash amount
      setCashAmount(newFinalTotal);
    } else if (creditAmount > 0 && cashAmount === 0) {
      // If paying all credit, update credit amount
      setCreditAmount(newFinalTotal);
    } else {
      // If split payment, maintain ratio
      const ratio = cashAmount / (cashAmount + creditAmount);
      setCashAmount(newFinalTotal * ratio);
      setCreditAmount(newFinalTotal * (1 - ratio));
    }
  };

  // Evaluate applicable campaigns
  const evaluateCampaigns = async (isManualApply = false) => {
    console.log('evaluateCampaigns called, cart length:', cart.length, 'manual:', isManualApply);
    if (cart.length === 0) {
      setApplicableDiscounts([]);
      return;
    }

    setEvaluatingDiscounts(true);
    try {
      const subtotal = getSubtotal();
      console.log('Subtotal for evaluation:', subtotal);

      // Prepare cart items for evaluation
      const cartItems = cart.map(item => ({
        productId: item.productId,
        variantId: item.variantId,
        productName: item.productName,
        variantName: item.variantName,
        quantity: item.quantity,
        price: item.price,
        category: products.find(p => p.id === item.productId)?.category || '',
        agiCode: products.find(p => p.id === item.productId)?.agiCode || '',
      }));

      console.log('Sending campaign evaluation request:', {
        cartItems,
        customerId: customer.phone,
        customerPhone: customer.phone,
        subtotal,
        couponCode: couponCode.trim(),
      });

      const res = await fetch(`${API_URL}/campaigns/evaluate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({
          cartItems,
          customerId: customer.phone,
          customerPhone: customer.phone,
          subtotal,
          couponCode: couponCode.trim(),
        }),
      });

      console.log('Response status:', res.status);

      if (!res.ok) {
        const errorText = await res.text();
        console.error('Server error response:', errorText);
        toast.error('Failed to evaluate campaigns');
        return;
      }

      const data = await res.json();
      console.log('Response data:', data);

      if (data.success) {
        console.log('Campaigns evaluated:', data.discounts);
        console.log('Current discount:', discount, 'Selected campaign:', selectedCampaign);
        setApplicableDiscounts(data.discounts || []);

        // Check if coupon code was entered but no campaigns matched (only show on manual apply)
        if (isManualApply && couponCode.trim() && (!data.discounts || data.discounts.length === 0)) {
          toast.error('Invalid coupon code', {
            description: 'The coupon code you entered is not valid or has expired'
          });
        }

        // Auto-apply best discount if enabled and no manual discount
        if (data.discounts && data.discounts.length > 0 && discount === 0 && !selectedCampaign) {
          // Filter for auto-apply campaigns only
          const autoApplyDiscounts = data.discounts.filter((d: any) => d.autoApply);
          console.log('Auto-apply discounts:', autoApplyDiscounts);

          if (autoApplyDiscounts.length > 0) {
            const bestDiscount = autoApplyDiscounts.reduce((best: any, current: any) =>
              current.discountAmount > best.discountAmount ? current : best
            );
            console.log('Applying best discount:', bestDiscount);
            applyCampaignDiscount(bestDiscount);
          } else {
            console.log('No auto-apply discounts found');
          }
        } else {
          console.log('Not applying discount - conditions not met:', {
            hasDiscounts: data.discounts && data.discounts.length > 0,
            discountIsZero: discount === 0,
            noSelectedCampaign: !selectedCampaign
          });
        }
      } else {
        console.error('Campaign evaluation failed:', data.error);
        toast.error('Failed to evaluate campaigns');
      }
    } catch (error) {
      console.error('Error evaluating campaigns:', error);
      toast.error('Failed to evaluate discounts');
    } finally {
      setEvaluatingDiscounts(false);
    }
  };

  // Apply a campaign discount
  const applyCampaignDiscount = (campaign: any) => {
    setSelectedCampaign(campaign);
    setDiscount(campaign.discountAmount);

    // Update payment amounts
    const subtotal = getSubtotal();
    const newFinalTotal = subtotal - campaign.discountAmount;
    if (cashAmount > 0 && creditAmount === 0) {
      setCashAmount(newFinalTotal);
    } else if (creditAmount > 0 && cashAmount === 0) {
      setCreditAmount(newFinalTotal);
    } else if (cashAmount > 0 && creditAmount > 0) {
      const ratio = cashAmount / (cashAmount + creditAmount);
      setCashAmount(newFinalTotal * ratio);
      setCreditAmount(newFinalTotal * (1 - ratio));
    }

    toast.success(`Applied: ${campaign.campaignName}`, {
      description: `Discount: PKR ${campaign.discountAmount.toLocaleString()}`
    });
  };

  // Remove applied discount
  const removeCampaignDiscount = () => {
    setSelectedCampaign(null);
    setDiscount(0);

    // Update payment amounts
    const subtotal = getSubtotal();
    if (cashAmount > 0 && creditAmount === 0) {
      setCashAmount(subtotal);
    } else if (creditAmount > 0 && cashAmount === 0) {
      setCreditAmount(subtotal);
    } else if (cashAmount > 0 && creditAmount > 0) {
      const ratio = cashAmount / (cashAmount + creditAmount);
      setCashAmount(subtotal * ratio);
      setCreditAmount(subtotal * (1 - ratio));
    }

    toast.info('Discount removed');
  };

  // Evaluate campaigns when cart or coupon changes
  useEffect(() => {
    console.log('Campaign evaluation useEffect triggered:', { showCheckout, cartLength: cart.length, couponCode, customerPhone: customer.phone });
    if (showCheckout && cart.length > 0) {
      console.log('Calling evaluateCampaigns...');
      evaluateCampaigns();
    }
  }, [showCheckout, cart, couponCode, customer.phone]);

  const completeSale = async () => {
    if (!customer.name || !customer.phone) {
      toast.error('Please enter customer details');
      return;
    }

    const subtotal = getSubtotal();
    const finalTotal = getFinalTotal();
    
    // Validate payment amounts
    if (Math.abs((cashAmount + creditAmount) - finalTotal) > 0.01) {
      toast.error('Payment amounts must equal final total');
      return;
    }

    try {
      // Prepare sale data for the server
      const saleData = {
        customer: customer.name,
        phone: customer.phone,
        address: customer.village || '',
        commissionShop: customer.commissionShop || '',
        items: cart.map(item => ({
          productId: item.productId,
          variantId: item.variantId,
          productName: item.productName,
          variantName: `${item.productName} ${item.variantName}`, // Full display name: "AXIAL XL 050 EC 330 ML"
          batchId: item.batchId,
          quantity: item.quantity,
          price: item.price,
          unit: item.unit,
          expiry: item.expiry,
          image: item.image,
        })),
        subtotal: subtotal,
        discount: discount,
        total: finalTotal,
        cashAmount: cashAmount,
        creditAmount: creditAmount,
        payment: cashAmount === finalTotal ? 'Cash' : creditAmount === finalTotal ? 'Credit' : 'Split',
        status: 'Completed'
      };

      // Save to database
      const response = await fetch(`${API_URL}/sales`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify(saleData)
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to save sale');
      }

      // Show warning if there were inventory issues
      if (result.warning) {
        console.warn('Sale warning:', result.warning);
      }

      // Log discount usage if campaign was applied
      if (selectedCampaign && discount > 0) {
        try {
          await fetch(`${API_URL}/discount-logs`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${publicAnonKey}`
            },
            body: JSON.stringify({
              campaignId: selectedCampaign.campaignId,
              campaignName: selectedCampaign.campaignName,
              saleId: result.sale.id,
              customerId: customer.phone,
              customerName: customer.name,
              customerPhone: customer.phone,
              originalSubtotal: subtotal,
              discountAmount: discount,
              finalTotal: finalTotal,
              affectedProducts: selectedCampaign.affectedItems || [],
              cashier: 'POS System',
            })
          });
        } catch (error) {
          console.error('Error logging discount usage:', error);
        }
      }

      const sale = {
        id: result.sale.id,
        date: result.sale.date,
        customer,
        items: cart,
        subtotal: subtotal,
        discount: discount,
        total: finalTotal,
        cashAmount: cashAmount,
        creditAmount: creditAmount,
        paymentMethod: cashAmount === finalTotal ? 'cash' : creditAmount === finalTotal ? 'credit' : 'split',
      };

      setLastSale(sale);
      setCart([]);
      setShowCheckout(false);
      setShowReceipt(true);
      setCustomer({ name: '', phone: '03', village: '', commissionShop: '' });
      setCashAmount(0);
      setCreditAmount(0);
      setDiscount(0);
      setSelectedCampaign(null);
      setCouponCode('');
      setApplicableDiscounts([]);
      toast.success('Sale completed successfully!', {
        description: `Order ID: ${result.sale.id}`
      });

      // Refresh products and customers to get updated data
      fetchProducts();
      fetchCustomers();
    } catch (error) {
      console.error('Error completing sale:', error);
      toast.error('Failed to complete sale', {
        description: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  };

  // Handle voice detection of product names
  const handleVoiceProductDetected = (productName: string) => {
    console.log('Voice detected product:', productName);
    
    // Try to find product by name (case-insensitive, partial match)
    const foundProduct = products.find(p => 
      p.name.toLowerCase().includes(productName.toLowerCase()) ||
      productName.toLowerCase().includes(p.name.toLowerCase())
    );
    
    if (foundProduct) {
      addToCart(foundProduct, 1);
    } else {
      toast.error(`Product "${productName}" not found in inventory`);
    }
  };

  // If in checkout mode, show full-page checkout
  if (showCheckout) {
    return (
      <div className="fixed inset-0 bg-white z-50 flex flex-col">
        {/* Content - Responsive Layout */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 sm:py-3 pb-24 sm:pb-20">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            {/* Left Side - Cart Summary */}
            <div className="flex flex-col h-full">
              <Card className="flex-1 flex flex-col overflow-hidden border-2 border-purple-200 shadow-lg">
                <CardHeader className="pb-2 px-4 pt-4 flex-shrink-0 bg-[#C7359C]">
                  <CardTitle className="flex items-center gap-2 text-xl font-bold text-white">
                    <ShoppingCart className="size-5" />
                    Cart ({cart.length} items)
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col overflow-hidden pb-4 px-4 bg-white">
                  <div className="flex-1 overflow-y-auto space-y-1.5 mb-2 mt-2">
                    {cart.map((item) => (
                      <div key={`${item.productId}-${item.batchId}`} className="flex items-start gap-2 p-2.5 bg-gray-50 rounded-lg border border-gray-200">
                        {/* Product Image */}
                        <div className="flex-shrink-0 self-center">
                          <div className="w-[53px] h-[53px] rounded-md bg-gray-100 border overflow-hidden">
                            {item.image ? (
                              <img 
                                src={item.image} 
                                alt={item.productName}
                                className="w-full h-full object-contain"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-400">
                                <ShoppingCart className="size-6" />
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-sm truncate text-gray-900">{item.productName} {item.variantName}</h4>
                          <p className="text-sm mt-0.5 text-gray-600">
                            {item.quantity} × PKR {item.price.toLocaleString()} = <span className="font-bold text-[#C7359C]">PKR {(item.price * item.quantity).toLocaleString()}</span>
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <Separator className="my-3 flex-shrink-0" />
                  
                  <div className="space-y-2 flex-shrink-0 border-2 border-purple-200 rounded-lg p-3 bg-purple-50">
                    <div className="flex justify-between text-base">
                      <span className="text-gray-700">Subtotal:</span>
                      <span className="font-semibold text-gray-900">PKR {getSubtotal().toLocaleString()}</span>
                    </div>
                    {discount > 0 && (
                      <div className="flex justify-between text-base">
                        <span className="text-gray-700">Discount:</span>
                        <span className="font-semibold text-green-600">- PKR {discount.toLocaleString()}</span>
                      </div>
                    )}
                    <Separator className="my-2" />
                    <div className="flex justify-between text-2xl font-bold">
                      <span className="text-gray-800">Total:</span>
                      <span className="text-[#C7359C]">PKR {getFinalTotal().toLocaleString()}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Side - Unified Checkout Form */}
            <div className="flex flex-col h-full">
              <Card className="flex-1 flex flex-col overflow-hidden border-2 border-purple-200 shadow-lg">
                <CardHeader className="pb-3 px-4 pt-4 flex-shrink-0 bg-[#C7359C]">
                  <CardTitle className="text-xl font-bold text-white">Checkout</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col overflow-y-auto pb-4 px-4 space-y-4 bg-white">
                  
                  {/* Payment Section */}
                  <div className="space-y-2 mt-4">
                    <h3 className="text-sm font-bold text-[#C7359C] uppercase tracking-wide">Payment Method</h3>
                    
                    {/* Quick Payment Buttons */}
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant={cashAmount === getFinalTotal() && creditAmount === 0 ? 'default' : 'outline'}
                        className={`h-10 text-base font-semibold px-3 py-1.5 ${
                          cashAmount === getFinalTotal() && creditAmount === 0 
                            ? 'bg-[#C7359C] hover:bg-purple-700 text-white border-0' 
                            : 'border-2 border-purple-300 hover:bg-purple-50'
                        }`}
                        onClick={() => {
                          setPaymentMethod('cash');
                          const finalTotal = getFinalTotal();
                          setCashAmount(finalTotal);
                          setCreditAmount(0);
                        }}
                      >
                        Cash
                      </Button>
                      <Button
                        type="button"
                        variant={creditAmount === getFinalTotal() && cashAmount === 0 ? 'default' : 'outline'}
                        className={`h-10 text-base font-semibold px-3 py-1.5 ${
                          creditAmount === getFinalTotal() && cashAmount === 0 
                            ? 'bg-[#C7359C] hover:bg-purple-700 text-white border-0' 
                            : 'border-2 border-purple-300 hover:bg-purple-50'
                        }`}
                        onClick={() => {
                          setPaymentMethod('credit');
                          const finalTotal = getFinalTotal();
                          setCashAmount(0);
                          setCreditAmount(finalTotal);
                        }}
                      >
                        Credit
                      </Button>
                    </div>

                    {/* Payment Amounts in the same row */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label htmlFor="checkout-cash" className="text-sm leading-none mb-1 block font-semibold text-gray-700">Cash Amount</Label>
                        <Input
                          id="checkout-cash"
                          type="number"
                          step="0.01"
                          min="0"
                          max={getFinalTotal()}
                          value={cashAmount}
                          onChange={(e) => handleCashAmountChange(e.target.value)}
                          onFocus={(e) => e.target.select()}
                          className="font-semibold text-base h-9 px-2.5 border-purple-200 focus:border-[#C7359C] focus:ring-[#C7359C]"
                          placeholder="0.00"
                        />
                      </div>

                      <div>
                        <Label htmlFor="checkout-credit" className="text-sm leading-none mb-1 block font-semibold text-gray-700">Credit Amount</Label>
                        <Input
                          id="checkout-credit"
                          type="number"
                          step="0.01"
                          min="0"
                          max={getFinalTotal()}
                          value={creditAmount}
                          onChange={(e) => handleCreditAmountChange(e.target.value)}
                          onFocus={(e) => e.target.select()}
                          className="font-semibold text-base h-9 px-2.5 border-purple-200 focus:border-[#C7359C] focus:ring-[#C7359C]"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Customer Details Section */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-bold text-[#C7359C] uppercase tracking-wide">Customer Details</h3>
                    <div className="space-y-2">
                      {/* Commission Shop - Only show for credit sales, optional field, filters farmer suggestions */}
                      {creditAmount > 0 && (
                        <div className="relative" ref={commissionShopRef}>
                          <Label htmlFor="checkout-commission-shop" className="text-sm leading-none mb-1 block font-semibold text-gray-700">
                            Commission Shop
                          </Label>
                          <Input
                            id="checkout-commission-shop"
                            placeholder="Enter commission shop name (optional)"
                            autoComplete="off"
                            value={customer.commissionShop || ''}
                            onChange={(e) => {
                              setCustomer({ ...customer, commissionShop: e.target.value });
                              setShowCommissionShopSuggestions(true);
                            }}
                            onFocus={() => setShowCommissionShopSuggestions(true)}
                            className="h-9 text-base px-2.5 border-purple-200 focus:border-[#C7359C] focus:ring-[#C7359C]"
                          />
                          {/* Commission Shop Suggestions Dropdown */}
                          {showCommissionShopSuggestions && getCommissionShopSuggestions().length > 0 && (
                            <div className="absolute z-50 w-full mt-1 bg-white border-2 border-[#C7359C] rounded-lg shadow-lg max-h-48 overflow-y-auto">
                              {getCommissionShopSuggestions().map((shop, index) => (
                                <button
                                  key={index}
                                  type="button"
                                  onClick={() => selectCommissionShop(shop)}
                                  className="w-full text-left px-3 py-2 hover:bg-purple-50 border-b last:border-b-0 transition-colors"
                                >
                                  <p className="font-medium text-gray-900">{shop}</p>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Name and Phone in the same row */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="relative" ref={customerNameRef}>
                          <Label htmlFor="checkout-name" className="text-sm leading-none mb-1 block font-semibold text-gray-700">Name *</Label>
                          <Input
                            id="checkout-name"
                            placeholder="Enter customer name"
                            autoComplete="off"
                            value={customer.name}
                            onChange={(e) => {
                              setCustomer({ ...customer, name: e.target.value });
                              setShowCustomerSuggestions(true);
                            }}
                            onFocus={() => setShowCustomerSuggestions(true)}
                            className="h-9 text-base px-2.5 border-purple-200 focus:border-[#C7359C] focus:ring-[#C7359C]"
                          />
                          {/* Customer Suggestions Dropdown */}
                          {showCustomerSuggestions && getCustomerSuggestions().length > 0 && (
                            <div className="absolute z-50 w-full mt-1 bg-white border-2 border-[#C7359C] rounded-lg shadow-lg max-h-60 overflow-y-auto">
                              {getCustomerSuggestions().map((c, index) => (
                                <button
                                  key={index}
                                  type="button"
                                  onClick={() => selectCustomer(c)}
                                  className="w-full text-left px-3 py-2.5 hover:bg-purple-50 border-b last:border-b-0 transition-colors"
                                >
                                  <p className="font-semibold text-gray-900">{c.name}</p>
                                  <p className="text-sm text-gray-600">{c.phone}</p>
                                  {c.village && <p className="text-xs text-gray-500">{c.village}</p>}
                                  {c.commissionShop && (
                                    <p className="text-xs text-[#C7359C] font-medium mt-0.5">
                                      Shop: {c.commissionShop}
                                    </p>
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        <div>
                          <Label htmlFor="checkout-phone" className="text-sm leading-none mb-1 block font-semibold text-gray-700">Phone *</Label>
                          <div className="relative">
                            <Input
                              id="checkout-phone"
                              placeholder="03XX-XXXXXXX"
                              autoComplete="off"
                              value={customer.phone.startsWith('03') ? customer.phone : '03' + customer.phone.replace(/^03/, '')}
                              onChange={(e) => {
                                const input = e.target.value;
                                // Always keep "03" prefix
                                if (!input.startsWith('03')) {
                                  setCustomer({ ...customer, phone: '03' });
                                  return;
                                }
                                // Only allow digits and limit to 11 characters
                                const digitsOnly = input.replace(/\D/g, '');
                                if (digitsOnly.length <= 11) {
                                  setCustomer({ ...customer, phone: digitsOnly });
                                  setShowCustomerSuggestions(true);
                                }
                              }}
                              onFocus={(e) => {
                                // Set cursor after "03" if field is just "03"
                                if (e.target.value === '03') {
                                  setTimeout(() => e.target.setSelectionRange(2, 2), 0);
                                }
                                setShowCustomerSuggestions(true);
                              }}
                              className={`h-9 text-base px-2.5 pr-8 transition-colors ${
                                customer.phone.length === 11 
                                  ? 'border-green-500 focus:border-green-500 focus:ring-green-500' 
                                  : customer.phone.length > 2
                                  ? 'border-orange-400 focus:border-orange-400 focus:ring-orange-400'
                                  : 'border-purple-200 focus:border-[#C7359C] focus:ring-[#C7359C]'
                              }`}
                            />
                            {customer.phone.length === 11 ? (
                              <div className="absolute right-2 top-1/2 -translate-y-1/2 text-green-600">
                                ✓
                              </div>
                            ) : customer.phone.length > 2 ? (
                              <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium text-orange-600">
                                {11 - customer.phone.length}
                              </div>
                            ) : null}
                          </div>
                          {customer.phone.length > 2 && customer.phone.length < 11 && (
                            <p className="text-xs text-orange-600 mt-1">
                              {11 - customer.phone.length} digit{11 - customer.phone.length !== 1 ? 's' : ''} remaining
                            </p>
                          )}
                          {customer.phone.length === 11 && (
                            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                              <span>✓</span> Number complete
                            </p>
                          )}
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="checkout-village" className="text-sm leading-none mb-1 block font-semibold text-gray-700">Village</Label>
                        <Input
                          id="checkout-village"
                          placeholder="Enter village name"
                          autoComplete="off"
                          value={customer.village}
                          onChange={(e) => setCustomer({ ...customer, village: e.target.value })}
                          className="h-9 text-base px-2.5 border-purple-200 focus:border-[#C7359C] focus:ring-[#C7359C]"
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Discount Section */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-bold text-[#C7359C] uppercase tracking-wide">Discount & Promotions</h3>

                    {/* Coupon Code Input */}
                    <div>
                      <Label htmlFor="coupon-code" className="text-sm leading-none mb-1 block font-semibold text-gray-700">
                        Coupon Code
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          id="coupon-code"
                          type="text"
                          value={couponCode}
                          onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              evaluateCampaigns(true);
                            }
                          }}
                          className="font-semibold text-base h-9 px-2.5 border-purple-200 focus:border-[#C7359C] focus:ring-[#C7359C]"
                          placeholder="Enter code"
                        />
                        <Button
                          type="button"
                          onClick={() => evaluateCampaigns(true)}
                          disabled={evaluatingDiscounts}
                          className="bg-[#C7359C] hover:bg-purple-700 text-white px-4"
                        >
                          {evaluatingDiscounts ? '...' : 'Apply'}
                        </Button>
                      </div>
                    </div>

                    {/* Available Discounts */}
                    {applicableDiscounts.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold text-gray-700">Available Discounts</Label>
                        <div className="space-y-1.5 max-h-32 overflow-y-auto">
                          {applicableDiscounts.map((disc, index) => (
                            <div
                              key={index}
                              className={`p-2 rounded-lg border-2 transition-colors cursor-pointer ${
                                selectedCampaign?.campaignId === disc.campaignId
                                  ? 'border-[#C7359C] bg-purple-50'
                                  : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50'
                              }`}
                              onClick={() => applyCampaignDiscount(disc)}
                            >
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <p className="font-semibold text-sm text-gray-900">{disc.campaignName}</p>
                                  
                                </div>
                                <div className="text-right">
                                  <p className="font-bold text-sm text-green-600">
                                    -PKR {disc.discountAmount.toLocaleString()}
                                  </p>
                                </div>
                              </div>
                              {selectedCampaign?.campaignId === disc.campaignId && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeCampaignDiscount();
                                  }}
                                  className="mt-2 w-full text-xs"
                                >
                                  Remove Discount
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Manual Discount */}
                    <div>
                      <Label htmlFor="checkout-discount" className="text-sm leading-none mb-1 block font-semibold text-gray-700">
                        Manual Discount Amount
                      </Label>
                      <Input
                        id="checkout-discount"
                        type="number"
                        step="0.01"
                        min="0"
                        max={getSubtotal()}
                        value={discount}
                        onChange={(e) => handleDiscountChange(e.target.value)}
                        onFocus={(e) => e.target.select()}
                        className="font-semibold text-base h-9 px-2.5 border-purple-200 focus:border-[#C7359C] focus:ring-[#C7359C]"
                        placeholder="0.00"
                        disabled={selectedCampaign !== null}
                      />
                      {selectedCampaign && (
                        <p className="text-sm text-[#C7359C] mt-1 font-medium">
                          Campaign discount applied: {selectedCampaign.campaignName}
                        </p>
                      )}
                      {discount > 0 && !selectedCampaign && (
                        <p className="text-sm text-green-600 mt-1">
                          Manual discount: PKR {discount.toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>

                  <Separator />

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="lg"
                      className="flex-1 h-11 text-base font-semibold border-2 border-gray-300 hover:bg-gray-100 hover:border-gray-400"
                      onClick={() => {
                        setShowCheckout(false);
                        setCustomer({ name: '', phone: '03', village: '', commissionShop: '' });
                        setCashAmount(0);
                        setCreditAmount(0);
                        setDiscount(0);
                        setSelectedCampaign(null);
                        setCouponCode('');
                        setApplicableDiscounts([]);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="lg"
                      className="flex-1 h-11 text-base font-semibold bg-[#C7359C] hover:bg-purple-700 shadow-lg"
                      onClick={completeSale}
                    >
                      Complete Sale →
                    </Button>
                  </div>

                </CardContent>
              </Card>
            </div>
          </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="flex gap-3 h-full overflow-hidden">
      {/* Product Selection - Full Width on Mobile, Left Side on Desktop */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
          <div>
            <h2 className="text-xl lg:text-2xl font-bold text-gray-900 pl-2">Point of Sale</h2>
          </div>
        </div>

        <Card className="h-full flex flex-col">
          <CardContent className="px-[16px] pt-4 pb-[24px] flex-1 flex flex-col overflow-hidden gap-2">
            {/* Search Bar with Actions */}
            <div className="flex gap-2 flex-shrink-0">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                <Input
                  placeholder="Search by name, AGI code..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-9 sm:h-10"
                />
              </div>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[140px] sm:w-[150px] h-9 sm:h-10 border-gray-300 hover:border-gray-400 focus:border-[#C7359C] focus:ring-[#C7359C]">
                  <SelectValue placeholder="Sort By" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name (A-Z)</SelectItem>
                  <SelectItem value="price-asc">Price (Low-High)</SelectItem>
                  <SelectItem value="price-desc">Price (High-Low)</SelectItem>
                  <SelectItem value="stock-desc">Stock (High-Low)</SelectItem>
                  <SelectItem value="stock-asc">Stock (Low-High)</SelectItem>
                  <SelectItem value="date-new">Newest First</SelectItem>
                  <SelectItem value="date-old">Oldest First</SelectItem>
                </SelectContent>
              </Select>
              <Button 
                onClick={() => setIsCompactView(!isCompactView)}
                size="icon"
                variant="outline"
                className="size-9 sm:size-10 hover:bg-purple-50 hover:border-[#C7359C]"
                title={isCompactView ? "Switch to Normal View" : "Switch to Compact View"}
              >
                {isCompactView ? <Maximize2 className="size-4" /> : <Minimize2 className="size-4" />}
              </Button>
              <Button 
                onClick={() => setShowVoiceRecognition(true)}
                size="icon"
                className="hidden sm:flex size-9 sm:size-10 bg-gradient-to-r from-[#C7359C] to-purple-600 hover:from-purple-700 hover:to-[#C7359C] text-white shadow-md hover:shadow-lg transition-all"
                title="Voice to Cart"
              >
                <Mic className="size-4" />
              </Button>
              <Button 
                onClick={() => setShowAICamera(true)}
                size="icon"
                className="size-9 sm:size-10 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-blue-700 hover:to-purple-600 text-white shadow-md hover:shadow-lg transition-all"
                title="AI Product Scanner"
              >
                <Camera className="size-4" />
              </Button>
              <Button 
                variant="outline" 
                size="icon" 
                title="Scan Barcode/QR"
                onClick={() => setShowQRScanner(true)}
                className="size-9 sm:size-10 hover:bg-purple-50 hover:border-[#C7359C] hidden"
              >
                <Scan className="size-4" />
              </Button>
            </div>

            {/* Category Filters */}
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 flex-shrink-0">
              {categories.map((category) => (
                <Button
                  key={category}
                  variant={selectedCategory === category ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(category)}
                  className={`whitespace-nowrap text-xs h-8 ${
                    category === 'Favorites' && selectedCategory === 'Favorites' 
                      ? 'bg-gradient-to-r from-[#C7359C] to-purple-600' 
                      : ''
                  }`}
                >
                  {category === 'Favorites' ? (
                    <span className="flex items-center gap-1.5">
                      <Heart className={`size-3.5 ${selectedCategory === 'Favorites' ? 'fill-white' : 'fill-[#C7359C]'}`} />
                      {category}
                      {visibleFavoritesCount > 0 && (
                        <Badge
                          variant="secondary"
                          className={`ml-1 text-[10px] px-1.5 py-0 ${
                            selectedCategory === 'Favorites'
                              ? 'bg-white text-[#C7359C]'
                              : 'bg-[#C7359C] text-white'
                          }`}
                        >
                          {visibleFavoritesCount}
                        </Badge>
                      )}
                    </span>
                  ) : (
                    category
                  )}
                </Button>
              ))}
            </div>

            {/* Product Grid - Responsive - Scrollable */}
            <div className="flex-1 overflow-y-auto -mr-2 pr-2">
              <div className={`grid pb-2 ${
                isCompactView 
                  ? 'grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 2xl:grid-cols-8 gap-2 sm:gap-2.5'
                  : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 sm:gap-4'
              }`}>
                {sortedProducts.map((variant) => {
                  // Get earliest batch or use variant price
                  const hasBatches = variant.batches && variant.batches.length > 0;
                  const earliestBatch = hasBatches 
                    ? [...variant.batches].sort((a, b) =>
                        new Date(a.expiry).getTime() - new Date(b.expiry).getTime()
                      )[0]
                    : null;
                  
                  const displayPrice = earliestBatch ? earliestBatch.price : (variant.price || 0);
                  const totalStock = (variant.batches || []).reduce((sum: number, batch: any) => sum + batch.quantity, 0);
                  const displayStock = hasBatches ? totalStock : '∞';
                  const isOutOfStock = totalStock === 0;
                  const displayImage = variant.image || productImages[Math.floor(Math.random() * productImages.length)];

                  // Render compact view
                  if (isCompactView) {
                    return (
                      <div
                        key={variant.variantId}
                        className={`bg-white rounded-md border hover:shadow-lg transition-all duration-200 cursor-pointer p-1.5 relative group flex flex-col ${
                          isOutOfStock 
                            ? 'border-gray-300 opacity-70' 
                            : 'border-gray-200 hover:border-[#C7359C] active:border-[#C7359C]'
                        }`}
                        onClick={() => !isOutOfStock && addToCart(variant)}
                      >
                        {/* Out of Stock Badge - Compact */}
                        {isOutOfStock && posDisplaySettings.showOutOfStock && (
                          <div className="absolute top-1 left-1 z-10">
                            <Badge variant="destructive" className="text-[8px] px-1 py-0 bg-red-500">
                              Out
                            </Badge>
                          </div>
                        )}

                        {/* Favorite Icon - Compact */}
                        <button 
                          className={`absolute top-1 right-1 z-10 transition-opacity bg-white rounded-full p-0.5 shadow-sm hidden sm:block ${
                            favorites.has(variant.variantId) || favorites.has(variant.productId) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(variant.variantId);
                          }}
                        >
                          <Heart className={`size-3 transition-colors ${
                            favorites.has(variant.variantId) || favorites.has(variant.productId)
                              ? 'text-[#C7359C] fill-[#C7359C]' 
                              : 'text-gray-400 hover:text-[#C7359C] hover:fill-[#C7359C]'
                          }`} />
                        </button>

                        {/* Product Image - Compact */}
                        <div className="h-16 w-full flex items-center justify-center mb-1 bg-white rounded overflow-hidden flex-shrink-0">
                          <img
                            src={displayImage}
                            alt={variant.productName}
                            className="w-full h-full object-contain p-0.5"
                          />
                        </div>

                        {/* Product Name - 3 Lines Fixed */}
                        <div className="mb-0.5 flex items-start justify-center flex-shrink-0">
                          <h3 className="text-[9px] font-semibold text-gray-900 line-clamp-3 leading-[1.2] text-center px-0.5">
                            {variant.displayName}
                          </h3>
                        </div>

                        {/* Unit - 1 Line Fixed with distinct styling */}
                        <div className="mt-auto flex items-center justify-center flex-shrink-0 pt-1 border-t border-gray-200">
                          <span className="text-[9px] font-bold text-[#C7359C] uppercase tracking-wider truncate max-w-full">
                            {variant.unit}
                          </span>
                        </div>
                      </div>
                    );
                  }

                  // Render normal view
                  return (
                    <div
                      key={variant.variantId}
                      className={`bg-white rounded-lg sm:rounded-xl border-2 hover:shadow-xl transition-all duration-200 cursor-pointer p-1 sm:p-2 relative group flex flex-col ${
                        isOutOfStock 
                          ? 'border-gray-300 opacity-70' 
                          : 'border-gray-200 hover:border-[#C7359C] active:border-[#C7359C]'
                      }`}
                      onClick={() => !isOutOfStock && addToCart(variant)}
                    >
                      {/* Out of Stock Badge */}
                      {isOutOfStock && posDisplaySettings.showOutOfStock && (
                        <div className="absolute top-2 left-2 z-10">
                          <Badge variant="destructive" className="text-[9px] sm:text-[10px] px-1.5 py-0.5 bg-red-500">
                            Out of Stock
                          </Badge>
                        </div>
                      )}

                      {/* Favorite Icon - Hidden on mobile */}
                      <button 
                        className={`absolute top-2 right-2 z-10 transition-opacity bg-white rounded-full p-1 shadow-sm hidden sm:block ${
                          favorites.has(variant.variantId) || favorites.has(variant.productId) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(variant.variantId);
                        }}
                      >
                        <Heart className={`size-4 transition-colors ${
                          favorites.has(variant.variantId) || favorites.has(variant.productId)
                            ? 'text-[#C7359C] fill-[#C7359C]' 
                            : 'text-gray-400 hover:text-[#C7359C] hover:fill-[#C7359C]'
                        }`} />
                      </button>

                      {/* Product Image - Fixed Height */}
                      <div className="h-20 sm:h-28 w-full flex items-center justify-center mb-1 bg-white rounded-lg overflow-hidden flex-shrink-0">
                        <img
                          src={displayImage}
                          alt={variant.productName}
                          className="w-full h-full object-contain p-1 sm:p-1.5"
                        />
                      </div>

                      {/* Product Name - Fixed Height */}
                      <div className="h-9 sm:h-10 mb-1 flex items-start justify-center flex-shrink-0">
                        <h3 className="text-[11px] sm:text-xs font-semibold text-gray-800 line-clamp-2 leading-tight text-center px-1">
                          {variant.displayName}
                        </h3>
                      </div>

                      {/* Price - Fixed Height */}
                      <div className="h-3.5 sm:h-4.5 flex items-center justify-center mb-0.5 flex-shrink-0">
                        <p className="text-xs sm:text-sm font-bold text-[#C7359C]">
                          Rs {displayPrice.toLocaleString()}
                        </p>
                      </div>

                      {/* Stock - Fixed Height */}
                      <div className="h-3 sm:h-3.5 flex items-center justify-center mb-0.5 flex-shrink-0">
                        <p className="text-[10px] sm:text-xs text-gray-600">
                          Stock: <span className={displayStock === '∞' ? 'text-green-600' : displayStock > 0 ? 'text-green-600' : 'text-red-500'}>
                            {displayStock}
                          </span>
                        </p>
                      </div>

                      {/* Unit - Fixed Height */}
                      <div className="h-3 sm:h-3.5 flex items-center justify-center flex-shrink-0">
                        <p className="text-[10px] sm:text-xs text-gray-500">
                          Unit: <span className="font-semibold text-gray-900">{variant.unit}</span>
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cart - Desktop Only (Right Side) */}
      <div className="hidden md:flex w-80 lg:w-96 flex-shrink-0 flex-col h-full overflow-hidden">
        <Card className="flex-1 flex flex-col overflow-hidden h-full">
          <CardHeader className="flex-shrink-0 pb-2 p-4">
            <CardTitle className="flex items-center justify-between">
              Cart
              {cart.length > 0 && (
                <Badge variant="default">{cart.length} items</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col overflow-hidden p-0">
            {cart.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center text-gray-400">
                  <ShoppingCart className="size-12 mx-auto mb-2 opacity-50" />
                  <p>Cart is empty</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col h-full">
                {/* Scrollable Cart Items - Fixed Max Height */}
                <div className="overflow-y-auto px-3 py-2" style={{ maxHeight: 'calc(100vh - 300px)' }}>
                  <div className="space-y-2">
                    {cart.map((item) => (
                      <Card key={`${item.productId}-${item.batchId}`} className="p-2">
                        <div className="flex gap-2">
                          {/* Product Image */}
                          <div className="flex-shrink-0 self-center">
                            <div className="w-[53px] h-[53px] rounded-md bg-gray-100 border overflow-hidden">
                              {item.image ? (
                                <img 
                                  src={item.image} 
                                  alt={item.productName}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <ShoppingCart className="size-5 text-gray-400" />
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* Product Details */}
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex justify-between items-start gap-2">
                              <h4 className="font-medium text-sm truncate flex-1">{item.productName} {item.variantName}</h4>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-6 flex-shrink-0"
                                onClick={() => removeItem(item.variantId, item.batchId)}
                              >
                                <Trash2 className="size-3 text-red-500" />
                              </Button>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="size-7"
                                  onClick={() => updateQuantity(item.variantId, item.batchId, -1)}
                                >
                                  <Minus className="size-3" />
                                </Button>
                                <Input
                                  type="text"
                                  value={item.quantity}
                                  onChange={(e) => setQuantityDirectly(item.variantId, item.batchId, e.target.value)}
                                  className="font-medium w-12 text-center p-1 h-7 text-xs"
                                  onFocus={(e) => e.target.select()}
                                />
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="size-7"
                                  onClick={() => updateQuantity(item.variantId, item.batchId, 1)}
                                >
                                  <Plus className="size-3" />
                                </Button>
                              </div>
                              <p className="font-semibold text-sm whitespace-nowrap">
                                PKR {(item.price * item.quantity).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>

                {/* Fixed Checkout Section - Always at Bottom */}
                <div className="bg-white border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] px-3 py-3 space-y-2 flex-shrink-0 mt-auto">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total:</span>
                    <span className="text-green-600">
                      PKR {getTotal().toLocaleString()}
                    </span>
                  </div>
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={handleCheckout}
                  >
                    Checkout
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Mobile Cart Modal */}
      <Dialog open={showMobileCart} onOpenChange={setShowMobileCart}>
        <DialogContent className="max-w-full w-full h-[90vh] m-0 p-0 flex flex-col">
          <DialogHeader className="px-4 py-3 border-b bg-gradient-to-r from-[#C7359C] to-[#9b2b7a] text-white">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <DialogTitle className="text-white flex items-center gap-2">
                  <span>Cart ({cart.length} items)</span>
                </DialogTitle>
              </div>
            </div>
            <DialogDescription className="sr-only">
              Review and edit items in your cart before checkout
            </DialogDescription>
          </DialogHeader>

          {/* Cart Items - Scrollable */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {cart.map((item) => (
              <Card key={`${item.productId}-${item.batchId}`} className="p-3">
                <div className="flex gap-2">
                  {/* Product Image */}
                  <div className="flex-shrink-0 self-center">
                    <div className="w-[53px] h-[53px] rounded-md bg-gray-100 border overflow-hidden">
                      {item.image ? (
                        <img 
                          src={item.image} 
                          alt={item.productName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ShoppingCart className="size-5 text-gray-400" />
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Product Details */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex justify-between items-start gap-2">
                      <h4 className="font-semibold text-sm truncate flex-1">{item.productName} {item.variantName}</h4>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 flex-shrink-0 -mt-1"
                        onClick={() => removeItem(item.variantId, item.batchId)}
                      >
                        <Trash2 className="size-4 text-red-500" />
                      </Button>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="size-9"
                          onClick={() => updateQuantity(item.variantId, item.batchId, -1)}
                        >
                          <Minus className="size-4" />
                        </Button>
                        <Input
                          type="text"
                          value={item.quantity}
                          onChange={(e) => setQuantityDirectly(item.variantId, item.batchId, e.target.value)}
                          className="font-semibold w-16 text-center h-9"
                          onFocus={(e) => e.target.select()}
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          className="size-9"
                          onClick={() => updateQuantity(item.variantId, item.batchId, 1)}
                        >
                          <Plus className="size-4" />
                        </Button>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">PKR {item.price.toLocaleString()} each</p>
                        <p className="font-bold text-[#C7359C] whitespace-nowrap">
                          PKR {(item.price * item.quantity).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Cart Footer - Total and Checkout */}
          <div className="border-t bg-white p-4 space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-600">Total Amount</p>
                <p className="text-2xl font-bold text-[#C7359C]">
                  PKR {getTotal().toLocaleString()}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">{cart.length} items</p>
                <p className="text-xs text-gray-500">
                  {cart.reduce((sum, item) => sum + item.quantity, 0)} units
                </p>
              </div>
            </div>
            <Button
              className="w-full h-12 text-base font-semibold"
              size="lg"
              onClick={() => {
                setShowMobileCart(false);
                handleCheckout();
              }}
            >
              Proceed to Checkout →
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Floating Cart Button - Mobile Only */}
      {cart.length > 0 && (
        <div className="md:hidden fixed bottom-20 right-4 z-40">
          <Button
            size="lg"
            className="rounded-full shadow-2xl h-16 w-16 relative bg-gradient-to-r from-[#C7359C] to-[#9b2b7a] hover:from-[#9b2b7a] hover:to-[#C7359C]"
            onClick={() => setShowMobileCart(true)}
          >
            <div className="flex flex-col items-center">
              <ShoppingCart className="size-6" />
              <Badge className="absolute -top-2 -right-2 bg-[#FFD700] text-black font-bold px-2">
                {cart.length}
              </Badge>
            </div>
          </Button>
        </div>
      )}
    </div>

    {/* Receipt Dialog */}
    <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Receipt</DialogTitle>
          <DialogDescription className="sr-only">
            Sale receipt and invoice details
          </DialogDescription>
        </DialogHeader>
        {lastSale && (
          <div className="space-y-4 font-mono text-sm">
            <div className="text-center border-b pb-2">
              <h2 className="font-bold text-lg">NAYA SAVERA</h2>
              <p className="text-xs">Agricultural Solutions</p>
              <p className="text-xs">Invoice #{lastSale.id}</p>
              <p className="text-xs">{new Date(lastSale.date).toLocaleString()}</p>
            </div>

            <div className="space-y-1 border-b pb-2">
              <p><strong>Customer:</strong> {lastSale.customer.name}</p>
              <p><strong>Phone:</strong> {lastSale.customer.phone}</p>
              {lastSale.customer.village && <p><strong>Village:</strong> {lastSale.customer.village}</p>}
              {lastSale.customer.commissionShop && <p><strong>Commission Shop:</strong> {lastSale.customer.commissionShop}</p>}
            </div>

            <div className="space-y-2">
              {lastSale.items.map((item: CartItem, index: number) => (
                <div key={index} className="flex justify-between text-xs">
                  <div className="flex-1">
                    <p className="font-semibold">{item.productName} {item.variantName}</p>
                    <p className="text-gray-600">Batch: {item.batchId} | {item.quantity} × PKR {item.price}</p>
                  </div>
                  <p className="font-semibold">PKR {(item.price * item.quantity).toLocaleString()}</p>
                </div>
              ))}
            </div>

            <div className="border-t pt-2 space-y-1">
              {lastSale.subtotal && lastSale.discount > 0 && (
                <>
                  <div className="flex justify-between text-sm">
                    <span>Subtotal:</span>
                    <span>PKR {lastSale.subtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Discount:</span>
                    <span>- PKR {lastSale.discount.toLocaleString()}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between font-bold">
                <span>TOTAL:</span>
                <span>PKR {lastSale.total.toLocaleString()}</span>
              </div>
              <div className="border-t pt-2 mt-2">
                <p className="text-xs font-semibold mb-1">Payment Breakdown:</p>
                {lastSale.cashAmount > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-green-600">Cash Paid:</span>
                    <span className="font-semibold">PKR {lastSale.cashAmount.toLocaleString()}</span>
                  </div>
                )}
                {lastSale.creditAmount > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-orange-600">Credit (Khaata):</span>
                    <span className="font-semibold">PKR {lastSale.creditAmount.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs mt-1 pt-1 border-t">
                  <span>Method:</span>
                  <span className="uppercase font-semibold">{lastSale.paymentMethod}</span>
                </div>
              </div>
            </div>

            <div className="text-center text-xs text-gray-500 border-t pt-2">
              <p>Thank you for your business!</p>
              <p>For support: contact@nayasavera.online</p>
            </div>

            <div className="space-y-2">
              <Button className="w-full" onClick={() => window.print()}>
                Print Receipt
              </Button>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  className="w-full bg-white hover:bg-gray-50 border-2 border-[#25D366] flex items-center justify-center gap-2"
                  onClick={() => {
                    const message = `*NAYA SAVERA - Invoice #${lastSale.id}*\n\n` +
                      `Date: ${new Date(lastSale.date).toLocaleString()}\n` +
                      `Customer: ${lastSale.customer.name}\n` +
                      `Phone: ${lastSale.customer.phone}\n\n` +
                      `*Items:*\n` +
                      lastSale.items.map((item: CartItem) =>
                        `${item.productName} ${item.variantName}\n` +
                        `  ${item.quantity} × PKR ${item.price} = PKR ${(item.price * item.quantity).toLocaleString()}`
                      ).join('\n') + '\n\n' +
                      (lastSale.subtotal && lastSale.discount > 0 ?
                        `Subtotal: PKR ${lastSale.subtotal.toLocaleString()}\n` +
                        `Discount: -PKR ${lastSale.discount.toLocaleString()}\n` : '') +
                      `*TOTAL: PKR ${lastSale.total.toLocaleString()}*\n\n` +
                      `Payment:\n` +
                      (lastSale.cashAmount > 0 ? `Cash: PKR ${lastSale.cashAmount.toLocaleString()}\n` : '') +
                      (lastSale.creditAmount > 0 ? `Credit: PKR ${lastSale.creditAmount.toLocaleString()}\n` : '') +
                      `Method: ${lastSale.paymentMethod}\n\n` +
                      `Thank you for your business!\n` +
                      `For support: contact@nayasavera.online`;

                    // Format phone number for WhatsApp (international format without +)
                    let phoneNumber = lastSale.customer.phone.replace(/\D/g, '');

                    // If number starts with 0, replace with country code (92 for Pakistan)
                    if (phoneNumber.startsWith('0')) {
                      phoneNumber = '92' + phoneNumber.substring(1);
                    }
                    // If number doesn't start with country code, add it
                    else if (!phoneNumber.startsWith('92')) {
                      phoneNumber = '92' + phoneNumber;
                    }

                    console.log('WhatsApp phone number:', phoneNumber);
                    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
                    console.log('WhatsApp URL:', whatsappUrl);
                    window.open(whatsappUrl, '_blank');
                  }}
                >
                  <img src={whatsappLogo} alt="WhatsApp" className="h-6 w-6" />
                  <span className="text-[#25D366] font-semibold">WhatsApp</span>
                </Button>

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    const message = `NAYA SAVERA - Invoice #${lastSale.id}\n` +
                      `Date: ${new Date(lastSale.date).toLocaleString()}\n` +
                      `Customer: ${lastSale.customer.name}\n\n` +
                      lastSale.items.map((item: CartItem) =>
                        `${item.productName} ${item.variantName}\n` +
                        `${item.quantity} × PKR ${item.price} = PKR ${(item.price * item.quantity).toLocaleString()}`
                      ).join('\n') + '\n\n' +
                      `TOTAL: PKR ${lastSale.total.toLocaleString()}\n` +
                      `Payment: ${lastSale.paymentMethod}\n\n` +
                      `Thank you for your business!`;

                    const phoneNumber = lastSale.customer.phone.replace(/\D/g, '');
                    const smsUrl = `sms:${phoneNumber}?body=${encodeURIComponent(message)}`;
                    window.location.href = smsUrl;
                  }}
                >
                  💬 SMS
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>

    {/* QR/Barcode Scanner Dialog */}
    <QRScanner
      open={showQRScanner}
      onClose={() => setShowQRScanner(false)}
      products={products.map(p => ({
        id: parseInt(p.id),
        name: p.name,
        price: p.batches?.[0]?.price || p.defaultPrice || 0,
        category: p.category,
        unit: p.unit,
        image: p.image,
        qrCode: p.qrCode,
        barcode: p.barcode,
        batches: (p.batches || []).map(b => ({
          batchNumber: b.id,
          expiry: b.expiry,
          quantity: b.quantity
        }))
      }))}
      onAddToCart={(product, quantity = 1) => {
        const originalProduct = products.find(p => p.id === product.id.toString());
        if (originalProduct) {
          addToCart(originalProduct, quantity);
        }
      }}
      currentCart={cart.map((item, index) => {
        const product = products.find(p => p.id === item.productId);
        return {
          product: {
            id: parseInt(item.productId),
            name: item.productName,
            price: item.price,
            category: product?.category || '',
            unit: item.unit,
            image: product?.image || productImages[0],
            qrCode: product?.qrCode,
            barcode: product?.barcode,
            batches: [{
              batchNumber: item.batchId,
              expiry: item.expiry,
              quantity: item.quantity
            }]
          },
          quantity: item.quantity,
          batchNumber: item.batchId,
          tempId: `${item.productId}-${item.batchId}`,
          justAdded: false
        };
      })}
      onRemoveFromCart={(tempId) => {
        // tempId format: variantId-batchId-timestamp
        const parts = tempId.split('-');
        // Reconstruct variantId (may contain dashes) and batchId
        const timestampIndex = parts.length - 1;
        const batchId = parts[timestampIndex - 1];
        const variantId = parts.slice(0, timestampIndex - 1).join('-');
        removeItem(variantId, batchId);
      }}
    />

    {/* AI Camera Scanner Dialog */}
    <AICamera
      open={showAICamera}
      onClose={() => setShowAICamera(false)}
      products={flattenedVariants}
      onAddToCart={(variant, quantity = 1) => {
        addToCart(variant, quantity);
      }}
      currentCart={cart.map((item, index) => {
        const variant = flattenedVariants.find(v => v.variantId === item.variantId);
        return {
          product: {
            id: parseInt(item.variantId),
            name: `${item.productName} ${item.variantName}`,
            price: item.price,
            category: variant?.category || '',
            unit: item.unit,
            image: variant?.image || productImages[0],
          },
          quantity: item.quantity,
          tempId: item.tempId,
        };
      })}
      onRemoveFromCart={(tempId) => removeFromCart(tempId)}
      onUpdateQuantity={(tempId, newQuantity) => {
        setCart(prevCart => prevCart.map(item =>
          item.tempId === tempId
            ? { ...item, quantity: Math.max(1, newQuantity) }
            : item
        ).filter(item => item.quantity > 0));
      }}
      onCheckout={handleCheckout}
    />

    {/* Voice Recognition Dialog */}
    <VoiceToCartLazy
      open={showVoiceRecognition}
      onClose={() => setShowVoiceRecognition(false)}
      products={flattenedVariants}
      onAddToCart={(variant) => {
        addToCart(variant, 1);
      }}
      cart={cart}
      onRemoveFromCart={(tempId) => {
        removeFromCart(tempId);
      }}
      onUpdateQuantity={(tempId, newQuantity) => {
        setCart(prevCart => prevCart.map(item =>
          item.tempId === tempId
            ? { ...item, quantity: Math.max(1, newQuantity) }
            : item
        ).filter(item => item.quantity > 0));
      }}
      onCheckout={handleCheckout}
    />
    </>
  );
}