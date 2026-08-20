import {
  Activity,
  BadgeCheck,
  BriefcaseMedical,
  Building2,
  FileStack,
  FolderKanban,
  LayoutDashboard,
  Link2,
  LucideIcon,
  MessageSquare,
  Orbit,
  Settings,
  ShieldCheck,
  Stethoscope,
  Users,
} from 'lucide-react'
import { Role } from '@/types'

export interface NavItem {
  to: string
  label: string
  description: string
  icon: LucideIcon
}

export interface RoleBlueprint {
  label: string
  eyebrow: string
  intro: string
  deck: string
  signature: string
  navigation: NavItem[]
}

// route-role-prefix-removal: home siempre es `/` (RoleHomePage lee el rol de
// useAuth() en vez de recibirlo via path/prop). Ver `sdd/route-role-prefix-removal`.
export const ROLE_HOME: Record<Role, string> = {
  superadmin: '/',
  org_admin: '/',
  manager: '/',
  rep: '/',
}

// route-role-prefix-removal (batch 2, Fases 4-5): todos los `to` apuntan a
// su path neutro sin prefijo (fuente real: `APP_ROUTES` en `lib/routes.ts`
// — no hay forma de referenciar la tabla por string literal aca sin perder
// autocompletado de icon/label por item, asi que se mantiene el valor
// duplicado a mano; ver `sdd/route-role-prefix-removal/design`). Los 5
// items que antes apuntaban a brands/materials/metrics con prefijo de rol
// (bloqueados por colision de componentes) ya usan sus dispatchers
// (`MetricsPage`/`BrandsPage`/`MaterialsPage`, Fase 4) — evaluar mas
// adelante si conviene derivar `getNavItems` 100% de `APP_ROUTES` via un
// campo `nav` en `RouteDef` (design's Open Question); diferido por ahora,
// el hibrido actual ya no tiene deuda de paths legacy.
export const ROLE_BLUEPRINTS: Record<Role, RoleBlueprint> = {
  superadmin: {
    label: 'Super Admin',
    eyebrow: 'Sala de control multi-organizacion',
    intro: 'Coordina clientes, administradores y la salud global de la operacion desde una misma consola.',
    deck: 'El panel se comporta como un mapa de cobertura: primero clientes, luego responsables, luego trazabilidad.',
    signature: 'Panel de cobertura con foco en organizaciones activas y responsables asignados.',
    navigation: [
      { to: '/', label: 'Panorama', description: 'Entrada principal con prioridades y accesos rapidos del rol.', icon: LayoutDashboard },
      { to: '/organizations', label: 'Organizaciones', description: 'Gestion de clientes, alta, edicion y estado operativo.', icon: Building2 },
      { to: '/org-admins', label: 'Admins de organizacion', description: 'Asignacion y seguimiento de administradores responsables.', icon: ShieldCheck },
      { to: '/metrics', label: 'Metricas globales', description: 'Vista transversal de cobertura interna por cliente.', icon: Activity },
    ],
  },
  org_admin: {
    label: 'Admin de organizacion',
    eyebrow: 'Mesa de coordinacion local',
    intro: 'Ordena la estructura interna del cliente: usuarios, marcas y asignaciones entre equipos.',
    deck: 'La interfaz prioriza pocas decisiones por pantalla para que administrar la organizacion requiera pocos clics.',
    signature: 'Bloques operativos que agrupan personas, marcas y relacion con gerentes.',
    navigation: [
      { to: '/', label: 'Panorama', description: 'Resumen del espacio operativo de la organizacion.', icon: LayoutDashboard },
      { to: '/users', label: 'Usuarios', description: 'Gestion de gerentes y visitadores dentro de la organizacion.', icon: Users },
      { to: '/brands', label: 'Marcas', description: 'Catalogo maestro de marcas sin duplicados por cliente.', icon: BadgeCheck },
      { to: '/materials', label: 'Materiales', description: 'Todos los materiales de la organizacion y su marca.', icon: FileStack },
      { to: '/doctors', label: 'Medicos', description: 'Directorio de medicos con historial de visitas y contexto comercial.', icon: Stethoscope },
      { to: '/comments', label: 'Comentarios', description: 'Comentarios de medicos y visitadores sobre las visitas.', icon: MessageSquare },
      { to: '/metrics', label: 'Metricas', description: 'Lectura operativa de usuarios, marcas y estructura interna.', icon: Activity },
      { to: '/organization', label: 'Organizacion', description: 'Configuracion general, incluida la zona horaria.', icon: Settings },
    ],
  },
  manager: {
    label: 'Gerente',
    eyebrow: 'Mesa editorial de materiales',
    intro: 'Trabaja como un briefing deck: marcas asignadas, materiales y visitadores conectados al contenido.',
    deck: 'El modulo acompana el flujo natural del gerente: preparar, aprobar y distribuir.',
    signature: 'Tarjetas editoriales para marcas y materiales listas para crecer en la fase de contenido.',
    navigation: [
      { to: '/', label: 'Panorama', description: 'Entrada al modulo editorial del gerente.', icon: LayoutDashboard },
      { to: '/brands', label: 'Marcas asignadas', description: 'Consulta de marcas habilitadas para trabajar contenido.', icon: Orbit },
      { to: '/materials', label: 'Materiales', description: 'Alta, edicion y aprobacion de piezas PDF, video y link.', icon: FileStack },
      { to: '/reps', label: 'Visitadores', description: 'Gestion de suscripciones de acceso al contenido del gerente.', icon: BriefcaseMedical },
      { to: '/doctors', label: 'Medicos', description: 'Directorio de medicos con historial de visitas y contexto comercial.', icon: Stethoscope },
      { to: '/comments', label: 'Comentarios', description: 'Comentarios de medicos y visitadores sobre las visitas.', icon: MessageSquare },
      { to: '/metrics', label: 'Metricas', description: 'Rendimiento y uso de materiales.', icon: Activity },
    ],
  },
  rep: {
    label: 'Visitador medico',
    eyebrow: 'Cabina de visita medica',
    intro: 'Prepara sesiones, comparte materiales aprobados y sigue cada encuentro con el medico.',
    deck: 'El espacio reduce friccion para campo: biblioteca clara, sesiones visibles y link al medico listo para compartir.',
    signature: 'Panel de sesion con foco en acceso rapido y contexto de visita.',
    navigation: [
      { to: '/', label: 'Panorama', description: 'Inicio del visitador con accesos rapidos a contenido y sesiones.', icon: LayoutDashboard },
      { to: '/library', label: 'Biblioteca', description: 'Materiales aprobados de los gerentes suscritos.', icon: FolderKanban },
      { to: '/doctors', label: 'Medicos', description: 'Directorio de medicos con historial de visitas y contexto comercial.', icon: Stethoscope },
      { to: '/comments', label: 'Comentarios', description: 'Comentarios de medicos sobre tus visitas.', icon: MessageSquare },
      { to: '/metrics', label: 'Métricas', description: 'Seguimiento de aperturas y consumo de tus sesiones enviadas.', icon: Activity },
      { to: '/history', label: 'Historial', description: 'Seguimiento de sesiones ya creadas y consumos asociados.', icon: Link2 },
    ],
  },
}

export function getRoleHome(role: Role): string {
  return ROLE_HOME[role]
}

export function getNavItems(role: Role): NavItem[] {
  return ROLE_BLUEPRINTS[role].navigation
}

export function getNavItem(role: Role, pathname: string): NavItem {
  const items = getNavItems(role)
  const active = [...items]
    .sort((left, right) => right.to.length - left.to.length)
    .find(item => pathname === item.to || pathname.startsWith(`${item.to}/`))

  return active ?? items[0]
}
