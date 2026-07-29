import { firstName } from '@/lib/utils'

/** Unica fuente de verdad de la ruta publica de visita. */
export const PUBLIC_VISIT_PATH = '/public/visit'

export interface ShareMessageParams {
  doctorName?: string | null
  repName?: string | null
  organizationName?: string | null
  url: string
}

/** Valores ya resueltos (nunca null/undefined) listos para interpolar. */
type ResolvedValues = Record<string, string>

const GREETING = 'Hola[[ {doctorName}]], '

/** Clausula sujeto segun que datos de contexto existan (matriz de degradacion). */
const SUBJECT_REP_AND_ORG = '{repName}[[ del laboratorio {organizationName}]] te invita'
const SUBJECT_REP_ONLY = '{repName} te invita'
const SUBJECT_ORG_ONLY = 'el equipo de {organizationName} te invita'
const SUBJECT_NONE = 'te invitamos'

const SUFFIX = ' a revisar este material científico.\n\nEnlace seguro:\n{url}'

/** Plantilla canonica, con todos los valores de contexto presentes. */
export const DEFAULT_SHARE_TEMPLATE = `${GREETING}${SUBJECT_REP_AND_ORG}${SUFFIX}`

/** Bloque opcional: se elimina completo si algun placeholder interno resuelve vacio. */
const OPTIONAL_BLOCK_PATTERN = /\[\[(.*?)\]\]/g
const PLACEHOLDER_PATTERN = /\{(\w+)\}/g

export function buildPublicVisitUrl(token: string): string {
  return `${window.location.origin}${PUBLIC_VISIT_PATH}/${token}`
}

function resolveValues(params: ShareMessageParams): ResolvedValues {
  return {
    doctorName: firstName(params.doctorName),
    repName: firstName(params.repName),
    organizationName: (params.organizationName ?? '').trim(),
    url: params.url ?? '',
  }
}

/** true solo para las claves reconocidas; evita heredar del prototipo (toString, etc). */
function isRecognized(values: ResolvedValues, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(values, key)
}

/** Selecciona la variante de clausula sujeto segun la matriz de degradacion. */
function selectDefaultTemplate(values: ResolvedValues): string {
  const hasRep = values.repName !== ''
  const hasOrg = values.organizationName !== ''

  let subject: string
  if (hasRep) {
    subject = hasOrg ? SUBJECT_REP_AND_ORG : SUBJECT_REP_ONLY
  } else {
    subject = hasOrg ? SUBJECT_ORG_ONLY : SUBJECT_NONE
  }

  return `${GREETING}${subject}${SUFFIX}`
}

function applyOptionalBlocks(template: string, values: ResolvedValues): string {
  return template.replace(OPTIONAL_BLOCK_PATTERN, (_match, inner: string) => {
    const keys = Array.from(inner.matchAll(PLACEHOLDER_PATTERN), match => match[1])
    const hasEmptyValue = keys.some(key => isRecognized(values, key) && values[key] === '')

    return hasEmptyValue ? '' : inner
  })
}

/** Clave reconocida -> su valor (ausente => ''). Clave desconocida -> literal intacto. */
function interpolate(template: string, values: ResolvedValues): string {
  return template.replace(PLACEHOLDER_PATTERN, (match, key: string) =>
    isRecognized(values, key) ? values[key] : match
  )
}

/** Colapsa espacios repetidos dentro de cada linea. Nunca colapsa saltos de linea. */
function cleanup(text: string): string {
  return text
    .split('\n')
    .map(line => line.replace(/ {2,}/g, ' ').replace(/ +,/g, ','))
    .join('\n')
}

/**
 * Construye el mensaje contextual para compartir con el medico.
 *
 * - Sin `template`: selecciona la variante segun los valores disponibles
 *   (degradacion a nivel clausula). Es el camino usado por toda la app.
 * - Con `template` explicito: se usa esa cadena tal cual, solo interpolando
 *   placeholders. El llamador es dueño de su copy. Hook para la futura
 *   configuracion por organizacion / representante (hoy no cableada).
 */
export function buildShareMessage(params: ShareMessageParams, template?: string): string {
  const values = resolveValues(params)
  const source = template ?? selectDefaultTemplate(values)

  return cleanup(interpolate(applyOptionalBlocks(source, values), values))
}
