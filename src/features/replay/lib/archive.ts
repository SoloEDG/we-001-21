import type { Session } from "../../../shared/types";
import { assertBattle } from "../../../shared/document";
import { migrateSession } from "../../../shared/migrate";
export function saveArchive(s: Session) {
  localStorage.setItem("we001-session", JSON.stringify(s));
}
export function loadArchive(): Session | null {
  try {
    const raw = localStorage.getItem("we001-session");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    const s = migrateSession(parsed);
    assertBattle(s.live);
    assertBattle(s.initial);
    if (!Array.isArray(s.events)) return null;
    for (const e of s.events) {
      assertBattle(e.before);
      assertBattle(e.after);
    }
    return s;
  } catch {
    return null;
  }
}
export function downloadArchive(s: Session) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(s, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "灰烬渡口-战斗记录.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
