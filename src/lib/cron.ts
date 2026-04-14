import cron from 'node-cron';

let scheduled = false;

/**
 * Starts the cron scheduler for overnight Fact Sheet processing.
 * Runs daily at 2:00 AM.
 *
 * Uses Flex processing tier for 50% cheaper OpenAI API calls.
 * The cron job calls the internal API endpoint which handles:
 * - Scanning workspaces for factSheetRequired flag
 * - Running the full pipeline with service_tier: 'flex'
 * - Clearing the flag on success
 */
export function startCronJobs(): void {
    if (scheduled) return; // Prevent duplicate scheduling on HMR

    const enabled = process.env.CRON_ENABLED !== 'false'; // Enabled by default
    if (!enabled) {
        console.log('[cron] Cron jobs disabled (CRON_ENABLED=false)');
        return;
    }

    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
        console.warn('[cron] CRON_SECRET not set — cron jobs will not be able to authenticate. Skipping.');
        return;
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    // Schedule: 2:00 AM daily
    cron.schedule('0 2 * * *', async () => {
        console.log(`[cron] ⏰ Triggered overnight Fact Sheet processing at ${new Date().toISOString()}`);
        try {
            const res = await fetch(`${baseUrl}/api/cron/process-pending-factsheets`, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${cronSecret}`,
                },
            });
            const data = await res.json();
            console.log('[cron] Result:', JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('[cron] Failed to call cron endpoint:', error);
        }
    });

    scheduled = true;
    console.log('[cron] Cron job scheduled: 0 2 * * * (daily at 2:00 AM)');
}
