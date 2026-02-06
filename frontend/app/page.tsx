'use client'

import React from "react"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { startJob, validateGitHubUrl } from '@/lib/api'
import { AlertCircle } from 'lucide-react'

export default function Home() {
  const router = useRouter()
  const [repoUrl, setRepoUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [recentJobs, setRecentJobs] = useState<string[]>([])

  useEffect(() => {
    const stored = localStorage.getItem('autopatch_recent_jobs')
    if (stored) {
      setRecentJobs(JSON.parse(stored))
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!repoUrl.trim()) {
      setError('Please enter a repository URL')
      return
    }

    if (!validateGitHubUrl(repoUrl)) {
      setError('Please enter a valid GitHub URL (https://github.com/owner/repo)')
      return
    }

    setLoading(true)
    try {
      const { job_id } = await startJob(repoUrl)

      // Update recent jobs
      const updated = [job_id, ...recentJobs].slice(0, 5)
      localStorage.setItem('autopatch_recent_jobs', JSON.stringify(updated))

      router.push(`/jobs/${job_id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start job')
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="container max-w-2xl mx-auto px-4 py-16">
        {/* Header */}
        <div className="mb-16 text-center space-y-4">
          <div className="inline-block">
            <span className="text-xs font-semibold text-accent uppercase tracking-wider">GitHub Automation</span>
          </div>
          <h1 className="text-5xl font-bold text-foreground leading-tight">
            Autopatch
          </h1>
          <p className="text-xl text-muted-foreground leading-relaxed max-w-lg mx-auto">
            Paste a repo URL → Autopatch opens a PR with verified fixes
          </p>
        </div>

        {/* Main Card */}
        <Card className="mb-12 border border-border">
          <CardHeader className="pb-6">
            <CardTitle className="text-2xl">Start a New Job</CardTitle>
            <CardDescription className="text-base">
              Enter your GitHub repository URL to begin automated patching
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-3">
                <label htmlFor="repo-url" className="text-sm font-semibold text-foreground">
                  GitHub Repository URL
                </label>
                <Input
                  id="repo-url"
                  type="url"
                  placeholder="https://github.com/owner/repo"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  disabled={loading}
                  className="text-base h-12"
                />
              </div>

              {error && (
                <Alert variant="destructive" className="bg-red-500/10 border-red-500/30">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 text-base font-semibold"
                size="lg"
              >
                {loading ? 'Starting Job...' : 'Start Job'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Recent Jobs */}
        {recentJobs.length > 0 && (
          <Card className="border border-border">
            <CardHeader className="pb-6">
              <CardTitle className="text-lg">Recent Jobs</CardTitle>
              <CardDescription>Quick access to your recent patching jobs</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentJobs.map((jobId) => (
                  <button
                    key={jobId}
                    onClick={() => router.push(`/jobs/${jobId}`)}
                    className="w-full text-left p-4 rounded-lg bg-secondary hover:bg-secondary/80 transition-all duration-200 text-sm font-mono text-foreground border border-border hover:border-accent/50"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Job ID:</span>
                      <span className="text-accent font-semibold">{jobId}</span>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  )
}
