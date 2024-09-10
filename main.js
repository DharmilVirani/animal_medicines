const { app, BrowserWindow, ipcMain } = require('electron')
const { exec, execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

let serverProcess

const startServer = () => {
    if (serverProcess) {
        console.log('Server is already running.')
        return
    }

    serverProcess = exec('node ./myApp/public/app.js', (err, stdout, stderr) => {
        if (err) {
            console.error(`Error starting server: ${err}`)
            return
        }
        console.log(`Server Output: ${stdout}`)
        if (stderr) {
            console.error(`Server Error: ${stderr}`)
        }
    })

    serverProcess.on('error', (err) => {
        console.error('Failed to start server:', err)
    })
}

const createWindow = () => {
    const mainWindow = new BrowserWindow({
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
    })
    mainWindow.maximize()
    mainWindow.loadFile(path.join(__dirname, './myApp/public/index.html'))
}

app.whenReady().then(() => {
    startServer()
    createWindow()

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow()
        }
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        if (serverProcess) {
            serverProcess.kill()
        }
        app.quit()
    }
})
