const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    // Database operations relayed via IPC
    getProducts: () => ipcRenderer.invoke('db:getProducts'),
    createOrder: (orderData, items) => ipcRenderer.invoke('db:createOrder', orderData, items),
    getNextTokenNumber: () => ipcRenderer.invoke('db:getNextTokenNumber'),
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

    // Export
    exportDayReport: (reports) => ipcRenderer.invoke('export:dayReport', reports),

    // Navigation
    navigateTo: (page) => ipcRenderer.send('navigate', page),

    // Auto-Updater
    checkForUpdates: () => ipcRenderer.invoke('app:checkForUpdates'),
    quitAndInstall: () => ipcRenderer.invoke('app:quitAndInstall'),
    onUpdateAvailable: (callback) => ipcRenderer.on('update-available', callback),
    onUpdateNotAvailable: (callback) => ipcRenderer.on('update-not-available', callback),
    onUpdateProgress: (callback) => ipcRenderer.on('update-progress', (event, percent) => callback(percent)),
    onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', callback)
});

