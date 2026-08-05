import { Pencil, Trash2 } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { formatDate } from '@/lib/utils'
import { Doctor } from '@/types/doctor'
import { useAuth } from '@/contexts/useAuth'

interface DoctorsTableProps {
  doctors: Doctor[]
  onEdit: (doctor: Doctor) => void
  onDelete: (doctor: Doctor) => void
}

function daysSinceLabel(days: number | null): string {
  if (days === null) return '—'
  if (days === 0) return 'Hoy'
  return `${days} día${days === 1 ? '' : 's'}`
}

export function DoctorsTable({ doctors, onEdit, onDelete }: DoctorsTableProps) {
  const { user } = useAuth()
  return (
    <div className="rounded-3xl border border-border/50 bg-background/50 shadow-sm overflow-hidden">
      <Table>
        <TableHeader className="bg-muted/30">
          <TableRow>
            <TableHead className="w-[20%]">Nombre</TableHead>
            <TableHead>Documento</TableHead>
            <TableHead>Especialidad</TableHead>
            <TableHead>Institución</TableHead>
            <TableHead>Comuna / Región</TableHead>
            <TableHead>Categoría</TableHead>
            <TableHead>Producto</TableHead>
            <TableHead>Adopción</TableHead>
            <TableHead>Última visita</TableHead>
            <TableHead>Días sin visita</TableHead>
            <TableHead>Rep. asignado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {doctors.map(doctor => (
            <TableRow key={doctor.id} className="group transition-colors hover:bg-muted/20">
              <TableCell className="font-medium text-foreground">
                {doctor.name}
              </TableCell>
              <TableCell className="text-muted-foreground">{doctor.document ?? '—'}</TableCell>
              <TableCell className="text-muted-foreground">{doctor.specialty ?? '—'}</TableCell>
              <TableCell className="text-muted-foreground">{doctor.institution ?? '—'}</TableCell>
              <TableCell className="text-muted-foreground">
                {[doctor.comuna, doctor.region].filter(Boolean).join(' / ') || '—'}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {doctor.category ? <Badge variant="outline">{doctor.category}</Badge> : '—'}
              </TableCell>
              <TableCell className="text-muted-foreground">{doctor.product ?? '—'}</TableCell>
              <TableCell className="text-muted-foreground">
                {doctor.adoption_level ? <Badge variant="accent">{doctor.adoption_level}</Badge> : '—'}
              </TableCell>
              <TableCell className="text-sm">{formatDate(doctor.last_visit_date, user?.organization_timezone)}</TableCell>
              <TableCell className="text-sm">{daysSinceLabel(doctor.days_since_last_visit)}</TableCell>
              <TableCell className="text-muted-foreground">
                {doctor.assigned_rep_name ?? (doctor.assigned_rep_id ? `#${doctor.assigned_rep_id}` : 'Sin asignar')}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(doctor)}
                    className="opacity-70 hover:opacity-100 transition-opacity p-2"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(doctor)}
                    className="opacity-70 hover:opacity-100 transition-opacity p-2 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
