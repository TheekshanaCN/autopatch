'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Artifact, getArtifactContent } from '@/lib/api'
import { Copy, Check, AlertCircle } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

interface ArtifactsViewerProps {
  artifacts: Artifact[]
  jobId: string
  loading: boolean
}

interface GroupedArtifacts {
  Core: Artifact[]
  Patches: Artifact[]
  Other: Artifact[]
}

export function ArtifactsViewer({ artifacts, jobId, loading }: ArtifactsViewerProps) {
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null)
  const [content, setContent] = useState<string | null>(null)
  const [contentLoading, setContentLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Group artifacts
  const grouped: GroupedArtifacts = {
    Core: [],
    Patches: [],
    Other: [],
  }

  const coreFiles = ['ai.project.yml', 'scan.json', 'readiness_report.md', 'patch_summary.md', '.env.example']
  artifacts.forEach((artifact) => {
    if (coreFiles.includes(artifact.name)) {
      grouped.Core.push(artifact)
    } else if (artifact.name.startsWith('patches/')) {
      grouped.Patches.push(artifact)
    } else {
      grouped.Other.push(artifact)
    }
  })

  // Load artifact content when selected
  useEffect(() => {
    if (!selectedArtifact) {
      setContent(null)
      setError(null)
      return
    }

    const loadContent = async () => {
      setContentLoading(true)
      setError(null)
      try {
        const text = await getArtifactContent(jobId, selectedArtifact.name)
        setContent(text)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load artifact')
        setContent(null)
      } finally {
        setContentLoading(false)
      }
    }

    loadContent()
  }, [selectedArtifact, jobId])

  const handleCopy = async () => {
    if (!content) return
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const isMarkdown = selectedArtifact?.name.endsWith('.md')

  if (loading) {
    return (
      <Card className="flex flex-col h-full border border-border">
        <CardHeader>
          <CardTitle>Artifacts</CardTitle>
          <CardDescription>Generated files and patches</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="h-6 bg-muted rounded w-32 animate-pulse" />
          <div className="space-y-2">
            <div className="h-8 bg-muted rounded animate-pulse" />
            <div className="h-8 bg-muted rounded animate-pulse" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="flex flex-col h-full border border-border">
      <CardHeader className="pb-4">
        <CardTitle className="text-xl">Artifacts</CardTitle>
        <CardDescription>Generated files and patches</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex gap-4 overflow-hidden">
        {/* Artifacts list */}
        <div className="w-56 border-r border-border pr-4 overflow-y-auto space-y-4">
          {artifacts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No artifacts yet</p>
          ) : (
            <>
              {grouped.Core.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase">Core</h4>
                  <div className="space-y-1">
                    {grouped.Core.map((artifact) => (
                      <button
                        key={artifact.name}
                        onClick={() => setSelectedArtifact(artifact)}
                        className={`w-full text-left px-3 py-2 rounded text-sm transition-all duration-200 ${
                          selectedArtifact?.name === artifact.name
                            ? 'bg-accent/20 text-accent border border-accent/30'
                            : 'hover:bg-secondary text-foreground border border-transparent'
                        }`}
                      >
                        <div className="truncate font-mono text-xs">{artifact.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {(artifact.size / 1024).toFixed(1)} KB
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {grouped.Patches.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase">
                    Patches
                  </h4>
                  <div className="space-y-1">
                    {grouped.Patches.map((artifact) => (
                      <button
                        key={artifact.name}
                        onClick={() => setSelectedArtifact(artifact)}
                        className={`w-full text-left px-3 py-2 rounded text-sm transition-all duration-200 ${
                          selectedArtifact?.name === artifact.name
                            ? 'bg-accent/20 text-accent border border-accent/30'
                            : 'hover:bg-secondary text-foreground border border-transparent'
                        }`}
                      >
                        <div className="truncate font-mono text-xs">{artifact.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {(artifact.size / 1024).toFixed(1)} KB
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {grouped.Other.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase">
                    Other
                  </h4>
                  <div className="space-y-1">
                    {grouped.Other.map((artifact) => (
                      <button
                        key={artifact.name}
                        onClick={() => setSelectedArtifact(artifact)}
                        className={`w-full text-left px-3 py-2 rounded text-sm transition-all duration-200 ${
                          selectedArtifact?.name === artifact.name
                            ? 'bg-accent/20 text-accent border border-accent/30'
                            : 'hover:bg-secondary text-foreground border border-transparent'
                        }`}
                      >
                        <div className="truncate font-mono text-xs">{artifact.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {(artifact.size / 1024).toFixed(1)} KB
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Content viewer */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {selectedArtifact ? (
            <>
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="font-mono px-2 py-1">
                    {selectedArtifact.name}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {(selectedArtifact.size / 1024).toFixed(1)} KB
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopy}
                  disabled={!content}
                  title="Copy content to clipboard"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>

              {error && (
                <Alert variant="destructive" className="mb-3 bg-red-500/10 border-red-500/30">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {contentLoading ? (
                <div className="space-y-2">
                  <div className="h-4 bg-muted rounded animate-pulse" />
                  <div className="h-4 bg-muted rounded animate-pulse" />
                  <div className="h-4 bg-muted rounded w-3/4 animate-pulse" />
                </div>
              ) : content ? (
                <div className="flex-1 overflow-auto">
                  {isMarkdown ? (
                    <div className="prose prose-sm prose-invert max-w-none text-sm">
                      <ReactMarkdown>{content}</ReactMarkdown>
                    </div>
                  ) : (
                    <pre className="bg-secondary rounded border border-border p-4 overflow-auto text-xs font-mono leading-relaxed text-foreground">
                      {content}
                    </pre>
                  )}
                </div>
              ) : null}
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Select an artifact to view
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
