import OpenAI from 'openai';

/**
 * Creates an OpenAI client with appropriate timeout settings.
 * Flex processing may take significantly longer, so we increase the timeout.
 */
export function getOpenAIClient(options?: { flex?: boolean }): OpenAI {
    const timeout = options?.flex ? 900_000 : 600_000; // 15 min for flex, 10 min for standard
    return new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        timeout,
    });
}

/**
 * Returns the service_tier parameter for OpenAI API calls.
 * - 'flex' → cheaper, slower processing (used by overnight cron)
 * - undefined → standard fast processing (used by user-initiated requests)
 */
export function getServiceTier(flex?: boolean): 'flex' | undefined {
    return flex ? 'flex' : undefined;
}

/**
 * Wraps an async function with retry logic for Flex processing 429 Resource Unavailable errors.
 * Uses exponential backoff: 30s → 60s → 120s.
 * Only retries on 429 status; other errors are thrown immediately.
 */
export async function withFlexRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3
): Promise<T> {
    const backoffMs = [30_000, 60_000, 120_000];

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error: unknown) {
            const isResourceUnavailable =
                error instanceof OpenAI.APIError && error.status === 429;

            if (!isResourceUnavailable || attempt >= maxRetries) {
                throw error;
            }

            const delay = backoffMs[attempt] || 120_000;
            console.log(
                `[flex-retry] 429 Resource Unavailable — retrying in ${delay / 1000}s (attempt ${attempt + 1}/${maxRetries})`
            );
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    // Unreachable, but TypeScript needs it
    throw new Error('withFlexRetry: exhausted retries');
}
