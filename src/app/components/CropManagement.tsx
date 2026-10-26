import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card } from './ui/card';
import { Plus, Trash2, Sprout, ImagePlus, X } from 'lucide-react';
import { toast } from 'sonner';
import { Crop, CROPS_CHANGED, cropId, loadCrops, resizeImage, saveCrops } from '../utils/crops';

interface CropManagementProps {
  open: boolean;
  onClose: () => void;
}

const STORAGE_FULL = 'Browser storage is full. Remove some crop images and try again.';

function CropImage({ crop, className }: { crop: Pick<Crop, 'image' | 'name'>; className: string }) {
  return crop.image
    ? <img src={crop.image} alt={crop.name} className={`${className} object-cover`} />
    : (
      <div className={`${className} bg-green-50 text-green-700 flex items-center justify-center`}>
        <Sprout className="size-6" />
      </div>
    );
}

export function CropManagement({ open, onClose }: CropManagementProps) {
  const [crops, setCrops] = useState<Crop[]>([]);
  const [newName, setNewName] = useState('');
  const [newImage, setNewImage] = useState('');
  const newImageInput = useRef<HTMLInputElement>(null);
  const replaceInput = useRef<HTMLInputElement>(null);
  const [replacingId, setReplacingId] = useState<string | null>(null);

  useEffect(() => { if (open) setCrops(loadCrops()); }, [open]);

  const persist = (next: Crop[]) => {
    if (!saveCrops(next)) { toast.error(STORAGE_FULL); return false; }
    setCrops(next);
    return true;
  };

  const readImage = async (file: File | undefined) => {
    if (!file) return null;
    try { return await resizeImage(file); } catch (e: any) { toast.error(e.message); return null; }
  };

  const handleAdd = () => {
    const name = newName.trim();
    if (!name) { toast.error('Please enter a crop name'); return; }
    if (crops.some(c => c.id === cropId(name))) { toast.error(`"${name}" already exists`); return; }
    const ok = persist([...crops, { id: cropId(name), name, image: newImage, createdAt: new Date().toISOString() }]
      .sort((a, b) => a.name.localeCompare(b.name)));
    if (ok) {
      toast.success(`Crop "${name}" added`);
      setNewName('');
      setNewImage('');
    }
  };

  const handleReplaceImage = async (file: File | undefined) => {
    const image = await readImage(file);
    if (image && replacingId && persist(crops.map(c => c.id === replacingId ? { ...c, image } : c))) {
      toast.success('Crop image updated');
    }
    setReplacingId(null);
  };

  const handleDelete = (crop: Crop) => {
    if (!confirm(`Delete crop "${crop.name}"? Products tagged with it keep the tag until you edit them.`)) return;
    if (persist(crops.filter(c => c.id !== crop.id))) toast.success(`Crop "${crop.name}" deleted`);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sprout className="size-5 text-[#C7359C]" />
            Crop Management
          </DialogTitle>
          <DialogDescription>
            Create crops with an image. Products are tagged with these crops.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* Add New Crop */}
          <Card className="p-4">
            <Label className="text-sm font-semibold mb-2 block">Add New Crop</Label>
            <div className="flex gap-2 items-center">
              <button
                type="button"
                onClick={() => newImageInput.current?.click()}
                className="relative size-10 rounded-lg border-2 border-dashed border-gray-300 hover:border-[#C7359C] flex items-center justify-center overflow-hidden flex-shrink-0"
                title={newImage ? 'Change image' : 'Add image'}
              >
                {newImage ? <img src={newImage} alt="" className="size-full object-cover" /> : <ImagePlus className="size-4 text-gray-400" />}
              </button>
              <input ref={newImageInput} type="file" accept="image/*" className="hidden"
                onChange={async e => { const img = await readImage(e.target.files?.[0]); if (img) setNewImage(img); e.target.value = ''; }} />
              <Input
                placeholder="Enter crop name (e.g., Wheat, Cotton)"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
                className="flex-1"
              />
              <Button onClick={handleAdd} disabled={!newName.trim()} className="gap-2">
                <Plus className="size-4" />
                Add
              </Button>
            </div>
            {newImage && (
              <button onClick={() => setNewImage('')} className="mt-2 text-xs text-gray-500 hover:text-red-600 inline-flex items-center gap-1">
                <X className="size-3" /> Remove image
              </button>
            )}
          </Card>

          {/* Crops List */}
          <div className="flex-1 overflow-y-auto">
            <Label className="text-sm font-semibold mb-3 block">Existing Crops ({crops.length})</Label>
            <input ref={replaceInput} type="file" accept="image/*" className="hidden"
              onChange={e => { handleReplaceImage(e.target.files?.[0]); e.target.value = ''; }} />

            {crops.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Sprout className="size-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No crops yet</p>
                <p className="text-sm">Add your first crop above</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {crops.map(crop => (
                  <Card key={crop.id} className="p-3 flex flex-row items-center justify-between gap-3 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <button
                        onClick={() => { setReplacingId(crop.id); replaceInput.current?.click(); }}
                        className="relative group rounded-lg overflow-hidden flex-shrink-0"
                        title={crop.image ? 'Change image' : 'Add image'}
                      >
                        <CropImage crop={crop} className="size-12" />
                        <span className="absolute inset-0 bg-black/40 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <ImagePlus className="size-4" />
                        </span>
                      </button>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm truncate">{crop.name}</h4>
                        <p className="text-xs text-gray-500">{crop.image ? 'Click image to change' : 'No image yet'}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(crop)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 flex-shrink-0">
                      <Trash2 className="size-4" />
                    </Button>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Crop tags on a product (Shopify-style tag input) ─────────────────────────

export function CropTagInput({ value, onChange }: { value: string[]; onChange: (crops: string[]) => void }) {
  const [crops, setCrops] = useState<Crop[]>(loadCrops);
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const refresh = () => setCrops(loadCrops());
    window.addEventListener(CROPS_CHANGED, refresh);
    return () => window.removeEventListener(CROPS_CHANGED, refresh);
  }, []);

  const selected = new Set(value.map(v => v.toLowerCase()));
  const q = query.trim().toLowerCase();
  const suggestions = crops.filter(c => !selected.has(c.name.toLowerCase()) && c.name.toLowerCase().includes(q));
  const canCreate = !!q && !crops.some(c => c.name.toLowerCase() === q) && !selected.has(q);
  const options = [...suggestions.map(c => ({ kind: 'crop' as const, name: c.name })),
    ...(canCreate ? [{ kind: 'new' as const, name: query.trim() }] : [])];

  const add = (name: string, isNew: boolean) => {
    if (isNew) {
      const next = [...crops, { id: cropId(name), name, image: '', createdAt: new Date().toISOString() }]
        .sort((a, b) => a.name.localeCompare(b.name));
      if (!saveCrops(next)) { toast.error(STORAGE_FULL); return; }
      setCrops(next);
      toast.success(`Crop "${name}" created. Add an image in Manage Crops.`);
    }
    onChange([...value, name]);
    setQuery('');
    setHighlight(0);
    inputRef.current?.focus();
  };
  const remove = (name: string) => onChange(value.filter(v => v !== name));
  const cropFor = (name: string) => crops.find(c => c.name.toLowerCase() === name.toLowerCase());

  return (
    <div className="relative">
      <div
        onClick={() => inputRef.current?.focus()}
        className={`min-h-10 w-full rounded-md border bg-input-background px-2 py-1.5 flex flex-wrap items-center gap-1.5 cursor-text ${focused ? 'ring-[3px] ring-ring/50 border-ring' : ''}`}
      >
        {value.map(name => {
          const crop = cropFor(name);
          return (
            <span key={name} className="inline-flex items-center gap-1.5 rounded-full bg-green-50 border border-green-200 text-green-800 text-xs font-medium pl-1 pr-1.5 py-0.5">
              <CropImage crop={crop ?? { name, image: '' }} className="size-5 rounded-full [&>svg]:size-3" />
              {name}
              <button type="button" onClick={e => { e.stopPropagation(); remove(name); }}
                className="text-green-700 hover:text-red-600" title={`Remove ${name}`}>
                <X className="size-3" />
              </button>
            </span>
          );
        })}
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setHighlight(0); }}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          onKeyDown={e => {
            if ((e.key === 'Enter' || e.key === ',') && options.length) {
              e.preventDefault();
              const o = options[Math.min(highlight, options.length - 1)];
              add(o.name, o.kind === 'new');
            } else if (e.key === 'Backspace' && !query && value.length) {
              remove(value[value.length - 1]);
            } else if (e.key === 'ArrowDown') {
              e.preventDefault(); setHighlight(h => Math.min(h + 1, options.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault(); setHighlight(h => Math.max(h - 1, 0));
            }
          }}
          placeholder={value.length ? '' : 'Search or add crops'}
          className="flex-1 min-w-[120px] bg-transparent outline-none text-sm py-0.5"
        />
      </div>
      {focused && options.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-56 overflow-y-auto rounded-md border bg-white shadow-lg py-1">
          {options.map((o, i) => (
            <button
              key={`${o.kind}-${o.name}`}
              type="button"
              onMouseDown={e => { e.preventDefault(); add(o.name, o.kind === 'new'); }}
              onMouseEnter={() => setHighlight(i)}
              className={`w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 ${i === highlight ? 'bg-pink-50' : ''}`}
            >
              {o.kind === 'crop'
                ? <><CropImage crop={cropFor(o.name)!} className="size-6 rounded [&>svg]:size-3.5" /> {o.name}</>
                : <><Plus className="size-4 text-[#C7359C]" /> Create crop "<span className="font-medium">{o.name}</span>"</>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
