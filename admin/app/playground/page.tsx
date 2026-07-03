import PlaygroundClient from './PlaygroundClient';

export default function PlaygroundPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Playground</h1>
        <p className="mt-1 text-sm text-slate-500">
          Test the browser agent interactively — give it a task and watch it work, step by step.
        </p>
      </div>
      <PlaygroundClient />
    </div>
  );
}
