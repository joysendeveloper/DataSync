const db = require("../db/connection.js");
const axios = require("axios");
const logger = require("../utils/logger.js");

let cachedAccessToken = null;

/**
 * Retrieves a Salesforce OAuth 2.0 access token using client credentials flow.
 * Caches the token for subsequent requests.
 */
async function getAccessToken() {
    if (cachedAccessToken) {
        return cachedAccessToken;
    }

    logger.info("Fetching new Salesforce access token...");
    try {
        const params = new URLSearchParams();
        params.append("grant_type", "client_credentials");
        params.append("client_id", process.env.SF_CLIENT_ID);
        params.append("client_secret", process.env.SF_CLIENT_SECRET);

        const response = await axios.post(process.env.SF_BASE_URL + "/services/oauth2/token", params, {
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            }
        });

        if (response.data && response.data.access_token) {
            cachedAccessToken = response.data.access_token;
            logger.info("Salesforce access token retrieved successfully.");
            return cachedAccessToken;
        } else {
            throw new Error("Access token not found in response.");
        }
    } catch (error) {
        const errMsg = error.response ? JSON.stringify(error.response.data) : error.message;
        logger.error("Error retrieving Salesforce access token: " + errMsg);
        throw new Error(`Auth failed: ${errMsg}`);
    }
}

/**
 * Fetches the oldest 'Pending' opportunity from the local database,
 * sends it to Salesforce, and updates the local record status to 'Synced' or 'Failed'.
 */
async function syncSingleOpportunity() {
    logger.info("Starting Salesforce sync execution...");

    // 1. Fetch one pending opportunity
    let rows;
    try {
        [rows] = await db.query(
            "SELECT * FROM opportunities WHERE sync_status = 'Pending' ORDER BY created_at ASC, id ASC LIMIT 1"
        );
    } catch (dbError) {
        logger.error("Error fetching opportunity from database: " + dbError.message);
        return;
    }

    if (!rows || rows.length === 0) {
        logger.info("No pending opportunities found to sync.");
        return;
    }

    const opportunity = rows[0];
    logger.info(`Found pending opportunity ID: ${opportunity.id} (${opportunity.name}). Syncing...`);

    // 2. Prepare payload to match the expected format exactly
    const payload = [
        {
            id: opportunity.id,
            name: opportunity.name,
            stage: opportunity.stage,
            amount: opportunity.amount !== null ? Number(opportunity.amount).toFixed(2) : "0.00",
            probability: opportunity.probability,
            close_date: opportunity.close_date ? new Date(opportunity.close_date).toISOString() : null,
            lead_source: opportunity.lead_source,
            contact_email: opportunity.contact_email,
            created_at: opportunity.created_at ? new Date(opportunity.created_at).toISOString() : null,
            updated_at: opportunity.updated_at ? new Date(opportunity.updated_at).toISOString() : null,
            status: opportunity.status
        }
    ];

    let success = false;
    let syncError = null;

    try {
        // 3. Get access token
        const token = await getAccessToken();

        // 4. Send payload to Salesforce
        logger.info(`Sending opportunity ID ${opportunity.id} to Salesforce...`);
        const response = await axios.post(process.env.SF_BASE_URL + "/services/apexrest/opportunities/create", payload, {
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json",
                "Cookie": "BrowserId=IqQ0wlgKEfGpSwP6VOnWWg; CookieConsentPolicy=0:1; LSKey-c$CookieConsentPolicy=0:1"
            }
        });

        logger.info(`Salesforce response status: ${response.status}`);
        logger.info("Salesforce response body: " + JSON.stringify(response.data));
        success = true;
    } catch (error) {
        logger.error("Error syncing to Salesforce: " + (error.response ? JSON.stringify(error.response.data) : error.message));

        // If unauthorized (401), try clearing token cache and fetch/request again
        if (error.response && error.response.status === 401) {
            logger.info("Access token might have expired. Clearing cache and retrying sync...");
            cachedAccessToken = null;
            try {
                const token = await getAccessToken();
                const response = await axios.post(process.env.SF_BASE_URL + "/services/apexrest/opportunities/create", payload, {
                    headers: {
                        "Authorization": `Bearer ${token}`,
                        "Content-Type": "application/json",
                        "Cookie": "BrowserId=IqQ0wlgKEfGpSwP6VOnWWg; CookieConsentPolicy=0:1; LSKey-c$CookieConsentPolicy=0:1"
                    }
                });
                logger.info(`Retry Salesforce response status: ${response.status}`);
                logger.info("Retry Salesforce response body: " + JSON.stringify(response.data));
                success = true;
            } catch (retryError) {
                const retryMsg = retryError.response ? JSON.stringify(retryError.response.data) : retryError.message;
                logger.error("Retry sync failed: " + retryMsg);
                syncError = retryMsg;
            }
        } else {
            syncError = error.response ? JSON.stringify(error.response.data) : error.message;
        }
    }

    // 5. Update local database record status
    try {
        if (success) {
            await db.query(
                "UPDATE opportunities SET sync_status = 'Synced', sync_error = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                [opportunity.id]
            );
            logger.info(`Opportunity ID ${opportunity.id} successfully marked as 'Synced'.`);
        } else {
            const trimmedError = syncError ? syncError.substring(0, 1000) : "Unknown error";
            await db.query(
                "UPDATE opportunities SET sync_status = 'Failed', sync_error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                [trimmedError, opportunity.id]
            );
            logger.info(`Opportunity ID ${opportunity.id} marked as 'Failed' with error.`);
        }
    } catch (dbUpdateError) {
        logger.error(`Failed to update database status for opportunity ID ${opportunity.id}: ` + dbUpdateError.message);
    }
}

module.exports = {
    syncSingleOpportunity
};
