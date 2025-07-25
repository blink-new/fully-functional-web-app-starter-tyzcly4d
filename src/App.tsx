import { useState, useEffect } from 'react'
import { blink } from './blink/client'
import { Dashboard } from './components/Dashboard'
import { TasksPage } from './components/TasksPage'
import { ProjectsPage } from './components/ProjectsPage'
import { SettingsPage } from './components/SettingsPage'
import { ProfilePage } from './components/ProfilePage'
import { Sidebar } from './components/Sidebar'
import { Header } from './components/Header'
import { Toaster } from './components/ui/toaster'

type Page = 'dashboard' | 'tasks' | 'projects' | 'settings' | 'profile'

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState<Page>('dashboard')

  useEffect(() => {
    const unsubscribe = blink.auth.onAuthStateChanged((state) => {
      setUser(state.user)
      setLoading(state.isLoading)
    })
    return unsubscribe
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-muted-foreground">Loading TaskFlow...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-8">
          <div className="space-y-4">
            <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-foreground">TaskFlow</h1>
            <p className="text-muted-foreground">Modern task management for productive teams</p>
          </div>
          
          <div className="space-y-4">
            <button
              onClick={() => blink.auth.login()}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-3 px-6 rounded-lg transition-colors"
            >
              Sign In to Continue
            </button>
            <p className="text-sm text-muted-foreground">
              Secure authentication powered by Blink
            </p>
          </div>
        </div>
      </div>
    )
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />
      case 'tasks':
        return <TasksPage />
      case 'projects':
        return <ProjectsPage />
      case 'settings':
        return <SettingsPage />
      case 'profile':
        return <ProfilePage />
      default:
        return <Dashboard />
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        <Sidebar currentPage={currentPage} onPageChange={setCurrentPage} />
        <div className="flex-1 flex flex-col min-h-screen">
          <Header user={user} />
          <main className="flex-1 p-6">
            {renderPage()}
          </main>
        </div>
      </div>
      <Toaster />
    </div>
  )
}

export default App