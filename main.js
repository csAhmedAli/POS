const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const XLSX = require('xlsx-js-style');

const db = require('./database');

// Disable hardware acceleration to fix input lag and rendering issues on Linux/Intel GPUs
app.disableHardwareAcceleration();

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        backgroundColor: '#f4f4f4', // Match the app's background variable
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        },
        title: "POS System"
    });


    mainWindow.loadFile('index.html');
    
    // Check if password exists
    const pwd = db.getPassword();
    mainWindow.webContents.on('did-finish-load', () => {
        if (!pwd) {
            mainWindow.webContents.send('init-setup');
        }
    });

    // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});

// IPC Handlers
ipcMain.handle('db:getProducts', async () => {
    try { return db.getProducts(); } catch (e) { console.error(e); throw e; }
});
ipcMain.handle('db:createOrder', async (event, orderData, items) => {
    try { return db.createOrder(orderData, items); } catch (e) { console.error(e); throw e; }
});
ipcMain.handle('db:getNextTokenNumber', async (event, orderType) => {
    try { return db.getNextTokenNumber(orderType); } catch (e) { console.error(e); throw e; }
});

ipcMain.handle('db:getPassword', async () => {
    try { return db.getPassword(); } catch (e) { console.error(e); throw e; }
});
ipcMain.handle('db:setPassword', async (event, password) => {
    try { 
        return db.setPassword(password); 
    } catch (e) { 
        console.error("Error in setPassword handler:", e); 
        throw e; 
    }
});

// Reports
ipcMain.handle('db:getProductWiseSales', async () => {
    try { return db.getProductWiseSales(); } catch (e) { console.error(e); throw e; }
});
ipcMain.handle('db:getSummary', async () => {
    try { return db.getSummary(); } catch (e) { console.error(e); throw e; }
});
ipcMain.handle('db:getBestWorstSelling', async () => {
    try { return db.getBestWorstSelling(); } catch (e) { console.error(e); throw e; }
});
ipcMain.handle('db:saveDailyReport', async (event, reportData) => {
    try { return db.saveDailyReport(reportData); } catch (e) { console.error(e); throw e; }
});
ipcMain.handle('db:getHistoricalReports', async () => {
    try { return db.getHistoricalReports(); } catch (e) { console.error(e); throw e; }
});
ipcMain.handle('db:getDetailedHistory', async (event, date) => {
    try { return db.getDetailedHistory(date); } catch (e) { console.error(e); throw e; }
});
ipcMain.handle('db:resetTokenNumber', async () => {
    try { return db.resetTokenNumber(); } catch (e) { console.error(e); throw e; }
});

// Product Management
ipcMain.handle('db:addProduct', async (event, product) => {
    try { return db.addProduct(product); } catch (e) { console.error(e); throw e; }
});
ipcMain.handle('db:updateProduct', async (event, product) => {
    try { return db.updateProduct(product); } catch (e) { console.error(e); throw e; }
});
ipcMain.handle('db:deleteProduct', async (event, id) => {
    try { return db.deleteProduct(id); } catch (e) { console.error(e); throw e; }
});

ipcMain.handle('db:getSetting', async (event, key) => {
    try { return db.getSetting(key); } catch (e) { console.error(e); throw e; }
});
ipcMain.handle('db:setSetting', async (event, key, value) => {
    try { return db.setSetting(key, value); } catch (e) { console.error(e); throw e; }
});


// Printing
ipcMain.handle('app:getPrinters', async () => {
    const printers = await mainWindow.webContents.getPrintersAsync();
    return printers.map(p => ({
        name: p.name, // The crucial CUPS internal name
        displayName: p.displayName,
        isDefault: p.isDefault,
        status: p.status
    }));
});

ipcMain.handle('app:checkPrinterStatus', async (event, printerName) => {
    // Linux Implementation (CUPS)
    if (process.platform === 'linux') {
        return new Promise((resolve) => {
            const { exec } = require('child_process');
            exec(`lpstat -p "${printerName}" -l`, (error, stdout, stderr) => {
                if (error) {
                    resolve({ 
                        status: 'offline', 
                        message: stderr || error.message,
                        available: false
                    });
                } else {
                    const isEnabled = stdout.includes('enabled');
                    const isAccepting = stdout.includes('accepting');
                    const isIdle = stdout.includes('idle');
                    
                    resolve({ 
                        status: isEnabled && isAccepting ? 'online' : 'busy',
                        message: stdout,
                        available: true,
                        idle: isIdle,
                        enabled: isEnabled,
                        accepting: isAccepting
                    });
                }
            });
        });
    } 
    // Windows Implementation
    else if (process.platform === 'win32') {
        try {
            const printers = await mainWindow.webContents.getPrintersAsync();
            const printer = printers.find(p => p.name === printerName);
            
            if (!printer) {
                return { status: 'offline', message: 'Printer not found on this system.', available: false };
            }

            // Electron status mapping for Windows:
            // 0: OK, 1: Paused, 2: Error, 3: Pending Deletion, 4: Paper Jam, etc.
            const isOnline = printer.status === 0;
            
            return {
                status: isOnline ? 'online' : 'error/offline',
                message: `Windows Printer Status Code: ${printer.status}`,
                available: true,
                isDefault: printer.isDefault
            };
        } catch (err) {
            return { status: 'error', message: err.message, available: false };
        }
    }
    // Fallback for other OS
    return { status: 'unknown', message: 'OS not supported for detailed status.', available: true };
});

// Basic HTML Sanitization
function sanitizeHTML(html) {
    if (!html) return '';
    return html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
        .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
}

// Print Queue Implementation
class PrintQueue {
    constructor() {
        this.queue = [];
        this.isProcessing = false;
    }

    add(printJob) {
        return new Promise((resolve, reject) => {
            // Wrap the callback to resolve/reject the promise
            const originalCallback = printJob.callback;
            printJob.promiseHandlers = { resolve, reject };
            
            this.queue.push(printJob);
            if (!this.isProcessing) {
                this.process();
            }
        });
    }

    async process() {
        this.isProcessing = true;
        while (this.queue.length > 0) {
            const job = this.queue.shift();
            try {
                await this.executePrint(job);
                await this.delay(500); // 500ms delay between prints
            } catch (error) {
                console.error('Print job failed:', error);
            }
        }
        this.isProcessing = false;
    }

    executePrint(job) {
        return new Promise((resolve, reject) => {
            let printWindow = new BrowserWindow({ 
                show: false,
                webPreferences: { 
                    nodeIntegration: false,
                    contextIsolation: true,
                    sandbox: true
                }
            });
            
            const windowTimeout = setTimeout(() => {
                if (printWindow && !printWindow.isDestroyed()) {
                    console.error('⚠️ Print timeout');
                    printWindow.close();
                    printWindow = null;
                    const err = new Error('Print timeout');
                    if (job.promiseHandlers) job.promiseHandlers.reject(err);
                    reject(err);
                }
            }, 10000);
            
            const safeContent = sanitizeHTML(job.content);
            printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(safeContent)}`);
            
            printWindow.webContents.on('did-finish-load', () => {
                const printOptions = { 
                    silent: true, 
                    printBackground: true,
                    margins: { marginType: 'none' }
                };
                
                if (job.printer) {
                    printOptions.deviceName = job.printer;
                }
                
                printWindow.webContents.print(printOptions, (success, err) => {
                    clearTimeout(windowTimeout);
                    
                    if (job.callback) {
                        job.callback(success, err);
                    }
                    
                    if (printWindow && !printWindow.isDestroyed()) {
                        printWindow.close();
                        printWindow = null;
                    }
                    
                    if (success) {
                        if (job.promiseHandlers) job.promiseHandlers.resolve();
                        resolve();
                    } else {
                        if (job.promiseHandlers) job.promiseHandlers.reject(err);
                        reject(err);
                    }
                });
            });
            
            printWindow.webContents.on('crashed', () => {
                clearTimeout(windowTimeout);
                if (printWindow && !printWindow.isDestroyed()) {
                    printWindow.close();
                    printWindow = null;
                }
                const err = new Error('Print window crashed');
                if (job.promiseHandlers) job.promiseHandlers.reject(err);
                reject(err);
            });
        });
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

const posPrintQueue = new PrintQueue();

ipcMain.handle('app:printDual', async (event, { customerContent, kitchenContent, customerPrinter, kitchenPrinter }) => {
    const results = [];
    
    // Print Customer Receipt
    if (customerContent) {
        results.push(posPrintQueue.add({
            content: customerContent,
            printer: customerPrinter,
            callback: (success, err) => {
                if (!success) {
                    event.sender.send('print-error', { printer: customerPrinter, role: 'customer', error: err });
                } else {
                    event.sender.send('print-success', { printer: customerPrinter, role: 'customer' });
                }
            }
        }));
    }

    // Print Kitchen Receipt
    if (kitchenContent) {
        results.push(posPrintQueue.add({
            content: kitchenContent,
            printer: kitchenPrinter,
            callback: (success, err) => {
                if (!success) {
                    event.sender.send('print-error', { printer: kitchenPrinter, role: 'kitchen', error: err });
                } else {
                    event.sender.send('print-success', { printer: kitchenPrinter, role: 'kitchen' });
                }
            }
        }));
    }

    return Promise.all(results);
});

ipcMain.handle('app:printSingle', async (event, { content, printer }) => {
    if (!content) return;
    return posPrintQueue.add({
        content: content,
        printer: printer,
        callback: (success, err) => {
            if (!success) {
                event.sender.send('print-error', { printer, error: err });
            } else {
                event.sender.send('print-success', { printer });
            }
        }
    });
});

ipcMain.handle('print', async (event, content) => {
    if (!content) return;
    // Route legacy print through the secure queue
    await posPrintQueue.add({
        content: content,
        callback: (success, err) => {
            if (!success) {
                console.error('Legacy print failed:', err);
                event.reply('print-error', { error: err });
            } else {
                event.reply('print-success');
            }
        }
    });

    // Handle second copy if it was intended to be "2 copies"
    // Though usually it's better to manage this in the renderer or as separate jobs.
    // Given the previous code printed twice:
    await posPrintQueue.add({
        content: content,
        callback: (success, err) => {
            if (!success) console.error('Second legacy print failed:', err);
        }
    });
});

// Navigation
ipcMain.on('navigate', (event, page) => {
    mainWindow.loadFile(page);
});

// Excel Export
ipcMain.handle('export:dayReport', async (event, reports) => {
    try {
        const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
            title: 'Export Day Report',
            defaultPath: `POS_Report_${new Date().toISOString().split('T')[0]}.xlsx`,
            filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
        });

        if (canceled || !filePath) return { success: false, reason: 'canceled' };

        const wb = XLSX.utils.book_new();

        // ── Styles ──────────────────────────────────────────
        const STYLE_HEADER = {
            font: { bold: true, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: "2C3E50" } },
            alignment: { horizontal: "center", vertical: "center" }
        };
        const STYLE_ORDER_HEADER = {
            font: { bold: true, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: "2C3E50" } },
            alignment: { horizontal: "left", vertical: "center" }
        };
        const STYLE_PROFIT = {
            font: { color: { rgb: "27AE60" }, bold: true },
            alignment: { horizontal: "right" }
        };
        const STYLE_MONEY = {
            alignment: { horizontal: "right" }
        };
        const STYLE_CENTER = {
            alignment: { horizontal: "center" }
        };

        // Helper to generate a categorical worksheet
        function generateCategoricalWS(items, label = "OVERALL TOTAL:") {
            const catGroups = new Map();
            items.forEach(item => {
                const cat = item.category || 'Uncategorized';
                if (!catGroups.has(cat)) catGroups.set(cat, { name: cat, items: [], total: 0 });
                catGroups.get(cat).items.push(item);
                catGroups.get(cat).total += (item.line_total || 0);
            });

            const rows = [['Product', 'Qty', 'Unit Price', 'Total price']];
            const merges = [];
            const rowMeta = [];

            let grandTotal = 0;
            catGroups.forEach(group => {
                grandTotal += group.total;
                const headerRowIdx = rows.length;
                rows.push([`📂 ${group.name.toUpperCase()}`, '', '', '']);
                merges.push({ s: { r: headerRowIdx, c: 0 }, e: { r: headerRowIdx, c: 3 } });
                rowMeta.push({ type: 'category_header', r: headerRowIdx });

                group.items.forEach(item => {
                    const rIdx = rows.length;
                    rows.push([
                        `    ${item.product_name}`,
                        item.quantity,
                        parseFloat((item.price || 0).toFixed(2)),
                        parseFloat((item.line_total || 0).toFixed(2))
                    ]);
                    rowMeta.push({ type: 'item', r: rIdx });
                });

                const subTotalIdx = rows.length;
                rows.push([`Total ${group.name}:`, '', '', parseFloat(group.total.toFixed(2))]);
                rowMeta.push({ type: 'subtotal', r: subTotalIdx });
            });

            const grandTotalIdx = rows.length;
            rows.push([label, '', '', parseFloat(grandTotal.toFixed(2))]);
            rowMeta.push({ type: 'grandtotal', r: grandTotalIdx });

            const ws = XLSX.utils.aoa_to_sheet(rows);
            ws['!merges'] = merges;
            ws['!cols'] = [{ wch: 40 }, { wch: 8 }, { wch: 12 }, { wch: 12 }];

            rowMeta.forEach(m => {
                if (m.type === 'category_header') {
                    for (let c = 0; c <= 3; c++) {
                        const cell = XLSX.utils.encode_cell({ r: m.r, c });
                        if (!ws[cell]) ws[cell] = { v: '', t: 's' };
                        ws[cell].s = STYLE_ORDER_HEADER;
                    }
                } else if (m.type === 'subtotal' || m.type === 'grandtotal') {
                    for (let c = 0; c <= 3; c++) {
                        const cell = XLSX.utils.encode_cell({ r: m.r, c });
                        if (!ws[cell]) ws[cell] = { v: '', t: 's' };
                        ws[cell].s = (m.type === 'grandtotal') ? STYLE_HEADER : { font: { bold: true }, alignment: { horizontal: (c === 3 ? "right" : "left") } };
                        if (c === 3 && ws[cell]) ws[cell].s = { ...ws[cell].s, ...STYLE_MONEY, font: { bold: true } };
                    }
                } else {
                    [1].forEach(c => {
                        const cell = XLSX.utils.encode_cell({ r: m.r, c });
                        if (ws[cell]) ws[cell].s = STYLE_CENTER;
                    });
                    [2, 3].forEach(c => {
                        const cell = XLSX.utils.encode_cell({ r: m.r, c });
                        if (ws[cell]) ws[cell].s = STYLE_MONEY;
                    });
                }
            });

            ['A1','B1','C1','D1'].forEach(c => { if(ws[c]) ws[c].s = STYLE_HEADER; });
            return ws;
        }

        // ── Sheet 1: Daily Summary ───────────────────────────
        const summaryAOA = [['Date', 'Total Orders', 'Total price (Rs)']];
        reports.forEach(r => {
            summaryAOA.push([
                r.date, r.total_orders,
                parseFloat(r.total_revenue.toFixed(2))
            ]);
        });

        const ws1 = XLSX.utils.aoa_to_sheet(summaryAOA);
        // Apply summary styles
        ['A1','B1','C1'].forEach(c => { if(ws1[c]) ws1[c].s = STYLE_HEADER; });
        ws1['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 15 }];
        XLSX.utils.book_append_sheet(wb, ws1, 'Daily Summary');

        // ── Sheet 2+: Per-day detail (Grouped) ───────────────
        for (const rep of reports) {
            const details = db.getDetailedHistory(rep.date);
            if (!details || details.length === 0) continue;

            const ws = generateCategoricalWS(details, "OVERALL DAY TOTAL:");

            let sheetName = `Detail_${rep.date}`.replace(/[:\\/?*[\]]/g, '-').slice(0, 31);
            let suffix = 2;
            while (wb.SheetNames.includes(sheetName)) {
                sheetName = `Detail_${rep.date}_${suffix}`.replace(/[:\\/?*[\]]/g, '-').slice(0, 31);
                suffix++;
            }
            XLSX.utils.book_append_sheet(wb, ws, sheetName);
        }

        XLSX.writeFile(wb, filePath);
        return { success: true, filePath };
    } catch (err) {
        console.error('Export failed:', err);
        return { success: false, reason: err.message };
    }
});

// Overall All-Time Sales Export
ipcMain.handle('export:overallSales', async (event, salesData) => {
    try {
        const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
            title: 'Export Overall Sales',
            defaultPath: `Overall_Sales_${new Date().toISOString().split('T')[0]}.xlsx`,
            filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
        });

        if (canceled || !filePath) return { success: false, reason: 'canceled' };

        const wb = XLSX.utils.book_new();

        // ── Styles (Redefined for this handler) ─────────────
        const STYLES = getExcelStyles(); // I'll extract these to a helper

        const generateCategoricalWS = (items, label = "OVERALL TOTAL:") => {
            const catGroups = new Map();
            items.forEach(item => {
                const cat = item.category || 'Uncategorized';
                if (!catGroups.has(cat)) catGroups.set(cat, { name: cat, items: [], total: 0 });
                catGroups.get(cat).items.push(item);
                catGroups.get(cat).total += (item.total_revenue || item.line_total || 0);
            });

            const rows = [['Product', 'Qty', 'Unit Price', 'Total price']];
            const merges = [];
            const rowMeta = [];

            let grandTotal = 0;
            catGroups.forEach(group => {
                grandTotal += group.total;
                const headerRowIdx = rows.length;
                rows.push([`📂 ${group.name.toUpperCase()}`, '', '', '']);
                merges.push({ s: { r: headerRowIdx, c: 0 }, e: { r: headerRowIdx, c: 3 } });
                rowMeta.push({ type: 'category_header', r: headerRowIdx });

                group.items.forEach(item => {
                    const rIdx = rows.length;
                    rows.push([
                        `    ${item.product_name}`,
                        item.total_quantity || item.quantity,
                        parseFloat((item.unit_price || item.price || 0).toFixed(2)),
                        parseFloat((item.total_revenue || item.line_total || 0).toFixed(2))
                    ]);
                    rowMeta.push({ type: 'item', r: rIdx });
                });

                const subTotalIdx = rows.length;
                rows.push([`Total ${group.name}:`, '', '', parseFloat(group.total.toFixed(2))]);
                rowMeta.push({ type: 'subtotal', r: subTotalIdx });
            });

            const grandTotalIdx = rows.length;
            rows.push([label, '', '', parseFloat(grandTotal.toFixed(2))]);
            rowMeta.push({ type: 'grandtotal', r: grandTotalIdx });

            const ws = XLSX.utils.aoa_to_sheet(rows);
            ws['!merges'] = merges;
            ws['!cols'] = [{ wch: 40 }, { wch: 8 }, { wch: 12 }, { wch: 12 }];

            rowMeta.forEach(m => {
                if (m.type === 'category_header') {
                    for (let c = 0; c <= 3; c++) {
                        const cell = XLSX.utils.encode_cell({ r: m.r, c });
                        if (!ws[cell]) ws[cell] = { v: '', t: 's' };
                        ws[cell].s = STYLES.HEADER_ORDER;
                    }
                } else if (m.type === 'subtotal' || m.type === 'grandtotal') {
                    for (let c = 0; c <= 3; c++) {
                        const cell = XLSX.utils.encode_cell({ r: m.r, c });
                        if (!ws[cell]) ws[cell] = { v: '', t: 's' };
                        ws[cell].s = (m.type === 'grandtotal') ? STYLES.HEADER : { font: { bold: true }, alignment: { horizontal: (c === 3 ? "right" : "left") } };
                        if (c === 3 && ws[cell]) ws[cell].s = { ...ws[cell].s, ...STYLES.MONEY, font: { bold: true } };
                    }
                } else {
                    [1].forEach(c => {
                        const cell = XLSX.utils.encode_cell({ r: m.r, c });
                        if (ws[cell]) ws[cell].s = STYLES.CENTER;
                    });
                    [2, 3].forEach(c => {
                        const cell = XLSX.utils.encode_cell({ r: m.r, c });
                        if (ws[cell]) ws[cell].s = STYLES.MONEY;
                    });
                }
            });

            ['A1','B1','C1','D1'].forEach(c => { if(ws[c]) ws[c].s = STYLES.HEADER; });
            return ws;
        };

        const ws = generateCategoricalWS(salesData, "OVERALL ALL-TIME TOTAL:");
        XLSX.utils.book_append_sheet(wb, ws, 'Overall Sales');

        XLSX.writeFile(wb, filePath);
        return { success: true, filePath };
    } catch (err) {
        console.error('Overall export failed:', err);
        return { success: false, reason: err.message };
    }
});

// Single Day Export
ipcMain.handle('export:singleDayReport', async (event, date, items) => {
    try {
        const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
            title: `Export Sales Details — ${date}`,
            defaultPath: `Sales_Details_${date}.xlsx`,
            filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
        });

        if (canceled || !filePath) return { success: false, reason: 'canceled' };

        const wb = XLSX.utils.book_new();
        const STYLES = getExcelStyles();

        // Same helper again... I should REALLY put this outside
        const generateCategoricalWS = (items, label = "OVERALL TOTAL:") => {
            const catGroups = new Map();
            items.forEach(item => {
                const cat = item.category || 'Uncategorized';
                if (!catGroups.has(cat)) catGroups.set(cat, { name: cat, items: [], total: 0 });
                catGroups.get(cat).items.push(item);
                catGroups.get(cat).total += (item.line_total || 0);
            });

            const rows = [['Product', 'Qty', 'Unit Price', 'Total price']];
            const merges = [];
            const rowMeta = [];

            let grandTotal = 0;
            catGroups.forEach(group => {
                grandTotal += group.total;
                const headerRowIdx = rows.length;
                rows.push([`📂 ${group.name.toUpperCase()}`, '', '', '']);
                merges.push({ s: { r: headerRowIdx, c: 0 }, e: { r: headerRowIdx, c: 3 } });
                rowMeta.push({ type: 'category_header', r: headerRowIdx });

                group.items.forEach(item => {
                    const rIdx = rows.length;
                    rows.push([
                        `    ${item.product_name}`,
                        item.quantity,
                        parseFloat((item.price || 0).toFixed(2)),
                        parseFloat((item.line_total || 0).toFixed(2))
                    ]);
                    rowMeta.push({ type: 'item', r: rIdx });
                });

                const subTotalIdx = rows.length;
                rows.push([`Total ${group.name}:`, '', '', parseFloat(group.total.toFixed(2))]);
                rowMeta.push({ type: 'subtotal', r: subTotalIdx });
            });

            const grandTotalIdx = rows.length;
            rows.push([label, '', '', parseFloat(grandTotal.toFixed(2))]);
            rowMeta.push({ type: 'grandtotal', r: grandTotalIdx });

            const ws = XLSX.utils.aoa_to_sheet(rows);
            ws['!merges'] = merges;
            ws['!cols'] = [{ wch: 40 }, { wch: 8 }, { wch: 12 }, { wch: 12 }];

            rowMeta.forEach(m => {
                if (m.type === 'category_header') {
                    for (let c = 0; c <= 3; c++) {
                        const cell = XLSX.utils.encode_cell({ r: m.r, c });
                        if (!ws[cell]) ws[cell] = { v: '', t: 's' };
                        ws[cell].s = STYLES.HEADER_ORDER;
                    }
                } else if (m.type === 'subtotal' || m.type === 'grandtotal') {
                    for (let c = 0; c <= 3; c++) {
                        const cell = XLSX.utils.encode_cell({ r: m.r, c });
                        if (!ws[cell]) ws[cell] = { v: '', t: 's' };
                        ws[cell].s = (m.type === 'grandtotal') ? STYLES.HEADER : { font: { bold: true }, alignment: { horizontal: (c === 3 ? "right" : "left") } };
                        if (c === 3 && ws[cell]) ws[cell].s = { ...ws[cell].s, ...STYLES.MONEY, font: { bold: true } };
                    }
                } else {
                    [1].forEach(c => {
                        const cell = XLSX.utils.encode_cell({ r: m.r, c });
                        if (ws[cell]) ws[cell].s = STYLES.CENTER;
                    });
                    [2, 3].forEach(c => {
                        const cell = XLSX.utils.encode_cell({ r: m.r, c });
                        if (ws[cell]) ws[cell].s = STYLES.MONEY;
                    });
                }
            });

            ['A1','B1','C1','D1'].forEach(c => { if(ws[c]) ws[c].s = STYLES.HEADER; });
            return ws;
        };

        const ws = generateCategoricalWS(items, "OVERALL DAY TOTAL:");
        XLSX.utils.book_append_sheet(wb, ws, `Sales_${date}`);

        XLSX.writeFile(wb, filePath);
        return { success: true, filePath };
    } catch (err) {
        console.error('Day export failed:', err);
        return { success: false, reason: err.message };
    }
});

function getExcelStyles() {
    return {
        HEADER: {
            font: { bold: true, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: "2C3E50" } },
            alignment: { horizontal: "center", vertical: "center" }
        },
        HEADER_ORDER: {
            font: { bold: true, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: "2C3E50" } },
            alignment: { horizontal: "left", vertical: "center" }
        },
        MONEY: {
            alignment: { horizontal: "right" }
        },
        CENTER: {
            alignment: { horizontal: "center" }
        }
    };
}
