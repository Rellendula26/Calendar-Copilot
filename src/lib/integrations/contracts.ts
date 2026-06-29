import { NormalizedMessage } from "@/lib/domain/types";

export interface MessageSourceIntegration {
  key: NormalizedMessage["platform"];
  label: string;
  availability: "active" | "coming_soon";
  normalizeIncomingPayload(payload: unknown): NormalizedMessage;
}

export interface IntegrationProvider {
  platform: NormalizedMessage["platform"];
  normalizeIncomingPayload(payload: unknown): NormalizedMessage;
}

export function integrationAvailability(
  integration: MessageSourceIntegration,
): "active" | "coming_soon" {
  return integration.availability;
}
