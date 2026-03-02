import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Search, KeyRound, Shield, Copy, Check, Users, Loader2, UserCog } from "lucide-react";

const ALL_ROLES = ["ADMIN", "MANAGER", "COACH", "STATISTICIAN", "FINANCE", "MEDICAL", "PLAYER"] as const;

export default function AdminUsers() {
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
  const [selectedRole, setSelectedRole] = useState("");

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
    mutationFn: (data: { userId: string; role: string }) => api.adminUpdateRole(data.userId, data.role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Role updated", description: `User role changed to ${selectedRole}.` });
      setRoleDialog(null);
      setSelectedRole("");
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
    if (!roleDialog || !selectedRole) return;
    roleMut.mutate({ userId: roleDialog.id, role: selectedRole });
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
                {users.map((u: any) => (
                  <div key={u.id} className="flex items-center justify-between p-4 border border-afrocat-border rounded-lg hover:bg-afrocat-white-3 transition-colors" data-testid={`row-user-${u.id}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-afrocat-text" data-testid={`text-user-name-${u.id}`}>{u.fullName}</span>
                        <Badge className={`text-[10px] border-0 ${roleColor(u.role)}`} data-testid={`badge-role-${u.id}`}>{u.role}</Badge>
                        <Badge className={`text-[10px] border-0 ${statusColor(u.accountStatus)}`}>{u.accountStatus}</Badge>
                        {u.mustChangePassword && <Badge className="text-[10px] bg-afrocat-gold-soft text-afrocat-gold border-0">Must Change Password</Badge>}
                      </div>
                      <p className="text-xs text-afrocat-muted mt-1" data-testid={`text-user-email-${u.id}`}>{u.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setRoleDialog(u); setSelectedRole(u.role); }}
                        className="border-afrocat-border text-afrocat-muted hover:bg-afrocat-white-5 hover:text-afrocat-text"
                        data-testid={`button-role-${u.id}`}
                      >
                        <UserCog className="h-4 w-4 mr-1" /> Role
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setResetDialog(u); setResetMethod("TEMP_PASSWORD"); setTempPassword(""); setGeneratedLink(""); }}
                        className="border-afrocat-border text-afrocat-muted hover:bg-afrocat-white-5 hover:text-afrocat-text"
                        data-testid={`button-reset-${u.id}`}
                      >
                        <KeyRound className="h-4 w-4 mr-1" /> Reset
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={!!roleDialog} onOpenChange={(open) => { if (!open) setRoleDialog(null); }}>
        <DialogContent className="max-w-md bg-afrocat-card border-afrocat-border text-afrocat-text">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-afrocat-text">
              <UserCog className="h-5 w-5 text-afrocat-teal" /> Assign Role
            </DialogTitle>
          </DialogHeader>
          {roleDialog && (
            <div className="space-y-4">
              <div className="p-3 bg-afrocat-white-5 rounded-lg">
                <p className="font-semibold text-sm text-afrocat-text">{roleDialog.fullName}</p>
                <p className="text-xs text-afrocat-muted">{roleDialog.email}</p>
                <div className="mt-1">
                  <Badge className={`text-[10px] border-0 ${roleColor(roleDialog.role)}`}>Current: {roleDialog.role}</Badge>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-afrocat-text">New Role</Label>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text" data-testid="select-new-role">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_ROLES.map(r => (
                      <SelectItem key={r} value={r} data-testid={`select-role-option-${r}`}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedRole === "ADMIN" && selectedRole !== roleDialog.role && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-afrocat-red-soft">
                  <Shield className="h-4 w-4 text-afrocat-red mt-0.5 shrink-0" />
                  <p className="text-xs text-afrocat-red">This will give the user full admin access including the ability to manage all users, roles, and system settings.</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleDialog(null)} className="border-afrocat-border text-afrocat-muted">Cancel</Button>
            <Button
              onClick={handleRoleChange}
              disabled={roleMut.isPending || selectedRole === roleDialog?.role}
              data-testid="button-confirm-role"
            >
              {roleMut.isPending ? "Updating..." : "Update Role"}
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
    </Layout>
  );
}
