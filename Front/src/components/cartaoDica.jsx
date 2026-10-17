import { CheckCircle2, TriangleAlert } from "lucide-react";


// Card de análise, 3 tipos mesma base

const VARIANTES = {
  // A jogada analisada
  destaque: { caixa: "bg-painel", titulo: "text-texto-painel" },
  // O que esta bom
  forte: { caixa: "bg-painel-forte", titulo: "text-forte", icone: CheckCircle2 },
  // O que vai custar a partida se ninguém avisar
  fraco: { caixa: "bg-painel-fraco", titulo: "text-fraco", icone: TriangleAlert },
};

export function CartaoDica({ titulo, descricao, variante = "destaque", selo }) {
  const estilo = VARIANTES[variante] ?? VARIANTES.destaque;
  const Icone = estilo.icone;

  return (
    <article
      className={`rounded-2xl border border-black/10 px-4 py-3 text-texto-painel shadow-sm ${estilo.caixa}`}
    >
      <div className="flex items-center justify-between gap-3">
        <h3
          className={`flex items-center gap-2 text-lg font-bold ${estilo.titulo}`}
        >
          {Icone && <Icone className="h-5 w-5 shrink-0" />}
          {titulo}
        </h3>

        {selo && (
          <span className="shrink-0 rounded-full bg-selo px-3 py-1 text-sm font-semibold text-forte">
            {selo}
          </span>
        )}
      </div>

      {descricao && <p className="text-sm">{descricao}</p>}
    </article>
  );
}
