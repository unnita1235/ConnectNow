'use server';

/**
 * @fileOverview Smart notification filtering for prioritizing urgent messages.
 *
 * - filterNotifications - A function that filters and prioritizes notifications.
 * - FilterNotificationsInput - The input type for the filterNotifications function.
 * - FilterNotificationsOutput - The return type for the filterNotifications function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const FilterNotificationsInputSchema = z.object({
  message: z.string().describe('The content of the message.'),
  sender: z.string().describe('The sender of the message.'),
  userPreferences: z
    .string()
    .optional()
    .describe('The preferences of the user.'),
});
export type FilterNotificationsInput = z.infer<typeof FilterNotificationsInputSchema>;

const FilterNotificationsOutputSchema = z.object({
  urgent: z.boolean().describe('Whether the notification is urgent.'),
  reason: z.string().describe('The reason for the urgency determination.'),
});
export type FilterNotificationsOutput = z.infer<typeof FilterNotificationsOutputSchema>;

export async function filterNotifications(input: FilterNotificationsInput): Promise<FilterNotificationsOutput> {
  return filterNotificationsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'filterNotificationsPrompt',
  input: {schema: FilterNotificationsInputSchema},
  output: {schema: FilterNotificationsOutputSchema},
  prompt: `You are an AI assistant designed to intelligently filter and prioritize notifications based on content and sender.

  Message: {{{message}}}
  Sender: {{{sender}}}
  User Preferences: {{{userPreferences}}}

  Based on the message content, sender, and user preferences, determine if the notification is urgent and provide a reason.
  Set the urgent field to true if the notification requires immediate attention, otherwise false.
  If user preferences is empty assume standard notification filtering.

  Consider these factors when determining urgency:
  - Keywords indicating urgency (e.g., \"urgent,\" \"critical,\" \"immediately\")
  - The sender's importance or role (e.g., a direct manager, a critical system)
  - User preferences for specific senders or topics
  `,
});

const filterNotificationsFlow = ai.defineFlow(
  {
    name: 'filterNotificationsFlow',
    inputSchema: FilterNotificationsInputSchema,
    outputSchema: FilterNotificationsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    if (!output) {
      return { urgent: false, reason: 'Failed to process notification' };
    }
    return output;
  }
);


