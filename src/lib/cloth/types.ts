// Fronteira entre o carousel e o motor de tecido (#99). O carousel não sabe
// se atrás disto está o pêndulo analítico (`stepCloth`, sem dependências) ou o
// soft-body do ammo — ele só descreve onde cada estandarte está e qual é o
// estímulo do quadro.

/** Estímulo do quadro: como a gôndola está se movendo. */
export interface ClothDrive {
  /** Aceleração horizontal da gôndola, em px/s². */
  accel: number;
  /** Velocidade horizontal da gôndola, em px/s. */
  velocity: number;
}

/** Onde um estandarte está na gôndola, em px relativos ao centro dela. */
export interface SlotView {
  /** Índice em LANGUAGES — identifica qual tecido/textura usar. */
  index: number;
  /** Centro do estandarte em px, relativo ao centro da gôndola. */
  x: number;
  /** Topo do estandarte (a haste) em px, medido do topo da gôndola. */
  topY: number;
  /** Largura e altura já com a escala aplicada, em px. */
  w: number;
  h: number;
  opacity: number;
  centered: boolean;
  checked: boolean;
}

/**
 * Motor de tecido. O ciclo é sempre o mesmo: o carousel manda o layout do
 * quadro (`setSlots`), avança a física (`step`) e pede o desenho (`render`).
 * `atRest` responde se dá para desligar o rAF — o mesmo contrato wake/settle
 * que o motor leve já respeitava.
 */
export interface ClothEngine {
  resize(width: number, height: number): void;
  setSlots(slots: SlotView[]): void;
  step(dt: number, drive: ClothDrive): void;
  render(): void;
  atRest(drive: ClothDrive): boolean;
  dispose(): void;
}
