import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'

import Landing from './pages/Landing'
import Quiz from './pages/Quiz'
import Result from './pages/Result'
import { EMPTY_ANSWERS, type Answers } from './types'

type Screen = 'landing' | 'quiz' | 'result'

const fade = {
  initial: { opacity: 0, scale: 0.99 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 1.01 },
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('landing')
  // Kept between runs so "Try again" reopens the quiz with the last answers.
  const [answers, setAnswers] = useState<Answers>(EMPTY_ANSWERS)
  // Forces a fresh Quiz mount so its internal step resets on every retry.
  const [quizRun, setQuizRun] = useState(0)

  return (
    <AnimatePresence mode="wait">
      <motion.div key={screen} {...fade} transition={{ duration: 0.3, ease: 'easeOut' }}>
        {screen === 'landing' && (
          <Landing
            onStart={() => {
              setQuizRun((n) => n + 1)
              setScreen('quiz')
            }}
          />
        )}

        {screen === 'quiz' && (
          <Quiz
            key={quizRun}
            initial={answers}
            onDone={(a) => {
              setAnswers(a)
              setScreen('result')
            }}
            onQuit={() => setScreen('landing')}
          />
        )}

        {screen === 'result' && (
          <Result
            answers={answers}
            onRetry={() => {
              setQuizRun((n) => n + 1)
              setScreen('quiz')
            }}
            onHome={() => setScreen('landing')}
          />
        )}
      </motion.div>
    </AnimatePresence>
  )
}
