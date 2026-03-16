import { Spinner } from '@/components/ui/Spinner'

export function LoadingState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-border/50 bg-background/50 px-4 py-12 text-center text-sm text-muted-foreground shadow-sm">
      <Spinner size="lg" />
      {message}
    </div>
  )
}

export function ErrorState({ message }: { message: string }) {
  return <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-8 text-center text-sm text-destructive">{message}</div>
}
