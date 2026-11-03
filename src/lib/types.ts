import type { LangId, Difficulty } from "./languages";

export interface Player {
  id: string;
  name: string;
  color: string;
  avatar?: string | null;
  progress: number; // 0..1
  wpm: number;
  accuracy: number; // 0..100
  errors: number;
  finishedAt: number | null;
  place: number | null;
  ready: boolean;
  abandoned: boolean;
}

export interface ChatMessage {
  id: string;
  playerId: string;
  name: string;
  text: string;
  at: number;
  system?: boolean;
  /** Mensagem de sistema traduzível (`chat.<sysKey>` com `sysVars`); `text` fica como texto pt de reserva. */
  sysKey?: "joined" | "left" | "kicked";
  sysVars?: Record<string, string>;
}

export interface Snippet {
  title: string;
  code: string;
  language: LangId;
  difficulty: Difficulty;
}

export interface RoomSettings {
  language: LangId;
  difficulty: Difficulty;
  maxPlayers: number;
}

export type RoomStatus = "lobby" | "countdown" | "racing" | "finished";

export interface RoomState {
  code: string;
  leaderId: string;
  status: RoomStatus;
  settings: RoomSettings;
  snippet: Snippet | null;
  players: Player[];
  chat: ChatMessage[];
  startedAt: number | null;
  finishedAt: number | null;
}
