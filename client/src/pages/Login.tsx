import { useState, useEffect } from "react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  // Check for error params in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    if (error === "invalid_token") setErrorMsg("That link is invalid. Please request a new one.");
    else if (error === "expired_token") setErrorMsg("That link has expired. Please request a new one.");
    else if (error === "google_auth_failed") setErrorMsg("Google sign-in failed. Please try again.");
    else if (error === "no_email") setErrorMsg("We couldn't get your email from Google. Please try another method.");
  }, []);

  const handleGoogleLogin = () => {
    window.location.href = "/auth/google";
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }
    setStep("sending");
    setErrorMsg("");

    try {
      const res = await fetch("/auth/magic/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setStep("sent");
      } else {
        setStep("error");
        setErrorMsg(data.error || "Failed to send magic link. Please try again.");
      }
    } catch {
      setStep("error");
      setErrorMsg("Network error. Please check your connection and try again.");
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f0e8] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <span className="text-4xl font-black text-[#1a1a1a] tracking-tighter">ZAP</span>
            <span className="text-2xl">⚡</span>
          </div>
          <p className="text-[#666] text-sm">AI Campaign Generator</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-[#1a1a1a] px-8 py-6">
            <h1 className="text-white text-xl font-bold">Sign in to ZAP</h1>
            <p className="text-[rgba(255,255,255,0.5)] text-sm mt-1">
              Create your account or sign in to continue
            </p>
          </div>

          <div className="px-8 py-7">
            {step === "sent" ? (
              // Magic link sent state
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h2 className="text-[#1a1a1a] font-bold text-lg mb-2">Check your email</h2>
                <p className="text-[#666] text-sm leading-relaxed mb-1">
                  We sent a sign-in link to
                </p>
                <p className="text-[#1a1a1a] font-semibold text-sm mb-4">{email}</p>
                <p className="text-[#999] text-xs">
                  The link expires in 15 minutes. Check your spam folder if you don't see it.
                </p>
                <button
                  onClick={() => { setStep("idle"); setEmail(""); }}
                  className="mt-5 text-sm text-[#666] underline hover:text-[#1a1a1a] transition-colors"
                >
                  Use a different email
                </button>
              </div>
            ) : (
              <>
                {/* Google Sign In */}
                <button
                  onClick={handleGoogleLogin}
                  className="w-full flex items-center justify-center gap-3 bg-white border-2 border-[#e5e7eb] hover:border-[#1a1a1a] hover:bg-[#f9f9f9] text-[#1a1a1a] font-semibold py-3.5 px-4 rounded-xl transition-all duration-150 mb-5"
                >
                  <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </button>

                {/* Divider */}
                <div className="flex items-center gap-3 mb-5">
                  <div className="flex-1 h-px bg-[#e5e7eb]" />
                  <span className="text-[#999] text-xs font-medium">or sign in with email</span>
                  <div className="flex-1 h-px bg-[#e5e7eb]" />
                </div>

                {/* Magic Link Form */}
                <form onSubmit={handleMagicLink}>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                      Email address
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full border-2 border-[#e5e7eb] focus:border-[#1a1a1a] rounded-xl px-4 py-3 text-[#1a1a1a] placeholder-[#bbb] outline-none transition-colors text-sm"
                      required
                      autoComplete="email"
                    />
                  </div>

                  {errorMsg && (
                    <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
                      {errorMsg}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={step === "sending"}
                    className="w-full bg-[#1a1a1a] hover:bg-[#333] disabled:opacity-60 text-white font-semibold py-3.5 px-4 rounded-xl transition-all duration-150"
                  >
                    {step === "sending" ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                        Sending link…
                      </span>
                    ) : (
                      "Send sign-in link"
                    )}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[#999] text-xs mt-6">
          By signing in, you agree to ZAP's{" "}
          <a href="/terms" className="underline hover:text-[#666]">Terms</a>
          {" "}and{" "}
          <a href="/privacy" className="underline hover:text-[#666]">Privacy Policy</a>
        </p>
      </div>
    </div>
  );
}
