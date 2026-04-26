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
    return mainWindow.webContents.getPrintersAsync();
});

ipcMain.on('print-dual', (event, { customerContent, kitchenContent, customerPrinter, kitchenPrinter }) => {
    // Print Customer Receipt
    if (customerContent) {
        let customerWindow = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: true, contextIsolation: false } });
        customerWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(customerContent)}`);
        customerWindow.webContents.on('did-finish-load', () => {
            const printOptions = { silent: true, printBackground: true };
            if (customerPrinter) printOptions.deviceName = customerPrinter;
            customerWindow.webContents.print(printOptions, (success, err) => {
                if (!success) console.error('Customer print failed:', err);
                customerWindow.close();
            });
        });
    }

    // Print Kitchen Receipt
    if (kitchenContent) {
        let kitchenWindow = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: true, contextIsolation: false } });
        kitchenWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(kitchenContent)}`);
        kitchenWindow.webContents.on('did-finish-load', () => {
            const printOptions = { silent: true, printBackground: true };
            if (kitchenPrinter) printOptions.deviceName = kitchenPrinter;
            kitchenWindow.webContents.print(printOptions, (success, err) => {
                if (!success) console.error('Kitchen print failed:', err);
                kitchenWindow.close();
            });
        });
    }
});

ipcMain.on('print', (event, content) => {

    let workerWindow = new BrowserWindow({
        show: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });
    
    workerWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(content)}`);
    
    workerWindow.webContents.on('did-finish-load', () => {
        // Print 2 copies as requested
        workerWindow.webContents.print({ silent: true, printBackground: true }, (success, failureReason) => {
            if (!success) console.error('Print failed:', failureReason);
            
            // Print second copy
            workerWindow.webContents.print({ silent: true, printBackground: true }, (success2, failureReason2) => {
                if (!success2) console.error('Second print failed:', failureReason2);
                workerWindow.close();
            });
        });
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
