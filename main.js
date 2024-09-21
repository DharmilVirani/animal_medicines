const { app, BrowserWindow, Menu } = require('electron')
Menu.setApplicationMenu(false)
const path = require('path')
const fs = require('fs')
const { spawn } = require('child_process')

let serverProcess

const dbPath = path.join(__dirname, 'resources', 'medicine.db')
console.log(dbPath)

// Function to create the database file if it doesn't exist
const createDatabaseFile = () => {
    fs.access(dbPath, fs.constants.F_OK, (err) => {
        if (err) {
            fs.writeFile(dbPath, '', (err) => {
                if (err) {
                    console.error('Error creating the database file:', err)
                } else {
                    console.log('Database file created:', dbPath)
                }
            })
        } else {
            console.log('Database file already exists:', dbPath)
        }
    })
}

const startServer = () => {
    if (serverProcess) {
        console.log('Server is already running.')
        return
    }

    try {
        serverProcess = spawn('node', [path.join(__dirname, 'myApp', 'public', 'app.js')], { stdio: 'inherit' })

        if (serverProcess) {
            serverProcess.on('error', (err) => {
                console.error('Failed to start server:', err)
            })

            serverProcess.on('exit', (code) => {
                console.log(`Server exited with code: ${code}`)
                serverProcess = null // Reset the server process reference
            })
        } else {
            console.error('Failed to create server process.')
        }
    } catch (err) {
        console.error('Error in starting server:', err)
    }
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
    createDatabaseFile()
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
            console.log('Killing server process window-all-closed...')
            serverProcess.kill('SIGTERM')
        }
        app.quit()
    }
})

app.on('before-quit', () => {
    if (serverProcess) {
        console.log('Killing server process before quit...')
        serverProcess.kill('SIGTERM')
    }
})
