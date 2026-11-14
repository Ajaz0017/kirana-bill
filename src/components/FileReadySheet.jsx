import { Download, MessageCircle, Share2 } from 'lucide-react'
import BottomSheet from './BottomSheet'
import { downloadFile } from '../utils/pdf'
import { waLink } from '../utils/whatsapp'

/**
 * "File taiyaar hai": download / share / WhatsApp for a generated PDF or picture.
 * state: { file, error } | null. `message` goes with the WhatsApp share.
 */
export default function FileReadySheet({ state, title = 'File taiyaar hai', message, onClose }) {
  const file = state?.file
  const canShare = !!file && !!navigator.canShare?.({ files: [file] })
  const share = async () => {
    try {
      await navigator.share({ files: [file], title: file.name, text: message })
    } catch {
      // share sheet closed
    }
  }
  // WhatsApp links can't carry files: save it first so it's one tap to attach in the chat
  const whatsapp = () => {
    downloadFile(file)
    window.open(waLink(null, message), '_blank', 'noopener')
  }

  return (
    <BottomSheet open={!!state} title={state?.error ? 'Oops' : title} onClose={onClose}>
      {state?.error ? (
        <p className="pb-2 text-sm text-rose-600">{state.error}</p>
      ) : (
        <div className="space-y-3 pb-2">
          <p className="truncate text-sm text-zinc-500">{file?.name}</p>
          <div className="flex gap-3">
            <button type="button" onClick={() => downloadFile(file)} className={`${canShare ? 'btn-ghost' : 'btn-primary'} flex-1 py-3.5 text-base`}>
              <Download className="size-5" /> Download
            </button>
            {canShare && (
              <button type="button" onClick={share} className="btn-primary flex-1 py-3.5 text-base">
                <Share2 className="size-5" /> Share
              </button>
            )}
          </div>
          <button type="button" onClick={whatsapp} className="btn-whatsapp w-full py-3.5 text-base">
            <MessageCircle className="size-5" /> WhatsApp pe bhejein
          </button>
          <p className="text-xs text-zinc-500">
            {canShare ? 'Share se file seedha WhatsApp pe jayegi.' : 'File download hogi, WhatsApp chat mein 📎 se attach karein.'}
          </p>
        </div>
      )}
    </BottomSheet>
  )
}
