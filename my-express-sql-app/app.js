// Medicine Dosage Database
const express = require('express')
const jwt = require('jsonwebtoken')
const multer = require('multer')
const xlsx = require('xlsx')
const bodyParser = require('body-parser')
const sqlite3 = require('sqlite3').verbose()
const cors = require('cors')
const excelJS = require('exceljs')
const fs = require('fs')
const path = require('path')
const app = express()
const port = 3000

app.use(bodyParser.json())
app.use(express.static(path.join(__dirname, 'public')))

const upload = multer({ dest: './' })

app.use(
    cors({
        allowedOrigins: ['http://localhost:3000'],
    })
)

// Create a new SQLite database connection
const db = new sqlite3.Database('medicines.db', (err) => {
    if (err) {
        console.error('Could not connect to database medicines', err)
    } else {
        console.log('Connected to database medicines')
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
            remarks TEXT NOT NULL
        )
    `,
        (err) => {
            if (err) {
                console.error('Could not create table drugs', err)
            } else {
                console.log('Table drugs created successfully')
            }
        }
    )
})

// Middleware to parse incoming JSON and URL-encoded form data
app.use(express.urlencoded({ extended: true }))
app.use(express.json())

// Route to insert a new drug entry
app.post('/medicine', (req, res) => {
    const { name, species, dose, remarks } = req.body

    // Check if the dosage already exists
    db.get('SELECT * FROM drugs WHERE dose = ?', [dose], (err, row) => {
        if (err) {
            console.error('Error checking for duplicate dosage:', err)
            return res.status(500).json({ message: 'Error checking for duplicate dosage' })
        }

        if (row) {
            // Duplicate dosage found
            return res.status(409).json('Data already exists')
        }

        // Fetch the last inserted ID
        db.get('SELECT MAX(id) as maxId FROM drugs', (err, row) => {
            if (err) {
                console.error('Error fetching last ID:', err)
                return res.status(500).json({ message: 'Error fetching last ID' })
            }

            const newId = row ? row.maxId + 1 : 1 // If there are no rows, start with ID 1

            db.run(
                `
                INSERT INTO drugs (id, name, species, dose, remarks) 
                VALUES (?, ?, ?, ?, ?)
            `,
                [newId, name, species, dose, remarks],
                function (err) {
                    if (err) {
                        console.error('Error inserting drug entry:', err)
                        res.status(500).json({ message: 'Error inserting drug entry' })
                    } else {
                        res.status(201).json(`Drug entry added with ID: ${newId}`)
                    }
                }
            )
        })
    })
})

// Import Excel file and insert data
app.post('/upload', upload.single('file'), (req, res) => {
    const filePath = req.file.path

    try {
        const workbook = xlsx.readFile(filePath)
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]
        const data = xlsx.utils.sheet_to_json(sheet)

        const insertPromises = data.map((row) => {
            return new Promise((resolve, reject) => {
                const { Name, Species, Dose, Remarks } = row

                if (!Name) {
                    console.error('Name is required but missing in row:', row)
                    reject('Name is required')
                    return
                }

                // Check if the row already exists
                db.get(
                    `SELECT 1 FROM drugs WHERE name = ? AND species = ? AND dose = ? AND remarks = ?`,
                    [Name, Species, Dose, Remarks],
                    (err, existingRow) => {
                        if (err) {
                            console.error('Error checking for existing entry:', err)
                            reject('Error checking for existing entry')
                            return
                        }

                        if (existingRow) {
                            // Row already exists, skip insertion
                            resolve() // Resolve promise even if row is skipped
                        } else {
                            // Insert the new row
                            db.run(
                                `INSERT INTO drugs (name, species, dose, remarks)
                                 VALUES (?, ?, ?, ?)`,
                                [Name, Species, Dose, Remarks],
                                function (err) {
                                    if (err) {
                                        console.error('Error inserting drug entry:', err)
                                        reject('Error inserting drug entry')
                                    } else {
                                        resolve()
                                    }
                                }
                            )
                        }
                    }
                )
            })
        })

        Promise.all(insertPromises)
            .then(() => {
                res.status(201).json({ message: 'Excel data uploaded and inserted into the database' })
                fs.unlink(filePath, (err) => {
                    if (err) {
                        console.error('Error deleting the uploaded file:', err)
                    }
                })
            })
            .catch((error) => {
                console.error('Error during data insertion:', error)
                res.status(500).json({ message: 'Error during data insertion' })
            })
    } catch (error) {
        console.error('Error processing the Excel file:', error)
        res.status(500).json({ message: 'Error processing the Excel file' })
    }
})

// Export data to Excel file
app.get('/export', (req, res) => {
    const { name, species } = req.query

    let query = 'SELECT * FROM drugs'
    const params = []

    if (name) {
        query += ' WHERE name = ?'
        params.push(name)
    }

    if (species) {
        query += name ? ' AND species = ?' : ' WHERE species = ?'
        params.push(species)
    }

    db.all(query, params, async (err, rows) => {
        if (err) {
            console.error('Error executing query:', err)
            res.status(500).json({ message: 'Error executing query' })
            return
        }

        const workbook = new excelJS.Workbook()
        const worksheet = workbook.addWorksheet('Drugs')

        worksheet.columns = [
            { header: 'Name', key: 'name', width: 30 },
            { header: 'Species', key: 'species', width: 30 },
            { header: 'Dose', key: 'dose', width: 30 },
            { header: 'Remarks', key: 'remarks', width: 30 },
        ]

        rows.forEach((row) => {
            worksheet.addRow(row)
        })

        const buffer = await workbook.xlsx.writeBuffer()
        res.setHeader('Content-Disposition', 'attachment; filename="Drug_Index.xlsx"')
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        res.send(buffer)
    })
})
// Route to delete a drug entry by ID and decrement subsequent IDs
app.delete('/medicine/:id', (req, res) => {
    const id = parseInt(req.params.id)

    db.serialize(() => {
        db.run('BEGIN TRANSACTION')

        // Delete the specific row
        db.run('DELETE FROM drugs WHERE id = ?', [id], function (err) {
            if (err) {
                db.run('ROLLBACK')
                console.error(`Error deleting drug entry with ID ${id}:`, err)
                return res.status(500).json({ message: `Error deleting drug entry with ID ${id}` })
            }

            // Decrement IDs of all subsequent rows
            db.run('UPDATE drugs SET id = id - 1 WHERE id > ?', [id], function (err) {
                if (err) {
                    db.run('ROLLBACK')
                    console.error(`Error decrementing IDs after deleting ID ${id}:`, err)
                    return res.status(500).json({ message: `Error decrementing IDs after deleting ID ${id}` })
                }

                // Reset the sequence
                db.run(
                    'UPDATE sqlite_sequence SET seq = (SELECT MAX(id) FROM drugs) WHERE name = "drugs"',
                    function (err) {
                        if (err) {
                            db.run('ROLLBACK')
                            console.error('Error resetting sequence:', err)
                            return res.status(500).json({ message: 'Error resetting sequence' })
                        }

                        db.run('COMMIT', (err) => {
                            if (err) {
                                db.run('ROLLBACK')
                                console.error('Error committing transaction:', err)
                                return res.status(500).json({ message: 'Error committing transaction' })
                            }

                            res.status(200).json({
                                message: `Drug entry with ID ${id} deleted.`,
                            })
                        })
                    }
                )
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
            res.status(500).json({ message: 'Error retrieving drug entries' })
        } else {
            res.status(200).json(rows)
        }
    })
})

//All data of drugs
app.get('/medicineid', (req, res) => {
    const query = 'SELECT * FROM drugs'
    db.all(query, (err, rows) => {
        if (err) {
            console.error('Error retreiveing drug entries: ', err)
            res.status(500).json({ message: 'Error retrieving drug entries' })
        } else {
            res.status(200).json(rows)
        }
    })
})

//Admin Login
const SECRET_KEY = 'your_secret_key'

const authenticateJWT = (req, res, next) => {
    const token = req.headers.authorization

    if (token) {
        jwt.verify(token, SECRET_KEY, (err, user) => {
            if (err) {
                return res.sendStatus(403)
            }
            req.user = user
            next()
        })
    } else {
        res.sendStatus(401)
    }
}

const refreshTokenMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization
    if (authHeader) {
        const token = authHeader.split(' ')[1]
        jwt.verify(token, SECRET_KEY, (err, user) => {
            if (err) {
                return res.sendStatus(403)
            }
            const newToken = jwt.sign({ username: user.username }, SECRET_KEY, { expiresIn: '10m' })
            res.setHeader('Authorization', `Bearer ${newToken}`)
            req.user = user
            next()
        })
    } else {
        next()
    }
}

app.post('/login', (req, res) => {
    const { username, password } = req.body

    if (username === 'Anil Virani' && password === 'ranjan@1974') {
        const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: '10m' })
        res.json({ token })
    } else {
        res.status(401).json({ message: 'Incorrect Credentials.' })
    }
})

// Use the refresh token middleware for all protected routes
app.use('/protected', refreshTokenMiddleware)

app.get('/protected/resource', (req, res) => {
    res.send('This is a protected resource.')
})

//Pharmacology table
db.serialize(() => {
    db.run(
        `
        CREATE TABLE IF NOT EXISTS pharmacology (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            file_name TEXT NOT NULL,
            file_content BLOB NOT NULL
        )
    `,
        (err) => {
            if (err) {
                console.error('Error creating table pharmacology:', err)
            } else {
                console.log('Table pharmacology created successfully')
            }
        }
    )
})

// Upload HTML
app.post('/upload-html', upload.array('files'), (req, res) => {
    const files = req.files

    if (!files || files.length === 0) {
        return res.status(400).json({ message: 'No files were uploaded.' })
    }

    const promises = files.map((file) => {
        const filePath = file.path
        const fileName = path.parse(file.originalname).name

        return new Promise((resolve, reject) => {
            fs.readFile(filePath, (err, data) => {
                if (err) {
                    console.error('Error reading file:', err)
                    return reject('Error reading file')
                }

                db.get('SELECT id FROM pharmacology WHERE file_name = ?', [fileName], (err, row) => {
                    if (err) {
                        return reject('Error checking for existing file')
                    }

                    if (row) {
                        db.run(
                            'UPDATE pharmacology SET file_content = ? WHERE file_name = ?',
                            [data, fileName],
                            (err) => {
                                if (err) {
                                    return reject('Error updating data')
                                }
                                resolve(`HTML file ${fileName} updated in database.`)
                                fs.unlink(filePath, (err) => {
                                    if (err) {
                                        console.error('Error deleting the uploaded file:', err)
                                    }
                                })
                            }
                        )
                    } else {
                        db.run(
                            'INSERT INTO pharmacology (file_name, file_content) VALUES (?, ?)',
                            [fileName, data],
                            (err) => {
                                if (err) {
                                    console.error('Error inserting file into database:', err)
                                    return reject('Error inserting file into database')
                                }
                                resolve(`HTML file ${fileName} uploaded and inserted into the database`)
                                fs.unlink(filePath, (err) => {
                                    if (err) {
                                        console.error('Error deleting the uploaded file:', err)
                                    }
                                })
                            }
                        )
                    }
                })
            })
        })
    })

    Promise.all(promises)
        .then((messages) => res.json(messages))
        .catch((error) => res.status(500).json({ message: error }))
})

//Download HTML
app.get('/pharmacology/:fileName', (req, res) => {
    const fileName = req.params.fileName

    db.get('SELECT file_content FROM pharmacology WHERE file_name = ?', [fileName], (err, row) => {
        if (err) {
            console.error('Error retrieving file from database:', err)
            return res.status(500).json({ message: 'Error retrieving file from database' })
        }

        if (!row) {
            return res.status(404).json({ message: 'File not found' })
        }

        // Set Content-Type to text/html to display the HTML in browser
        res.setHeader('Content-Type', 'text/html')
        res.send(row.file_content)
    })
})

app.delete('/pharmacology-delete/:filename', (req, res) => {
    const fileName = req.params.filename

    db.serialize(() => {
        db.run('BEGIN TRANSACTION')

        db.get('SELECT id FROM pharmacology WHERE file_name = ?', [fileName], (err, row) => {
            if (err) {
                db.run('ROLLBACK')
                console.error(`Error finding ${fileName} file in pharmacology table: `, err)
                return res
                    .status(500)
                    .json({ message: `Error finding ${fileName} file in pharmacology table: ${err.message}` })
            }

            if (!row) {
                db.run('ROLLBACK')
                console.error(`File ${fileName} not found in pharmacology table`)
                return res.status(404).json({ message: `File ${fileName} not found in pharmacology table` })
            }

            const id = row.id

            db.run('DELETE FROM pharmacology WHERE file_name = ?', [fileName], (err) => {
                if (err) {
                    db.run('ROLLBACK')
                    console.error(`Error deleting ${fileName} file from pharmacology table: `, err)
                    return res
                        .status(500)
                        .json({ message: `Error deleting ${fileName} file from pharmacology table: ${err.message}` })
                }

                db.run('UPDATE pharmacology SET id = id - 1 WHERE id > ?', [id], (err) => {
                    if (err) {
                        db.run('ROLLBACK')
                        console.error(`Error decrementing IDs after deleting ID ${id}:`, err)
                        return res.status(500).json({ message: `Error decrementing IDs after deleting ID ${id}` })
                    }

                    db.run('COMMIT', (err) => {
                        if (err) {
                            db.run('ROLLBACK')
                            console.error('Error committing transaction:', err)
                            return res.status(500).json({ message: 'Error committing transaction' })
                        }

                        res.status(200).json({
                            message: `Successfully deleted ${fileName}`,
                        })
                    })
                })
            })
        })
    })
})

//Get all file-names from pharmacology table
app.get('/pharmacology-getFilenames', (req, res) => {
    db.all('SELECT file_name FROM pharmacology', (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message })
            return
        }
        const filenames = rows.map((row) => row.file_name)
        res.json({ filenames: filenames })
    })
})

//Get name and spcies from drugs table
app.get('/drugs-namespecies', (req, res) => {
    db.all('SELECT name, species FROM drugs', (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message })
            return
        }
        const names = [...new Set(rows.map((row) => row.name))] // Get unique names
        const species = [...new Set(rows.map((row) => row.species))] // Get unique species
        res.json({ names: names, species: species })
    })
})

// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`)
})
