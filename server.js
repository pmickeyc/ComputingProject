const express = require('express');
const path = require('path');
const { MongoClient, ServerApiVersion } = require('mongodb');

const app = express();
const port = process.env.PORT || 3000;

// Your MongoDB connection URI
const uri = "mongodb://localhost:27017";
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});
async function run() {
    try {
        await client.connect();
        console.log("Successfully connected to MongoDB!");

        // Here, you can set up your API endpoints that interact with MongoDB
        // For example, an endpoint to get emails could look like this:
        app.get('/emails', async (req, res) => {
            try {
                const collection = client.db("emailDB").collection("emails");
                const emails = await collection.find({}).toArray();
                res.json(emails);
            } catch (e) {
                res.status(500).send(e);
            }
        });

    } catch (e) {
        console.error("Error connecting to MongoDB: ", e);
    }
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); // Serve your static files



run().catch(console.dir);

// Start the server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
