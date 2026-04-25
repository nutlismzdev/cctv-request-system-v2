// Type declarations for CSS imports
// This allows importing CSS files without TypeScript errors

declare module '*.css' {
  const content: string
  export default content
}

declare module 'leaflet/dist/leaflet.css' {
  const content: string
  export default content
}
