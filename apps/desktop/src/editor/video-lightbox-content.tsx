import type { ReactElement } from 'react'
import {
  LightboxFrame,
  LightboxVideo,
  type LightboxFrameItem,
  type LightboxVideoItem,
} from '@meowdown/react'
import { XIcon } from 'lucide-react'
import { LightboxChromeButton } from '@/editor/lightbox-chrome-button.tsx'
import { cn } from '@/lib/utils.ts'
import { useI18n } from '@/providers/i18n-provider.tsx'

interface VideoLightboxContentProps {
  item: LightboxVideoItem | LightboxFrameItem
  mobileSurface: boolean
  onClose: () => void
}

export function VideoLightboxContent({
  item,
  mobileSurface,
  onClose,
}: VideoLightboxContentProps): ReactElement {
  const { t } = useI18n()
  return (
    // Clicking the dark area around the player closes; clicking the player
    // reaches its controls.
    <div
      className={cn(
        'absolute inset-0 flex items-center justify-center overflow-hidden',
        mobileSurface ? 'bg-black p-0' : 'p-6',
      )}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <LightboxChromeButton
        side={mobileSurface ? 'left' : 'right'}
        size="icon-lg"
        aria-label={t('Close')}
        onClick={onClose}
      >
        <XIcon />
      </LightboxChromeButton>
      {item.type === 'video' ? <LightboxVideo item={item} /> : <LightboxFrame item={item} />}
    </div>
  )
}
