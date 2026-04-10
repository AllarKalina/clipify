export function clipLine(value: string, width: number): string {
  if (width <= 0) {
    return "";
  }

  if (value.length <= width) {
    return value.padEnd(width, " ");
  }

  return `${value.slice(0, Math.max(0, width - 1))}…`;
}

export function formatDuration(ms: number): string {
  if (ms <= 0) {
    return "0:00";
  }

  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function formatProgress(progressMs: number, durationMs: number, width: number): string {
  if (width <= 0) {
    return "";
  }

  if (durationMs <= 0) {
    return "─".repeat(width);
  }

  const ratio = Math.max(0, Math.min(1, progressMs / durationMs));
  const filled = Math.max(1, Math.round(ratio * width));
  return `${"█".repeat(filled)}${"─".repeat(Math.max(0, width - filled))}`;
}
