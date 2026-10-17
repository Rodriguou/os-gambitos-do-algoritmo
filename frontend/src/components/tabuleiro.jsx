import { Chessboard } from "react-chessboard";
import { Bot, User } from "lucide-react";
import { CrachaTempo } from "./crachaTempo";


// Tabuleiro e as duas fileiras de jogador
// Este componente apenas renderiza, não faz mais nada
export function Tabuleiro({ posicao, onJogar, tempoPretas, tempoBrancas, travado = false }) {

  const opcoes = {
    position: posicao,
    boardOrientation: "white",
    // Enquanto a IA pensa, ninguém faz nada
    allowDragging: !travado,
    animationDurationInMs: 200,
    darkSquareStyle: { backgroundColor: "#b58863" },
    lightSquareStyle: { backgroundColor: "#f0d9b5" },

    onPieceDrop: ({ sourceSquare, targetSquare }) => {
    
      if (!targetSquare) return false;
      return onJogar?.({ from: sourceSquare, to: targetSquare }) ?? false;
    },
  };

  return (
    <div className="flex w-full max-w-[540px] flex-col gap-2">
      {/* Pretas em cima (sempre IA) */}
      <div className="flex items-center justify-between text-white">
        <span className="flex items-center gap-2 text-sm">
          <Bot className="h-4 w-4" />
          IA (Pretas)
        </span>
        <CrachaTempo segundos={tempoPretas} />
      </div>

      <div className="overflow-hidden rounded-sm shadow-xl">
        <Chessboard options={opcoes} />
      </div>

      {/* Brancas embaixo (Sempre jogador) */}
      <div className="flex items-center justify-between text-white">
        <span className="flex items-center gap-2 text-sm">
          <User className="h-4 w-4" />
          Jogador (Brancas)
        </span>
        <CrachaTempo segundos={tempoBrancas} />
      </div>
    </div>
  );
}
