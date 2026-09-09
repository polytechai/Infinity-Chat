import React from "react";
import { emitGameMove } from "../../services/socket";
import { Trophy, RefreshCw } from "lucide-react";

export default function GameBoard({ messageId, roomId, game }) {
  const checkWinner = (board) => {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6]
    ];
    for (let i = 0; i < lines.length; i++) {
      const [a, b, c] = lines[i];
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return board[a];
      }
    }
    return board.every(Boolean) ? "Tie" : null;
  };

  const winner = checkWinner(game.board);

  const handleCellClick = (index) => {
    if (game.board[index] || winner) return;
    emitGameMove(roomId, messageId, index, game.turn);
  };

  return (
    <div className="p-3 bg-infinity-dark border border-infinity-border rounded-xl flex flex-col items-center">
      <div className="flex items-center justify-between w-full mb-3 text-xs">
        <span className="font-bold text-slate-300">Tic-Tac-Toe</span>
        <span className="font-semibold text-infinity-secondary">
          {winner
            ? winner === "Tie"
              ? "Game Tied!"
              : `Winner: ${winner} 🎉`
            : `Turn: Player ${game.turn}`}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {game.board.map((cell, idx) => (
          <button
            key={idx}
            onClick={() => handleCellClick(idx)}
            disabled={Boolean(cell || winner)}
            className={`w-14 h-14 rounded-lg flex items-center justify-center font-black text-lg transition-colors ${
              cell === "X"
                ? "bg-indigo-600/30 text-indigo-400 border border-indigo-500/40"
                : cell === "O"
                ? "bg-pink-600/30 text-pink-400 border border-pink-500/40"
                : "bg-infinity-card hover:bg-slate-700/50 border border-infinity-border"
            }`}
          >
            {cell}
          </button>
        ))}
      </div>
    </div>
  );
}
