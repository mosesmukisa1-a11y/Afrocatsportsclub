import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Send, MessageCircle, Wifi, WifiOff } from "lucide-react";

function roleBadgeColor(role: string) {
  switch (role) {
    case "ADMIN":
      return "bg-afrocat-gold/20 text-afrocat-gold border-afrocat-gold/30";
    case "COACH":
      return "bg-afrocat-teal/20 text-afrocat-teal border-afrocat-teal/30";
    default:
      return "bg-afrocat-white-5 text-afrocat-muted border-afrocat-border";
  }
}

function formatTime(ts: string) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(ts: string) {
  const d = new Date(ts);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "Today";
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

export default function Chat() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedRoom, setSelectedRoom] = useState<string>("");
  const [message, setMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const { data: rooms = [] } = useQuery({
    queryKey: ["/chat/rooms"],
    queryFn: () => api.getChatRooms(),
  });

  useEffect(() => {
    if (rooms.length > 0 && !selectedRoom) {
      setSelectedRoom(rooms[0].id);
    }
  }, [rooms, selectedRoom]);

  const { data: messages = [] } = useQuery({
    queryKey: ["/chat/messages", selectedRoom],
    queryFn: () => api.getChatMessages(selectedRoom),
    enabled: !!selectedRoom,
    refetchInterval: 3000,
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMutation = useMutation({
    mutationFn: (data: { roomId: string; message: string }) => api.sendChatMessage(data),
    onSuccess: () => {
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ["/chat/messages", selectedRoom] });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to send", description: err.message, variant: "destructive" });
    },
  });

  const handleSend = () => {
    const trimmed = message.trim();
    if (!trimmed || !selectedRoom) return;
    sendMutation.mutate({ roomId: selectedRoom, message: trimmed });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  let lastDate = "";

  return (
    <Layout>
      <div className="flex flex-col h-[calc(100vh-8rem)] md:h-[calc(100vh-6rem)]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <MessageCircle className="text-afrocat-teal" size={24} />
            <h1 className="text-2xl font-display font-bold text-afrocat-text" data-testid="text-chat-title">
              Team Chat
            </h1>
          </div>
          <div className="flex items-center gap-2" data-testid="status-connection">
            {isOnline ? (
              <Wifi size={16} className="text-green-400" />
            ) : (
              <WifiOff size={16} className="text-afrocat-red" />
            )}
            <span className={`text-xs font-medium ${isOnline ? "text-green-400" : "text-afrocat-red"}`}>
              {isOnline ? "Online" : "Offline"}
            </span>
          </div>
        </div>

        <div className="flex flex-1 gap-0 md:gap-4 overflow-hidden rounded-lg border border-afrocat-border">
          <div className="hidden md:flex flex-col w-56 bg-afrocat-card border-r border-afrocat-border shrink-0">
            <div className="p-3 border-b border-afrocat-border">
              <p className="text-xs font-semibold text-afrocat-muted uppercase tracking-wider">Rooms</p>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1" data-testid="room-list">
              {rooms.map((room: any) => (
                <button
                  key={room.id}
                  onClick={() => setSelectedRoom(room.id)}
                  data-testid={`room-button-${room.id}`}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    selectedRoom === room.id
                      ? "bg-afrocat-teal/15 text-afrocat-teal"
                      : "text-afrocat-muted hover:bg-afrocat-white-5 hover:text-afrocat-text"
                  }`}
                >
                  # {room.name}
                </button>
              ))}
            </div>
          </div>

          <div className="md:hidden p-2 bg-afrocat-card border-b border-afrocat-border">
            <select
              value={selectedRoom}
              onChange={(e) => setSelectedRoom(e.target.value)}
              data-testid="select-room-mobile"
              className="w-full bg-afrocat-bg text-afrocat-text border border-afrocat-border rounded-md px-3 py-2 text-sm"
            >
              {rooms.map((room: any) => (
                <option key={room.id} value={room.id}>
                  # {room.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col flex-1 min-w-0">
            <div className="px-4 py-3 border-b border-afrocat-border bg-afrocat-card">
              <p className="text-sm font-semibold text-afrocat-text" data-testid="text-current-room">
                # {rooms.find((r: any) => r.id === selectedRoom)?.name || "..."}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-1 bg-afrocat-bg" data-testid="messages-container">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-afrocat-muted" data-testid="text-empty-chat">
                  <MessageCircle size={48} className="mb-3 opacity-30" />
                  <p className="text-sm">No messages yet. Start the conversation!</p>
                </div>
              ) : (
                messages.map((msg: any, idx: number) => {
                  const msgDate = formatDate(msg.sentAt || msg.createdAt || msg.timestamp);
                  let showDate = false;
                  if (msgDate !== lastDate) {
                    lastDate = msgDate;
                    showDate = true;
                  }
                  const isOwn = msg.senderId === user?.id;
                  return (
                    <div key={msg.id || idx}>
                      {showDate && (
                        <div className="flex justify-center my-3">
                          <span className="text-[10px] bg-afrocat-card px-3 py-1 rounded-full text-afrocat-muted border border-afrocat-border">
                            {msgDate}
                          </span>
                        </div>
                      )}
                      <div
                        className={`flex gap-3 py-2 px-2 rounded-md hover:bg-afrocat-white-5 transition-colors ${isOwn ? "" : ""}`}
                        data-testid={`message-item-${msg.id || idx}`}
                      >
                        <div className="w-8 h-8 rounded-full bg-afrocat-teal-soft flex items-center justify-center text-xs font-bold text-afrocat-teal shrink-0 mt-0.5">
                          {(msg.senderName || "?").charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-afrocat-text" data-testid={`text-sender-${msg.id || idx}`}>
                              {msg.senderName || "Unknown"}
                            </span>
                            {msg.senderRole && (
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${roleBadgeColor(msg.senderRole)}`}
                                data-testid={`badge-role-${msg.id || idx}`}
                              >
                                {msg.senderRole}
                              </span>
                            )}
                            <span className="text-[10px] text-afrocat-muted" data-testid={`text-time-${msg.id || idx}`}>
                              {formatTime(msg.sentAt || msg.createdAt || msg.timestamp)}
                            </span>
                          </div>
                          <p className="text-sm text-afrocat-text mt-0.5 break-words" data-testid={`text-message-${msg.id || idx}`}>
                            {msg.message || msg.text}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-3 border-t border-afrocat-border bg-afrocat-card">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message..."
                  data-testid="input-chat-message"
                  className="flex-1 bg-afrocat-bg text-afrocat-text border border-afrocat-border rounded-md px-3 py-2 text-sm placeholder:text-afrocat-muted focus:outline-none focus:ring-1 focus:ring-afrocat-teal focus:border-afrocat-teal"
                />
                <button
                  onClick={handleSend}
                  disabled={!message.trim() || sendMutation.isPending}
                  data-testid="button-send-message"
                  className="bg-afrocat-teal text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-afrocat-teal/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  <Send size={16} />
                  <span className="hidden sm:inline">Send</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}