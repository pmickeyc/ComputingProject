// Environment and Package Declarations
const express = require('express');
const sql = require('mssql');
const path = require('path');
const {
    MongoClient,
    ServerApiVersion
} = require('mongodb');
const session = require('express-session');
const winston = require('winston');
const bodyParser = require('body-parser');

// App Instance and Middleware Setup
const app = express();
const port = process.env.PORT || 3000;
app.set('trust proxy', true);

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public'), {
    index: false
}));

app.use(session({
    secret: 'tempSecret',
    resave: false,
    saveUninitialized: true
}));

// MongoDB Connection
const uri = "mongodb://localhost:27017";
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

// MSSQL Connection Configuration
const mssqlConfig = {
    user: "phishUser",
    password: "password",
    server: "localhost\\SQLEXPRESS",
    database: "BiggerPhish",
    options: {
        encrypt: false
    }
};

//Logging
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss' 
        }),
        winston.format.errors({ stack: true }), 
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(), 
                winston.format.simple() 
            )
        }),
        new winston.transports.File({
            filename: 'error.log',
            level: 'error'
        }),
        new winston.transports.File({
            filename: 'combined.log'
        })
    ]
});


// Middleware Functions
function isAuthenticated(req, res, next) {
    logger.info('Checking if request is authenticated');

    // Log the session object for debugging
    logger.debug('Session details:', {
        session: req.session
    });

    if (req.session.isAuthenticated) {
        logger.info('Request is authenticated, proceeding to next middleware');
        return next();
    } else {
        logger.warn('Request is not authenticated, redirecting to login page', {
            sessionId: req.session.id,
            path: req.path 
        });

        res.status(401).sendFile(path.join(__dirname, './public/login.html'));
    }
}

// Server Initialization
async function initializeDatabases() {
    try {
        await client.connect();
        console.log("Successfully connected to MongoDB");
        await sql.connect(mssqlConfig);
        console.log("Successfully connected to MSSQL");
    } catch (err) {
        console.error('Database connection failed:', err);
        process.exit(1);
    }
}

// API Routes
app.get('/', (req, res) => {
    logger.info('Received request for root route.');

    // Log session details if necessary, this can be commented out in production for security
    logger.debug('Session details at root:', {
        session: req.session
    });

    if (req.session.isAuthenticated) {
        logger.info('User is authenticated, serving user.html', {
            sessionId: req.session.id
        });
        return res.sendFile(path.join(__dirname, './public/user.html'));
    } else {
        logger.info('User is not authenticated, serving index.html');
        res.sendFile(path.join(__dirname, './public/index.html'));
    }
});

//TBC
app.get("/users", (request, response) => {
    // Execute a SELECT query
    new sql.Request().query("SELECT * FROM Users", (err, result) => {
        if (err) {
            console.error("Error executing query:", err);
        } else {
            response.send(result.recordset); 
            console.dir(result.recordset);
        }
    });
});

app.post('/register-user', async (req, res) => {
    const { firstName, email, password } = req.body;

    if (!firstName || !email || !password) {
        logger.error('Registration attempt with incomplete form data');
        return res.status(400).json({ success: false, message: 'Incomplete form data' });
    }

    try {
        let pool = await sql.connect(mssqlConfig);
        const request = pool.request()
            .input('UserFName', sql.NVarChar(100), firstName)
            .input('UserEmail', sql.NVarChar(100), email)
            .input('UserPassword', sql.NVarChar(100), password);

        const result = await request.execute('sp_InsertUser');
        
        if (result.recordset[0].Status === -1) {
            logger.warn('User registration failed: Email already in use', { email });
            return res.status(400).json({ success: false, message: 'Email already in use' });
        }
        
        logger.info('User registered successfully:', { firstName, email });
        res.json({ success: true });
    } catch (err) {
        logger.error('Error occurred during registration:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});



app.post('/login-user', async (req, res) => {
    logger.info('Received login request', { email: req.body.email });

    try {
        const { email, password } = req.body;

        if (!email || !password) {
            logger.warn('Login attempt with incomplete form data', { email });
            return res.status(400).json({ success: false, message: 'Incomplete form data' });
        }

        // Attempt to connect to MSSQL and execute the login procedure
        let pool = await sql.connect(mssqlConfig);
        logger.debug('SQL connection established for login attempt');

        const request = pool.request()
            .input('UserEmail', sql.NVarChar(100), email)
            .input('UserPassword', sql.NVarChar(100), password);

        const result = await request.execute('sp_ValidateUser');
        logger.debug('Stored procedure executed', { procedureName: 'sp_ValidateUser' });

        // Check the outcome of the stored procedure
        if (result.recordset.length > 0 && result.recordset[0].IsValid) {
            logger.info('Login successful', { email });

            // Set session and save it
            req.session.isAuthenticated = true;
            req.session.save(err => {
                if (err) {
                    logger.error('Error saving session after successful login', { email, error: err });
                    return res.status(500).json({ success: false, message: 'Failed to create session.' });
                }
                res.json({ success: true });
            });
        } else {
            logger.warn('Login failed - invalid credentials', { email });
            res.status(401).json({ success: false, message: 'Invalid email or password' });
        }
    } catch (err) {
        logger.error('Exception occurred during login attempt', { email, error: err });
        res.status(500).json({ success: false, message: err.message });
    }
});



// Route that serves the user.html page only if the user is authenticated
app.get('/user', isAuthenticated, (req, res) => {
    logger.info('Serving user.html for authenticated user', {
        sessionId: req.session.id
    });
    res.sendFile(path.join(__dirname, './public/user.html'));
});

app.get('/email', (req, res) => {
    logger.info('Serving email.html', {
        ip: req.ip
    });
    res.sendFile(path.join(__dirname, './public/email.html'));
});

app.get('/login', (req, res) => {
    logger.info('Serving login.html', {
        ip: req.ip
    });
    res.sendFile(path.join(__dirname, './public/login.html'));
});

app.get('/register', (req, res) => {
    logger.info('Serving register.html', {
        ip: req.ip
    });
    res.sendFile(path.join(__dirname, './public/register.html'));
});

//TDBD
app.get('/user-data', (req, res) => {
    // Your code to fetch user data and send it as JSON
    res.json({ /* ... user data ... */ });
  });
  
app.post('/logout', (req, res) => {
    // Log the logout attempt
    logger.info('Logout attempt', { sessionId: req.session?.id, userId: req.session?.userId });

    if (req.session) {
        const sessionId = req.session.id; 
        const userId = req.session.userId; 

        // Log the session and user information
        logger.info('Attempting to destroy session', { sessionId, userId });

        req.session.destroy(err => {
            if (err) {
                // Log the error with session and user information
                logger.error('Failed to destroy session during logout.', { error: err, sessionId, userId });
                return res.status(500).send('Could not log out, please try again');
            }

            // Clear the session cookie and log this action
            res.clearCookie('connect.sid');
            logger.info('Session cookie cleared', { sessionId, userId });

            // Log the successful logout with user information
            logger.info('User logged out successfully', { sessionId, userId });

            res.json({ success: true }); // Respond with JSON
        });
    } else {
        // Log the situation where logout is called with no active session
        logger.warn('Logout called but no session found');

        res.status(401).json({ success: false, message: "No session found" });
    }
});

app.get('/emails', async (req, res) => {
    try {
        const collection = client.db("emailDB").collection("emails");
        const emails = await collection.find({}).toArray();
        res.json(emails);
    } catch (e) {
        res.status(500).send(e);
    }
});

initializeDatabases().then(() => {
    app.listen(port, () => {
        console.log(`Server running on port ${port}`);
    });
}).catch(err => {
    console.error('Initialization failed:', err);
});