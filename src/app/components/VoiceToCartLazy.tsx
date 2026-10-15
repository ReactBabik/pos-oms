import { lazy, Suspense } from 'react';
import { Dialog, DialogContent } from './ui/dialog';
import { Loader2, AlertCircle } from 'lucide-react';
import { Button } from './ui/button';

// Lazy load the VoiceToCartExternal component (CDN-based, no npm packages)
const VoiceToCartExternal = lazy(() => 
  import('./VoiceToCartExternal')
    .then(module => ({ default: module.VoiceToCartExternal }))
    .catch(error => {
      console.error('Failed to load VoiceToCartExternal:', error);
      // Return a fallback error component
      return {
        default: ({ open, onClose }: any) => (
          <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-md">
              <div className="flex flex-col items-center justify-center py-8">
                <AlertCircle className="size-12 text-red-500 mb-3" />
                <p className="text-lg font-semibold text-gray-900 mb-2">Failed to Load Voice Recognition</p>
                <p className="text-sm text-gray-600 text-center mb-4">
                  There was an error loading the voice recognition module. Please try again.
                </p>
                <Button onClick={onClose}>Close</Button>
              </div>
            </DialogContent>
          </Dialog>
        )
      };
    })
);

interface VoiceToCartLazyProps {
  open: boolean;
  onClose: () => void;
  products: any[];
  onAddToCart: (product: any) => void;
  cart: any[];
  onRemoveFromCart?: (productId: string, batchId: string) => void;
  onUpdateQuantity?: (productId: string, batchId: string, newQuantity: number) => void;
  onCheckout?: () => void;
}

export function VoiceToCartLazy({ open, onClose, products, onAddToCart, cart, onRemoveFromCart, onUpdateQuantity, onCheckout }: VoiceToCartLazyProps) {
  if (!open) return null;

  return (
    <Suspense
      fallback={
        <Dialog open={open} onOpenChange={onClose}>
          <DialogContent className="max-w-2xl">
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Loader2 className="size-12 animate-spin mx-auto mb-3 text-purple-600" />
                <p className="text-lg font-medium text-gray-900">Loading Voice Recognition...</p>
                <p className="text-sm text-gray-600">This may take a moment</p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      }
    >
      <VoiceToCartExternal
        open={open}
        onClose={onClose}
        products={products}
        onAddToCart={onAddToCart}
        cart={cart}
        onRemoveFromCart={onRemoveFromCart}
        onUpdateQuantity={onUpdateQuantity}
        onCheckout={onCheckout}
      />
    </Suspense>
  );
}