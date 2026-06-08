export default function Loading() {
  return (
    <main className="min-h-screen grid place-items-center px-4">
      <div className="text-center">
        <div className="inline-flex items-center gap-2 select-none">
          <span className="font-mono font-bold text-3xl text-neon-green glow-text-green animate-pulse">
            &gt;_
          </span>
          <span className="font-mono font-extrabold tracking-tight text-3xl">
            <span className="gradient-text">Code</span>
            <span className="text-text">Racer</span>
          </span>
        </div>

        <div className="mt-6 mx-auto h-1.5 w-48 rounded-full bg-bg-soft overflow-hidden">
          <div className="h-full w-1/2 shimmer rounded-full" />
        </div>

        <p className="mt-4 text-text-muted text-xs font-mono">
          <span className="animate-pulse">compilando a pista...</span>
        </p>
      </div>
    </main>
  );
}
