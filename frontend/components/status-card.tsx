'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { JobStatus, extractPRUrl } from '@/lib/api'
import {
  ExternalLink,
  GitBranch,
  Search,
  Hammer,
  Wrench,
  Sparkles,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react'

interface StatusCardProps {
  status: JobStatus | null
  loading: boolean
}

const stepLabels: Record<string, string> = {
  CLONING: 'Cloning Repository',
  DETECTING: 'Detecting Issues',
  COMPILING: 'Compiling Code',
  BUILDING: 'Building Project',
  PATCHING: 'Applying Patches',
  DONE: 'Complete',
}

const stepOrder = ['CLONING', 'DETECTING', 'COMPILING', 'BUILDING', 'PATCHING', 'DONE'] as const

const stateMeta: Record<
  string,
  { label: string; className: string; icon: any; dot: string; ring: string }
> = {
  RUNNING: {
    label: 'RUNNING',
    className: 'bg-blue-500/15 text-blue-300 border-blue-500/35',
    icon: Loader2,
    dot: 'bg-blue-400',
    ring: 'ring-blue-500/20',
  },
  SUCCESS: {
    label: 'SUCCESS',
    className: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35',
    icon: CheckCircle2,
    dot: 'bg-emerald-400',
    ring: 'ring-emerald-500/20',
  },
  FAILED: {
    label: 'FAILED',
    className: 'bg-red-500/15 text-red-300 border-red-500/35',
    icon: XCircle,
    dot: 'bg-red-400',
    ring: 'ring-red-500/20',
  },
}

const stepMeta: Record<string, { icon: any; tone: string }> = {
  CLONING: { icon: GitBranch, tone: 'text-sky-300' },
  DETECTING: { icon: Search, tone: 'text-violet-300' },
  COMPILING: { icon: Hammer, tone: 'text-amber-300' },
  BUILDING: { icon: Wrench, tone: 'text-amber-300' },
  PATCHING: { icon: Sparkles, tone: 'text-emerald-300' },
  DONE: { icon: CheckCircle2, tone: 'text-emerald-300' },
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

export function StatusCard({ status, loading }: StatusCardProps) {
  if (!status && loading) {
    return (
      <Card className="border border-border">
        <CardHeader>
          <CardTitle>Job Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-8 bg-secondary rounded animate-pulse" />
          <div className="space-y-2">
            <div className="h-6 bg-secondary rounded w-32 animate-pulse" />
            <div className="h-4 bg-secondary rounded w-48 animate-pulse" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!status) return null

  const prUrl = extractPRUrl(status.message)
  const isComplete = status.state === 'SUCCESS' || status.state === 'FAILED'
  const state = stateMeta[status.state] ?? stateMeta.RUNNING

  const currentIndex = useMemo(() => {
    const idx = stepOrder.indexOf(status.step as any)
    return idx >= 0 ? idx : 0
  }, [status.step])

  const progressPct = useMemo(() => {
    // DONE should be 100%, otherwise based on index (0..5)
    const max = stepOrder.length - 1
    const pct = (currentIndex / max) * 100
    return clamp(Math.round(pct), 0, 100)
  }, [currentIndex])

  const StateIcon = state.icon
  const CurrentStepIcon = stepMeta[status.step]?.icon ?? Wrench

  return (
    <Card className="border border-border sticky top-8 overflow-hidden">
      {/* top glow */}
      <div className={cn('h-1 w-full', status.state === 'FAILED' ? 'bg-red-500/60' : status.state === 'SUCCESS' ? 'bg-emerald-500/60' : 'bg-blue-500/60')} />

      <CardHeader className="pb-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-2xl flex items-center gap-2">
              Status
              {status.state === 'RUNNING' ? (
                <Badge variant="outline" className="bg-muted/40">
                  Live
                </Badge>
              ) : null}
            </CardTitle>
            <CardDescription className="text-xs font-mono truncate">
              {status.job_id}
            </CardDescription>
          </div>

          <Badge
            variant="outline"
            className={cn(
              'border font-semibold px-3 py-1 text-xs flex items-center gap-2',
              state.className
            )}
          >
            <span className={cn('h-2 w-2 rounded-full', state.dot)} />
            <StateIcon className={cn('h-4 w-4', status.state === 'RUNNING' ? 'animate-spin' : '')} />
            {state.label}
          </Badge>
        </div>

        {/* Progress */}
        <div className="mt-5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="uppercase tracking-wider font-semibold">Progress</span>
            <span className="font-mono">{progressPct}%</span>
          </div>

          <div className="mt-2 h-2 rounded-full bg-secondary border border-border overflow-hidden">
            <motion.div
              className={cn(
                'h-full rounded-full',
                status.state === 'FAILED'
                  ? 'bg-red-500/60'
                  : status.state === 'SUCCESS'
                    ? 'bg-emerald-500/60'
                    : 'bg-blue-500/60'
              )}
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
            />
          </div>

          <div className="mt-2 flex items-center gap-2 text-sm">
            <CurrentStepIcon className={cn('h-4 w-4', stepMeta[status.step]?.tone ?? 'text-muted-foreground')} />
            <span className="text-foreground font-medium">
              {stepLabels[status.step] || status.step}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Message */}
        {status.message ? (
          <motion.div
            key={status.message}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className={cn(
              'p-4 rounded-lg border border-border bg-secondary',
              'shadow-sm'
            )}
          >
            <p className="text-sm text-foreground break-words leading-relaxed">
              {status.message}
            </p>
          </motion.div>
        ) : null}

        <Separator />

        {/* Stepper */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Steps
          </p>

          <div className="space-y-2">
            {stepOrder.map((step, idx) => {
              const isDone = idx < currentIndex || (status.step === 'DONE' && idx <= currentIndex)
              const isCurrent = idx === currentIndex && !isComplete
              const Icon = stepMeta[step]?.icon ?? Wrench

              return (
                <motion.div
                  key={step}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, delay: idx * 0.02 }}
                  className="flex items-center gap-3"
                >
                  <div
                    className={cn(
                      'h-8 w-8 rounded-full border border-border bg-background flex items-center justify-center',
                      'ring-4',
                      isCurrent ? state.ring : 'ring-transparent'
                    )}
                  >
                    {isDone ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    ) : isCurrent ? (
                      <Loader2 className="h-4 w-4 text-blue-300 animate-spin" />
                    ) : (
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div
                      className={cn(
                        'text-sm transition-colors',
                        isDone ? 'text-foreground font-medium' : isCurrent ? 'text-foreground' : 'text-muted-foreground'
                      )}
                    >
                      {stepLabels[step]}
                    </div>

                    {isCurrent ? (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Running…
                      </div>
                    ) : null}
                  </div>

                  {isDone ? (
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-300 border-emerald-500/25">
                      Done
                    </Badge>
                  ) : isCurrent ? (
                    <Badge variant="outline" className="bg-blue-500/10 text-blue-300 border-blue-500/25">
                      Now
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-muted/30 text-muted-foreground border-border">
                      Pending
                    </Badge>
                  )}
                </motion.div>
              )
            })}
          </div>
        </div>

        {/* PR Link Button */}
        {prUrl && isComplete ? (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Button asChild className="w-full h-11 font-semibold" size="lg">
              <a href={prUrl} target="_blank" rel="noopener noreferrer">
                Open Pull Request
                <ExternalLink className="w-4 h-4 ml-2" />
              </a>
            </Button>
          </motion.div>
        ) : null}

        {/* Optional: quick hint */}
        {!prUrl && isComplete && status.state === 'SUCCESS' ? (
          <div className="text-xs text-muted-foreground">
            PR link not found in message.
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
