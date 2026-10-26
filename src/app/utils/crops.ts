// Crop master for the prototype. Stored in the browser because the backend has no crops endpoint yet;
// products reference crops by name in their `crops` field, which is saved with the product.

export interface Crop {
  id: string;
  name: string;
  image: string; // data URL, or '' when no image has been added
  createdAt: string;
}

const KEY = 'cropMaster';
export const CROPS_CHANGED = 'crops-changed';

const DEFAULT_CROPS = ['Wheat', 'Rice', 'Cotton', 'Maize', 'Sugarcane', 'Potato', 'Citrus', 'Mango', 'Vegetables'];

export function loadCrops(): Crop[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* fall through to defaults */ }
  const seeded = DEFAULT_CROPS.map(name => ({ id: cropId(name), name, image: '', createdAt: new Date().toISOString() }));
  try { localStorage.setItem(KEY, JSON.stringify(seeded)); } catch { /* use in memory */ }
  return seeded;
}

/** Saves the crop list. Returns false when the browser refuses (usually because images fill local storage). */
export function saveCrops(crops: Crop[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(crops));
    window.dispatchEvent(new Event(CROPS_CHANGED));
    return true;
  } catch {
    return false;
  }
}

export const cropId = (name: string) => name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');

/** Reads an image file and shrinks it so crop images stay small enough for browser storage. */
export function resizeImage(file: File, maxSize = 320): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the image'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('This file is not a supported image'));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
