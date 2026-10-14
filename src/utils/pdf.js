// Phones (iOS especially) refuse canvases much past ~16M pixels
const MAX_PIXELS = 16_000_000

const PX_TO_MM = 25.4 / 96
export const pxToMm = (px) => px * PX_TO_MM

/**
 * Snapshot the bill and put it on ONE PDF page that is exactly as tall as the bill,
 * so long bills never split across pages (browser print can't promise that on phones).
 */
export async function billToPdf(node, fileName) {
  // Heavy libs, so only fetched when a PDF is actually made
  const [{ toJpeg }, { jsPDF }] = await Promise.all([import('html-to-image'), import('jspdf')])
  const width = node.offsetWidth
  const height = node.offsetHeight
  const pixelRatio = Math.min(2.5, Math.sqrt(MAX_PIXELS / (width * height)))

  const image = await toJpeg(node, { width, height, pixelRatio, quality: 0.92, backgroundColor: '#ffffff' })

  const pageW = pxToMm(width)
  const pageH = pxToMm(height)
  const pdf = new jsPDF({ unit: 'mm', format: [pageW, pageH], orientation: pageH >= pageW ? 'p' : 'l', compress: true })
  pdf.addImage(image, 'JPEG', 0, 0, pageW, pageH)
  return new File([pdf.output('blob')], fileName, { type: 'application/pdf' })
}

export function downloadFile(file) {
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
