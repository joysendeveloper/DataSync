const db = require("../src/db/connection.js");

async function reset() {
    console.log("Resetting database (dropping existing tables)...");
    try {
        // Disable foreign key checks before dropping (if any exist)
        await db.query("SET FOREIGN_KEY_CHECKS = 0");

        console.log("Dropping 'opportunities' table...");
        await db.query("DROP TABLE IF EXISTS opportunities");

        console.log("Dropping 'users' table...");
        await db.query("DROP TABLE IF EXISTS users");

        await db.query("SET FOREIGN_KEY_CHECKS = 1");
        console.log("Tables dropped successfully!");

        // Re-run migration logic
        console.log("Re-creating tables...");
        await db.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

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

        console.log("Database reset completed successfully!");
    } catch (error) {
        console.error("Database reset failed:", error);
        process.exit(1);
    } finally {
        await db.end();
    }
}

reset();
