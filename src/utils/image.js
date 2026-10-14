// Shrink a photo before storing/sending it. WebP keeps transparency (stamp, signature);
// JPEG is smaller for camera photos (bill scan).
export const imageToDataURL = (file, max = 600, type = 'image/webp', quality = 0.9) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * k)
      canvas.height = Math.round(img.height * k)
      const ctx = canvas.getContext('2d')
      if (type === 'image/jpeg') {
        // JPEG has no alpha; transparent areas would turn black
        ctx.fillStyle = '#fff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL(type, quality))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Image load nahi hui'))
    }
    img.src = url
  })
