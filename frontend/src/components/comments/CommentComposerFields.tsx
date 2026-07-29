import { CustomSelect } from '@/components/ui/CustomSelect'
import { Textarea } from '@/components/ui/Textarea'
import { cn } from '@/lib/utils'

/**
 * Shared building blocks for comment composers (public doctor composer +
 * authenticated rep composer). Extracted to avoid duplicating the
 * material-picker/textarea/counter markup between `PublicCommentDialog` and
 * `RepCommentDialog` — the two flows differ in auth, endpoint and error
 * handling, so only this presentational chunk is shared, not the dialog or
 * mutation logic.
 */

export const MAX_COMMENT_LENGTH = 2000
export const GENERAL_OPTION_VALUE = ''
const WARN_THRESHOLD = MAX_COMMENT_LENGTH - 200

export interface CommentMaterialOption {
  label: string
  value: string
}

export interface CommentableMaterial {
  id: number
  title: string
}

export function buildCommentMaterialOptions(materials: CommentableMaterial[]): CommentMaterialOption[] {
  return [
    { label: 'Comentario general (sin material)', value: GENERAL_OPTION_VALUE },
    ...materials.map(material => ({ label: material.title, value: String(material.id) })),
  ]
}

interface CommentComposerFieldsProps {
  options: CommentMaterialOption[]
  selectedOption: CommentMaterialOption
  onSelectedOptionChange: (option: CommentMaterialOption | null) => void
  body: string
  onBodyChange: (value: string) => void
  bodyError?: string | null
  selectLabel?: string
}

export function CommentComposerFields({
  options,
  selectedOption,
  onSelectedOptionChange,
  body,
  onBodyChange,
  bodyError,
  selectLabel = '¿Sobre qué quieres comentar?',
}: CommentComposerFieldsProps) {
  return (
    <>
      <CustomSelect<CommentMaterialOption>
        label={selectLabel}
        options={options}
        value={selectedOption}
        onChange={option => onSelectedOptionChange(option as CommentMaterialOption | null)}
        isSearchable={false}
        isClearable={false}
      />

      <div className="flex flex-col gap-1.5">
        <Textarea
          label="Tu comentario"
          placeholder="Escribe aquí tu comentario..."
          value={body}
          maxLength={MAX_COMMENT_LENGTH}
          onChange={event => onBodyChange(event.target.value)}
          error={bodyError ?? undefined}
          autoFocus
          rows={5}
        />
        <span
          className={cn(
            'self-end text-xs font-medium tabular-nums',
            body.length >= MAX_COMMENT_LENGTH
              ? 'text-destructive'
              : body.length >= WARN_THRESHOLD
                ? 'text-amber-600'
                : 'text-muted-foreground',
          )}
        >
          {body.length}/{MAX_COMMENT_LENGTH}
        </span>
      </div>
    </>
  )
}
