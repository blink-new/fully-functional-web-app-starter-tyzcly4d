import { useState, useEffect, useCallback } from 'react'
import { blink } from '../blink/client'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { ScrollArea } from './ui/scroll-area'
import { Bell, Check, CheckCheck, Users, ClipboardList } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useToast } from '../hooks/use-toast'

interface Notification {
  id: string
  user_id: string
  type: string
  title: string
  message: string
  data?: string
  read: number
  created_at: string
}

export function NotificationCenter() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const loadNotifications = useCallback(async () => {
    try {
      const user = await blink.auth.me()
      
      const userNotifications = await blink.db.notifications.list({
        where: { user_id: user.id },
        orderBy: { created_at: 'desc' },
        limit: 50
      })

      setNotifications(userNotifications)
      setUnreadCount(userNotifications.filter(n => Number(n.read) === 0).length)

    } catch (error) {
      console.error('Error loading notifications:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadNotifications()
    
    // Poll for new notifications every 30 seconds
    const interval = setInterval(loadNotifications, 30000)
    return () => clearInterval(interval)
  }, [loadNotifications])

  const markAsRead = async (notificationId: string) => {
    try {
      await blink.db.notifications.update(notificationId, {
        read: 1
      })

      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, read: 1 } : n)
      )
      setUnreadCount(prev => Math.max(0, prev - 1))

    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  const markAllAsRead = async () => {
    try {
      const user = await blink.auth.me()
      const unreadNotifications = notifications.filter(n => Number(n.read) === 0)
      
      for (const notification of unreadNotifications) {
        await blink.db.notifications.update(notification.id, {
          read: 1
        })
      }

      setNotifications(prev => 
        prev.map(n => ({ ...n, read: 1 }))
      )
      setUnreadCount(0)

      toast({
        title: "All notifications marked as read"
      })

    } catch (error) {
      console.error('Error marking all as read:', error)
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'task_assigned':
        return <ClipboardList className="h-4 w-4 text-blue-500" />
      case 'task_completed':
        return <Check className="h-4 w-4 text-green-500" />
      case 'connection_accepted':
        return <Users className="h-4 w-4 text-purple-500" />
      default:
        return <Bell className="h-4 w-4 text-gray-500" />
    }
  }

  if (loading) {
    return (
      <Button variant="ghost" size="sm" disabled>
        <Bell className="h-4 w-4" />
      </Button>
    )
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllAsRead}>
              <CheckCheck className="h-4 w-4 mr-1" />
              Mark all read
            </Button>
          )}
        </div>
        
        <ScrollArea className="h-96">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Bell className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No notifications yet</p>
            </div>
          ) : (
            <div className="space-y-1 p-2">
              {notifications.map((notification) => (
                <Card 
                  key={notification.id}
                  className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                    Number(notification.read) === 0 ? 'bg-blue-50 border-blue-200' : ''
                  }`}
                  onClick={() => Number(notification.read) === 0 && markAsRead(notification.id)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 mt-1">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium truncate">
                            {notification.title}
                          </p>
                          {Number(notification.read) === 0 && (
                            <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 ml-2" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {notification.message}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}