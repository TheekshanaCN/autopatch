const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

const UI_KEY = process.env.NEXT_PUBLIC_AUTOPATCH_UI_KEY || "";

function authHeaders(extra?: Record<string, string>) {
  return {
    ...(UI_KEY ? { "X-Autopatch-Key": UI_KEY } : {}),
    ...(extra || {}),
  };
}

async function fetchTextOrThrow(res: Response) {
  if (res.ok) return;
  const txt = await res.text().catch(() => "");
  throw new Error(txt || `Request failed (${res.status})`);
}

export interface JobStatus {
  job_id: string;
  state: "RUNNING" | "SUCCESS" | "FAILED";
  step: "CLONING" | "DETECTING" | "COMPILING" | "BUILDING" | "PATCHING" | "DONE";
  message: string;
}

export interface JobLogs {
  job_id: string;
  logs: string;
}

export interface Artifact {
  name: string;
  size: number;
}

export interface ArtifactsList {
  job_id: string;
  artifacts: Artifact[];
}

export async function startJob(repoUrl: string): Promise<{ job_id: string }> {
  const res = await fetch(`${API_BASE_URL}/jobs`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ repo_url: repoUrl }),
  });

  await fetchTextOrThrow(res);
  return res.json();
}

export async function getJobStatus(jobId: string): Promise<JobStatus> {
  const res = await fetch(`${API_BASE_URL}/jobs/${jobId}`, {
    headers: authHeaders(),
  });

  await fetchTextOrThrow(res);
  return res.json();
}

export async function getJobLogs(jobId: string): Promise<JobLogs> {
  const res = await fetch(`${API_BASE_URL}/jobs/${jobId}/logs`, {
    headers: authHeaders(),
  });

  await fetchTextOrThrow(res);
  return res.json();
}

export async function getArtifactsList(jobId: string): Promise<ArtifactsList> {
  const res = await fetch(`${API_BASE_URL}/jobs/${jobId}/artifacts`, {
    headers: authHeaders(),
  });

  await fetchTextOrThrow(res);
  return res.json();
}

export async function getArtifactContent(
  jobId: string,
  artifactPath: string
): Promise<string> {
  const res = await fetch(
    `${API_BASE_URL}/jobs/${jobId}/artifacts/${artifactPath}`,
    { headers: authHeaders() }
  );

  await fetchTextOrThrow(res);
  return res.text();
}

export function extractPRUrl(message: string): string | null {
  const match = message.match(/https:\/\/github\.com\/[\w-]+\/[\w-]+\/pull\/\d+/);
  return match ? match[0] : null;
}

export function validateGitHubUrl(url: string): boolean {
  return /^https:\/\/github\.com\/[\w-]+\/[\w-]+\/?$/.test(url);
}
