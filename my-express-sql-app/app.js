const express = require('express')
const sqlite3 = require('sqlite3').verbose()

const app = express()
const port = 3000

// Create a new SQLite database
const db = new sqlite3.Database('medicines.db', (err) => {
    if (err) {
        console.error('Could not connect to database', err)
    } else {
        console.log('Connected to database')
    }
})

// Create a table
db.serialize(() => {
    db.run(
        `
    CREATE TABLE IF NOT EXISTS users (
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

// Middleware to parse JSON bodies
app.use(express.json())

// Route to insert a new user
app.post('/users', (req, res) => {
    const { name, species, dose, frequency, route, remarks } = req.body
    db.run(
        `
    INSERT INTO users (name, species, dose, frequency, route, remarks) 
    VALUES (?, ?, ?, ?, ?, ?)`,
        [name, species, dose, frequency, route, remarks],
        function (err) {
            if (err) {
                res.status(500).send('Error inserting user')
            } else {
                res.status(201).send(`User added with ID: ${this.lastID}`)
            }
        }
    )
})

// Route to get all users
app.get('/users', (req, res) => {
    db.all('SELECT * FROM users', [], (err, rows) => {
        if (err) {
            res.status(500).send('Error retrieving users')
        } else {
            res.status(200).json(rows)
        }
    })
})

// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`)
})
