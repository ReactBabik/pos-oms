import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { ScrollArea } from './ui/scroll-area';
import { Input } from './ui/input';
import { Camera, Loader2, CheckCircle2, RefreshCw, ShoppingCart, Trash2, Package, Sparkles, Plus, Minus, AlertCircle, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from './ui/utils';
import { playAGICodeBeep } from '@/utils/sounds';

interface AICameraProps {
  open: boolean;
  onClose: () => void;
  products: any[];
  onAddToCart: (product: any, quantity?: number) => void;
  currentCart?: any[];
  onRemoveFromCart?: (tempId: string) => void;
  onUpdateQuantity?: (tempId: string, newQuantity: number) => void;
  onCheckout?: () => void;
}

// Declare global types for Teachable Machine
declare global {
  interface Window {
    tf?: any;
    tmImage?: any;
  }
}

export function AICamera({ open, onClose, products, onAddToCart, currentCart = [], onRemoveFromCart, onUpdateQuantity, onCheckout }: AICameraProps) {
  const [model, setModel] = useState<any | null>(null);
  const [webcam, setWebcam] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [lastAddedProduct, setLastAddedProduct] = useState<string | null>(null);
  const [addedProductIds, setAddedProductIds] = useState<Set<number>>(new Set());
  const [useNativeVideo, setUseNativeVideo] = useState(false);
  const [showProductDialog, setShowProductDialog] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [detectionConfidence, setDetectionConfidence] = useState(0);
  const [isDialogLocked, setIsDialogLocked] = useState(false); // Prevent dialog updates while showing
  
  const webcamContainerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const scriptsLoadedRef = useRef(false);
  const lastAddTimeRef = useRef<number>(0);
  const lastAddedProductNameRef = useRef<string>(''); // Use ref for synchronous updates
  const streamRef = useRef<MediaStream | null>(null);
  const lastDetectionRef = useRef<number>(0);
  const dialogLockedRef = useRef(false); // Synchronous lock to prevent updates
  
  // Tracking for consistent detection over time
  const currentDetectionRef = useRef<{
    productId: number | null;
    productName: string;
    startTime: number;
    confidence: number;
  }>({ productId: null, productName: '', startTime: 0, confidence: 0 });

  const MODEL_URL = 'https://teachablemachine.withgoogle.com/models/uTEOsG8gl/';
  const CONFIDENCE_THRESHOLD = 0.95; // 95% confidence
  const DETECTION_DURATION = 2000; // Must be detected for 2 seconds
  const DETECTION_COOLDOWN = 3000; // 3 seconds between detections

  // Load scripts and initialize when dialog opens
  useEffect(() => {
    if (open) {
      loadScriptsAndInit();
      setAddedProductIds(new Set());
    } else {
      cleanup();
    }

    return () => {
      cleanup();
    };
  }, [open]);

  const loadScriptsAndInit = async () => {
    try {
      setIsLoading(true);
      
      // Load scripts if not already loaded
      if (!scriptsLoadedRef.current) {
        await loadScripts();
        scriptsLoadedRef.current = true;
      }
      
      // Initialize model and webcam
      await init();
      
    } catch (error) {
      console.error('Error loading AI scanner:', error);
      toast.error('Failed to load AI scanner. Please check your internet connection.');
      setIsLoading(false);
    }
  };

  const loadScripts = async (): Promise<void> => {
    // Check if already loaded
    if (window.tmImage && window.tf) {
      return;
    }

    console.log('📥 Loading Teachable Machine libraries...');

    // Load TensorFlow.js latest
    if (!window.tf) {
      await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@latest/dist/tf.min.js');
      console.log('✅ TensorFlow.js loaded');
    }

    // Load Teachable Machine Image latest
    if (!window.tmImage) {
      await loadScript('https://cdn.jsdelivr.net/npm/@teachablemachine/image@latest/dist/teachablemachine-image.min.js');
      console.log('✅ Teachable Machine Image loaded');
    }

    console.log('✅ All libraries loaded successfully');
  };

  const loadScript = (src: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const existingScript = document.querySelector(`script[src="${src}"]`);
      if (existingScript) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(script);
    });
  };

  const init = async () => {
    if (!window.tmImage) {
      throw new Error('Teachable Machine library not loaded');
    }

    try {
      console.log('📥 Loading AI model...');
      
      const modelURL = MODEL_URL + 'model.json';
      const metadataURL = MODEL_URL + 'metadata.json';

      // Load the model and metadata
      const loadedModel = await window.tmImage.load(modelURL, metadataURL);
      
      setModel(loadedModel);
      
      console.log(`✅ Model loaded with ${loadedModel.getTotalClasses()} classes`);

      // Detect if mobile device
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth < 768;

      // Use native camera for mobile, Teachable Machine webcam for desktop
      if (isMobile) {
        console.log('📱 Mobile device detected, using native camera');
        await setupNativeCamera(loadedModel);
      } else {
        // Try to setup webcam - use fallback on error
        try {
          await setupWebcam(loadedModel);
        } catch (webcamError) {
          console.error('⚠️ Teachable Machine Webcam failed, trying native camera:', webcamError);
          await setupNativeCamera(loadedModel);
        }
      }

      console.log('✅ Camera started');
      toast.success('AI Scanner ready! Point at products to scan.');
      
      setIsLoading(false);
      setIsScanning(true);
      
    } catch (error) {
      console.error('❌ Error initializing:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to initialize: ${errorMessage}`);
      setIsLoading(false);
      throw error;
    }
  };

  const setupWebcam = async (loadedModel: any) => {
    setUseNativeVideo(false);
    
    // Setup webcam using Teachable Machine's Webcam utility
    const flip = true;
    const webcamInstance = new window.tmImage.Webcam(640, 480, flip);
    
    await webcamInstance.setup({ facingMode: 'environment' });
    await webcamInstance.play();
    
    setWebcam(webcamInstance);
    
    // Append webcam canvas to container
    if (webcamContainerRef.current && !useNativeVideo) {
      webcamContainerRef.current.innerHTML = '';
      webcamContainerRef.current.appendChild(webcamInstance.canvas);
      
      // Style the canvas to fill container
      webcamInstance.canvas.style.width = '100%';
      webcamInstance.canvas.style.height = '100%';
      webcamInstance.canvas.style.objectFit = 'cover';
      webcamInstance.canvas.style.borderRadius = '8px';
      webcamInstance.canvas.style.display = 'block';
    }

    loop(webcamInstance, loadedModel);
  };

  const setupNativeCamera = async (loadedModel: any) => {
    console.log('📱 Using native camera');
    setUseNativeVideo(true);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });

      streamRef.current = stream;

      console.log('✅ Got media stream:', stream.id);
      console.log('✅ Video tracks:', stream.getVideoTracks().length);

      // Use the video ref element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // Wait for video to be ready
        await new Promise<void>((resolve, reject) => {
          if (!videoRef.current) return reject('No video element');
          
          videoRef.current.onloadedmetadata = () => {
            if (!videoRef.current) return reject('No video element');
            
            console.log('📹 Video metadata loaded');
            console.log('📹 Video dimensions:', videoRef.current.videoWidth, 'x', videoRef.current.videoHeight);
            
            videoRef.current.play()
              .then(() => {
                console.log('✅ Video playing');
                resolve();
              })
              .catch((playError) => {
                console.error('❌ Video play failed:', playError);
                reject(playError);
              });
          };
          
          videoRef.current.onerror = (err) => {
            console.error('❌ Video error:', err);
            reject(err);
          };
        });

        console.log('✅ Native camera setup complete');
        loopNativeRef(loadedModel);
      } else {
        throw new Error('Video ref not available');
      }
      
    } catch (error) {
      console.error('❌ Native camera failed:', error);
      throw new Error('Could not access camera. Please grant camera permissions and try again.');
    }
  };

  const loop = (webcamInstance: any, modelInstance: any) => {
    if (!webcamInstance || !modelInstance) return;
    
    webcamInstance.update();
    predict(webcamInstance, modelInstance);
    
    animationFrameRef.current = window.requestAnimationFrame(() => {
      loop(webcamInstance, modelInstance);
    });
  };

  const loopNativeRef = (modelInstance: any) => {
    if (!videoRef.current || !modelInstance) return;
    
    predictNativeRef(modelInstance);
    
    animationFrameRef.current = window.requestAnimationFrame(() => {
      loopNativeRef(modelInstance);
    });
  };

  const predict = async (webcamInstance: any, modelInstance: any) => {
    if (!webcamInstance || !modelInstance) return;
    
    try {
      const prediction = await modelInstance.predict(webcamInstance.canvas);
      handlePrediction(prediction);
    } catch (error) {
      console.error('Error making prediction:', error);
    }
  };

  const predictNativeRef = async (modelInstance: any) => {
    if (!videoRef.current || !modelInstance || videoRef.current.readyState !== 4) return;
    
    try {
      const prediction = await modelInstance.predict(videoRef.current);
      handlePrediction(prediction);
    } catch (error) {
      console.error('Error making prediction:', error);
    }
  };

  const handlePrediction = (prediction: any[]) => {
    // Don't process predictions if dialog is open (locked) - use ref for immediate check
    if (dialogLockedRef.current) {
      return; // Silently ignore - no need to log every frame
    }

    setPredictions(prediction);
    
    // Find the highest confidence prediction
    const sorted = [...prediction].sort((a, b) => b.probability - a.probability);
    const topPrediction = sorted[0];
    
    console.log(`🔍 Top prediction: ${topPrediction.className} at ${(topPrediction.probability * 100).toFixed(1)}%`);
    
    // Check if this meets our confidence threshold (95%+)
    if (topPrediction.probability >= CONFIDENCE_THRESHOLD && 
        topPrediction.className.toLowerCase() !== 'unknown' &&
        topPrediction.className.toLowerCase() !== 'background') {
      
      const matchedProduct = findMatchingProduct(topPrediction.className);
      
      if (matchedProduct) {
        const currentTime = Date.now();
        const currentDetection = currentDetectionRef.current;
        
        // Check if this is the same product we've been tracking
        if (currentDetection.productId === matchedProduct.id) {
          // Same product, check how long it's been detected
          const detectionDuration = currentTime - currentDetection.startTime;
          
          console.log(`⏱️ ${matchedProduct.name} detected for ${detectionDuration}ms at ${(topPrediction.probability * 100).toFixed(1)}%`);
          
          // If detected consistently for 2+ seconds, show the dialog
          if (detectionDuration >= DETECTION_DURATION) {
            console.log(`✅ ${matchedProduct.name} confirmed after ${detectionDuration}ms!`);
            
            // Lock immediately using ref (synchronous)
            dialogLockedRef.current = true;
            
            // Set detection confidence
            setDetectionConfidence(topPrediction.probability);
            
            // Play AGI code beep sound
            playAGICodeBeep();
            
            // Show product dialog
            setShowProductDialog(true);
            setSelectedProduct(matchedProduct);
            setSelectedQuantity(1);
            setIsDialogLocked(true); // Lock dialog to prevent updates
            
            // Reset detection tracking
            currentDetectionRef.current = {
              productId: null,
              productName: '',
              startTime: 0,
              confidence: 0
            };
          }
        } else {
          // Different product or first detection - start tracking
          console.log(`🆕 Started tracking ${matchedProduct.name} at ${(topPrediction.probability * 100).toFixed(1)}%`);
          currentDetectionRef.current = {
            productId: matchedProduct.id,
            productName: matchedProduct.name,
            startTime: currentTime,
            confidence: topPrediction.probability
          };
        }
      }
    } else {
      // Confidence dropped or lost detection - reset tracking
      if (currentDetectionRef.current.productId !== null) {
        console.log(`❌ Lost tracking of ${currentDetectionRef.current.productName}`);
        currentDetectionRef.current = {
          productId: null,
          productName: '',
          startTime: 0,
          confidence: 0
        };
      }
    }
  };

  const findMatchingProduct = (className: string) => {
    const normalized = className.toLowerCase().trim();
    
    // Try exact match first
    let matched = products.find(product => {
      const productName = product.name.toLowerCase();
      return productName === normalized;
    });

    // If no exact match, try partial match
    if (!matched) {
      matched = products.find(product => {
        const productName = product.name.toLowerCase();
        const productCategory = product.category?.toLowerCase() || '';
        
        return productName.includes(normalized) || 
               normalized.includes(productName) ||
               productCategory.includes(normalized) ||
               normalized.includes(productCategory);
      });
    }

    return matched;
  };

  const autoAddToCart = (product: any, confidence: number, className: string) => {
    console.log(`🎯 Auto-adding ${product.name} with ${(confidence * 100).toFixed(1)}% confidence`);
    
    onAddToCart(product, 1);
    
    setLastAddedProduct(product.name);
    
    toast.success(
      <div className="flex items-center gap-2">
        <CheckCircle2 className="size-5 text-green-600" />
        <div>
          <p className="font-bold">{product.name}</p>
          <p className="text-xs text-gray-600">Added automatically ({(confidence * 100).toFixed(0)}% match)</p>
        </div>
      </div>,
      { duration: 3000 }
    );

    // Clear last added indicator after 3 seconds
    setTimeout(() => {
      setLastAddedProduct(null);
    }, 3000);
  };

  const cleanup = () => {
    console.log('🧹 Cleaning up AI scanner...');
    
    setIsScanning(false);
    
    if (animationFrameRef.current) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    if (webcam) {
      try {
        webcam.stop();
      } catch (e) {
        console.error('Error stopping webcam:', e);
      }
      setWebcam(null);
    }
    
    // Stop native video stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    // Clear video element
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    if (webcamContainerRef.current) {
      webcamContainerRef.current.innerHTML = '';
    }
    
    setPredictions([]);
    setLastAddedProduct(null);
    setUseNativeVideo(false);
  };

  const reloadModel = async () => {
    cleanup();
    setIsLoading(true);
    toast.info('Reloading AI model...');
    
    try {
      await init();
      toast.success('Model reloaded successfully!');
    } catch (error) {
      console.error('Error reloading model:', error);
      toast.error('Failed to reload model');
      setIsLoading(false);
    }
  };

  // Calculate cart total
  const cartTotal = currentCart.reduce((sum, item) => {
    const price = item.product?.price || item.price || 0;
    const quantity = item.quantity || 1;
    return sum + (price * quantity);
  }, 0);

  const cartItemCount = currentCart.reduce((sum, item) => sum + (item.quantity || 1), 0);

  // Product Dialog Handlers
  const handleConfirmAddToCart = () => {
    if (selectedProduct) {
      onAddToCart(selectedProduct, selectedQuantity);
      
      toast.success(
        <div className="flex items-center gap-2">
          <CheckCircle2 className="size-5 text-green-600" />
          <div>
            <p className="font-bold">{selectedProduct.name}</p>
            <p className="text-xs text-gray-600">
              Added {selectedQuantity} {selectedQuantity === 1 ? 'unit' : 'units'} ({(detectionConfidence * 100).toFixed(0)}% match)
            </p>
          </div>
        </div>,
        { duration: 3000 }
      );

      // Close dialog and reset
      setShowProductDialog(false);
      setSelectedProduct(null);
      setSelectedQuantity(1);
      setDetectionConfidence(0);
      setIsDialogLocked(false); // Unlock dialog for future predictions
      dialogLockedRef.current = false; // Unlock ref synchronously
      
      // Reset detection tracking
      currentDetectionRef.current = {
        productId: null,
        productName: '',
        startTime: 0,
        confidence: 0
      };
    }
  };

  const handleCancelProductDialog = () => {
    setShowProductDialog(false);
    setSelectedProduct(null);
    setSelectedQuantity(1);
    setDetectionConfidence(0);
    setIsDialogLocked(false); // Unlock dialog for future predictions
    dialogLockedRef.current = false; // Unlock ref synchronously
    
    // Reset detection tracking
    currentDetectionRef.current = {
      productId: null,
      productName: '',
      startTime: 0,
      confidence: 0
    };
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent 
          className="!max-w-full !w-full !h-full p-0 gap-0 flex flex-col m-0"
          style={{ maxWidth: '100vw', width: '100vw', height: '100vh' }}
        >
          <DialogHeader className="px-4 lg:px-6 pt-4 lg:pt-6 pb-3 lg:pb-4 border-b flex-shrink-0">
            <DialogTitle className="text-lg lg:text-2xl flex items-center gap-2">
              <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-1.5 lg:p-2 rounded-lg">
                <Camera className="size-4 lg:size-6 text-white" />
              </div>
              AI Product Scanner
            </DialogTitle>
          </DialogHeader>

          {/* Mobile: Vertical Stack Layout */}
          <div className="lg:hidden flex flex-col gap-3 p-3 flex-1 overflow-hidden">
            {/* Top Section: Camera + Live Predictions side by side */}
            <div className="flex gap-3">
              {/* Camera Feed - Mobile (Square) */}
              <div className="relative bg-black rounded-lg overflow-hidden w-[180px] h-[180px] flex-shrink-0">
                {isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
                    <div className="text-center text-white">
                      <Loader2 className="size-6 animate-spin mx-auto mb-1" />
                      <p className="text-xs font-medium">Loading...</p>
                    </div>
                  </div>
                )}
                
                {/* Native Video Element - Rendered directly */}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={cn(
                    "w-full h-full object-cover",
                    useNativeVideo ? "block" : "hidden"
                  )}
                />
                
                {/* Canvas/Teachable Machine Container */}
                <div 
                  ref={webcamContainerRef}
                  className={cn(
                    "absolute inset-0 w-full h-full",
                    useNativeVideo ? "hidden" : "block"
                  )}
                >
                  {/* Teachable Machine canvas will be inserted here */}
                </div>
                
                {/* Scanning Indicator Overlay */}
                {isScanning && (
                  <div className="absolute inset-0 pointer-events-none z-10">
                    <div className="absolute inset-0 border-2 border-purple-500 animate-pulse" />
                    <div className="absolute top-1 left-1 right-1 bg-purple-600 text-white px-2 py-1 rounded shadow-lg flex items-center gap-1 text-xs">
                      <Loader2 className="size-3 animate-spin" />
                      <span className="font-medium text-[10px]">Scanning...</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Live Predictions - Mobile (Compact, next to camera) */}
              <div className="flex-1 flex flex-col gap-1.5 bg-gray-50 rounded-lg p-2 border overflow-hidden">
                <h3 className="text-xs font-semibold flex items-center gap-1">
                  <Sparkles className="size-3 text-purple-600" />
                  Live Predictions
                  {predictions.length > 0 && (
                    <Badge variant="secondary" className="bg-purple-100 text-purple-700 text-[10px] ml-auto h-4 px-1">
                      {predictions.length}
                    </Badge>
                  )}
                </h3>

                <div className="space-y-1.5 overflow-y-auto flex-1">
                  {predictions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400 py-2">
                      <Package className="size-8 mb-1 opacity-50" />
                      <p className="text-center text-[10px]">Point at products</p>
                    </div>
                  ) : (
                    predictions
                      .sort((a, b) => b.probability - a.probability)
                      .slice(0, 3) // Show top 3 on mobile
                      .map((prediction, idx) => {
                        const confidencePercent = Math.round(prediction.probability * 100);
                        const isHighConfidence = prediction.probability >= 0.8;
                        const matchedProduct = findMatchingProduct(prediction.className);
                        
                        return (
                          <div
                            key={idx}
                            className={cn(
                              "border rounded p-1.5 transition-all text-[10px]",
                              isHighConfidence
                                ? "bg-green-50 border-green-300"
                                : "bg-white border-gray-300"
                            )}
                          >
                            <div className="flex items-start justify-between gap-1">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1 mb-0.5">
                                  <Badge 
                                    variant={isHighConfidence ? "default" : "secondary"}
                                    className={cn(
                                      "text-[9px] h-3 px-1",
                                      isHighConfidence && "bg-green-600"
                                    )}
                                  >
                                    #{idx + 1}
                                  </Badge>
                                  {isHighConfidence && addedProductIds.has(matchedProduct?.id) && (
                                    <CheckCircle2 className="size-2.5 text-green-600" />
                                  )}
                                </div>
                                <h4 className="font-semibold text-[10px] text-gray-900 mb-0.5 truncate">
                                  {prediction.className}
                                </h4>
                              </div>
                              
                              <div className={cn(
                                "text-xs font-bold flex-shrink-0",
                                isHighConfidence ? "text-green-600" : "text-gray-600"
                              )}>
                                {confidencePercent}%
                              </div>
                            </div>
                            
                            {/* Confidence Bar */}
                            <div className="w-full bg-gray-200 rounded-full h-1 mt-1">
                              <div
                                className={cn(
                                  "h-1 rounded-full transition-all",
                                  isHighConfidence ? "bg-green-500" : "bg-gray-400"
                                )}
                                style={{ width: `${confidencePercent}%` }}
                              />
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>
              </div>
            </div>

            {/* Live Cart - Mobile (Takes most space) */}
            <Card className="flex flex-col flex-1 overflow-hidden">
              <CardHeader className="flex-shrink-0 pb-2 pt-3 px-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShoppingCart className="size-4" />
                  Cart Summary
                  {currentCart.length > 0 && (
                    <Badge className="bg-[#C7359C] text-xs">{currentCart.length}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col overflow-hidden p-0">
                {currentCart.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center p-4">
                    <div className="text-center text-gray-400">
                      <ShoppingCart className="size-12 mx-auto mb-2 opacity-50" />
                      <p className="font-medium text-sm">Cart is empty</p>
                      <p className="text-xs mt-1">Point camera at products</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col h-full">
                    {/* Scrollable Cart Items */}
                    <div className="flex-1 overflow-y-auto px-3 py-2">
                      <div className="space-y-2">
                        {currentCart.map((item, index) => {
                          const product = item.product || item;
                          const name = product.name || item.productName || 'Unknown';
                          const price = product.price || item.price || 0;
                          const quantity = item.quantity || 1;
                          const image = product.image || item.image;
                          
                          return (
                            <Card key={item.tempId || index} className="p-2">
                              <div className="flex gap-2">
                                {/* Product Image */}
                                <div className="flex-shrink-0 self-center">
                                  <div className="w-[53px] h-[53px] rounded-md bg-gray-100 border overflow-hidden">
                                    {image ? (
                                      <img 
                                        src={image} 
                                        alt={name}
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
                                    <h4 className="font-semibold text-sm truncate flex-1">{name}</h4>
                                    {onRemoveFromCart && item.tempId && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="size-7 flex-shrink-0 -mt-1"
                                        onClick={() => onRemoveFromCart(item.tempId)}
                                      >
                                        <Trash2 className="size-3.5 text-red-500" />
                                      </Button>
                                    )}
                                  </div>

                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5">
                                      {onUpdateQuantity && item.tempId ? (
                                        <>
                                          <Button
                                            variant="outline"
                                            size="icon"
                                            className="size-8"
                                            onClick={() => {
                                              if (quantity > 1) {
                                                onUpdateQuantity(item.tempId, quantity - 1);
                                              }
                                            }}
                                          >
                                            <Minus className="size-3.5" />
                                          </Button>
                                          <Input
                                            type="text"
                                            value={quantity}
                                            onChange={(e) => {
                                              const numValue = parseInt(e.target.value);
                                              if (!isNaN(numValue) && numValue >= 1) {
                                                onUpdateQuantity(item.tempId, numValue);
                                              }
                                            }}
                                            className="font-semibold w-14 text-center h-8 text-sm"
                                            onFocus={(e) => e.target.select()}
                                          />
                                          <Button
                                            variant="outline"
                                            size="icon"
                                            className="size-8"
                                            onClick={() => {
                                              onUpdateQuantity(item.tempId, quantity + 1);
                                            }}
                                          >
                                            <Plus className="size-3.5" />
                                          </Button>
                                        </>
                                      ) : (
                                        <p className="text-xs text-gray-500">Qty: {quantity}</p>
                                      )}
                                    </div>
                                    <div className="text-right">
                                      <p className="text-xs text-gray-500">PKR {price.toLocaleString()}</p>
                                      <p className="font-bold text-sm text-[#C7359C] whitespace-nowrap">
                                        PKR {(price * quantity).toLocaleString()}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </Card>
                          );
                        })}
                      </div>
                    </div>

                    {/* Cart Total - Fixed at Bottom */}
                    <div className="flex-shrink-0 border-t bg-white p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-600">Total Amount</p>
                          <p className="text-xs text-gray-500">{currentCart.length} items</p>
                        </div>
                        <p className="text-xl font-bold text-[#C7359C]">
                          PKR {cartTotal.toLocaleString()}
                        </p>
                      </div>
                      {onCheckout && (
                        <Button
                          className="w-full h-11 text-sm font-semibold bg-gradient-to-r from-[#C7359C] to-[#A62F82] hover:from-[#A62F82] hover:to-[#C7359C]"
                          size="lg"
                          onClick={() => {
                            cleanup();
                            onClose();
                            onCheckout();
                          }}
                          disabled={currentCart.length === 0}
                        >
                          Proceed to Checkout →
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Desktop: 3-Column Layout (unchanged) */}
          <div className="hidden lg:grid grid-cols-[auto_1fr_400px] gap-6 p-6 flex-1 overflow-hidden w-full">
            {/* Left side: Square Camera */}
            <div className="flex flex-col gap-4 overflow-hidden">
              {/* Camera Feed - Square aspect ratio */}
              <div className="relative bg-black rounded-lg overflow-hidden flex-shrink-0 w-[500px] h-[500px]">
                {isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
                    <div className="text-center text-white">
                      <Loader2 className="size-12 animate-spin mx-auto mb-3" />
                      <p className="text-lg font-medium">Loading AI Model...</p>
                      <p className="text-sm text-gray-400">This may take a few moments</p>
                    </div>
                  </div>
                )}
                
                <div 
                  ref={webcamContainerRef}
                  className="w-full h-full bg-black rounded-lg"
                />
                
                {/* Scanning Indicator Overlay */}
                {isScanning && (
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute inset-0 border-4 border-purple-500 animate-pulse" />
                    <div className="absolute top-4 left-4 right-4 bg-purple-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
                      <Loader2 className="size-5 animate-spin" />
                      <span className="font-medium">Scanning products...</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Detection Stats */}
              {predictions.length > 0 && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle2 className="size-4 text-green-600" />
                      <span className="text-xs text-green-700 font-medium">Detected</span>
                    </div>
                    <p className="text-2xl font-bold text-green-700">
                      {predictions.filter(p => p.probability >= 0.8).length}
                    </p>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className="size-4 text-blue-600" />
                      <span className="text-xs text-blue-700 font-medium">Avg Confidence</span>
                    </div>
                    <p className="text-2xl font-bold text-blue-700">
                      {predictions.length > 0
                        ? Math.round(
                            predictions.reduce((sum, p) => sum + p.probability, 0) /
                            predictions.length * 100
                          )
                        : 0}%
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Middle: Live Predictions */}
            <div className="flex flex-col gap-4 overflow-hidden">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Sparkles className="size-5 text-purple-600" />
                  Live Predictions
                </h3>
                {predictions.length > 0 && (
                  <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                    {predictions.length} detected
                  </Badge>
                )}
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                {predictions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400 py-12">
                    <Package className="size-16 mb-4 opacity-50" />
                    <p className="text-center text-sm">
                      Point camera at products to see predictions
                    </p>
                  </div>
                ) : (
                  predictions
                    .sort((a, b) => b.probability - a.probability)
                    .slice(0, 5) // Show top 5 predictions
                    .map((prediction, idx) => {
                      const confidencePercent = Math.round(prediction.probability * 100);
                      const isHighConfidence = prediction.probability >= 0.8;
                      const matchedProduct = findMatchingProduct(prediction.className);
                      
                      return (
                        <div
                          key={idx}
                          className={cn(
                            "border rounded-lg p-4 transition-all duration-200",
                            isHighConfidence
                              ? "bg-green-50 border-green-300 shadow-sm"
                              : "bg-gray-50 border-gray-300"
                          )}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge 
                                  variant={isHighConfidence ? "default" : "secondary"}
                                  className={cn(
                                    "text-xs",
                                    isHighConfidence && "bg-green-600 hover:bg-green-700"
                                  )}
                                >
                                  #{idx + 1}
                                </Badge>
                                {isHighConfidence && addedProductIds.has(matchedProduct?.id) && (
                                  <Badge variant="outline" className="text-xs bg-white border-green-400 text-green-700">
                                    <CheckCircle2 className="size-3 mr-1" />
                                    Auto-added
                                  </Badge>
                                )}
                              </div>
                              <h4 className="font-semibold text-gray-900 mb-1">
                                {prediction.className}
                              </h4>
                              {matchedProduct && (
                                <div className="flex items-center gap-4 text-sm text-gray-600">
                                  <span className="flex items-center gap-1">
                                    <Package className="size-4" />
                                    Stock: {matchedProduct.stock || 0}
                                  </span>
                                  <span className="font-medium text-purple-600">
                                    PKR {matchedProduct.price?.toLocaleString() || 0}
                                  </span>
                                </div>
                              )}
                              {!matchedProduct && (
                                <p className="text-xs text-gray-500">No matching product found</p>
                              )}
                            </div>
                            
                            <div className="flex flex-col items-end gap-2">
                              <div className="text-right">
                                <div className={cn(
                                  "text-lg font-bold",
                                  isHighConfidence ? "text-green-600" : "text-gray-600"
                                )}>
                                  {confidencePercent}%
                                </div>
                                <div className="text-xs text-gray-500">confidence</div>
                              </div>
                              
                              {!isHighConfidence && matchedProduct && !addedProductIds.has(matchedProduct.id) && (
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    onAddToCart(matchedProduct, 1);
                                    setAddedProductIds(prev => new Set(prev).add(matchedProduct.id));
                                    toast.success(`${matchedProduct.name} added to cart`);
                                  }}
                                  className="bg-purple-600 hover:bg-purple-700 text-white"
                                >
                                  <Plus className="size-4 mr-1" />
                                  Add
                                </Button>
                              )}
                            </div>
                          </div>
                          
                          {/* Confidence Bar */}
                          <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
                            <div
                              className={cn(
                                "h-2 rounded-full transition-all duration-300",
                                isHighConfidence
                                  ? "bg-green-500"
                                  : "bg-gray-400"
                              )}
                              style={{ width: `${confidencePercent}%` }}
                            />
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </div>

            {/* Right side: Cart */}
            <div className="flex flex-col gap-4 overflow-hidden border-l pl-6">
              <Card className="flex flex-col h-full">
                <CardHeader className="flex-shrink-0 pb-2 pt-3 px-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ShoppingCart className="size-4" />
                    Cart Summary
                    {currentCart.length > 0 && (
                      <Badge className="bg-[#C7359C] text-xs">{currentCart.length}</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col overflow-hidden p-0">
                  {currentCart.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center p-4">
                      <div className="text-center text-gray-400">
                        <ShoppingCart className="size-12 mx-auto mb-2 opacity-50" />
                        <p className="font-medium text-sm">Cart is empty</p>
                        <p className="text-xs mt-1">Point camera at products</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col h-full">
                      {/* Scrollable Cart Items */}
                      <div className="flex-1 overflow-y-auto px-3 py-2">
                        <div className="space-y-2">
                          {currentCart.map((item, index) => {
                            const product = item.product || item;
                            const name = product.name || item.productName || 'Unknown';
                            const price = product.price || item.price || 0;
                            const quantity = item.quantity || 1;
                            const image = product.image || item.image;
                            
                            return (
                              <Card key={item.tempId || index} className="p-2">
                                <div className="flex gap-2">
                                  {/* Product Image */}
                                  <div className="flex-shrink-0 self-center">
                                    <div className="w-[53px] h-[53px] rounded-md bg-gray-100 border overflow-hidden">
                                      {image ? (
                                        <img 
                                          src={image} 
                                          alt={name}
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
                                      <h4 className="font-semibold text-sm truncate flex-1">{name}</h4>
                                      {onRemoveFromCart && item.tempId && (
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="size-7 flex-shrink-0 -mt-1"
                                          onClick={() => onRemoveFromCart(item.tempId)}
                                        >
                                          <Trash2 className="size-3.5 text-red-500" />
                                        </Button>
                                      )}
                                    </div>

                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-1.5">
                                        {onUpdateQuantity && item.tempId ? (
                                          <>
                                            <Button
                                              variant="outline"
                                              size="icon"
                                              className="size-8"
                                              onClick={() => {
                                                if (quantity > 1) {
                                                  onUpdateQuantity(item.tempId, quantity - 1);
                                                }
                                              }}
                                            >
                                              <Minus className="size-3.5" />
                                            </Button>
                                            <Input
                                              type="text"
                                              value={quantity}
                                              onChange={(e) => {
                                                const numValue = parseInt(e.target.value);
                                                if (!isNaN(numValue) && numValue >= 1) {
                                                  onUpdateQuantity(item.tempId, numValue);
                                                }
                                              }}
                                              className="font-semibold w-14 text-center h-8 text-sm"
                                              onFocus={(e) => e.target.select()}
                                            />
                                            <Button
                                              variant="outline"
                                              size="icon"
                                              className="size-8"
                                              onClick={() => {
                                                onUpdateQuantity(item.tempId, quantity + 1);
                                              }}
                                            >
                                            <Plus className="size-3.5" />
                                          </Button>
                                        </>
                                      ) : (
                                        <p className="text-xs text-gray-500">Qty: {quantity}</p>
                                      )}
                                    </div>
                                    <div className="text-right">
                                      <p className="text-xs text-gray-500">PKR {price.toLocaleString()}</p>
                                      <p className="font-bold text-sm text-[#C7359C] whitespace-nowrap">
                                        PKR {(price * quantity).toLocaleString()}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </Card>
                          );
                        })}
                        </div>
                      </div>

                      {/* Cart Total - Fixed at Bottom */}
                      <div className="flex-shrink-0 border-t bg-white p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-600">Total Amount</p>
                            <p className="text-xs text-gray-500">{currentCart.length} items</p>
                          </div>
                          <p className="text-xl font-bold text-[#C7359C]">
                            PKR {cartTotal.toLocaleString()}
                          </p>
                        </div>
                        {onCheckout && (
                          <Button
                            className="w-full h-11 text-sm font-semibold bg-gradient-to-r from-[#C7359C] to-[#A62F82] hover:from-[#A62F82] hover:to-[#C7359C]"
                            size="lg"
                            onClick={() => {
                              cleanup();
                              onClose();
                              onCheckout();
                            }}
                            disabled={currentCart.length === 0}
                          >
                            Proceed to Checkout →
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Product Confirmation Dialog */}
      <Dialog open={showProductDialog} onOpenChange={handleCancelProductDialog}>
        <DialogContent className="max-w-sm sm:max-w-md p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-4 pt-4 pb-2 space-y-1">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <div className="bg-gradient-to-r from-green-500 to-emerald-500 p-1.5 rounded-lg">
                <CheckCircle2 className="size-4 text-white" />
              </div>
              Product Detected!
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              {(detectionConfidence * 100).toFixed(0)}% AI Detection Confidence
            </DialogDescription>
          </DialogHeader>

          {selectedProduct && (
            <div className="px-4 pb-4 space-y-3">
              {/* Product Image */}
              <div className="w-full h-40 sm:h-48 bg-white rounded-lg overflow-hidden flex items-center justify-center border border-gray-200">
                {selectedProduct.image ? (
                  <img 
                    src={selectedProduct.image} 
                    alt={selectedProduct.name}
                    className="w-full h-full object-contain p-2"
                  />
                ) : (
                  <div className="text-gray-400 flex flex-col items-center">
                    <Package className="size-12 mb-2" />
                    <p className="text-xs">No image</p>
                  </div>
                )}
              </div>

              {/* Product Name */}
              <div className="text-center">
                <h3 className="font-bold text-base sm:text-lg text-gray-900">{selectedProduct.displayName || selectedProduct.name}</h3>
                {selectedProduct.category && (
                  <p className="text-xs text-gray-500 mt-0.5">{selectedProduct.category}</p>
                )}
              </div>

              {/* Price and Stock Row */}
              <div className="grid grid-cols-2 gap-2">
                {/* Price */}
                <div className="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-2.5">
                  <p className="text-[10px] text-purple-700 font-semibold mb-0.5 uppercase tracking-wide">Price</p>
                  <p className="text-lg sm:text-xl font-bold text-purple-900">
                    PKR {(selectedProduct.price || selectedProduct.defaultPrice || 0).toLocaleString()}
                  </p>
                </div>

                {/* Stock */}
                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200 rounded-lg p-2.5">
                  <p className="text-[10px] text-blue-700 font-semibold mb-0.5 uppercase tracking-wide">In Stock</p>
                  <p className="text-lg sm:text-xl font-bold text-blue-900 flex items-center gap-1.5">
                    <Package className="size-4" />
                    {selectedProduct.stock || selectedProduct.totalStock || selectedProduct.batches?.reduce((sum: number, b: any) => sum + (b.quantity || 0), 0) || 0}
                  </p>
                </div>
              </div>

              {/* Quantity Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Quantity</label>
                <div className="flex items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-9 rounded-lg border hover:bg-gray-100"
                    onClick={() => setSelectedQuantity(Math.max(1, selectedQuantity - 1))}
                    disabled={selectedQuantity <= 1}
                  >
                    <Minus className="size-4" />
                  </Button>
                  <Input
                    type="number"
                    min="1"
                    value={selectedQuantity}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Allow empty string for editing
                      if (value === '') {
                        setSelectedQuantity(1);
                        return;
                      }
                      const numValue = parseInt(value);
                      if (!isNaN(numValue) && numValue >= 1) {
                        setSelectedQuantity(numValue);
                      }
                    }}
                    onBlur={(e) => {
                      // Ensure valid value on blur
                      const value = parseInt(e.target.value);
                      if (isNaN(value) || value < 1) {
                        setSelectedQuantity(1);
                      }
                    }}
                    className="w-16 text-center font-bold text-xl h-9 border"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-9 rounded-lg border hover:bg-gray-100"
                    onClick={() => setSelectedQuantity(selectedQuantity + 1)}
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
              </div>

              {/* Total Price */}
              <div className="bg-gradient-to-r from-[#C7359C] to-[#A62F82] text-white rounded-lg p-3 shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs opacity-90 font-medium">Total Price</p>
                    <p className="text-[10px] opacity-75 mt-0.5">{selectedQuantity} {selectedQuantity === 1 ? 'unit' : 'units'}</p>
                  </div>
                  <p className="text-2xl sm:text-3xl font-bold">
                    PKR {(((selectedProduct.price || selectedProduct.defaultPrice || 0) * selectedQuantity)).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  className="h-10 font-semibold border hover:bg-gray-100"
                  onClick={handleCancelProductDialog}
                >
                  Cancel
                </Button>
                <Button
                  className="h-10 font-semibold bg-gradient-to-r from-[#C7359C] to-[#A62F82] hover:from-[#A62F82] hover:to-[#C7359C] shadow-lg"
                  onClick={handleConfirmAddToCart}
                >
                  <ShoppingCart className="size-4 mr-1.5" />
                  Add to Cart
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}