import { NormalizedMessage } from "@/lib/domain/types";
import { IntegrationProvider, MessageSourceIntegration } from "@/lib/integrations/contracts";

export class DiscordIntegration implements IntegrationProvider, MessageSourceIntegration {
  key: NormalizedMessage["platform"] = "discord";
  label = "Discord";
  availability: "active" | "coming_soon" = "coming_soon";
  platform: NormalizedMessage["platform"] = "discord";

  normalizeIncomingPayload(_payload: unknown): NormalizedMessage {
    throw new Error("Discord integration is not implemented yet.");
  }
}
