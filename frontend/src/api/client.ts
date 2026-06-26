const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

export type Layer = { key: string; label: string; color: string; enabled: boolean };
export type Project = {
  id: string; name: string; location: string; code: string;
  status: string; sync_state: string; progress: number; deviation_mm: number;
  image_url: string; layers: Layer[]; open_issues: number; created_at: string;
};
export type Issue = {
  id: string; project_id: string; ref: string; title: string; description: string;
  tag: string; status: string; location_label: string; photo_b64?: string | null;
  author: string; created_at: string;
};
export type Activity = {
  id: string; project_id: string; kind: string; author: string;
  message: string; anchor: string; created_at: string;
};

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`API ${res.status}: ${txt}`);
  }
  return res.json();
}

export const api = {
  listProjects: () => req<Project[]>("/projects"),
  getProject: (id: string) => req<Project>(`/projects/${id}`),
  projectIssues: (id: string) => req<Issue[]>(`/projects/${id}/issues`),
  projectActivity: (id: string) => req<Activity[]>(`/projects/${id}/activity`),
  createIssue: (body: Partial<Issue>) =>
    req<Issue>("/issues", { method: "POST", body: JSON.stringify(body) }),
  updateIssue: (id: string, body: Record<string, unknown>) =>
    req<Issue>(`/issues/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  getIssue: (id: string) => req<Issue>(`/issues/${id}`),
  createActivity: (body: Partial<Activity>) =>
    req<Activity>("/activity", { method: "POST", body: JSON.stringify(body) }),
};
