import { RuleBasedEventExtractor } from "../src/lib/ai/rule-based-extractor";
import type { NormalizedMessage } from "../src/lib/domain/types";

interface ExampleCase {
  label: string;
  body: string;
  expectDetected: boolean;
}

const cases: ExampleCase[] = [
  { label: "tomorrow 3pm", body: "Can we meet tomorrow at 3pm?", expectDetected: true },
  { label: "next monday 14:00", body: "Interview next Monday 14:00", expectDetected: true },
  { label: "month name", body: "Coffee on July 15 at noon", expectDetected: true },
  { label: "slash date", body: "Dentist 7/15 at 3:30 PM", expectDetected: true },
  { label: "iso date", body: "Standup 2026-07-15 09:00", expectDetected: true },
  { label: "afternoon phrase", body: "This Friday in the afternoon works", expectDetected: true },
  { label: "no schedule", body: "Hope you are doing well this week.", expectDetected: false },
];

function toMessage(body: string, id: number): NormalizedMessage {
  return {
    id: `example-${id}`,
    platform: "gmail",
    threadId: `thread-${id}`,
    sender: "alex@example.com",
    participants: ["you@example.com"],
    text: body,
    receivedAt: "2026-07-01T10:00:00.000Z",
    metadata: { subject: "Extraction test" },
  };
}

async function main(): Promise<void> {
  const extractor = new RuleBasedEventExtractor();
  let passed = 0;

  for (const [index, testCase] of cases.entries()) {
    const event = await extractor.extractEvent(toMessage(testCase.body, index));
    const detected = Boolean(event);
    const ok = detected === testCase.expectDetected;
    if (ok) passed += 1;

    process.stdout.write(
      `${ok ? "PASS" : "FAIL"} - ${testCase.label}${event ? ` -> ${event.startIso}` : ""}\n`,
    );
  }

  process.stdout.write(`\n${passed}/${cases.length} extraction checks passed.\n`);
  if (passed !== cases.length) {
    process.exitCode = 1;
  }
}

void main();
