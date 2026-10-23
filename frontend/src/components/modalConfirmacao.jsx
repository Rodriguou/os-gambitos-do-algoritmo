import { useEffect } from "react";

/*
  Confirmação para ações que não têm volta (desistir, começar outra partida).
  Um modal só, usado pelos dois fluxos, para não duplicar o overlay.
*/
export function ModalConfirmacao({
  aberto,
  titulo,
  mensagem,
  rotuloConfirmar = "Confirmar",
  variante = "perigo",
  onConfirmar,
  onCancelar,
}) {
  useEffect(() => {
    if (!aberto) return;

    function aoTeclar(evento) {
      if (evento.key === "Escape") onCancelar?.();
    }

    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [aberto, onCancelar]);

  if (!aberto) return null;

  const corConfirmar = variante === "perigo" ? "bg-fraco" : "bg-forte";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onCancelar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-confirmacao"
        className="w-full max-w-sm rounded-2xl bg-painel p-6 text-texto-painel shadow-xl"
        onClick={(evento) => evento.stopPropagation()}
      >
        <h2 id="titulo-confirmacao" className="text-xl font-bold">
          {titulo}
        </h2>

        {mensagem && <p className="mt-2 text-sm">{mensagem}</p>}

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancelar}
            className="rounded-full bg-black/10 px-4 py-2 text-sm font-semibold transition hover:bg-black/15"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            className={`rounded-full px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 ${corConfirmar}`}
          >
            {rotuloConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}
