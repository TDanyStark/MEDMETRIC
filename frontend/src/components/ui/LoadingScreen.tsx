import { Loader2 } from 'lucide-react'

interface LoadingScreenProps {
  message?: string
}

export function LoadingScreen({ message = 'Restaurando tu espacio de trabajo...' }: LoadingScreenProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="relative flex flex-col items-center gap-6">
        {/* Logo or Brand Element */}
        <div className="relative h-20 w-20">
          <img 
            src="/MEDMETRIC.webp" 
            alt="MedMetric Logo" 
            className="h-full w-full object-contain animate-pulse"
          />
        </div>

        {/* Beautiful Loading Indicator */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative flex items-center justify-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
            <Loader2 className="absolute h-10 w-10 animate-[spin_2s_linear_infinite] text-primary" />
          </div>
          
          <p className="animate-pulse text-sm font-medium tracking-wide text-muted-foreground">
            {message}
          </p>
        </div>

        {/* Decorative background blobs for premium feel */}
        <div className="absolute -top-24 -left-24 -z-10 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 -z-10 h-64 w-64 rounded-full bg-accent/5 blur-3xl" />
      </div>
    </div>
  )
}
