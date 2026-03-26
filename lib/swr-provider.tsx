"use client"

import React from "react"
import { SWRConfig } from "swr"

const globalFetcher = (url: string) =>
  fetch(url).then((res) => {
    if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`)
    return res.json()
  })

export function SWRProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher: globalFetcher,
        dedupingInterval: 30_000,
        revalidateOnFocus: false,
      }}
    >
      {children}
    </SWRConfig>
  )
}
