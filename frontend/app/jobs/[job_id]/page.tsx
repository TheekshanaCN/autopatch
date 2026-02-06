"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  getJobStatus,
  getJobLogs,
  getArtifactsList,
  JobStatus,
  Artifact,
} from "@/lib/api";
import { StatusCard } from "@/components/status-card";
import { LogsViewer } from "@/components/logs-viewer";
import { ArtifactsViewer } from "@/components/artifacts-viewer";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import {
  Home,
  ArrowLeft,
  AlertCircle,
  Loader2,
  Radio,
  Clock,
  Package,
  ScrollText,
} from "lucide-react";

interface PageProps {
  params: Promise<{ job_id: string }>;
}

export default function JobPage({ params }: PageProps) {
  const router = useRouter();

  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<JobStatus | null>(null);
  const [logs, setLogs] = useState<string | null>(null);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);

  const [statusLoading, setStatusLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(true);
  const [artifactsLoading, setArtifactsLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Polling refs (prevents stale intervals)
  const stopPollingRef = useRef(false);

  // Extract job_id from params
  useEffect(() => {
    params.then((p) => setJobId(p.job_id));
  }, [params]);

  const isRunning = status?.state === "RUNNING";
  const isComplete = status?.state === "SUCCESS" || status?.state === "FAILED";

  const artifactsCount = artifacts.length;
  const logsCountHint = useMemo(() => {
    if (!logs) return 0;
    return logs.split("\n").filter(Boolean).length;
  }, [logs]);

  // Poll job status + logs
  useEffect(() => {
    if (!jobId) return;
    stopPollingRef.current = false;

    const pollOnce = async () => {
      try {
        const [s, l] = await Promise.all([
          getJobStatus(jobId),
          getJobLogs(jobId),
        ]);
        if (stopPollingRef.current) return;

        setStatus(s);
        setLogs(l.logs);
        setStatusLoading(false);
        setLogsLoading(false);
        setLastUpdated(new Date());

        // stop when complete
        if (s.state !== "RUNNING") stopPollingRef.current = true;
      } catch (err) {
        if (stopPollingRef.current) return;
        setError(
          err instanceof Error ? err.message : "Failed to fetch job data",
        );
        setStatusLoading(false);
        setLogsLoading(false);
      }
    };

    // initial
    pollOnce();

    const interval = setInterval(() => {
      if (stopPollingRef.current) return;
      pollOnce();
    }, 1000);

    return () => {
      stopPollingRef.current = true;
      clearInterval(interval);
    };
  }, [jobId]);

  // Fetch artifacts after completion
  useEffect(() => {
    if (!jobId || !status || status.state === "RUNNING") return;

    const fetchArtifacts = async () => {
      setArtifactsLoading(true);
      try {
        const data = await getArtifactsList(jobId);
        setArtifacts(data.artifacts);
      } catch (err) {
        console.error("Failed to fetch artifacts:", err);
      } finally {
        setArtifactsLoading(false);
      }
    };

    fetchArtifacts();
  }, [jobId, status]);

  if (!jobId) {
    return <div className="container mx-auto px-4 py-8">Loading…</div>;
  }

  return (
    <main className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <nav className="border-b border-border sticky top-0 bg-background/95 backdrop-blur z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/")}
              className="h-9 w-9"
              title="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-bold text-foreground">
                  Job Monitor
                </h1>

                {/* Live / Complete indicator */}
                {isRunning ? (
                  <Badge
                    variant="outline"
                    className="bg-blue-500/10 text-blue-300 border-blue-500/25"
                  >
                    <Radio className="h-3.5 w-3.5 mr-1 animate-pulse" />
                    Live
                  </Badge>
                ) : isComplete ? (
                  <Badge
                    variant="outline"
                    className={cn(
                      "border",
                      status?.state === "SUCCESS"
                        ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/25"
                        : "bg-red-500/10 text-red-300 border-red-500/25",
                    )}
                  >
                    {status?.state}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-muted/40">
                    Idle
                  </Badge>
                )}

                {/* Polling hint */}
                {isRunning ? (
                  <Badge
                    variant="outline"
                    className="bg-muted/30 text-muted-foreground border-border"
                  >
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                    Polling…
                  </Badge>
                ) : null}
              </div>

              <p className="text-xs text-muted-foreground font-mono truncate">
                {jobId}
              </p>

              {lastUpdated ? (
                <div className="mt-1 text-xs text-muted-foreground flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5" />
                  Updated {lastUpdated.toLocaleTimeString()}
                </div>
              ) : null}
            </div>
          </div>

          <Button
            variant="outline"
            onClick={() => router.push("/")}
            className="gap-2 h-10"
          >
            <Home className="w-4 h-4" />
            New Job
          </Button>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-6 flex-1 overflow-y-auto lg:overflow-y-auto">
        {error ? (
          <Alert className="mb-6 border-red-500/30 bg-red-500/10">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-red-300">
              {error}
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full min-h-0">
          {/* Status */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22 }}
            className="lg:col-span-1 order-2 lg:order-1"
          >
            <StatusCard status={status} loading={statusLoading} />
          </motion.div>

          {/* Logs + Artifacts */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: 0.05 }}
            className="lg:col-span-2 order-1 lg:order-2 min-h-0 min-w-0"
          >
            <Tabs defaultValue="logs" className="h-full flex flex-col min-h-0">
              <TabsList className="grid w-full grid-cols-2 bg-secondary mb-4 sticky top-0 z-10">
                <TabsTrigger value="logs" className="flex items-center gap-2">
                  <ScrollText className="h-4 w-4" />
                  <span>Logs</span>
                  {logsCountHint ? (
                    <Badge variant="outline" className="ml-1 bg-muted/40">
                      {logsCountHint}
                    </Badge>
                  ) : null}
                </TabsTrigger>

                <TabsTrigger
                  value="artifacts"
                  className="flex items-center gap-2"
                  disabled={
                    !isComplete && artifactsCount === 0 && artifactsLoading
                  }
                >
                  <Package className="h-4 w-4" />
                  <span>Artifacts</span>
                  {isComplete ? (
                    <Badge variant="outline" className="ml-1 bg-muted/40">
                      {artifactsLoading ? "…" : artifactsCount}
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="ml-1 bg-muted/30 text-muted-foreground border-border"
                    >
                      Locked
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="logs" className="flex-1 overflow-hidden mt-0 min-h-0">
                <LogsViewer logs={logs} loading={logsLoading} />
              </TabsContent>

              <TabsContent
                value="artifacts"
                className="flex-1 overflow-hidden mt-0 min-h-0"
              >
                {isComplete ? (
                  <ArtifactsViewer
                    artifacts={artifacts}
                    jobId={jobId}
                    loading={artifactsLoading}
                  />
                ) : (
                  <Card className="border border-border">
                    <CardHeader>
                      <CardTitle className="text-lg">Artifacts</CardTitle>
                      <CardDescription>
                        Artifacts will appear after the job finishes.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                      Keep this tab open — once the job completes, you’ll see
                      generated files and patches here.
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </motion.div>
        </div>
      </div>
    </main>
  );
}
