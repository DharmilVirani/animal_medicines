function showCustomAlert(message) {
    const alertElement = document.getElementById('customAlert')
    const overlayElement = document.getElementById('alertOverlay')

    document.getElementById('alertMessage').innerText = message
    alertElement.style.display = 'block'
    overlayElement.style.display = 'block'

    overlayElement.addEventListener('click', closeCustomAlert)
    window.addEventListener('keydown', handleKeyPress)
}

function closeCustomAlert() {
    const alertElement = document.getElementById('customAlert')
    const overlayElement = document.getElementById('alertOverlay')

    alertElement.style.display = 'none'
    overlayElement.style.display = 'none'

    overlayElement.removeEventListener('click', closeCustomAlert)
    window.removeEventListener('keydown', handleKeyPress)
}

function handleKeyPress(event) {
    if (event.key === 'Enter') {
        event.preventDefault()
        closeCustomAlert()
    }
}
