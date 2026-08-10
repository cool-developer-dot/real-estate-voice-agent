import { Link } from "wouter";
import { AlertCircle, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex h-[80vh] w-full items-center justify-center px-4">
      <div
        className="glass-panel glass-reflect flex flex-col items-center text-center max-w-md w-full"
        style={{ padding: "40px 32px" }}
      >
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 mb-5"
          style={{ background: "rgba(224,64,64,0.10)", border: "1px solid rgba(224,64,64,0.20)" }}
        >
          <AlertCircle className="w-7 h-7" style={{ color: "#E04040" }} strokeWidth={2} />
        </div>

        <div
          className="text-xs font-bold uppercase tracking-[0.16em] mb-2"
          style={{ fontFamily: "var(--app-font-mono)", color: "#94A3B8" }}
        >
          Error 404
        </div>
        <h1
          className="text-2xl font-bold"
          style={{ fontFamily: "var(--app-font-sans)", color: "#0F172A" }}
        >
          Page Not Found
        </h1>
        <p
          className="mt-2.5 text-sm leading-relaxed"
          style={{ fontFamily: "var(--app-font-sans)", color: "#64748B" }}
        >
          The page you're looking for doesn't exist or may have been moved.
        </p>

        <Link
          href="/"
          className="mt-7 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={{
            fontFamily: "var(--app-font-sans)",
            background: "linear-gradient(135deg, #5B6AF8, #818CF8)",
            color: "#fff",
            boxShadow: "0 4px 16px rgba(91,106,248,0.30)",
          }}
          onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 6px 20px rgba(91,106,248,0.40)"; e.currentTarget.style.opacity = "0.92"; }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 4px 16px rgba(91,106,248,0.30)"; e.currentTarget.style.opacity = "1"; }}
        >
          <ArrowLeft className="w-4 h-4" />
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
}
