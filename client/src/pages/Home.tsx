import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowRight } from "lucide-react";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";

/**
 * All content in this page are only for example, replace with your own feature implementation
 * When building pages, remember your instructions in Frontend Workflow, Frontend Best Practices, Design Guide and Common Pitfalls
 */
export default function Home() {
  // The userAuth hooks provides authentication state
  // To implement login/logout functionality, simply call logout() or redirect to getLoginUrl()
  let { user, loading, error, isAuthenticated, logout } = useAuth();

  // If theme is switchable in App.tsx, we can implement theme toggling like this:
  // const { theme, toggleTheme } = useTheme();

  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex justify-center mb-8">
            <img 
              src="/zap-logo.png" 
              alt="ZAP Logo" 
              className="h-40 w-40 object-contain"
            />
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-6">
            Welcome to <span className="text-primary">ZAP</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            The all-in-one marketing automation platform for coaches, speakers, and consultants.
            <br />
            Generate high-converting content in minutes with AI-powered tools and integrated email/WhatsApp/SMS sequences.
          </p>
          
          {isAuthenticated ? (
            <div className="space-y-4">
              <p className="text-lg text-foreground">
                Welcome back, {user?.name || user?.email}!
              </p>
              <div className="flex gap-4 justify-center">
                <Button
                  size="lg"
                  onClick={() => setLocation("/dashboard")}
                  className="flex items-center gap-2"
                >
                  Go to Dashboard
                  <ArrowRight className="w-5 h-5" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={logout}
                >
                  Logout
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-lg text-foreground">
                Get started by logging in with your Manus account
              </p>
              <Button
                size="lg"
                onClick={() => window.location.href = getLoginUrl()}
                className="flex items-center gap-2 mx-auto"
              >
                Login to Get Started
                <ArrowRight className="w-5 h-5" />
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
