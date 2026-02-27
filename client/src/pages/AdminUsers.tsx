import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Search, KeyRound, Shield, Copy, Check, Users, Loader2 } from "lucide-react";

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

  const handleCopy = async () => {
    await navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const roleColor = (role: string) => {
    const map: Record<string, string> = {
      ADMIN: "bg-red-100 text-red-700",
      MANAGER: "bg-purple-100 text-purple-700",
      COACH: "bg-blue-100 text-blue-700",
      STATISTICIAN: "bg-indigo-100 text-indigo-700",
      FINANCE: "bg-green-100 text-green-700",
      MEDICAL: "bg-amber-100 text-amber-700",
      PLAYER: "bg-teal-100 text-teal-700",
    };
    return map[role] || "bg-gray-100 text-gray-700";
  };

  const statusColor = (status: string) => {
    const map: Record<string, string> = {
      ACTIVE: "bg-green-100 text-green-700",
      PENDING_APPROVAL: "bg-amber-100 text-amber-700",
      REJECTED: "bg-red-100 text-red-700",
      SUSPENDED: "bg-gray-100 text-gray-700",
    };
    return map[status] || "bg-gray-100 text-gray-700";
  };

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground tracking-tight" data-testid="text-admin-users-title">
            User Management
          </h1>
          <p className="text-muted-foreground mt-1">Search users and manage password resets</p>
        </div>

        <Card>
          <CardHeader className="bg-muted/30 border-b">
            <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> All Users</CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSearch()}
                  className="pl-10"
                  data-testid="input-search-users"
                />
              </div>
              <Button onClick={handleSearch} data-testid="button-search-users">Search</Button>
            </div>

            {isLoading ? (
              <div className="py-8 text-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
            ) : users.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground" data-testid="text-no-users">No users found.</div>
            ) : (
              <div className="space-y-2">
                {users.map((u: any) => (
                  <div key={u.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/10 transition-colors" data-testid={`row-user-${u.id}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm" data-testid={`text-user-name-${u.id}`}>{u.fullName}</span>
                        <Badge className={`text-[10px] ${roleColor(u.role)}`} data-testid={`badge-role-${u.id}`}>{u.role}</Badge>
                        <Badge className={`text-[10px] ${statusColor(u.accountStatus)}`}>{u.accountStatus}</Badge>
                        {u.mustChangePassword && <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">Must Change Password</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1" data-testid={`text-user-email-${u.id}`}>{u.email}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setResetDialog(u); setResetMethod("TEMP_PASSWORD"); setTempPassword(""); setGeneratedLink(""); }}
                      data-testid={`button-reset-${u.id}`}
                    >
                      <KeyRound className="h-4 w-4 mr-1" /> Reset Password
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!resetDialog} onOpenChange={(open) => { if (!open) { setResetDialog(null); setGeneratedLink(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" /> Reset Password
            </DialogTitle>
          </DialogHeader>
          {resetDialog && (
            <div className="space-y-4">
              <div className="p-3 bg-muted/30 rounded-lg">
                <p className="font-semibold text-sm">{resetDialog.fullName}</p>
                <p className="text-xs text-muted-foreground">{resetDialog.email} ({resetDialog.role})</p>
              </div>

              {!generatedLink && (
                <>
                  <div className="space-y-2">
                    <Label>Reset Method</Label>
                    <Select value={resetMethod} onValueChange={(v: any) => setResetMethod(v)}>
                      <SelectTrigger data-testid="select-reset-method">
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
                      <Label>Temporary Password</Label>
                      <Input
                        type="text"
                        value={tempPassword}
                        onChange={e => setTempPassword(e.target.value)}
                        placeholder="Min 6 characters"
                        data-testid="input-temp-password"
                      />
                      <p className="text-[11px] text-muted-foreground">User will be required to change this on next login.</p>
                    </div>
                  )}

                  {resetMethod === "ONE_TIME_LINK" && (
                    <p className="text-sm text-muted-foreground">A one-time reset link will be generated. The link expires in 1 hour. Share it securely with the user.</p>
                  )}
                </>
              )}

              {generatedLink && (
                <div className="space-y-2">
                  <Label>Reset Link (expires in 1 hour)</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={generatedLink} className="text-xs" data-testid="input-generated-link" />
                    <Button variant="outline" size="sm" onClick={handleCopy} data-testid="button-copy-link">
                      {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-[11px] text-amber-600">Copy this link and share it with the user. It will not be shown again.</p>
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
