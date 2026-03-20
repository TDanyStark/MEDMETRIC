import { PublicMaterial } from '@/types'
import { PublicMaterialCard } from './PublicMaterialCard'

interface PublicVisitSidebarProps {
  materials: PublicMaterial[]
  activeMaterialId: number | null
  getHref: (material: PublicMaterial) => string
}

export function PublicVisitSidebar({ 
  materials, 
  activeMaterialId, 
  getHref 
}: PublicVisitSidebarProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between px-2">
        <h2 className="text-xl font-bold tracking-tight text-foreground">Materiales disponibles</h2>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
              href={getHref(material)}
            />
          ))
        )}
      </div>
    </div>
  )
}
