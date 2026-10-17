import { X } from "lucide-react";
import { MODOS_PARTIDA } from "../constants/partida";


export function MenuPartida({ aberto, modoAtual, onFechar, onEscolherModo }) {
  return (
    <>
      {aberto && (
        <div
          className="fixed inset-0 z-30 bg-black/50"
          onClick={onFechar}
          aria-hidden="true"
        />
      )}

      <aside
        // `inert` tira o menu fechado do caminho
        inert={!aberto}
        className={`fixed inset-y-0 left-0 z-40 flex w-72 transform flex-col gap-6 bg-painel p-5 text-texto-painel shadow-2xl transition-transform duration-300 ${
          aberto ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Modo de partida</h2>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar menu"
            className="rounded-lg p-1 transition hover:bg-black/5"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <ul className="flex flex-col gap-2">
          {MODOS_PARTIDA.map((modo) => (
            <li key={modo.id}>
              <button
                type="button"
                onClick={() => onEscolherModo?.(modo)}
                className={`w-full rounded-xl border border-black/10 px-4 py-3 text-left transition hover:bg-black/5 ${
                  modo.id === modoAtual?.id ? "bg-white/60 font-bold" : ""
                }`}
              >
                {modo.nome}
              </button>
            </li>
          ))}
        </ul>
      </aside>
    </>
  );
}
