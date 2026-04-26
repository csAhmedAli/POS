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

        // ── Sheet 1: Daily Summary ───────────────────────────
        const summaryAOA = [['Date', 'Total Orders', 'Revenue (Rs)', 'Cost (Rs)', 'Net Profit (Rs)']];
        reports.forEach(r => {
            summaryAOA.push([
                r.date, r.total_orders,
                parseFloat(r.total_revenue.toFixed(2)),
                parseFloat(r.total_cost.toFixed(2)),
                parseFloat(r.net_profit.toFixed(2))
            ]);
        });

        const ws1 = XLSX.utils.aoa_to_sheet(summaryAOA);
        // Apply summary styles
        ['A1','B1','C1','D1','E1'].forEach(c => { if(ws1[c]) ws1[c].s = STYLE_HEADER; });
        ws1['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 18 }];
        XLSX.utils.book_append_sheet(wb, ws1, 'Daily Summary');

        // ── Sheet 2+: Per-day detail (Grouped) ───────────────
        for (const rep of reports) {
            const details = db.getDetailedHistory(rep.date);
            if (!details || details.length === 0) continue;

            const groups = new Map();
            details.forEach(item => {
                if (!groups.has(item.order_id)) {
                    groups.set(item.order_id, {
                        token_number: item.token_number,
                        datetime: item.datetime,
                        items: []
                    });
                }
                groups.get(item.order_id).items.push(item);
            });

            const rows = [['Product', 'Qty', 'Unit Price', 'Unit Cost', 'Revenue', 'Line Profit']];
            const merges = [];
            const rowMeta = []; 

            groups.forEach(group => {
                const gRev = group.items.reduce((s, i) => s + (i.line_total || 0), 0);
                const gCost = group.items.reduce((s, i) => s + (i.cost * i.quantity || 0), 0);
                const gProf = gRev - gCost;
                const timeStr = new Date(group.datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                // Header text matching UI: [TYPE] Order # | ⏰ Time | Revenue | Cost | Profit
                const headerText = `[${group.items[0].order_type.toUpperCase()}] Order #${group.token_number}  |  ⏰ ${timeStr}  |  Revenue: Rs ${gRev.toFixed(2)}  |  Cost: Rs ${gCost.toFixed(2)}  |  Profit: Rs ${gProf.toFixed(2)}`;
                
                const headerRowIdx = rows.length;
                rows.push([headerText, '', '', '', '', '']);

                merges.push({ s: { r: headerRowIdx, c: 0 }, e: { r: headerRowIdx, c: 5 } });
                rowMeta.push({ type: 'header', r: headerRowIdx });

                group.items.forEach(item => {
                    const rIdx = rows.length;
                    rows.push([
                        `    ${item.product_name}`,
                        item.quantity,
                        parseFloat(item.price.toFixed(2)),
                        parseFloat(item.cost.toFixed(2)),
                        parseFloat(item.line_total.toFixed(2)),
                        parseFloat(item.line_profit.toFixed(2))
                    ]);
                    rowMeta.push({ type: 'item', r: rIdx });
                });
            });

            const ws = XLSX.utils.aoa_to_sheet(rows);
            ws['!merges'] = merges;
            ws['!cols'] = [{ wch: 40 }, { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 15 }];

            // Global styling for the detail sheet
            rowMeta.forEach(m => {
                if (m.type === 'header') {
                    for (let c = 0; c <= 5; c++) {
                        const cell = XLSX.utils.encode_cell({ r: m.r, c });
                        if (!ws[cell]) ws[cell] = { v: '', t: 's' };
                        ws[cell].s = STYLE_ORDER_HEADER;
                    }
                } else {
                    // Item row styling
                    [1].forEach(c => { // Qty
                        const cell = XLSX.utils.encode_cell({ r: m.r, c });
                        if (ws[cell]) ws[cell].s = STYLE_CENTER;
                    });
                    [2, 3, 4].forEach(c => { // Price, Cost, Revenue
                        const cell = XLSX.utils.encode_cell({ r: m.r, c });
                        if (ws[cell]) ws[cell].s = STYLE_MONEY;
                    });
                    // Profit color (Column F)
                    const profitCell = XLSX.utils.encode_cell({ r: m.r, c: 5 });
                    if (ws[profitCell]) ws[profitCell].s = STYLE_PROFIT;
                }
            });
            // Main sheet header (Product, Qty, etc.)
            ['A1','B1','C1','D1','E1','F1'].forEach(c => { if(ws[c]) ws[c].s = STYLE_HEADER; });

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
