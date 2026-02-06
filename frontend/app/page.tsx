"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { startJob, validateGitHubUrl } from "@/lib/api";
import {
  AlertCircle,
  ArrowRight,
  Github,
  Link2,
  Sparkles,
  Copy,
  Check,
  ExternalLink,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function Home() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [repoUrl, setRepoUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [recentJobs, setRecentJobs] = useState<string[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const examples = useMemo(
    () => ["https://github.com/TheekshanaCN/autopatch-demo-missing-import"],
    [],
  );

  useEffect(() => {
    const stored = localStorage.getItem("autopatch_recent_jobs");
    if (stored) setRecentJobs(JSON.parse(stored));
  }, []);

  // Optional: Ctrl/Cmd+K focuses input
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isK = e.key.toLowerCase() === "k";
      if ((e.ctrlKey || e.metaKey) && isK) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const normalizeUrl = (v: string) => {
    let s = v.trim();
    if (!s) return s;

    // allow "github.com/owner/repo"
    if (s.startsWith("github.com/")) s = `https://${s}`;

    // allow "owner/repo"
    if (!s.includes("://") && s.split("/").length === 2) {
      s = `https://github.com/${s}`;
    }

    // remove trailing .git (we still accept it)
    if (s.endsWith(".git")) s = s.slice(0, -4);

    // remove trailing slashes
    s = s.replace(/\/+$/, "");

    return s;
  };

  const handlePasteSmart = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const next = normalizeUrl(text);
      if (next) setRepoUrl(next);
      setTimeout(() => inputRef.current?.focus(), 0);
    } catch {
      // ignore (clipboard may be blocked)
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const url = normalizeUrl(repoUrl);
    setRepoUrl(url);

    if (!url) {
      setError("Please enter a repository URL");
      return;
    }
    if (!validateGitHubUrl(url)) {
      setError(
        "Please enter a valid GitHub URL (https://github.com/owner/repo)",
      );
      return;
    }

    setLoading(true);
    try {
      const { job_id } = await startJob(url);

      const updated = [job_id, ...recentJobs.filter((x) => x !== job_id)].slice(
        0,
        6,
      );
      localStorage.setItem("autopatch_recent_jobs", JSON.stringify(updated));
      setRecentJobs(updated);

      router.push(`/jobs/${job_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start job");
      setLoading(false);
    }
  };

  const copyJobId = async (jobId: string) => {
    try {
      await navigator.clipboard.writeText(jobId);
      setCopiedId(jobId);
      setTimeout(() => setCopiedId(null), 1200);
    } catch {
      // ignore
    }
  };

  return (
    <main className="min-h-screen bg-background">
      {/* Hero glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 left-1/2 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-accent/10 blur-3xl" />
        <div className="absolute top-40 left-1/2 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-blue-500/10 blur-3xl" />
      </div>

      <div className="relative container max-w-3xl mx-auto px-4 py-16">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="mb-12 text-center space-y-4"
        >
          <div className="flex items-center justify-center gap-2">
            <Badge variant="outline" className="bg-muted/40">
              <Sparkles className="h-3.5 w-3.5 mr-1" />
              Powered by Gemini 3 Pro
            </Badge>
            <Badge variant="outline" className="bg-muted/40">
              <Sparkles className="h-3.5 w-3.5 mr-1" />
              GitHub Automation
            </Badge>
            <Badge variant="outline" className="bg-muted/40">
              <Github className="h-3.5 w-3.5 mr-1" />
              PR-based fixes
            </Badge>
          </div>

          <h1 className="text-5xl font-bold text-foreground leading-tight">
            Autopatch
          </h1>

          <p className="text-lg text-muted-foreground leading-relaxed max-w-xl mx-auto">
            Paste a repository URL → Autopatch builds, fixes, and opens a Pull
            Request with verified changes.
          </p>

          <div className="text-xs text-muted-foreground">
            Tip: Press <span className="font-mono">Ctrl</span>/
            <span className="font-mono">⌘</span>+
            <span className="font-mono">K</span> to focus the input
          </div>
        </motion.div>

        {/* Main Card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.05 }}
        >
          <Card className="mb-10 border border-border overflow-hidden">
            <CardHeader className="pb-5">
              <CardTitle className="text-2xl flex items-center gap-2">
                Start a New Job
                {loading ? (
                  <Badge
                    variant="outline"
                    className="bg-blue-500/10 text-blue-300 border-blue-500/25"
                  >
                    Running…
                  </Badge>
                ) : null}
              </CardTitle>
              <CardDescription className="text-base">
                Enter a GitHub repository URL. Autopatch will run checks and
                create a PR.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <label
                    htmlFor="repo-url"
                    className="text-sm font-semibold text-foreground"
                  >
                    GitHub Repository URL
                  </label>

                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Link2 className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        ref={inputRef}
                        id="repo-url"
                        type="url"
                        placeholder="https://github.com/owner/repo"
                        value={repoUrl}
                        onChange={(e) => setRepoUrl(e.target.value)}
                        disabled={loading}
                        className="text-base h-12 pl-9"
                        autoComplete="off"
                      />
                    </div>

                    <Button
                      type="button"
                      variant="secondary"
                      className="h-12 px-4"
                      disabled={loading}
                      onClick={handlePasteSmart}
                      title="Paste from clipboard"
                    >
                      Paste
                    </Button>
                  </div>

                  {/* Examples */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {examples.map((x) => (
                      <Button
                        key={x}
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={loading}
                        onClick={() => {
                          setRepoUrl(x);
                          setTimeout(() => inputRef.current?.focus(), 0);
                        }}
                        className="
    h-8 px-3
    bg-secondary/40
    border-amber-400/60
    text-amber-300
    hover:bg-amber-400
    hover:border-amber-400
    focus-visible:ring-amber-400/40
  "
                        title="Use example"
                      >
                        <ExternalLink className="h-3.5 w-3.5 mr-2" />
                        Use Example Repo
                      </Button>
                    ))}
                  </div>
                </div>

                {error ? (
                  <Alert
                    variant="destructive"
                    className="bg-red-500/10 border-red-500/30"
                  >
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                ) : null}

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 text-base font-semibold"
                  size="lg"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-pulse">Starting…</span>
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      Start Job
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  )}
                </Button>
              </form>

              <Separator className="my-6" />

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <div className="rounded-lg border border-border bg-secondary/40 p-4">
                  <div className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">
                    Step 1
                  </div>
                  <div className="mt-1 text-foreground font-medium">
                    Clone & detect
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-secondary/40 p-4">
                  <div className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">
                    Step 2
                  </div>
                  <div className="mt-1 text-foreground font-medium">
                    Patch & build
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-secondary/40 p-4">
                  <div className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">
                    Step 3
                  </div>
                  <div className="mt-1 text-foreground font-medium">
                    Open PR
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Jobs */}
        {recentJobs.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.1 }}
          >
            <Card className="border border-border">
              <CardHeader className="pb-5">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  Recent Jobs
                </CardTitle>
                <CardDescription>Jump back into a previous run</CardDescription>
              </CardHeader>

              <CardContent>
                <div className="space-y-2">
                  {recentJobs.map((jobId) => (
                    <div
                      key={jobId}
                      className={cn(
                        "w-full p-4 rounded-lg border border-border bg-secondary/40",
                        "flex items-center justify-between gap-3",
                      )}
                    >
                      <div className="min-w-0">
                        <div className="text-xs text-muted-foreground">
                          Job ID
                        </div>
                        <div className="font-mono text-sm text-foreground truncate">
                          {jobId}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyJobId(jobId)}
                          title="Copy Job ID"
                        >
                          {copiedId === jobId ? (
                            <Check className="h-4 w-4 text-emerald-400" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>

                        <Button
                          variant="secondary"
                          onClick={() => router.push(`/jobs/${jobId}`)}
                          className="gap-2"
                        >
                          Open
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ) : null}

        {/* Footer hint */}
        <div className="mt-10 text-center text-xs text-muted-foreground">
          Autopatch will only create a PR — your main branch stays untouched.
        </div>
      </div>
    </main>
  );
}
