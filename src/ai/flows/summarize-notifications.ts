'use server';

/**
 * @fileOverview Summarizes notifications for the user.
 *
 * - summarizeNotifications - A function that summarizes notifications.
 * - SummarizeNotificationsInput - The input type for the summarizeNotifications function.
 * - SummarizeNotificationsOutput - The return type for the summarizeNotifications function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeNotificationsInputSchema = z.object({
  notifications: z.array(z.string()).describe('A list of notifications to summarize.'),
  userPreferences: z
    .string()
    .optional()
    .describe('User preferences for the summarization, such as length or focus.'),
  summaryPreference: z
    .enum(['full', 'summary'])
    .default('full')
    .describe("Whether to provide a full list of notifications or a summarized version.  Use 'summary' when the user is away or overwhelmed."),
});
export type SummarizeNotificationsInput = z.infer<typeof SummarizeNotificationsInputSchema>;

const SummarizeNotificationsOutputSchema = z.object({
  summary: z.string().describe('A summary of the notifications.'),
});
export type SummarizeNotificationsOutput = z.infer<typeof SummarizeNotificationsOutputSchema>;

export async function summarizeNotifications(
  input: SummarizeNotificationsInput
): Promise<SummarizeNotificationsOutput> {
  return summarizeNotificationsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'summarizeNotificationsPrompt',
  input: {schema: SummarizeNotificationsInputSchema},
  output: {schema: SummarizeNotificationsOutputSchema},
  prompt: `You are a notification summarization service.  You will be provided a list of notifications and user preferences.

Notifications:
{{#each notifications}}- {{{this}}}\n{{/each}}

User Preferences: {{{userPreferences}}}

{{#if (eq summaryPreference \"summary\")}}Summarize the notifications, taking into account user preferences.{{else}}Provide a detailed list of the notifications, taking into account user preferences.{{/if}}`,
});

const summarizeNotificationsFlow = ai.defineFlow(
  {
    name: 'summarizeNotificationsFlow',
    inputSchema: SummarizeNotificationsInputSchema,
    outputSchema: SummarizeNotificationsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
