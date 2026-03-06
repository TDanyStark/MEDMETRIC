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
  Network,
  Orbit,
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

export const ROLE_HOME: Record<Role, string> = {
  superadmin: '/superadmin',
  org_admin: '/org-admin',
  manager: '/manager',
  rep: '/rep',
}

export const ROLE_BLUEPRINTS: Record<Role, RoleBlueprint> = {
  superadmin: {
    label: 'Super Admin',
    eyebrow: 'Sala de control multi-organizacion',
    intro: 'Coordina clientes, administradores y la salud global de la operacion desde una misma consola.',
    deck: 'El panel se comporta como un mapa de cobertura: primero clientes, luego responsables, luego trazabilidad.',
    signature: 'Panel de cobertura con foco en organizaciones activas y responsables asignados.',
    navigation: [
      { to: '/superadmin', label: 'Panorama', description: 'Entrada principal con prioridades y accesos rapidos del rol.', icon: LayoutDashboard },
      { to: '/superadmin/organizations', label: 'Organizaciones', description: 'Gestion de clientes, alta, edicion y estado operativo.', icon: Building2 },
      { to: '/superadmin/org-admins', label: 'Admins de organizacion', description: 'Asignacion y seguimiento de administradores responsables.', icon: ShieldCheck },
      { to: '/superadmin/metrics', label: 'Metricas globales', description: 'Vista transversal de cobertura interna por cliente.', icon: Activity },
    ],
  },
  org_admin: {
    label: 'Admin de organizacion',
    eyebrow: 'Mesa de coordinacion local',
    intro: 'Ordena la estructura interna del cliente: usuarios, marcas y asignaciones entre equipos.',
    deck: 'La interfaz prioriza pocas decisiones por pantalla para que administrar la organizacion requiera pocos clics.',
    signature: 'Bloques operativos que agrupan personas, marcas y relacion con gerentes.',
    navigation: [
      { to: '/org-admin', label: 'Panorama', description: 'Resumen del espacio operativo de la organizacion.', icon: LayoutDashboard },
      { to: '/org-admin/users', label: 'Usuarios', description: 'Gestion de gerentes y visitadores dentro de la organizacion.', icon: Users },
      { to: '/org-admin/brands', label: 'Marcas', description: 'Catalogo maestro de marcas sin duplicados por cliente.', icon: BadgeCheck },
      { to: '/org-admin/assignments', label: 'Asignaciones', description: 'Relacion entre marcas y gerentes para ordenar la operacion.', icon: Network },
      { to: '/org-admin/metrics', label: 'Metricas', description: 'Lectura operativa de usuarios, marcas y estructura interna.', icon: Activity },
    ],
  },
  manager: {
    label: 'Gerente',
    eyebrow: 'Mesa editorial de materiales',
    intro: 'Trabaja como un briefing deck: marcas asignadas, materiales y visitadores conectados al contenido.',
    deck: 'El modulo acompana el flujo natural del gerente: preparar, aprobar y distribuir.',
    signature: 'Tarjetas editoriales para marcas y materiales listas para crecer en la fase de contenido.',
    navigation: [
      { to: '/manager', label: 'Panorama', description: 'Entrada al modulo editorial del gerente.', icon: LayoutDashboard },
      { to: '/manager/brands', label: 'Marcas asignadas', description: 'Consulta de marcas habilitadas para trabajar contenido.', icon: Orbit },
      { to: '/manager/materials', label: 'Materiales', description: 'Alta, edicion y aprobacion de piezas PDF, video y link.', icon: FileStack },
      { to: '/manager/reps', label: 'Visitadores', description: 'Gestion de suscripciones de acceso al contenido del gerente.', icon: BriefcaseMedical },
    ],
  },
  rep: {
    label: 'Visitador medico',
    eyebrow: 'Cabina de visita medica',
    intro: 'Prepara sesiones, comparte materiales aprobados y sigue cada encuentro con el medico.',
    deck: 'El espacio reduce friccion para campo: biblioteca clara, sesiones visibles y link al medico listo para compartir.',
    signature: 'Panel de sesion con foco en acceso rapido y contexto de visita.',
    navigation: [
      { to: '/rep', label: 'Panorama', description: 'Inicio del visitador con accesos rapidos a contenido y sesiones.', icon: LayoutDashboard },
      { to: '/rep/library', label: 'Biblioteca', description: 'Materiales aprobados de los gerentes suscritos.', icon: FolderKanban },
      { to: '/rep/sessions', label: 'Sesiones', description: 'Creacion de sesiones y links para el medico.', icon: Stethoscope },
      { to: '/rep/history', label: 'Historial', description: 'Seguimiento de sesiones ya creadas y consumos asociados.', icon: Link2 },
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
