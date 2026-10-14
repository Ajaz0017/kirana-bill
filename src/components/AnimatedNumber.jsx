import { useEffect } from 'react'
import { animate, motion, useMotionValue, useTransform } from 'motion/react'
import { inr } from '../utils/format'

// Counts smoothly from the previous value to the new one
export default function AnimatedNumber({ value, format = inr, className }) {
  const mv = useMotionValue(value)
  const text = useTransform(mv, (v) => format(v))

  useEffect(() => {
    const controls = animate(mv, value, { duration: 0.6, ease: [0.16, 1, 0.3, 1] })
    return () => controls.stop()
  }, [mv, value])

  return <motion.span className={className}>{text}</motion.span>
}
