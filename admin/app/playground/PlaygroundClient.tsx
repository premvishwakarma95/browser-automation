'use client';

import { useMemo, useRef, useState } from 'react';
import { composeTask, type PlaygroundStudent, type PlaygroundUniversity } from '@/lib/composeTask';

const WORKER_API = process.env.NEXT_PUBLIC_WORKER_API_URL || 'http://localhost:8000';

type StepEvent = {
  n: number;
  url?: string;
  evaluation?: string;
  next_goal?: string;
  actions?: Record<string, unknown>[];
  screenshot?: string;
  error?: string;
};

type Message =
  | { kind: 'start'; task: string; model: string }
  | { kind: 'step'; step: StepEvent }
  | { kind: 'done'; result: string }
  | { kind: 'error'; message: string };

type Mode = 'try' | 'custom';

export default function PlaygroundClient({
  students,
  universities,
}: {
  students: PlaygroundStudent[];
  universities: PlaygroundUniversity[];
}) {
  const [mode, setMode] = useState<Mode>('try');

  // Try mode — pick real records + a short instruction.
  const [studentId, setStudentId] = useState('');
  const [universityId, setUniversityId] = useState('');
  const [operatorPrompt, setOperatorPrompt] = useState('Log in and fill the admission form. Do not submit.');

  // Custom mode — free-form, as before.
  const [customTask, setCustomTask] = useState('Fill the form with name "Marco Rossi" and email "marco@example.com". Do not submit.');
  const [customUrl, setCustomUrl] = useState('https://www.selenium.dev/selenium/web/web-form.html');

  const [running, setRunning] = useState(false);
  const [showLiveView, setShowLiveView] = useState(true);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const feedRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const selectedStudent = useMemo(() => students.find((s) => s.id === studentId), [students, studentId]);
  const selectedUniversity = useMemo(() => universities.find((u) => u.id === universityId), [universities, universityId]);

  const composedTask = useMemo(() => {
    if (!selectedStudent || !selectedUniversity) return '';
    return composeTask(selectedStudent, selectedUniversity, operatorPrompt);
  }, [selectedStudent, selectedUniversity, operatorPrompt]);

  const canRunTry = Boolean(selectedStudent && selectedUniversity);

  // When a student has a selected_university_id, default the university dropdown to it.
  function onStudentChange(id: string) {
    setStudentId(id);
    const s = students.find((x) => x.id === id);
    if (s?.selected_university_id && !universityId) {
      setUniversityId(s.selected_university_id);
    }
  }

  const push = (m: Message) => {
    setMessages((prev) => [...prev, m]);
    requestAnimationFrame(() => feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight }));
  };

  function stop() {
    abortRef.current?.abort();
  }

  async function run() {
    if (running) return;

    let task: string;
    let url: string | null;
    if (mode === 'try') {
      if (!canRunTry) return;
      task = composedTask;
      url = selectedUniversity?.portal_url ?? null;
    } else {
      task = customTask;
      url = customUrl || null;
    }

    setMessages([]);
    setScreenshot(null);
    setRunning(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch(`${WORKER_API}/playground/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task, url, max_steps: 15 }),
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
          else if (event === 'step') {
            push({ kind: 'step', step: payload });
            if (payload.screenshot) setScreenshot(payload.screenshot);
          }
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
    <div>
      <div className="mb-3 flex justify-end">
        <button
          onClick={() => setShowLiveView((v) => !v)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50"
        >
          {showLiveView ? 'Hide Browser' : 'Show Browser'}
        </button>
      </div>
      <div className={`grid gap-6 ${showLiveView ? 'grid-cols-[380px_1fr_420px]' : 'grid-cols-[380px_1fr]'}`}>
      {/* Controls */}
      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        {/* Mode tabs */}
        <div className="flex rounded-lg bg-slate-100 p-1">
          <button
            onClick={() => setMode('try')}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
              mode === 'try' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Try
          </button>
          <button
            onClick={() => setMode('custom')}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
              mode === 'custom' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Custom
          </button>
        </div>

        {mode === 'try' ? (
          <>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Student</span>
              <select
                value={studentId}
                onChange={(e) => onStudentChange(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">— select a student —</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>{s.full_name}</option>
                ))}
              </select>
              {students.length === 0 && (
                <span className="mt-1 block text-xs text-amber-600">No students yet — add one first.</span>
              )}
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">University</span>
              <select
                value={universityId}
                onChange={(e) => setUniversityId(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">— select a university —</option>
                {universities.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
              {universities.length === 0 && (
                <span className="mt-1 block text-xs text-amber-600">No universities yet — add one first.</span>
              )}
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Prompt</span>
              <textarea
                value={operatorPrompt}
                onChange={(e) => setOperatorPrompt(e.target.value)}
                rows={3}
                placeholder='e.g. "Log in and fill the admission form, do not submit"'
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>

            {selectedStudent && selectedUniversity && (
              <details className="rounded-md bg-slate-50 p-2 text-xs text-slate-500">
                <summary className="cursor-pointer select-none font-medium text-slate-600">Preview composed task</summary>
                <pre className="mt-2 whitespace-pre-wrap font-mono">{composedTask}</pre>
              </details>
            )}
            {selectedUniversity && !selectedUniversity.portal_url && (
              <p className="text-xs text-amber-600">This university has no portal URL set — the agent won&apos;t know where to start.</p>
            )}
          </>
        ) : (
          <>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Start URL</span>
              <input value={customUrl} onChange={(e) => setCustomUrl(e.target.value)} placeholder="https://…"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Task</span>
              <textarea value={customTask} onChange={(e) => setCustomTask(e.target.value)} rows={6}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </label>
          </>
        )}

        {running ? (
          <button onClick={stop}
            className="w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700">
            ■ Stop
          </button>
        ) : (
          <button
            onClick={run}
            disabled={mode === 'try' && !canRunTry}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
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
            {mode === 'try'
              ? 'Select a student + university, add a prompt, and hit Run.'
              : 'Enter a task and hit Run — the agent’s steps stream here live.'}
          </div>
        )}
        <div className="space-y-3">
          {messages.map((m, i) => <Bubble key={i} m={m} />)}
          {running && <div className="text-xs text-slate-400">● agent working…</div>}
        </div>
      </div>

      {/* Live browser view — latest screenshot, refreshed on every agent step */}
      {showLiveView && (
        <div className="flex h-[70vh] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-1.5 border-b border-slate-100 px-3 py-2 text-xs font-medium text-slate-500">
            <span className={`h-1.5 w-1.5 rounded-full ${running ? 'bg-red-500' : 'bg-slate-300'}`} />
            Live browser
          </div>
          <div className="flex flex-1 items-center justify-center overflow-hidden bg-slate-50">
            {screenshot ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`data:image/png;base64,${screenshot}`}
                alt="Latest browser screenshot"
                className="h-full w-full object-contain object-top"
              />
            ) : (
              <p className="px-4 text-center text-sm text-slate-400">
                {running ? 'Waiting for the first screenshot…' : 'Click Run agent to start — the browser will appear here.'}
              </p>
            )}
          </div>
        </div>
      )}
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
