import { type ReactNode, useMemo, useState } from "react"
import useSpeechSynthesis from "../hooks/useSpeechSynthesis"

interface ArticleReaderProps {
  articleId: string
  title: string
  content: string
  children: ReactNode
  className?: string
}

const statusLabels: Record<string, string> = {
  reading: "Reading...",
  paused: "Paused",
  stopped: "Stopped",
  unsupported: "Unsupported",
  loading: "Loading voices...",
  error: "Error"
}

const ArticleReader = ({ articleId, title, content, children, className }: ArticleReaderProps) => {
  const [panelOpen, setPanelOpen] = useState(false)
  const {
    status,
    availableVoices,
    selectedVoiceIndex,
    rate,
    errorMessage,
    speak,
    pause,
    resume,
    stop,
    setRate,
    setVoiceIndex,
  } = useSpeechSynthesis({ articleId, text: content })

  const actionLabel = useMemo(() => {
    if (status === "reading") return "Pause"
    if (status === "paused") return "Resume"
    if (status === "stopped") return "Play"
    return "Play"
  }, [status])

  const handlePrimaryAction = () => {
    if (status === "reading") {
      pause()
      return
    }
    if (status === "paused") {
      resume()
      return
    }
    speak()
  }

  const highlightClass = status === "reading" || status === "paused"
    ? "ring-2 ring-themeOrange/90 bg-zinc-900/15 shadow-[0_0_34px_rgba(184,60,18,0.15)]"
    : "bg-transparent"

  return (
    <section className={`relative rounded-3xl border border-zinc-700 p-5 transition-all duration-500 ${highlightClass} ${className ?? ""}`}>
      <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-[#161616] px-3 py-1 text-xs uppercase tracking-[0.3em] text-themeOrange shadow-sm">
            <span>Read Aloud</span>
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-zinc-100 tracking-tight">{title}</h2>
            <p className="text-sm text-zinc-400">{statusLabels[status] ?? "Stopped"}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setPanelOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-themeOrange px-5 py-3 text-sm font-semibold text-white transition duration-300 hover:bg-orange-500"
        >
          ▶ Read Aloud
        </button>
      </div>

      {panelOpen ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/75 px-4 py-8 text-zinc-100"
          onClick={() => setPanelOpen(false)}
        >
          <div
            className="w-full max-w-3xl rounded-3xl border border-zinc-700 bg-zinc-950/95 p-6 shadow-2xl shadow-black/50"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-2xl font-semibold text-white">Read Aloud Controls</h3>
                <p className="mt-1 text-sm text-zinc-400">Use the controls below while the article is being read.</p>
              </div>
              <button
                type="button"
                onClick={() => setPanelOpen(false)}
                className="rounded-full border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-200 transition hover:border-themeOrange hover:text-themeOrange"
              >
                Close
              </button>
            </div>

            <div className="grid gap-5 md:grid-cols-[1fr_auto]">
              <div className="space-y-4 rounded-3xl border border-zinc-700 bg-black/40 p-5 text-sm text-zinc-300">
                <div className="flex flex-col gap-2">
                  <span className="text-xs uppercase tracking-[0.2em] text-zinc-400">Status</span>
                  <span className="text-lg font-semibold text-white">{statusLabels[status] ?? "Stopped"}</span>
                </div>
                {errorMessage ? <p className="text-sm text-red-400">{errorMessage}</p> : null}

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="flex flex-col gap-2 text-sm text-zinc-300">
                    <span className="font-semibold text-zinc-100">Reading Speed</span>
                    <input
                      type="range"
                      min={0.5}
                      max={2}
                      step={0.1}
                      value={rate}
                      onChange={(event) => setRate(Number(event.target.value))}
                      className="h-2 cursor-pointer appearance-none rounded-full bg-zinc-700 accent-themeOrange"
                    />
                    <span className="text-xs text-zinc-400">{rate.toFixed(1)}x</span>
                  </label>
                  <label className="flex flex-col gap-2 text-sm text-zinc-300">
                    <span className="font-semibold text-zinc-100">Voice Selection</span>
                    <select
                      value={selectedVoiceIndex}
                      onChange={(event) => setVoiceIndex(Number(event.target.value))}
                      disabled={!availableVoices.length}
                      className="rounded-2xl border border-zinc-700 bg-zinc-900 px-3 py-3 text-sm text-zinc-100 outline-none transition duration-300 focus:border-themeOrange"
                    >
                      {availableVoices.length > 0 ? (
                        availableVoices.map((option, index) => (
                          <option key={option.label} value={index} className="bg-zinc-900 text-zinc-100">
                            {option.label}
                          </option>
                        ))
                      ) : (
                        <option value={0}>No voices available</option>
                      )}
                    </select>
                  </label>
                </div>
              </div>

              <div className="flex flex-col gap-3 rounded-3xl border border-zinc-700 bg-zinc-900/90 p-5 text-right">
                <button
                  type="button"
                  onClick={handlePrimaryAction}
                  disabled={status === "unsupported"}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-themeOrange px-5 py-4 text-sm font-semibold text-white transition duration-300 hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <span className="text-lg">{status === "reading" ? "❚❚" : "▶"}</span>
                  {actionLabel}
                </button>
                <button
                  type="button"
                  onClick={stop}
                  disabled={status === "stopped" || status === "unsupported"}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-zinc-700 bg-zinc-800 px-5 py-4 text-sm font-semibold text-zinc-100 transition duration-300 hover:border-themeOrange hover:text-themeOrange disabled:cursor-not-allowed disabled:opacity-45"
                >
                  ■ Stop
                </button>
                <p className="text-left text-xs uppercase tracking-[0.2em] text-zinc-500">
                  Starting a new article automatically stops any previous reading session.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-6">{children}</div>
    </section>
  )
}

export default ArticleReader
