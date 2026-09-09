import React from "react";
import { jsPDF } from "jspdf";
import { FileDown } from "lucide-react";

export default function PDFExporter({ messages, chatName }) {
  const exportChatAsPDF = () => {
    const doc = new jsPDF();
    const margin = 15;
    let yPosition = 20;

    // Document Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(`Infinity Chat Transcript: ${chatName}`, margin, yPosition);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    yPosition += 8;
    doc.text(`Generated on: ${new Date().toLocaleString()} | Total Messages: ${messages.length}`, margin, yPosition);

    yPosition += 6;
    doc.setDrawColor(180, 180, 180);
    doc.line(margin, yPosition, 195, yPosition);
    yPosition += 10;

    messages.forEach((msg) => {
      if (yPosition > 275) {
        doc.addPage();
        yPosition = 20;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      const timeStr = new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      doc.text(`${msg.senderName || "User"} [${timeStr}]:`, margin, yPosition);

      doc.setFont("helvetica", "normal");
      const content = msg.type === "voice" ? `[Voice Note: ${msg.duration || 3}s]` : msg.content || "[Attachment]";
      const lines = doc.splitTextToSize(content, 175);
      doc.text(lines, margin + 5, yPosition + 5);

      yPosition += 7 + lines.length * 4;
    });

    const safeFilename = `${chatName.replace(/[^a-zA-Z0-9]/g, "_")}_transcript.pdf`;
    doc.save(safeFilename);
  };

  return (
    <button
      onClick={exportChatAsPDF}
      title="Export Transcript (PDF)"
      className="flex flex-col items-center justify-center p-2 rounded-xl bg-infinity-card hover:bg-infinity-primary/30 transition-all text-xs text-slate-300"
    >
      <FileDown className="w-4 h-4 text-rose-400 mb-1" />
      Export
    </button>
  );
}
