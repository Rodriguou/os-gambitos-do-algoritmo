import { useEffect } from "react";

// O react-chessboard v5 não traz seletor de promoção, então o peão branco
// que chega à oitava fileira abre este modal antes do lance ser aplicado.
const PECAS = [
  { id: "q", nome: "Dama", simbolo: "♕" },
  { id: "r", nome: "Torre", simbolo: "♖" },
  { id: "b", nome: "Bispo", simbolo: "♗" },
  { id: "n", nome: "Cavalo", simbolo: "♘" },
];

export function ModalPromocao({ aberto, onEscolher, onCancelar }) {
  useEffect(() => {
    if (!aberto) return;

    function aoTeclar(evento) {
      if (evento.key === "Escape") onCancelar?.();
    }

    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [aberto, onCancelar]);

  if (!aberto) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onCancelar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-promocao"
        className="w-full max-w-sm rounded-2xl bg-painel p-6 text-texto-painel shadow-xl"
        onClick={(evento) => evento.stopPropagation()}
      >
        <h2 id="titulo-promocao" className="text-xl font-bold">
          Escolha a promoção
        </h2>
        <p className="mt-1 text-sm">O peão chegou à última fileira.</p>

        <div className="mt-4 grid grid-cols-4 gap-2">
          {PECAS.map((peca) => (
            <button
              key={peca.id}
              type="button"
              onClick={() => onEscolher?.(peca.id)}
              className="flex flex-col items-center gap-1 rounded-xl bg-white/60 py-3 shadow-sm transition hover:bg-white"
            >
              <span aria-hidden="true" className="text-3xl leading-none">
                {peca.simbolo}
              </span>
              <span className="text-xs font-semibold">{peca.nome}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onCancelar}
          className="mt-4 w-full rounded-full bg-black/10 px-4 py-2 text-sm font-semibold transition hover:bg-black/15"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
