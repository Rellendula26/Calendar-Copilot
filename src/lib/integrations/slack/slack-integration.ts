import { NormalizedMessage } from "@/lib/domain/types";
import { IntegrationProvider, MessageSourceIntegration } from "@/lib/integrations/contracts";

export class SlackIntegration implements IntegrationProvider, MessageSourceIntegration {
  key: NormalizedMessage["platform"] = "slack";
  label = "Slack";
  availability: "active" | "coming_soon" = "coming_soon";
  platform: NormalizedMessage["platform"] = "slack";

  normalizeIncomingPayload(_payload: unknown): NormalizedMessage {
    throw new Error("Slack integration is not implemented yet.");
  }
}
