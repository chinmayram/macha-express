import express from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { dbRun, dbGet, dbAll } from './database.js';

const router = express.Router();

// Initialize Razorpay client. If keys are missing, we will fall back to mock mode.
let razorpay = null;
const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

if (keyId && keySecret) {
  try {
    razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
    console.log('Razorpay SDK initialized successfully in LIVE/TEST mode.');
  } catch (err) {
    console.error('Error initializing Razorpay SDK, running in MOCK mode:', err.message);
  }
} else {
  console.log('Razorpay credentials not found in env. Running in interactive MOCK mode for checkout.');
}

// 1. User Login / Registration
router.post('/users/login', async (req, res) => {
  const { phone, name, address } = req.body;
  if (!phone || !name) {
    return res.status(400).json({ error: 'Phone number and name are required' });
  }

  try {
    let user = await dbGet('SELECT * FROM users WHERE phone = ?', [phone]);
    if (!user) {
      const result = await dbRun(
        'INSERT INTO users (phone, name, address) VALUES (?, ?, ?)',
        [phone, name, address || '']
      );
      user = { id: result.id, phone, name, address: address || '' };
    } else if (address && user.address !== address) {
      // Update address if a new one is provided
      await dbRun('UPDATE users SET address = ? WHERE id = ?', [address, user.id]);
      user.address = address;
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Fetch Products
router.get('/products', async (req, res) => {
  try {
    const products = await dbAll('SELECT * FROM products');
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Create Order
router.post('/orders', async (req, res) => {
  const { user_id, items, delivery_address, delivery_slot, total_amount } = req.body;

  if (!user_id || !items || !items.length || !delivery_address || !delivery_slot || !total_amount) {
    return res.status(400).json({ error: 'Missing required order fields' });
  }

  try {
    // Generate internal receipt reference
    const orderRef = `rcpt_${Date.now()}`;
    let razorpayOrderId = null;
    let isMock = true;

    if (razorpay) {
      try {
        // Amount in paise (1 INR = 100 Paise)
        const rpOrder = await razorpay.orders.create({
          amount: Math.round(total_amount * 100),
          currency: 'INR',
          receipt: orderRef,
        });
        razorpayOrderId = rpOrder.id;
        isMock = false;
      } catch (err) {
        console.error('Razorpay Order creation failed, falling back to mock:', err.message);
        razorpayOrderId = `order_mock_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      }
    } else {
      razorpayOrderId = `order_mock_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    }

    // Save order in SQLite
    const orderResult = await dbRun(
      `INSERT INTO orders (user_id, total_amount, payment_status, razorpay_order_id, delivery_address, delivery_slot, status) 
       VALUES (?, ?, 'PENDING', ?, ?, ?, 'ORDERED')`,
      [user_id, total_amount, razorpayOrderId, delivery_address, delivery_slot]
    );
    const orderId = orderResult.id;

    // Save items
    for (const item of items) {
      await dbRun(
        'INSERT INTO order_items (order_id, product_id, quantity_kg, price) VALUES (?, ?, ?, ?)',
        [orderId, item.product_id, item.quantity_kg, item.price]
      );
    }

    res.json({
      success: true,
      order_id: orderId,
      razorpay_order_id: razorpayOrderId,
      amount: total_amount,
      currency: 'INR',
      key_id: keyId || 'rzp_test_mockKey123',
      is_mock: isMock
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Verify Payment Signature
router.post('/orders/verify', async (req, res) => {
  const { order_id, razorpay_order_id, razorpay_payment_id, razorpay_signature, is_mock } = req.body;

  if (!order_id || !razorpay_order_id) {
    return res.status(400).json({ error: 'Missing validation details' });
  }

  try {
    let verified = false;

    if (is_mock || !razorpay) {
      // Mock payment verification succeeds automatically
      verified = true;
    } else {
      // Verify signature via crypto
      const body = razorpay_order_id + '|' + razorpay_payment_id;
      const expectedSignature = crypto
        .createHmac('sha256', keySecret)
        .update(body.toString())
        .digest('hex');

      if (expectedSignature === razorpay_signature) {
        verified = true;
      }
    }

    if (verified) {
      // Update SQLite Order Status
      await dbRun(
        'UPDATE orders SET payment_status = "PAID", razorpay_payment_id = ? WHERE id = ?',
        [razorpay_payment_id || `pay_mock_${Date.now()}`, order_id]
      );

      // Deduct product stock
      const items = await dbAll('SELECT product_id, quantity_kg FROM order_items WHERE order_id = ?', [order_id]);
      for (const item of items) {
        await dbRun(
          'UPDATE products SET stock_kg = MAX(0, stock_kg - ?) WHERE id = ?',
          [item.quantity_kg, item.product_id]
        );
      }

      res.json({ success: true, message: 'Payment verified and order confirmed successfully' });
    } else {
      await dbRun('UPDATE orders SET payment_status = "FAILED" WHERE id = ?', [order_id]);
      res.status(400).json({ success: false, message: 'Invalid payment signature verification' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Get User Orders
router.get('/orders/user/:phone', async (req, res) => {
  const { phone } = req.params;
  try {
    const user = await dbGet('SELECT id FROM users WHERE phone = ?', [phone]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const orders = await dbAll(
      'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC',
      [user.id]
    );

    // Fetch items for each order
    const detailedOrders = [];
    for (const order of orders) {
      const items = await dbAll(
        `SELECT oi.*, p.name as product_name, p.image_url 
         FROM order_items oi 
         JOIN products p ON oi.product_id = p.id 
         WHERE oi.order_id = ?`,
        [order.id]
      );
      detailedOrders.push({ ...order, items });
    }

    res.json(detailedOrders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Get Single Order Detail (For status tracker)
router.get('/orders/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const order = await dbGet('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const items = await dbAll(
      `SELECT oi.*, p.name as product_name, p.image_url 
       FROM order_items oi 
       JOIN products p ON oi.product_id = p.id 
       WHERE oi.order_id = ?`,
      [order.id]
    );

    // Mock progress over time for testing convenience (ORDERED -> PREPARING -> OUT_FOR_DELIVERY -> DELIVERED)
    // In a real application this would be updated by delivery agents, but here we can simulate it for visual tracking!
    const timeDiffMinutes = (Date.now() - new Date(order.created_at).getTime()) / (1000 * 60);
    let currentStatus = order.status;

    if (order.payment_status === 'PAID' && order.status !== 'DELIVERED') {
      if (timeDiffMinutes > 15) {
        currentStatus = 'DELIVERED';
      } else if (timeDiffMinutes > 10) {
        currentStatus = 'OUT_FOR_DELIVERY';
      } else if (timeDiffMinutes > 5) {
        currentStatus = 'PREPARING';
      }

      if (currentStatus !== order.status) {
        await dbRun('UPDATE orders SET status = ? WHERE id = ?', [currentStatus, order.id]);
        order.status = currentStatus;
      }
    }

    res.json({ ...order, items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
