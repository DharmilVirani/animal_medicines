const express = require('express')
const sqlite3 = require('sqlite3').verbose()
const cors = require('cors')
const app = express()
const port = 3000

app.use(
    cors({
        allowedOrigins: ['http://localhost:3000'],
    })
)

// Create a new SQLite database connection
const db = new sqlite3.Database('medicines.db', (err) => {
    if (err) {
        console.error('Could not connect to database', err)
    } else {
        console.log('Connected to database')
    }
})

// Create the drugs table if it does not exist
db.serialize(() => {
    db.run(
        `
        CREATE TABLE IF NOT EXISTS drugs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            species TEXT NOT NULL,
            dose TEXT NOT NULL,
            frequency TEXT NOT NULL,
            route TEXT NOT NULL,
            remarks TEXT NOT NULL
        )
    `,
        (err) => {
            if (err) {
                console.error('Could not create table', err)
            } else {
                console.log('Table created')
            }
        }
    )
})

// Middleware to parse incoming JSON and URL-encoded form data
app.use(express.urlencoded({ extended: true }))
app.use(express.json())

// Route to insert a new drug entry
app.post('/medicine', (req, res) => {
    console.log('Received request:', req.body)
    const { name, species, dose, frequency, route, remarks } = req.body

    // Fetch the last inserted ID
    db.get('SELECT id FROM drugs ORDER BY id DESC LIMIT 1', (err, row) => {
        if (err) {
            console.error('Error fetching last ID:', err)
            return res.status(500).send('Error fetching last ID')
        }

        const newId = row ? row.id + 1 : 1 // If there are no rows, start with ID 1

        db.run(
            `
            INSERT INTO drugs (id, name, species, dose, frequency, route, remarks) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
            [newId, name, species, dose, frequency, route, remarks],
            function (err) {
                if (err) {
                    console.error('Error inserting drug entry:', err)
                    res.status(500).send('Error inserting drug entry')
                } else {
                    console.log(`Drug entry added with ID: ${newId}`)
                    res.status(201).send(`Drug entry added with ID: ${newId}`)
                }
            }
        )
    })
})

// Route to delete a drug entry by ID and decrement subsequent IDs
app.delete('/medicine/:id', (req, res) => {
    const id = parseInt(req.params.id)

    // Begin transaction
    db.serialize(() => {
        db.run('BEGIN TRANSACTION')

        // Delete the specified row
        db.run('DELETE FROM drugs WHERE id = ?', [id], function (err) {
            if (err) {
                db.run('ROLLBACK')
                console.error(`Error deleting drug entry with ID ${id}:`, err)
                return res.status(500).send(`Error deleting drug entry with ID ${id}`)
            }

            // Decrement the IDs of all subsequent rows
            db.run('UPDATE drugs SET id = id - 1 WHERE id > ?', [id], function (err) {
                if (err) {
                    db.run('ROLLBACK')
                    console.error(`Error decrementing IDs after deleting ID ${id}:`, err)
                    return res.status(500).send(`Error decrementing IDs after deleting ID ${id}`)
                }

                // Commit transaction
                db.run('COMMIT', (err) => {
                    if (err) {
                        db.run('ROLLBACK')
                        console.error('Error committing transaction:', err)
                        return res.status(500).send('Error committing transaction')
                    }

                    res.status(200).send(`Drug entry with ID ${id} deleted and subsequent IDs decremented`)
                })
            })
        })
    })
})

// Route to get all drug entries
app.get('/medicine', (req, res) => {
    const { name, species } = req.query
    const query = 'SELECT * FROM drugs WHERE name = ? AND species = ? ORDER by id'
    db.all(query, [name, species], (err, rows) => {
        if (err) {
            console.error('Error retreiveing drug entries: ', err)
            res.status(500).send('Error retrieving drug entries')
        } else {
            res.status(200).json(rows)
        }
    })
})

// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`)
})
