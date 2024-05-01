/*
Author: Padraig McCauley - 20123744
BiggerPhish Educational Platform


TODO:
Add credentials to enviroment variables/dont have them hardcoded
Encrypt passwords (bcrypt)
Connect courses to email portal
Add an Admin flow
Add a content upload mechanism (for teachers/admin) - shoudl eb at least a PDF and a set of emails for the email tracker
Add a course progress tracker
Optional: video content?
Security review of all endpoints/protect against unauthorized access to DB endpoints
Migrate to cloud servers
Add a CI/CD pipeline
Enhance logging serverSide - Perhaps add a DB table that could be logged into
Password reset added protection
Add email function for 'forget password'
*/


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


//Logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.errors({
            stack: true
        }),
        winston.format.printf((info) => {
            // Start with the standard log message format
            let msg = `${info.timestamp} ${info.level}: ${info.message}`;

            // Serialize and append any additional metadata objects to the log message
            const additionalInfo = Object.assign({}, info);
            // Remove standard fields to avoid duplicating them in the output
            delete additionalInfo.message;
            delete additionalInfo.level;
            delete additionalInfo.timestamp;
            delete additionalInfo.stack;

            // Append the serialized metadata, if any, to the message
            if (Object.keys(additionalInfo).length > 0) {
                msg += ` ${JSON.stringify(additionalInfo)}`;
            }

            return msg;
        })
    ),
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.printf(info => {
                    return `${info.timestamp} ${info.level}: ${info.message}`;
                })
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
        logger.warn('Request is not authenticated, redirecting to root', {
            sessionId: req.session.id,
            path: req.path
        });

        res.redirect('/'); // This will redirect the user to the root path
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




// API Routes - root
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

// API Routes - user-Data for loggged in user(API)
app.get('/user-data', isAuthenticated, async (req, res) => {
    const userEmail = req.session.user.email;

    try {
        let pool = await sql.connect(mssqlConfig);
        logger.debug('Connected to MSSQL for /user-data endpoint', {
            userEmail
        });

        const request = pool.request();
        request.input('UserEmail', sql.NVarChar(100), userEmail);

        const result = await request.execute('sp_UserSearch');
        logger.debug('Executed sp_UserSearch stored procedure', {
            userEmail
        });

        if (result.recordset.length > 0) {
            const userData = result.recordset[0];

            // Check if userData is not empty and log the fact that it has data
            if (userData && Object.keys(userData).length > 0) { // Ensure userData is not an empty object
                const userDataJSON = JSON.stringify(userData);
                logger.info(`User data retrieved successfully: ${userDataJSON}`);
                res.json(userData);
            } else {
                // Log that userData is empty
                logger.warn('User data object is empty', {
                    userEmail
                });
                res.status(404).send('User not found');
            }
        } else {
            logger.warn('No user data found in recordset for /user-data endpoint', {
                userEmail
            });
            res.status(404).send('User not found');
        }
    } catch (err) {
        logger.error('Error fetching user data', {
            userEmail,
            error: err.message
        });
        res.status(500).send("Error fetching user data");
    }
});



// API Routes - user-Data for all users(API)
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

// API Routes - register user(API)
app.post('/register-user', async (req, res) => {
    const {
        firstName,
        email,
        password
    } = req.body;

    if (!firstName || !email || !password) {
        logger.error('Registration attempt with incomplete form data');
        return res.status(400).json({
            success: false,
            message: 'Incomplete form data'
        });
    }

    try {
        let pool = await sql.connect(mssqlConfig);
        const request = pool.request()
            .input('UserFName', sql.NVarChar(100), firstName)
            .input('UserEmail', sql.NVarChar(100), email)
            .input('UserPassword', sql.NVarChar(100), password);

        const result = await request.execute('sp_InsertUser');

        if (result.recordset[0].Status === -1) {
            logger.warn('User registration failed: Email already in use', {
                email
            });
            return res.status(400).json({
                success: false,
                message: 'Email already in use'
            });
        }

        logger.info('User registered successfully:', {
            firstName,
            email
        });
        res.json({
            success: true
        });
    } catch (err) {
        logger.error('Error occurred during registration:', err);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// API Routes - update user email(API)
app.post('/update-user-email', async (req, res) => {
    const {
        oldEmail,
        newEmail
    } = req.body;

    // Validate that both old and new emails are provided
    if (!oldEmail || !newEmail) {
        logger.error('Update user email attempt with incomplete form data', {
            oldEmail,
            newEmail
        });
        return res.status(400).json({
            success: false,
            message: 'Incomplete form data'
        });
    }

    try {
        // Connect to the database
        let pool = await sql.connect(mssqlConfig);
        const request = pool.request()
            .input('OldEmail', sql.NVarChar(100), oldEmail)
            .input('NewEmail', sql.NVarChar(100), newEmail);

        // Execute the stored procedure
        const result = await request.execute('sp_UpdateUserEmail');
        const returnValue = result.returnValue; // Capture the return value from the stored procedure

        // Check if the stored procedure completed successfully
        if (returnValue === 0) {
            logger.info('User email updated successfully', {
                oldEmail,
                newEmail
            });

            // Update the email in the session if the user updating the email is the same as the one logged in
            if (req.session.user && req.session.user.email === oldEmail) {
                req.session.user.email = newEmail;
                req.session.save(err => {
                    if (err) {
                        logger.error('Error saving session after email update', {
                            error: err.message,
                            oldEmail,
                            newEmail
                        });
                        return res.status(500).json({
                            success: false,
                            message: 'Failed to update session.'
                        });
                    }
                    res.json({
                        success: true,
                        message: 'Email updated successfully'
                    });
                });
            } else {
                res.json({
                    success: true,
                    message: 'Email updated successfully'
                });
            }
        } else {
            // Handle specific error based on return value from stored procedure
            handleEmailUpdateErrors(returnValue, newEmail, res);
        }
    } catch (err) {
        // Generic SQL error or network/db connection issue
        logger.error('Error occurred during updating user email:', {
            error: err.message,
            oldEmail,
            newEmail
        });
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});


//function for error handling
function handleEmailUpdateErrors(returnValue, newEmail, res) {
    if (returnValue === 1) {
        logger.warn('User email update failed: New email already in use', {
            newEmail
        });
        res.status(400).json({
            success: false,
            message: 'The new email is already in use.'
        });
    } else if (returnValue === 2) {
        logger.warn('User email update failed: Old email not found', {
            newEmail
        });
        res.status(404).json({
            success: false,
            message: 'Old email not found.'
        });
    } else {
        // Unknown error code
        logger.error('User email update failed: Unknown error', {
            returnValue
        });
        res.status(500).json({
            success: false,
            message: 'An unknown error occurred.'
        });
    }
}

// API Routes - update password(API)
app.post('/update-user-password', async (req, res) => {
    const {
        email,
        newPassword
    } = req.body;

    if (!email || !newPassword) {
        logger.error('Update user password attempt with incomplete form data', {
            email
        });
        return res.status(400).json({
            success: false,
            message: 'Incomplete form data'
        });
    }

    // Hash to be added
    const hashedPassword = newPassword;

    try {
        let pool = await sql.connect(mssqlConfig);
        const request = pool.request()
            .input('UserEmail', sql.NVarChar(100), email)
            .input('NewPassword', sql.NVarChar(100), hashedPassword);
        logger.info(email);
        const result = await request.execute('sp_UpdateUserPassword');
        const returnValue = result.returnValue; // Access the return value from the stored procedure if necessary

        // Check if the stored procedure returned an expected value -'0' means success
        if (returnValue === 0) {
            logger.info('User password updated successfully', {
                email
            });
            res.json({
                success: true,
                message: 'Password updated successfully'
            });
        } else {
            // Handle specific errors if the stored procedure returns specific error codes
            let errorMessage = 'Unknown error occurred';
            if (returnValue === 1) {
                errorMessage = 'User not found';
                logger.warn('Failed to update password - User not found', {
                    email
                });
            } else if (returnValue === 2) {
                errorMessage = 'No update occurred';
                logger.warn('No update occurred', {
                    email
                });
            }
            res.status(400).json({
                success: false,
                message: errorMessage
            });
        }
    } catch (err) {
        logger.error('Error occurred during updating user password', {
            error: err.message,
            email
        });
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});


// API Routes - update user name(API)
app.post('/update-user-name', async (req, res) => {
    const { email, newFName } = req.body;

    // Log the incoming request body to trace what we received
    logger.info('Received request to update user name', { email, newFName });

    // Check for required fields
    if (!email || !newFName) {
        logger.error('Update user name attempt with incomplete form data', { email, newFName });
        return res.status(400).json({ success: false, message: 'Incomplete form data' });
    }

    try {
        // Attempting to connect to the database
        logger.info('Attempting database connection');
        let pool = await sql.connect(mssqlConfig);
        logger.info('Database connection successful');

        // Preparing and executing the stored procedure
        const request = pool.request()
            .input('UserEmail', sql.NVarChar(100), email)
            .input('NewFName', sql.NVarChar(100), newFName);
        logger.info('Executing stored procedure sp_UpdateUserName');

        const result = await request.execute('sp_UpdateUserName');
        const returnValue = result.returnValue;
        logger.info('Stored procedure executed', { returnValue });

        // Handling different outcomes based on the stored procedure's return value
        if (returnValue === 0) {
            logger.info('User name updated successfully', { email, newFName });

            // Update the first name in the session if the user updating the name is the same as the one logged in
            if (req.session.user && req.session.user.email === email) {
                req.session.user.firstName = newFName; // assuming session stores firstName
                req.session.save(err => {
                    if (err) {
                        logger.error('Error saving session after name update', { error: err.message, email, newFName });
                        return res.status(500).json({ success: false, message: 'Failed to update session.' });
                    }
                    res.json({ success: true, message: 'Name updated successfully' });
                });
            } else {
                res.json({ success: true, message: 'Name updated successfully' });
            }
        } else {
            let errorMessage = 'An unknown error occurred';
            if (returnValue === 1) {
                errorMessage = 'User not found';
                logger.warn('Failed to update user name - User not found', { email });
            } else if (returnValue === 2) {
                errorMessage = 'No update occurred. User may already have this name';
                logger.warn('No update occurred - User may already have this name', { email, newFName });
            }
            res.status(400).json({ success: false, message: errorMessage });
        }
    } catch (err) {
        // Logging and handling exceptions
        logger.error('Error occurred during updating user name', { error: err.message, email, newFName });
        res.status(500).json({ success: false, message: 'Server error' });
    }
});




// API Routes - login user(API)
app.post('/login-user', async (req, res) => {
    logger.info('Received login request', {
        email: req.body.email
    });

    try {
        const {
            email,
            password
        } = req.body;

        if (!email || !password) {
            logger.warn('Login attempt with incomplete form data', {
                email
            });
            return res.status(400).json({
                success: false,
                message: 'Incomplete form data'
            });
        }

        // Attempt to connect to MSSQL and execute the login procedure
        let pool = await sql.connect(mssqlConfig);
        logger.debug('SQL connection established for login attempt');

        const request = pool.request()
            .input('UserEmail', sql.NVarChar(100), email)
            .input('UserPassword', sql.NVarChar(100), password);

        const result = await request.execute('sp_ValidateUser');
        logger.debug('Stored procedure executed', {
            procedureName: 'sp_ValidateUser'
        });

        // Check the outcome of the stored procedure
        if (result.recordset.length > 0 && result.recordset[0].IsValid) {
            logger.info('Login successful', {
                email
            });

            // Set session and save it
            req.session.isAuthenticated = true;
            req.session.user = {
                email: req.body.email
            };
            req.session.save(err => {
                if (err) {
                    logger.error('Error saving session after successful login', {
                        email,
                        error: err
                    });
                    return res.status(500).json({
                        success: false,
                        message: 'Failed to create session.'
                    });
                }
                res.json({
                    success: true
                });
            });
        } else {
            logger.warn('Login failed - invalid credentials', {
                email
            });
            res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }
    } catch (err) {
        logger.error('Exception occurred during login attempt', {
            email,
            error: err
        });
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
});



// API Routes - user home(PATH)
app.get('/user', isAuthenticated, (req, res) => {
    logger.info('Serving user.html for authenticated user', {
        sessionId: req.session.id
    });
    res.sendFile(path.join(__dirname, './public/user.html'));
});

// API Routes - email(PATH)
app.get('/email', isAuthenticated, (req, res) => {
    logger.info('Serving email.html', {
        ip: req.ip
    });
    res.sendFile(path.join(__dirname, './public/email.html'));
});

// API Routes - course(PATH)
app.get('/courses', isAuthenticated, (req, res) => {
    logger.info('Serving courses.html for authenticated user', {
        sessionId: req.session.id
    });
    res.sendFile(path.join(__dirname, './public/courses.html'));
});

// API Routes - course(PATH)
app.get('/login', (req, res) => {
    logger.info('Serving login.html', {
        ip: req.ip
    });
    res.sendFile(path.join(__dirname, './public/login.html'));
});

// API Routes - course(PATH)
app.get('/register', (req, res) => {
    logger.info('Serving register.html', {
        ip: req.ip
    });
    res.sendFile(path.join(__dirname, './public/register.html'));
});

// API Routes - course(PATH)
app.get('/settings', isAuthenticated, (req, res) => {
    logger.info('Serving settings.html', {
        ip: req.ip
    });
    res.sendFile(path.join(__dirname, './public/settings.html'));
});

// API Routes - course(PATH)
app.post('/logout', isAuthenticated, (req, res) => {
    logger.info('Logout attempt', {
        sessionId: req.session ?.id,userId: req.session ?.userId
    });

    if (req.session) {
        const sessionId = req.session.id;
        const userId = req.session.userId;

        // Log the session and user information
        logger.info('Attempting to destroy session', {
            sessionId,
            userId
        });

        req.session.destroy(err => {
            if (err) {
                // Log the error with session and user information
                logger.error('Failed to destroy session during logout.', {
                    error: err,
                    sessionId,
                    userId
                });
                return res.status(500).send('Could not log out, please try again');
            }

            // Clear the session cookie and log this action
            res.clearCookie('connect.sid');
            logger.info('Session cookie cleared', {
                sessionId,
                userId
            });

            // Log the successful logout with user information
            logger.info('User logged out successfully', {
                sessionId,
                userId
            });

            res.json({
                success: true
            }); // Respond with JSON
        });
    } else {
        // Log the situation where logout is called with no active session
        logger.warn('Logout called but no session found');
        res.status(401).json({
            success: false,
            message: "No session found"
        });
    }
});

// API Routes - course content(PATH)
// Need to update to make it look for individual courses
app.get('/course', isAuthenticated, (req, res) => {
    const courseId = req.params.courseId;
    res.sendFile(path.join(__dirname, './public/course.html'));
});

// API Routes - retrieve course content from DB(API)
app.get('/files/pdf/:courseId', isAuthenticated, async (req, res) => {
    const courseId = req.params.courseId;
    try {
        let pool = await sql.connect(mssqlConfig);
        const request = pool.request();
        request.input('CourseId', sql.Int, courseId);
        const result = await request.query(`
            SELECT CoursePDF 
            FROM CourseContent 
            WHERE CourseID = @CourseId
        `);

        if (result.recordset.length > 0) {
            const filePath = result.recordset[0].CoursePDF;
            res.sendFile(filePath, {
                root: path.join(__dirname, '/')
            });
        } else {
            res.status(404).send('PDF file not found');
        }
    } catch (err) {
        logger.error('Failed to serve PDF', {
            error: err.message
        });
        res.status(500).send("Internal Server Error");
    }
});

// API Routes - retriev emails from DB(API)
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