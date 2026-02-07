"use client"

import { useEffect, useRef, useState } from "react"

interface AnimatedCounterProps {
    value: number
    duration?: number
    suffix?: string
    prefix?: string
    className?: string
}

export function AnimatedCounter({
    value,
    duration = 1000,
    suffix = "",
    prefix = "",
    className,
}: AnimatedCounterProps) {
    const [displayValue, setDisplayValue] = useState(0)
    const startTime = useRef<number | null>(null)
    const animationRef = useRef<number | null>(null)

    useEffect(() => {
        startTime.current = null

        function animate(timestamp: number) {
            if (!startTime.current) startTime.current = timestamp
            const elapsed = timestamp - startTime.current
            const progress = Math.min(elapsed / duration, 1)

            // Ease-out cubic
            const eased = 1 - Math.pow(1 - progress, 3)
            setDisplayValue(Math.round(eased * value))

            if (progress < 1) {
                animationRef.current = requestAnimationFrame(animate)
            }
        }

        animationRef.current = requestAnimationFrame(animate)

        return () => {
            if (animationRef.current) cancelAnimationFrame(animationRef.current)
        }
    }, [value, duration])

    return (
        <span className={className}>
            {prefix}
            {displayValue}
            {suffix}
        </span>
    )
}
