import { useState, useEffect } from 'react';
import {
  Warehouse,
  CreditCard,
  Users,
  BarChart3,
  ClipboardList,
  Box,
  Gift,
  Building2,
  Settings,
  Package,
  Wifi,
} from 'lucide-react';
import type { Language } from '../App';
import { translations } from '../App';

interface AdminHomeProps {
  language: Language;
  onNavigate: (tab: string) => void;
}

// Mock data – will be replaced by real Supabase data
const mockRecentOrders = [
  { id: '1', customer: 'Sarang', initials: 'S', color: '#6366f1', time: '2 days ago', items: 1, total: 2500, status: 'Paid' },
  { id: '2', customer: 'Sarang', initials: 'S', color: '#6366f1', time: '2 days ago', items: 1, total: 2500, status: 'Paid' },
  { id: '3', customer: 'HAMEED ULLAH BHATI', initials: 'HU', color: '#8b5cf6', time: '2 days ago', items: 1, total: 3900, status: 'Paid' },
  { id: '4', customer: 'HAMEED ULLAH BHATI', initials: 'HU', color: '#8b5cf6', time: '2 days ago', items: 1, total: 3900, status: 'Paid' },
  { id: '5', customer: 'HAMEED ULLAH BHATI', initials: 'HU', color: '#f59e0b', time: '3 days ago', items: 3, total: 5650, status: 'Paid' },
];

const mockLowStock = [
  { id: '1', name: 'CRUISER 100 ML', unit: '100 ML', qty: 0 },
  { id: '2', name: 'DUAL GOLD 960 EC 800 ML', unit: '800 ML', qty: 0 },
  { id: '3', name: 'Machine 20', unit: 'L', qty: 0 },
  { id: '4', name: 'chloripyrifoss 1L', unit: 'L', qty: 0 },
  { id: '5', name: 'chloripyrifoss 1l', unit: 'L', qty: 0 },
];

const moduleCards = [
  { tab: 'orders',    icon: ClipboardList, labelEn: 'Online Orders',  labelUr: 'آن لائن آرڈرز'      },
  { tab: 'inventory', icon: Warehouse, labelEn: 'Inventory',  labelUr: 'سٹاک'       },
  { tab: 'credit',    icon: CreditCard, labelEn: 'Khata',      labelUr: 'کھاتہ'      },
  { tab: 'customers', icon: Users,      labelEn: 'Customers',  labelUr: 'گاہک'       },
  { tab: 'sales',     icon: BarChart3,  labelEn: 'Reports',    labelUr: 'رپورٹس'     },
  { tab: 'product',   icon: Box,        labelEn: 'Products',   labelUr: 'پروڈکٹس'   },
  { tab: 'franchises',icon: Building2,  labelEn: 'Franchises', labelUr: 'فرنچائزز'  },
];

export function AdminHome({ language, onNavigate }: AdminHomeProps) {
  const t = (key: string) => translations[language][key] || key;
  const isRtl = language === 'ur';

  const todaySales = 0;
  const todayOrders = 0;

  const greeting = language === 'ur' ? 'السلام عليكم !Salaam' : 'Salaam! السلام عليكم';

  return (
    <div className="min-h-full bg-gray-50 pb-6" dir={isRtl ? 'rtl' : 'ltr'}>

      {/* Hero Banner — no top bar; settings icon top-right */}
      <div className="bg-gradient-to-r from-[#FFD700] to-[#FFC200] px-6 py-5 relative">
        {/* Settings icon top-right */}
        <button
          onClick={() => onNavigate('settings')}
          className="absolute top-4 right-4 bg-white/30 hover:bg-white/50 rounded-full p-2 transition-colors"
          title="Settings"
        >
          <Settings className="size-5 text-gray-800" />
        </button>

        <div className="flex items-center gap-2 mb-1">
          <Wifi className="size-4 text-green-700" />
          <span className="text-xs font-semibold text-green-800 bg-green-100 px-2 py-0.5 rounded-full">Online</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">{greeting}</h1>
        <p className="text-sm font-medium text-gray-700 mt-0.5">Naya Savera Agro Store</p>
        <p className="text-xs text-gray-600">Pakistan</p>
      </div>

      {/* Module Cards Grid */}
      <div className="px-4 mt-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {moduleCards.map(({ tab, icon: Icon, labelEn, labelUr }) => (
            <button
              key={tab}
              onClick={() => onNavigate(tab)}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-4 flex items-center gap-4 hover:shadow-md hover:border-[#C7359C]/30 hover:bg-pink-50/30 transition-all text-left group"
            >
              <div className="bg-pink-50 group-hover:bg-pink-100 rounded-xl p-3 transition-colors">
                <Icon className="size-5 text-[#C7359C]" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">{labelEn}</p>
                <p className="text-xs text-gray-400">{labelUr}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Bottom Two-Column Section */}
      <div className="px-4 mt-5 grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Recent Sales */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Recent Sales</h2>
            <button
              onClick={() => onNavigate('sales')}
              className="text-sm font-medium text-[#C7359C] hover:underline"
            >
              View all
            </button>
          </div>

          <div className="space-y-3">
            {mockRecentOrders.map((order) => (
              <div key={order.id} className="flex items-center gap-3">
                <div
                  className="size-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                  style={{ backgroundColor: order.color }}
                >
                  {order.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{order.customer}</p>
                  <p className="text-xs text-gray-400">{order.time} · {order.items} item{order.items !== 1 ? 's' : ''}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-semibold text-gray-900">Rs {order.total.toLocaleString()}</p>
                  <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                    {order.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Low Stock Alerts</h2>
            <span className="bg-red-500 text-white text-xs font-bold rounded-full size-5 flex items-center justify-center">
              {mockLowStock.length}
            </span>
          </div>

          <div className="space-y-3">
            {mockLowStock.map((item) => (
              <div key={item.id} className="flex items-center gap-3">
                <div className="bg-red-50 rounded-lg p-2 flex-shrink-0">
                  <Package className="size-4 text-red-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                  <p className="text-xs text-gray-400">{item.qty} {item.unit} left</p>
                </div>
                <span className="size-2 rounded-full bg-red-500 flex-shrink-0" />
              </div>
            ))}
          </div>

          <button
            onClick={() => onNavigate('inventory')}
            className="mt-4 w-full text-center text-sm text-[#C7359C] font-medium hover:underline"
          >
            Manage Inventory →
          </button>
        </div>
      </div>
    </div>
  );
}
