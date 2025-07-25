import { 
  LayoutDashboard, 
  CheckSquare, 
  FolderOpen, 
  Settings, 
  User,
  Users,
  Plus
} from 'lucide-react'
import { Button } from './ui/button'
import { cn } from '../lib/utils'

type Page = 'dashboard' | 'tasks' | 'projects' | 'team' | 'settings' | 'profile'

interface SidebarProps {
  currentPage: Page
  onPageChange: (page: Page) => void
}

const navigation = [
  { id: 'dashboard' as Page, label: 'Dashboard', icon: LayoutDashboard },
  { id: 'tasks' as Page, label: 'Tasks', icon: CheckSquare },
  { id: 'projects' as Page, label: 'Projects', icon: FolderOpen },
  { id: 'team' as Page, label: 'Team', icon: Users },
  { id: 'settings' as Page, label: 'Settings', icon: Settings },
  { id: 'profile' as Page, label: 'Profile', icon: User },
]

export function Sidebar({ currentPage, onPageChange }: SidebarProps) {
  return (
    <div className="w-64 bg-card border-r border-border flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <CheckSquare className="w-4 h-4 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-bold text-foreground">TaskFlow</h1>
        </div>
      </div>

      {/* Quick Add Button */}
      <div className="p-4">
        <Button className="w-full justify-start" size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Quick Add Task
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 space-y-1">
        {navigation.map((item) => {
          const Icon = item.icon
          const isActive = currentPage === item.id
          
          return (
            <button
              key={item.id}
              onClick={() => onPageChange(item.id)}
              className={cn(
                "w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive 
                  ? "bg-primary text-primary-foreground" 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-border">
        <div className="text-xs text-muted-foreground text-center">
          TaskFlow v1.0
        </div>
      </div>
    </div>
  )
}