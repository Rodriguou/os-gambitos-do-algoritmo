import { useEffect } from "react";
import { Check, Sparkles, X } from "lucide-react";
import { FUNDOS } from "../constants/fundos";
import { Alternador } from "./alternador";

// Modal de configurações da mesa
// Fundo e tradução da Azure moram aqui, num lugar só, sem poluir o tabuleiro
export function ModalConfiguracoes({
  aberto,
  fundoAtual,
  usarAzure = true,
  onFechar,
  onEscolherFundo,
  onDefinirUsarAzure,
}) {
  // Esc fecha
  useEffect(() => {
    if (!aberto) return;

    function aoTeclar(evento) {
      if (evento.key === "Escape") onFechar?.();
    }

    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [aberto, onFechar]);

  if (!aberto) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4"
      onClick={onFechar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-configuracoes"
        className="w-full max-w-md rounded-2xl bg-painel p-6 text-texto-painel shadow-xl"
        onClick={(evento) => evento.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 id="titulo-configuracoes" className="text-xl font-bold">
            Configurações
          </h2>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar configurações"
            className="rounded-lg p-1 transition hover:bg-black/5"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <p className="mt-1 text-sm">Fundo da mesa</p>

        <ul className="mt-3 grid grid-cols-2 gap-3">
          {FUNDOS.map((fundo) => {
            const selecionado = fundo.id === fundoAtual?.id;

            return (
              <li key={fundo.id}>
                <button
                  type="button"
                  onClick={() => onEscolherFundo?.(fundo)}
                  aria-pressed={selecionado}
                  className={`w-full rounded-xl p-2 text-left transition hover:bg-black/5 ${
                    selecionado ? "ring-2 ring-forte" : "ring-1 ring-black/10"
                  }`}
                >
                  <img
                    src={fundo.imagem}
                    alt=""
                    className="h-20 w-full rounded-lg object-cover"
                  />
                  <span className="mt-2 flex items-center justify-center gap-1 text-sm font-semibold">
                    {selecionado && <Check className="h-4 w-4 text-forte" />}
                    {fundo.nome}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="mt-6 border-t border-black/10 pt-4">
          <p className="text-sm">Explicação da jogada</p>

          <div className="mt-2">
            <Alternador
              ativo={usarAzure}
              onAlternar={onDefinirUsarAzure}
              rotulo="Tradução da Azure"
              icone={<Sparkles className="h-5 w-5" />}
            />
          </div>

          <p className="mt-2 px-1 text-xs">
            Desligado mostra a explicação determinística do Stockfish. Se a Azure
            falhar, o backend volta sozinho pro Stockfish.
          </p>
        </div>
      </div>
    </div>
  );
}
