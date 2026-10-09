import { fmtDate } from "./ui";

export function Thread({ messages, viewer }: { messages: { id: string; fromAdmin: boolean; body: string; createdAt: Date }[]; viewer: "admin" | "client" }) {
  return (
    <div className="space-y-3">
      {messages.map((m) => {
        const mine = (viewer === "admin") === m.fromAdmin;
        return (
          <div key={m.id} className={`flex ${mine ? "justify-start" : "justify-end"}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${mine ? "bg-brand-600 text-white" : ""}`} style={mine ? undefined : { background: "var(--surface-2)" }}>
              <div className="mb-0.5 text-xs font-bold opacity-80">{m.fromAdmin ? "فريق الدعم" : "العميل"}</div>
              <div className="whitespace-pre-wrap">{m.body}</div>
              <div className="mt-1 text-[10px] opacity-60">{fmtDate(m.createdAt)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
