import { Eye, FileStack, Pencil, Trash2 } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Button } from '@/components/ui/Button'
import { CompactSwitch } from '@/components/ui/CompactSwitch'
import { Material } from '@/types/backoffice'
import { MaterialTypeLabel, StatusBadge } from '@/pages/manager/components/ManagerHelpers'

interface OrgMaterialsTableProps {
  materials: Material[]
  brandMap: Map<number, string>
  onEdit: (material: Material) => void
  onApprove: (materialId: number) => void
  isApproving: (materialId: number) => boolean
  onToggleVisible: (materialId: number, value: boolean) => void
  isTogglingVisible: (materialId: number) => boolean
  onDelete: (material: Material) => void
  onPreview: (material: Material) => void
}

export function OrgMaterialsTable({
  materials,
  brandMap,
  onEdit,
  onApprove,
  isApproving,
  onToggleVisible,
  isTogglingVisible,
  onDelete,
  onPreview,
}: OrgMaterialsTableProps) {
  return (
    <div className="rounded-3xl border border-border/50 bg-background/50 shadow-sm overflow-hidden">
      <Table>
        <TableHeader className="bg-muted/30">
          <TableRow>
            <TableHead className="w-[28%]">Título</TableHead>
            <TableHead>Marca</TableHead>
            <TableHead>Gerente</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {materials.map((item) => (
            <TableRow
              key={item.id}
              className="group transition-colors hover:bg-muted/20"
            >
              <TableCell className="font-medium text-foreground">
                <div className="flex items-center gap-3">
                  {item.cover_url || item.cover_path ? (
                    <img
                      src={item.cover_url || `/api/v1/public/material/${item.id}/cover`}
                      className="h-12 aspect-video shrink-0 rounded-lg object-cover bg-muted"
                      alt=""
                    />
                  ) : (
                    <div className="h-12 aspect-video shrink-0 rounded-lg bg-muted flex items-center justify-center">
                      <FileStack className="h-5 w-5 opacity-20" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <p className="font-semibold line-clamp-2 leading-tight cursor-default">
                          {item.title}
                        </p>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">{item.title}</p>
                      </TooltipContent>
                    </Tooltip>
                    <p
                      className="text-xs text-muted-foreground truncate max-w-[200px]"
                      title={item.description || ''}
                    >
                      {item.description}
                    </p>
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {item.brand_name ?? brandMap.get(item.brand_id) ?? `ID ${item.brand_id}`}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {item.manager_name ?? `ID ${item.manager_id}`}
              </TableCell>
              <TableCell>
                <MaterialTypeLabel type={item.type} />
              </TableCell>
              <TableCell>
                <StatusBadge status={item.status} />
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onPreview(item)}
                    className="opacity-70 hover:opacity-100 transition-opacity p-2"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(item)}
                    className="opacity-70 hover:opacity-100 transition-opacity p-2"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(item)}
                    className="opacity-70 hover:opacity-100 transition-opacity p-2 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  {item.status === 'draft' && (
                    <Button
                      variant="outline"
                      size="sm"
                      loading={isApproving(item.id)}
                      onClick={() => onApprove(item.id)}
                    >
                      Aprobar
                    </Button>
                  )}
                  {item.status === 'approved' && (
                    <CompactSwitch
                      checked={item.is_visible}
                      onChange={value => onToggleVisible(item.id, value)}
                      disabled={isTogglingVisible(item.id)}
                      label={`Visibilidad de ${item.title}`}
                    />
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
