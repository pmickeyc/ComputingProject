/*
Author: Padraig McCauley - 20123744
BiggerPhish Educational Platform
Computing Project (BSCCYBE4)
Due: 05/8/2024

*/

const request = require('supertest');
const { app, initializeDatabases, client, sql } = require('./server');
const https = require('https');
const fs = require('fs');
require('dotenv').config();

let server;
let randomPort;
let agent;
let csrfToken;

beforeAll(async () => {
    try {
        console.log("Initializing databases...");
        await initializeDatabases();
        console.log("Databases initialized successfully.");

        randomPort = Math.floor(Math.random() * (65535 - 1024 + 1)) + 1024;

        server = https.createServer({
            key: fs.readFileSync('server.key'),
            cert: fs.readFileSync('server.cert')
        }, app).listen(randomPort, () => {
            console.log("Test server started on port", randomPort);
        });

        // Initialize agent
        agent = request.agent(`https://localhost:${randomPort}`);
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // For self-signed certificate

        // Register and login user
        csrfToken = await agent.get('/csrf-token').then(res => res.body.csrfToken);
        await agent.post('/register-user').set('CSRF-Token', csrfToken).send({
            firstName: 'John',
            email: 'john@example.com',
            password: 'password'
        });

        csrfToken = await agent.get('/csrf-token').then(res => res.body.csrfToken);
        await agent.post('/login-user').set('CSRF-Token', csrfToken).send({
            email: 'john@example.com',
            password: 'password'
        });

    } catch (error) {
        console.error("Failed to initialize databases or start server:", error);
    }
});

afterAll(async () => {
    try {
        console.log("Closing connections...");
        if (sql.connected) {
            await sql.close();
        }
        await client.close();
        server.close(() => {
            console.log("Test server closed.");
        });
    } catch (error) {
        console.error("Error closing connections:", error);
    }
});

describe('Educational Platform API Tests', () => {
    const user = {
        firstName: 'joe',
        email: 'joe@bloggs.com',
        password: 'password'
    };

    const loginUser = {
        email: 'testEncrypted@email.com',
        password: 'compliacted'
    };

    const adminUser = {
        email: 'pmickeyc@gmail.com',
        password: '6661a011'
    };

    it('should register a new user', async () => {
        csrfToken = await agent.get('/csrf-token').then(res => res.body.csrfToken);
        const response = await agent.post('/register-user').set('CSRF-Token', csrfToken).send(user);
        console.log("Register response:", response.body);
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
    });

    it('should login an existing user', async () => {
        csrfToken = await agent.get('/csrf-token').then(res => res.body.csrfToken);
        const response = await agent.post('/login-user').set('CSRF-Token', csrfToken).send(loginUser);
        console.log("Login response:", response.body);
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
    });

    it('should delete the user', async () => {
        csrfToken = await agent.get('/csrf-token').then(res => res.body.csrfToken);
        const response = await agent.delete('/api/user').set('CSRF-Token', csrfToken);
        expect(response.status).toBe(200);
    });

    // GET endpoints tests

    it('should get the root HTML file', async () => {
        const response = await request(app).get('/');
        expect(response.status).toBe(200);
        expect(response.header['content-type']).toMatch(/html/);
    });

    it('should fetch user data for logged-in user', async () => {
        const response = await agent.get('/user-data');
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('email', 'john@example.com');
    });

    it('should serve the user HTML page', async () => {
        const response = await agent.get('/user');
        expect(response.status).toBe(200);
        expect(response.header['content-type']).toMatch(/html/);
    });

    it('should serve the admin HTML page', async () => {
        csrfToken = await agent.get('/csrf-token').then(res => res.body.csrfToken);
        await agent.post('/login-user').set('CSRF-Token', csrfToken).send(adminUser);

        const responseAdmin = await agent.get('/admin');
        expect(responseAdmin.status).toBe(200);
        expect(responseAdmin.header['content-type']).toMatch(/html/);
    });

    it('should serve the admin courses management page', async () => {
        csrfToken = await agent.get('/csrf-token').then(res => res.body.csrfToken);
        await agent.post('/login-user').set('CSRF-Token', csrfToken).send(adminUser);

        const responseAdmin = await agent.get('/admin-courses');
        expect(responseAdmin.status).toBe(200);
        expect(responseAdmin.header['content-type']).toMatch(/html/);
    });

    it('should serve the admin users management page', async () => {
        csrfToken = await agent.get('/csrf-token').then(res => res.body.csrfToken);
        await agent.post('/login-user').set('CSRF-Token', csrfToken).send(adminUser);

        const responseAdmin = await agent.get('/admin-users');
        expect(responseAdmin.status).toBe(200);
        expect(responseAdmin.header['content-type']).toMatch(/html/);
    });

    it('should retrieve all courses for admin', async () => {
        csrfToken = await agent.get('/csrf-token').then(res => res.body.csrfToken);
        await agent.post('/login-user').set('CSRF-Token', csrfToken).send(adminUser);

        const responseAdmin = await agent.get('/api/admin/all-courses');
        expect(responseAdmin.status).toBe(200);
        expect(Array.isArray(responseAdmin.body)).toBe(true);
    });

    it('should retrieve all users for admin', async () => {
        csrfToken = await agent.get('/csrf-token').then(res => res.body.csrfToken);
        await agent.post('/login-user').set('CSRF-Token', csrfToken).send(adminUser);

        const responseAdmin = await agent.get('/api/admin/all-users');
        expect(responseAdmin.status).toBe(200);
        expect(Array.isArray(responseAdmin.body)).toBe(true);
    });

    it('should serve the course-specific HTML page', async () => {
        const response = await agent.get('/course/2');
        expect(response.status).toBe(200);
        expect(response.header['content-type']).toMatch(/html/);
    });

    it('should retrieve and serve the PDF content for the given course', async () => {
        const response = await agent.get('/files/pdf/1');
        expect(response.status).toBe(200);
        expect(response.header['content-type']).toMatch(/pdf/);
    });

    it('should retrieve the courses that the logged-in user is enrolled in', async () => {
        const response = await agent.get('/api/my-enrolled-courses');
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
    });

    it('should serve the email HTML page', async () => {
        const response = await agent.get('/email/1');
        expect(response.status).toBe(200);
        expect(response.header['content-type']).toMatch(/html/);
    });

    it('should retrieve all emails from the specified collection', async () => {
        const response = await agent.get('/emails/1');
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
    });

    it('should serve the courses HTML page', async () => {
        const response = await agent.get('/courses');
        expect(response.status).toBe(200);
        expect(response.header['content-type']).toMatch(/html/);
    });

    it('should serve the login HTML page', async () => {
        const response = await request(app).get('/login');
        expect(response.status).toBe(200);
        expect(response.header['content-type']).toMatch(/html/);
    });

    it('should serve the registration HTML page', async () => {
        const response = await request(app).get('/register');
        expect(response.status).toBe(200);
        expect(response.header['content-type']).toMatch(/html/);
    });

    it('should serve the forgotten password HTML page', async () => {
        const response = await request(app).get('/forgottenPassword');
        expect(response.status).toBe(200);
        expect(response.header['content-type']).toMatch(/html/);
    });

    it('should serve the settings HTML page based on user role', async () => {
        const response = await agent.get('/settings');
        expect(response.status).toBe(200);
        expect(response.header['content-type']).toMatch(/html/);
    });

    it('should provide a CSRF token', async () => {
        const response = await request(app).get('/csrf-token');
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('csrfToken');
    });

    it('should serve the grades HTML page', async () => {
        const response = await agent.get('/grades');
        expect(response.status).toBe(200);
        expect(response.header['content-type']).toMatch(/html/);
    });

    it('should retrieve the grades for the logged-in user', async () => {
        const response = await agent.get('/api/user-grades');
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
    });
});
