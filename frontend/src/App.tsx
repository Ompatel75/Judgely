import React, { useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Navbar } from './components/layout/Navbar'
import { Footer } from './components/layout/Footer'
import { ErrorBoundary } from './components/layout/ErrorBoundary'
import { LandingPage } from './pages/LandingPage'
import { ProblemsPage } from './pages/ProblemsPage'
import { ProblemDetailPage } from './pages/ProblemDetailPage'
import { SubmissionsPage } from './pages/SubmissionsPage'
import { ProfilePage } from './pages/ProfilePage'
import { AuthPage } from './pages/AuthPage'
import { useAuthStore } from './store/authStore'

export const App: React.FC = () => {
  const location = useLocation()
  const { initAuth } = useAuthStore()

  useEffect(() => {
    initAuth()
  }, [initAuth])

  // Is problem detail page? (it manages its own vertical height without full footer)
  const isProblemDetailPage = location.pathname.startsWith('/problems/') && location.pathname !== '/problems'

  return (
    <ErrorBoundary>
      <div className="min-h-screen flex flex-col bg-[#0B0D10] text-[#E6E8EB]">
        <Navbar />

        <main className="flex-1 flex flex-col">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="flex-1 flex flex-col"
            >
              <Routes location={location}>
                <Route path="/" element={<LandingPage />} />
                <Route path="/problems" element={<ProblemsPage />} />
                <Route path="/problems/:id" element={<ProblemDetailPage />} />
                <Route path="/submissions" element={<SubmissionsPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/auth" element={<AuthPage />} />
                <Route path="*" element={<LandingPage />} />
              </Routes>
            </motion.div>
          </AnimatePresence>
        </main>

        {!isProblemDetailPage && <Footer />}
      </div>
    </ErrorBoundary>
  )
}
