'use client';

import { useRef, useState } from 'react';

const WORKER_API = process.env.NEXT_PUBLIC_WORKER_API_URL || 'http://localhost:8000';

type StepEvent = {
  n: number;
  url?: string;
  evaluation?: string;
  next_goal?: string;
  actions?: Record<string, unknown>[];
  error?: string;
};

type Message =
  | { kind: 'start'; task: string; model: string }
  | { kind: 'step'; step: StepEvent }
  | { kind: 'done'; result: string }
  | { kind: 'error'; message: string };

export default function PlaygroundClient() {
  const [task, setTask] = useState('Fill the form with name "Marco Rossi" and email "marco@example.com". Do not submit.');
  const [url, setUrl] = useState('https://www.selenium.dev/selenium/web/web-form.html');
  const [running, setRunning] = useState(false);
  const [showBrowser, setShowBrowser] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const feedRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const push = (m: Message) => {
    setMessages((prev) => [...prev, m]);
    requestAnimationFrame(() => feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight }));
  };

  function stop() {
    abortRef.current?.abort();
  }

  async function run() {
    if (running) return;
    setMessages([]);
    setRunning(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch(`${WORKER_API}/playground/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task, url: url || null, headless: !showBrowser, max_steps: 15 }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) throw new Error(`Worker responded ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';
        for (const part of parts) {
          let event = 'message';
          let data = '';
          for (const line of part.split('\n')) {
            if (line.startsWith('event:')) event = line.slice(6).trim();
            else if (line.startsWith('data:')) data += line.slice(5).trim();
          }
          if (!data) continue;
          const payload = JSON.parse(data);
          if (event === 'start') push({ kind: 'start', task: payload.task, model: payload.model });
          else if (event === 'step') push({ kind: 'step', step: payload });
          else if (event === 'done') push({ kind: 'done', result: payload.result });
          else if (event === 'error') push({ kind: 'error', message: payload.message });
        }
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        push({ kind: 'error', message: 'Stopped by user.' });
      } else {
        push({ kind: 'error', message: e instanceof Error ? e.message : 'Failed — is the worker API running on :8000?' });
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }

  return (
    <div className="grid grid-cols-[360px_1fr] gap-6">
      {/* Controls */}
      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Start URL</span>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Task</span>
          <textarea value={task} onChange={(e) => setTask(e.target.value)} rows={6}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={showBrowser} disabled={running}
            onChange={(e) => setShowBrowser(e.target.checked)} />
          Show browser window (watch cloakbrowser live)
        </label>
        {running ? (
          <button onClick={stop}
            className="w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700">
            ■ Stop
          </button>
        ) : (
          <button onClick={run}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700">
            ▶ Run agent
          </button>
        )}
        <p className="text-xs text-slate-400">
          Uses MiniMax + cloakbrowser via the worker API ({WORKER_API}). The agent fills but never submits.
        </p>
      </div>

      {/* Live feed */}
      <div ref={feedRef} className="h-[70vh] overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            Enter a task and hit Run — the agent&apos;s steps stream here live.
          </div>
        )}
        <div className="space-y-3">
          {messages.map((m, i) => <Bubble key={i} m={m} />)}
          {running && <div className="text-xs text-slate-400">● agent working…</div>}
        </div>
      </div>
    </div>
  );
}

function Bubble({ m }: { m: Message }) {
  if (m.kind === 'start')
    return (
      <div className="rounded-lg bg-slate-50 p-3 text-sm">
        <span className="font-semibold text-slate-700">Started</span>{' '}
        <span className="text-xs text-slate-400">({m.model})</span>
        <div className="mt-1 whitespace-pre-wrap text-slate-600">{m.task}</div>
      </div>
    );
  if (m.kind === 'step') {
    const s = m.step;
    return (
      <div className="rounded-lg border border-slate-100 p-3 text-sm">
        <div className="mb-1 font-semibold text-indigo-700">Step {s.n}</div>
        {s.evaluation && <div className="text-slate-600"><span className="text-slate-400">eval:</span> {s.evaluation}</div>}
        {s.next_goal && <div className="text-slate-600"><span className="text-slate-400">goal:</span> {s.next_goal}</div>}
        {s.actions && s.actions.length > 0 && (
          <div className="mt-1 space-y-0.5">
            {s.actions.map((a, i) => (
              <div key={i} className="font-mono text-xs text-slate-500">▸ {Object.keys(a)[0]}: {JSON.stringify(Object.values(a)[0])}</div>
            ))}
          </div>
        )}
        {s.url && <div className="mt-1 truncate text-xs text-slate-400">{s.url}</div>}
        {s.error && <div className="text-xs text-red-500">{s.error}</div>}
      </div>
    );
  }
  if (m.kind === 'done')
    return (
      <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
        <span className="font-semibold">✓ Done</span>
        <div className="mt-1 whitespace-pre-wrap">{m.result}</div>
      </div>
    );
  return (
    <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
      <span className="font-semibold">Error</span>
      <div className="mt-1 whitespace-pre-wrap">{m.message}</div>
    </div>
  );
}
