import { useState } from "react";
import { Header } from "../components/header";
import { MenuPartida } from "../components/menuPartida";
import { BarraVantagem } from "../components/barraVantagem";
import { Tabuleiro } from "../components/tabuleiro";
import { PainelDicas } from "../components/painelDicas";
import { ControlesPartida } from "../components/controlesPartida";
import { usePartida } from "../hooks/usePartida";
import { useRelogio } from "../hooks/useRelogio";
import { MODOS_PARTIDA, NIVEIS_DIFICULDADE, TEMPO_INICIAL } from "../constants/partida";
import { DICAS_PLACEHOLDER } from "../constants/dicas";
import { FUNDOS } from "../constants/fundos";


// Aqui só mora o que é assunto da página estado da interface e a ligação entre os componentes
// Regra de xadrez é do usePartida.js (via usePartida, com a lib chess)

export default function HomePage() {
 
  const [menuAberto, setMenuAberto] = useState(false);
  const [modo, setModo] = useState(MODOS_PARTIDA[0]);
  const [nivel, setNivel] = useState(NIVEIS_DIFICULDADE[1]);

  // Fundo da mesa 
  const [fundo] = useState(FUNDOS[0]);

  // Partida (regras no usePartida.js)
  const { posicao, turno, acabou, jogar, voltarJogada, reiniciar } = usePartida();


  // Relógio (Só o lado da vez marca tempo, e o relógio para sozinho quando a partidaacaba)
  const { tempoBrancas, tempoPretas, reiniciarRelogio } = useRelogio({
    turno,
    tempoInicial: TEMPO_INICIAL,
    rodando: !acabou,
  });

  // Cards de análise
  const [dicas] = useState(DICAS_PLACEHOLDER);

  function escolherModo(novoModo) {
    setModo(novoModo);
    setMenuAberto(false);
    // Falta uma função pra realmente trocar o modo (Meu mano Rodrigo, precisamos ver se realmente vai ter algo assim ou é viagem)
  }

  return (
    <div
      className="min-h-svh bg-cover bg-center"
      style={{ backgroundImage: `url(${fundo.imagem})` }}
    >
      {/* Véu escuro por cima da madeira*/}
      <div className="flex min-h-svh flex-col bg-black/20 px-4 pb-6 backdrop-blur-[1px]">
        <Header
          modoAtual={modo}
          nivelAtual={nivel}
          onAbrirMenu={() => setMenuAberto(true)}
          onTrocarNivel={setNivel}
        />

        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 lg:flex-row lg:items-start">
          <section className="flex flex-1 flex-col gap-4">
            {/* BARRA DE VANTAGEM, VALOR FIXO POR ENQUANTO */}
            <BarraVantagem vantagem={0.5} />

            <Tabuleiro
              posicao={posicao}
              onJogar={jogar}
              tempoPretas={tempoPretas}
              tempoBrancas={tempoBrancas}
            />

            <ControlesPartida
              onVoltarJogada={() => voltarJogada()}
              onReiniciar={() => {
                reiniciar();
                reiniciarRelogio();
              }}
              onDesistir={() => {
                // Ainda vou fazer
              }}
              onAbrirConfiguracoes={() => {
                // abrir as configurações (ainda farei)
              }}
            />
          </section>

          <div className="w-full lg:w-72 xl:w-80">
            <PainelDicas
              dicas={dicas}
              onPedirDica={() => {
                // Logica de chamada da api para dicas (ainda falta fazer)
              }}
            />
          </div>
        </main>
      </div>

      <MenuPartida
        aberto={menuAberto}
        modoAtual={modo}
        onFechar={() => setMenuAberto(false)}
        onEscolherModo={escolherModo}
      />
    </div>
  );
}
