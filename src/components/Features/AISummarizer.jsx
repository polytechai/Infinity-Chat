import React, { useState, useEffect } from "react";
import { summarizeChat } from "../../services/aiService";
import { Sparkles, X, Copy, Check, Loader2 } from "lucide-react";

export default function AISummarizer({ messages, onClose }) {
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const executeSummary = async () => {
      setLoading(true);
      const res = await summarizeChat(messages);
      if (isMounted) {
        setSummary(res);
        setLoading(false);
      }
    };
    executeSummary();
    return () => {
      isMounted = false;
    };
  }, [messages]);

  const handleCopy = () => {
    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-infinity-surface border border-infinity-border rounded-2xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-infinity-border flex items-center justify-between bg-infinity-card">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h2 className="font-bold text-base text-slate-100">AI Chat Summarizer</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-infinity-border"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <p className="text-xs text-slate-400">
            Powered by Gemini AI. Analyzed the last {messages.length} messages:
          </p>

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 text-infinity-primary animate-spin" />
              <p className="text-xs text-slate-400">Distilling conversations into 3 key takeaways...</p>
            </div>
          ) : (
            <div className="p-4 bg-infinity-dark border border-infinity-border rounded-xl">
              <pre className="text-sm text-slate-200 whitespace-pre-wrap font-sans leading-relaxed">
                {summary}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-infinity-border flex items-center justify-end gap-3 bg-infinity-card">
          <button
            onClick={handleCopy}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-infinity-border hover:bg-slate-700 text-white rounded-xl transition-all disabled:opacity-50"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            {copied ? "Copied!" : "Copy Summary"}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold bg-infinity-primary hover:bg-infinity-primaryHover text-white rounded-xl transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
