/**
 * Remembers on the player's device which team they joined, with the secret
 * rejoin token, so a refresh or a dropped connection gets them back into the
 * same team (and score) automatically.
 */
export interface TeamSession {
  teamId: string;
  teamName: string;
  rejoinToken: string;
}

export function teamSessionKey(joinCode: string): string {
  return `serata-quiz:team:${joinCode.toUpperCase()}`;
}

export function parseTeamSession(raw: string | null): TeamSession | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<TeamSession>;
    if (typeof data.teamId === "string" && typeof data.teamName === "string" && typeof data.rejoinToken === "string") {
      return { teamId: data.teamId, teamName: data.teamName, rejoinToken: data.rejoinToken };
    }
  } catch {
    // corrupted value: treat as absent
  }
  return null;
}

// Storage can be unavailable (private mode, blocked site data): every access is best-effort.

export function loadTeamSession(joinCode: string): TeamSession | null {
  try {
    return parseTeamSession(window.localStorage.getItem(teamSessionKey(joinCode)));
  } catch {
    return null;
  }
}

export function saveTeamSession(joinCode: string, session: TeamSession): void {
  try {
    window.localStorage.setItem(teamSessionKey(joinCode), JSON.stringify(session));
  } catch {
    // ignore
  }
}

export function clearTeamSession(joinCode: string): void {
  try {
    window.localStorage.removeItem(teamSessionKey(joinCode));
  } catch {
    // ignore
  }
}
