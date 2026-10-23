import { Chessboard } from "react-chessboard";
import { Bot, Clock, User } from "lucide-react";
import { CrachaTempo } from "./crachaTempo";


// Tabuleiro, o relógio único da partida e as duas fileiras de jogador.
// Este componente apenas renderiza, não faz mais nada.
export function Tabuleiro({
  posicao,
  onJogar,
  onSolicitarPromocao,
  tempoPartida = 0,
  travado = false,
}) {
  const opcoes = {
    position: posicao,
    boardOrientation: "white",
    // Enquanto a IA pensa, ninguém faz nada
    allowDragging: !travado,
    animationDurationInMs: 200,
    darkSquareStyle: { backgroundColor: "#b58863" },
    lightSquareStyle: { backgroundColor: "#f0d9b5" },

    onPieceDrop: ({ sourceSquare, targetSquare, piece }) => {
      if (!targetSquare) return false;

      // O react-chessboard não tem seletor de promoção: o peão branco
      // chegando à oitava fileira abre o nosso modal antes do lance.
      if (piece?.pieceType === "wP" && targetSquare[1] === "8") {
        onSolicitarPromocao?.({ from: sourceSquare, to: targetSquare });
        return false;
      }

      return onJogar?.({ from: sourceSquare, to: targetSquare }) ?? false;
    },
  };

  return (
    <div className="flex w-full max-w-[540px] flex-col gap-2">
      {/* Pretas em cima (sempre IA), com o relógio da partida do lado */}
      <div className="flex items-center justify-between gap-3 text-white">
        <span className="flex items-center gap-2 text-sm">
          <Bot className="h-4 w-4" />
          IA (Pretas)
        </span>
        <span className="flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4" />
          Tempo de partida
          <CrachaTempo segundos={tempoPartida} />
        </span>
      </div>

      <div className="overflow-hidden rounded-sm shadow-xl">
        <Chessboard options={opcoes} />
      </div>

      {/* Brancas embaixo (sempre jogador) */}
      <div className="flex items-center gap-2 text-white">
        <User className="h-4 w-4" />
        <span className="text-sm">Jogador (Brancas)</span>
      </div>
    </div>
  );
}
