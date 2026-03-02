import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Search, KeyRound, Shield, Copy, Check, Users, Loader2, UserCog, Crown, Trash2, AlertTriangle } from "lucide-react";

const ALL_ROLES = ["ADMIN", "MANAGER", "COACH", "STATISTICIAN", "FINANCE", "MEDICAL", "PLAYER"] as const;

export default function AdminUsers() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [resetDialog, setResetDialog] = useState<any>(null);
  const [resetMethod, setResetMethod] = useState<"TEMP_PASSWORD" | "ONE_TIME_LINK">("TEMP_PASSWORD");
  const [tempPassword, setTempPassword] = useState("");
  const [generatedLink, setGeneratedLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [roleDialog, setRoleDialog] = useState<any>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [deleteDialog, setDeleteDialog] = useState<any>(null);

  const isSuperAdmin = !!currentUser?.isSuperAdmin;

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["/api/admin/users", debouncedQuery],
    queryFn: () => api.getAdminUsers(debouncedQuery || undefined),
  });

  const resetMut = useMutation({
    mutationFn: (data: { userId: string; method: "TEMP_PASSWORD" | "ONE_TIME_LINK"; tempPassword?: string }) =>
      api.adminResetPassword(data.userId, { method: data.method, tempPassword: data.tempPassword }),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["/api/admin/users"] });
      if (result.resetLink) {
        setGeneratedLink(result.resetLink);
        toast({ title: "Reset link generated", description: "Copy the link and share it with the user." });
      } else {
        toast({ title: "Password reset", description: "Temporary password set. User must change it on next login." });
        setResetDialog(null);
        setTempPassword("");
        setGeneratedLink("");
      }
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const roleMut = useMutation({
    mutationFn: (data: { userId: string; roles: string[] }) => api.adminUpdateRole(data.userId, data.roles),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Roles updated", description: `User roles have been updated.` });
      setRoleDialog(null);
      setSelectedRoles([]);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (userId: string) => api.adminDeleteUser(userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User deleted", description: "The user and all associated data have been permanently removed." });
      setDeleteDialog(null);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const handleSearch = () => {
    setDebouncedQuery(searchQuery);
  };

  const handleReset = () => {
    if (!resetDialog) return;
    if (resetMethod === "TEMP_PASSWORD" && tempPassword.length < 6) {
      toast({ title: "Error", description: "Temporary password must be at least 6 characters", variant: "destructive" });
      return;
    }
    resetMut.mutate({
      userId: resetDialog.id,
      method: resetMethod,
      tempPassword: resetMethod === "TEMP_PASSWORD" ? tempPassword : undefined,
    });
  };

  const handleRoleChange = () => {
    if (!roleDialog || selectedRoles.length === 0) {
      toast({ title: "Error", description: "Select at least one role", variant: "destructive" });
      return;
    }
    roleMut.mutate({ userId: roleDialog.id, roles: selectedRoles });
  };

  const toggleRole = (role: string) => {
    setSelectedRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const roleColor = (role: string) => {
    const map: Record<string, string> = {
      ADMIN: "bg-afrocat-red-soft text-afrocat-red",
      MANAGER: "bg-purple-900/30 text-purple-400",
      COACH: "bg-blue-900/30 text-blue-400",
      STATISTICIAN: "bg-indigo-900/30 text-indigo-400",
      FINANCE: "bg-afrocat-green-soft text-afrocat-green",
      MEDICAL: "bg-afrocat-gold-soft text-afrocat-gold",
      PLAYER: "bg-afrocat-teal-soft text-afrocat-teal",
    };
    return map[role] || "bg-afrocat-white-5 text-afrocat-muted";
  };

  const statusColor = (status: string) => {
    const map: Record<string, string> = {
      ACTIVE: "bg-afrocat-green-soft text-afrocat-green",
      PENDING_APPROVAL: "bg-afrocat-gold-soft text-afrocat-gold",
      REJECTED: "bg-afrocat-red-soft text-afrocat-red",
      SUSPENDED: "bg-afrocat-white-5 text-afrocat-muted",
    };
    return map[status] || "bg-afrocat-white-5 text-afrocat-muted";
  };

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
          <h1 className="text-3xl font-display font-bold text-afrocat-text tracking-tight" data-testid="text-admin-users-title">
            User Management
          </h1>
          <p className="text-afrocat-muted mt-1">Manage users, assign roles, and reset passwords</p>
        </div>

        <div className="afrocat-card">
          <div className="bg-afrocat-white-5 border-b border-afrocat-border px-6 py-4 rounded-t-[18px]">
            <h3 className="text-lg font-display font-semibold text-afrocat-text flex items-center gap-2"><Users className="h-5 w-5 text-afrocat-teal" /> All Users</h3>
          </div>
          <div className="p-4 space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-afrocat-muted" />
                <Input
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSearch()}
                  className="pl-10 bg-afrocat-white-5 border-afrocat-border text-afrocat-text placeholder:text-afrocat-muted"
                  data-testid="input-search-users"
                />
              </div>
              <Button onClick={handleSearch} data-testid="button-search-users">Search</Button>
            </div>

            {isLoading ? (
              <div className="py-8 text-center text-afrocat-muted"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
            ) : users.length === 0 ? (
              <div className="py-8 text-center text-afrocat-muted" data-testid="text-no-users">No users found.</div>
            ) : (
              <div className="space-y-2">
                {users.map((u: any) => {
                  const userRoles: string[] = u.roles && u.roles.length > 0 ? u.roles : [u.role];
                  return (
                    <div key={u.id} className="flex items-center justify-between p-4 border border-afrocat-border rounded-lg hover:bg-afrocat-white-3 transition-colors" data-testid={`row-user-${u.id}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-afrocat-text" data-testid={`text-user-name-${u.id}`}>{u.fullName}</span>
                          {u.isSuperAdmin && (
                            <Badge className="text-[10px] border-0 bg-gradient-to-r from-afrocat-gold/20 to-afrocat-red/20 text-afrocat-gold" data-testid={`badge-super-admin-${u.id}`}>
                              <Crown className="h-3 w-3 mr-0.5" /> Super Admin
                            </Badge>
                          )}
                          {userRoles.map((r: string) => (
                            <Badge key={r} className={`text-[10px] border-0 ${roleColor(r)}`} data-testid={`badge-role-${u.id}-${r}`}>{r}</Badge>
                          ))}
                          <Badge className={`text-[10px] border-0 ${statusColor(u.accountStatus)}`}>{u.accountStatus}</Badge>
                          {u.mustChangePassword && <Badge className="text-[10px] bg-afrocat-gold-soft text-afrocat-gold border-0">Must Change Password</Badge>}
                        </div>
                        <p className="text-xs text-afrocat-muted mt-1" data-testid={`text-user-email-${u.id}`}>{u.email}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {isSuperAdmin && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => { setRoleDialog(u); setSelectedRoles(u.roles && u.roles.length > 0 ? [...u.roles] : [u.role]); }}
                            className="border-afrocat-border text-afrocat-muted hover:bg-afrocat-white-5 hover:text-afrocat-text"
                            data-testid={`button-role-${u.id}`}
                          >
                            <UserCog className="h-4 w-4 mr-1" /> Roles
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => { setResetDialog(u); setResetMethod("TEMP_PASSWORD"); setTempPassword(""); setGeneratedLink(""); }}
                          className="border-afrocat-border text-afrocat-muted hover:bg-afrocat-white-5 hover:text-afrocat-text"
                          data-testid={`button-reset-${u.id}`}
                        >
                          <KeyRound className="h-4 w-4 mr-1" /> Reset
                        </Button>
                        {isSuperAdmin && !u.isSuperAdmin && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDeleteDialog(u)}
                            className="border-afrocat-red/30 text-afrocat-red hover:bg-afrocat-red-soft"
                            data-testid={`button-delete-${u.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={!!roleDialog} onOpenChange={(open) => { if (!open) setRoleDialog(null); }}>
        <DialogContent className="max-w-md bg-afrocat-card border-afrocat-border text-afrocat-text">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-afrocat-text">
              <UserCog className="h-5 w-5 text-afrocat-teal" /> Assign Roles
            </DialogTitle>
          </DialogHeader>
          {roleDialog && (
            <div className="space-y-4">
              <div className="p-3 bg-afrocat-white-5 rounded-lg">
                <p className="font-semibold text-sm text-afrocat-text">{roleDialog.fullName}</p>
                <p className="text-xs text-afrocat-muted">{roleDialog.email}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {(roleDialog.roles && roleDialog.roles.length > 0 ? roleDialog.roles : [roleDialog.role]).map((r: string) => (
                    <Badge key={r} className={`text-[10px] border-0 ${roleColor(r)}`}>Current: {r}</Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-afrocat-text text-sm">Select Roles (multiple allowed)</Label>
                <div className="grid grid-cols-2 gap-2">
                  {ALL_ROLES.map(role => {
                    const isSelected = selectedRoles.includes(role);
                    return (
                      <button
                        key={role}
                        type="button"
                        onClick={() => toggleRole(role)}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border transition-all cursor-pointer text-left ${
                          isSelected
                            ? "border-afrocat-teal bg-afrocat-teal/15 text-afrocat-teal"
                            : "border-afrocat-border bg-afrocat-white-5 text-afrocat-muted hover:border-afrocat-teal/30"
                        }`}
                        data-testid={`checkbox-role-${role.toLowerCase()}`}
                      >
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                          isSelected ? "border-afrocat-teal bg-afrocat-teal" : "border-afrocat-border"
                        }`}>
                          {isSelected && <Check className="h-3 w-3 text-white" />}
                        </div>
                        <span className="text-sm font-medium">{role}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-afrocat-muted mt-1">
                  {selectedRoles.length === 0 ? "Select at least one role" : `${selectedRoles.length} role${selectedRoles.length > 1 ? 's' : ''} selected`}
                </p>
              </div>

              {selectedRoles.includes("ADMIN") && !(roleDialog.roles || [roleDialog.role]).includes("ADMIN") && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-afrocat-red-soft">
                  <Shield className="h-4 w-4 text-afrocat-red mt-0.5 shrink-0" />
                  <p className="text-xs text-afrocat-red">This will give the user admin access including the ability to manage users and system settings.</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleDialog(null)} className="border-afrocat-border text-afrocat-muted">Cancel</Button>
            <Button
              onClick={handleRoleChange}
              disabled={roleMut.isPending || selectedRoles.length === 0}
              data-testid="button-confirm-role"
            >
              {roleMut.isPending ? "Updating..." : "Update Roles"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resetDialog} onOpenChange={(open) => { if (!open) { setResetDialog(null); setGeneratedLink(""); } }}>
        <DialogContent className="max-w-md bg-afrocat-card border-afrocat-border text-afrocat-text">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-afrocat-text">
              <Shield className="h-5 w-5 text-afrocat-teal" /> Reset Password
            </DialogTitle>
          </DialogHeader>
          {resetDialog && (
            <div className="space-y-4">
              <div className="p-3 bg-afrocat-white-5 rounded-lg">
                <p className="font-semibold text-sm text-afrocat-text">{resetDialog.fullName}</p>
                <p className="text-xs text-afrocat-muted">{resetDialog.email} ({resetDialog.role})</p>
              </div>

              {!generatedLink && (
                <>
                  <div className="space-y-2">
                    <Label className="text-afrocat-text">Reset Method</Label>
                    <Select value={resetMethod} onValueChange={(v: any) => setResetMethod(v)}>
                      <SelectTrigger className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text" data-testid="select-reset-method">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TEMP_PASSWORD">Set Temporary Password</SelectItem>
                        <SelectItem value="ONE_TIME_LINK">Generate One-Time Link</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {resetMethod === "TEMP_PASSWORD" && (
                    <div className="space-y-2">
                      <Label className="text-afrocat-text">Temporary Password</Label>
                      <Input
                        type="text"
                        value={tempPassword}
                        onChange={e => setTempPassword(e.target.value)}
                        placeholder="Min 6 characters"
                        className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text"
                        data-testid="input-temp-password"
                      />
                      <p className="text-[11px] text-afrocat-muted">User will be required to change this on next login.</p>
                    </div>
                  )}

                  {resetMethod === "ONE_TIME_LINK" && (
                    <p className="text-sm text-afrocat-muted">A one-time reset link will be generated. The link expires in 1 hour. Share it securely with the user.</p>
                  )}
                </>
              )}

              {generatedLink && (
                <div className="space-y-2">
                  <Label className="text-afrocat-text">Reset Link (expires in 1 hour)</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={generatedLink} className="text-xs bg-afrocat-white-5 border-afrocat-border text-afrocat-text" data-testid="input-generated-link" />
                    <Button variant="outline" size="sm" onClick={handleCopy} className="border-afrocat-border" data-testid="button-copy-link">
                      {copied ? <Check className="h-4 w-4 text-afrocat-green" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-[11px] text-afrocat-gold">Copy this link and share it with the user. It will not be shown again.</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            {!generatedLink ? (
              <Button onClick={handleReset} disabled={resetMut.isPending} data-testid="button-confirm-reset">
                {resetMut.isPending ? "Processing..." : "Reset Password"}
              </Button>
            ) : (
              <Button onClick={() => { setResetDialog(null); setGeneratedLink(""); }} data-testid="button-done">Done</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteDialog} onOpenChange={(open) => { if (!open) setDeleteDialog(null); }}>
        <DialogContent className="max-w-md bg-afrocat-card border-afrocat-border text-afrocat-text">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-afrocat-red">
              <AlertTriangle className="h-5 w-5" /> Delete User Permanently
            </DialogTitle>
          </DialogHeader>
          {deleteDialog && (
            <div className="space-y-4">
              <div className="p-3 bg-afrocat-white-5 rounded-lg">
                <p className="font-semibold text-sm text-afrocat-text">{deleteDialog.fullName}</p>
                <p className="text-xs text-afrocat-muted">{deleteDialog.email}</p>
              </div>
              <div className="p-3 rounded-lg bg-afrocat-red-soft">
                <p className="text-sm text-afrocat-red font-medium">This action cannot be undone.</p>
                <p className="text-xs text-afrocat-red mt-1">This will permanently delete the user account and all associated data including player records, stats, attendance, injuries, contracts, and awards.</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(null)} className="border-afrocat-border text-afrocat-muted">Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteDialog && deleteMut.mutate(deleteDialog.id)}
              disabled={deleteMut.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMut.isPending ? "Deleting..." : "Delete Permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
