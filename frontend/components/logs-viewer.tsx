'use client'

import { useEffect, useRef, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Copy, Check } from 'lucide-react'

interface LogsViewerProps {
  logs: string | null
  loading: boolean
}

export function LogsViewer({ logs, loading }: LogsViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logs, autoScroll])

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
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl">Logs</CardTitle>
            <CardDescription>Real-time job output</CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            disabled={!logs}
            title="Copy logs to clipboard"
          >
            {copied ? (
              <Check className="w-4 h-4 text-green-400" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col overflow-hidden">
        {/* Auto-scroll toggle */}
        <div className="flex items-center gap-2 mb-4 pb-4 border-b border-border">
          <Checkbox
            id="auto-scroll"
            checked={autoScroll}
            onCheckedChange={(checked) => setAutoScroll(checked as boolean)}
          />
          <label htmlFor="auto-scroll" className="text-sm text-muted-foreground cursor-pointer">
            Auto-scroll to bottom
          </label>
        </div>

        {/* Logs container */}
        <div
          ref={scrollRef}
          className="flex-1 bg-secondary rounded-lg border border-border p-4 overflow-auto font-mono text-sm text-foreground leading-relaxed"
        >
          {loading && !logs ? (
            <div className="space-y-2">
              <div className="h-4 bg-muted rounded w-3/4 animate-pulse" />
              <div className="h-4 bg-muted rounded w-full animate-pulse" />
              <div className="h-4 bg-muted rounded w-2/3 animate-pulse" />
            </div>
          ) : logs ? (
            <pre className="whitespace-pre-wrap break-words">{logs}</pre>
          ) : (
            <div className="text-muted-foreground">No logs yet...</div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
