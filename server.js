/*
Author: Padraig McCauley - 20123744
BiggerPhish Educational Platform

TODO:
    Security:
        Run ZAP testing

    Functional:
        Test plans
        Styling
        Help section/instructions on uses - admin
        Help section/instructions on uses - User
        content creation for courses

    Enviroment:
        Static IP
        Control traffic
*/

// Environment and Package Declarations
const express = require('express');
const fileUpload = require('express-fileupload');
const sql = require('mssql');
const path = require('path');
const fs = require('fs');
const {
    MongoClient,
    ServerApiVersion
} = require('mongodb');
const session = require('express-session');
const winston = require('winston');
const { createLogger, format, transports } = winston;
const { combine, timestamp, printf } = format;
const bodyParser = require('body-parser');
const { stringify } = require('querystring');
const { log } = require('console');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');
const helmet = require('helmet');

require('dotenv').config();


// App Instance and Middleware Setup
const app = express();
const port = process.env.PORT || 3000;
app.set('trust proxy', true);

app.use(bodyParser.json());
app.use(fileUpload());
app.use(express.static(path.join(__dirname, 'public'), {
    index: false
}));

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true
}));


// Helmet setup
const scriptSources = [
    "'self'", 
    'https://code.jquery.com',
    'https://cdn.jsdelivr.net',
    'https://stackpath.bootstrapcdn.com',
    'https://cdnjs.cloudflare.com'
    //"'unsafe-inline'"
];

const styleSources = [
    "'self'",
    'https://stackpath.bootstrapcdn.com',
    'https://cdnjs.cloudflare.com',
    'https://cdn.jsdelivr.net'
    //"'unsafe-inline'"
];

const workerSources = [
    "'self'",
    'blob:'
];

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: scriptSources,
            styleSrc: styleSources,
            workerSrc: workerSources,
            // Optionally allow unsafe-inline for event handlers
            //'script-src-attr': ["'self'", "'unsafe-inline'"]
        }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));



// MongoDB Connection
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});


// MSSQL Connection Configuration
const mssqlConfig = {
    user: process.env.MSSQL_DB_USERNAME,
    password: process.env.MSSQL_DB_PASSWORD,
    server: process.env.MSSQL_SERVER,
    database: process.env.MSSQL_DATABASE,
    options: {
        encrypt: false
    }
};

class MSSQLTransport extends winston.Transport {
    constructor(opts) {
        super(opts);
        this.pool = new sql.ConnectionPool(mssqlConfig);
        this.pool.connect().then(() => {
            console.log('Connected to MSSQL for logging');
        }).catch(err => {
            console.error('Error connecting to MSSQL:', err);
        });
    }

    log(info, callback) {
        setImmediate(() => this.emit('logged', info));

        const { timestamp, level, message, sessionId, ...meta } = info;

        const query = `INSERT INTO Log (Timestamp, Level, Message, Meta, SessionId) VALUES (@timestamp, @level, @message, @meta, @sessionId)`;
        const request = this.pool.request();
        request.input('timestamp', sql.DateTime, new Date(timestamp));
        request.input('level', sql.NVarChar(50), level);
        request.input('message', sql.NVarChar(sql.MAX), message);
        request.input('meta', sql.NVarChar(sql.MAX), JSON.stringify(meta));
        request.input('sessionId', sql.NVarChar(100), sessionId || null);

        request.query(query, (err) => {
            if (err) {
                console.error('Error logging to MSSQL:', err);
            }
            callback();
        });
    }
}

const logger = createLogger({
    level: 'info',
    format: combine(
        timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        format.errors({
            stack: true
        }),
        printf((info) => {
            let msg = `${info.timestamp} ${info.level}: ${info.message}`;

            const additionalInfo = Object.assign({}, info);
            delete additionalInfo.message;
            delete additionalInfo.level;
            delete additionalInfo.timestamp;
            delete additionalInfo.stack;

            if (Object.keys(additionalInfo).length > 0) {
                msg += ` ${JSON.stringify(additionalInfo)}`;
            }

            return msg;
        })
    ),
    transports: [
        new transports.Console({
            format: combine(
                format.colorize(),
                printf(info => {
                    return `${info.timestamp} ${info.level}: ${info.message}`;
                })
            )
        }),
        new transports.File({
            filename: 'error.log',
            level: 'error'
        }),
        new transports.File({
            filename: 'combined.log'
        }),
        new MSSQLTransport()
    ]
});

module.exports = logger;

// Middleware Functions
function isAuthenticated(req, res, next) {
    if (req.isAuthenticatedChecked) {
        return next();
    }
    req.isAuthenticatedChecked = true;

    logger.info('Checking if request is authenticated');
    logger.debug('Session details:', { session: req.session });

    if (req.session.isAuthenticated) {
        logger.info('Request is authenticated, proceeding to next middleware');
        return next();
    } else {
        logger.warn('Request is not authenticated, redirecting to root', {
            sessionId: req.session.id,
            path: req.path
        });
        res.redirect('/');
    }
}

function isAdmin(req, res, next) {
    if (req.isAdminChecked) {
        return next();
    }
    req.isAdminChecked = true;

    logger.info('Checking if request is from an admin');
    logger.debug('Session details:', { session: req.session });

    if (req.session.user && req.session.user.isAdmin) {
        logger.info('Admin verified, proceeding to next middleware');
        next();
    } else {
        logger.warn('Admin not verified, redirecting to login page', {
            sessionId: req.session.id,
            path: req.path,
            isAdmin: req.session.user ? req.session.user.isAdmin : 'undefined',
            user: req.session.user || 'undefined'
        });
        res.redirect('/login');
    }
}

//Enrolled check
async function isEnrolled(req, res, next) {
    const userId = req.session.user ? req.session.user.id : null; // Assuming session stores user ID
    const courseId = req.params.courseId;
    logger.info(JSON.stringify(req.session));
    logger.info(`userId: ${userId}, courseId: ${courseId}`);

    if (!userId || !courseId) {

        logger.warn('User ID or Course ID not provided');
        return res.status(400).json({ message: 'User ID or Course ID not provided' });
    }

    try {
        let pool = await sql.connect(mssqlConfig);
        const request = pool.request()
            .input('UserID', sql.Int, userId)
            .input('CourseID', sql.Int, courseId);

        const result = await request.execute(`sp_IsEnrolled`);

        if (result.recordset.length > 0) {
            logger.info('User is enrolled in the course', { userId, courseId });
            next(); // User is enrolled, proceed to the next middleware or route handler
        } else {
            logger.info('User is not enrolled in the course', { userId, courseId });
            res.redirect('/courses'); // Redirect to the courses page
        }
    } catch (err) {
        logger.error('Error checking enrollment:', err);
        res.status(500).json({ message: 'Server error' });
    }
}


app.use((req, res, next) => {
    logger.defaultMeta = { sessionId: req.sessionID };
    next();
});



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

//For PDF file uploading
const uploadDirectory = path.join(__dirname, './public/coursecontent/');

// Ensure the upload directory exists
if (!fs.existsSync(uploadDirectory)) {
    fs.mkdirSync(uploadDirectory, { recursive: true });
    logger.info(`Created upload directory at ${uploadDirectory}`);
}

//Endpoing for file uplaod
app.post('/api/upload-pdf', (req, res) => {
    logger.info('Received request to upload PDF');

    if (!req.files || !req.files.file) {
        logger.error('No file uploaded');
        return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const pdfFile = req.files.file;
    logger.info(`File details: ${JSON.stringify(pdfFile)}`);

    const uploadPath = path.join(uploadDirectory, pdfFile.name);
    logger.info(`Upload path: ${uploadPath}`);

    pdfFile.mv(uploadPath, (err) => {
        if (err) {
            logger.error(`Error moving file to upload path: ${err}`);
            return res.status(500).json({ success: false, message: 'Error uploading file' });
        }

        logger.info('File successfully moved to upload path');
        let filePath = path.join('/coursecontent', pdfFile.name);
        filePath = filePath.replace(/\\/g, '/');  // Ensure the path uses forward slashes
        logger.info(`File available at: ${filePath}`);
        res.json({ success: true, filePath: filePath });
    });
});

//function to get user data
async function fetchUserData(email) {
    let pool = await sql.connect(mssqlConfig);
    logger.debug('SQL connection established for fetching user data');

    const request = pool.request();
    request.input('UserEmail', sql.NVarChar(100), email);

    const result = await request.execute('sp_UserSearch');
    logger.debug('Stored procedure executed for fetching user data', {
        userEmail: email
    });

    return result.recordset.length > 0 ? result.recordset[0] : null;
}

// API Routes - root
app.get('/', (req, res) => {
    logger.info('Received request for root route.');
    logger.debug('Session details at root:', {
        session: req.session,
        sessionId: req.sessionID  // Logging the session ID for better traceability
    });
    if(req.session.user){
    logger.info('admin = ' + JSON.stringify(req.session.user.isAdmin));
    }
    if (req.session.user && JSON.stringify(req.session.user.isAdmin) == 'true') {
        logger.info('Admin check passed, serving admin.html', {
            sessionId: req.session.id,
            email: req.session.user.email
        });
        res.sendFile(path.join(__dirname, './public/admin.html'));
    } else if (req.session.isAuthenticated) {
        logger.info('Admin check failed, but user is authenticated, serving user.html', {
            sessionId: req.session.id,
            email: req.session.user ? req.session.user.email : 'Email not set'
        });
        res.sendFile(path.join(__dirname, './public/user.html'));
    } else {
        logger.info('User is not authenticated, serving index.html');
        res.sendFile(path.join(__dirname, './public/index.html'));
    }
});

// API Routes - user-Data for logged-in user(API)
app.get('/user-data', isAuthenticated, async (req, res) => {
    const userEmail = req.session.user.email;
    const userData = await fetchUserData(userEmail);

    if (userData) {
        logger.info('User data retrieved successfully:', JSON.stringify(userData));
        res.json(userData);
    } else {
        logger.warn('No user data found for email', { userEmail });
        res.status(404).send('User not found');
    }
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
        // Hash the password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        let pool = await sql.connect(mssqlConfig);
        const request = pool.request()
            .input('UserFName', sql.NVarChar(100), firstName)
            .input('UserEmail', sql.NVarChar(100), email)
            .input('UserPassword', sql.NVarChar(100), hashedPassword); // Store the hashed password

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

// API Routes - create course
app.post('/api/create-course', isAuthenticated, isAdmin, async (req, res) => {
    const { title, description } = req.body;

    if (!title || !description) {
        logger.error('Course creation attempt with incomplete form data');
        return res.status(400).json({
            success: false,
            message: 'Incomplete form data'
        });
    }

    try {
        let pool = await sql.connect(mssqlConfig);
        const request = pool.request()
            .input('Title', sql.NVarChar(255), title)
            .input('Description', sql.NVarChar(500), description);

        const result = await request.execute('sp_InsertCourse');

        if (result.recordset.length > 0 && result.recordset[0].NewCourseID) {
            const newCourseId = result.recordset[0].NewCourseID;

            logger.info('Course created successfully', {
                title: title,
                newCourseId: newCourseId
            });

            res.json({
                success: true,
                newCourseId: newCourseId
            });
        } else {
            throw new Error('Failed to create course.');
        }
    } catch (err) {
        logger.error('Error occurred during course creation:', err);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

//update course info
app.put('/api/course/:courseId', isAuthenticated, isAdmin, async (req, res) => {
    const courseId = req.params.courseId;
    const { title, description } = req.body;

    try {
        let pool = await sql.connect(mssqlConfig);
        const result = await pool.request()
            .input('CourseID', sql.Int, courseId)
            .input('Title', sql.NVarChar(255), title)
            .input('Description', sql.NVarChar(500), description)
            .execute('sp_UpdateCourse');

        if (result.rowsAffected[0] > 0) {
            res.json({ success: true });
        } else {
            res.status(404).json({ message: 'Course not found' });
        }
    } catch (err) {
        logger.error('Error updating course:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// API Routes - create course content
app.post('/api/course/:courseId/content', isAuthenticated, isAdmin, async (req, res) => {
    const courseId = req.params.courseId;

    // Log the raw request
    logger.info(req.headers);
    logger.info(req.body);

    const pdfFile = req.body.pdfFile;
    const xlsxData = req.body.xlsxData ? JSON.parse(req.body.xlsxData) : null;
    const contentType = req.body.contentType;
    const contentName = req.body.contentName;
    const contentDescription = req.body.contentDescription;

    // Log the parsed request body
    //logger.info(`Received request: ${JSON.stringify(req.body, null, 2)}`);

    try {
        let pool = await sql.connect(mssqlConfig);

        const contentData = {
            coursePDF: pdfFile ? `${pdfFile}` : null,
            contentName: contentName,
            contentDescription: contentDescription,
            contentType: contentType,
            emailID: null // This will be updated after emails are uploaded
        };

        //logger.info(`Received content upload request: CourseID: ${courseId}, ContentData: ${JSON.stringify(contentData)}, ContentType: ${contentType}`);

        const result = await createCourseContent(courseId, contentData);

        if (xlsxData) {
            logger.info('Uploading emails', `CollectionName: ${result.collectionName}`, `xlsxData: ${JSON.stringify(xlsxData)}`);
            await uploadEmails(result.collectionName, xlsxData);
        }

        res.json({ success: true, contentId: result.contentId });
    } catch (err) {
        logger.error('Error occurred during course content upload:', err);
        res.status(500).json({ message: 'Server error' });
    }
});



// Helper function to create course content
async function createCourseContent(courseId, content) {
    try {
        let pool = await sql.connect(mssqlConfig);
        const request = pool.request()
            .input('CourseID', sql.Int, courseId)
            .input('CoursePDF', sql.NVarChar(sql.MAX), content.coursePDF || null)
            .input('ContentName', sql.NVarChar(255), content.contentName || null)
            .input('ContentDescription', sql.NVarChar(sql.MAX), content.contentDescription || null)
            .input('ContentType', sql.NVarChar(50), content.contentType || null);

        const result = await request.execute('sp_InsertCourseContent');

        if (result.recordset.length > 0 && result.recordset[0].ContentID) {
            const contentId = result.recordset[0].ContentID;
            const collectionName = `${courseId}_${contentId}`;

            logger.info(`Course content created successfully: CourseID: ${courseId}, ContentID: ${contentId}`);

            return { courseId, contentId, collectionName };
        } else {
            throw new Error('Failed to create course content.');
        }
    } catch (err) {
        logger.error(`Error occurred during course content creation: ${err.message}`);
        throw err;
    }
}


// Helper function to upload emails
async function uploadEmails(collectionName, emailData) {
    try {
        const collection = client.db("emailDB").collection(collectionName);
        const result = await collection.insertMany(emailData);

        logger.info(`Emails uploaded successfully: CollectionName: ${collectionName}, InsertedCount: ${result.insertedCount}`);

        return {
            success: true,
            insertedCount: result.insertedCount,
            insertedIds: result.insertedIds
        };
    } catch (err) {
        logger.error(`Failed to insert emails: ${err.message}, CollectionName: ${collectionName}`);
        throw err;
    }
}




app.post('/update-user-email', isAuthenticated, async (req, res) => {
    const { oldEmail, newEmail } = req.body;

    // Validate that both old and new emails are provided
    if (!oldEmail || !newEmail) {
        logger.error('Update user email attempt with incomplete form data', { oldEmail, newEmail });
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
        const returnValue = result.returnValue;

        // Check if the stored procedure completed successfully
        if (returnValue === 0) {
            logger.info('User email updated successfully', { oldEmail, newEmail });

            // Update the email in the session if the user updating the email is the same as the one logged in
            if (req.session.user && req.session.user.email === oldEmail) {
                req.session.user.email = newEmail;
                req.session.save(err => {
                    if (err) {
                        logger.error('Error saving session after email update', { error: err.message, oldEmail, newEmail });
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
            let errorMessage = 'Unknown error occurred';
            if (returnValue === 1) {
                errorMessage = 'User not found';
                logger.warn('Failed to update email - User not found', { oldEmail, newEmail });
            } else if (returnValue === 2) {
                errorMessage = 'New email is already in use';
                logger.warn('Failed to update email - New email already in use', { oldEmail, newEmail });
            }
            res.status(400).json({
                success: false,
                message: errorMessage
            });
        }
    } catch (err) {
        let errorMessage = 'Server error';

        // Specific error handling for unique constraint violation
        if (err.message.includes('unique constraint') || err.message.includes('duplicate key')) {
            errorMessage = 'Cannot use the same email for updating';
        }

        logger.error('Error occurred during updating user email:', { error: err.message, oldEmail, newEmail });
        res.status(500).json({
            success: false,
            message: errorMessage
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
app.post('/update-user-password', isAuthenticated, async (req, res) => {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
        logger.error('Update user password attempt with incomplete form data', { email });
        return res.status(400).json({
            success: false,
            message: 'Incomplete form data'
        });
    }

    try {
        // Hash the new password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

        let pool = await sql.connect(mssqlConfig);
        const request = pool.request()
            .input('UserEmail', sql.NVarChar(100), email)
            .input('NewPassword', sql.NVarChar(100), hashedPassword);
        
        logger.info(email);
        const result = await request.execute('sp_UpdateUserPassword');
        const returnValue = result.returnValue;

        // Check if the stored procedure returned an expected value - '0' means success
        if (returnValue === 0) {
            logger.info('User password updated successfully', { email });
            res.json({
                success: true,
                message: 'Password updated successfully'
            });
        } else {
            // Handle specific errors if the stored procedure returns specific error codes
            let errorMessage = 'Unknown error occurred';
            if (returnValue === 1) {
                errorMessage = 'User not found';
                logger.warn('Failed to update password - User not found', { email });
            } else if (returnValue === 2) {
                errorMessage = 'No update occurred';
                logger.warn('No update occurred', { email });
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
app.post('/update-user-name', isAuthenticated, async (req, res) => {
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
                req.session.user.firstName = newFName; 
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
    let email;

    try {
        const { email: reqEmail, password } = req.body;
        email = reqEmail;

        logger.info(`Received login request for email: ${email}`);

        if (!email || !password) {
            logger.warn(`Login attempt with incomplete form data for email: ${email}`);
            return res.status(400).json({
                success: false,
                message: 'Incomplete form data'
            });
        }

        let pool = await sql.connect(mssqlConfig);
        logger.debug('SQL connection established for login attempt');

        const request = pool.request()
            .input('UserEmail', sql.NVarChar(100), email);

        // Fetch the hashed password from the database
        const passwordResult = await request.execute('sp_FetchUserData');

        logger.debug(`Query executed for fetching hashed password with email: ${email}`);

        if (passwordResult.recordset.length > 0) {
            const hashedPassword = passwordResult.recordset[0].Password;
            const userId = passwordResult.recordset[0].UserId;

            // Compare the provided password with the hashed password
            const passwordMatch = await bcrypt.compare(password, hashedPassword);

            if (passwordMatch) {
                // Call the stored procedure to validate the user
                const validateRequest = pool.request()
                    .input('UserEmail', sql.NVarChar(100), email)
                    .input('UserPassword', sql.NVarChar(100), hashedPassword);

                const validateResult = await validateRequest.execute('sp_ValidateUser');
                logger.debug(`Stored procedure executed for login validation with email: ${email}`);

                const isValid = validateResult.recordset[0].IsValid;

                if (isValid) {
                    const userData = await fetchUserData(email);
                    if (!userData) {
                        logger.warn(`User data not found after login for email: ${email}`);
                        return res.status(404).send('User not found');
                    }

                    req.session.isAuthenticated = true;
                    req.session.user = {
                        id: userId,  // Ensure the user ID is stored in the session
                        email: email,
                        isAdmin: userData.Admin
                    };
                    logger.info(`User isAdmin status: ${req.session.user.isAdmin}`);
                    req.session.save(err => {
                        if (err) {
                            logger.error(`Error saving session after successful login for email: ${email}`, { error: err });
                            return res.status(500).json({
                                success: false,
                                message: 'Failed to create session.'
                            });
                        }
                        res.json({
                            success: true,
                            user: userData
                        });
                    });
                } else {
                    logger.warn(`Login failed - invalid credentials for email: ${email}`);
                    res.status(401).json({
                        success: false,
                        message: 'Invalid email or password'
                    });
                }
            } else {
                logger.warn(`Login failed - invalid password for email: ${email}`);
                res.status(401).json({
                    success: false,
                    message: 'Invalid email or password'
                });
            }
        } else {
            logger.warn(`Login failed - user not found for email: ${email}`);
            res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }
    } catch (err) {
        logger.error(`Exception occurred during login attempt for email: ${email}`, { error: err.message, stack: err.stack });
        res.status(500).json({
            success: false,
            message: 'Server error occurred during login attempt',
            error: err.message
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

// Route for admin-specific page
app.get('/admin', isAuthenticated, isAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, './public/admin.html'));
});

// Admin-specific courses page
app.get('/admin-courses', isAuthenticated, isAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, './public/admin-courses.html'));
});

app.get('/admin-courses/:courseId', isAuthenticated, isAdmin, async (req, res) => {
    const courseId = req.params.courseId;
    
    // Validate the courseId
    if (!courseId || isNaN(Number(courseId))) {
        logger.error('Invalid courseId provided', { courseId });
        return res.status(400).send('Invalid course identifier');
    }

    logger.info('Serving admin-course-edit.html for course', { courseId });
    res.sendFile(path.join(__dirname, './public/admin-course-edit.html'));
});

//fetch course info
app.get('/api/course/:courseId', isAuthenticated, isAdmin, async (req, res) => {
    const courseId = req.params.courseId;

    try {
        let pool = await sql.connect(mssqlConfig);
        logger.info(`Connected to database to fetch details for course ID: ${courseId}`);

        // Fetch course details
        const courseResult = await pool.request()
            .input('CourseID', sql.Int, courseId)
            .execute('sp_FetchCourseInfo');

        if (courseResult.recordset.length === 0) {
            logger.warn(`Course not found for ID: ${courseId}`);
            return res.status(404).json({ message: 'Course not found' });
        }

        logger.info(`Successfully fetched course details for ID: ${courseId}`);

        // Fetch course content
        const contentResult = await pool.request()
            .input('CourseID', sql.Int, courseId)
            .execute('sp_FetchCourseContent');

        logger.info(`Successfully fetched course content for course ID: ${courseId}`);

        res.json({
            course: courseResult.recordset[0],
            content: contentResult.recordset
        });

        logger.info(`Successfully sent response for course ID: ${courseId}`);
    } catch (err) {
        logger.error(`Error fetching course details and content for course ID: ${courseId}`, err);
        res.status(500).json({ message: 'Server error' });
    }
});


// Update course content
app.put('/api/course/content/:contentId', isAuthenticated, isAdmin, async (req, res) => {
    const contentId = req.params.contentId;
    const { contentName, contentDescription } = req.body;

    try {
        let pool = await sql.connect(mssqlConfig);
        const result = await pool.request()
            .input('ContentID', sql.Int, contentId)
            .input('ContentName', sql.NVarChar(255), contentName)
            .input('ContentDescription', sql.NVarChar(500), contentDescription)
            .execute('sp_UpdateCourseContent');

        if (result.rowsAffected[0] > 0) {
            res.json({ success: true });
        } else {
            res.status(404).json({ message: 'Content not found' });
        }
    } catch (err) {
        logger.error('Error updating course content:', err);
        res.status(500).json({ message: 'Server error' });
    }
});


//api for deleteing course content
app.delete('/api/course/content/:contentId', isAuthenticated, async (req, res) => {
    const contentId = req.params.contentId;

    try {
        let pool = await sql.connect(mssqlConfig);
        await pool.request()
            .input('ContentID', sql.Int, contentId)
            .execute('sp_DeleteCourseContent');

        res.json({ success: true });
    } catch (err) {
        logger.error('Error deleting course content:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

//API - Create Course Content
app.post('/api/course/:courseId/content', isAuthenticated, isAdmin, async (req, res) => {
    const courseId = req.params.courseId;
    const { contentType } = req.body;

    const pdfFile = req.files ? req.files.pdfFile : null;
    const xlsxData = req.body.xlsxData ? JSON.parse(req.body.xlsxData) : null;

    try {
        let pool = await sql.connect(mssqlConfig);

        const contentData = {
            coursePDF: pdfFile ? `${pdfFile.name}` : null,
            courseVideo: null,
            emailLevel: null,
            contentType: contentType
        };

        const result = await createCourseContent(courseId, contentData);

        if (xlsxData) {
            await uploadEmails(result.collectionName, xlsxData);
        }

        res.json({ success: true, contentId: result.contentId });
    } catch (err) {
        logger.error('Error occurred during course content upload:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

//API - UserCourseStatus
app.get('/api/my-courses-with-status', isAuthenticated, async (req, res) => {
    const userId = req.session.user.id;

    try {
        let pool = await sql.connect(mssqlConfig);
        const result = await pool.request()
            .input('UserID', sql.Int, userId)
            .query(`
                SELECT 
                    uc.UserCourseID, 
                    uc.UserID, 
                    uc.CourseID, 
                    uc.EnrollDate, 
                    uc.CompletedDate, 
                    CASE WHEN ucc.IsCompleted = 1 THEN 'Completed' ELSE 'Not Completed' END AS CompletionStatus
                FROM 
                    BiggerPhish.dbo.UserCourses uc
                LEFT JOIN 
                    BiggerPhish.dbo.UserCourseContents ucc ON uc.UserCourseID = ucc.UserCourseID
                WHERE 
                    uc.UserID = @UserID
            `);

        res.json(result.recordset);
    } catch (err) {
        logger.error('Error fetching user courses with status:', err);
        res.status(500).json({ message: 'Server error' });
    }
});


// API Routes - retrieve users course contents
app.get('/api/course/:courseId/contents', isAuthenticated, async (req, res) => {
    const courseId = req.params.courseId;
    const userId = req.session.user.id;

    try {
        let pool = await sql.connect(mssqlConfig);
        const result = await pool.request()
            .input('CourseID', sql.Int, courseId)
            .input('UserID', sql.Int, userId)
            .execute('sp_FetchUserCourseContent');

        if (result.recordset.length > 0) {
            res.json(result.recordset);
        } else {
            res.status(404).json({ message: 'No content found for this course' });
        }
    } catch (err) {
        logger.error('Error fetching course contents:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

//API - Get users enrolled courses
app.get('/api/my-enrolled-courses', isAuthenticated, async (req, res) => {
    const userEmail = req.session.user?.email;

    logger.info('Fetching enrolled courses', { userEmail: userEmail });

    try {
        let pool = await sql.connect(mssqlConfig);
        logger.info('MSSQL connection established for fetching enrolled courses.');

        const request = pool.request();
        request.input('UserEmail', sql.NVarChar(100), userEmail);
        const result = await request.execute(`sp_MyEnrolledCourses`);

        logger.debug('SQL query executed for enrolled courses', { query: request.query });

        if (result.recordset.length > 0) {
            logger.info('Enrolled courses retrieved successfully.', { count: result.recordset.length });
            res.json(result.recordset);
        } else {
            logger.warn('No courses found for user', { userEmail: userEmail });
            res.json([]);  // Return an empty array if no courses are found
        }
    } catch (err) {
        logger.error('Error retrieving enrolled courses', {
            userEmail: userEmail,
            error: err.message
        });
        res.status(500).send("Error fetching user's courses");
    }
});

//API - enroll student in a course
app.post('/api/enroll-course/:courseId', isAuthenticated, async (req, res) => {
    const userId = req.session.user.id;
    const courseId = req.params.courseId;

    try {
        let pool = await sql.connect(mssqlConfig);
        const request = pool.request()
            .input('UserID', sql.Int, userId)
            .input('CourseID', sql.Int, courseId);

        await request.execute('EnrollStudent'); // Call the stored procedure

        res.json({ success: true });
    } catch (err) {
        logger.error('Error enrolling in course:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// API Route to get specific course content by contentId
app.get('/api/course/content/:contentId', isAuthenticated, isAdmin, async (req, res) => {
    const contentId = req.params.contentId;

    try {
        let pool = await sql.connect(mssqlConfig);
        const result = await pool.request()
            .input('ContentID', sql.Int, contentId)
            .execute('sp_FetchCourseContentByID');

        if (result.recordset.length > 0) {
            res.json({ success: true, content: result.recordset[0] });
        } else {
            res.status(404).json({ success: false, message: 'Content not found' });
        }
    } catch (err) {
        logger.error('Error fetching content details:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// API Route to mark content as complete
app.post('/api/complete-content/:contentId', isAuthenticated, async (req, res) => {
    const contentId = req.params.contentId;
    const userId = req.session.user.id; 

    try {
        let pool = await sql.connect(mssqlConfig);
        logger.info(`Connected to database to mark content as complete for content ID: ${contentId} and user ID: ${userId}`);

        const request1 = pool.request()
            .input('ContentID', sql.Int, contentId)
            .input('UserID', sql.Int, userId);

        const userCourseIdResult = await request1.execute('sp_GetUserCourseID');
        logger.info(`User course ID query executed for content ID: ${contentId} and user ID: ${userId}`);

        if (userCourseIdResult.recordset.length === 1) {
            const userCourseId = userCourseIdResult.recordset[0].UserCourseID;

            const request = pool.request()
            await request
                .input('UserCourseID', sql.Int, userCourseId)
                .input('ContentID', sql.Int, contentId)
                .execute('sp_MarkContentComplete');

            logger.info(`Content marked as complete for content ID: ${contentId}, user ID: ${userId}, and user course ID: ${userCourseId}`);
            res.json({ success: true });
        } else {
            logger.error(`User is not enrolled in the course associated with content ID: ${contentId} and user ID: ${userId}`);
            res.status(400).json({ message: 'User is not enrolled in the course associated with this content.' });
        }
    } catch (err) {
        logger.error(`Error marking content as complete for content ID: ${contentId} and user ID: ${userId}`, err);
        res.status(500).json({ message: 'Server error' });
    }
});




// Admin-specific users management page
app.get('/admin-users', isAuthenticated, isAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, './public/admin-users.html'));
});



// API Routes - email(PATH)
app.get('/email/:id', isAuthenticated, (req, res) => {
    const id = req.params.id;
    logger.info('Serving email.html', {
        ip: req.ip,
        id: id
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


// Serve the forgotten password page
app.get('/forgottenPassword', (req, res) => {
    logger.info('Serving forgottenPassword.html', {
        ip: req.ip
    });
    res.sendFile(path.join(__dirname, './public/forgottenPassword.html'));
});

//Handle the PW reset and the mailing of the PW
app.post('/send-reset-link', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        logger.error('Password reset attempt with incomplete form data', { email });
        return res.status(400).json({
            success: false,
            message: 'Incomplete form data'
        });
    }

    try {
        // Generate a temporary password
        const tempPassword = uuidv4().slice(0, 8); // Generate a simple temporary password
        const saltRounds = 10;
        const hashedTempPassword = await bcrypt.hash(tempPassword, saltRounds);

        // Update the password in the database
        let pool = await sql.connect(mssqlConfig);
        const request = pool.request()
            .input('UserEmail', sql.NVarChar(100), email)
            .input('NewPassword', sql.NVarChar(100), hashedTempPassword);

        const result = await request.execute('sp_UpdateUserPassword');

        // Check if the stored procedure returned an expected value - '0' means success
        if (result.returnValue !== 0) {
            let errorMessage = 'Unknown error occurred';
            if (result.returnValue === 1) {
                errorMessage = 'User not found';
                logger.warn('Failed to update password - User not found', { email });
            } else if (result.returnValue === 2) {
                errorMessage = 'No update occurred';
                logger.warn('No update occurred', { email });
            }
            return res.status(400).json({
                success: false,
                message: errorMessage
            });
        }

        // Fetch email credentials from the database
        const mailerRequest = pool.request();
        const mailerResult = await mailerRequest.execute('sp_FetchEmails');
        const { Username: gmailUser, Password: gmailPass } = mailerResult.recordset[0];

        // Send the temporary password via email
        const emailer = nodemailer.createTransport({
            service: 'Gmail',
            auth: {
                user: gmailUser,
                pass: gmailPass
            }
        });

        const mailContent = {
            to: email,
            from: gmailUser,
            subject: 'BiggerPhish Temporary Password',
            text: `You are receiving this because you (or someone else) have requested a temporary password for your account.\n\n
                   Your temporary password is: ${tempPassword}\n\n
                   Please use this password to log in and change your password immediately.\n\n
                   If you did not request this, please ignore this email and your password will remain unchanged.\n`
        };

        await emailer.sendMail(mailContent);

        logger.info('Temporary password sent successfully', { email });
        res.json({
            success: true,
            message: 'A temporary password has been sent to your email address.'
        });
    } catch (err) {
        logger.error('Error occurred during password reset request', {
            error: err.message,
            email
        });
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});


// Handle password reset form submission
app.post('/reset-password', isAuthenticated,async (req, res) => {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
        logger.error('Password reset attempt with incomplete form data');
        return res.status(400).json({
            success: false,
            message: 'Incomplete form data'
        });
    }

    try {
        // Hash the new password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

        // Update the password in the database
        let pool = await sql.connect(mssqlConfig);
        const request = pool.request()
            .input('UserEmail', sql.NVarChar(100), email)
            .input('NewPassword', sql.NVarChar(100), hashedPassword);

        const result = await request.execute('sp_UpdateUserPassword');

        // Check if the stored procedure returned an expected value - '0' means success
        if (result.returnValue === 0) {
            logger.info('User password updated successfully', { email });
            res.json({
                success: true,
                message: 'Password updated successfully'
            });
        } else {
            // Handle specific errors if the stored procedure returns specific error codes
            let errorMessage = 'Unknown error occurred';
            if (result.returnValue === 1) {
                errorMessage = 'User not found';
                logger.warn('Failed to update password - User not found', { email });
            } else if (result.returnValue === 2) {
                errorMessage = 'No update occurred';
                logger.warn('No update occurred', { email });
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


// API Routes - course(PATH)
// Route for settings page
app.get('/settings', isAuthenticated, (req, res, next) => {
    // Check if user is admin
    if (req.session.user && req.session.user.isAdmin) {
        logger.info('Admin verified, serving admin-settings.html', { ip: req.ip });
        res.sendFile(path.join(__dirname, './public/admin-settings.html'));
    } else {
        logger.info('Serving settings.html for regular user', { ip: req.ip });
        res.sendFile(path.join(__dirname, './public/settings.html'));
    }
});


// API Routes - course(PATH)
app.post('/logout', (req, res) => {
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
// API Route to serve a specific course by courseId
app.get('/course/:courseId', isAuthenticated, isEnrolled,(req, res) => {
    const courseId = req.params.courseId;  // Capture courseId from URL parameter
    
    if (!courseId || isNaN(Number(courseId))) {
        logger.error('Invalid courseId provided', { courseId });
        return res.status(400).send('Invalid course identifier');
    }

    logger.info('Serving course.html for course', { courseId });
    res.sendFile(path.join(__dirname, './public/course.html'));
});


// API Routes - retrieve course content from DB(API)
app.get('/files/pdf/:courseId', isAuthenticated, async (req, res) => {
    const courseId = req.params.courseId;
    console.log("Received request for course ID:", courseId); // Log the course ID

    try {
        let pool = await sql.connect(mssqlConfig);
        const request = pool.request();
        request.input('CourseId', sql.Int, courseId);
        const result = await request.execute(`sp_FetchCoursePDF`);

        if (result.recordset.length > 0) {
            const filePath = result.recordset[0].CoursePDF;
            const fullFilePath = path.join(__dirname, filePath);
            console.log("Serving PDF from:", fullFilePath); // Log the full file path
            res.sendFile(fullFilePath);
        } else {
            console.log('PDF file not found for course ID:', courseId); // Log if PDF not found
            res.status(404).send('PDF file not found');
        }
    } catch (err) {
        logger.error('Failed to serve PDF', {
            error: err.message
        });
        res.status(500).send("Internal Server Error");
    }
});



// API Route to get courses the user is enrolled in
app.get('/api/my-enrolled-courses', isAuthenticated, async (req, res) => {
    const userEmail = req.session.user?.email;

    logger.info('Fetching enrolled courses', { userEmail: userEmail });

    try {
        let pool = await sql.connect(mssqlConfig);
        logger.info('MSSQL connection established for fetching enrolled courses.');

        const request = pool.request();
        request.input('UserEmail', sql.NVarChar(100), userEmail);
        const result = await request.execute(`sp_MyEnrolledCourses`);

        logger.debug('SQL query executed for enrolled courses', { query: request.query });

        if (result.recordset.length > 0) {
            logger.info('Enrolled courses retrieved successfully.', { count: result.recordset.length });
            res.json(result.recordset);
        } else {
            logger.warn('No courses found for user', { userEmail: userEmail });
            res.json([]);  // Return an empty array if no courses are found
        }
    } catch (err) {
        logger.error('Error retrieving enrolled courses', {
            userEmail: userEmail,
            error: err.message
        });
        res.status(500).send("Error fetching user's courses");
    }
});

// Fetch specific user data by userId
app.get('/api/user/:userId', isAuthenticated, isAdmin, async (req, res) => {
    const userId = req.params.userId;

    try {
        let pool = await sql.connect(mssqlConfig);
        const result = await pool.request()
            .input('UserID', sql.Int, userId)
            .execute('sp_FetchUserById');

        if (result.recordset.length > 0) {
            logger.info(`Successfully fetched user with ID ${userId}`);
            res.json({ success: true, user: result.recordset[0] });
        } else {
            logger.warn(`User with ID ${userId} not found`);
            res.status(404).json({ success: false, message: 'User not found' });
        }
    } catch (err) {
        logger.error('Error fetching user details:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Update user data
app.put('/api/user/:userId', isAuthenticated, isAdmin, async (req, res) => {
    const userId = req.params.userId;
    const { firstName, email } = req.body;

    try {
        let pool = await sql.connect(mssqlConfig);
        const result = await pool.request()
            .input('UserID', sql.Int, userId)
            .input('UserFName', sql.NVarChar(100), firstName)
            .input('UserEmail', sql.NVarChar(100), email)
            .execute('sp_UpdateUserById');

        if (result.rowsAffected[0] > 0) {
            logger.info(`Successfully updated user with ID ${userId}`);
            res.json({ success: true });
        } else {
            logger.warn(`User with ID ${userId} not found for update`);
            res.status(404).json({ message: 'User not found' });
        }
    } catch (err) {
        logger.error('Error updating user:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

//helper for logging out a deleted user
async function handleLogout(req, res) {
    if (req.session) {
        const sessionId = req.session.id;
        const userId = req.session.user.id;

        logger.info('Attempting to destroy session', { sessionId, userId });

        req.session.destroy(err => {
            if (err) {
                logger.error('Failed to destroy session during logout.', { error: err, sessionId, userId });
                return res.status(500).send('Could not log out, please try again');
            }

            res.clearCookie('connect.sid');
            logger.info('Session cookie cleared', { sessionId, userId });
            logger.info('User logged out successfully', { sessionId, userId });

            res.json({ success: true });
        });
    } else {
        logger.warn('Logout called but no session found');
        res.status(401).json({ success: false, message: "No session found" });
    }
}

// Delete user - admin
app.delete('/api/user', isAuthenticated, async (req, res) => {
    const userId = req.session.user.id;

    try {
        let pool = await sql.connect(mssqlConfig);
        const request = pool.request()
            .input('UserID', sql.Int, userId);

        const result = await request.execute('sp_DeleteUserById');
        const returnValue = result.returnValue;

        if (returnValue === 0) {
            logger.info(`Successfully deleted user with ID ${userId}`);
            await handleLogout(req, res);
        } else if (returnValue === 1) {
            logger.info(`User with ID ${userId} set to inactive`);
            await handleLogout(req, res);
        } else if (returnValue === 2) {
            logger.warn(`User with ID ${userId} not found for deletion`);
            res.status(404).json({ message: 'User not found' });
        } else {
            logger.error(`Unknown error occurred with return value ${returnValue}`);
            res.status(500).json({ message: 'An unknown error occurred' });
        }
    } catch (err) {
        logger.error('Error deleting user:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});


// Delete user - admin
app.delete('/api/user/:userId', isAuthenticated, isAdmin, async (req, res) => {
    const userId = req.params.userId;

    try {
        let pool = await sql.connect(mssqlConfig);
        const result = await pool.request()
            .input('UserID', sql.Int, userId)
            .execute('sp_DeleteUserById');
            const returnValue = result.returnValue;

            if (returnValue === 0) {
                logger.info(`Successfully deleted user with ID ${userId}`);
                await handleLogout(req, res);
            } else if (returnValue === 1) {
                logger.info(`User with ID ${userId} set to inactive`);
                await handleLogout(req, res);
            } else if (returnValue === 2) {
                logger.warn(`User with ID ${userId} not found for deletion`);
                res.status(404).json({ message: 'User not found' });
            } 
            else {
            logger.warn(`User with ID ${userId} not found for deletion`);
            res.status(404).json({ message: 'User not found' });
        }
    } catch (err) {
        logger.error('Error deleting user:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// API Route to get all courses
app.get('/api/all-courses', isAuthenticated, async (req, res) => {
    logger.info('Fetching all available courses.');

    try {
        let pool = await sql.connect(mssqlConfig);
        logger.info('MSSQL connection established for fetching all courses.');

        const result = await pool.request().execute(`sp_AllCourses`);

        logger.debug('SQL query executed for all courses', { query: result.command });

        if (result.recordset.length > 0) {
            logger.info('All courses retrieved successfully.', { count: result.recordset.length });
            res.json(result.recordset);
        } else {
            logger.warn('No courses available in the database.');
            res.status(404).send('No courses available.');
        }
    } catch (err) {
        logger.error('Error retrieving all courses', {
            error: err.message
        });
        res.status(500).send("Error fetching courses");
    }
});

// API Route to get all courses for admin
app.get('/api/admin/all-courses', isAuthenticated, isAdmin, async (req, res) => {
    logger.info('Admin fetching all available courses.');

    try {
        let pool = await sql.connect(mssqlConfig);
        logger.info('MSSQL connection established for admin fetching all courses.');

        const result = await pool.request().execute(`sp_AdminAllCourses`);

        logger.debug('SQL query executed for all admin courses', { query: result.command });

        if (result.recordset.length > 0) {
            logger.info('All courses retrieved successfully by admin.', { count: result.recordset.length });
            res.json(result.recordset);
        } else {
            logger.warn('No courses available in the database for admin.');
            res.status(404).send('No courses available.');
        }
    } catch (err) {
        logger.error('Error retrieving all courses by admin', {
            error: err.message
        });
        res.status(500).send("Error fetching courses for admin");
    }
});

// API endpoint to delete a course
app.delete('/api/course/:courseId', isAuthenticated, isAdmin, async (req, res) => {
    const courseId = req.params.courseId;

    try {
        let pool = await sql.connect(mssqlConfig);
        const request = pool.request()
            .input('CourseID', sql.Int, courseId);

        const result = await request.execute('sp_SoftDeleteCourse');
        const returnValue = result.returnValue;

        if (returnValue === -1) {
            return res.status(404).json({ success: false, message: 'Course not found' });
        }

        res.json({ success: true });
    } catch (err) {
        logger.error('Error deleting course:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});


// API Route to get all users for admin
app.get('/api/admin/all-users', isAuthenticated, isAdmin, async (req, res) => {
    logger.info('Admin fetching all users.');

    try {
        let pool = await sql.connect(mssqlConfig);
        logger.info('MSSQL connection established for admin fetching all users.');

        const result = await pool.request().query(`
            SELECT *
            FROM Users
            WHERE active = 1
        `);

        logger.debug('SQL query executed for all admin users', { query: result.command });

        if (result.recordset.length > 0) {
            logger.info('All users retrieved successfully by admin.', { count: result.recordset.length });
            res.json(result.recordset);
        } else {
            logger.warn('No users found in the database for admin.');
            res.status(404).send('No users found.');
        }
    } catch (err) {
        logger.error('Error retrieving all users by admin', {
            error: err.message
        });
        res.status(500).send("Error fetching users for admin");
    }
});


// API Routes - retrieve emails from specified collection (API)
app.get('/emails/:id', isAuthenticated, async (req, res) => {
    const collectionName = req.params.id;
    
    try {
        const collection = client.db("emailDB").collection(collectionName);
        const emails = await collection.find({}).toArray();
        res.json(emails);
    } catch (e) {
        logger.error('Failed to retrieve emails', { error: e.message, collectionName });
        res.status(500).send(e);
    }
});


// API Route - create a new collection and add entries to it
app.post('/emails/:collectionName', isAuthenticated, async (req, res) => {
    const collectionName = req.params.collectionName;
    const emailData = req.body;

    if (!Array.isArray(emailData)) {
        return res.status(400).send('Data must be an array of email entries.');
    }

    try {
        const collection = client.db("emailDB").collection(collectionName);
        const result = await collection.insertMany(emailData);

        res.json({
            success: true,
            insertedCount: result.insertedCount,
            insertedIds: result.insertedIds
        });
    } catch (e) {
        logger.error('Failed to insert emails', { error: e.message, collectionName });
        res.status(500).send(e);
    }
});

app.get('/grades', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, './public/grades.html'));
});

app.get('/api/user-grades', isAuthenticated, async (req, res) => {
    const userId = req.session.user.id;

    try {
        let pool = await sql.connect(mssqlConfig);

        const result = await pool.request()
            .input('UserID', sql.Int, userId)
            .execute(`sp_FetchUserGrades`);

        res.json(result.recordset);
    } catch (err) {
        logger.error('Error fetching user grades:', err);
        res.status(500).json({ message: 'Server error' });
    }
});



initializeDatabases().then(() => {
    app.listen(port, () => {
        console.log(`Server running on port ${port}`);
    });
}).catch(err => {
    console.error('Initialization failed:', err);
});