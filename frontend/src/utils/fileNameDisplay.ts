export function lowercaseFileExtension(fileName: string): string {
  const extensionIndex = fileName.lastIndexOf('.')
  if (extensionIndex < 0) return fileName

  return `${fileName.slice(0, extensionIndex)}${fileName.slice(extensionIndex).toLowerCase()}`
}
