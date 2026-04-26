let allProducts = [];
let cart = [];
let currentCategory = 'All';

// Elements
const productsGrid = document.getElementById('products-grid');
const cartItemsContainer = document.getElementById('cart-items');
const cartTotalElement = document.getElementById('cart-total');
const categoriesList = document.getElementById('categories-list');
const setupOverlay = document.getElementById('setup-overlay');

const loginOverlay = document.getElementById('login-overlay');

// Initialize
async function init() {
    try {
        allProducts = await window.api.getProducts();
        const password = await window.api.getPassword();
        
        if (!password) {
            setupOverlay.classList.remove('hidden');
        } else if (!sessionStorage.getItem('isLoggedIn')) {
            loginOverlay.classList.remove('hidden');
        }

        renderCategories();
        renderProducts();

    } catch (err) {
        console.error("Initialization error:", err);
        // Even if DB fails, check setup status if possible, or show a clear error
        // For now, if getPassword fails, assume first run if err is DB related
        setupOverlay.classList.remove('hidden');
    }
}

// Render Products
function renderProducts() {
    productsGrid.innerHTML = '';
    const filteredProducts = currentCategory === 'All' 
        ? allProducts 
        : allProducts.filter(p => p.category === currentCategory);

    filteredProducts.forEach(product => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
            <h3>${product.name}</h3>
            <p class="price">Rs ${product.price.toFixed(2)}</p>
            <button class="btn-add" onclick="addToCart(${product.id})">Add to Cart</button>
        `;
        productsGrid.appendChild(card);
    });
}

// Render Categories
function renderCategories() {
    categoriesList.innerHTML = '';
    
    // Get unique categories from products
    const uniqueCategories = ['All', ...new Set(allProducts.map(p => p.category))];

    uniqueCategories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = `category-btn \${currentCategory === cat ? 'active' : ''}`;
        btn.innerText = cat === 'All' ? 'All Items' : cat;
        btn.dataset.category = cat;
        
        btn.onclick = () => {
            const allBtns = categoriesList.querySelectorAll('.category-btn');
            allBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentCategory = cat;
            renderProducts();
        };
        
        categoriesList.appendChild(btn);
    });
}


// Cart Logic
window.addToCart = (productId) => {
    const product = allProducts.find(p => p.id === productId);
    const existing = cart.find(item => item.product_id === productId);

    if (existing) {
        existing.quantity++;
        existing.line_total = existing.quantity * existing.price;
    } else {
        cart.push({
            product_id: product.id,
            product_name: product.name,
            price: product.price,
            cost: product.cost,
            quantity: 1,
            line_total: product.price
        });
    }
    updateCart();
};

function updateCart() {
    cartItemsContainer.innerHTML = '';
    let total = 0;

    cart.forEach((item, index) => {
        total += item.line_total;
        const div = document.createElement('div');
        div.className = 'cart-item';
        div.innerHTML = `
            <div class="cart-item-info">
                <div>${item.product_name}</div>
                <small>Rs ${item.price.toFixed(2)}</x-small>
            </div>
            <div class="cart-item-qty">
                <button onclick="changeQty(${index}, -1)">-</button>
                <span>${item.quantity}</span>
                <button onclick="changeQty(${index}, 1)">+</button>
            </div>
            <div style="margin-left: 10px;">Rs ${item.line_total.toFixed(2)}</div>
        `;
        cartItemsContainer.appendChild(div);
    });

    cartTotalElement.innerText = `Rs ${total.toFixed(2)}`;
}

window.changeQty = (index, delta) => {
    cart[index].quantity += delta;
    if (cart[index].quantity <= 0) {
        cart.splice(index, 1);
    } else {
        cart[index].line_total = cart[index].quantity * cart[index].price;
    }
    updateCart();
};



// Order Completion
async function completeOrder(orderType) {
    if (cart.length === 0) {
        alert("Cart is empty!");
        return;
    }

    const total = cart.reduce((sum, item) => sum + item.line_total, 0);
    const tokenNumber = await window.api.getNextTokenNumber(orderType);
    const datetime = new Date().toLocaleString();


    const orderData = {
        token_number: tokenNumber,
        datetime: datetime,
        total_amount: total,
        order_type: orderType
    };

    try {
        await window.api.createOrder(orderData, cart);
        
        // Fetch Printer Settings
        const customerPrinter = await window.api.getSetting('printer_customer');
        const kitchenPrinter = await window.api.getSetting('printer_chef');

        // Prepare Printing Content
        const customerSlip = generateCustomerSlip(tokenNumber, datetime, cart, total, orderType);
        const kitchenSlip = generateKitchenSlip(tokenNumber, datetime, cart, orderType);
        
        // Print Dual
        window.api.printDual({
            customerContent: customerSlip,
            customerPrinter: customerPrinter,
            kitchenContent: kitchenSlip,
            kitchenPrinter: kitchenPrinter
        });

        // Reset
        cart = [];
        updateCart();
        alert(`${orderType} Order #${tokenNumber} Completed!`);
    } catch (err) {
        console.error(err);
        alert("Error saving order");
    }
}

document.getElementById('btn-dine-in').addEventListener('click', () => completeOrder('Dine-In'));
document.getElementById('btn-takeaway').addEventListener('click', () => completeOrder('Takeaway'));

function generateCustomerSlip(token, date, items, total, orderType) {
    const isDineIn = orderType === 'Dine-In';
    const copyTitle = isDineIn ? "WAITER COPY" : "CUSTOMER COPY";
    
    let itemsHtml = items.map(item => `
        <tr style="border-bottom: 1px dashed #eee;">
            <td style="padding: 5px 0;">${item.product_name} x ${item.quantity}</td>
            <td style="text-align: right;">Rs ${item.line_total.toFixed(2)}</td>
        </tr>
    `).join('');

    return `
        <div style="width: 190px; font-family: 'Courier New', Courier, monospace; padding: 5px; color: #000; background: #fff; font-size: 12px;">
            <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 5px; margin-bottom: 8px;">
                <h1 style="margin: 0; font-size: 1.2rem;">POS SYSTEM</h1>
                <p style="margin: 2px 0; font-weight: bold;">[ ${orderType.toUpperCase()} ]</p>
                <p style="margin: 2px 0; font-size: 0.8rem; border: 1px solid #000; display: inline-block; padding: 1px 5px;">${copyTitle}</p>
                <div style="font-size: 1.8rem; font-weight: bold; margin: 5px 0;">TOKEN: ${token}</div>
            </div>

            <p style="font-size: 0.8rem; margin-bottom: 10px;">Date: ${date}</p>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 10px;">
                ${itemsHtml}
            </table>
            <div style="border-top: 2px solid #000; padding-top: 10px; text-align: right;">
                <div style="font-size: 1.5rem; font-weight: bold;">TOTAL: Rs ${total.toFixed(2)}</div>
            </div>

            <div style="text-align: center; margin-top: 20px; border-top: 1px dashed #000; padding-top: 10px;">
                ${isDineIn ? '<p style="margin: 0; font-weight: bold;">Waiter: Keep this for delivery</p>' : '<p style="margin: 0;">Thank you for your visit!</p>'}
                <p style="margin: 5px 0 0; font-size: 0.7rem;">Powered by Antigravity POS</p>
            </div>
        </div>
    `;
}

function generateKitchenSlip(token, date, items, orderType) {
    let itemsHtml = items.map(item => `
        <tr style="border-bottom: 2px solid #000;">
            <td style="padding: 10px 0; font-size: 1.8rem; font-weight: bold;">
                ${item.quantity} x ${item.product_name}
            </td>
        </tr>
    `).join('');

    return `
        <div style="width: 190px; font-family: Arial, sans-serif; padding: 5px; color: #000; background: #fff;">
            <div style="text-align: center; border-bottom: 4px solid #000; padding-bottom: 5px; margin-bottom: 8px;">
                <h1 style="margin: 0; font-size: 1.5rem;">KITCHEN ORDER</h1>
                <p style="margin: 2px 0; font-size: 1.4rem; font-weight: bold; background: #000; color: #fff; display: inline-block; padding: 0 10px;">${orderType.toUpperCase()}</p>
                <div style="font-size: 3rem; font-weight: bold; margin: 5px 0;"># ${token}</div>
            </div>

            <p style="font-size: 1rem; margin-bottom: 10px;">Date: ${date}</p>
            <table style="width: 100%; border-collapse: collapse;">
                ${itemsHtml}
            </table>
            <div style="text-align: center; margin-top: 20px; border-top: 2px solid #000; padding-top: 10px;">
                <p style="margin: 0; font-weight: bold; font-size: 1.2rem;">*** NEW ORDER ***</p>
            </div>
        </div>
    `;
}



// Auth Handlers
document.getElementById('btn-save-setup').addEventListener('click', async () => {
    const p1 = document.getElementById('setup-pwd').value;
    const p2 = document.getElementById('setup-pwd-confirm').value;
    if (p1 && p1.length > 0 && p1 === p2) {
        try {
            await window.api.setPassword(p1);
            setupOverlay.classList.add('hidden');
            sessionStorage.setItem('isLoggedIn', 'true');
            alert("Password set successfully!");
            location.reload(); // Reload to refresh state
        } catch (err) {
            console.error("Failed to set password:", err);
            alert("Error saving password: " + err.message);
        }
    } else {
        alert("Passwords do not match or are empty!");
    }
});

document.getElementById('btn-login').addEventListener('click', async () => {
    const pwd = document.getElementById('login-pwd').value;
    const correctPwd = await window.api.getPassword();
    if (pwd === correctPwd) {
        loginOverlay.classList.add('hidden');
        sessionStorage.setItem('isLoggedIn', 'true');
    } else {
        alert("Incorrect password!");
    }
});

document.getElementById('btn-day-end').addEventListener('click', async () => {
    if (confirm("Are you sure you want to end the day and save the report?")) {
        try {
            const summary = await window.api.getSummary();
            const reportData = {
                date: new Date().toISOString().split('T')[0],
                total_orders: summary.total_orders || 0,
                total_revenue: summary.total_revenue || 0,
                total_cost: summary.total_cost || 0,
                net_profit: (summary.total_revenue || 0) - (summary.total_cost || 0)
            };
            
            if (reportData.total_orders > 0) {
                await window.api.saveDailyReport(reportData);
                await window.api.resetTokenNumber(); // Reset token to 0 for next day
                alert("Day ended and report saved! Token counter reset.");
            }
            window.api.navigateTo('reports.html');
        } catch (err) {
            console.error("Failed to save daily report:", err);
            alert("Error saving daily report. Navigating to reports anyway.");
            window.api.navigateTo('reports.html');
        }
    }
});

document.getElementById('btn-logout').addEventListener('click', () => {
    sessionStorage.removeItem('isLoggedIn');
    location.reload();
});

// Navigation
document.getElementById('nav-reports').addEventListener('click', () => window.api.navigateTo('reports.html'));
document.getElementById('nav-settings').addEventListener('click', () => window.api.navigateTo('settings.html'));
document.getElementById('nav-pos').addEventListener('click', () => window.api.navigateTo('index.html'));
document.getElementById('nav-products').addEventListener('click', () => window.api.navigateTo('products.html'));

init();
