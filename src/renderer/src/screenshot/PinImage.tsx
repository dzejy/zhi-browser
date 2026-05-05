import { useEffect, useState } from 'react'
import './styles.css'
import './styles.elegant.css'

export default function PinImage(): React.JSX.Element {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    const off = window.api.onPinImageData((dataUrl: string) => {
      setSrc(dataUrl)
    })
    window.api
      .pinImageGetData()
      .then((dataUrl) => {
        if (dataUrl) setSrc(dataUrl)
      })
      .catch(() => {})
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        window.api.pinImageClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      off?.()
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  return (
    <div className="pin-image-root" onDoubleClick={() => window.api.pinImageClose()}>
      {src && <img src={src} alt="pin" draggable={false} />}
    </div>
  )
}
