export function LoadingState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-border/50 bg-background/50 px-4 py-8 text-center text-sm text-muted-foreground">
      {message}
    </div>
  )
}
