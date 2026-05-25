const db = require("../src/db/connection.js");

async function migrate() {
    console.log("Starting database migration...");
    try {
        // 1. Create users table
        console.log("Creating 'users' table if it doesn't exist...");
        await db.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 2. Create opportunities table (Salesforce-like Opportunity data)
        console.log("Creating 'opportunities' table if it doesn't exist...");
        await db.query(`
            CREATE TABLE IF NOT EXISTS opportunities (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                stage VARCHAR(100) NOT NULL,
                status VARCHAR(50) DEFAULT 'New',
                amount DECIMAL(15, 2) DEFAULT 0.00,
                probability INT DEFAULT 0,
                close_date DATE,
                lead_source VARCHAR(100),
                contact_email VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        // 3. Update existing opportunities table structure if status column is missing
        console.log("Checking if 'status' column exists in 'opportunities' table...");
        const [columns] = await db.query(
            "SHOW COLUMNS FROM opportunities LIKE 'status'"
        );

        if (columns.length === 0) {
            console.log("Adding missing 'status' column to 'opportunities' table...");
            await db.query(
                "ALTER TABLE opportunities ADD COLUMN status VARCHAR(50) DEFAULT 'New'"
            );
            console.log("'status' column added successfully.");
        } else {
            console.log("'status' column already exists.");
        }

        console.log("Database migration completed successfully!");
    } catch (error) {
        console.error("Migration failed:", error);
        process.exit(1);
    } finally {
        // End the connection pool so the Node process can exit cleanly
        await db.end();
    }
}

migrate();
