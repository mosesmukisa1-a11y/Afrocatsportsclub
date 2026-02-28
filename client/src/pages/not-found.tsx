import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-afrocat-glow">
      <div className="afrocat-card w-full max-w-md mx-4 p-6">
        <div className="flex mb-4 gap-2">
          <AlertCircle className="h-8 w-8 text-afrocat-red" />
          <h1 className="text-2xl font-bold text-afrocat-text">404 Page Not Found</h1>
        </div>
        <p className="mt-4 text-sm text-afrocat-muted">
          Did you forget to add the page to the router?
        </p>
      </div>
    </div>
  );
}
