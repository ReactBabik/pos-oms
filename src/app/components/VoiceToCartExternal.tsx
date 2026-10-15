import { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Separator } from './ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Mic, MicOff, Loader2, CheckCircle2, ShoppingCart, Trash2, Package, X, Plus, Minus, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { playAGICodeBeep } from '@/utils/sounds';

interface VoiceToCartExternalProps {
  open: boolean;
  onClose: () => void;
  products: any[];
  onAddToCart: (product: any) => void;
  cart: any[]; // Add cart prop
  onRemoveFromCart?: (tempId: string) => void; // Changed to use tempId directly
  onUpdateQuantity?: (tempId: string, newQuantity: number) => void; // Changed to use tempId directly
  onCheckout?: () => void; // Add checkout handler
}

// Declare global types for TensorFlow from CDN (Teachable Machine versions)
declare global {
  interface Window {
    tf?: any;
    speechCommands?: any;
  }
}

export function VoiceToCartExternal({ open, onClose, products, onAddToCart, cart, onRemoveFromCart, onUpdateQuantity, onCheckout }: VoiceToCartExternalProps) {
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [recognizer, setRecognizer] = useState<any>(null);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [lastDetection, setLastDetection] = useState<string>('');
  const [confidence, setConfidence] = useState<number>(0);
  const [allPredictions, setAllPredictions] = useState<{ label: string; score: number }[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);

  const isListeningRef = useRef(false);
  const recognizerRef = useRef<any>(null);
  const scriptsLoadedRef = useRef(false);
  const loadAttemptRef = useRef(0);

  // Teachable Machine model URL
  const MODEL_URL = 'https://teachablemachine.withgoogle.com/models/HVJ5YzFtT/';

  // Load TensorFlow and Speech Commands from CDN (Teachable Machine versions)
  useEffect(() => {
    if (!open) return;

    const loadScripts = async () => {
      // Check if already loaded
      if (scriptsLoadedRef.current && window.speechCommands) {
        console.log('📦 Scripts already loaded, loading model...');
        loadModel();
        return;
      }

      try {
        setIsLoading(true);
        setLoadError(null);
        loadAttemptRef.current += 1;
        
        // Detailed device detection
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
        const isAndroid = /Android/i.test(navigator.userAgent);
        const connection = (navigator as any).connection;
        
        console.log('='.repeat(50));
        console.log(`📥 [Attempt ${loadAttemptRef.current}] Loading Voice Recognition`);
        console.log('='.repeat(50));
        console.log('📱 Device Info:', {
          userAgent: navigator.userAgent,
          isMobile,
          isIOS,
          isAndroid,
          platform: navigator.platform,
          connection: connection?.effectiveType || 'unknown',
          downlink: connection?.downlink || 'unknown',
          language: navigator.language,
          onLine: navigator.onLine,
          cookieEnabled: navigator.cookieEnabled
        });
        console.log('🌐 Window Info:', {
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight,
          devicePixelRatio: window.devicePixelRatio,
          tf_exists: !!window.tf,
          speechCommands_exists: !!window.speechCommands
        });

        if (!navigator.onLine) {
          throw new Error('No internet connection detected');
        }

        // Load TensorFlow.js v1.3.1 (Teachable Machine recommended version)
        if (!window.tf) {
          console.log('⏳ [1/2] Loading TensorFlow.js 1.3.1...');
          const tfStart = Date.now();
          await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@1.3.1/dist/tf.min.js', 60000);
          const tfDuration = Date.now() - tfStart;
          console.log(`✅ TensorFlow.js 1.3.1 loaded in ${tfDuration}ms`);
          
          // Wait and verify TF is available
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          if (!window.tf) {
            throw new Error('TensorFlow.js loaded but window.tf is undefined');
          }
          
          console.log('✅ window.tf verified:', typeof window.tf);
        } else {
          console.log('✅ TensorFlow.js already available');
        }

        // Load Speech Commands v0.4.0 (Teachable Machine recommended version)
        if (!window.speechCommands) {
          console.log('⏳ [2/2] Loading Speech Commands 0.4.0...');
          const scStart = Date.now();
          await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/speech-commands@0.4.0/dist/speech-commands.min.js', 60000);
          const scDuration = Date.now() - scStart;
          console.log(`✅ Speech Commands 0.4.0 loaded in ${scDuration}ms`);
          
          // Wait and verify Speech Commands is available
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          if (!window.speechCommands) {
            throw new Error('Speech Commands loaded but window.speechCommands is undefined');
          }
          
          console.log('✅ window.speechCommands verified:', typeof window.speechCommands);
          console.log('✅ speechCommands.create:', typeof window.speechCommands.create);
        } else {
          console.log('✅ Speech Commands already available');
        }

        scriptsLoadedRef.current = true;
        console.log('✅ All CDN scripts loaded and verified successfully');
        console.log('='.repeat(50));
        
        // Now load the model
        await loadModel();
      } catch (error: any) {
        console.error('='.repeat(50));
        console.error('❌ CRITICAL ERROR loading scripts');
        console.error('='.repeat(50));
        console.error('❌ Error:', error);
        console.error('❌ Error type:', error.name);
        console.error('❌ Error message:', error.message);
        console.error('❌ Error stack:', error.stack);
        
        let errorMsg = 'Failed to load voice recognition libraries';
        
        if (!navigator.onLine) {
          errorMsg = 'No internet connection. Please check your network.';
        } else if (error.message.includes('Timeout')) {
          errorMsg = 'Loading timeout. Please check your internet connection and try again.';
        } else if (error.message.includes('Failed to load')) {
          errorMsg = 'Network error. Cannot load required libraries from CDN.';
        } else {
          errorMsg = `Error: ${error.message}`;
        }
        
        setLoadError(errorMsg);
        toast.error(errorMsg);
        setIsLoading(false);
      }
    };

    loadScripts();
  }, [open]);

  const loadScript = (src: string, timeout: number = 60000): Promise<void> => {
    return new Promise((resolve, reject) => {
      console.log(`📥 Starting to load: ${src}`);
      
      // Check if script already exists
      const existingScript = document.querySelector(`script[src="${src}"]`);
      if (existingScript) {
        console.log(`✅ Script already exists in DOM: ${src}`);
        // Even if it exists, wait a bit to ensure it's fully loaded
        setTimeout(() => resolve(), 500);
        return;
      }

      let timeoutId: NodeJS.Timeout;
      let resolved = false;
      const startTime = Date.now();

      const cleanup = () => {
        if (timeoutId) clearTimeout(timeoutId);
      };

      const handleSuccess = () => {
        if (resolved) return;
        resolved = true;
        cleanup();
        const duration = Date.now() - startTime;
        console.log(`✅ Script loaded successfully in ${duration}ms: ${src}`);
        resolve();
      };

      const handleError = (error: any) => {
        if (resolved) return;
        resolved = true;
        cleanup();
        const duration = Date.now() - startTime;
        console.error(`❌ Script failed to load after ${duration}ms: ${src}`, error);
        reject(new Error(`Failed to load ${src}: ${error?.message || 'Network error'}`));
      };

      // Set timeout
      timeoutId = setTimeout(() => {
        handleError(new Error(`Timeout after ${timeout}ms`));
      }, timeout);

      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.crossOrigin = 'anonymous';
      
      // Add more event listeners for debugging
      script.onload = () => {
        console.log(`📦 Script onload fired: ${src}`);
        handleSuccess();
      };
      
      script.onerror = (error) => {
        console.error(`📦 Script onerror fired: ${src}`, error);
        handleError(error);
      };
      
      // Try to detect if script is blocked
      script.addEventListener('error', (error) => {
        console.error(`📦 Script error event: ${src}`, error);
      }, true);
      
      document.head.appendChild(script);
      console.log(`📦 Script element appended to DOM: ${src}`);
    });
  };

  const loadModel = async () => {
    if (!window.speechCommands) {
      const errorMsg = 'Speech Commands library not loaded';
      console.error('❌', errorMsg);
      setLoadError(errorMsg);
      toast.error(errorMsg);
      setIsLoading(false);
      return;
    }

    try {
      console.log('📥 Loading Teachable Machine model...');
      setLoadError(null);
      
      const checkpointURL = MODEL_URL + 'model.json'; // model topology
      const metadataURL = MODEL_URL + 'metadata.json'; // model metadata

      console.log('🔗 Model URLs:', { checkpointURL, metadataURL });

      // Create recognizer using Teachable Machine pattern with timeout
      console.log('⏳ Creating recognizer...');
      const recognizerInstance = window.speechCommands.create(
        'BROWSER_FFT', // fourier transform type
        undefined, // speech commands vocabulary feature
        checkpointURL,
        metadataURL
      );

      console.log('⏳ Ensuring model is loaded (this may take 30-60 seconds on mobile)...');
      
      // Add timeout for model loading (2 minutes for mobile)
      const modelLoadPromise = recognizerInstance.ensureModelLoaded();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Model loading timeout (120s)')), 120000)
      );
      
      await Promise.race([modelLoadPromise, timeoutPromise]);
      
      const classLabels = recognizerInstance.wordLabels();
      console.log('✅ Model loaded! Classes:', classLabels);
      console.log('📊 Total classes:', classLabels.length);
      
      setRecognizer(recognizerInstance);
      recognizerRef.current = recognizerInstance;
      setModelLoaded(true);
      toast.success('Voice model ready! Press and hold to speak');
      setIsLoading(false);
      setLoadError(null);
    } catch (error: any) {
      console.error('❌ Error loading model:', error);
      console.error('❌ Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      
      const errorMsg = `Failed to load voice model: ${error.message || 'Unknown error'}`;
      setLoadError(errorMsg);
      toast.error(errorMsg);
      setIsLoading(false);
    }
  };

  const cleanup = () => {
    console.log('🧹 Cleaning up...');
    
    if (recognizerRef.current && isListeningRef.current) {
      try {
        recognizerRef.current.stopListening();
      } catch (e) {
        // Ignore
      }
    }
    
    setIsListening(false);
    isListeningRef.current = false;
    setLastDetection('');
    setConfidence(0);
    setAllPredictions([]);
  };

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  const startListening = async () => {
    const activeRecognizer = recognizerRef.current;
    
    if (!activeRecognizer || !modelLoaded) {
      toast.error('Voice model not ready');
      return;
    }

    if (isListeningRef.current) {
      return;
    }

    try {
      console.log('🎤 Starting voice recognition...');
      
      setIsListening(true);
      isListeningRef.current = true;

      // Start listening using Teachable Machine pattern
      activeRecognizer.listen(
        (result: any) => {
          if (!isListeningRef.current) return;

          const scores = result.scores; // probability of prediction for each class
          const classLabels = activeRecognizer.wordLabels();
          
          // Find highest confidence prediction
          let maxScore = 0;
          let maxIndex = 0;
          
          const predictions = [];
          for (let i = 0; i < classLabels.length; i++) {
            predictions.push({
              label: classLabels[i],
              score: scores[i]
            });
            
            if (scores[i] > maxScore) {
              maxScore = scores[i];
              maxIndex = i;
            }
          }

          // Sort predictions by score
          predictions.sort((a, b) => b.score - a.score);
          setAllPredictions(predictions);

          const detectedWord = classLabels[maxIndex];
          
          // Update UI
          setConfidence(maxScore);
          setLastDetection(detectedWord);

          console.log(`🎯 Detection: ${detectedWord} (${(maxScore * 100).toFixed(1)}%)`);

          // Only trigger if confidence is above threshold (75%)
          if (maxScore > 0.75) {
            // Filter out background noise and unknown classes
            if (detectedWord !== '_background_noise_' && 
                detectedWord !== '_unknown_' &&
                detectedWord !== 'Background Noise') {
              
              console.log(`✅ HIGH CONFIDENCE: ${detectedWord} (${(maxScore * 100).toFixed(1)}%)`);
              
              // Try to match with products
              const matchedProduct = findMatchingProduct(detectedWord);
              
              if (matchedProduct) {
                console.log('🎯 FOUND MATCH, calling onAddToCart with:', matchedProduct);
                
                // Automatically add to cart
                onAddToCart(matchedProduct);
                
                console.log('✅ onAddToCart called successfully');
                
                // Clear debug info on success
                setDebugInfo([]);
                
                toast.success(`✅ Added: ${matchedProduct.name || matchedProduct.displayName}`, {
                  icon: <CheckCircle2 className="size-4 text-green-600" />
                });
                playAGICodeBeep();
                console.log('🛒 Auto-added to cart:', matchedProduct.name || matchedProduct.displayName);
              } else {
                console.log('❌ NO MATCH FOUND for:', detectedWord);
                console.log('📦 Available products:', products.map(p => ({
                  displayName: p.displayName,
                  productName: p.productName,
                  variantName: p.variantName
                })));
                
                // Show debug info in UI
                const normalizedDetected = detectedWord.toLowerCase().trim();
                
                // Search for similar products
                const similarProducts = products.filter(p => {
                  const displayName = p.displayName?.toLowerCase() || '';
                  const productName = (p.productName || p.name || '').toLowerCase();
                  // Check if any word from detected appears in product name
                  return displayName.includes('dual') || displayName.includes('gold') || 
                         productName.includes('dual') || productName.includes('gold');
                });
                
                // Check for exact match (case-insensitive)
                const exactMatch = products.find(p => 
                  p.displayName?.toLowerCase().trim() === normalizedDetected
                );
                
                const debugMessages = [
                  `🎯 Detected: "${detectedWord}"`,
                  `🔍 Normalized: "${normalizedDetected}"`,
                  `📦 Total products: ${products.length}`,
                  exactMatch ? `✅ FOUND in inventory: "${exactMatch.displayName}"` : `❌ NOT FOUND in inventory`,
                  ``,
                  `🔎 Searching for similar products with "dual" or "gold"...`,
                  similarProducts.length > 0 
                    ? `Found ${similarProducts.length} similar products:`
                    : `No similar products found`,
                  ...similarProducts.slice(0, 5).map((p, i) => 
                    `  ${i + 1}. "${p.displayName}"`
                  ),
                  ``,
                  `📋 First 5 products in inventory:`,
                  ...products.slice(0, 5).map((p, i) => 
                    `  ${i + 1}. "${p.displayName}"`
                  )
                ];
                setDebugInfo(debugMessages);
                
                toast.error(`❌ No match for: ${detectedWord}`);
              }
            }
          }
        },
        {
          includeSpectrogram: true, // in case listen should return result.spectrogram
          probabilityThreshold: 0.75,
          invokeCallbackOnNoiseAndUnknown: true,
          overlapFactor: 0.50 // probably want between 0.5 and 0.75
        }
      );
      
    } catch (error: any) {
      console.error('❌ Error starting listening:', error);
      
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        toast.error('Microphone permission denied. Please allow microphone access.');
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        toast.error('No microphone found. Please connect a microphone.');
      } else {
        toast.error('Failed to start voice recognition');
      }
      
      setIsListening(false);
      isListeningRef.current = false;
    }
  };

  const stopListening = () => {
    console.log('🛑 Stopping voice recognition...');
    
    const activeRecognizer = recognizerRef.current;
    
    if (!activeRecognizer || !isListeningRef.current) {
      setIsListening(false);
      isListeningRef.current = false;
      return;
    }

    try {
      activeRecognizer.stopListening();
      console.log('✅ Stopped listening');
    } catch (e) {
      console.error('Error stopping recognizer:', e);
    }
    
    setIsListening(false);
    isListeningRef.current = false;
  };

  const findMatchingProduct = (voiceInput: string) => {
    // Normalize: lowercase, trim, and replace multiple spaces with single space
    const normalized = voiceInput.toLowerCase().trim().replace(/\s+/g, ' ');
    
    console.log('='.repeat(60));
    console.log('🎯 VOICE MODEL DETECTED:', voiceInput);
    console.log('🔍 Normalized:', normalized);
    console.log('📦 Searching in', products.length, 'products');
    console.log('='.repeat(60));
    
    // STRATEGY: The Teachable Machine model outputs exact class names
    // So we should prioritize EXACT matching first
    
    // 1. Try EXACT match on displayName (most specific - includes variant)
    let matched = products.find(product => {
      const displayName = (product.displayName || '').toLowerCase().trim().replace(/\s+/g, ' ');
      if (displayName === normalized) {
        console.log('✅ EXACT MATCH on displayName:', {
          detected: voiceInput,
          displayName: product.displayName,
          productName: product.productName,
          variantName: product.variantName,
          variantId: product.variantId
        });
        return true;
      }
      return false;
    });

    if (matched) {
      console.log('✅✅ SUCCESS: Matched product =', matched.displayName || matched.name);
      console.log('='.repeat(60));
      return matched;
    }

    // 2. Try EXACT match on productName (base product name)
    matched = products.find(product => {
      const productName = (product.productName || product.name || '').toLowerCase().trim().replace(/\s+/g, ' ');
      if (productName === normalized) {
        console.log('✅ EXACT MATCH on productName:', {
          detected: voiceInput,
          displayName: product.displayName,
          productName: product.productName,
          variantName: product.variantName,
          variantId: product.variantId
        });
        return true;
      }
      return false;
    });

    if (matched) {
      console.log('✅✅ SUCCESS: Matched product =', matched.displayName || matched.name);
      console.log('='.repeat(60));
      return matched;
    }

    // 3. Try PARTIAL match but be VERY conservative
    // Only match if the normalized voice input is a substantial part of the product name
    console.log('⚠️ No exact match found, trying conservative partial match...');
    
    matched = products.find(product => {
      const displayName = (product.displayName || '').toLowerCase().trim().replace(/\s+/g, ' ');
      const productName = (product.productName || product.name || '').toLowerCase().trim().replace(/\s+/g, ' ');
      
      // Only match if normalized is AT LEAST 5 characters and is contained in product name
      // This prevents short accidental matches
      if (normalized.length >= 5) {
        if (displayName.includes(normalized)) {
          console.log('⚠️ PARTIAL MATCH (displayName contains detected):', {
            detected: voiceInput,
            displayName: product.displayName,
            productName: product.productName,
            variantName: product.variantName,
            variantId: product.variantId
          });
          return true;
        }
        
        if (productName.includes(normalized)) {
          console.log('⚠️ PARTIAL MATCH (productName contains detected):', {
            detected: voiceInput,
            displayName: product.displayName,
            productName: product.productName,
            variantName: product.variantName,
            variantId: product.variantId
          });
          return true;
        }
      }
      
      return false;
    });

    if (matched) {
      console.log('✅✅ SUCCESS: Matched product =', matched.displayName || matched.name);
      console.log('='.repeat(60));
      return matched;
    }

    // 4. No match found - show debug info
    console.log('❌❌ NO MATCH FOUND for:', voiceInput);
    console.log('📋 First 5 products in inventory:');
    products.slice(0, 5).forEach((p, idx) => {
      console.log(`  ${idx + 1}.`, {
        displayName: p.displayName,
        productName: p.productName || p.name,
        variantName: p.variantName,
        variantId: p.variantId
      });
    });
    console.log('='.repeat(60));
    
    return null;
  };

  const handlePressStart = (e: any) => {
    e.preventDefault();
    startListening();
  };

  const handlePressEnd = (e: any) => {
    e.preventDefault();
    stopListening();
  };

  // Calculate cart total
  const getCartTotal = () => {
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      if (!newOpen) {
        cleanup();
        onClose();
      }
    }}>
      <DialogContent className="w-[99vw] h-[99vh] lg:w-[90vw] lg:h-[90vh] !max-w-none overflow-hidden flex flex-col p-6">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-2xl flex items-center gap-2">
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-2 rounded-lg">
              <Mic className="size-6 text-white" />
            </div>
            Voice-to-Cart
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row gap-3">
          {/* Cart Summary - Now at Top/Left */}
          <div className="flex-1 lg:flex-none w-full lg:w-[calc(70%-0.375rem)] min-h-0">
            <Card className="flex flex-col h-full max-w-[600px]">
              <CardHeader className="flex-shrink-0 pb-2 pt-3 px-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShoppingCart className="size-4" />
                  Cart Summary
                  {cart.length > 0 && (
                    <Badge className="bg-[#C7359C] text-xs">{cart.length}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col overflow-hidden p-0">
                {cart.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center p-4">
                    <div className="text-center text-gray-400">
                      <ShoppingCart className="size-12 mx-auto mb-2 opacity-50" />
                      <p className="font-medium text-sm">Cart is empty</p>
                      <p className="text-xs mt-1">Add products via voice</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col h-full">
                    {/* Scrollable Cart Items */}
                    <div className="flex-1 overflow-y-auto px-3 py-2">
                      <div className="space-y-2">
                        {cart.map((item) => (
                          <Card key={item.tempId || `${item.variantId}-${item.batchId}-${Math.random()}`} className="p-2">
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
                                  <div className="flex-1 min-w-0">
                                    <h4 className="font-semibold text-sm truncate">
                                      {item.variantName ? `${item.productName} ${item.variantName}` : item.productName}
                                    </h4>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-7 flex-shrink-0 -mt-1"
                                    onClick={() => onRemoveFromCart?.(item.tempId)}
                                  >
                                    <Trash2 className="size-3.5 text-red-500" />
                                  </Button>
                                </div>

                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-1.5">
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      className="size-8"
                                      onClick={() => {
                                        if (item.quantity > 1 && onUpdateQuantity) {
                                          onUpdateQuantity(item.tempId, item.quantity - 1);
                                        }
                                      }}
                                    >
                                      <Minus className="size-3.5" />
                                    </Button>
                                    <Input
                                      type="text"
                                      value={item.quantity}
                                      onChange={(e) => {
                                        const numValue = parseInt(e.target.value);
                                        if (!isNaN(numValue) && numValue >= 1 && onUpdateQuantity) {
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
                                        if (onUpdateQuantity) {
                                          onUpdateQuantity(item.tempId, item.quantity + 1);
                                        }
                                      }}
                                    >
                                      <Plus className="size-3.5" />
                                    </Button>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-xs text-gray-500">PKR {item.price.toLocaleString()}</p>
                                    <p className="font-bold text-sm text-[#C7359C] whitespace-nowrap">
                                      PKR {(item.price * item.quantity).toLocaleString()}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>

                    {/* Cart Total - Fixed at Bottom */}
                    <div className="flex-shrink-0 border-t bg-white p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-600">Total Amount</p>
                          <p className="text-xs text-gray-500">{cart.length} items</p>
                        </div>
                        <p className="text-xl font-bold text-[#C7359C]">
                          PKR {getCartTotal().toLocaleString()}
                        </p>
                      </div>
                      <Button
                        className="w-full h-11 text-sm font-semibold bg-gradient-to-r from-[#C7359C] to-[#A62F82] hover:from-[#A62F82] hover:to-[#C7359C]"
                        size="lg"
                        onClick={() => {
                          cleanup();
                          onClose();
                          onCheckout?.();
                        }}
                        disabled={cart.length === 0}
                      >
                        Proceed to Checkout →
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Voice Recognition - Now at Bottom/Right */}
          <div className="flex-shrink-0 lg:flex-none w-full lg:w-[calc(30%-0.375rem)] overflow-hidden min-h-0 flex flex-col">
            {isLoading && (
              <div className="flex-1 flex items-center justify-center bg-gray-50 rounded-lg p-4">
                <div className="text-center">
                  <Loader2 className="size-10 animate-spin mx-auto mb-2 text-purple-600" />
                  <p className="text-base font-medium text-gray-900">Loading Voice Model...</p>
                </div>
              </div>
            )}

            {!isLoading && loadError && (
              <div className="flex-1 flex items-center justify-center bg-red-50 rounded-lg p-4">
                <div className="text-center max-w-sm">
                  <div className="size-12 mx-auto mb-3 rounded-full bg-red-100 flex items-center justify-center">
                    <X className="size-6 text-red-600" />
                  </div>
                  <p className="text-sm font-medium text-red-900 mb-2">Failed to Load Model</p>
                  <p className="text-xs text-red-700 mb-4">{loadError}</p>
                  <Button
                    onClick={() => {
                      setIsLoading(true);
                      setLoadError(null);
                      scriptsLoadedRef.current = false;
                      window.location.reload();
                    }}
                    className="bg-red-600 hover:bg-red-700"
                    size="sm"
                  >
                    <RefreshCw className="size-4 mr-2" />
                    Reload Page
                  </Button>
                </div>
              </div>
            )}

            {!isLoading && !loadError && (
              <div className="flex-1 flex flex-col gap-3 h-full">
                <div className={`relative bg-gradient-to-br ${isListening ? 'from-green-50 to-emerald-50 border-green-300' : 'from-gray-50 to-gray-100 border-gray-300'} border-2 rounded-lg p-3 transition-all flex-shrink-0`}>
                  <div className="text-center">
                    <div 
                      onMouseDown={handlePressStart}
                      onMouseUp={handlePressEnd}
                      onMouseLeave={handlePressEnd}
                      onTouchStart={handlePressStart}
                      onTouchEnd={handlePressEnd}
                      onTouchCancel={handlePressEnd}
                      className={`mx-auto w-20 h-20 rounded-full flex items-center justify-center mb-2 transition-all cursor-pointer select-none ${isListening ? 'bg-green-500 animate-pulse shadow-lg shadow-green-500/50 scale-110' : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-md'}`}
                    >
                      <Mic className="size-10 text-white" />
                    </div>
                    
                    {/* Live Detection Display */}
                    {isListening && lastDetection && (
                      <div className="mt-2 px-3 py-1 bg-white rounded-full border border-green-300 inline-block">
                        <p className="text-xs font-semibold text-gray-900">
                          {lastDetection} <span className="text-green-600">({(confidence * 100).toFixed(0)}%)</span>
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* All Predictions Display - Takes remaining space */}
                <div className={`bg-white rounded-lg border-2 border-gray-200 p-3 flex-1 flex-col overflow-hidden ${isListening && allPredictions.length > 0 ? 'hidden lg:flex' : 'hidden'}`}>
                  <h4 className="font-semibold text-sm text-gray-900 mb-2 flex-shrink-0">All Predictions:</h4>
                  <div className="flex-1 overflow-y-auto space-y-1.5">
                    {allPredictions.map((pred, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-2">
                        <span className="text-xs text-gray-700 truncate flex-1">{pred.label}</span>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="w-20 bg-gray-200 rounded-full h-1.5">
                            <div 
                              className="bg-purple-600 h-1.5 rounded-full transition-all"
                              style={{ width: `${pred.score * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-600 w-10 text-right font-medium">
                            {(pred.score * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Debug Info Display - Shows when product not found */}
                {debugInfo.length > 0 && (
                  <div className="bg-yellow-50 rounded-lg border-2 border-yellow-300 p-3 flex-shrink-0 max-h-[200px] overflow-y-auto">
                    <h4 className="font-semibold text-sm text-yellow-900 mb-2">🐛 Debug Info:</h4>
                    <div className="space-y-1">
                      {debugInfo.map((info, idx) => (
                        <p key={idx} className="text-xs text-yellow-800 font-mono break-all">
                          {info}
                        </p>
                      ))}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 w-full text-xs"
                      onClick={() => setDebugInfo([])}
                    >
                      Clear Debug Info
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}