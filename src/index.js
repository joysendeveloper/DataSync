const express = require("express");
const db = require("./db/connection.js");

const app = express();
const PORT = 3000;

app.get("/", async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM users");
        console.log("Users fetched successfully");
        res.json(rows);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Database connection failed",
        });
    }
});


app.get("/opportunities", async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM opportunities");
        console.log("Opportunities fetched successfully");
        res.json(rows);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Database connection failed",
        });
    }
});


app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});