import { useCallback, useEffect, useMemo, useRef, useState } from "react"

type ReaderStatus =
  | "stopped"
  | "reading"
  | "paused"
  | "unsupported"
  | "loading"
  | "error"

interface VoiceOption {
  voice: SpeechSynthesisVoice
  label: string
}

interface UseSpeechSynthesisOptions {
  articleId: string
  text: string
  initialRate?: number
}

interface UseSpeechSynthesisResult {
  status: ReaderStatus
  availableVoices: VoiceOption[]
  selectedVoiceIndex: number
  rate: number
  errorMessage?: string
  speak: () => void
  pause: () => void
  resume: () => void
  stop: () => void
  setVoiceIndex: (index: number) => void
  setRate: (newRate: number) => void
}

const speechEventTarget = new EventTarget()
let activeSpeechController: {
  readerId: string
  stop: () => void
} | null = null

function broadcastSpeechEvent(detail: { type: "started" | "stopped"; readerId: string }) {
  speechEventTarget.dispatchEvent(new CustomEvent("speech-change", { detail }))
}

function claimSpeechController(readerId: string, stop: () => void) {
  if (activeSpeechController?.readerId !== readerId) {
    activeSpeechController?.stop()
  }
  activeSpeechController = { readerId, stop }
  broadcastSpeechEvent({ type: "started", readerId })
}

function releaseSpeechController(readerId: string) {
  if (activeSpeechController?.readerId === readerId) {
    activeSpeechController = null
  }
  broadcastSpeechEvent({ type: "stopped", readerId })
}

function loadAvailableVoices() {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    return []
  }
  return window.speechSynthesis.getVoices().map((voice) => ({
    voice,
    label: `${voice.name} · ${voice.lang}${voice.default ? " · Default" : ""}`,
  }))
}

export default function useSpeechSynthesis({ articleId, text, initialRate = 1 }: UseSpeechSynthesisOptions): UseSpeechSynthesisResult {
  const synthSupported = typeof window !== "undefined" && "speechSynthesis" in window
  const [status, setStatus] = useState<ReaderStatus>(synthSupported ? "stopped" : "unsupported")
  const [availableVoices, setAvailableVoices] = useState<VoiceOption[]>([])
  const [selectedVoiceIndex, setSelectedVoiceIndex] = useState(0)
  const [rate, setRate] = useState(initialRate)
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  const synth = useMemo(() => {
    return synthSupported ? window.speechSynthesis : null
  }, [synthSupported])

  const cleanup = useCallback(() => {
    utteranceRef.current = null
    releaseSpeechController(articleId)
  }, [articleId])

  const loadVoices = useCallback(() => {
    if (!synth) {
      setAvailableVoices([])
      return
    }

    const voices = loadAvailableVoices()

    if (voices.length > 0) {
      setAvailableVoices(voices)
      setErrorMessage(undefined)
    }
  }, [synth])

  useEffect(() => {
    if (!synthSupported) {
      setErrorMessage("Speech synthesis is not supported in this browser.")
      return
    }

    loadVoices()
    const handleVoiceChange = () => loadVoices()
    window.speechSynthesis.addEventListener("voiceschanged", handleVoiceChange)

    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", handleVoiceChange)
      cleanup()
    }
  }, [loadVoices, synthSupported, cleanup])

  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent).detail as { type: "started" | "stopped"; readerId: string }
      if (detail.readerId === articleId) {
        return
      }

      if (detail.type === "started") {
        setStatus("stopped")
        cleanup()
      }
    }

    speechEventTarget.addEventListener("speech-change", listener)
    return () => speechEventTarget.removeEventListener("speech-change", listener)
  }, [articleId, cleanup])

  const updateVoiceIndex = useCallback((index: number) => {
    setSelectedVoiceIndex(index)
    if (availableVoices[index] == null) {
      setErrorMessage(undefined)
    }
  }, [availableVoices])

  const createUtterance = useCallback(() => {
    if (!synthSupported || !synth) {
      return null
    }

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = rate

    const voiceOption = availableVoices[selectedVoiceIndex]
    if (voiceOption?.voice) {
      utterance.voice = voiceOption.voice
    }

    utterance.onend = () => {
      setStatus("stopped")
      cleanup()
    }

    utterance.onerror = () => {
      setStatus("error")
      setErrorMessage("The browser failed to read the article aloud. Try a different voice or refresh the page.")
      cleanup()
    }

    return utterance
  }, [availableVoices, rate, selectedVoiceIndex, synth, synthSupported, text, cleanup])

  const speak = useCallback(() => {
    if (!synthSupported || !synth) {
      setStatus("unsupported")
      setErrorMessage("Speech synthesis is not supported in this browser.")
      return
    }

    if (status === "paused" && synth.paused) {
      claimSpeechController(articleId, () => {
        synth.cancel()
        setStatus("stopped")
        cleanup()
      })
      synth.resume()
      setStatus("reading")
      return
    }

    if (synth.speaking) {
      synth.cancel()
    }

    const utterance = createUtterance()
    if (!utterance) {
      return
    }

    utteranceRef.current = utterance
    claimSpeechController(articleId, () => {
      synth.cancel()
      setStatus("stopped")
      cleanup()
    })

    synth.speak(utterance)
    setStatus("reading")
    setErrorMessage(undefined)
  }, [articleId, cleanup, createUtterance, status, synth, synthSupported])

  const pause = useCallback(() => {
    if (!synth || !synthSupported || !synth.speaking || synth.paused) {
      return
    }

    synth.pause()
    setStatus("paused")
  }, [synth, synthSupported])

  const resume = useCallback(() => {
    if (!synth || !synthSupported || !synth.paused) {
      return
    }

    claimSpeechController(articleId, () => {
      synth.cancel()
      setStatus("stopped")
      cleanup()
    })
    synth.resume()
    setStatus("reading")
  }, [articleId, cleanup, synth, synthSupported])

  const stop = useCallback(() => {
    if (!synth || !synthSupported) {
      return
    }

    if (synth.speaking || synth.paused) {
      synth.cancel()
    }

    setStatus("stopped")
    cleanup()
  }, [cleanup, synth, synthSupported])

  return {
    status,
    availableVoices,
    selectedVoiceIndex,
    rate,
    errorMessage,
    speak,
    pause,
    resume,
    stop,
    setVoiceIndex: updateVoiceIndex,
    setRate,
  }
}
