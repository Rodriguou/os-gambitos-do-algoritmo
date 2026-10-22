// toogle switch

export function Alternador({ ativo, onAlternar, rotulo, icone }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ativo}
      onClick={() => onAlternar?.(!ativo)}
      className="flex w-full items-center justify-between gap-3 rounded-2xl bg-painel px-4 py-2 font-semibold text-texto-painel shadow-sm transition hover:bg-white"
    >
      <span className="flex items-center gap-2">
        {icone}
        {rotulo}
      </span>

      {/* Trilho e bolinha: a bolinha desliza quando ativa */}
      <span
        aria-hidden="true"
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          ativo ? "bg-forte" : "bg-black/20"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
            ativo ? "left-[22px]" : "left-0.5"
          }`}
        />
      </span>
    </button>
  );
}
