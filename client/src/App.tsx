import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AppRoutes, AppNav } from "@/auto-routes.generated";
import { queryClient } from "@/lib/queryClient";

export default function App() {
  return (
    <>
      <Toaster richColors position="top-right" />
      <QueryClientProvider client={queryClient}>
        <AppNav />
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-[#0b1020] to-black text-slate-100">
          <AppRoutes />
        </div>
      </QueryClientProvider>
    </>
  );
}
