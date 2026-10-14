import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { Camera, Flashlight, FlashlightOff, Images, X } from 'lucide-react'

// Live camera needs HTTPS (or localhost); phones on http://192.168.x.x fall back to the native camera app
const liveCameraSupported = () => !!(window.isSecureContext && navigator.mediaDevices?.getUserMedia)

const CAMERA_ERRORS = {
  NotAllowedError: 'Camera ki permission nahi mili. Browser ki site settings mein Camera "Allow" karein.',
  NotFoundError: 'Is device mein camera nahi mila.',
  NotReadableError: 'Camera koi aur app use kar raha hai. Use band karke dobara try karein.',
}

/**
 * Full-screen in-app camera for photographing a paper bill.
 * Also offers the gallery, and the phone's own camera app when live camera isn't possible.
 */
export default function CameraScanner({ open, onCapture, onClose }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const galleryRef = useRef(null)
  const nativeCameraRef = useRef(null)
  const [state, setState] = useState({ status: 'idle', error: '' })
  const [torch, setTorch] = useState({ supported: false, on: false })
  const [flash, setFlash] = useState(0)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)

    const start = async () => {
      if (!liveCameraSupported()) {
        setState({ status: 'error', error: 'Is browser mein live camera nahi chal sakta.' })
        return
      }
      setState({ status: 'starting', error: '' })
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1440 } },
        })
        if (cancelled) return stream.getTracks().forEach((t) => t.stop())
        streamRef.current = stream
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => {})
        const track = stream.getVideoTracks()[0]
        const caps = track.getCapabilities?.() ?? {}
        setTorch({ supported: !!caps.torch, on: false })
        if (caps.focusMode?.includes('continuous')) {
          track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(() => {})
        }
        setState({ status: 'ready', error: '' })
      } catch (e) {
        if (!cancelled) setState({ status: 'error', error: CAMERA_ERRORS[e.name] ?? 'Camera shuru nahi ho paya.' })
      }
    }
    start()

    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track) return
    const on = !torch.on
    try {
      await track.applyConstraints({ advanced: [{ torch: on }] })
      setTorch((t) => ({ ...t, on }))
    } catch {
      setTorch({ supported: false, on: false })
    }
  }

  const shoot = () => {
    const video = videoRef.current
    if (!video?.videoWidth) return
    setFlash((f) => f + 1)
    // Full frame at the camera's native resolution; scanBill shrinks it before upload
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    canvas.toBlob(
      (blob) => blob && onCapture(new File([blob], `bill-${Date.now()}.jpg`, { type: 'image/jpeg' })),
      'image/jpeg',
      0.92,
    )
  }

  const pickFile = (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // the same photo can be picked again later
    if (file) onCapture(file)
  }

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Bill scan karein"
          className="fixed inset-0 z-[60] flex flex-col bg-black text-white print:hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="relative min-h-0 flex-1 overflow-hidden">
            <video ref={videoRef} playsInline muted autoPlay className="absolute inset-0 size-full object-cover" />

            {state.status === 'ready' && (
              <>
                {/* Guide frame; the dimmed surround comes from the huge spread shadow */}
                <div className="pointer-events-none absolute inset-0 grid place-items-center">
                  <div className="relative aspect-[3/4] w-[84%] max-w-md rounded-2xl shadow-[0_0_0_9999px_rgb(0_0_0/0.45)]">
                    {['top-0 left-0 border-t-4 border-l-4 rounded-tl-2xl', 'top-0 right-0 border-t-4 border-r-4 rounded-tr-2xl',
                      'bottom-0 left-0 border-b-4 border-l-4 rounded-bl-2xl', 'bottom-0 right-0 border-r-4 border-b-4 rounded-br-2xl'].map((c) => (
                      <span key={c} className={`absolute size-10 border-white ${c}`} />
                    ))}
                  </div>
                </div>
                <p className="absolute inset-x-0 top-[max(4.5rem,calc(env(safe-area-inset-top)+3.5rem))] mx-auto w-max max-w-[90%] rounded-full bg-black/55 px-4 py-2 text-center text-sm font-medium">
                  Bill ko frame mein seedha rakhein
                </p>
              </>
            )}

            {state.status === 'starting' && (
              <p className="absolute inset-0 grid place-items-center text-sm text-white/70">Camera khul raha hai…</p>
            )}

            {state.status === 'error' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8 text-center">
                <span className="grid size-16 place-items-center rounded-2xl bg-white/10"><Camera className="size-8" /></span>
                <p className="text-sm text-white/80">{state.error}</p>
                <button type="button" onClick={() => nativeCameraRef.current?.click()} className="btn bg-white px-5 py-3 text-base text-zinc-900">
                  <Camera className="size-5" /> Phone ka camera kholein
                </button>
              </div>
            )}

            <AnimatePresence>
              {flash > 0 && (
                <motion.div key={flash} className="pointer-events-none absolute inset-0 bg-white"
                  initial={{ opacity: 0.85 }} animate={{ opacity: 0 }} transition={{ duration: 0.35 }} />
              )}
            </AnimatePresence>

            <button type="button" onClick={onClose} aria-label="Band karein"
              className="absolute top-[max(1rem,env(safe-area-inset-top))] right-4 grid size-11 place-items-center rounded-full bg-black/55">
              <X className="size-5" />
            </button>
          </div>

          {/* Controls: gallery · shutter · torch */}
          <div className="grid grid-cols-3 items-center px-8 pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <button type="button" onClick={() => galleryRef.current?.click()} aria-label="Gallery se chunein"
              className="grid size-12 place-items-center justify-self-start rounded-full bg-white/15">
              <Images className="size-5" />
            </button>
            <motion.button whileTap={{ scale: 0.9 }} type="button" onClick={shoot} disabled={state.status !== 'ready'}
              aria-label="Photo lein"
              className="grid size-19 place-items-center justify-self-center rounded-full border-4 border-white disabled:opacity-40">
              <span className="size-15 rounded-full bg-white" />
            </motion.button>
            {torch.supported ? (
              <button type="button" onClick={toggleTorch} aria-label={torch.on ? 'Torch band' : 'Torch chalu'}
                className={`grid size-12 place-items-center justify-self-end rounded-full ${torch.on ? 'bg-amber-300 text-zinc-900' : 'bg-white/15'}`}>
                {torch.on ? <Flashlight className="size-5" /> : <FlashlightOff className="size-5" />}
              </button>
            ) : (
              <span />
            )}
          </div>

          <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={pickFile} />
          <input ref={nativeCameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={pickFile} />
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
