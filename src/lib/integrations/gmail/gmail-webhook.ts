import { z } from "zod";

import { NormalizedMessage } from "@/lib/domain/types";
import { IntegrationProvider, MessageSourceIntegration } from "@/lib/integrations/contracts";

const gmailWebhookSchema = z.object({
  id: z.string().min(1),
  threadId: z.string().min(1),
  from: z.string().min(1),
  to: z.array(z.string()).default([]),
  subject: z.string().min(1),
  body: z.string().min(1),
  receivedAt: z.string().datetime().optional(),
});

export class GmailIntegration implements IntegrationProvider, MessageSourceIntegration {
  key: NormalizedMessage["platform"] = "gmail";
  label = "Gmail";
  availability: "active" | "coming_soon" = "active";
  platform: NormalizedMessage["platform"] = "gmail";

  normalizeIncomingPayload(payload: unknown): NormalizedMessage {
    const parsed = gmailWebhookSchema.parse(payload);

    return {
      id: parsed.id,
      platform: "gmail",
      threadId: parsed.threadId,
      sender: parsed.from,
      participants: parsed.to,
      text: `Subject: ${parsed.subject}\n\n${parsed.body}`,
      receivedAt: parsed.receivedAt ?? new Date().toISOString(),
      metadata: {
        subject: parsed.subject,
      },
    };
  }
}
