import { AnimatePresence, motion } from 'motion/react'

interface ExitModalProps {
  open: boolean
  onContinue: () => void
  onClose: () => void
}

export default function ExitModal({ open, onContinue, onClose }: ExitModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl px-6 pt-8 pb-10 max-h-[55dvh] overflow-y-auto"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300, mass: 0.9 }}
          >
            <div className="w-10 h-1 rounded-full bg-stone-300 mx-auto mb-6" />

            <h2 className="font-display text-2xl text-foreground leading-tight mb-3">
              ¿Vas a dejarlo pasar de nuevo?
            </h2>

            <p className="font-body text-sm text-muted-foreground leading-relaxed mb-8">
              El problema con tus uñas suele empeorar si no se atiende a tiempo.
              Estamos aquí para ayudarte a recuperar la salud de tus pies.
            </p>

            <button
              onClick={onContinue}
              className="w-full py-4 rounded-xl bg-accent text-primary-foreground font-body font-medium text-sm tracking-[0.06em] transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              Continuar con mi tratamiento
            </button>

            <button
              onClick={onClose}
              className="w-full py-3 mt-2 text-center text-sm text-muted-foreground/60 font-body underline underline-offset-2 transition-colors hover:text-muted-foreground"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              Salir por ahora
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
