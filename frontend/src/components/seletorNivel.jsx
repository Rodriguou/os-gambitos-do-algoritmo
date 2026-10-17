import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { NIVEIS_DIFICULDADE } from "../constants/partida";


// Seletor "Nível: Intermediário" do cabeçalho
export function SeletorNivel({ nivelAtual, onTrocarNivel }) {
  const [aberto, setAberto] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!aberto) return;

    function aoClicarFora(evento) {
      if (!containerRef.current?.contains(evento.target)) setAberto(false);
    }

    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, [aberto]);

  function escolherNivel(nivel) {
    onTrocarNivel?.(nivel);
    setAberto(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setAberto((valor) => !valor)}
        aria-haspopup="listbox"
        aria-expanded={aberto}
        className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-2 py-1 text-base transition hover:bg-white/20 md:text-lg"
      >

        <span>
          <span className="hidden sm:inline">Nível: </span>
          {nivelAtual?.nome}
        </span>
        <ChevronDown
          className={`h-5 w-5 transition-transform ${aberto ? "rotate-180" : ""}`}
        />
      </button>

      {aberto && (
        <ul
          role="listbox"
          className="absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-xl bg-painel py-1 text-texto-painel shadow-lg"
        >
          {NIVEIS_DIFICULDADE.map((nivel) => (
            <li key={nivel.id}>
              <button
                type="button"
                role="option"
                aria-selected={nivel.id === nivelAtual?.id}
                onClick={() => escolherNivel(nivel)}
                className={`w-full px-4 py-2 text-left transition hover:bg-black/5 ${
                  nivel.id === nivelAtual?.id ? "font-bold" : ""
                }`}
              >
                {nivel.nome}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
