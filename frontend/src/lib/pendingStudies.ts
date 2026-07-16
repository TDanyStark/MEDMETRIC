import { PendingStudy } from '@/types/backoffice'

/**
 * Builds the `FormData` payload for creating a real, persisted study from a
 * locally-held `PendingStudy` (used to flush pending studies against a
 * material right after it has been created). Shared by the org-admin and
 * manager create flows to avoid duplicating this mapping.
 */
export function buildPendingStudyFormData(study: PendingStudy): FormData {
  const payload = new FormData()
  payload.append('title', study.title)
  payload.append('type', study.type)

  if (study.type === 'pdf') {
    if (study.file) payload.append('file', study.file)
  } else if (study.external_url) {
    payload.append('external_url', study.external_url)
  }

  return payload
}
