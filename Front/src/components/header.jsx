import { Menu } from "lucide-react";
import { SeletorNivel } from "./seletorNivel";

// Header, não tem muito o que dizer 
export function Header({ modoAtual, nivelAtual, onAbrirMenu, onTrocarNivel }) {
  return (
    <header className="flex items-center gap-4 px-2 py-4 text-white">
      {/* Sanduíche e o modo de partida */}
      <div className="flex flex-1 items-center gap-3">
        <button
          type="button"
          onClick={onAbrirMenu}
          aria-label="Abrir menu de modos de partida"
          className="rounded-lg p-1 transition hover:bg-white/20"
        >
          <Menu className="h-7 w-7" />
        </button>
        <span className="hidden whitespace-nowrap text-lg sm:inline">
          {modoAtual?.nome}
        </span>
      </div>

      {/* Nome do app, que é o que a galera vai ler primeiro */}
      <h1 className="text-2xl font-normal tracking-wide text-center md:text-3xl">
        Os gambitos do Algoritmo
      </h1>

      {/* Dificuldade da IA */}
      <div className="flex flex-1 justify-end">
        <SeletorNivel nivelAtual={nivelAtual} onTrocarNivel={onTrocarNivel} />
      </div>
    </header>
  );
}
