import { LoadingDots } from "./LoadingDots"

export function PageLoadingFallback() {
  return (
    <div className="min-h-screen w-full page-gradient flex items-center justify-center">
      <LoadingDots size="md" color="#15803d" />
    </div>
  )
}
