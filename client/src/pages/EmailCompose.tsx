import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Mail, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function EmailCompose() {
  const { toast } = useToast();
  const [form, setForm] = useState({ to: "", subject: "", text: "" });

  const sendMut = useMutation({
    mutationFn: () => api.sendEmail({ to: form.to, subject: form.subject, text: form.text }),
    onSuccess: () => {
      toast({ title: "Email sent successfully" });
      setForm({ to: "", subject: "", text: "" });
    },
    onError: (e: any) => toast({ title: "Failed to send email", description: e.message, variant: "destructive" }),
  });

  return (
    <Layout>
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Mail className="h-7 w-7 text-afrocat-gold" />
          <h1 className="text-2xl font-display font-bold text-afrocat-text">Send Email</h1>
        </div>
        <p className="text-sm text-afrocat-muted">
          Sends from afrocatvolleyballclub@gmail.com with auto CC to afrocatladiesvc@gmail.com
        </p>

        <div className="afrocat-card p-5 space-y-4">
          <div>
            <label className="text-xs text-afrocat-muted mb-1 block">To (email addresses, comma-separated)</label>
            <input
              value={form.to}
              onChange={e => setForm(f => ({ ...f, to: e.target.value }))}
              placeholder="recipient@example.com"
              className="w-full px-3 py-2 rounded-lg bg-afrocat-white-5 border border-afrocat-border text-afrocat-text text-sm"
              data-testid="input-email-to"
            />
          </div>
          <div>
            <label className="text-xs text-afrocat-muted mb-1 block">Subject</label>
            <input
              value={form.subject}
              onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
              placeholder="Subject line"
              className="w-full px-3 py-2 rounded-lg bg-afrocat-white-5 border border-afrocat-border text-afrocat-text text-sm"
              data-testid="input-email-subject"
            />
          </div>
          <div>
            <label className="text-xs text-afrocat-muted mb-1 block">Message</label>
            <textarea
              value={form.text}
              onChange={e => setForm(f => ({ ...f, text: e.target.value }))}
              placeholder="Type your message..."
              rows={10}
              className="w-full px-3 py-2 rounded-lg bg-afrocat-white-5 border border-afrocat-border text-afrocat-text text-sm resize-none"
              data-testid="input-email-body"
            />
          </div>
          <Button
            onClick={() => sendMut.mutate()}
            disabled={!form.to || !form.subject || !form.text || sendMut.isPending}
            data-testid="button-send-email"
            className="bg-afrocat-teal hover:bg-afrocat-teal/90 text-white"
          >
            <Send className="h-4 w-4 mr-2" />
            {sendMut.isPending ? "Sending..." : "Send Email"}
          </Button>
        </div>
      </div>
    </Layout>
  );
}
