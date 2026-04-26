const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    // Database operations relayed via IPC
    getProducts: () => ipcRenderer.invoke('db:getProducts'),
    createOrder: (orderData, items) => ipcRenderer.invoke('db:createOrder', orderData, items),
    getNextTokenNumber: (orderType) => ipcRenderer.invoke('db:getNextTokenNumber', orderType),

    getPassword: () => ipcRenderer.invoke('db:getPassword'),
    setPassword: (password) => {
        console.log("Preload received password:", password);
        return ipcRenderer.invoke('db:setPassword', password);
    },
    addProduct: (product) => ipcRenderer.invoke('db:addProduct', product),
    updateProduct: (product) => ipcRenderer.invoke('db:updateProduct', product),
    deleteProduct: (id) => ipcRenderer.invoke('db:deleteProduct', id),
    
    // Reports
    getProductWiseSales: () => ipcRenderer.invoke('db:getProductWiseSales'),
    getSummary: () => ipcRenderer.invoke('db:getSummary'),
    getBestWorstSelling: () => ipcRenderer.invoke('db:getBestWorstSelling'),
    saveDailyReport: (reportData) => ipcRenderer.invoke('db:saveDailyReport', reportData),
    getHistoricalReports: () => ipcRenderer.invoke('db:getHistoricalReports'),
    getDetailedHistory: (date) => ipcRenderer.invoke('db:getDetailedHistory', date),
    resetTokenNumber: () => ipcRenderer.invoke('db:resetTokenNumber'),

    // Printing
    print: (content) => ipcRenderer.send('print', content),
    printDual: (payload) => ipcRenderer.send('print-dual', payload),
    printSingle: (payload) => ipcRenderer.send('print-single', payload),
    getPrinters: () => ipcRenderer.invoke('app:getPrinters'),

    // Settings
    getSetting: (key) => ipcRenderer.invoke('db:getSetting', key),
    setSetting: (key, value) => ipcRenderer.invoke('db:setSetting', key, value),

    // Export
    exportDayReport: (reports) => ipcRenderer.invoke('export:dayReport', reports),
    exportOverallSales: (salesData) => ipcRenderer.invoke('export:overallSales', salesData),
    exportSingleDayReport: (date, items) => ipcRenderer.invoke('export:singleDayReport', date, items),

    // Navigation
    navigateTo: (page) => ipcRenderer.send('navigate', page)
});





