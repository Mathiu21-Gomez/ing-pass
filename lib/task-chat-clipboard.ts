interface ClipboardFileLike {
  type: string
}

interface ClipboardItemLike {
  type: string
  getAsFile(): File | null
}

interface ClipboardDataLike {
  files?: Iterable<File>
  items?: Iterable<ClipboardItemLike>
}

function isImageFile(file: ClipboardFileLike | null | undefined): file is File {
  return Boolean(file && typeof file.type === "string" && file.type.startsWith("image/"))
}

export function extractTaskChatClipboardFiles(data: ClipboardDataLike): File[] {
  const directFiles = Array.from(data.files ?? []).filter(isImageFile)
  if (directFiles.length > 0) {
    return directFiles
  }

  const clipboardItems = Array.from(data.items ?? [])
  const pastedFiles: File[] = []

  for (const item of clipboardItems) {
    if (!item.type.startsWith("image/")) continue

    const file = item.getAsFile()
    if (isImageFile(file)) {
      pastedFiles.push(file)
    }
  }

  return pastedFiles
}
