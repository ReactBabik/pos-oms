import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent } from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { X, Camera, Trash2, Check, ShoppingCart, Scan, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import jsQR from 'jsqr';

const API_URL = `https://${projectId}.supabase.co/functions/v1/make-server-77be783d`;

interface Product {
  id: number;
  name: string;
  price: number;
  category: string;
  unit: string;
  image: string;
  qrCode?: string;
  barcode?: string;
  batches: Array<{ batchNumber: string; expiry: string; quantity: number }>;
}

interface CartItem {
  product: Product;
  quantity: number;
  batchNumber: string;
  tempId?: string;
  justAdded?: boolean;
}

interface QRScannerProps {
  open: boolean;
  onClose: () => void;
  products: Product[];
  onAddToCart: (product: Product, quantity?: number) => void;
  currentCart: CartItem[];
  onRemoveFromCart: (tempId: string) => void;
}

interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning';
  message: string;
}

export function QRScanner({ open, onClose, products, onAddToCart, currentCart, onRemoveFromCart }: QRScannerProps) {
  const [scanning, setScanning] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [justAddedIds, setJustAddedIds] = useState<Set<string>>(new Set());
  const [lastScannedCode, setLastScannedCode] = useState<string>('');
  const [scanHistory, setScanHistory] = useState<string[]>([]);
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState<number>(0);
  const [cameraLabel, setCameraLabel] = useState<string>('');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<number | null>(null);

  // Track newly added items for animation
  useEffect(() => {
    const previousIds = new Set(justAddedIds);
    const currentIds = new Set(currentCart.map(item => item.tempId).filter(Boolean));
    
    // Find new items
    const newIds = new Set([...currentIds].filter(id => !previousIds.has(id)));
    
    if (newIds.size > 0) {
      setJustAddedIds(currentIds);
      
      // Remove "just added" flag after 2 seconds
      setTimeout(() => {
        setJustAddedIds(new Set());
      }, 2000);
    }
  }, [currentCart]);

  // Start camera when dialog opens
  useEffect(() => {
    if (open) {
      console.log('📱 QR Scanner opened');
      console.log('📦 Total products available:', products.length);
      console.log('🔍 Sample product:', products[0]);
      console.log('🎯 Products with QR codes:', products.filter(p => p.qrCode).length);
      console.log('🎯 Products with barcodes:', products.filter(p => p.barcode).length);
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [open, products]);

  const startCamera = async (cameraIndex?: number) => {
    try {
      // First, enumerate all video devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      
      console.log('📹 Available cameras:', videoDevices.length);
      videoDevices.forEach((device, index) => {
        console.log(`Camera ${index + 1}:`, device.label || `Camera ${index + 1}`);
      });

      // Store ALL available cameras (not just back cameras)
      setAvailableCameras(videoDevices);

      if (videoDevices.length === 0) {
        toast.error('No cameras found');
        addNotification('error', 'No cameras available');
        return;
      }

      // Determine which camera to use
      let selectedIndex = 0;
      
      if (cameraIndex !== undefined) {
        // Use the provided camera index
        selectedIndex = cameraIndex % videoDevices.length;
      } else {
        // Try to load saved preference
        const savedIndex = localStorage.getItem('preferredCameraIndex');
        if (savedIndex !== null) {
          selectedIndex = parseInt(savedIndex) % videoDevices.length;
        } else {
          // Default preference logic:
          // 1. Prefer back/rear camera (for mobile)
          // 2. If no back camera, prefer camera that is NOT wide-angle
          // 3. Otherwise use first camera
          
          const backCameraIndex = videoDevices.findIndex(device => {
            const label = (device.label || '').toLowerCase();
            return (label.includes('back') || label.includes('rear') || label.includes('environment')) 
                   && !label.includes('wide') && !label.includes('ultra');
          });
          
          if (backCameraIndex !== -1) {
            selectedIndex = backCameraIndex;
          } else {
            // No back camera found, try any non-wide camera
            const mainCameraIndex = videoDevices.findIndex(device => {
              const label = (device.label || '').toLowerCase();
              return !label.includes('wide') && !label.includes('ultra');
            });
            selectedIndex = mainCameraIndex !== -1 ? mainCameraIndex : 0;
          }
        }
      }

      const selectedCamera = videoDevices[selectedIndex];
      setCurrentCameraIndex(selectedIndex);
      setCameraLabel(selectedCamera.label || `Camera ${selectedIndex + 1}`);
      
      // Save preference
      localStorage.setItem('preferredCameraIndex', selectedIndex.toString());
      
      console.log('✅ Selected camera:', selectedCamera.label, `(${selectedIndex + 1}/${videoDevices.length})`);

      // Request camera stream with specific device ID
      const constraints: MediaStreamConstraints = {
        video: {
          deviceId: { exact: selectedCamera.deviceId },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        streamRef.current = stream;
        setScanning(true);
        startScanning();
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast.error('Could not access camera. Please check permissions.');
      addNotification('error', 'Camera access denied');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    setScanning(false);
  };

  const startScanning = () => {
    // Scan more frequently for faster QR detection
    scanIntervalRef.current = window.setInterval(() => {
      captureAndScan();
    }, 100); // Scan every 100ms (10 times per second) for faster detection
  };

  const captureAndScan = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context || video.readyState !== video.HAVE_ENOUGH_DATA) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Here you would use a QR/barcode library to decode the image
    // For now, we'll simulate detection with product IDs
    // In production: Use jsQR, quagga2, or similar library
    
    // Simulated scan - map product names to mock barcodes/QR codes
    simulateScan();
  };

  // Simulate QR code detection - In production, replace with actual QR library
  const simulateScan = () => {
    // This is a mock - in real implementation, decode from canvas using jsQR or quagga2
    // For demo purposes, we'll randomly detect products occasionally
    
    // This function will be replaced with actual QR/barcode decoding
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height);

    if (code) {
      processScannedCode(code.data);
    }
  };

  // Process scanned code
  const processScannedCode = (code: string) => {
    // Prevent duplicate scans within 2 seconds
    if (code === lastScannedCode) {
      return;
    }

    console.log('🔍🔍🔍 SCAN DETECTED 🔍🔍🔍');
    console.log('Scanned code:', code);
    console.log('Code type:', typeof code);
    console.log('Code length:', code.length);

    setLastScannedCode(code);
    setScanHistory(prev => [code, ...prev].slice(0, 5));

    // Try to find product by ID or barcode
    // In real implementation, products would have barcode/QR fields
    const product = findProductByCode(code);

    if (product) {
      onAddToCart(product, 1);
      addNotification('success', `✓ Scanned: ${product.name}`);
      
      // Vibrate if supported
      if (navigator.vibrate) {
        navigator.vibrate(100);
      }
    } else {
      console.log('❌❌❌ PRODUCT NOT FOUND ❌❌❌');
      console.log('Available product codes:');
      products.forEach(p => {
        console.log(`- Product: ${p.name}`);
        console.log(`  ID: ${p.id} (type: ${typeof p.id})`);
        console.log(`  QR Code: ${p.qrCode || 'NONE'}`);
        console.log(`  Barcode: ${p.barcode || 'NONE'}`);
      });
      addNotification('error', `❌ Product not found: ${code}`);
    }

    // Reset after 2 seconds to allow re-scanning
    setTimeout(() => {
      setLastScannedCode('');
    }, 2000);
  };

  // Find product by scanned code
  const findProductByCode = (code: string): Product | null => {
    console.log('🔍 Searching for product with code:', code);
    console.log('📦 Available products:', products.length);
    
    // Normalize the scanned code (trim whitespace, handle URL encoding)
    const normalizedScannedCode = code.trim();
    
    console.log('🔍 Normalized scanned code:', normalizedScannedCode);
    console.log('🔍 Scanned code length:', normalizedScannedCode.length);
    
    // PRIORITY 1: Try to find by QR code (exact match)
    const byQRCode = products.find(p => {
      if (!p.qrCode) return false;
      
      const normalizedQRCode = p.qrCode.trim();
      
      console.log(`🔍 Comparing with ${p.name}:`);
      console.log(`  Stored QR: "${normalizedQRCode}"`);
      console.log(`  Scanned:   "${normalizedScannedCode}"`);
      console.log(`  Match: ${normalizedQRCode === normalizedScannedCode}`);
      console.log(`  Stored length: ${normalizedQRCode.length}, Scanned length: ${normalizedScannedCode.length}`);
      
      return normalizedQRCode === normalizedScannedCode;
    });
    
    if (byQRCode) {
      console.log('✅ Found by QR Code:', byQRCode.name);
      return byQRCode;
    }

    // PRIORITY 2: Try to find by barcode (exact match)
    const byBarcode = products.find(p => {
      if (!p.barcode) return false;
      
      const normalizedBarcode = p.barcode.trim();
      
      console.log(`🔍 Comparing barcode with ${p.name}:`);
      console.log(`  Stored Barcode: "${normalizedBarcode}"`);
      console.log(`  Scanned:        "${normalizedScannedCode}"`);
      console.log(`  Match: ${normalizedBarcode === normalizedScannedCode}`);
      
      return normalizedBarcode === normalizedScannedCode;
    });
    
    if (byBarcode) {
      console.log('✅ Found by Barcode:', byBarcode.name);
      return byBarcode;
    }
    
    // PRIORITY 3: Try to find by product ID
    const byId = products.find(p => p.id.toString() === normalizedScannedCode);
    if (byId) {
      console.log('✅ Found by ID:', byId.name);
      return byId;
    }

    // PRIORITY 4: Try to find by partial name match (case-insensitive)
    const byName = products.find(p => 
      p.name.toLowerCase().includes(normalizedScannedCode.toLowerCase())
    );
    if (byName) {
      console.log('✅ Found by Name:', byName.name);
      return byName;
    }

    console.log('❌ Product not found');
    return null;
  };

  // Add notification
  const addNotification = (type: 'success' | 'error' | 'warning', message: string) => {
    const id = Date.now().toString();
    const notification: Notification = { id, type, message };
    
    setNotifications(prev => [...prev, notification]);

    // Auto-remove notification after 3 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 3000);
  };

  // Manual product entry for testing
  const handleManualEntry = (productId: number) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      processScannedCode(productId.toString());
    }
  };

  // Switch to next camera
  const switchCamera = async () => {
    if (availableCameras.length <= 1) {
      toast.info('Only one camera available');
      return;
    }

    // Stop current camera
    stopCamera();

    // Switch to next camera
    const nextIndex = (currentCameraIndex + 1) % availableCameras.length;
    
    // Restart with new camera
    await startCamera(nextIndex);
    
    toast.success(`Switched to ${availableCameras[nextIndex].label || `Camera ${nextIndex + 1}`}`);
  };

  // Calculate cart total
  const cartTotal = currentCart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  const cartItemCount = currentCart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-full w-full h-screen max-h-screen p-0 gap-0 bg-white">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-[#C7359C] to-purple-600 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
              <Scan className="size-5 text-white" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">
                QR & Barcode Scanner
              </h2>
              <p className="text-[10px] sm:text-xs text-white/80">
                {scanning ? '🎥 Scanning active' : '📷 Camera off'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col h-[calc(100vh-64px)]">
          {/* CAMERA VIEW - 45% */}
          <div className="relative bg-black" style={{ height: '45%' }}>
            {/* Camera Feed */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            <canvas ref={canvasRef} className="hidden" />
            
            {/* Scanning Frame Overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative w-56 h-56 sm:w-64 sm:h-64">
                {/* Corner borders */}
                <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-[#FFD700] rounded-tl-lg" />
                <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-[#FFD700] rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-[#FFD700] rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-[#FFD700] rounded-br-lg" />
                
                {/* Scanning line animation */}
                {scanning && (
                  <div className="absolute inset-x-4 top-1/2 -translate-y-1/2">
                    <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-[#FFD700] to-transparent opacity-75 animate-pulse" />
                  </div>
                )}
              </div>
            </div>

            {/* Top Controls Bar */}
            <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-20">
              {/* Status Badge */}
              <Badge className={`${scanning ? 'bg-green-500/90' : 'bg-gray-500/90'} text-white px-3 py-1 backdrop-blur-sm shadow-lg border border-white/20`}>
                {scanning ? '● Live' : '○ Paused'}
              </Badge>

              {/* Switch Camera Button */}
              {availableCameras.length > 1 && (
                <Button
                  size="sm"
                  onClick={switchCamera}
                  className="bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm border border-white/20 shadow-lg h-8 px-3"
                >
                  <Camera className="size-3.5 mr-1.5" />
                  <span className="text-xs">Switch</span>
                  <Badge variant="secondary" className="ml-1.5 bg-white/20 text-white text-[10px] px-1.5 py-0 border-0">
                    {currentCameraIndex + 1}/{availableCameras.length}
                  </Badge>
                </Button>
              )}
            </div>

            {/* Bottom Instructions */}
            <div className="absolute bottom-3 left-3 right-3 z-10">
              <div className="bg-black/70 backdrop-blur-md text-white rounded-xl p-3 border border-white/10">
                <p className="text-xs font-medium text-center">
                  📷 Point camera at QR code or barcode
                </p>
                {lastScannedCode && (
                  <div className="mt-2 pt-2 border-t border-white/20">
                    <p className="text-[10px] text-yellow-300 font-mono text-center truncate">
                      Last: {lastScannedCode.length > 40 ? lastScannedCode.substring(0, 40) + '...' : lastScannedCode}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Success/Error Notifications */}
            {notifications.length > 0 && (
              <div className="absolute top-16 left-1/2 transform -translate-x-1/2 w-full max-w-sm px-4 z-30">
                {notifications.slice(0, 2).map(notification => (
                  <div
                    key={notification.id}
                    className={`mb-2 flex items-center gap-2 px-3 py-2 rounded-lg shadow-xl backdrop-blur-sm animate-in slide-in-from-top duration-300 border ${ 
                      notification.type === 'success' ? 'bg-green-500/95 text-white border-green-400' :
                      notification.type === 'error' ? 'bg-red-500/95 text-white border-red-400' :
                      'bg-yellow-500/95 text-white border-yellow-400'
                    }`}
                  >
                    {notification.type === 'success' && <Check className="size-4 flex-shrink-0" />}
                    {notification.type === 'error' && <X className="size-4 flex-shrink-0" />}
                    {notification.type === 'warning' && <AlertCircle className="size-4 flex-shrink-0" />}
                    <span className="text-xs font-semibold truncate">{notification.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* CART VIEW - 55% */}
          <div className="flex-1 flex flex-col bg-gray-50" style={{ height: '55%' }}>
            {/* Cart Header */}
            <div className="px-4 py-3 bg-white border-b flex-shrink-0 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <ShoppingCart className="size-5 text-[#C7359C]" />
                    Cart ({cartItemCount})
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {currentCart.length === 0 ? 'Waiting for scan...' : 'Items auto-added'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Total Amount</p>
                  <p className="text-2xl font-bold text-[#C7359C]">
                    PKR {cartTotal.toLocaleString('en-PK')}
                  </p>
                </div>
              </div>
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto px-3 py-3" style={{ minHeight: 0 }}>
              {currentCart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center px-4">
                  <div className="bg-gradient-to-br from-purple-100 to-pink-100 rounded-2xl p-8 mb-4">
                    <ShoppingCart className="size-16 text-[#C7359C] mx-auto" />
                  </div>
                  <h4 className="text-lg font-bold text-gray-900 mb-2">
                    No Items Yet
                  </h4>
                  <p className="text-sm text-gray-500 max-w-xs">
                    Scan a product QR code or barcode to add items to your cart
                  </p>
                </div>
              ) : (
                <div className="space-y-2 pb-2">
                  {currentCart.map((item) => {
                    const isJustAdded = item.tempId && justAddedIds.has(item.tempId);
                    
                    return (
                      <div
                        key={item.tempId || item.product.id}
                        className={`flex items-center gap-3 p-3 bg-white rounded-xl border-2 transition-all duration-300 shadow-sm ${
                          isJustAdded
                            ? 'border-green-400 bg-green-50 shadow-lg scale-[1.01] ring-2 ring-green-200' 
                            : 'border-gray-200 hover:border-purple-200 hover:shadow-md'
                        }`}
                      >
                        {/* Product Image */}
                        <div className="relative flex-shrink-0">
                          <img 
                            src={item.product.image} 
                            alt={item.product.name}
                            className="w-16 h-16 object-cover rounded-lg border-2 border-gray-100"
                          />
                          {isJustAdded && (
                            <div className="absolute -top-1 -right-1 bg-green-500 rounded-full p-1 shadow-md">
                              <Check className="size-3 text-white" />
                            </div>
                          )}
                        </div>

                        {/* Product Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h4 className="font-bold text-gray-900 text-sm truncate">
                              {item.product.name}
                            </h4>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 size-8 flex-shrink-0 rounded-lg"
                              onClick={() => item.tempId && onRemoveFromCart(item.tempId)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-600">
                                PKR {item.product.price.toLocaleString('en-PK')}
                              </span>
                              <span className="text-xs text-gray-400">×</span>
                              <span className="text-xs font-semibold text-gray-700">
                                {item.quantity}
                              </span>
                            </div>
                            <div className="text-sm font-bold text-[#C7359C]">
                              PKR {(item.product.price * item.quantity).toLocaleString('en-PK')}
                            </div>
                          </div>

                          {isJustAdded && (
                            <Badge variant="default" className="mt-1.5 bg-green-500 text-[10px] px-2 py-0 h-5">
                              ✓ Just added
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Checkout Button - Fixed at Bottom */}
            <div className="px-4 pb-4 pt-3 bg-white border-t flex-shrink-0 shadow-lg">
              <Button
                onClick={onClose}
                className="w-full h-12 text-base font-bold bg-gradient-to-r from-[#C7359C] to-purple-600 hover:from-purple-700 hover:to-[#C7359C] shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={currentCart.length === 0}
              >
                <Check className="size-5 mr-2" />
                Proceed to Checkout • {cartItemCount} items • PKR {cartTotal.toLocaleString('en-PK')}
              </Button>
              {currentCart.length > 0 && (
                <p className="text-center text-xs text-gray-500 mt-2">
                  Review your items at checkout
                </p>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}