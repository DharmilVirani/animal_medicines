// Function to update suggestion container position
const updateSuggestionsPosition = (input, suggestionsContainer) => {
    const inputRect = input.getBoundingClientRect()
    suggestionsContainer.style.width = `${inputRect.width}px`
    suggestionsContainer.style.left = `${inputRect.left + window.scrollX}px`
    suggestionsContainer.style.top = `${inputRect.bottom + window.scrollY - 1}px`
}

// General function to set up autocomplete functionality
const setupAutocomplete = (input, suggestionsContainer, data) => {
    let currentIndex = -1

    input.addEventListener('input', () => {
        const value = input.value.toLowerCase()
        suggestionsContainer.innerHTML = ''
        currentIndex = -1
        updateSuggestionsPosition(input, suggestionsContainer)

        if (value) {
            const filteredData = data.filter((item) => item.toLowerCase().includes(value))
            if (filteredData.length > 0) {
                suggestionsContainer.style.display = 'block'
                filteredData.forEach((item) => {
                    const suggestion = document.createElement('div')
                    suggestion.classList.add('autocomplete-suggestion')
                    suggestion.textContent = item
                    suggestion.addEventListener('click', () => {
                        input.value = item
                        suggestionsContainer.innerHTML = ''
                    })
                    suggestionsContainer.appendChild(suggestion)
                })
            }
        } else {
            suggestionsContainer.style.display = 'none'
        }
    })

    input.addEventListener('keydown', (event) => {
        const suggestions = suggestionsContainer.querySelectorAll('.autocomplete-suggestion')
        if (suggestions.length > 0) {
            if (event.key === 'ArrowDown') {
                event.preventDefault()
                currentIndex = (currentIndex + 1) % suggestions.length
                suggestions.forEach((suggestion, index) => {
                    suggestion.classList.toggle('active', index === currentIndex)
                })
            } else if (event.key === 'ArrowUp') {
                event.preventDefault()
                currentIndex = (currentIndex - 1 + suggestions.length) % suggestions.length
                suggestions.forEach((suggestion, index) => {
                    suggestion.classList.toggle('active', index === currentIndex)
                })
            } else if (event.key === 'Enter' && currentIndex >= 0) {
                event.preventDefault()
                input.value = suggestions[currentIndex].textContent
                suggestionsContainer.innerHTML = ''
            }
        }
    })

    document.addEventListener('click', (event) => {
        if (event.target !== input && !suggestionsContainer.contains(event.target)) {
            suggestionsContainer.innerHTML = ''
        }
    })

    window.addEventListener('resize', () => updateSuggestionsPosition(input, suggestionsContainer))
    window.addEventListener('scroll', () => updateSuggestionsPosition(input, suggestionsContainer))
}

// Function to fetch data and set up autocomplete for an input
const fetchAndSetupAutocomplete = (url, input, suggestionsContainer) => {
    fetch(url)
        .then((response) => response.json())
        .then((data) => {
            if (data && data.filenames) {
                setupAutocomplete(input, suggestionsContainer, data.filenames)
            } else {
                console.error('Invalid data format:', data)
            }
        })
        .catch((error) => {
            console.error('Error fetching data:', error)
        })
}

// Function to set up delete word functionality
const setupDeleteWord = (deleteButton, input, suggestionsContainer) => {
    deleteButton.addEventListener('click', (event) => {
        event.preventDefault()

        const fileName = input.value.trim()
        if (!fileName) {
            alert('Please enter a file name.')
            return
        }

        fetch(`http://localhost:3000/pharmacology-delete/${fileName}`, {
            method: 'DELETE',
        })
            .then((response) => {
                if (!response.ok) {
                    throw new Error('Network response was not ok')
                }
                return response.json()
            })
            .then((data) => {
                alert(data.message)
            })
            .catch((error) => {
                alert(`${fileName} does not exist`)
            })
        input.value = ''
    })
}

// Initialize autocomplete for specific input fields
document.addEventListener('DOMContentLoaded', () => {
    const nameInput = document.getElementById('name')
    const nameSuggestionsContainer = document.getElementById('autocomplete-suggestions')
    const deleteButton = document.querySelector('.delete-word')

    if (nameInput && nameSuggestionsContainer) {
        fetchAndSetupAutocomplete(
            'http://localhost:3000/pharmacology-getFilenames',
            nameInput,
            nameSuggestionsContainer
        )
    }

    if (deleteButton && nameInput && nameSuggestionsContainer) {
        setupDeleteWord(deleteButton, nameInput, nameSuggestionsContainer)
    }
})

const reload = () => {
    setTimeout(() => {
        window.location.reload()
    }, 100)
}
