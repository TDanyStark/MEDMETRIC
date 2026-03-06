export function LoadingState({ message }: { message: string }) {
  return <div className="rounded-2xl border border-border/80 bg-background/50 px-4 py-8 text-center text-sm text-muted-foreground">{message}</div>
}

export function ErrorState({ message }: { message: string }) {
  return <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-8 text-center text-sm text-destructive">{message}</div>
}
