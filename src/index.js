const express = require("express");
const cron = require("node-cron");
const cronParser = require("cron-parser");
const db = require("./db/connection.js");
const { syncSingleOpportunity } = require("./services/salesforceSync.js");
const logger = require("./utils/logger.js");

const app = express();
const PORT = 3000;

// Enable JSON body parsing for API endpoints
app.use(express.json());

app.get("/", async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM users");
        logger.info("Users fetched successfully");
        res.json(rows);
    } catch (error) {
        logger.error("Error fetching users: " + error.message);
        res.status(500).json({
            error: "Database connection failed",
        });
    }
});


app.get("/opportunities", async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM opportunities");
        logger.info("Opportunities fetched successfully");
        res.json(rows);
    } catch (error) {
        logger.error("Error fetching opportunities: " + error.message);
        res.status(500).json({
            error: "Database connection failed",
        });
    }
});

// Scheduler Configuration
const CRON_EXPRESSION = "*/1 * * * *";
let syncJob = null;
let isJobRunning = false;
let lastRunTime = null;

// Function to start the cron scheduler
function startScheduler() {
    if (isJobRunning) {
        logger.info("Scheduler is already running.");
        return;
    }

    syncJob = cron.schedule(CRON_EXPRESSION, () => {
        lastRunTime = new Date();
        logger.info("Executing scheduled Salesforce sync job...");
        syncSingleOpportunity().catch(err => {
            logger.error("Error in scheduled Salesforce sync: " + err.message);
        });
    });

    isJobRunning = true;
    logger.info(`Salesforce sync cron job scheduled to run: ${CRON_EXPRESSION}`);
}

// Start the scheduler initially on startup
startScheduler();

// API Endpoints to check, start, stop, and restart the scheduler

// 1. Get Scheduler Status & Next Run Time
app.get("/scheduler/status", (req, res) => {
    try {
        let nextRun = "N/A";
        if (isJobRunning) {
            const interval = cronParser.CronExpressionParser.parse(CRON_EXPRESSION);
            nextRun = interval.next().toString();
        }

        res.json({
            status: isJobRunning ? "running" : "stopped",
            cronExpression: CRON_EXPRESSION,
            lastRun: lastRunTime ? lastRunTime.toISOString() : "never",
            nextRun: nextRun
        });
    } catch (err) {
        logger.error("Error retrieving scheduler status: " + err.message);
        res.status(500).json({ error: "Failed to parse cron schedule" });
    }
});

// 2. Start Scheduler
app.post("/scheduler/start", (req, res) => {
    if (isJobRunning) {
        return res.status(400).json({ error: "Scheduler is already running" });
    }
    startScheduler();
    res.json({ message: "Scheduler started successfully" });
});

// 3. Stop Scheduler
app.post("/scheduler/stop", (req, res) => {
    if (!isJobRunning || !syncJob) {
        return res.status(400).json({ error: "Scheduler is not running" });
    }
    syncJob.stop();
    syncJob = null;
    isJobRunning = false;
    logger.info("Scheduler stopped manually.");
    res.json({ message: "Scheduler stopped successfully" });
});

// 4. Restart Scheduler
app.post("/scheduler/restart", (req, res) => {
    logger.info("Restarting scheduler manually...");
    if (isJobRunning && syncJob) {
        syncJob.stop();
        syncJob = null;
        isJobRunning = false;
    }
    startScheduler();
    res.json({ message: "Scheduler restarted successfully" });
});

app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
});