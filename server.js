/*
Author: Padraig McCauley - 20123744
BiggerPhish Educational Platform

TODO:
    Security:
        Security review of all endpoints/protect against unauthorized access to DB endpoints
        Enhance logging serverSide - Perhaps add a DB table that could be logged into

    Functional:
        Connect courses to email portal
        CRUD operations for Admin
        Add a content upload mechanism (for teachers/admin) - should be at least a PDF and a set of emails for the email tracker
        Add a course progress tracker

    Enviroment:
        Migrate to cloud servers
        Add a CI/CD pipeline
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
const { stringify } = require('querystring');
const { log } = require('console');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();


// App Instance and Middleware Setup
const app = express();
const port = process.env.PORT || 3000;
app.set('trust proxy', true);

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public'), {
    index: false
}));

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true
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

        const result = await request.query(`
            SELECT 1 FROM UserCourses WHERE UserID = @UserID AND CourseID = @CourseID
        `);

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



// Admin check middleware
function isAdmin(req, res, next) {
    logger.info('Checking if request is from an admin');

    // Log session details for debugging
    logger.debug('Session details:', {
        session: req.session
    });

    // Check if user is admin
    if (req.session.user && req.session.user.isAdmin) {
        logger.info('Admin verified, proceeding to next middleware');
        next();  // User is admin, continue with the request
    } else {
        logger.warn('Admin not verified, redirecting to login page', {
            sessionId: req.session.id,
            path: req.path
        });
        res.redirect('/login');  // Not admin, redirect to login or error page
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
app.post('/api/create-course', async (req, res) => {
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
            .query('UPDATE Courses SET Title = @Title, Description = @Description WHERE CourseID = @CourseID');

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
    logger.info(`Received request: ${JSON.stringify(req.body, null, 2)}`);

    try {
        let pool = await sql.connect(mssqlConfig);

        const contentData = {
            coursePDF: pdfFile ? `/path/to/pdf/${pdfFile}` : null,
            contentName: contentName,
            contentDescription: contentDescription,
            contentType: contentType,
            emailID: null // This will be updated after emails are uploaded
        };

        logger.info(`Received content upload request: CourseID: ${courseId}, ContentData: ${JSON.stringify(contentData)}, ContentType: ${contentType}`);

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
            .input('ContentType', sql.NVarChar(50), content.contentType || null)
            .input('EmailID', sql.NVarChar(255), content.emailID || null);

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
        const returnValue = result.returnValue; 

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
        const passwordResult = await request.query(`
            SELECT [User-Password] as Password, [User-ID] as UserId FROM dbo.Users WHERE [User-Email] = @UserEmail
        `);

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
        
        // Fetch course details
        const courseResult = await pool.request()
            .input('CourseID', sql.Int, courseId)
            .query('SELECT * FROM Courses WHERE CourseID = @CourseID');

        if (courseResult.recordset.length === 0) {
            return res.status(404).json({ message: 'Course not found' });
        }

        // Fetch course content
        const contentResult = await pool.request()
            .input('CourseID', sql.Int, courseId)
            .query('SELECT * FROM CourseContent WHERE CourseID = @CourseID');

        res.json({
            course: courseResult.recordset[0],
            content: contentResult.recordset
        });
    } catch (err) {
        logger.error('Error fetching course details and content:', err);
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
            .query('DELETE FROM CourseContent WHERE ContentID = @ContentID');

        res.json({ success: true });
    } catch (err) {
        logger.error('Error deleting course content:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});


app.post('/api/course/:courseId/content', isAuthenticated, isAdmin, async (req, res) => {
    const courseId = req.params.courseId;
    const { contentType } = req.body;

    const pdfFile = req.files ? req.files.pdfFile : null;
    const xlsxData = req.body.xlsxData ? JSON.parse(req.body.xlsxData) : null;

    try {
        let pool = await sql.connect(mssqlConfig);

        const contentData = {
            coursePDF: pdfFile ? `/path/to/pdf/${pdfFile.name}` : null,
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

// API Routes - retrieve course contents
app.get('/api/course/:courseId/contents', isAuthenticated, async (req, res) => {
    const courseId = req.params.courseId;

    try {
        let pool = await sql.connect(mssqlConfig);
        const result = await pool.request()
            .input('CourseID', sql.Int, courseId)
            .query('SELECT * FROM CourseContent WHERE CourseID = @CourseID');

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

// Define your routes after the session and JSON middleware
app.get('/api/my-enrolled-courses', isAuthenticated, async (req, res) => {
    const userEmail = req.session.user?.email;

    logger.info('Fetching enrolled courses', { userEmail: userEmail });

    try {
        let pool = await sql.connect(mssqlConfig);
        logger.info('MSSQL connection established for fetching enrolled courses.');

        const request = pool.request();
        request.input('UserEmail', sql.NVarChar(100), userEmail);
        const result = await request.query(`
            SELECT c.CourseID, c.Title, c.Description 
            FROM Courses c
            JOIN UserCourses uc ON uc.CourseID = c.CourseID
            JOIN Users u ON uc.UserID = u.[User-ID]
            WHERE u.[User-Email] = @UserEmail
        `);

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
        const mailerResult = await mailerRequest.query('SELECT Username, Password FROM MailerDetails');
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
app.post('/reset-password', async (req, res) => {
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
app.get('/settings', isAuthenticated, (req, res) => {
    if(isAdmin){
        logger.info('Serving admin-settings.html');
            ip: req.ip;
        res.sendFile(path.join(__dirname, './public/admin-settings.html'));
    }
    else{
        logger.info('Serving settings.html', {
        ip: req.ip
    });
    res.sendFile(path.join(__dirname, './public/settings.html'));
}});

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
        const result = await request.query(`
            SELECT CoursePDF 
            FROM CourseContent 
            WHERE CourseID = @CourseId
        `);

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
        const result = await request.query(`
            SELECT c.CourseID, c.Title, c.Description 
            FROM Courses c
            JOIN UserCourses uc ON uc.CourseID = c.CourseID
            JOIN Users u ON uc.UserID = u.[User-ID]
            WHERE u.[User-Email] = @UserEmail
        `);

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



// API Route to get all courses
app.get('/api/all-courses', async (req, res) => {
    logger.info('Fetching all available courses.');

    try {
        let pool = await sql.connect(mssqlConfig);
        logger.info('MSSQL connection established for fetching all courses.');

        const result = await pool.request().query(`
            SELECT CourseID, Title, Description
            FROM Courses
        `);

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

        const result = await pool.request().query(`
            SELECT *
            FROM Courses
        `);

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

// API Route to get all users for admin
app.get('/api/admin/all-users', isAuthenticated, isAdmin, async (req, res) => {
    logger.info('Admin fetching all users.');

    try {
        let pool = await sql.connect(mssqlConfig);
        logger.info('MSSQL connection established for admin fetching all users.');

        const result = await pool.request().query(`
            SELECT *
            FROM Users
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

// API Routes - retrieve emails from specified collection (API)
app.get('/emails/:id', async (req, res) => {
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


/*
TODO: XLSX parse and post into Mongo and MSSQL
Need to post into the MSSQL Db first to create the revelant Ids, then I'll post the IDs (course+ContentID) 
as a collection into the emails DB with the parsed xlsx file as JSON in my desired format
*/


// API Route - create a new collection and add entries to it
app.post('/emails/:collectionName', async (req, res) => {
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



initializeDatabases().then(() => {
    app.listen(port, () => {
        console.log(`Server running on port ${port}`);
    });
}).catch(err => {
    console.error('Initialization failed:', err);
});