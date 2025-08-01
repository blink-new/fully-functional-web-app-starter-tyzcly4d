import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Badge } from './ui/badge'
import { Avatar, AvatarFallback } from './ui/avatar'
import { 
  Plus, 
  Search, 
  Filter, 
  MoreHorizontal,
  Calendar,
  CheckSquare,
  Clock,
  AlertCircle,
  User
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import { TaskDialog } from './TaskDialog'
import { blink } from '../blink/client'
import { format } from 'date-fns'
import { useToast } from '../hooks/use-toast'

interface Task {
  id: string
  title: string
  description?: string
  status: 'todo' | 'in_progress' | 'done'
  priority: 'low' | 'medium' | 'high'
  due_date?: string
  project_id?: string
  user_id: string
  assignee_id?: string
  assignee_email?: string
  created_at: string
  updated_at: string
}

export function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const { toast } = useToast()

  const loadTasks = useCallback(async () => {
    try {
      const user = await blink.auth.me()
      
      // Load tasks created by user OR assigned to user
      const allTasks = await blink.db.tasks.list({
        where: {
          OR: [
            { user_id: user.id },
            { assignee_id: user.id }
          ]
        },
        orderBy: { created_at: 'desc' }
      })
      setTasks(allTasks)
    } catch (error) {
      console.error('Failed to load tasks:', error)
      toast({
        title: "Error",
        description: "Failed to load tasks. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadTasks()
  }, [loadTasks])

  const handleCreateTask = async (taskData: Partial<Task>) => {
    try {
      const user = await blink.auth.me()
      const newTask = await blink.db.tasks.create({
        id: `task_${Date.now()}`,
        title: taskData.title!,
        description: taskData.description || '',
        status: taskData.status || 'todo',
        priority: taskData.priority || 'medium',
        due_date: taskData.due_date || null,
        project_id: taskData.project_id || null,
        user_id: user.id,
        assignee_id: taskData.assignee_id || null,
        assignee_email: taskData.assignee_email || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      
      setTasks(prev => [newTask, ...prev])

      // Send notification if task is assigned to someone
      if (taskData.assignee_id && taskData.assignee_id !== user.id) {
        await blink.db.notifications.create({
          user_id: taskData.assignee_id,
          type: 'task_assigned',
          title: 'New Task Assigned',
          message: `${user.email} assigned you a task: "${taskData.title}"`,
          data: JSON.stringify({ task_id: newTask.id, assigner: user.email })
        })

        // Send email notification
        if (taskData.assignee_email) {
          await blink.notifications.email({
            to: taskData.assignee_email,
            subject: `New Task Assigned: ${taskData.title}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2563eb;">New Task Assigned</h2>
                <p><strong>${user.email}</strong> has assigned you a new task:</p>
                <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; margin: 16px 0;">
                  <h3 style="margin: 0 0 8px 0;">${taskData.title}</h3>
                  ${taskData.description ? `<p style="margin: 0; color: #666;">${taskData.description}</p>` : ''}
                  <p style="margin: 8px 0 0 0; font-size: 14px;">
                    <strong>Priority:</strong> ${taskData.priority || 'medium'} | 
                    <strong>Status:</strong> ${taskData.status || 'todo'}
                    ${taskData.due_date ? ` | <strong>Due:</strong> ${taskData.due_date}` : ''}
                  </p>
                </div>
                <p><a href="https://fully-functional-web-app-starter-tyzcly4d.sites.blink.new" style="color: #2563eb;">View in TaskFlow</a></p>
              </div>
            `,
            text: `${user.email} has assigned you a new task: "${taskData.title}". View it in TaskFlow.`
          })
        }
      }
      
      toast({
        title: "Success",
        description: taskData.assignee_email ? 
          `Task created and assigned to ${taskData.assignee_email}` : 
          "Task created successfully!",
      })
    } catch (error) {
      console.error('Failed to create task:', error)
      toast({
        title: "Error",
        description: "Failed to create task. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleUpdateTask = async (taskId: string, updates: Partial<Task>) => {
    try {
      const user = await blink.auth.me()
      const originalTask = tasks.find(t => t.id === taskId)
      
      await blink.db.tasks.update(taskId, {
        ...updates,
        updated_at: new Date().toISOString()
      })
      
      setTasks(prev => prev.map(task => 
        task.id === taskId ? { ...task, ...updates } : task
      ))

      // Check if task was completed and notify the creator
      if (updates.status === 'done' && originalTask?.status !== 'done' && 
          originalTask?.user_id && originalTask.user_id !== user.id) {
        
        await blink.db.notifications.create({
          user_id: originalTask.user_id,
          type: 'task_completed',
          title: 'Task Completed',
          message: `${user.email} completed the task: "${originalTask.title}"`,
          data: JSON.stringify({ task_id: taskId, completer: user.email })
        })

        // Send email notification to task creator
        const creator = await blink.auth.me() // This would need to be the creator's info
        await blink.notifications.email({
          to: originalTask.user_id, // This should be creator's email
          subject: `Task Completed: ${originalTask.title}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #22c55e;">Task Completed! ✅</h2>
              <p><strong>${user.email}</strong> has completed the task:</p>
              <div style="background: #f0fdf4; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #22c55e;">
                <h3 style="margin: 0 0 8px 0;">${originalTask.title}</h3>
                ${originalTask.description ? `<p style="margin: 0; color: #666;">${originalTask.description}</p>` : ''}
              </div>
              <p><a href="https://fully-functional-web-app-starter-tyzcly4d.sites.blink.new" style="color: #2563eb;">View in TaskFlow</a></p>
            </div>
          `,
          text: `${user.email} has completed the task: "${originalTask.title}". View it in TaskFlow.`
        })
      }
      
      toast({
        title: "Success",
        description: "Task updated successfully!",
      })
    } catch (error) {
      console.error('Failed to update task:', error)
      toast({
        title: "Error",
        description: "Failed to update task. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    try {
      await blink.db.tasks.delete(taskId)
      setTasks(prev => prev.filter(task => task.id !== taskId))
      toast({
        title: "Success",
        description: "Task deleted successfully!",
      })
    } catch (error) {
      console.error('Failed to delete task:', error)
      toast({
        title: "Error",
        description: "Failed to delete task. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleStatusChange = async (taskId: string, newStatus: Task['status']) => {
    await handleUpdateTask(taskId, { status: newStatus })
  }

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         task.description?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === 'all' || task.status === statusFilter
    const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter
    
    return matchesSearch && matchesStatus && matchesPriority
  })

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'low': return 'bg-green-100 text-green-800 border-green-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'done': return 'bg-green-100 text-green-800 border-green-200'
      case 'in_progress': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'todo': return 'bg-gray-100 text-gray-800 border-gray-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'done': return <CheckSquare className="w-4 h-4" />
      case 'in_progress': return <Clock className="w-4 h-4" />
      case 'todo': return <AlertCircle className="w-4 h-4" />
      default: return <AlertCircle className="w-4 h-4" />
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 bg-muted rounded w-32 animate-pulse"></div>
          <div className="h-10 bg-muted rounded w-24 animate-pulse"></div>
        </div>
        <div className="grid gap-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-muted rounded w-1/2 mb-2"></div>
                <div className="h-3 bg-muted rounded w-3/4"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Tasks</h1>
          <p className="text-muted-foreground mt-1">Manage and track your tasks</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New Task
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search tasks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Status Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full sm:w-auto">
                  <Filter className="w-4 h-4 mr-2" />
                  Status: {statusFilter === 'all' ? 'All' : statusFilter.replace('_', ' ')}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setStatusFilter('all')}>All</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('todo')}>To Do</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('in_progress')}>In Progress</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('done')}>Done</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Priority Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full sm:w-auto">
                  <Filter className="w-4 h-4 mr-2" />
                  Priority: {priorityFilter === 'all' ? 'All' : priorityFilter}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setPriorityFilter('all')}>All</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setPriorityFilter('high')}>High</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setPriorityFilter('medium')}>Medium</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setPriorityFilter('low')}>Low</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>

      {/* Tasks List */}
      <div className="grid gap-4">
        {filteredTasks.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <CheckSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                {searchQuery || statusFilter !== 'all' || priorityFilter !== 'all' 
                  ? 'No tasks match your filters' 
                  : 'No tasks yet'
                }
              </h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery || statusFilter !== 'all' || priorityFilter !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Create your first task to get started!'
                }
              </p>
              {!searchQuery && statusFilter === 'all' && priorityFilter === 'all' && (
                <Button onClick={() => setIsDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Task
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          filteredTasks.map((task) => (
            <Card key={task.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="font-semibold text-foreground">{task.title}</h3>
                      <Badge className={getPriorityColor(task.priority)}>
                        {task.priority}
                      </Badge>
                      <Badge className={getStatusColor(task.status)}>
                        <span className="flex items-center space-x-1">
                          {getStatusIcon(task.status)}
                          <span>{task.status.replace('_', ' ')}</span>
                        </span>
                      </Badge>
                    </div>
                    
                    {task.description && (
                      <p className="text-muted-foreground mb-3">{task.description}</p>
                    )}
                    
                    <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                      <span>Created {format(new Date(task.created_at), 'MMM d, yyyy')}</span>
                      {task.due_date && (
                        <span className="flex items-center">
                          <Calendar className="w-3 h-3 mr-1" />
                          Due {format(new Date(task.due_date), 'MMM d, yyyy')}
                        </span>
                      )}
                      {task.assignee_email && (
                        <span className="flex items-center">
                          <Avatar className="w-4 h-4 mr-1">
                            <AvatarFallback className="text-xs">
                              {task.assignee_email.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span>Assigned to {task.assignee_email.split('@')[0]}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => {
                        setEditingTask(task)
                        setIsDialogOpen(true)
                      }}>
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleStatusChange(task.id, 'todo')}>
                        Mark as To Do
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleStatusChange(task.id, 'in_progress')}>
                        Mark as In Progress
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleStatusChange(task.id, 'done')}>
                        Mark as Done
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleDeleteTask(task.id)}
                        className="text-destructive"
                      >
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Task Dialog */}
      <TaskDialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open)
          if (!open) setEditingTask(null)
        }}
        task={editingTask}
        onSave={editingTask ? 
          (data) => handleUpdateTask(editingTask.id, data) : 
          handleCreateTask
        }
      />
    </div>
  )
}