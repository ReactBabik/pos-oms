import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";
const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check endpoint
app.get("/make-server-77be783d/health", (c) => {
  return c.json({ status: "ok" });
});

// ===== PRODUCT MANAGEMENT ROUTES =====

// Get all categories
app.get("/make-server-77be783d/categories", async (c) => {
  try {
    const categories = await kv.getByPrefix("category:");
    return c.json({ success: true, categories });
  } catch (error) {
    console.log("Error fetching categories:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Create new category
app.post("/make-server-77be783d/categories", async (c) => {
  try {
    const body = await c.req.json();
    const { name } = body;
    
    if (!name || !name.trim()) {
      return c.json({ success: false, error: "Category name is required" }, 400);
    }
    
    // Generate a simple ID from the category name
    const id = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    
    // Check if category already exists
    const existing = await kv.get(`category:${id}`);
    if (existing) {
      return c.json({ success: false, error: "Category already exists" }, 400);
    }
    
    const categoryData = {
      id,
      name: name.trim(),
      createdAt: new Date().toISOString(),
    };
    
    await kv.set(`category:${id}`, categoryData);
    return c.json({ success: true, category: categoryData });
  } catch (error) {
    console.log("Error creating category:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Delete category
app.delete("/make-server-77be783d/categories/:id", async (c) => {
  try {
    const id = c.req.param("id");
    
    // Check if category exists
    const category = await kv.get(`category:${id}`);
    if (!category) {
      return c.json({ success: false, error: "Category not found" }, 404);
    }
    
    // Delete the category
    await kv.del(`category:${id}`);
    return c.json({ success: true, message: "Category deleted successfully" });
  } catch (error) {
    console.log("Error deleting category:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Get all products
app.get("/make-server-77be783d/products", async (c) => {
  try {
    const products = await kv.getByPrefix("product:");
    return c.json({ success: true, products });
  } catch (error) {
    console.log("Error fetching products:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Get single product by ID
app.get("/make-server-77be783d/products/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const product = await kv.get(`product:${id}`);
    
    if (!product) {
      return c.json({ success: false, error: "Product not found" }, 404);
    }
    
    return c.json({ success: true, product });
  } catch (error) {
    console.log("Error fetching product:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Get product by QR code
app.get("/make-server-77be783d/products/qr/:qrCode", async (c) => {
  try {
    const qrCode = c.req.param("qrCode");
    const products = await kv.getByPrefix("product:");
    
    const product = products.find((p: any) => p.qrCode === qrCode || p.agiCode === qrCode);
    
    if (!product) {
      return c.json({ success: false, error: "Product not found for QR/AGI code" }, 404);
    }
    
    return c.json({ success: true, product });
  } catch (error) {
    console.log("Error fetching product by QR:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Create new product
app.post("/make-server-77be783d/products", async (c) => {
  try {
    const body = await c.req.json();
    const { id, name, category, unit, defaultPrice, qrCode, agiCode, batches, image, variants } = body;
    
    if (!id || !name || !category) {
      return c.json({ success: false, error: "Missing required fields: id, name, category" }, 400);
    }
    
    // Check if product already exists
    const existing = await kv.get(`product:${id}`);
    if (existing) {
      return c.json({ success: false, error: "Product with this ID already exists" }, 409);
    }
    
    const product = {
      id,
      name,
      category,
      unit: unit || "PC",
      defaultPrice: defaultPrice || 0,
      qrCode: qrCode || "",
      agiCode: agiCode || "",
      image: image || "",
      batches: batches || [],
      variants: variants || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    await kv.set(`product:${id}`, product);
    
    // Create movement logs for variants (modern approach)
    if (variants && variants.length > 0) {
      for (const variant of variants) {
        if (variant.batches && variant.batches.length > 0) {
          for (const batch of variant.batches) {
            const movementId = `movement:${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const movement = {
              id: movementId,
              variantId: variant.id,
              variantName: `${name} ${variant.name}`,
              productId: id,
              productName: name,
              batchId: batch.id,
              type: 'IN',
              quantity: batch.quantity,
              reason: 'Initial Stock',
              reference: `Product Created: ${id}`,
              timestamp: new Date().toISOString(),
              performedBy: 'Product Management'
            };
            await kv.set(movementId, movement);
          }
        }
      }
    }
    // Create movement logs for product-level batches (backward compatibility)
    else if (batches && batches.length > 0) {
      for (const batch of batches) {
        const movementId = `movement:${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const movement = {
          id: movementId,
          variantId: id,
          variantName: name,
          productId: id,
          productName: name,
          batchId: batch.id,
          type: 'IN',
          quantity: batch.quantity,
          reason: 'Initial Stock',
          reference: `Product Created: ${id}`,
          timestamp: new Date().toISOString(),
          performedBy: 'Product Management'
        };
        await kv.set(movementId, movement);
      }
    }
    
    return c.json({ success: true, product }, 201);
  } catch (error) {
    console.log("Error creating product:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Update existing product
app.put("/make-server-77be783d/products/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    
    const existing = await kv.get(`product:${id}`);
    if (!existing) {
      return c.json({ success: false, error: "Product not found" }, 404);
    }
    
    const product = {
      ...existing,
      ...body,
      id, // Preserve ID
      updatedAt: new Date().toISOString(),
    };
    
    await kv.set(`product:${id}`, product);
    
    // Handle movement logs for variants (modern approach)
    if (body.variants && body.variants.length > 0) {
      const oldVariants = existing.variants || [];
      
      for (const newVariant of body.variants) {
        const oldVariant = oldVariants.find((v: any) => v.id === newVariant.id);
        const oldVariantBatches = oldVariant?.batches || [];
        const newVariantBatches = newVariant.batches || [];
        
        // Find batches that are new for this variant
        const addedBatches = newVariantBatches.filter((newBatch: any) => 
          !oldVariantBatches.some((oldBatch: any) => oldBatch.id === newBatch.id)
        );
        
        // Create movement logs for newly added batches
        for (const batch of addedBatches) {
          const movementId = `movement:${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const movement = {
            id: movementId,
            variantId: newVariant.id,
            variantName: `${product.name} ${newVariant.name}`,
            productId: id,
            productName: product.name,
            batchId: batch.id,
            type: 'IN',
            quantity: batch.quantity,
            reason: 'Stock Added',
            reference: `Product Updated: ${id}`,
            timestamp: new Date().toISOString(),
            performedBy: 'Product Management'
          };
          await kv.set(movementId, movement);
        }
      }
    }
    // Handle product-level batches (backward compatibility)
    else if (body.batches) {
      const oldBatches = existing.batches || [];
      const newBatches = body.batches || [];
      
      // Find batches that are new (exist in newBatches but not in oldBatches)
      const addedBatches = newBatches.filter((newBatch: any) => 
        !oldBatches.some((oldBatch: any) => oldBatch.id === newBatch.id)
      );
      
      // Create movement logs for newly added batches
      if (addedBatches.length > 0) {
        for (const batch of addedBatches) {
          const movementId = `movement:${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const movement = {
            id: movementId,
            variantId: id,
            variantName: product.name,
            productId: id,
            productName: product.name,
            batchId: batch.id,
            type: 'IN',
            quantity: batch.quantity,
            reason: 'Stock Added',
            reference: `Product Updated: ${id}`,
            timestamp: new Date().toISOString(),
            performedBy: 'Product Management'
          };
          await kv.set(movementId, movement);
        }
      }
    }
    
    return c.json({ success: true, product });
  } catch (error) {
    console.log("Error updating product:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Delete product
app.delete("/make-server-77be783d/products/:id", async (c) => {
  try {
    const id = c.req.param("id");
    
    const existing = await kv.get(`product:${id}`);
    if (!existing) {
      return c.json({ success: false, error: "Product not found" }, 404);
    }
    
    await kv.del(`product:${id}`);
    
    return c.json({ success: true, message: "Product deleted" });
  } catch (error) {
    console.log("Error deleting product:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Delete all products (for cleanup)
app.delete("/make-server-77be783d/products", async (c) => {
  try {
    const products = await kv.getByPrefix("product:");
    
    for (const product of products) {
      await kv.del(`product:${product.id}`);
    }
    
    return c.json({ 
      success: true, 
      message: `Deleted ${products.length} products` 
    });
  } catch (error) {
    console.log("Error deleting all products:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Bulk create/update products (for CSV upload)
app.post("/make-server-77be783d/products/bulk", async (c) => {
  try {
    const body = await c.req.json();
    const { products } = body;
    
    if (!Array.isArray(products)) {
      return c.json({ success: false, error: "Products must be an array" }, 400);
    }
    
    const results = [];
    const productsCreated = [];
    
    for (const product of products) {
      const { name, category, agiCode, variants } = product;
      
      if (!name || !category) {
        results.push({ name, success: false, error: "Missing required fields: name, category" });
        continue;
      }
      
      if (!variants || !Array.isArray(variants) || variants.length === 0) {
        results.push({ name, success: false, error: "Product must have at least one variant" });
        continue;
      }
      
      // Generate unique product ID
      const productId = `prod-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Process variants - add variant IDs if not present
      const processedVariants = variants.map((variant: any, index: number) => ({
        ...variant,
        id: variant.id || `var-${productId}-${index}`,
      }));
      
      const productData = {
        id: productId,
        name,
        category,
        agiCode: agiCode || "",
        image: product.image || "",
        variants: processedVariants,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      await kv.set(`product:${productId}`, productData);
      productsCreated.push(productData);
      results.push({ id: productId, name, success: true });
    }
    
    console.log(`✅ Bulk created ${productsCreated.length} products with ${products.reduce((sum, p) => sum + p.variants.length, 0)} variants`);
    
    return c.json({ success: true, results, count: productsCreated.length });
  } catch (error) {
    console.log("Error bulk creating products:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Add inventory stock to existing products
app.post("/make-server-77be783d/inventory/add", async (c) => {
  try {
    const body = await c.req.json();
    const { productId, productName, batches } = body;
    
    if (!productId || !batches || !Array.isArray(batches) || batches.length === 0) {
      return c.json({ 
        success: false, 
        error: "Missing required fields: productId, batches" 
      }, 400);
    }
    
    // Get the product
    const product = await kv.get(`product:${productId}`);
    
    if (!product) {
      return c.json({ success: false, error: "Product not found" }, 404);
    }
    
    // Update each variant with new batches
    const updatedVariants = product.variants.map((variant: any) => {
      // Find batches for this variant
      const variantBatches = batches.filter((b: any) => b.variantId === variant.id);
      
      if (variantBatches.length === 0) {
        return variant;
      }
      
      // Add new batches to existing batches
      const existingBatches = variant.batches || [];
      const newBatches = variantBatches.map((b: any) => ({
        id: b.batchId,
        quantity: b.quantity,
        price: b.price,
        expiry: b.expiry
      }));
      
      // Log inventory movement for each new batch
      variantBatches.forEach((b: any) => {
        const movementId = `inv-mov-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const movement = {
          id: movementId,
          productId: productId,
          productName: productName,
          variantId: variant.id,
          variantName: variant.name,
          batchId: b.batchId,
          type: 'in',
          quantity: b.quantity,
          reason: 'Stock Added',
          timestamp: new Date().toISOString(),
          price: b.price
        };
        kv.set(`inventory-movement:${movementId}`, movement);
      });
      
      return {
        ...variant,
        batches: [...existingBatches, ...newBatches]
      };
    });
    
    // Update product with new batches
    const updatedProduct = {
      ...product,
      variants: updatedVariants,
      updatedAt: new Date().toISOString()
    };
    
    await kv.set(`product:${productId}`, updatedProduct);
    
    const totalQuantity = batches.reduce((sum: number, b: any) => sum + b.quantity, 0);
    console.log(`✅ Added ${totalQuantity} units across ${batches.length} batches to product ${productName}`);
    
    return c.json({ 
      success: true, 
      product: updatedProduct,
      message: `Added ${totalQuantity} units in ${batches.length} batches`
    });
  } catch (error) {
    console.log("Error adding inventory:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ===== ORDER MANAGEMENT ROUTES =====

// Get all orders
app.get("/make-server-77be783d/orders", async (c) => {
  try {
    const orders = await kv.getByPrefix("order:");
    // Sort by order date descending (newest first)
    const sortedOrders = orders.sort((a: any, b: any) => 
      new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime()
    );
    return c.json({ success: true, orders: sortedOrders });
  } catch (error) {
    console.log("Error fetching orders:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Get single order by ID
app.get("/make-server-77be783d/orders/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const order = await kv.get(`order:${id}`);
    
    if (!order) {
      return c.json({ success: false, error: "Order not found" }, 404);
    }
    
    return c.json({ success: true, order });
  } catch (error) {
    console.log("Error fetching order:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Create new order
app.post("/make-server-77be783d/orders", async (c) => {
  try {
    const body = await c.req.json();
    const { orderDate, expectedDeliveryDate, status, items, totalAmount, notes, deliveryAddress } = body;
    
    if (!items || items.length === 0 || !expectedDeliveryDate || !deliveryAddress) {
      return c.json({ 
        success: false, 
        error: "Missing required fields: items, expectedDeliveryDate, deliveryAddress" 
      }, 400);
    }
    
    // Generate order ID
    const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    
    const order = {
      id: orderId,
      orderDate: orderDate || new Date().toISOString(),
      expectedDeliveryDate,
      status: status || "Pending",
      items,
      totalAmount,
      notes: notes || "",
      deliveryAddress,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    await kv.set(`order:${orderId}`, order);
    
    return c.json({ success: true, order }, 201);
  } catch (error) {
    console.log("Error creating order:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Update order status
app.put("/make-server-77be783d/orders/:id/status", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const { status } = body;
    
    const order = await kv.get(`order:${id}`);
    if (!order) {
      return c.json({ success: false, error: "Order not found" }, 404);
    }
    
    const updatedOrder = {
      ...order,
      status,
      updatedAt: new Date().toISOString(),
    };
    
    await kv.set(`order:${id}`, updatedOrder);
    
    return c.json({ success: true, order: updatedOrder });
  } catch (error) {
    console.log("Error updating order status:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Mark order as received and add to inventory
app.post("/make-server-77be783d/orders/:id/receive", async (c) => {
  try {
    const id = c.req.param("id");
    
    const order = await kv.get(`order:${id}`);
    if (!order) {
      return c.json({ success: false, error: "Order not found" }, 404);
    }
    
    // Update order status to Delivered
    const updatedOrder = {
      ...order,
      status: "Delivered",
      receivedDate: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    await kv.set(`order:${id}`, updatedOrder);
    
    // Add items to inventory as new batches
    const errors = [];
    let itemIndex = 0;
    for (const item of order.items) {
      try {
        const product = await kv.get(`product:${item.productId}`);
        
        if (!product) {
          errors.push(`Product ${item.productId} not found`);
          continue;
        }
        
        // Generate batch ID for this order item
        const batchId = `B-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
        
        // Calculate expiry date (default 1 year from now if not specified)
        const expiryDate = new Date();
        expiryDate.setFullYear(expiryDate.getFullYear() + 1);
        
        // Create new batch
        const newBatch = {
          id: batchId,
          quantity: item.quantity,
          price: item.price,
          expiry: expiryDate.toISOString().split('T')[0], // YYYY-MM-DD format
        };
        
        // Add batch to product
        const updatedProduct = {
          ...product,
          batches: [...(product.batches || []), newBatch],
          updatedAt: new Date().toISOString(),
        };
        
        await kv.set(`product:${item.productId}`, updatedProduct);

        // Log inventory movement with unique ID
        const movementId = `movement:${Date.now()}-${itemIndex}-${Math.random().toString(36).substr(2, 9)}`;
        const movement = {
          id: movementId,
          productId: item.productId,
          productName: item.productName,
          batchId: batchId,
          type: 'IN',
          quantity: item.quantity,
          reason: 'Order Received',
          reference: `Order #${id}`,
          timestamp: new Date().toISOString(),
          performedBy: 'System'
        };
        
        console.log('Creating inventory movement:', movementId, movement);
        await kv.set(movementId, movement);
        console.log('Inventory movement created successfully');
        
        itemIndex++;
      } catch (itemError) {
        console.log(`Error adding item ${item.productId} to inventory:`, itemError);
        errors.push(`Failed to add ${item.productName}: ${itemError.message}`);
      }
    }
    
    if (errors.length > 0) {
      return c.json({ 
        success: true, 
        order: updatedOrder, 
        warning: `Order received but some items had issues: ${errors.join(', ')}` 
      });
    }
    
    return c.json({ 
      success: true, 
      order: updatedOrder,
      message: "Order marked as received and added to inventory"
    });
  } catch (error) {
    console.log("Error receiving order:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Delete order
app.delete("/make-server-77be783d/orders/:id", async (c) => {
  try {
    const id = c.req.param("id");
    
    const order = await kv.get(`order:${id}`);
    if (!order) {
      return c.json({ success: false, error: "Order not found" }, 404);
    }
    
    // If order was delivered, we need to reverse the inventory changes
    if (order.status === "Delivered") {
      console.log(`Reversing inventory for delivered order ${id}`);
      
      for (const item of order.items) {
        try {
          const product = await kv.get(`product:${item.productId}`);
          if (!product) {
            console.log(`Product ${item.productId} not found during reversal`);
            continue;
          }
          
          // Find and remove batches that were added from this order
          // We'll identify them by checking batches added around the order's receivedDate
          // For safety, we'll remove the most recent batches matching the quantity
          const orderReceivedTime = new Date(order.receivedDate || order.updatedAt).getTime();
          
          // Find batches added within 1 minute of order receipt (to be safe)
          const timeWindow = 60000; // 1 minute in milliseconds
          let remainingToRemove = item.quantity;
          const updatedBatches = [];
          
          // Sort batches by creation time (newest first, based on batch ID timestamp)
          const sortedBatches = [...(product.batches || [])].sort((a, b) => {
            const aTime = parseInt(a.id.split('-')[1]) || 0;
            const bTime = parseInt(b.id.split('-')[1]) || 0;
            return bTime - aTime;
          });
          
          for (const batch of sortedBatches) {
            // Extract timestamp from batch ID (format: B-timestamp-random)
            const batchTime = parseInt(batch.id.split('-')[1]) || 0;
            const timeDiff = Math.abs(batchTime - orderReceivedTime);
            
            if (remainingToRemove > 0 && timeDiff < timeWindow && batch.quantity === item.quantity) {
              // This batch matches - skip it (remove it)
              console.log(`Removing batch ${batch.id} with quantity ${batch.quantity}`);
              remainingToRemove -= batch.quantity;
            } else {
              // Keep this batch
              updatedBatches.push(batch);
            }
          }
          
          // Update product with remaining batches
          const updatedProduct = {
            ...product,
            batches: updatedBatches,
            updatedAt: new Date().toISOString(),
          };
          
          await kv.set(`product:${item.productId}`, updatedProduct);
          console.log(`Reversed inventory for product ${item.productId}`);
        } catch (error) {
          console.log(`Error reversing inventory for ${item.productId}:`, error);
        }
      }
      
      // Delete movement logs related to this order
      try {
        const allMovements = await kv.getByPrefix("movement:");
        for (const movement of allMovements) {
          if (movement.reference === `Order #${id}`) {
            await kv.del(movement.id);
            console.log(`Deleted movement log ${movement.id}`);
          }
        }
      } catch (error) {
        console.log("Error deleting movement logs:", error);
      }
    }
    
    // Delete the order
    await kv.del(`order:${id}`);
    
    return c.json({ 
      success: true, 
      message: order.status === "Delivered" 
        ? "Order deleted and inventory reversed" 
        : "Order deleted"
    });
  } catch (error) {
    console.log("Error deleting order:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ===== INVENTORY MOVEMENT ROUTES =====

// Get all inventory movements
app.get("/make-server-77be783d/inventory-movements", async (c) => {
  try {
    const movements = await kv.getByPrefix("movement:");
    // Sort by timestamp descending (newest first)
    const sortedMovements = movements.sort((a: any, b: any) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    return c.json({ success: true, movements: sortedMovements });
  } catch (error) {
    console.log("Error fetching inventory movements:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Log a new inventory movement (for manual adjustments)
app.post("/make-server-77be783d/inventory-movements", async (c) => {
  try {
    const body = await c.req.json();
    const { variantId, variantName, productId, productName, batchId, type, quantity, reason, reference, performedBy } = body;
    
    // Support both old (productId-only) and new (variantId) formats
    const finalVariantId = variantId || productId;
    const finalVariantName = variantName || productName;
    
    if (!finalVariantId || !finalVariantName || !batchId || !type || !quantity || !reason) {
      return c.json({ 
        success: false, 
        error: "Missing required fields: variantId (or productId), variantName (or productName), batchId, type, quantity, reason" 
      }, 400);
    }
    
    // Generate movement ID
    const movementId = `movement:${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const movement = {
      id: movementId,
      variantId: finalVariantId,
      variantName: finalVariantName,
      productId: productId || finalVariantId, // For backwards compatibility
      productName: productName || finalVariantName,
      batchId,
      type, // 'IN', 'OUT', or 'ADJUSTMENT'
      quantity,
      reason,
      reference: reference || '',
      timestamp: new Date().toISOString(),
      performedBy: performedBy || 'Manual'
    };
    
    await kv.set(movementId, movement);
    
    return c.json({ success: true, movement }, 201);
  } catch (error) {
    console.log("Error logging inventory movement:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Delete all inventory movements (clear logs)
app.delete("/make-server-77be783d/inventory-movements/clear", async (c) => {
  try {
    const movements = await kv.getByPrefix("movement:");
    const deletePromises = movements.map((movement: any) => kv.del(movement.id));
    await Promise.all(deletePromises);
    
    console.log(`Cleared ${movements.length} inventory movement logs`);
    return c.json({ success: true, deletedCount: movements.length });
  } catch (error) {
    console.log("Error clearing inventory movements:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ===== POS SALES ROUTES =====

// Get all sales
app.get("/make-server-77be783d/sales", async (c) => {
  try {
    const sales = await kv.getByPrefix("sale:");
    // Sort by date descending (newest first)
    const sortedSales = sales.sort((a: any, b: any) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    return c.json({ success: true, sales: sortedSales });
  } catch (error) {
    console.log("Error fetching sales:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Get single sale by ID
app.get("/make-server-77be783d/sales/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const sale = await kv.get(`sale:${id}`);
    
    if (!sale) {
      return c.json({ success: false, error: "Sale not found" }, 404);
    }
    
    return c.json({ success: true, sale });
  } catch (error) {
    console.log("Error fetching sale:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Create new sale (POS checkout)
app.post("/make-server-77be783d/sales", async (c) => {
  try {
    const body = await c.req.json();
    const { customer, phone, address, commissionShop, items, subtotal, discount, total, cashAmount, creditAmount, payment, status } = body;
    
    if (!items || items.length === 0) {
      return c.json({ 
        success: false, 
        error: "Missing required fields: items" 
      }, 400);
    }
    
    // Generate sale ID
    const timestamp = Date.now();
    const saleId = `ORD-${new Date().getFullYear()}-${String(timestamp).slice(-6)}`;
    
    const sale = {
      id: saleId,
      date: new Date().toISOString(),
      customer: customer || "Walk-in Customer",
      phone: phone || "",
      address: address || "",
      commissionShop: commissionShop || "", // Save commission shop field
      items,
      subtotal: subtotal || 0,
      discount: discount || 0,
      total,
      cashAmount: cashAmount || 0,
      creditAmount: creditAmount || 0,
      payment: payment || "Cash",
      status: status || "Completed",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    await kv.set(`sale:${saleId}`, sale);
    
    // Update inventory - reduce stock from batches
    const inventoryErrors = [];
    let itemIndex = 0;
    
    for (const item of items) {
      try {
        const product = await kv.get(`product:${item.productId}`);
        
        if (!product) {
          inventoryErrors.push(`Product ${item.productId} not found`);
          continue;
        }
        
        // Handle variant-based products
        if (product.variants && product.variants.length > 0) {
          const updatedVariants = product.variants.map((variant: any) => {
            if (variant.id === item.variantId) {
              const updatedBatches = variant.batches?.map((batch: any) => {
                if (batch.id === item.batchId) {
                  return {
                    ...batch,
                    quantity: batch.quantity - item.quantity
                  };
                }
                return batch;
              }) || [];
              
              return {
                ...variant,
                batches: updatedBatches
              };
            }
            return variant;
          });
          
          // Update product with reduced inventory
          const updatedProduct = {
            ...product,
            variants: updatedVariants,
            updatedAt: new Date().toISOString(),
          };
          
          await kv.set(`product:${item.productId}`, updatedProduct);
        } else {
          // Handle legacy products without variants
          const updatedBatches = product.batches?.map((batch: any) => {
            if (batch.id === item.batchId) {
              return {
                ...batch,
                quantity: batch.quantity - item.quantity
              };
            }
            return batch;
          }) || [];
          
          // Update product with reduced inventory
          const updatedProduct = {
            ...product,
            batches: updatedBatches,
            updatedAt: new Date().toISOString(),
          };
          
          await kv.set(`product:${item.productId}`, updatedProduct);
        }
        
        // Log inventory movement
        const movementId = `movement:${timestamp}-sale-${itemIndex}-${Math.random().toString(36).substr(2, 9)}`;
        const movement = {
          id: movementId,
          variantId: item.variantId || item.productId,
          variantName: item.variantName || item.productName,
          productId: item.productId,
          productName: item.productName,
          batchId: item.batchId,
          type: 'OUT',
          quantity: item.quantity,
          reason: 'Sale',
          reference: `Sale #${saleId}`,
          timestamp: new Date().toISOString(),
          performedBy: 'POS System'
        };
        
        await kv.set(movementId, movement);
        itemIndex++;
      } catch (itemError) {
        console.log(`Error updating inventory for ${item.productId}:`, itemError);
        inventoryErrors.push(`Failed to update inventory for ${item.productName}: ${itemError.message}`);
      }
    }
    
    if (inventoryErrors.length > 0) {
      return c.json({ 
        success: true, 
        sale, 
        warning: `Sale completed but some inventory updates failed: ${inventoryErrors.join(', ')}` 
      }, 201);
    }
    
    return c.json({ success: true, sale }, 201);
  } catch (error) {
    console.log("Error creating sale:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Process return for a sale
app.post("/make-server-77be783d/sales/:id/return", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const { returnType, items, reason, totalAmount } = body;
    
    const sale = await kv.get(`sale:${id}`);
    if (!sale) {
      return c.json({ success: false, error: "Sale not found" }, 404);
    }
    
    // Generate return ID
    const timestamp = Date.now();
    const returnId = `RET-${new Date().getFullYear()}-${String(timestamp).slice(-6)}`;
    
    const returnRecord = {
      id: returnId,
      saleId: id,
      date: new Date().toISOString(),
      returnType, // 'complete' or 'partial'
      items, // Items being returned with quantities
      reason,
      totalAmount,
      status: 'Completed',
      createdAt: new Date().toISOString(),
    };
    
    await kv.set(`return:${returnId}`, returnRecord);
    
    // Add returned items back to inventory
    let itemIndex = 0;
    for (const item of items) {
      try {
        const product = await kv.get(`product:${item.productId}`);
        
        if (!product) {
          continue;
        }
        
        // Find the batch and increase quantity
        const updatedBatches = product.batches?.map((batch: any) => {
          if (batch.id === item.batchId) {
            return {
              ...batch,
              quantity: batch.quantity + item.quantity
            };
          }
          return batch;
        }) || [];
        
        // Update product with increased inventory
        const updatedProduct = {
          ...product,
          batches: updatedBatches,
          updatedAt: new Date().toISOString(),
        };
        
        await kv.set(`product:${item.productId}`, updatedProduct);
        
        // Log inventory movement for return
        const movementId = `movement:${timestamp}-return-${itemIndex}-${Math.random().toString(36).substr(2, 9)}`;
        const movement = {
          id: movementId,
          variantId: item.variantId || item.productId,
          variantName: item.variantName || item.productName,
          productId: item.productId,
          productName: item.productName,
          batchId: item.batchId,
          type: 'IN',
          quantity: item.quantity,
          reason: 'Return',
          reference: `Return #${returnId} from Sale #${id}`,
          timestamp: new Date().toISOString(),
          performedBy: 'POS System'
        };
        
        await kv.set(movementId, movement);
        itemIndex++;
      } catch (itemError) {
        console.log(`Error updating inventory for return ${item.productId}:`, itemError);
      }
    }
    
    // Update sale status if complete return
    if (returnType === 'complete') {
      const updatedSale = {
        ...sale,
        status: 'Returned',
        returnId,
        updatedAt: new Date().toISOString(),
      };
      await kv.set(`sale:${id}`, updatedSale);
    }
    
    return c.json({ 
      success: true, 
      return: returnRecord,
      message: "Return processed successfully and inventory updated"
    }, 201);
  } catch (error) {
    console.log("Error processing return:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Get all returns
app.get("/make-server-77be783d/returns", async (c) => {
  try {
    const returns = await kv.getByPrefix("return:");
    // Sort by date descending (newest first)
    const sortedReturns = returns.sort((a: any, b: any) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    return c.json({ success: true, returns: sortedReturns });
  } catch (error) {
    console.log("Error fetching returns:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ===== PAYMENT MANAGEMENT ROUTES =====

// Get all payments
app.get("/make-server-77be783d/payments", async (c) => {
  try {
    const payments = await kv.getByPrefix("payment:");
    // Sort by date descending (newest first)
    const sortedPayments = payments.sort((a: any, b: any) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    return c.json({ success: true, payments: sortedPayments });
  } catch (error) {
    console.log("Error fetching payments:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Record a new payment
app.post("/make-server-77be783d/payments", async (c) => {
  try {
    const body = await c.req.json();
    const { id, customerId, customerName, customerPhone, amount, date, previousBalance, newBalance, type } = body;
    
    if (!customerId || !amount || !type) {
      return c.json({ 
        success: false, 
        error: "Missing required fields: customerId, amount, type" 
      }, 400);
    }
    
    const payment = {
      id: id || `payment_${Date.now()}`,
      customerId,
      customerName: customerName || '',
      customerPhone: customerPhone || '',
      amount,
      date: date || new Date().toISOString(),
      previousBalance: previousBalance || 0,
      newBalance: newBalance || 0,
      type: type, // 'payment'
      createdAt: new Date().toISOString()
    };
    
    await kv.set(`payment:${payment.id}`, payment);
    
    console.log(`✅ Payment recorded: ${payment.id} - PKR ${amount} from ${customerName} (${customerPhone})`);
    
    return c.json({ success: true, payment }, 201);
  } catch (error) {
    console.log("Error recording payment:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Get all Arthi information
app.get("/make-server-77be783d/arthis", async (c) => {
  try {
    const arthis = await kv.getByPrefix("arthi:");
    return c.json({ success: true, arthis });
  } catch (error) {
    console.log("Error fetching arthis:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Save/Update Arthi information
app.post("/make-server-77be783d/arthis", async (c) => {
  try {
    const body = await c.req.json();
    const { id, name, phone, location, creditLimit } = body;
    
    if (!id || !name) {
      return c.json({ 
        success: false, 
        error: "Missing required fields: id, name" 
      }, 400);
    }
    
    const arthiInfo = {
      id,
      name,
      phone: phone || '',
      location: location || '',
      creditLimit: creditLimit || 0,
      updatedAt: new Date().toISOString()
    };
    
    await kv.set(`arthi:${id}`, arthiInfo);
    
    console.log(`✅ Arthi info saved: ${name}`);
    
    return c.json({ success: true, arthi: arthiInfo }, 201);
  } catch (error) {
    console.log("Error saving arthi info:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Save/Update Customer credit limit
app.post("/make-server-77be783d/customers/credit-limit", async (c) => {
  try {
    const body = await c.req.json();
    const { customerId, customerName, customerPhone, creditLimit } = body;
    
    if (!customerId) {
      return c.json({ 
        success: false, 
        error: "Missing required field: customerId" 
      }, 400);
    }
    
    const customerCreditInfo = {
      id: customerId,
      name: customerName || '',
      phone: customerPhone || '',
      creditLimit: creditLimit || 0,
      updatedAt: new Date().toISOString()
    };
    
    await kv.set(`customer-credit:${customerId}`, customerCreditInfo);
    
    console.log(`✅ Customer credit limit saved: ${customerName} - PKR ${creditLimit}`);
    
    return c.json({ success: true, customer: customerCreditInfo }, 201);
  } catch (error) {
    console.log("Error saving customer credit limit:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Get customer credit limits
app.get("/make-server-77be783d/customers/credit-limits", async (c) => {
  try {
    const creditLimits = await kv.getByPrefix("customer-credit:");
    return c.json({ success: true, creditLimits });
  } catch (error) {
    console.log("Error fetching customer credit limits:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ===== CAMPAIGN / DISCOUNT MANAGEMENT ROUTES =====

// Get all campaigns
app.get("/make-server-77be783d/campaigns", async (c) => {
  try {
    const campaigns = await kv.getByPrefix("campaign:");
    // Sort by creation date descending (newest first)
    const sortedCampaigns = campaigns.sort((a: any, b: any) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return c.json({ success: true, campaigns: sortedCampaigns });
  } catch (error) {
    console.log("Error fetching campaigns:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Get single campaign by ID
app.get("/make-server-77be783d/campaigns/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const campaign = await kv.get(`campaign:${id}`);

    if (!campaign) {
      return c.json({ success: false, error: "Campaign not found" }, 404);
    }

    return c.json({ success: true, campaign });
  } catch (error) {
    console.log("Error fetching campaign:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Create new campaign
app.post("/make-server-77be783d/campaigns", async (c) => {
  try {
    const body = await c.req.json();

    // Generate campaign ID
    const campaignId = `camp-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

    const campaign = {
      id: campaignId,
      name: body.name,
      description: body.description || '',
      enabled: body.enabled !== undefined ? body.enabled : true,

      // Discount type configuration
      discountType: body.discountType, // 'percentage' | 'fixed' | 'buyXgetY' | 'bundlePrice'
      discountValue: body.discountValue || 0,
      buyQuantity: body.buyQuantity || 0, // for buyXgetY
      getQuantity: body.getQuantity || 0, // for buyXgetY
      bundlePrice: body.bundlePrice || 0, // for bundlePrice

      // Conditions
      minOrderValue: body.minOrderValue || 0,
      productEligibility: body.productEligibility || 'all', // 'all' | 'specific' | 'category' | 'excluded'
      eligibleProducts: body.eligibleProducts || [], // array of product IDs or AGI codes
      eligibleCategories: body.eligibleCategories || [], // array of category IDs
      excludedProducts: body.excludedProducts || [], // array of product IDs or AGI codes

      // Customer eligibility
      customerEligibility: body.customerEligibility || 'all', // 'all' | 'new' | 'returning' | 'specific'
      eligibleCustomers: body.eligibleCustomers || [], // array of customer IDs or phone numbers

      // Time constraints
      startDate: body.startDate || new Date().toISOString(),
      endDate: body.endDate || null,
      recurring: body.recurring || false,
      recurringSchedule: body.recurringSchedule || [], // e.g., ['monday', 'tuesday'] or ['weekend']
      timeSlots: body.timeSlots || [], // e.g., [{start: '18:00', end: '21:00'}]

      // Usage limits
      globalLimit: body.globalLimit || null, // null means unlimited
      perCustomerLimit: body.perCustomerLimit || null,
      allowStacking: body.allowStacking || false,
      priority: body.priority || 100, // higher number = higher priority

      // Other settings
      requiresCouponCode: body.requiresCouponCode || false,
      couponCode: body.couponCode || '',
      autoApply: body.autoApply || true,
      salesChannels: body.salesChannels || ['in-store'], // 'in-store' | 'online'
      excludeDiscountedItems: body.excludeDiscountedItems || false,

      // Tracking
      usageCount: 0,
      totalDiscountGiven: 0,
      totalRevenue: 0,

      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`campaign:${campaignId}`, campaign);

    console.log(`✅ Campaign created: ${campaign.name} (${campaignId})`);

    return c.json({ success: true, campaign }, 201);
  } catch (error) {
    console.log("Error creating campaign:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Update campaign
app.put("/make-server-77be783d/campaigns/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();

    const existing = await kv.get(`campaign:${id}`);
    if (!existing) {
      return c.json({ success: false, error: "Campaign not found" }, 404);
    }

    const campaign = {
      ...existing,
      ...body,
      id, // Preserve ID
      usageCount: existing.usageCount, // Preserve usage stats
      totalDiscountGiven: existing.totalDiscountGiven,
      totalRevenue: existing.totalRevenue,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`campaign:${id}`, campaign);

    console.log(`✅ Campaign updated: ${campaign.name} (${id})`);

    return c.json({ success: true, campaign });
  } catch (error) {
    console.log("Error updating campaign:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Toggle campaign enabled status
app.post("/make-server-77be783d/campaigns/:id/toggle", async (c) => {
  try {
    const id = c.req.param("id");

    const campaign = await kv.get(`campaign:${id}`);
    if (!campaign) {
      return c.json({ success: false, error: "Campaign not found" }, 404);
    }

    const updatedCampaign = {
      ...campaign,
      enabled: !campaign.enabled,
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`campaign:${id}`, updatedCampaign);

    console.log(`✅ Campaign ${updatedCampaign.enabled ? 'enabled' : 'disabled'}: ${campaign.name}`);

    return c.json({ success: true, campaign: updatedCampaign });
  } catch (error) {
    console.log("Error toggling campaign:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Delete campaign
app.delete("/make-server-77be783d/campaigns/:id", async (c) => {
  try {
    const id = c.req.param("id");

    const campaign = await kv.get(`campaign:${id}`);
    if (!campaign) {
      return c.json({ success: false, error: "Campaign not found" }, 404);
    }

    await kv.del(`campaign:${id}`);

    console.log(`✅ Campaign deleted: ${campaign.name}`);

    return c.json({ success: true, message: "Campaign deleted successfully" });
  } catch (error) {
    console.log("Error deleting campaign:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Clone campaign
app.post("/make-server-77be783d/campaigns/:id/clone", async (c) => {
  try {
    const id = c.req.param("id");

    const campaign = await kv.get(`campaign:${id}`);
    if (!campaign) {
      return c.json({ success: false, error: "Campaign not found" }, 404);
    }

    // Create new campaign with copied data
    const newId = `camp-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const clonedCampaign = {
      ...campaign,
      id: newId,
      name: `${campaign.name} (Copy)`,
      enabled: false, // Cloned campaigns start disabled
      usageCount: 0,
      totalDiscountGiven: 0,
      totalRevenue: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`campaign:${newId}`, clonedCampaign);

    console.log(`✅ Campaign cloned: ${clonedCampaign.name} (${newId})`);

    return c.json({ success: true, campaign: clonedCampaign }, 201);
  } catch (error) {
    console.log("Error cloning campaign:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Evaluate which discounts apply to a cart
app.post("/make-server-77be783d/campaigns/evaluate", async (c) => {
  try {
    const body = await c.req.json();
    const { cartItems, customerId, customerPhone, subtotal, couponCode } = body;

    console.log('📊 Evaluating campaigns for cart:', { subtotal, cartItemsCount: cartItems.length, customerId });

    // Get all active campaigns from database
    const allCampaigns = await kv.getByPrefix("campaign:");
    console.log(`📋 Found ${allCampaigns.length} total campaigns in database`);

    const now = new Date();
    const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const currentDay = daysOfWeek[now.getDay()];
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM format

    // Filter active campaigns
    const activeCampaigns = allCampaigns.filter((campaign: any) => {
      if (!campaign.enabled) return false;

      // Check date range
      if (campaign.startDate && new Date(campaign.startDate) > now) return false;
      if (campaign.endDate && new Date(campaign.endDate) < now) return false;

      // Check recurring schedule
      if (campaign.recurring && campaign.recurringSchedule?.length > 0) {
        const matchesDay = campaign.recurringSchedule.includes(currentDay) ||
          (campaign.recurringSchedule.includes('weekend') && ['saturday', 'sunday'].includes(currentDay)) ||
          (campaign.recurringSchedule.includes('weekday') && !['saturday', 'sunday'].includes(currentDay));

        if (!matchesDay) return false;
      }

      // Check time slots
      if (campaign.timeSlots?.length > 0) {
        const matchesTime = campaign.timeSlots.some((slot: any) =>
          currentTime >= slot.start && currentTime <= slot.end
        );
        if (!matchesTime) return false;
      }

      // Check coupon code requirement
      if (campaign.requiresCouponCode) {
        if (!couponCode || campaign.couponCode.toLowerCase() !== couponCode.toLowerCase()) {
          return false;
        }
      }

      // Check minimum order value
      if (campaign.minOrderValue && subtotal < campaign.minOrderValue) return false;

      // Check global usage limit
      if (campaign.globalLimit && campaign.usageCount >= campaign.globalLimit) return false;

      // Check customer eligibility
      if (campaign.customerEligibility === 'specific') {
        const eligible = campaign.eligibleCustomers.some((c: string) =>
          c === customerId || c === customerPhone
        );
        if (!eligible) return false;
      }

      return true;
    });

    console.log(`✅ ${activeCampaigns.length} campaigns passed filters`);
    activeCampaigns.forEach((c: any) => {
      console.log(`  - ${c.name} (${c.discountType}, autoApply: ${c.autoApply})`);
    });

    // Sort by priority (higher first)
    activeCampaigns.sort((a: any, b: any) => b.priority - a.priority);

    // Calculate applicable discounts for each campaign
    const applicableDiscounts = activeCampaigns.map((campaign: any) => {
      let discountAmount = 0;
      let affectedItems: any[] = [];

      // Check product eligibility for each cart item
      const eligibleItems = cartItems.filter((item: any) => {
        if (campaign.productEligibility === 'all') return true;

        if (campaign.productEligibility === 'specific') {
          return campaign.eligibleProducts.some((p: string) =>
            p === item.productId || p === item.agiCode
          );
        }

        if (campaign.productEligibility === 'category') {
          return campaign.eligibleCategories.includes(item.category);
        }

        if (campaign.productEligibility === 'excluded') {
          return !campaign.excludedProducts.some((p: string) =>
            p === item.productId || p === item.agiCode
          );
        }

        return false;
      });

      if (eligibleItems.length === 0) return null;

      // Calculate discount based on type
      if (campaign.discountType === 'percentage') {
        const eligibleSubtotal = eligibleItems.reduce((sum: number, item: any) =>
          sum + (item.price * item.quantity), 0
        );
        discountAmount = (eligibleSubtotal * campaign.discountValue) / 100;
        affectedItems = eligibleItems;
      } else if (campaign.discountType === 'fixed') {
        discountAmount = campaign.discountValue;
        affectedItems = eligibleItems;
      } else if (campaign.discountType === 'buyXgetY') {
        const totalQuantity = eligibleItems.reduce((sum: number, item: any) => sum + item.quantity, 0);
        const sets = Math.floor(totalQuantity / (campaign.buyQuantity + campaign.getQuantity));

        if (sets > 0) {
          // Find cheapest items for the free items
          const sortedItems = [...eligibleItems].sort((a, b) => a.price - b.price);
          let freeQuantity = sets * campaign.getQuantity;

          for (const item of sortedItems) {
            const freeFromItem = Math.min(freeQuantity, item.quantity);
            discountAmount += freeFromItem * item.price;
            freeQuantity -= freeFromItem;
            affectedItems.push(item);
            if (freeQuantity <= 0) break;
          }
        }
      } else if (campaign.discountType === 'bundlePrice') {
        const eligibleSubtotal = eligibleItems.reduce((sum: number, item: any) =>
          sum + (item.price * item.quantity), 0
        );
        discountAmount = Math.max(0, eligibleSubtotal - campaign.bundlePrice);
        affectedItems = eligibleItems;
      }

      if (discountAmount <= 0) return null;

      return {
        campaignId: campaign.id,
        campaignName: campaign.name,
        discountType: campaign.discountType,
        discountAmount,
        affectedItems: affectedItems.map(item => item.productId),
        priority: campaign.priority,
        allowStacking: campaign.allowStacking,
        autoApply: campaign.autoApply,
      };
    }).filter(Boolean);

    console.log(`💰 Returning ${applicableDiscounts.length} applicable discounts`);
    applicableDiscounts.forEach((d: any) => {
      console.log(`  - ${d.campaignName}: PKR ${d.discountAmount} (autoApply: ${d.autoApply})`);
    });

    return c.json({ success: true, discounts: applicableDiscounts });
  } catch (error) {
    console.log("❌ Error evaluating campaigns:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Log discount usage
app.post("/make-server-77be783d/discount-logs", async (c) => {
  try {
    const body = await c.req.json();

    const logId = `disc-log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const log = {
      id: logId,
      campaignId: body.campaignId,
      campaignName: body.campaignName,
      saleId: body.saleId,
      customerId: body.customerId || '',
      customerName: body.customerName || '',
      customerPhone: body.customerPhone || '',
      originalSubtotal: body.originalSubtotal,
      discountAmount: body.discountAmount,
      finalTotal: body.finalTotal,
      affectedProducts: body.affectedProducts || [], // array of product IDs
      timestamp: new Date().toISOString(),
      cashier: body.cashier || 'POS System',
    };

    await kv.set(`discount-log:${logId}`, log);

    // Update campaign statistics
    const campaign = await kv.get(`campaign:${body.campaignId}`);
    if (campaign) {
      const updatedCampaign = {
        ...campaign,
        usageCount: (campaign.usageCount || 0) + 1,
        totalDiscountGiven: (campaign.totalDiscountGiven || 0) + body.discountAmount,
        totalRevenue: (campaign.totalRevenue || 0) + body.finalTotal,
        updatedAt: new Date().toISOString(),
      };
      await kv.set(`campaign:${body.campaignId}`, updatedCampaign);
    }

    console.log(`✅ Discount applied: ${body.campaignName} - PKR ${body.discountAmount} (Sale: ${body.saleId})`);

    return c.json({ success: true, log }, 201);
  } catch (error) {
    console.log("Error logging discount usage:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Get all discount logs
app.get("/make-server-77be783d/discount-logs", async (c) => {
  try {
    const logs = await kv.getByPrefix("discount-log:");
    // Sort by timestamp descending (newest first)
    const sortedLogs = logs.sort((a: any, b: any) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    return c.json({ success: true, logs: sortedLogs });
  } catch (error) {
    console.log("Error fetching discount logs:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Get discount logs for specific campaign
app.get("/make-server-77be783d/campaigns/:id/logs", async (c) => {
  try {
    const id = c.req.param("id");
    const allLogs = await kv.getByPrefix("discount-log:");

    const campaignLogs = allLogs.filter((log: any) => log.campaignId === id);

    // Sort by timestamp descending
    const sortedLogs = campaignLogs.sort((a: any, b: any) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return c.json({ success: true, logs: sortedLogs });
  } catch (error) {
    console.log("Error fetching campaign logs:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

Deno.serve(app.fetch);