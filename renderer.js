let allProducts = [];
let cart = [];
let currentCategory = 'All';

// Elements
const productsGrid = document.getElementById('products-grid');
const cartItemsContainer = document.getElementById('cart-items');
const cartTotalElement = document.getElementById('cart-total');
const categoryBtns = document.querySelectorAll('.category-btn');
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

// Category filter
categoryBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        categoryBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentCategory = btn.dataset.category;
        renderProducts();
    });
});

// Order Completion
document.getElementById('btn-complete-order').addEventListener('click', async () => {
    if (cart.length === 0) {
        alert("Cart is empty!");
        return;
    }

    const total = cart.reduce((sum, item) => sum + item.line_total, 0);
    const tokenNumber = await window.api.getNextTokenNumber();
    const datetime = new Date().toLocaleString();

    const orderData = {
        token_number: tokenNumber,
        datetime: datetime,
        total_amount: total
    };

    try {
        await window.api.createOrder(orderData, cart);
        
        // Prepare Printing Content
        const customerSlip = generateSlip(tokenNumber, datetime, cart, total, "CUSTOMER COPY");
        const kitchenSlip = generateSlip(tokenNumber, datetime, cart, total, "KITCHEN COPY", true);
        
        // Print
        window.api.print(customerSlip + "<hr style='border: 1px dashed #000; margin: 20px 0;'>" + kitchenSlip);

        // Reset
        cart = [];
        updateCart();
        alert(`Order #${tokenNumber} Completed!`);
    } catch (err) {
        console.error(err);
        alert("Error saving order");
    }
});

function generateSlip(token, date, items, total, type, isKitchen = false) {
    let itemsHtml = items.map(item => `
        <tr>
            <td>${item.product_name} x ${item.quantity}</td>
            ${isKitchen ? '' : `<td style="text-align: right;">Rs ${item.line_total.toFixed(2)}</td>`}
        </tr>
    `).join('');

    return `
        <div style="width: 300px; font-family: monospace; padding: 20px;">
            <h2 style="text-align: center;">${type}</h2>
            <p style="text-align: center;">TOKEN: ${token}</p>
            <hr>
            <p>Date: ${date}</p>
            <hr>
            <table style="width: 100%;">
                ${itemsHtml}
            </table>
            ${isKitchen ? '' : `
            <hr>
            <p style="font-size: 1.2rem; font-weight: bold; text-align: right;">TOTAL: Rs ${total.toFixed(2)}</p>
            `}
            <hr>
            <p style="text-align: center;">Thank you!</p>
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
