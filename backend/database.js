import sqlite3 from 'sqlite3';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, 'macha_express.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Failed to connect to SQLite database:', err.message);
  } else {
    console.log('Connected to Macha Express SQLite database.');
  }
});

// Helper functions to use async/await with SQLite
export const dbRun = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(query, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
};

export const dbGet = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

export const dbAll = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

// Initialize schema
export const initDatabase = async () => {
  // Create tables
  await dbRun(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      price_per_kg REAL NOT NULL,
      image_url TEXT NOT NULL,
      category TEXT NOT NULL,
      stock_kg REAL NOT NULL
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      total_amount REAL NOT NULL,
      payment_status TEXT NOT NULL, -- 'PENDING', 'PAID', 'FAILED'
      razorpay_order_id TEXT,
      razorpay_payment_id TEXT,
      delivery_address TEXT NOT NULL,
      delivery_slot TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ORDERED', -- 'ORDERED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED'
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id)
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity_kg REAL NOT NULL,
      price REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders (id),
      FOREIGN KEY (product_id) REFERENCES products (id)
    )
  `);

  // Prepopulate products if they do not exist
  const productCount = await dbGet('SELECT COUNT(*) as count FROM products');
  if (productCount.count === 0) {
    const initialProducts = [
      {
        name: 'Fresh Ilishi (Hilsa)',
        description: 'Premium silver hilsa caught fresh from the Bay of Bengal, known for its rich oily texture and signature aroma.',
        price_per_kg: 1250,
        image_url: 'ilishi',
        category: 'Premium Fish',
        stock_kg: 50
      },
      {
        name: 'Chilika Tiger Chingudi (Prawns)',
        description: 'Large, sweet, and juicy tiger prawns sourced directly from the brackish waters of Chilika Lake.',
        price_per_kg: 550,
        image_url: 'chingudi',
        category: 'Prawns & Crabs',
        stock_kg: 80
      },
      {
        name: 'Fresh Ruhi (Rohu)',
        description: 'Local sweetwater Rohu fish, freshly cut and cleaned. Perfect for traditional Odia Macha Besara.',
        price_per_kg: 240,
        image_url: 'ruhi',
        category: 'Freshwater Fish',
        stock_kg: 120
      },
      {
        name: 'Kankada (Mud Crabs)',
        description: 'Live mud crabs with firm, sweet meat, sourced from Balasore coastal creeks.',
        price_per_kg: 600,
        image_url: 'kankada',
        category: 'Prawns & Crabs',
        stock_kg: 40
      },
      {
        name: 'White Pomfret',
        description: 'Premium sea-fresh White Pomfret, cleaned and ready for frying or grilling.',
        price_per_kg: 780,
        image_url: 'pomfret',
        category: 'Premium Fish',
        stock_kg: 35
      },
      {
        name: 'Bhakura (Catla)',
        description: 'Freshly harvested local Catla fish. Thick steaks, excellent for rich, spicy curries.',
        price_per_kg: 260,
        image_url: 'bhakura',
        category: 'Freshwater Fish',
        stock_kg: 100
      },
      {
        name: 'Fresh Bhetki (Barramundi)',
        description: 'Mildly flavored white flaky fish, boneless fillets available. Ideal for Macha Bhaja or fish finger starters.',
        price_per_kg: 680,
        image_url: 'bhetki',
        category: 'Premium Fish',
        stock_kg: 45
      },
      {
        name: 'Fresh Chuna Macha (Small Fish)',
        description: 'Tiny sweetwater silver fish, rich in nutrients. A beloved Odia staple for Chuna Macha Besara or crispy dry fry.',
        price_per_kg: 180,
        image_url: 'chuna',
        category: 'Freshwater Fish',
        stock_kg: 60
      }
    ];

    for (const p of initialProducts) {
      await dbRun(
        'INSERT INTO products (name, description, price_per_kg, image_url, category, stock_kg) VALUES (?, ?, ?, ?, ?, ?)',
        [p.name, p.description, p.price_per_kg, p.image_url, p.category, p.stock_kg]
      );
    }
    console.log('Database seeded with fresh Balasore seafood items.');
  }
};

export default db;
