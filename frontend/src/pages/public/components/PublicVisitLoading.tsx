import { Skeleton } from '@/components/ui/Skeleton'

export function PublicVisitLoading() {
  return (
    <div className="min-h-screen bg-background px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <Skeleton className="h-48 w-full" />
        <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <Skeleton className="h-128 w-full" />
          <Skeleton className="h-128 w-full" />
        </div>
      </div>
    </div>
  )
}
