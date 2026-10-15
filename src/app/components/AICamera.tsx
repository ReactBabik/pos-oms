import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Camera, X, Loader2, CheckCircle2, Plus, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface AICameraProps {
  open: boolean;
  onClose: () => void;
  products: any[];
  onAddToCart: (product: any) => void;
}

export function AICamera({ open, onClose, products, onAddToCart }: AICameraProps) {
  const [model, setModel] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [detectedProduct, setDetectedProduct] = useState<any | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const MODEL_URL = 'https://teachablemachine.withgoogle.com/models/uTEOsG8gl/';

  // Load the model when dialog opens
  useEffect(() => {
    if (open) {
      loadModel();
    } else {
      cleanupCamera();
    }

    return () => {
      cleanupCamera();
    };
  }, [open]);

  const loadModel = async () => {
    try {
      setIsLoading(true);
      
      // Dynamic import of Teachable Machine library
      const tmImage = await import('@teachablemachine/image');
      
      // Normal load (uses browser cache)
      const modelURL = MODEL_URL + 'model.json';
      const metadataURL = MODEL_URL + 'metadata.json';
      
      const loadedModel = await tmImage.load(modelURL, metadataURL);
      setModel(loadedModel);
      
      // Start camera after model loads
      await startCamera();
      
      toast.success('AI Model loaded successfully!');
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading AI model:', error);
      toast.error('Failed to load AI model. This feature requires additional libraries.');
      setIsLoading(false);
      // Close dialog after a delay if model fails to load
      setTimeout(() => onClose(), 2000);
    }
  };

  const reloadModelFresh = async () => {
    try {
      // Stop current scanning
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      
      setIsLoading(true);
      toast.info('Clearing cache and reloading model...');
      
      // Dynamic import of Teachable Machine library
      const tmImage = await import('@teachablemachine/image');
      
      // Add cache-busting timestamp to force reload of updated model
      const timestamp = new Date().getTime();
      const modelURL = MODEL_URL + 'model.json?v=' + timestamp;
      const metadataURL = MODEL_URL + 'metadata.json?v=' + timestamp;
      
      const loadedModel = await tmImage.load(modelURL, metadataURL);
      setModel(loadedModel);
      
      // Restart scanning
      startPredictionLoop();
      
      toast.success('Model reloaded with latest changes!');
      setIsLoading(false);
    } catch (error) {
      console.error('Error reloading AI model:', error);
      toast.error('Failed to reload AI model');
      setIsLoading(false);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: 640, height: 480 }
      });
      
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        
        // Start scanning once video is playing
        setIsScanning(true);
        startPredictionLoop();
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast.error('Could not access camera. Please grant camera permissions.');
    }
  };

  const cleanupCamera = () => {
    setIsScanning(false);
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setPredictions([]);
    setDetectedProduct(null);
  };

  const startPredictionLoop = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    intervalRef.current = setInterval(() => {
      predictFromVideo();
    }, 1000); // Predict every second
  };

  const predictFromVideo = async () => {
    if (!model || !videoRef.current) return;
    
    try {
      const predictions = await model.predict(videoRef.current);
      setPredictions(predictions);
      
      // Find the highest confidence prediction
      const sorted = predictions.sort((a, b) => b.probability - a.probability);
      const topPrediction = sorted[0];
      
      // If confidence is above 75% and it's not "Unknown" or "Background"
      if (topPrediction.probability > 0.75 && 
          topPrediction.className.toLowerCase() !== 'unknown' &&
          topPrediction.className.toLowerCase() !== 'background') {
        
        // Try to match with products
        const matchedProduct = findMatchingProduct(topPrediction.className);
        
        if (matchedProduct && matchedProduct.id !== detectedProduct?.id) {
          setDetectedProduct(matchedProduct);
          toast.success(`Detected: ${matchedProduct.name}`, {
            icon: <Camera className="size-4" />
          });
        }
      }
    } catch (error) {
      console.error('Error making prediction:', error);
    }
  };

  const findMatchingProduct = (className: string) => {
    const normalized = className.toLowerCase().trim();
    
    return products.find(product => {
      const productName = product.name.toLowerCase();
      const productCategory = product.category?.toLowerCase() || '';
      
      // Check if className matches product name or category
      return productName.includes(normalized) || 
             normalized.includes(productName) ||
             productCategory.includes(normalized) ||
             normalized.includes(productCategory);
    });
  };

  const handleAddToCart = () => {
    if (detectedProduct) {
      onAddToCart(detectedProduct);
      toast.success(`${detectedProduct.name} added to cart!`, {
        icon: <CheckCircle2 className="size-4 text-green-600" />
      });
      
      // Reset detected product
      setDetectedProduct(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl flex items-center gap-2">
                <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-2 rounded-lg">
                  <Camera className="size-6 text-white" />
                </div>
                AI Product Scanner
              </DialogTitle>
              <DialogDescription>
                Point your camera at a product to automatically detect and add it to cart
              </DialogDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="rounded-full"
            >
              <X className="size-5" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Camera Feed */}
          <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
                <div className="text-center text-white">
                  <Loader2 className="size-12 animate-spin mx-auto mb-3" />
                  <p className="text-lg font-medium">Loading AI Model...</p>
                  <p className="text-sm text-gray-400">This may take a few moments</p>
                </div>
              </div>
            )}
            
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              autoPlay
              muted
            />
            
            {/* Scanning indicator */}
            {isScanning && !isLoading && (
              <div className="absolute top-4 left-4 right-4 flex justify-between items-start">
                <Badge className="bg-green-500 text-white animate-pulse">
                  <div className="size-2 bg-white rounded-full mr-2 animate-ping" />
                  Scanning...
                </Badge>
                
                {detectedProduct && (
                  <Badge className="bg-blue-500 text-white">
                    Product Detected!
                  </Badge>
                )}
              </div>
            )}
            
            {/* Reload Model Button */}
            {!isLoading && (
              <div className="absolute bottom-4 right-4">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={reloadModelFresh}
                  className="bg-white/90 hover:bg-white shadow-lg"
                  title="Reload AI Model (Use this if you've updated the model)"
                >
                  <RefreshCw className="size-4 mr-2" />
                  Reload Model
                </Button>
              </div>
            )}
          </div>

          {/* Predictions Display */}
          {predictions.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <span className="bg-purple-100 text-purple-600 px-2 py-1 rounded text-sm">
                  AI Confidence
                </span>
              </h3>
              <div className="space-y-2">
                {predictions
                  .sort((a, b) => b.probability - a.probability)
                  .slice(0, 3)
                  .map((prediction, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <div className="flex-1 bg-white rounded-lg p-2 border">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-medium text-gray-900">
                            {prediction.className}
                          </span>
                          <span className="text-sm font-bold text-purple-600">
                            {(prediction.probability * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              prediction.probability > 0.75
                                ? 'bg-green-500'
                                : prediction.probability > 0.50
                                ? 'bg-yellow-500'
                                : 'bg-red-500'
                            }`}
                            style={{ width: `${prediction.probability * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Detected Product Card */}
          {detectedProduct && (
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-300 rounded-lg p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="size-5 text-green-600" />
                    <h3 className="font-bold text-lg text-gray-900">
                      Product Matched!
                    </h3>
                  </div>
                  
                  <div className="space-y-1 mb-3">
                    <p className="text-sm text-gray-600">
                      <span className="font-semibold">Name:</span> {detectedProduct.name}
                    </p>
                    <p className="text-sm text-gray-600">
                      <span className="font-semibold">Category:</span> {detectedProduct.category}
                    </p>
                    <p className="text-sm text-gray-600">
                      <span className="font-semibold">Price:</span> PKR {detectedProduct.defaultPrice?.toLocaleString()}
                    </p>
                  </div>
                  
                  <Button
                    onClick={handleAddToCart}
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                  >
                    <Plus className="size-4 mr-2" />
                    Add to Cart
                  </Button>
                </div>
                
                {detectedProduct.image && (
                  <div className="w-24 h-24 rounded-lg overflow-hidden border-2 border-white shadow-md flex-shrink-0">
                    <img
                      src={detectedProduct.image}
                      alt={detectedProduct.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
              📸 How to use:
            </h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Point your camera at a product</li>
              <li>• Wait for the AI to detect it (75%+ confidence)</li>
              <li>• Click "Add to Cart" when a product is matched</li>
              <li>• The system will continuously scan for products</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}