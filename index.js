const { app, BrowserWindow, Menu } = require('electron')
const expressApp = require('./app.js')
const path = require('path')
Menu.setApplicationMenu(false)

let server
let win

function createWindow() {
    win = new BrowserWindow({
        icon: path.join(__dirname, 'public', 'Icon.ico'),
        webPreferences: {
            nodeIntegration: true,
        },
    })

    win.maximize()
    win.loadFile('index.html')

    win.on('closed', () => {
        win = null
        if (server) {
            server.close(() => console.log('Node.js server stopped.'))
        }
    })
}

function createServer() {
    // Start the Express server from app.js
    server = expressApp.listen(3000, () => {
        console.log('Server started on port 3000 (from app.js)')
    })
}

app.whenReady().then(() => {
    createServer() // Start the server
    createWindow() // Start the Electron window
})

app.on('window-all-closed', () => {
    if (server) {
        server.close(() => console.log('Node.js server stopped.'))
    }
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
    }
})
