import type { Category, Corps, RunEventKind } from "./domain.ts";

export const CATEGORY_LABELS: Record<Category, string> = {
  casa: "Casa",
  salute: "Salute",
  trasporti: "Trasporti",
  acquisti: "Acquisti",
  finanza: "Finanza",
  formazione: "Formazione",
  famiglia: "Famiglia",
  "tempo-libero": "Tempo libero",
  carriera: "Carriera",
  altro: "Altro",
};

export const CORPS_LABELS: Record<Corps, string> = {
  tutti: "Tutte le Forze Armate",
  esercito: "Esercito",
  marina: "Marina Militare",
  aeronautica: "Aeronautica Militare",
  carabinieri: "Carabinieri",
  alpini: "Alpini",
  bersaglieri: "Bersaglieri",
  paracadutisti: "Paracadutisti",
  lagunari: "Lagunari",
  granatieri: "Granatieri",
  genio: "Genio",
  "san-marco": "Brigata San Marco",
};

export const EVENT_LABELS: Record<RunEventKind, string> = {
  search: "Ha cercato",
  read: "Ha letto",
  saved: "Ha salvato",
  checked: "Ha confermato",
  retired: "Ha rimosso",
};

const dateTime = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Rome",
});
const time = new Intl.DateTimeFormat("it-IT", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  timeZone: "Europe/Rome",
});
const date = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Rome" });

export const formatDateTime = (at: number) => dateTime.format(at);
export const formatTime = (at: number) => time.format(at);
export const formatDate = (isoDate: string) => {
  const parsed = Date.parse(isoDate);
  return Number.isNaN(parsed) ? isoDate : date.format(parsed);
};
