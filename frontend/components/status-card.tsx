import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { JobStatus, extractPRUrl } from '@/lib/api'
import { ExternalLink } from 'lucide-react'

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

const stateColors: Record<string, string> = {
  RUNNING: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  SUCCESS: 'bg-green-500/20 text-green-300 border-green-500/40',
  FAILED: 'bg-red-500/20 text-red-300 border-red-500/40',
}

const stepOrder = ['CLONING', 'DETECTING', 'COMPILING', 'BUILDING', 'PATCHING', 'DONE']

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

  return (
    <Card className="border border-border sticky top-8">
      <CardHeader className="pb-6">
        <CardTitle className="text-2xl">Status</CardTitle>
        <CardDescription className="text-xs font-mono">{status.job_id}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* State and Step Badges */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">State:</span>
            <Badge
              variant="outline"
              className={`${stateColors[status.state]} border font-semibold px-3 py-1 text-xs`}
            >
              {status.state}
            </Badge>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Step:</span>
            <Badge variant="secondary" className="font-semibold px-3 py-1 text-xs">
              {stepLabels[status.step] || status.step}
            </Badge>
          </div>
        </div>

        {/* Message */}
        {status.message && (
          <div className="p-4 bg-secondary rounded-lg border border-border">
            <p className="text-sm text-foreground break-words leading-relaxed">{status.message}</p>
          </div>
        )}

        {/* Timeline */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Progress:</p>
          <div className="space-y-2">
            {stepOrder.map((step) => {
              const isCurrentOrPast =
                stepOrder.indexOf(step) <= stepOrder.indexOf(status.step)
              return (
                <div key={step} className="flex items-center gap-3">
                  <div
                    className={`w-2.5 h-2.5 rounded-full flex-shrink-0 transition-colors ${
                      isCurrentOrPast ? 'bg-accent' : 'bg-muted'
                    }`}
                  />
                  <span
                    className={`text-sm transition-colors ${
                      isCurrentOrPast ? 'text-foreground font-medium' : 'text-muted-foreground'
                    }`}
                  >
                    {stepLabels[step]}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* PR Link Button */}
        {prUrl && isComplete && (
          <Button asChild className="w-full h-11 font-semibold" size="lg">
            <a href={prUrl} target="_blank" rel="noopener noreferrer">
              Open Pull Request
              <ExternalLink className="w-4 h-4 ml-2" />
            </a>
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
