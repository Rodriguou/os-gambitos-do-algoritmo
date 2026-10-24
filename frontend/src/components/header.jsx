import { SeletorNivel } from "./seletorNivel";


// Header: nome do app no centro e dificuldade da IA à direita.
export function Header({ nivelAtual, onTrocarNivel }) {
  return (
    <header className="flex items-center gap-4 px-2 py-4 text-white">
      {/* Espaçador para manter o título realmente centralizado */}
      <div className="flex-1" />

      {/* Nome do app, que é o que a galera vai ler primeiro */}
      <h1 className="text-center text-2xl font-normal tracking-wide md:text-3xl">
        Os Gambitos do Algoritmo
      </h1>

      {/* Dificuldade da IA */}
      <div className="flex flex-1 justify-end">
        <SeletorNivel nivelAtual={nivelAtual} onTrocarNivel={onTrocarNivel} />
      </div>
    </header>
  );
}
