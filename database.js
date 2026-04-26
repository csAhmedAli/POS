const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');

// Use user data directory for the database file in production, or local dir in dev
const dbPath = process.env.NODE_ENV === 'development' 
    ? path.join(__dirname, 'pos.db')
    : path.join(app.getPath('userData'), 'pos.db');

const db = new Database(dbPath);

// Initialize Tables
function initDB() {
    // Products Table
    db.prepare(`
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            price REAL NOT NULL,
            cost REAL NOT NULL
        )
    `).run();

    // Orders Table
    db.prepare(`
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            token_number INTEGER NOT NULL,
            datetime TEXT NOT NULL,
            total_amount REAL NOT NULL,
            order_type TEXT NOT NULL DEFAULT 'Takeaway'
        )

    `).run();

    // Migration: Ensure order_type exists in orders table
    try {
        db.prepare("ALTER TABLE orders ADD COLUMN order_type TEXT NOT NULL DEFAULT 'Takeaway'").run();
    } catch (e) {
        // Column already exists or table doesn't exist yet (handled by CREATE TABLE above)
        if (!e.message.includes('duplicate column name')) {
            console.error("Migration error (order_type):", e.message);
        }
    }


    // Order Items Table
    db.prepare(`
        CREATE TABLE IF NOT EXISTS order_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            product_name TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            price REAL NOT NULL,
            cost REAL NOT NULL,
            line_total REAL NOT NULL,
            category TEXT,
            FOREIGN KEY (order_id) REFERENCES orders(id)
        )
    `).run();

    // Migration: Ensure category exists in order_items
    try {
        db.prepare("ALTER TABLE order_items ADD COLUMN category TEXT").run();
    } catch (e) {
        if (!e.message.includes('duplicate column name')) {
            console.error("Migration error (category):", e.message);
        }
    }

    // Settings Table
    db.prepare(`
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
    `).run();

    // Daily Reports Table (Snapshot)
    db.prepare(`
        CREATE TABLE IF NOT EXISTS daily_reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            total_orders INTEGER NOT NULL,
            total_revenue REAL NOT NULL,
            total_cost REAL NOT NULL,
            net_profit REAL NOT NULL
        )
    `).run();

}

// Function to wipe everything for a clean start (User requested this)
function factoryReset() {
    db.prepare('DELETE FROM products').run();
    db.prepare('DELETE FROM orders').run();
    db.prepare('DELETE FROM order_items').run();
    db.prepare('DELETE FROM settings').run();
    db.prepare('DELETE FROM daily_reports').run();
    // Vacuum to shrink file size
    db.prepare('VACUUM').run();
}

initDB();
// Uncomment the line below once if you want to wipe everything again
// factoryReset();

module.exports = {
    // Settings
    getPassword: () => {
        const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('password');
        return row ? row.value : null;
    },
    setPassword: (password) => {
        if (!password) {
            throw new Error("Password cannot be empty");
        }
        db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('password', password);
    },
    getSetting: (key) => {
        const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
        return row ? row.value : null;
    },
    setSetting: (key, value) => {
        db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
    },

    // Products

    getProducts: () => {
        return db.prepare('SELECT * FROM products').all();
    },

    // Orders
    getNextTokenNumber: (orderType) => {
        const key = orderType === 'Dine-In' ? 'last_token_dinein' : 'last_token_takeaway';
        const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
        const nextToken = (parseInt(row ? row.value : 0) || 0) + 1;
        db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, nextToken.toString());
        return nextToken;
    },

    resetTokenNumber: () => {
        db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('last_token_dinein', '0');
        db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('last_token_takeaway', '0');
        db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('last_token', '0'); // Legacy support
    },

    createOrder: (orderData, items) => {
        const insertOrder = db.prepare('INSERT INTO orders (token_number, datetime, total_amount, order_type) VALUES (?, ?, ?, ?)');

        const insertItem = db.prepare('INSERT INTO order_items (order_id, product_id, product_name, quantity, price, cost, line_total, category) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');

        // Ensure datetime is ISO for better querying
        const isoDate = new Date().toISOString();

        const transaction = db.transaction((order, items) => {
            const info = insertOrder.run(order.token_number, isoDate, order.total_amount, order.order_type || 'Takeaway');

            const orderId = info.lastInsertRowid;
            for (const item of items) {
                insertItem.run(orderId, item.product_id, item.product_name, item.quantity, item.price, item.cost, item.line_total, item.category);
            }
            return orderId;
        });

        return transaction(orderData, items);
    },

    // Reports
    getDetailedHistory: (dateStr) => {
        // dateStr is expected as YYYY-MM-DD
        return db.prepare(`
            SELECT 
                o.id as order_id,
                o.token_number, 
                o.datetime, 
                o.order_type,
                oi.id as item_id,

                oi.product_name, 
                oi.quantity, 
                oi.price, 
                oi.line_total,
                oi.category
            FROM orders o
            JOIN order_items oi ON o.id = oi.order_id
            WHERE o.datetime LIKE ?
            ORDER BY o.id ASC, oi.id ASC
        `).all(`${dateStr}%`);
    },
    getProductWiseSales: () => {
        return db.prepare(`
            SELECT 
                category,
                product_name,
                price as unit_price,
                COALESCE(SUM(quantity), 0) as total_quantity,
                COALESCE(SUM(line_total), 0) as total_revenue
            FROM order_items
            GROUP BY category, product_name, price
            ORDER BY category ASC, total_quantity DESC
        `).all();
    },
    getSummary: () => {
        return db.prepare(`
            SELECT 
                COUNT(*) as total_orders,
                SUM(total_amount) as total_revenue,
                (SELECT SUM(cost * quantity) FROM order_items) as total_cost
            FROM orders
        `).get();
    },
    getBestWorstSelling: () => {
        const rows = db.prepare(`
            SELECT product_name, SUM(quantity) as total_qty 
            FROM order_items 
            GROUP BY product_name 
            ORDER BY total_qty DESC
        `).all();
        if (!rows || rows.length === 0) {
            return { best: null, worst: null };
        }
        const best = rows[0];
        const worst = rows[rows.length - 1];
        return { best, worst };
    },
    saveDailyReport: (reportData) => {
        return db.prepare(`
            INSERT INTO daily_reports (date, total_orders, total_revenue, total_cost, net_profit)
            VALUES (?, ?, ?, ?, ?)
        `).run(reportData.date, reportData.total_orders, reportData.total_revenue, reportData.total_cost, reportData.net_profit);
    },
    getHistoricalReports: () => {
        return db.prepare('SELECT * FROM daily_reports ORDER BY id DESC').all();
    },

    // Product Management
    addProduct: (product) => {
        return db.prepare('INSERT INTO products (name, category, price, cost) VALUES (?, ?, ?, ?)').run(product.name, product.category, product.price, product.cost);
    },
    updateProduct: (product) => {
        return db.prepare('UPDATE products SET name = ?, category = ?, price = ?, cost = ? WHERE id = ?').run(product.name, product.category, product.price, product.cost, product.id);
    },
    deleteProduct: (id) => {
        return db.prepare('DELETE FROM products WHERE id = ?').run(id);
    }
};
