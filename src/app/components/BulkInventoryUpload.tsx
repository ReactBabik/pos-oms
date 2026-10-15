import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Card, CardContent } from './ui/card';
import { Upload, Download, FileSpreadsheet, CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_URL = `https://${projectId}.supabase.co/functions/v1/make-server-77be783d`;

interface BulkInventoryUploadProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  totalRows: number;
  validRows: number;
}

export function BulkInventoryUpload({ isOpen, onClose, onSuccess }: BulkInventoryUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string>('');

  // Download CSV template
  const downloadTemplate = async () => {
    try {
      // Fetch all products from the backend
      const response = await fetch(`${API_URL}/products`, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch products');
      }

      const result = await response.json();
      const products = result.products || [];

      console.log('Products fetched for template:', products); // Debug log

      // Build CSV with header row
      const csvRows = [
        ['AGI Code', 'Product Name*', 'Category*', 'Variant Name', 'Variant Size*', 'Variant Unit*', 'Batch ID*', 'Quantity*', 'Price*', 'Expiry Date*', 'Barcode', 'QR Code']
      ];

      // If there are products, add them to the CSV
      if (products.length > 0) {
        products.forEach((product: any) => {
          console.log('Processing product:', product.name, 'AGI Code:', product.agiCode); // Debug log
          
          if (product.variants && product.variants.length > 0) {
            // For each variant, add a row
            product.variants.forEach((variant: any) => {
              const agiCode = variant.agiCode || ''; // AGI code is at variant level
              const productName = product.name || '';
              const category = product.category || '';
              const variantName = variant.name || '';
              const variantSize = variant.size || '';
              const variantUnit = variant.unit || '';
              const price = variant.price || '';
              const barcode = variant.barcode || '';
              const qrCode = variant.qrCode || '';
              
              // Add a row with empty batch information for user to fill
              csvRows.push([
                agiCode,
                productName,
                category,
                variantName,
                variantSize.toString(),
                variantUnit,
                '', // Empty batch ID - user will fill this
                '', // Empty quantity - user will fill this
                price.toString(),
                '', // Empty expiry date - user will fill this
                barcode,
                qrCode
              ]);
            });
          }
        });
      } else {
        // If no products exist, add sample rows
        csvRows.push(
          ['AGI-001', 'ACANTO PLUS 300SC', 'Fungicide', '', '1', 'L', 'BATCH001', '50', '2500', '2025-12-31', '8901234567890', 'QR-ACANTO-001'],
          ['AGI-002', 'AXIAL XL 050 EC', 'Herbicide', '330 ML', '330', 'ML', 'BATCH002', '100', '450', '2025-06-30', '8901234567891', 'QR-AXIAL-002'],
          ['AGI-002', 'AXIAL XL 050 EC', 'Herbicide', '1 L', '1', 'L', 'BATCH003', '50', '1650', '2025-06-30', '8901234567892', 'QR-AXIAL-003'],
          ['AGI-003', 'AMPLIGO 150ZC', 'Insecticide', '', '1', 'L', 'BATCH004', '40', '3200', '2025-08-15', '8901234567893', 'QR-AMPLIGO-004']
        );
      }

      // Convert to CSV format
      const csvContent = csvRows.map(row => 
        row.map(cell => `"${cell}"`).join(',')
      ).join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', `inventory_template_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      if (products.length > 0) {
        toast.success(`Template with ${products.length} product(s) downloaded successfully`);
      } else {
        toast.success('Sample template downloaded successfully');
      }
    } catch (error) {
      console.error('Error downloading template:', error);
      toast.error('Failed to download template. Please try again.');
    }
  };

  // Parse CSV file
  const parseCSV = (text: string): string[][] => {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentCell = '';
    let insideQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          currentCell += '"';
          i++; // Skip next quote
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === ',' && !insideQuotes) {
        currentRow.push(currentCell.trim());
        currentCell = '';
      } else if ((char === '\n' || char === '\r') && !insideQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i++; // Skip \n in \r\n
        }
        if (currentCell || currentRow.length > 0) {
          currentRow.push(currentCell.trim());
          if (currentRow.some(cell => cell !== '')) {
            rows.push(currentRow);
          }
          currentRow = [];
          currentCell = '';
        }
      } else {
        currentCell += char;
      }
    }

    // Add last cell and row if exists
    if (currentCell || currentRow.length > 0) {
      currentRow.push(currentCell.trim());
      if (currentRow.some(cell => cell !== '')) {
        rows.push(currentRow);
      }
    }

    return rows;
  };

  // Validate CSV data
  const validateCSV = (rows: string[][]): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];
    let validRows = 0;

    if (rows.length < 2) {
      errors.push('File must contain at least a header row and one data row');
      return { valid: false, errors, warnings, totalRows: 0, validRows: 0 };
    }

    const header = rows[0];
    const expectedColumns = ['AGI Code*', 'Product Name*', 'Category*', 'Variant Name', 'Variant Size*', 'Variant Unit*', 'Batch ID*', 'Quantity*', 'Price*', 'Expiry Date*', 'Barcode', 'QR Code'];
    
    // Validate header
    const headerValid = expectedColumns.every((col, idx) => 
      header[idx]?.toLowerCase().includes(col.toLowerCase().replace('*', ''))
    );

    if (!headerValid) {
      errors.push('Invalid header format. Please use the provided template.');
      return { valid: false, errors, warnings, totalRows: rows.length - 1, validRows: 0 };
    }

    // Validate each data row
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1;
      let rowValid = true;

      // Check required fields (AGI Code is optional, skip row[0])
      if (!row[1] || row[1].trim() === '') {
        errors.push(`Row ${rowNum}: Product Name is required`);
        rowValid = false;
      }
      if (!row[2] || row[2].trim() === '') {
        errors.push(`Row ${rowNum}: Category is required`);
        rowValid = false;
      }
      if (!row[4] || row[4].trim() === '') {
        errors.push(`Row ${rowNum}: Variant Size is required`);
        rowValid = false;
      }
      if (!row[5] || row[5].trim() === '') {
        errors.push(`Row ${rowNum}: Variant Unit is required`);
        rowValid = false;
      }
      if (!row[6] || row[6].trim() === '') {
        errors.push(`Row ${rowNum}: Batch ID is required`);
        rowValid = false;
      }
      if (!row[7] || row[7].trim() === '') {
        errors.push(`Row ${rowNum}: Quantity is required`);
        rowValid = false;
      } else {
        const qty = parseFloat(row[7]);
        if (isNaN(qty) || qty < 0) {
          errors.push(`Row ${rowNum}: Quantity must be a valid positive number`);
          rowValid = false;
        }
      }
      if (!row[8] || row[8].trim() === '') {
        errors.push(`Row ${rowNum}: Price is required`);
        rowValid = false;
      } else {
        const price = parseFloat(row[8]);
        if (isNaN(price) || price <= 0) {
          errors.push(`Row ${rowNum}: Price must be a valid positive number`);
          rowValid = false;
        }
      }
      if (!row[9] || row[9].trim() === '') {
        errors.push(`Row ${rowNum}: Expiry Date is required`);
        rowValid = false;
      } else {
        const expiryDate = new Date(row[9]);
        if (isNaN(expiryDate.getTime())) {
          errors.push(`Row ${rowNum}: Expiry Date must be in valid format (YYYY-MM-DD)`);
          rowValid = false;
        } else if (expiryDate < new Date()) {
          warnings.push(`Row ${rowNum}: Expiry Date is in the past`);
        }
      }

      if (rowValid) {
        validRows++;
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      totalRows: rows.length - 1,
      validRows
    };
  };

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Check file type
    const validTypes = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    const fileName = selectedFile.name.toLowerCase();
    
    if (!validTypes.includes(selectedFile.type) && !fileName.endsWith('.csv') && !fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
      toast.error('Please upload a CSV or Excel file');
      return;
    }

    // For Excel files, show a message to save as CSV
    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      toast.info('Please save your Excel file as CSV format before uploading');
      return;
    }

    setFile(selectedFile);
    setValidationResult(null);
    setUploadProgress('');
  };

  // Validate file
  const handleValidate = async () => {
    if (!file) {
      toast.error('Please select a file first');
      return;
    }

    setUploadProgress('Validating file...');

    try {
      const text = await file.text();
      const rows = parseCSV(text);
      const result = validateCSV(rows);
      
      setValidationResult(result);
      
      if (result.valid) {
        toast.success(`Validation successful! ${result.validRows} rows ready to upload`);
      } else {
        toast.error(`Validation failed with ${result.errors.length} error(s)`);
      }
    } catch (error) {
      console.error('Validation error:', error);
      toast.error('Failed to validate file');
    }

    setUploadProgress('');
  };

  // Upload and process file
  const handleUpload = async () => {
    if (!file || !validationResult?.valid) {
      toast.error('Please validate the file first');
      return;
    }

    setUploading(true);
    setUploadProgress('Processing file...');

    try {
      const text = await file.text();
      const rows = parseCSV(text);
      
      // Skip header row
      const dataRows = rows.slice(1);
      
      // Fetch all existing products first
      setUploadProgress('Fetching existing products...');
      const response = await fetch(`${API_URL}/products`, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch existing products');
      }

      const result = await response.json();
      const existingProducts = result.products || [];

      // Process each row and match to existing products
      const inventoryUpdates: any[] = [];
      const unmatchedRows: string[] = [];

      dataRows.forEach((row, index) => {
        const agiCode = row[0].trim();
        const productName = row[1].trim();
        const category = row[2].trim();
        const variantName = row[3]?.trim() || '';
        const variantSize = parseFloat(row[4]);
        const variantUnit = row[5].trim();
        const batchId = row[6].trim();
        const quantity = parseFloat(row[7]);
        const price = parseFloat(row[8]);
        const expiryDate = row[9].trim();

        // Find matching product and variant
        let matchedProduct = null;
        let matchedVariant = null;

        for (const product of existingProducts) {
          if (product.name.toLowerCase() === productName.toLowerCase() && 
              product.category.toLowerCase() === category.toLowerCase()) {
            
            // Find matching variant
            for (const variant of product.variants || []) {
              // Match by AGI code if available
              if (agiCode && variant.agiCode === agiCode) {
                matchedProduct = product;
                matchedVariant = variant;
                break;
              }
              // Otherwise match by size, unit, and name
              else if (!agiCode && 
                       variant.size === variantSize && 
                       variant.unit.toLowerCase() === variantUnit.toLowerCase() &&
                       (variantName === '' || variant.name.toLowerCase() === variantName.toLowerCase())) {
                matchedProduct = product;
                matchedVariant = variant;
                break;
              }
            }
            
            if (matchedVariant) break;
          }
        }

        if (matchedProduct && matchedVariant) {
          // Add to inventory updates
          inventoryUpdates.push({
            productId: matchedProduct.id,
            productName: matchedProduct.name,
            variantId: matchedVariant.id,
            variantName: matchedVariant.name,
            batchId: batchId,
            quantity: quantity,
            price: price,
            expiry: expiryDate
          });
        } else {
          unmatchedRows.push(`Row ${index + 2}: ${productName} - ${variantName || variantSize + ' ' + variantUnit} (not found)`);
        }
      });

      if (unmatchedRows.length > 0) {
        console.warn('Unmatched rows:', unmatchedRows);
        toast.error(`${unmatchedRows.length} row(s) could not be matched to existing products. Check console for details.`);
        console.log('Unmatched rows details:', unmatchedRows);
      }

      if (inventoryUpdates.length === 0) {
        throw new Error('No matching products found. Please ensure products exist before uploading inventory.');
      }

      setUploadProgress(`Adding ${inventoryUpdates.length} batch(es) to inventory...`);

      // Group updates by product
      const productGroups = new Map<string, any[]>();
      inventoryUpdates.forEach(update => {
        if (!productGroups.has(update.productId)) {
          productGroups.set(update.productId, []);
        }
        productGroups.get(update.productId)!.push(update);
      });

      // Send inventory updates to backend
      let successCount = 0;
      let errorCount = 0;

      for (const [productId, batches] of productGroups.entries()) {
        try {
          const productName = batches[0].productName;
          const inventoryResponse = await fetch(`${API_URL}/inventory/add`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${publicAnonKey}`
            },
            body: JSON.stringify({ 
              productId, 
              productName,
              batches 
            })
          });

          const inventoryResult = await inventoryResponse.json();

          if (!inventoryResult.success) {
            console.error(`Failed to add inventory for product ${productId}:`, inventoryResult.error);
            errorCount++;
          } else {
            successCount++;
          }
        } catch (error) {
          console.error(`Error adding inventory for product ${productId}:`, error);
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`Successfully added ${inventoryUpdates.length} batch(es) to ${successCount} product(s)!`);
      }
      
      if (errorCount > 0) {
        toast.warning(`${errorCount} product(s) failed to update. Check console for details.`);
      }

      setFile(null);
      setValidationResult(null);
      setUploadProgress('');
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload inventory: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setUploading(false);
      setUploadProgress('');
    }
  };

  const handleClose = () => {
    if (!uploading) {
      setFile(null);
      setValidationResult(null);
      setUploadProgress('');
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-[#C7359C] flex items-center gap-2">
            <FileSpreadsheet className="size-6" />
            Bulk Inventory Upload
          </DialogTitle>
          <DialogDescription>
            Upload multiple products and batches using a CSV file
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Step 1: Download Template */}
          <Card className="border-2 border-purple-200">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#C7359C] text-white flex items-center justify-center font-bold">
                  1
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-2">Download Template</h3>
                  <p className="text-sm text-gray-600 mb-3">
                    Download the CSV template and fill in your inventory data
                  </p>
                  <Button
                    onClick={downloadTemplate}
                    variant="outline"
                    className="gap-2 border-[#C7359C] text-[#C7359C] hover:bg-purple-50"
                  >
                    <Download className="size-4" />
                    Download Template
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Step 2: Upload File */}
          <Card className="border-2 border-purple-200">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#C7359C] text-white flex items-center justify-center font-bold">
                  2
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-2">Upload Filled CSV</h3>
                  <p className="text-sm text-gray-600 mb-3">
                    Select your filled CSV file to upload
                  </p>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Label
                        htmlFor="csv-upload"
                        className="cursor-pointer px-4 py-2 bg-white border-2 border-[#C7359C] text-[#C7359C] rounded-lg hover:bg-purple-50 transition-colors flex items-center gap-2 font-semibold"
                      >
                        <Upload className="size-4" />
                        Choose File
                      </Label>
                      <input
                        id="csv-upload"
                        type="file"
                        accept=".csv"
                        onChange={handleFileChange}
                        className="hidden"
                        disabled={uploading}
                      />
                      {file && (
                        <span className="text-sm text-gray-700 font-medium">{file.name}</span>
                      )}
                    </div>
                    {file && !validationResult && (
                      <Button
                        onClick={handleValidate}
                        disabled={uploading}
                        className="bg-[#C7359C] hover:bg-purple-700 gap-2"
                      >
                        <CheckCircle2 className="size-4" />
                        Validate File
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Validation Results */}
          {validationResult && (
            <Card className={`border-2 ${validationResult.valid ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'}`}>
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    {validationResult.valid ? (
                      <CheckCircle2 className="size-8 text-green-600" />
                    ) : (
                      <XCircle className="size-8 text-red-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-2">
                      {validationResult.valid ? 'Validation Passed' : 'Validation Failed'}
                    </h3>
                    <div className="space-y-2 text-sm">
                      <p>
                        <span className="font-semibold">Total Rows:</span> {validationResult.totalRows}
                      </p>
                      <p>
                        <span className="font-semibold">Valid Rows:</span> {validationResult.validRows}
                      </p>
                      
                      {validationResult.errors.length > 0 && (
                        <div className="mt-3">
                          <p className="font-semibold text-red-700 mb-1">Errors:</p>
                          <ul className="list-disc list-inside space-y-1 text-red-600 max-h-40 overflow-y-auto">
                            {validationResult.errors.slice(0, 10).map((error, idx) => (
                              <li key={idx}>{error}</li>
                            ))}
                            {validationResult.errors.length > 10 && (
                              <li className="text-red-700 font-semibold">
                                ... and {validationResult.errors.length - 10} more error(s)
                              </li>
                            )}
                          </ul>
                        </div>
                      )}
                      
                      {validationResult.warnings.length > 0 && (
                        <div className="mt-3">
                          <p className="font-semibold text-orange-700 mb-1 flex items-center gap-1">
                            <AlertCircle className="size-4" />
                            Warnings:
                          </p>
                          <ul className="list-disc list-inside space-y-1 text-orange-600 max-h-32 overflow-y-auto">
                            {validationResult.warnings.map((warning, idx) => (
                              <li key={idx}>{warning}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Upload Progress */}
          {uploadProgress && (
            <div className="flex items-center gap-3 p-4 bg-purple-50 border-2 border-purple-200 rounded-lg">
              <Loader2 className="size-5 text-[#C7359C] animate-spin" />
              <span className="text-sm font-medium text-gray-700">{uploadProgress}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={uploading}
              className="flex-1"
            >
              Cancel
            </Button>
            {validationResult?.valid && (
              <Button
                onClick={handleUpload}
                disabled={uploading}
                className="flex-1 bg-[#C7359C] hover:bg-purple-700 gap-2"
              >
                {uploading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="size-4" />
                    Upload Inventory
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Instructions */}
          <Card className="bg-gray-50 border-gray-200">
            <CardContent className="pt-6">
              <h4 className="font-semibold mb-2 text-sm">📝 Instructions:</h4>
              <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside">
                <li>Download the template and fill in your inventory data</li>
                <li>Required fields are marked with * (asterisk)</li>
                <li>For products with variants (e.g., different sizes), use the same Product Name</li>
                <li>Each row represents one batch of inventory</li>
                <li>Dates must be in YYYY-MM-DD format (e.g., 2025-12-31)</li>
                <li>Save your file as CSV format before uploading</li>
                <li>Validate the file before uploading to check for errors</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}