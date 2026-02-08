'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { Artifact, getArtifactContent } from '@/lib/api'
import {
  Copy,
  Check,
  AlertCircle,
  Search,
  FileText,
  FileJson,
  FileCode2,
  FileDiff,
  FileKey2,
  Folder,
  Download,
  Sparkles,
} from 'lucide-react'

interface ArtifactsViewerProps {
  artifacts: Artifact[]
  jobId: string
  loading: boolean
}

type GroupKey = 'Core' | 'Patches' | 'Other'

const coreFiles = ['ai.project.yml', 'scan.json', 'readiness_report.md', 'patch_summary.md', '.env.example'] as const

function formatKB(bytes: number) {
  return `${(bytes / 1024).toFixed(1)} KB`
}

function extOf(name: string) {
  const parts = name.split('.')
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : ''
}

function fileIcon(name: string) {
  const ext = extOf(name)
  if (name.endsWith('.env.example') || name.includes('.env')) return FileKey2
  if (name.endsWith('.md')) return FileText
  if (name.endsWith('.json')) return FileJson
  if (name.endsWith('.yml') || name.endsWith('.yaml')) return FileCode2
  if (name.endsWith('.diff') || name.includes('patch')) return FileDiff
  return FileCode2
}

function groupFor(name: string): GroupKey {
  if (coreFiles.includes(name as any)) return 'Core'
  if (name.startsWith('patches/')) return 'Patches'
  return 'Other'
}

export function ArtifactsViewer({ artifacts, jobId, loading }: ArtifactsViewerProps) {
  const [selected, setSelected] = useState<Artifact | null>(null)
  const [content, setContent] = useState<string | null>(null)
  const [contentLoading, setContentLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [query, setQuery] = useState('')
  const [activeGroup, setActiveGroup] = useState<GroupKey | 'All'>('All')

  const listRef = useRef<HTMLDivElement>(null)

  const grouped = useMemo(() => {
    const g: Record<GroupKey, Artifact[]> = { Core: [], Patches: [], Other: [] }
    for (const a of artifacts) g[groupFor(a.name)].push(a)
    // Optional: keep stable ordering
    for (const k of Object.keys(g) as GroupKey[]) {
      g[k].sort((a, b) => a.name.localeCompare(b.name))
    }
    return g
  }, [artifacts])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const pick = (arr: Artifact[]) =>
      q ? arr.filter((a) => a.name.toLowerCase().includes(q)) : arr

    if (activeGroup === 'All') {
      return {
        Core: pick(grouped.Core),
        Patches: pick(grouped.Patches),
        Other: pick(grouped.Other),
      }
    }
    return {
      Core: activeGroup === 'Core' ? pick(grouped.Core) : [],
      Patches: activeGroup === 'Patches' ? pick(grouped.Patches) : [],
      Other: activeGroup === 'Other' ? pick(grouped.Other) : [],
    }
  }, [grouped, query, activeGroup])

  const totalCount = artifacts.length
  const filteredCount = filtered.Core.length + filtered.Patches.length + filtered.Other.length

  // Auto-select first artifact when list arrives (nice UX)
  useEffect(() => {
    if (!selected && artifacts.length > 0) {
      setSelected(artifacts[0])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artifacts.length])

  // Load selected content
  useEffect(() => {
    let cancelled = false

    const load = async () => {
      if (!selected) {
        setContent(null)
        setError(null)
        return
      }
      setContentLoading(true)
      setError(null)
      try {
        const text = await getArtifactContent(jobId, selected.name)
        if (cancelled) return
        setContent(text)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to load artifact')
        setContent(null)
      } finally {
        if (!cancelled) setContentLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [selected, jobId])

  const handleCopy = async () => {
    if (!content) return
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handleDownload = () => {
    if (!content || !selected) return
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = selected.name.split('/').pop() || selected.name
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const isMarkdown = selected?.name.endsWith('.md')
  const Icon = selected ? fileIcon(selected.name) : Folder

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
    <Card className="flex flex-col h-full border border-border overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              Artifacts
              <Badge variant="outline" className="bg-muted/40">
                {filteredCount}/{totalCount}
              </Badge>
            </CardTitle>
            <CardDescription>Generated files, reports, and patches</CardDescription>
          </div>

          <Badge variant="outline" className="bg-muted/40 flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            AutoPatch
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex gap-4 overflow-hidden">
        {/* Sidebar */}
        <div className="w-72 border-r border-border pr-4 overflow-hidden flex flex-col">
          {/* Search */}
          <div className="mb-3">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search artifacts…"
                className="pl-9"
              />
            </div>

            <div className="mt-3 flex items-center gap-2 flex-wrap">
              {(['All', 'Core', 'Patches', 'Other'] as const).map((g) => (
                <Button
                  key={g}
                  size="sm"
                  variant={activeGroup === g ? 'secondary' : 'ghost'}
                  className={cn(
                    'h-8 px-3',
                    activeGroup === g ? 'bg-secondary border border-border' : ''
                  )}
                  onClick={() => setActiveGroup(g)}
                >
                  {g}
                </Button>
              ))}
            </div>
          </div>

          <Separator className="mb-3" />

          {/* List */}
          <div ref={listRef} className="flex-1 overflow-y-auto space-y-4 pr-1">
            {totalCount === 0 ? (
              <p className="text-sm text-muted-foreground">No artifacts yet</p>
            ) : (
              <>
                {(['Core', 'Patches', 'Other'] as GroupKey[]).map((groupName) => {
                  const items = filtered[groupName]
                  if (items.length === 0) return null
                  return (
                    <div key={groupName}>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase">
                          {groupName}
                        </h4>
                        <Badge variant="outline" className="bg-muted/40 text-xs">
                          {items.length}
                        </Badge>
                      </div>

                      <div className="space-y-1">
                        {items.map((a) => {
                          const ActiveIcon = fileIcon(a.name)
                          const active = selected?.name === a.name
                          return (
                            <motion.button
                              key={a.name}
                              whileHover={{ scale: 1.01 }}
                              whileTap={{ scale: 0.99 }}
                              onClick={() => setSelected(a)}
                              className={cn(
                                'w-full text-left px-3 py-2 rounded-md border transition-all',
                                active
                                  ? 'bg-accent/15 text-accent border-accent/30'
                                  : 'hover:bg-secondary text-foreground border-transparent'
                              )}
                            >
                              <div className="flex items-start gap-2">
                                <div className="mt-0.5">
                                  <ActiveIcon className={cn('h-4 w-4', active ? 'text-accent' : 'text-muted-foreground')} />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="truncate font-mono text-xs">{a.name}</div>
                                  <div className="text-xs text-muted-foreground">{formatKB(a.size)}</div>
                                </div>
                              </div>
                            </motion.button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </>
            )}
          </div>
        </div>

        {/* Preview */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {selected ? (
            <>
              <div className="flex items-center justify-between gap-3 mb-4 pb-4 border-b border-border">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-lg border border-border bg-secondary flex items-center justify-center">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="font-mono px-2 py-1">
                        {selected.name}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{formatKB(selected.size)}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {extOf(selected.name) ? extOf(selected.name).toUpperCase() : 'FILE'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDownload}
                    disabled={!content}
                    title="Download"
                  >
                    <Download className="w-4 h-4" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopy}
                    disabled={!content}
                    title="Copy"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              {error ? (
                <Alert variant="destructive" className="mb-3 bg-red-500/10 border-red-500/30">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}

              {contentLoading ? (
                <div className="space-y-2">
                  <div className="h-4 bg-muted rounded animate-pulse" />
                  <div className="h-4 bg-muted rounded animate-pulse" />
                  <div className="h-4 bg-muted rounded w-3/4 animate-pulse" />
                </div>
              ) : content ? (
                <Tabs defaultValue="raw" className="flex-1 overflow-hidden flex flex-col">
                  <TabsList className="w-fit">
                    <TabsTrigger value="preview" disabled={!isMarkdown}>
                      Preview
                    </TabsTrigger>
                    <TabsTrigger value="raw">Raw</TabsTrigger>
                  </TabsList>

                  <TabsContent value="preview" className="flex-1 overflow-auto mt-3">
                    {isMarkdown ? (
                      <div className="prose prose-sm prose-invert max-w-none text-sm">
                        <ReactMarkdown>{content}</ReactMarkdown>
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        Preview available for Markdown only.
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="raw" className="flex-1 overflow-auto mt-3">
                    <pre className="bg-secondary rounded border border-border p-4 overflow-auto text-xs font-mono leading-relaxed text-foreground">
                      {content}
                    </pre>
                  </TabsContent>
                </Tabs>
              ) : (
                <div className="text-muted-foreground">No content</div>
              )}
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
