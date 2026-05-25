const { faker } = require("@faker-js/faker");
const db = require("../src/db/connection.js");

const STAGE_PROBABILITIES = {
    "Prospecting": 10,
    "Qualification": 20,
    "Proposal/Price Quote": 50,
    "Negotiation/Review": 80,
    "Closed Won": 100,
    "Closed Lost": 0,
};

async function seed() {
    console.log("Starting database seeding...");
    try {
        // 1. Seed Users (10 users)
        console.log("Seeding 'users' table...");
        const users = [];
        for (let i = 0; i < 10; i++) {
            const firstName = faker.person.firstName();
            const lastName = faker.person.lastName();
            const name = `${firstName} ${lastName}`;
            const email = faker.internet.email({ firstName, lastName }).toLowerCase();
            users.push([name, email]);
        }

        // We use INSERT IGNORE to prevent duplicate email errors if seed runs multiple times
        await db.query(
            "INSERT IGNORE INTO users (name, email) VALUES ?",
            [users]
        );
        console.log("Seeded 10 users.");

        // 2. Seed Opportunities (50 opportunities)
        console.log("Seeding 'opportunities' table...");
        const opportunities = [];
        const stages = Object.keys(STAGE_PROBABILITIES);
        const leadSources = ["Web", "Phone Inquiry", "Partner Referral", "Purchased List", "Other"];

        for (let i = 0; i < 50; i++) {
            const companyName = faker.company.name();
            const opportunityType = faker.helpers.arrayElement([
                "Cloud Migration",
                "SaaS Subscription Renewal",
                "Consulting Services",
                "Enterprise License",
                "Hardware Upgrade"
            ]);
            const name = `${companyName} - ${opportunityType}`;

            const stage = faker.helpers.arrayElement(stages);
            const probability = STAGE_PROBABILITIES[stage];

            // Random amount between 5,000 and 150,000
            const amount = parseFloat(faker.number.float({ min: 5000, max: 150000, fractionDigits: 2 }));

            // Random close date within the next 6 months
            const closeDate = faker.date.future({ years: 0.5 });

            const leadSource = faker.helpers.arrayElement(leadSources);
            const contactEmail = faker.internet.email({ provider: 'gmail.com' }).toLowerCase();
            const status = faker.helpers.arrayElement(["New", "In Progress", "Closed Won", "Closed Lost"]);

            opportunities.push([
                name,
                stage,
                status,
                amount,
                probability,
                closeDate,
                leadSource,
                contactEmail
            ]);
        }

        await db.query(
            "INSERT INTO opportunities (name, stage, status, amount, probability, close_date, lead_source, contact_email) VALUES ?",
            [opportunities]
        );
        console.log("Seeded 50 opportunities.");

        console.log("Database seeding completed successfully!");
    } catch (error) {
        console.error("Seeding failed:", error);
        process.exit(1);
    } finally {
        await db.end();
    }
}

seed();
