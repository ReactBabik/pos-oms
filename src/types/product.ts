// Shared product and variant types across the application

export interface Batch {
  id: string;
  quantity: number;
  price: number;
  expiry: string;
}

export interface ProductVariant {
  id: string;
  name: string; // e.g., "1L", "330ML", "5KG"
  unit: string;
  price: number;
  agiCode: string;
  qrCode: string;
  batches: Batch[];
}

export interface Product {
  id: string;
  name: string;
  category: string;
  image: string;
  variants?: ProductVariant[];
  createdAt?: string;
  updatedAt?: string;
}

// Flattened variant for display (used in POS, Inventory, etc.)
export interface FlattenedVariant extends ProductVariant {
  variantId: string;
  variantName: string;
  productId: string;
  productName: string;
  category: string;
  image: string;
}