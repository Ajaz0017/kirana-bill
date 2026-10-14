// UPI deep link; scanning a QR of this opens any UPI app with the amount pre-filled.
// `pa` stays raw: some apps reject an encoded "@".
export const upiLink = ({ upiId, name, amount, note }) => {
  const params = [
    `pa=${upiId.trim()}`,
    name && `pn=${encodeURIComponent(name.trim())}`,
    amount > 0 && `am=${amount.toFixed(2)}`,
    'cu=INR',
    note && `tn=${encodeURIComponent(note)}`,
  ]
  return `upi://pay?${params.filter(Boolean).join('&')}`
}
