export function openUrl(url: string): boolean {
  const platform = process.platform;
  const command =
    platform === "darwin"
      ? ["open", url]
      : platform === "win32"
        ? ["cmd", "/c", "start", "", url]
        : ["xdg-open", url];

  try {
    const result = Bun.spawnSync(command, {
      stdin: "ignore",
      stdout: "ignore",
      stderr: "ignore"
    });

    return result.exitCode === 0;
  } catch {
    return false;
  }
}
