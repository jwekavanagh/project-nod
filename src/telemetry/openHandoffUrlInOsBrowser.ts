import { spawn } from "node:child_process";
import { platform } from "node:os";

/**
 * Best-effort OS default browser open (user sees the handoff URL).
 * Resolves when the child exits (success not guaranteed across platforms).
 */
export function openHandoffUrlInOsBrowser(url: string): Promise<{ ok: boolean; code: number | null }> {
  return new Promise((resolve) => {
    const p = platform();
    let child;
    if (p === "darwin") {
      child = spawn("open", [url], { stdio: "ignore", detached: true });
    } else if (p === "win32") {
      child = spawn("cmd", ["/c", "start", "", url], { stdio: "ignore", detached: true, windowsHide: true });
    } else {
      child = spawn("xdg-open", [url], { stdio: "ignore", detached: true });
    }
    child.on("error", () => resolve({ ok: false, code: null }));
    child.on("close", (code) => resolve({ ok: code === 0, code }));
  });
}
