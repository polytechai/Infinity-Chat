import React, { useState } from "react";
import { generateAiImage } from "../../services/aiService";
import { Sparkles, X, Image as ImageIcon, Send, Loader2 } from "lucide-react";

export default function ImageGenModal({ onClose, onSendImage }) {
  const [prompt, setPrompt] = useState("");
  const [generatedUrl, setGeneratedUrl] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async (e) => {
    e?.preventDefault();
    if (!prompt.trim()) return;
    setLoading(true);
    const url = await generateAiImage(prompt);
    setGeneratedUrl(url);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-infinity-surface border border-infinity-border rounded-2xl overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-infinity-border flex items-center justify-between bg-infinity-card">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-infinity-secondary" />
            <h2 className="font-bold text-base text-slate-100">AI Image Generator (/imagine)</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-infinity-border"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <form onSubmit={handleGenerate} className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. Cyberpunk neon skyline in rain, 8k render..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="flex-1 bg-infinity-dark border border-infinity-border text-sm rounded-xl px-4 py-2.5 text-slate-100 focus:outline-none focus:border-infinity-secondary"
            />
            <button
              type="submit"
              disabled={loading || !prompt.trim()}
              className="px-4 py-2.5 bg-infinity-secondary hover:bg-cyan-600 font-semibold text-slate-950 text-xs rounded-xl transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Generate
            </button>
          </form>

          {/* Preview Box */}
          <div className="w-full h-64 rounded-xl border border-infinity-border bg-infinity-dark flex items-center justify-center overflow-hidden relative">
            {loading ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 text-infinity-secondary animate-spin" />
                <p className="text-xs text-slate-400">Synthesizing image artifact...</p>
              </div>
            ) : generatedUrl ? (
              <img
                src={generatedUrl}
                alt="AI Generated"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center text-slate-500 text-xs gap-2">
                <ImageIcon className="w-8 h-8 text-slate-600" />
                <span>Enter a prompt and hit Generate</span>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-infinity-border flex items-center justify-end gap-3 bg-infinity-card">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
          >
            Cancel
          </button>
          <button
            disabled={!generatedUrl || loading}
            onClick={() => onSendImage(generatedUrl, prompt)}
            className="flex items-center gap-2 px-5 py-2 text-xs font-semibold bg-infinity-primary hover:bg-infinity-primaryHover text-white rounded-xl transition-all disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            Send to Chat
          </button>
        </div>
      </div>
    </div>
  );
}
