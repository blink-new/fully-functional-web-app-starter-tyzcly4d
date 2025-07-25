import { useState, useEffect, useCallback } from 'react'
import { blink } from '../blink/client'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Avatar, AvatarFallback } from './ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'
import { Label } from './ui/label'
import { Users, UserPlus, Check, X, Mail } from 'lucide-react'
import { useToast } from '../hooks/use-toast'

interface Connection {
  id: string
  requester_id: string
  recipient_id: string
  status: string
  created_at: string
  requester_email?: string
  recipient_email?: string
}

interface TeamMember {
  id: string
  email: string
  display_name?: string
}

export function TeamPage() {
  const [connections, setConnections] = useState<Connection[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [pendingRequests, setPendingRequests] = useState<Connection[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const { toast } = useToast()

  const loadTeamData = useCallback(async () => {
    try {
      const user = await blink.auth.me()
      
      // Load connections where user is requester or recipient
      const allConnections = await blink.db.user_connections.list({
        where: {
          OR: [
            { requester_id: user.id },
            { recipient_id: user.id }
          ]
        },
        orderBy: { created_at: 'desc' }
      })

      setConnections(allConnections)

      // Filter accepted connections to get team members
      const acceptedConnections = allConnections.filter(conn => conn.status === 'accepted')
      const members: TeamMember[] = []
      
      for (const conn of acceptedConnections) {
        const memberId = conn.requester_id === user.id ? conn.recipient_id : conn.requester_id
        const memberEmail = conn.requester_id === user.id ? conn.recipient_email : conn.requester_email
        
        if (memberId && memberEmail) {
          members.push({
            id: memberId,
            email: memberEmail,
            display_name: memberEmail.split('@')[0]
          })
        }
      }
      
      setTeamMembers(members)

      // Filter pending requests where current user is recipient
      const pending = allConnections.filter(conn => 
        conn.status === 'pending' && conn.recipient_id === user.id
      )
      setPendingRequests(pending)

    } catch (error) {
      console.error('Error loading team data:', error)
      toast({
        title: "Error",
        description: "Failed to load team data",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadTeamData()
  }, [loadTeamData])

  const sendInvite = async () => {
    if (!inviteEmail.trim()) return

    try {
      const user = await blink.auth.me()
      
      // Check if connection already exists
      const existingConnection = await blink.db.user_connections.list({
        where: {
          AND: [
            { requester_id: user.id },
            { recipient_email: inviteEmail }
          ]
        }
      })

      if (existingConnection.length > 0) {
        toast({
          title: "Already Connected",
          description: "You've already sent an invite to this user",
          variant: "destructive"
        })
        return
      }

      // Create connection request
      await blink.db.user_connections.create({
        requester_id: user.id,
        recipient_email: inviteEmail,
        requester_email: user.email,
        status: 'pending'
      })

      // Send notification email
      await blink.notifications.email({
        to: inviteEmail,
        subject: `${user.email} invited you to join their TaskFlow team`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">You're invited to join TaskFlow!</h2>
            <p><strong>${user.email}</strong> has invited you to collaborate on TaskFlow.</p>
            <p>Sign up at <a href="https://fully-functional-web-app-starter-tyzcly4d.sites.blink.new">TaskFlow</a> to accept the invitation and start collaborating!</p>
            <p style="color: #666; font-size: 14px;">TaskFlow - Modern Task Management</p>
          </div>
        `,
        text: `${user.email} has invited you to join their TaskFlow team. Sign up at TaskFlow to accept the invitation!`
      })

      toast({
        title: "Invite Sent!",
        description: `Invitation sent to ${inviteEmail}`
      })

      setInviteEmail('')
      setInviteDialogOpen(false)
      loadTeamData()

    } catch (error) {
      console.error('Error sending invite:', error)
      toast({
        title: "Error",
        description: "Failed to send invite",
        variant: "destructive"
      })
    }
  }

  const respondToRequest = async (connectionId: string, accept: boolean) => {
    try {
      const user = await blink.auth.me()
      
      await blink.db.user_connections.update(connectionId, {
        status: accept ? 'accepted' : 'rejected',
        recipient_id: user.id,
        updated_at: new Date().toISOString()
      })

      if (accept) {
        // Create notification for requester
        const connection = pendingRequests.find(req => req.id === connectionId)
        if (connection) {
          await blink.db.notifications.create({
            user_id: connection.requester_id,
            type: 'connection_accepted',
            title: 'Connection Accepted',
            message: `${user.email} accepted your team invitation`,
            data: JSON.stringify({ connection_id: connectionId })
          })
        }
      }

      toast({
        title: accept ? "Request Accepted" : "Request Declined",
        description: accept ? "You're now connected!" : "Request declined"
      })

      loadTeamData()

    } catch (error) {
      console.error('Error responding to request:', error)
      toast({
        title: "Error",
        description: "Failed to respond to request",
        variant: "destructive"
      })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Team</h1>
          <p className="text-muted-foreground">Manage your team and collaborate on tasks</p>
        </div>
        <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Invite Member
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite Team Member</DialogTitle>
              <DialogDescription>
                Send an invitation to collaborate on tasks
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="colleague@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={sendInvite}>Send Invite</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="members" className="space-y-4">
        <TabsList>
          <TabsTrigger value="members">Team Members</TabsTrigger>
          <TabsTrigger value="requests">
            Pending Requests
            {pendingRequests.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {pendingRequests.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="space-y-4">
          {teamMembers.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No team members yet</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Invite colleagues to collaborate on tasks and projects
                </p>
                <Button onClick={() => setInviteDialogOpen(true)}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Invite Your First Member
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {teamMembers.map((member) => (
                <Card key={member.id}>
                  <CardContent className="flex items-center space-x-4 p-6">
                    <Avatar>
                      <AvatarFallback>
                        {member.display_name?.charAt(0).toUpperCase() || member.email.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {member.display_name || member.email.split('@')[0]}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        {member.email}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="requests" className="space-y-4">
          {pendingRequests.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Mail className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No pending requests</h3>
                <p className="text-muted-foreground text-center">
                  Team invitations will appear here
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {pendingRequests.map((request) => (
                <Card key={request.id}>
                  <CardHeader>
                    <CardTitle className="text-lg">Team Invitation</CardTitle>
                    <CardDescription>
                      <strong>{request.requester_email}</strong> wants to collaborate with you
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex space-x-2">
                      <Button 
                        size="sm" 
                        onClick={() => respondToRequest(request.id, true)}
                      >
                        <Check className="mr-2 h-4 w-4" />
                        Accept
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => respondToRequest(request.id, false)}
                      >
                        <X className="mr-2 h-4 w-4" />
                        Decline
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}