const { ipcRenderer } = require('electron')

function showAlert(message) {
    alert(message)

    ipcRenderer.send('toggle-dev-tools')
}
