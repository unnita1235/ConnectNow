
"use server";

import { filterNotifications, summarizeNotifications as summarizeNotificationsFlow } from "@/ai/flows";
import type { Message } from "@/lib/types";

export async function getUrgency(message: Message, userPreferences: string) {
  try {
    const result = await filterNotifications({
      message: message.content,
      sender: message.author.name,
      userPreferences: userPreferences,
    });
    return result;
  } catch (error) {
    console.error("Error filtering notification:", error);
    return { urgent: false, reason: "Error processing notification." };
  }
}

export async function summarizeNotifications(notifications: string[], userPreferences: string, summaryPreference: 'full' | 'summary' = 'summary') {
    try {
        const result = await summarizeNotificationsFlow({
            notifications,
            userPreferences,
            summaryPreference
        });
        return result;
    } catch (error) {
        console.error("Error summarizing notifications:", error);
        return { summary: "Could not summarize notifications." };
    }
}
