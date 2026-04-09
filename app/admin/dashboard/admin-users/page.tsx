"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Trash2, UserPlus, UserX, UserCheck, KeyRound } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { deleteAdminUserAction } from "@/app/actions/admin"
import { promoteUserAction, addAdminUserAction, toggleAdminStatusAction, getAdminUsersAction } from "@/app/actions/admin-users"

interface AdminUser {
  id: string
  name: string
  email: string
  role: "admin" | "sub_admin" | "order_management"
  status: "active" | "blocked"
  created_at: string
}

interface RegularUser {
  id: string
  name: string
  email: string
  created_at: string
}

export default function AdminUsersPage() {
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([])
  const [regularUsers, setRegularUsers] = useState<RegularUser[]>([])
  const [eligibleUsers, setEligibleUsers] = useState<RegularUser[]>([])
  const [currentUser, setCurrentUser] = useState<{ name: string; email: string; role: string } | null>(null)
  const [newAdminName, setNewAdminName] = useState("")
  const [newAdminEmail, setNewAdminEmail] = useState("")
  const [newAdminPassword, setNewAdminPassword] = useState("")
  const [newAdminRole, setNewAdminRole] = useState<"sub_admin" | "order_management">("sub_admin")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const [isPromoteDialogOpen, setIsPromoteDialogOpen] = useState(false)
  const [promoteUserEmail, setPromoteUserEmail] = useState("")
  const [promoteUserRole, setPromoteUserRole] = useState<"sub_admin" | "order_management">("sub_admin")

  useEffect(() => {
    // Get current user from both possible storage locations
    const adminUserJson = localStorage.getItem("admin_user")
    const sessionJson = localStorage.getItem("byiora_admin_session")

    if (adminUserJson) {
      try {
        setCurrentUser(JSON.parse(adminUserJson))
      } catch (e) {
        console.error("Failed to parse admin_user", e)
      }
    } else if (sessionJson) {
      try {
        setCurrentUser(JSON.parse(sessionJson))
      } catch (e) {
        console.error("Failed to parse admin session", e)
      }
    }

    // Load admin users and regular users from Supabase
    loadAdminUsers()
    loadEligibleSubAdmins()
  }, [])

  const loadAdminUsers = async () => {
    try {
      const result = await getAdminUsersAction()

      if (result.error) {
        toast.error(result.error)
        return
      }

      setAdminUsers(result.data || [])
    } catch (error) {
      console.error("Error loading admin users:", error)
      toast.error("Failed to load admin users")
    } finally {
      setIsLoading(false)
    }
  }

  const loadEligibleSubAdmins = async () => {
    try {
      const result = await getAdminUsersAction();
      if (result.error) {
        console.error("Error loading admin users:", result.error);
        return;
      }
      // Only show users who are not already admin or sub_admin
      setEligibleUsers((result.data || []).filter((u: any) => u.role === "order_management"));
    } catch (error) {
      console.error("Error loading eligible sub-admins:", error);
    }
  };

  const handlePromoteUser = async () => {
    if (!promoteUserEmail) {
      toast.error("Please select a user");
      return;
    }
    try {
      // Find the user in admin_users
      const selectedUser = eligibleUsers.find((u) => u.email === promoteUserEmail);
      if (!selectedUser) {
        toast.error("User not found");
        return;
      }
      // Use Server Action with Service Role to bypass RLS
      const result = await promoteUserAction(selectedUser.id, promoteUserRole);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      // Reset form
      setPromoteUserEmail("");
      setPromoteUserRole("sub_admin");
      setIsPromoteDialogOpen(false);
      // Reload admin users
      await loadAdminUsers();
      toast.success(
        `User promoted to ${promoteUserRole === "sub_admin" ? "Sub-admin" : "Order Manager"} successfully!`
      );
    } catch (error) {
      console.error("Error promoting user:", error);
      toast.error("Failed to promote user");
    }
  };

  const handleAddAdmin = async () => {
    if (!newAdminName || !newAdminEmail || !newAdminPassword) {
      toast.error("Please fill in all fields");
      return;
    }
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newAdminEmail)) {
      toast.error("Please enter a valid email address");
      return;
    }
    try {
      // 1. Register user with Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email: newAdminEmail,
        password: newAdminPassword,
      });
      if (error || !data.user) {
        toast.error(error?.message || "Failed to create admin Auth user");
        return;
      }
      const uid = data.user.id;
      // 2. Insert into admin_users using Server Action with Service Role
      const result = await addAdminUserAction(uid, newAdminEmail, newAdminName, newAdminRole);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      // Reset form
      setNewAdminName("");
      setNewAdminEmail("");
      setNewAdminPassword("");
      setNewAdminRole("sub_admin");
      setIsAddDialogOpen(false);
      // Reload admin users
      await loadAdminUsers();
      toast.success("Admin user added successfully");
    } catch (error) {
      console.error("Error adding admin:", error);
      toast.error("Failed to add admin user");
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    // Don't allow toggling the main admin
    const user = adminUsers.find((u) => u.id === id)
    if (user?.role === "admin") {
      toast.error("Cannot modify the main administrator account")
      return
    }

    try {
      // Use Server Action with Service Role to bypass RLS
      const result = await toggleAdminStatusAction(id, currentStatus)

      if (result.error) {
        toast.error(result.error)
        return
      }

      await loadAdminUsers()
      const newStatus = result.newStatus as string
      toast.success(`Admin ${newStatus === "active" ? "unblocked" : "blocked"} successfully`)
    } catch (error) {
      console.error("Error updating admin status:", error)
      toast.error("Failed to update admin status")
    }
  }

  const handleDeleteAdmin = async (id: string) => {
    // Don't allow deleting the main admin
    const user = adminUsers.find((u) => u.id === id)
    if (user?.role === "admin") {
      toast.error("Cannot delete the main administrator account")
      return
    }

    try {
      const result = await deleteAdminUserAction(id)

      if (result.error) {
        toast.error(result.error)
        return
      }

      await loadAdminUsers()
      toast.success("Admin deleted successfully from all database tables")
    } catch (error) {
      console.error("Error deleting admin:", error)
      toast.error("Failed to delete admin user")
    }
  }

  const handleResetPassword = async (userId: string, userEmail: string) => {
    try {
      const newPassword = "newpass123"
      const passwordHash = `$2b$10$${btoa(newPassword).slice(0, 53)}`

      const { error } = await supabase.from("admin_users").update({ password_hash: passwordHash }).eq("id", userId)

      if (error) {
        console.error("Error resetting password:", error)
        toast.error("Failed to reset password")
        return
      }

      toast.success(`Password reset successfully! New password: ${newPassword}`)
    } catch (error) {
      console.error("Error resetting password:", error)
      toast.error("Failed to reset password")
    }
  }

  // Check if current user is the main admin
  const isMainAdmin = currentUser?.role === "admin"

  if (!isMainAdmin) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1F2937]">Access Denied</h1>
          <p className="text-[#4B5563]">You do not have permission to access this page.</p>
        </div>
      </div>
    )
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "admin":
        return "Administrator"
      case "sub_admin":
        return "Sub-admin"
      case "order_management":
        return "Order Management"
      default:
        return role
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-[#7E3AF2]/10 text-[#7E3AF2]"
      case "sub_admin":
        return "bg-[#4DA8DA]/10 text-[#4DA8DA]"
      case "order_management":
        return "bg-[#10B981]/10 text-[#10B981]"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-t-[#7E3AF2] border-gray-200 mx-auto mb-4"></div>
          <p className="text-[#4B5563]">Loading admin users...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1F2937]">Admin Users</h1>
          <p className="text-[#4B5563]">Manage administrator accounts</p>
        </div>

        <div className="flex gap-2">
          <Dialog open={isPromoteDialogOpen} onOpenChange={setIsPromoteDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="border-[#F59E0B] text-[#F59E0B] hover:bg-[#FEF7E0]">
                <UserPlus className="mr-2 h-4 w-4" />
                Add User as Sub-Admin
              </Button>
            </DialogTrigger>
            <DialogContent className="border-none shadow-lg">
              <DialogHeader>
                <DialogTitle className="text-[#1F2937]">Promote User to Admin</DialogTitle>
                <DialogDescription className="text-[#4B5563]">
                  Select an existing user to promote to admin role.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="user-select" className="text-[#1F2937]">
                    Select User
                  </Label>
                  <Select value={promoteUserEmail} onValueChange={setPromoteUserEmail}>
                    <SelectTrigger className="bg-[#F9FAFB] border-[#E5E7EB]">
                      <SelectValue placeholder="Select a user to promote" />
                    </SelectTrigger>
                    <SelectContent>
                      {eligibleUsers.map((user) => (
                        <SelectItem key={user.id} value={user.email}>
                          {user.name} ({user.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="promote-role" className="text-[#1F2937]">
                    Admin Role
                  </Label>
                  <Select
                    value={promoteUserRole}
                    onValueChange={(value: "sub_admin" | "order_management") => setPromoteUserRole(value)}
                  >
                    <SelectTrigger className="bg-[#F9FAFB] border-[#E5E7EB]">
                      <SelectValue placeholder="Select admin role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sub_admin">Sub-admin (Full access except user management)</SelectItem>
                      <SelectItem value="order_management">Order Management (Orders only)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="bg-[#FEF3C7] border border-[#F59E0B] rounded-md p-3">
                  <p className="text-sm text-[#92400E]">
                    <strong>Note:</strong> The promoted user will receive a default password: <code>temppass123</code>
                    <br />
                    They should change this password after their first login.
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsPromoteDialogOpen(false)}
                  className="text-[#4B5563] border-[#E5E7EB]"
                >
                  Cancel
                </Button>
                <Button className="bg-[#F59E0B] hover:bg-[#F59E0B]/90 text-white" onClick={handlePromoteUser}>
                  Promote User
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#F59E0B] hover:bg-[#F59E0B]/90 text-white">
                <UserPlus className="mr-2 h-4 w-4" />
                Add Admin User
              </Button>
            </DialogTrigger>
            <DialogContent className="border-none shadow-lg">
              <DialogHeader>
                <DialogTitle className="text-[#1F2937]">Add New Admin User</DialogTitle>
                <DialogDescription className="text-[#4B5563]">
                  Create a new administrator account with specific permissions.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-[#1F2937]">
                    Name *
                  </Label>
                  <Input
                    id="name"
                    value={newAdminName}
                    onChange={(e) => setNewAdminName(e.target.value)}
                    placeholder="Enter full name"
                    className="bg-[#F9FAFB] border-[#E5E7EB] placeholder:text-gray-500"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-[#1F2937]">
                    Email *
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={newAdminEmail}
                    onChange={(e) => setNewAdminEmail(e.target.value)}
                    placeholder="Enter email address"
                    className="bg-[#F9FAFB] border-[#E5E7EB] placeholder:text-gray-500"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-[#1F2937]">
                    Password *
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    value={newAdminPassword}
                    onChange={(e) => setNewAdminPassword(e.target.value)}
                    placeholder="Enter password (min 6 characters)"
                    className="bg-[#F9FAFB] border-[#E5E7EB] placeholder:text-gray-500"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role" className="text-[#1F2937]">
                    Role *
                  </Label>
                  <Select
                    value={newAdminRole}
                    onValueChange={(value: "sub_admin" | "order_management") => setNewAdminRole(value)}
                  >
                    <SelectTrigger className="bg-[#F9FAFB] border-[#E5E7EB]">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sub_admin">Sub-admin (Full access except user management)</SelectItem>
                      <SelectItem value="order_management">Order Management (Orders only)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsAddDialogOpen(false)}
                  className="text-[#4B5563] border-[#E5E7EB]"
                >
                  Cancel
                </Button>
                <Button className="bg-[#F59E0B] hover:bg-[#F59E0B]/90 text-white" onClick={handleAddAdmin}>
                  Add Admin User
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="bg-[#FEF7E0] border-[#F59E0B] shadow-md">
        <CardHeader className="px-6 py-4 border-b border-[#F59E0B]/20">
          <CardTitle className="text-[#1F2937]">Admin Users</CardTitle>
          <CardDescription className="text-[#92400E]">
            Manage administrator accounts and their permissions
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <Table>
            <TableHeader className="bg-white">
              <TableRow>
                <TableHead className="text-[#1F2937] font-medium">Name</TableHead>
                <TableHead className="text-[#1F2937] font-medium">Email</TableHead>
                <TableHead className="text-[#1F2937] font-medium">Role</TableHead>
                <TableHead className="text-[#1F2937] font-medium">Status</TableHead>
                <TableHead className="text-right text-[#1F2937] font-medium">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {adminUsers.map((user) => (
                <TableRow key={user.id} className="hover:bg-[#FEF7E0]/50">
                  <TableCell className="font-medium text-[#1F2937]">{user.name}</TableCell>
                  <TableCell className="text-[#4B5563]">{user.email}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                      {getRoleLabel(user.role)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        user.status === "active" ? "bg-[#10B981]/10 text-[#10B981]" : "bg-[#EF4444]/10 text-[#EF4444]"
                      }`}
                    >
                      {user.status === "active" ? "Active" : "Blocked"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {user.role !== "admin" && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleResetPassword(user.id, user.email)}
                            className="text-[#F59E0B] border-[#F59E0B]/20 hover:bg-[#F59E0B]/10"
                            title="Reset Password"
                          >
                            <KeyRound className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleToggleStatus(user.id, user.status)}
                            className={
                              user.status === "active"
                                ? "text-[#EF4444] border-[#EF4444]/20 hover:bg-[#EF4444]/10"
                                : "text-[#10B981] border-[#10B981]/20 hover:bg-[#10B981]/10"
                            }
                          >
                            {user.status === "active" ? (
                              <UserX className="h-4 w-4" />
                            ) : (
                              <UserCheck className="h-4 w-4" />
                            )}
                          </Button>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-[#EF4444] border-[#EF4444]/20 hover:bg-[#EF4444]/10"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="border-none shadow-lg">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="text-[#1F2937]">Delete Admin User</AlertDialogTitle>
                                <AlertDialogDescription className="text-[#4B5563]">
                                  Are you sure you want to delete this admin user? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="text-[#4B5563] border-[#E5E7EB]">
                                  Cancel
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteAdmin(user.id)}
                                  className="bg-[#EF4444] hover:bg-[#EF4444]/90 text-white"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
