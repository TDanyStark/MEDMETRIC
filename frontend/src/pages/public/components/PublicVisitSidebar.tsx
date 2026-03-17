import { PublicMaterial } from '@/types'
import { PublicMaterialCard } from './PublicMaterialCard'

interface PublicVisitSidebarProps {
  materials: PublicMaterial[]
  activeMaterialId: number | null
  openingId: number | null
  onOpenMaterial: (material: PublicMaterial, openInNewWindow?: boolean) => void
}

export function PublicVisitSidebar({ 
  materials, 
  activeMaterialId, 
  openingId, 
  onOpenMaterial 
}: PublicVisitSidebarProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between px-2">
        <h2 className="text-xl font-bold tracking-tight text-foreground">Materiales de la visita</h2>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
        {materials.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-background p-6 text-sm leading-7 text-muted-foreground lg:col-span-1 sm:col-span-2">
            Esta sesion no tiene materiales aprobados disponibles.
          </div>
        ) : (
          materials.map(material => (
            <PublicMaterialCard
              key={material.id}
              item={material}
              isActive={activeMaterialId === material.id}
              isOpening={openingId === material.id}
              onClick={() => onOpenMaterial(material)}
              onOpenNew={() => onOpenMaterial(material, true)}
            />
          ))
        )}
      </div>
    </div>
  )
}
