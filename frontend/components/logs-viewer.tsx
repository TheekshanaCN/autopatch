'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import {
  Copy,
  Check,
  GitBranch,
  GitPullRequest,
  Bot,
  Wrench,
  Terminal,
  Package,
  ScanSearch,
  Info,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

interface LogsViewerProps {
  logs: string | null
  loading: boolean
}

type EventType =
  | 'git'
  | 'scan'
  | 'ai'
  | 'build'
  | 'error'
  | 'patch'
  | 'pr'
  | 'info'
  | 'cmd'
  | 'install'
  | 'success'
  | 'unknown'

type LogEvent = {
  id: string
  type: EventType
  title: string
  detail?: string
  raw: string
  href?: string
}

function pickEventType(line: string): EventType {
  const s = line.trim()

  if (s.startsWith('$ ')) return 'cmd'
  if (s.startsWith('[git]')) return 'git'
  if (s.startsWith('[scan]')) return 'scan'
  if (s.startsWith('[ai]')) return 'ai'
  if (s.startsWith('[patch]')) return 'patch'
  if (s.startsWith('[pr]')) return 'pr'
  if (s.startsWith('[info]')) return 'info'
  if (s.includes('npm install') || s.includes('added ') || s.includes('audited ')) return 'install'
  if (/error TS\d+:/i.test(s) || s.includes('error ') || s.includes('ERR!')) return 'error'
  if (s.includes('found 0 vulnerabilities') || s.includes('patch #') && s.includes('applied')) return 'success'
  if (s.includes('> ') || s.includes('tsc') || s.includes('build')) return 'build'

  return 'unknown'
}

function iconFor(type: EventType) {
  switch (type) {
    case 'cmd':
      return Terminal
    case 'git':
      return GitBranch
    case 'scan':
      return ScanSearch
    case 'ai':
      return Bot
    case 'install':
      return Package
    case 'build':
      return Wrench
    case 'error':
      return AlertTriangle
    case 'patch':
      return Sparkles
    case 'pr':
      return GitPullRequest
    case 'success':
      return CheckCircle2
    case 'info':
      return Info
    default:
      return Terminal
  }
}

function toneFor(type: EventType) {
  // Tailwind classes only (works with shadcn themes)
  switch (type) {
    case 'error':
      return {
        dot: 'bg-destructive',
        ring: 'ring-destructive/30',
        badge: 'bg-destructive/10 text-destructive border-destructive/20',
      }
    case 'success':
      return {
        dot: 'bg-emerald-500',
        ring: 'ring-emerald-500/30',
        badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      }
    case 'ai':
      return {
        dot: 'bg-violet-500',
        ring: 'ring-violet-500/30',
        badge: 'bg-violet-500/10 text-violet-300 border-violet-500/20',
      }
    case 'patch':
      return {
        dot: 'bg-amber-500',
        ring: 'ring-amber-500/30',
        badge: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
      }
    case 'pr':
      return {
        dot: 'bg-sky-500',
        ring: 'ring-sky-500/30',
        badge: 'bg-sky-500/10 text-sky-300 border-sky-500/20',
      }
    case 'git':
    case 'scan':
    case 'install':
    case 'build':
    case 'info':
    case 'cmd':
    default:
      return {
        dot: 'bg-muted-foreground',
        ring: 'ring-muted-foreground/20',
        badge: 'bg-muted/40 text-muted-foreground border-border',
      }
  }
}

function titleFromLine(type: EventType, line: string) {
  const s = line.trim()

  if (type === 'cmd') return 'Command'
  if (type === 'git') return 'Git'
  if (type === 'scan') return 'Scan'
  if (type === 'ai') return 'AI'
  if (type === 'install') return 'Install'
  if (type === 'build') return 'Build'
  if (type === 'patch') return 'Patch'
  if (type === 'pr') return 'Pull Request'
  if (type === 'info') return 'Info'
  if (type === 'error') return 'Error'
  if (type === 'success') return 'Success'

  // fallback
  if (s.startsWith('> ')) return 'Script'
  return 'Log'
}

function extractPRLink(line: string) {
  const m = line.match(/https?:\/\/\S+/)
  return m?.[0]
}

function parseLogsToEvents(logs: string): LogEvent[] {
  const lines = logs.split('\n').filter(Boolean)

  const events: LogEvent[] = []
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const type = pickEventType(raw)
    const title = titleFromLine(type, raw)

    // Clean detail text a bit
    const detail = raw
      .replace(/^\$ /, '')
      .replace(/^\[(git|scan|ai|patch|pr|info)\]\s*/i, '')
      .trim()

    const href = type === 'pr' ? extractPRLink(raw) : undefined

    events.push({
      id: `${i}-${type}`,
      type,
      title,
      detail,
      raw,
      href,
    })
  }

  // Optional: collapse noisy “added/audited” lines into one event group (simple version: keep as is)
  return events
}

export function LogsViewer({ logs, loading }: LogsViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const [copied, setCopied] = useState(false)
  const [showRaw, setShowRaw] = useState(false)

  const events = useMemo(() => (logs ? parseLogsToEvents(logs) : []), [logs])

  useEffect(() => {
    if (!autoScroll) return
    if (!scrollRef.current) return
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [events.length, autoScroll])

  const handleCopy = async () => {
    if (!logs) return
    try {
      await navigator.clipboard.writeText(logs)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy logs:', err)
    }
  }

  return (
    <Card className="flex flex-col h-full border border-border">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-xl flex items-center gap-2">
              Job Timeline
              {loading ? (
                <Badge variant="outline" className="bg-muted/40">
                  Running…
                </Badge>
              ) : logs ? (
                <Badge variant="outline" className="bg-muted/40">
                  Finished
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-muted/40">
                  Idle
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="truncate">
              Clean, readable steps — raw logs available if needed
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowRaw((v) => !v)}
              disabled={!logs}
              title="Toggle raw logs"
            >
              {showRaw ? (
                <>
                  <ChevronUp className="w-4 h-4 mr-2" />
                  Raw
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4 mr-2" />
                  Raw
                </>
              )}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              disabled={!logs}
              title="Copy logs to clipboard"
            >
              {copied ? (
                <Check className="w-4 h-4 text-emerald-400" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-3 mb-4 pb-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Checkbox
              id="auto-scroll"
              checked={autoScroll}
              onCheckedChange={(checked) => setAutoScroll(checked as boolean)}
            />
            <label
              htmlFor="auto-scroll"
              className="text-sm text-muted-foreground cursor-pointer"
            >
              Auto-scroll
            </label>
          </div>

          <div className="text-xs text-muted-foreground">
            {events.length ? `${events.length} events` : 'No events yet'}
          </div>
        </div>

        {/* Timeline */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-auto rounded-lg border border-border bg-secondary p-4"
        >
          {loading && !logs ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-1/3 animate-pulse" />
                    <div className="h-4 bg-muted rounded w-5/6 animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : events.length ? (
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

              <AnimatePresence initial={false}>
                {events.map((e, idx) => {
                  const Icon = iconFor(e.type)
                  const tone = toneFor(e.type)

                  return (
                    <motion.div
                      key={e.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.18 }}
                      className="relative pl-12 pr-2 py-3"
                    >
                      <div
                        className={cn(
                          'absolute left-0 top-4 h-8 w-8 rounded-full flex items-center justify-center',
                          'bg-background border border-border shadow-sm',
                          'ring-4',
                          tone.ring
                        )}
                      >
                        <div className={cn('absolute h-2 w-2 rounded-full', tone.dot)} />
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>

                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className={cn('border', tone.badge)}>
                              {e.title}
                            </Badge>
                            {idx === events.length - 1 && loading ? (
                              <Badge variant="outline" className="bg-muted/40">
                                Live
                              </Badge>
                            ) : null}
                          </div>

                          <div className="mt-2 text-sm text-foreground/90 break-words">
                            {e.href ? (
                              <a
                                href={e.href}
                                target="_blank"
                                rel="noreferrer"
                                className="underline underline-offset-4 hover:text-foreground"
                              >
                                {e.detail}
                              </a>
                            ) : (
                              e.detail
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
          ) : (
            <div className="text-muted-foreground">No logs yet…</div>
          )}

          {/* Raw logs (collapsible) */}
          {logs ? (
            <>
              <Separator className="my-4" />
              <AnimatePresence initial={false}>
                {showRaw ? (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.18 }}
                    className="overflow-hidden"
                  >
                    <div className="rounded-lg border border-border bg-background p-4">
                      <div className="text-xs text-muted-foreground mb-2">
                        Raw logs
                      </div>
                      <pre className="whitespace-pre-wrap break-words font-mono text-sm leading-relaxed">
                        {logs}
                      </pre>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
