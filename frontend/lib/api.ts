const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';

export interface JobStatus {
  job_id: string;
  state: 'RUNNING' | 'SUCCESS' | 'FAILED';
  step: 'CLONING' | 'DETECTING' | 'COMPILING' | 'BUILDING' | 'PATCHING' | 'DONE';
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
  const response = await fetch(`${API_BASE_URL}/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_url: repoUrl }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || 'Failed to start job');
  }

  return response.json();
}

export async function getJobStatus(jobId: string): Promise<JobStatus> {
  const response = await fetch(`${API_BASE_URL}/jobs/${jobId}`);

  if (!response.ok) {
    throw new Error('Failed to fetch job status');
  }

  return response.json();
}

export async function getJobLogs(jobId: string): Promise<JobLogs> {
  const response = await fetch(`${API_BASE_URL}/jobs/${jobId}/logs`);

  if (!response.ok) {
    throw new Error('Failed to fetch job logs');
  }

  return response.json();
}

export async function getArtifactsList(jobId: string): Promise<ArtifactsList> {
  const response = await fetch(`${API_BASE_URL}/jobs/${jobId}/artifacts`);

  if (!response.ok) {
    throw new Error('Failed to fetch artifacts list');
  }

  return response.json();
}

export async function getArtifactContent(jobId: string, artifactPath: string): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/jobs/${jobId}/artifacts/${artifactPath}`);

  if (!response.ok) {
    throw new Error('Failed to fetch artifact content');
  }

  return response.text();
}

export function extractPRUrl(message: string): string | null {
  const match = message.match(/https:\/\/github\.com\/[\w-]+\/[\w-]+\/pull\/\d+/);
  return match ? match[0] : null;
}

export function validateGitHubUrl(url: string): boolean {
  return /^https:\/\/github\.com\/[\w-]+\/[\w-]+\/?$/.test(url);
}
