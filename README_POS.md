# Syngenta POS System

A comprehensive Point of Sale (POS) system designed for agricultural product retailers with multi-language support (English/Urdu), inventory management, credit tracking, and real-time analytics.

## Features Implemented

### 1. **POS (Point of Sales)**
- **Language Switching**: Toggle between English and Urdu with RTL support
- **Product Selection**: 
  - Visual product grid with search functionality
  - Quick add to cart with one click
  - Barcode/QR scanner support (UI ready)
- **FEFO (First Expiry First Out)**: Automatic batch selection based on expiry date
- **Cart Management**:
  - Add/remove products
  - Adjust quantities
  - View batch details and expiry dates
  - Real-time total calculation
- **Customer Data Capture**:
  - Customer name (required)
  - Phone number (required)
  - Village/location
- **Payment Methods**:
  - Cash payment
  - Credit (Khaata) payment
- **Receipt Generation**:
  - Detailed invoice with all items
  - Batch information
  - Customer details
  - Print-ready format

### 2. **Inventory Management**
- **Real-time Stock Tracking**:
  - Product-wise inventory
  - Batch-wise tracking with expiry dates
  - SKU management
- **Stock Alerts**:
  - Low stock warnings
  - Expiring soon notifications (60-day threshold)
  - Visual indicators for stock status
- **Inventory Dashboard**:
  - Total inventory value
  - Product count
  - Low stock items count
- **Batch Management**:
  - Multiple batches per product
  - Individual batch pricing
  - Expiry date tracking
  - Received date tracking

### 3. **Sales Dashboard & Analytics**
- **KPI Cards**:
  - Today's sales
  - Weekly sales total
  - Total transactions
  - Unique customers
- **Sales Trend Chart**: Daily sales visualization
- **Category Distribution**: Pie chart showing sales by product category
- **Top Selling Products**: Bar chart with revenue breakdown
- **Recent Transactions**: Real-time transaction list

### 4. **Credit Management (Khaata)**
- **Customer Credit Accounts**:
  - Credit limit management
  - Current balance tracking
  - Overdue amount monitoring
  - Payment history
  - Transaction ledger
- **Arthi (Agent) Management**:
  - Separate credit tracking for agents
  - Multiple customer management per arthi
  - Credit limit and balance tracking
- **Payment Processing**:
  - Receive payments
  - Update balances
  - Transaction recording
- **Credit Status Indicators**:
  - Good/Medium/High risk classification
  - Overdue alerts
  - Available credit calculation

## Technical Features

### User Experience
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Clean Interface**: Simple, easy-to-use design
- **Visual Feedback**: Toast notifications for all actions
- **Modal Dialogs**: Streamlined checkout and payment flows

### Data Management
- **Mock Data**: Currently using sample data for demonstration
- **Supabase Ready**: Backend connection established for production use
- **Real-time Updates**: State management for instant UI updates
- **FEFO Algorithm**: Automatic batch selection based on expiry dates

### Component Architecture
- Modular component design
- Reusable UI components from shadcn/ui
- Type-safe with TypeScript
- Clean separation of concerns

## Technology Stack

- **Frontend**: React 18, TypeScript
- **UI Framework**: Tailwind CSS v4, shadcn/ui components
- **Charts**: Recharts for data visualization
- **Icons**: Lucide React
- **Notifications**: Sonner toast library
- **Backend Ready**: Supabase integration
- **Build Tool**: Vite

## Next Steps for Production

### Backend Integration
1. **Supabase Setup**:
   - Create database tables for products, inventory, customers, sales, credit
   - Set up Row Level Security (RLS)
   - Configure real-time subscriptions
   
2. **Key Tables Needed**:
   - `products`: Product master data
   - `batches`: Batch inventory with expiry
   - `customers`: Customer information
   - `sales`: Transaction records
   - `credit_ledger`: Credit transactions
   - `arthis`: Agent/arthi information

3. **API Integration**:
   - SAP integration for stock receiving
   - SMS/WhatsApp API for receipts
   - Payment gateway integration

### Additional Features to Implement
1. **Barcode/QR Scanning**: Integrate camera/scanner hardware
2. **Offline Mode**: Service worker for offline transactions
3. **Voice Input**: Speech recognition for invoice creation
4. **Print Integration**: Connect to thermal printers
5. **User Authentication**: Login system for different roles
6. **Discount Module**: Vouchers, promotions, buy X get Y
7. **Returns/Refunds**: Process return transactions
8. **Reporting**: Exportable reports in PDF/Excel

### Business Logic
1. **Credit Limits**: Enforcement and alerts
2. **Late Fees**: Automatic calculation
3. **Stock Alerts**: Email/SMS notifications
4. **Inventory Sync**: Real-time updates across all sellers
5. **Multi-tenant**: Separate data for each franchisee

## Usage

### Running the Application
```bash
npm install
npm run dev
```

### Main Workflows

#### Making a Sale
1. Select "POS" tab
2. Search for products or click to add
3. Adjust quantities in cart
4. Click "Checkout"
5. Enter customer details
6. Select payment method (Cash/Credit)
7. Complete sale
8. Print receipt

#### Managing Inventory
1. Select "Inventory" tab
2. View all products with batch details
3. Monitor stock levels and expiry dates
4. Check low stock alerts

#### Viewing Sales Analytics
1. Select "Sales" tab
2. Review KPI cards for quick insights
3. Analyze trends with charts
4. Check recent transactions

#### Managing Credit
1. Select "Credit" tab
2. View customer or arthi accounts
3. Check balances and overdue amounts
4. Process payments

## Notes

- Currently using mock data for demonstration
- UI supports RTL for Urdu language
- All prices in PKR (Pakistani Rupees)
- FEFO algorithm ensures oldest stock sells first
- Responsive design works on all screen sizes

## Support

For support and further customization, please contact the development team.
