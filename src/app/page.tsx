"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { CandidateEventRecord, DesktopState } from "@/lib/desktop/contracts";
import {
  connectGoogleOAuth,
  createCalendarEventFromCandidate,
  exchangeGoogleAuthCode,
  fetchDesktopState,
  generateGoogleAuthUrl,
  ignoreCandidate,
  isDesktopRuntime,
  runWatcherNow,
  saveGoogleOAuthConfig,
  setPollingIntervalSeconds,
  setWatcherEnabled,
  toMessageSnippet,
} from "@/lib/desktop/client";

interface Suggestion {
  id: string;
  status: "pending" | "approved" | "ignored" | "auto_approved";
  createdAt: string;
  message: {
    platform: string;
    sender: string;
    text: string;
  };
  extractedEvent: {
    title: string;
    startIso: string;
    endIso: string;
    timezone: string;
    location?: string;
    confidence: number;
  };
}

interface SuggestionsResponse {
  suggestions: Suggestion[];
}

interface CandidateEditorState {
  candidateId: string;
  title: string;
  startTime: string;
  endTime: string;
  timezone: string;
  location: string;
  attendees: string;
  description: string;
}

function classNames(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

function setupChecklist(desktopState: DesktopState | null): Array<{ label: string; done: boolean }> {
  if (!desktopState) {
    return [];
  }
  return [
    { label: "Google connected", done: desktopState.setup.googleConnected },
    { label: "Gmail access enabled", done: desktopState.setup.gmailAccessEnabled },
    { label: "Calendar access enabled", done: desktopState.setup.calendarAccessEnabled },
    { label: "Background watcher enabled", done: desktopState.setup.backgroundWatcherEnabled },
  ];
}

export default function HomePage(): React.ReactElement {
  const [desktopState, setDesktopState] = useState<DesktopState | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionPending, setActionPending] = useState<string | null>(null);
  const [candidateEditor, setCandidateEditor] = useState<CandidateEditorState | null>(null);
  const [oauthClientId, setOauthClientId] = useState("");
  const [oauthClientSecret, setOauthClientSecret] = useState("");
  const [oauthRedirectUri, setOauthRedirectUri] = useState("http://127.0.0.1:8976/oauth/callback");
  const [oauthRefreshToken, setOauthRefreshToken] = useState("");
  const [oauthCode, setOauthCode] = useState("");
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [pollingInterval, setPollingInterval] = useState("90");
  const [desktopError, setDesktopError] = useState<string | null>(null);
  const [oauthBusy, setOauthBusy] = useState(false);

  const loadSuggestions = useCallback(async () => {
    setDesktopError(null);
    if (isDesktopRuntime) {
      try {
        const data = await fetchDesktopState();
        setDesktopState(data);
        setPollingInterval(String(data.status.pollingIntervalSeconds));
      } catch (error) {
        setDesktopError(error instanceof Error ? error.message : "Failed to read desktop state.");
      } finally {
        setLoading(false);
      }
      return;
    }

    const response = await fetch("/api/suggestions", { cache: "no-store" });
    const data = (await response.json()) as SuggestionsResponse;
    setSuggestions(data.suggestions);
    setLoading(false);
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void loadSuggestions();
    });
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [loadSuggestions]);

  const sortedSuggestions = useMemo(() => {
    return [...suggestions].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }, [suggestions]);

  const sortedDesktopCandidates = useMemo(() => {
    return [...(desktopState?.candidates ?? [])].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }, [desktopState]);

  const setupItems = useMemo(() => setupChecklist(desktopState), [desktopState]);
  const setupComplete = setupItems.length > 0 && setupItems.every((item) => item.done);

  async function resolveSuggestion(id: string, action: "approve" | "ignore"): Promise<void> {
    setActionPending(id);
    setLoading(true);
    await fetch(`/api/suggestions/${id}/${action}`, { method: "POST" });
    setActionPending(null);
    await loadSuggestions();
  }

  async function onSaveOAuthConfig(): Promise<void> {
    await saveGoogleOAuthConfig({
      clientId: oauthClientId,
      clientSecret: oauthClientSecret,
      redirectUri: oauthRedirectUri,
      refreshToken: oauthRefreshToken || undefined,
      calendarId: "primary",
    });
    await loadSuggestions();
  }

  async function onGenerateAuthUrl(): Promise<void> {
    const result = await generateGoogleAuthUrl(oauthClientId, oauthRedirectUri);
    setAuthUrl(result.url);
  }

  async function onConnectGoogle(): Promise<void> {
    setOauthBusy(true);
    setDesktopError(null);
    try {
      await connectGoogleOAuth({
        clientId: oauthClientId,
        clientSecret: oauthClientSecret,
        redirectUri: oauthRedirectUri,
        refreshToken: oauthRefreshToken || undefined,
        calendarId: "primary",
      });
      setOauthCode("");
      setAuthUrl(null);
      await loadSuggestions();
    } catch (error) {
      setDesktopError(error instanceof Error ? error.message : "Google connect flow failed.");
    } finally {
      setOauthBusy(false);
    }
  }

  async function onExchangeCode(): Promise<void> {
    await exchangeGoogleAuthCode({
      clientId: oauthClientId,
      clientSecret: oauthClientSecret,
      redirectUri: oauthRedirectUri,
      code: oauthCode,
    });
    setOauthCode("");
    await loadSuggestions();
  }

  async function onToggleWatcher(enabled: boolean): Promise<void> {
    await setWatcherEnabled(enabled);
    await loadSuggestions();
  }

  async function onSavePollingInterval(): Promise<void> {
    const parsed = Number(pollingInterval);
    if (Number.isNaN(parsed)) return;
    await setPollingIntervalSeconds(parsed);
    await loadSuggestions();
  }

  async function onIgnoreDesktopCandidate(candidateId: string): Promise<void> {
    setActionPending(candidateId);
    await ignoreCandidate(candidateId);
    setActionPending(null);
    setCandidateEditor(null);
    await loadSuggestions();
  }

  async function onCreateDesktopEvent(candidate: CandidateEventRecord): Promise<void> {
    setActionPending(candidate.id);
    const editable = candidateEditor?.candidateId === candidate.id ? candidateEditor : null;
    await createCalendarEventFromCandidate({
      candidateId: candidate.id,
      title: editable?.title ?? candidate.extractedEvent.title,
      startTime: editable?.startTime ?? candidate.extractedEvent.startTime,
      endTime: editable?.endTime || candidate.extractedEvent.endTime,
      timezone: editable?.timezone || candidate.extractedEvent.timezone,
      location: editable?.location || candidate.extractedEvent.location,
      attendees:
        editable?.attendees
          ?.split(",")
          .map((value) => value.trim())
          .filter(Boolean) ?? candidate.extractedEvent.attendees,
      description: editable?.description || candidate.extractedEvent.description,
    });
    setActionPending(null);
    setCandidateEditor(null);
    await loadSuggestions();
  }

  function startEditing(candidate: CandidateEventRecord): void {
    setCandidateEditor({
      candidateId: candidate.id,
      title: candidate.extractedEvent.title,
      startTime: candidate.extractedEvent.startTime,
      endTime: candidate.extractedEvent.endTime ?? "",
      timezone: candidate.extractedEvent.timezone ?? "UTC",
      location: candidate.extractedEvent.location ?? "",
      attendees: (candidate.extractedEvent.attendees ?? []).join(", "),
      description: candidate.extractedEvent.description ?? "",
    });
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <header className="mb-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-[0_20px_80px_-50px_rgba(56,189,248,0.45)] backdrop-blur">
        <p className="mb-2 text-xs uppercase tracking-[0.24em] text-sky-200/80">Calendar Copilot</p>
        <h1 className="text-3xl font-semibold text-white sm:text-4xl">Desktop scheduling copilot</h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-300">
          Turn dates and times from Gmail messages into Google Calendar events after your approval.
        </p>
      </header>

      {isDesktopRuntime && desktopState ? (
        <div className="mb-6 grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="text-lg font-medium text-white">Watcher Status</h2>
            <p className="mt-2 text-sm text-slate-300">
              {desktopState.status.connected ? "Connected" : "Not connected"} • Last checked{" "}
              {desktopState.status.lastChecked
                ? new Date(desktopState.status.lastChecked).toLocaleString()
                : "Never"}
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                <p className="text-slate-400">Detected</p>
                <p className="mt-1 text-lg text-white">{desktopState.status.detectedCount}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                <p className="text-slate-400">Pending</p>
                <p className="mt-1 text-lg text-white">{desktopState.status.candidateCount}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                <p className="text-slate-400">Created</p>
                <p className="mt-1 text-lg text-white">{desktopState.status.createdCount}</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => onToggleWatcher(!desktopState.status.watcherEnabled)}
                className={classNames(
                  "rounded-lg px-4 py-2 text-sm font-medium transition",
                  desktopState.status.watcherEnabled
                    ? "bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                    : "border border-white/20 text-slate-100 hover:bg-white/10",
                )}
              >
                Background watcher: {desktopState.status.watcherEnabled ? "On" : "Off"}
              </button>
              <button
                onClick={() => runWatcherNow().then(loadSuggestions)}
                className="rounded-lg border border-sky-300/30 px-4 py-2 text-sm text-sky-100 transition hover:bg-sky-400/10"
              >
                Run now
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="text-lg font-medium text-white">Setup Checklist</h2>
            <ul className="mt-3 grid gap-2 text-sm text-slate-300">
              {setupItems.map((item) => (
                <li key={item.label} className="flex items-center gap-2">
                  <span className={item.done ? "text-emerald-300" : "text-amber-300"}>
                    {item.done ? "✓" : "○"}
                  </span>
                  <span>{item.label}</span>
                </li>
              ))}
            </ul>
            {!setupComplete ? (
              <p className="mt-4 rounded-lg border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
                First run detected. Complete OAuth and enable the watcher to start auto-detection.
              </p>
            ) : null}
          </section>
        </div>
      ) : null}

      {desktopError ? (
        <div className="mb-4 rounded-xl border border-rose-300/20 bg-rose-500/10 p-3 text-sm text-rose-100">
          {desktopError}
        </div>
      ) : null}

      {isDesktopRuntime && desktopState ? (
        <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="text-lg font-medium text-white">Detected Events</h2>
            {loading ? (
              <p className="mt-4 text-sm text-slate-300">Loading detected events...</p>
            ) : sortedDesktopCandidates.length === 0 ? (
              <p className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-slate-300">
                No candidate events yet. Keep the watcher on, or click <span className="text-sky-300">Run now</span>.
              </p>
            ) : (
              <div className="mt-4 grid gap-3">
                {sortedDesktopCandidates.map((candidate) => {
                  const start = new Date(candidate.extractedEvent.startTime).toLocaleString();
                  return (
                    <article key={candidate.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-base font-medium text-white">{candidate.extractedEvent.title}</h3>
                          <p className="mt-1 text-sm text-slate-300">{start}</p>
                          <p className="mt-1 text-xs text-slate-400">Sender: {candidate.message.sender}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            Confidence {Math.round(candidate.extractedEvent.confidence * 100)}%
                          </p>
                        </div>
                        <span className="rounded-full border border-sky-300/20 bg-sky-400/10 px-2 py-1 text-[11px] uppercase tracking-wider text-sky-100">
                          Gmail
                        </span>
                      </div>
                      <p className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] p-2 text-sm text-slate-300">
                        {toMessageSnippet(candidate)}
                      </p>
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => onCreateDesktopEvent(candidate)}
                          disabled={actionPending === candidate.id}
                          className="rounded-lg bg-sky-400 px-3 py-2 text-xs font-medium text-slate-950 transition hover:bg-sky-300 disabled:opacity-60"
                        >
                          Create Event
                        </button>
                        <button
                          onClick={() => startEditing(candidate)}
                          className="rounded-lg border border-white/15 px-3 py-2 text-xs text-slate-200 transition hover:bg-white/5"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => onIgnoreDesktopCandidate(candidate.id)}
                          disabled={actionPending === candidate.id}
                          className="rounded-lg border border-white/15 px-3 py-2 text-xs text-slate-200 transition hover:bg-white/5 disabled:opacity-60"
                        >
                          Ignore
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <div className="grid gap-4">
            <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <h2 className="text-lg font-medium text-white">Created Events</h2>
              {desktopState.createdEvents.length === 0 ? (
                <p className="mt-3 text-sm text-slate-300">
                  No events created yet. Approved events will appear here.
                </p>
              ) : (
                <ul className="mt-3 grid gap-2">
                  {desktopState.createdEvents.slice(0, 6).map((record) => (
                    <li key={record.id} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm">
                      <p className="text-white">{record.title}</p>
                      <p className="text-xs text-slate-400">{new Date(record.startTime).toLocaleString()}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <h2 className="text-lg font-medium text-white">Settings</h2>
              <div className="mt-3 flex items-end gap-2">
                <label className="flex-1 text-xs text-slate-300">
                  Polling interval (seconds)
                  <input
                    value={pollingInterval}
                    onChange={(event) => setPollingInterval(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/15 bg-slate-950 px-3 py-2 text-sm text-white"
                  />
                </label>
                <button
                  onClick={onSavePollingInterval}
                  className="rounded-lg border border-white/15 px-3 py-2 text-xs text-slate-100 hover:bg-white/10"
                >
                  Save
                </button>
              </div>
              <details className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
                <summary className="cursor-pointer text-sm text-slate-200">Google OAuth</summary>
                <div className="mt-3 grid gap-2">
                  <input
                    placeholder="Google OAuth Client ID"
                    value={oauthClientId}
                    onChange={(event) => setOauthClientId(event.target.value)}
                    className="rounded-lg border border-white/15 bg-slate-950 px-3 py-2 text-sm text-white"
                  />
                  <input
                    placeholder="Google OAuth Client Secret"
                    value={oauthClientSecret}
                    onChange={(event) => setOauthClientSecret(event.target.value)}
                    className="rounded-lg border border-white/15 bg-slate-950 px-3 py-2 text-sm text-white"
                  />
                  <input
                    placeholder="Redirect URI"
                    value={oauthRedirectUri}
                    onChange={(event) => setOauthRedirectUri(event.target.value)}
                    className="rounded-lg border border-white/15 bg-slate-950 px-3 py-2 text-sm text-white"
                  />
                  <input
                    placeholder="Refresh token (optional)"
                    value={oauthRefreshToken}
                    onChange={(event) => setOauthRefreshToken(event.target.value)}
                    className="rounded-lg border border-white/15 bg-slate-950 px-3 py-2 text-sm text-white"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={onConnectGoogle}
                      disabled={oauthBusy}
                      className="rounded-lg bg-emerald-400 px-3 py-2 text-xs font-medium text-slate-950 hover:bg-emerald-300 disabled:opacity-60"
                    >
                      {oauthBusy ? "Connecting..." : "Connect with Google (recommended)"}
                    </button>
                    <button
                      onClick={onSaveOAuthConfig}
                      className="rounded-lg bg-sky-400 px-3 py-2 text-xs font-medium text-slate-950 hover:bg-sky-300"
                    >
                      Save OAuth config
                    </button>
                    <button
                      onClick={onGenerateAuthUrl}
                      className="rounded-lg border border-white/15 px-3 py-2 text-xs text-slate-100 hover:bg-white/10"
                    >
                      Generate consent URL
                    </button>
                  </div>
                  {authUrl ? (
                    <a className="break-all text-xs text-sky-300 underline" href={authUrl} target="_blank">
                      {authUrl}
                    </a>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <input
                      placeholder="Auth code from redirect"
                      value={oauthCode}
                      onChange={(event) => setOauthCode(event.target.value)}
                      className="min-w-80 flex-1 rounded-lg border border-white/15 bg-slate-950 px-3 py-2 text-sm text-white"
                    />
                    <button
                      onClick={onExchangeCode}
                      className="rounded-lg border border-white/15 px-3 py-2 text-xs text-slate-100 hover:bg-white/10"
                    >
                      Exchange code
                    </button>
                  </div>
                </div>
              </details>
              <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-400">Integrations</p>
                <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                  <span className="rounded-md border border-emerald-300/20 bg-emerald-400/10 px-2 py-1 text-emerald-100">
                    Gmail (active)
                  </span>
                  <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-slate-300">
                    Slack (coming soon)
                  </span>
                  <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-slate-300">
                    Discord (coming soon)
                  </span>
                </div>
              </div>
            </section>
          </div>
        </div>
      ) : loading ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-sm text-slate-300">Loading...</div>
      ) : sortedSuggestions.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-sm text-slate-300">
          Web mode: no pending suggestions yet. Send Gmail webhook payload to `POST /api/gmail/webhook`.
        </div>
      ) : (
        <section className="grid gap-4">
          {sortedSuggestions.map((suggestion) => (
            <article key={suggestion.id} className="rounded-2xl border border-white/10 bg-slate-900/70 p-6">
              <h3 className="text-lg text-white">{suggestion.extractedEvent.title}</h3>
              <p className="mt-1 text-sm text-slate-300">
                {new Date(suggestion.extractedEvent.startIso).toLocaleString()} •{" "}
                {Math.round(suggestion.extractedEvent.confidence * 100)}%
              </p>
              <p className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3 text-sm text-slate-300">
                {suggestion.message.text.slice(0, 220)}
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => resolveSuggestion(suggestion.id, "approve")}
                  disabled={actionPending === suggestion.id}
                  className="rounded-lg bg-sky-400 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-sky-300 disabled:opacity-60"
                >
                  Create Event
                </button>
                <button
                  onClick={() => resolveSuggestion(suggestion.id, "ignore")}
                  disabled={actionPending === suggestion.id}
                  className="rounded-lg border border-white/15 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/5 disabled:opacity-60"
                >
                  Ignore
                </button>
              </div>
            </article>
          ))}
        </section>
      )}

      {candidateEditor ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-white/15 bg-slate-900 p-5">
            <h3 className="text-lg font-medium text-white">Edit Event</h3>
            <div className="mt-3 grid gap-2">
              <input
                value={candidateEditor.title}
                onChange={(event) => setCandidateEditor((prev) => (prev ? { ...prev, title: event.target.value } : prev))}
                className="rounded-lg border border-white/15 bg-slate-950 px-3 py-2 text-sm text-white"
              />
              <input
                value={candidateEditor.startTime}
                onChange={(event) =>
                  setCandidateEditor((prev) => (prev ? { ...prev, startTime: event.target.value } : prev))
                }
                className="rounded-lg border border-white/15 bg-slate-950 px-3 py-2 text-sm text-white"
              />
              <input
                value={candidateEditor.endTime}
                onChange={(event) => setCandidateEditor((prev) => (prev ? { ...prev, endTime: event.target.value } : prev))}
                className="rounded-lg border border-white/15 bg-slate-950 px-3 py-2 text-sm text-white"
              />
              <input
                value={candidateEditor.timezone}
                onChange={(event) =>
                  setCandidateEditor((prev) => (prev ? { ...prev, timezone: event.target.value } : prev))
                }
                className="rounded-lg border border-white/15 bg-slate-950 px-3 py-2 text-sm text-white"
              />
              <input
                value={candidateEditor.location}
                onChange={(event) =>
                  setCandidateEditor((prev) => (prev ? { ...prev, location: event.target.value } : prev))
                }
                className="rounded-lg border border-white/15 bg-slate-950 px-3 py-2 text-sm text-white"
              />
              <input
                value={candidateEditor.attendees}
                onChange={(event) =>
                  setCandidateEditor((prev) => (prev ? { ...prev, attendees: event.target.value } : prev))
                }
                className="rounded-lg border border-white/15 bg-slate-950 px-3 py-2 text-sm text-white"
              />
              <textarea
                value={candidateEditor.description}
                onChange={(event) =>
                  setCandidateEditor((prev) => (prev ? { ...prev, description: event.target.value } : prev))
                }
                className="min-h-28 rounded-lg border border-white/15 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setCandidateEditor(null)}
                className="rounded-lg border border-white/20 px-3 py-2 text-sm text-slate-200 hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const candidate = sortedDesktopCandidates.find((item) => item.id === candidateEditor.candidateId);
                  if (!candidate) return;
                  void onCreateDesktopEvent(candidate);
                }}
                className="rounded-lg bg-sky-400 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-sky-300"
              >
                Save and Create
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
