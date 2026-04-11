export const NERD_ICONS = {
  home: "\uf015",
  search: "\uf002",
  pin: "\uf08d",
  liked: "\uf004",
  tracks: "\uf001",
  playlists: "\uf03a",
  quickLaunch: "\uf0e7",
  picked: "\uf005",
  album: "\uf07b",
  artist: "\uf007"
} as const;

export function iconLabel(icon: string, label: string): string {
  return `${icon} ${label}`;
}
