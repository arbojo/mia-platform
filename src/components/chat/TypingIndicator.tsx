export function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-2 bg-gray-100 rounded-2xl px-4 py-2">
        <div className="flex gap-1">
          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" />
          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.1s]" />
          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]" />
        </div>
        <span className="text-xs text-gray-500">escribiendo…</span>
      </div>
    </div>
  )
}
