/**
 * Next.js Instrumentation hook — runs once when the server starts.
 * Used to initialize the cron scheduler for overnight Fact Sheet processing.
 */
export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        const { startCronJobs } = await import('./lib/cron');
        startCronJobs();
    }
}
