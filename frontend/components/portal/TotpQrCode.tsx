'use client'
// Renders a scannable QR code for TOTP enrollment entirely client-side — the secret
// never leaves the browser (no third-party QR-rendering API), since anyone who could
// intercept it could generate valid MFA codes and bypass the whole point of it.
import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

export function TotpQrCode({ otpauthUri }: { otpauthUri: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(otpauthUri, { width: 180, margin: 1 })
      .then(url => { if (!cancelled) setDataUrl(url) })
      .catch(() => { if (!cancelled) setDataUrl(null) })
    return () => { cancelled = true }
  }, [otpauthUri])

  if (!dataUrl) {
    return <div style={{ width: '180px', height: '180px', margin: '0 auto', background: 'rgba(255,255,255,0.08)', borderRadius: '8px' }} />
  }
  return (
    <img src={dataUrl} alt="Scan with your authenticator app" width={180} height={180}
      style={{ display: 'block', margin: '0 auto', borderRadius: '8px', background: 'white', padding: '8px' }} />
  )
}
