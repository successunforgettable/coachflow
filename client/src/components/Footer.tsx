import { Link } from "wouter";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-background/50 backdrop-blur-sm mt-auto">
      <div className="container py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand Section */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">Z</span>
              </div>
              <span className="text-xl font-bold">ZAP</span>
            </div>
            <p className="text-sm text-muted-foreground max-w-md">
              AI-powered marketing platform for coaches, speakers, and consultants. 
              Create high-converting campaigns in minutes.
            </p>
          </div>

          {/* Product Links */}
          <div>
            <h3 className="font-semibold mb-4">Product</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/dashboard" className="hover:text-foreground transition-colors">
                  Dashboard
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="hover:text-foreground transition-colors">
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="/generators/icp" className="hover:text-foreground transition-colors">
                  Generators
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal Links */}
          <div>
            <h3 className="font-semibold mb-4">Legal</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/terms" className="hover:text-foreground transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-foreground transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <a 
                  href="mailto:support@arfeenkhan.com" 
                  className="hover:text-foreground transition-colors"
                >
                  Contact Support
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Earnings Disclaimer */}
        <div className="mt-8 pt-8 border-t border-border">
          <div className="bg-muted/30 rounded-lg p-4 mb-6">
            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Earnings Disclaimer:</strong> Results may vary. No income, revenue, or profit guarantees are made. Success depends on individual effort, market conditions, business model, and other factors beyond our control. The testimonials and examples shown (if any) are not typical results and should not be interpreted as a promise or guarantee of earnings. Your results may be better, worse, or non-existent. ZAP is a software tool that assists with marketing content creation; it does not guarantee business success or financial outcomes.
            </p>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
          <p>
            © {currentYear} Incredible You Consultants SOC LLC. All rights reserved.
          </p>
          <p>
            Made with ❤️ in Dubai, UAE
          </p>
        </div>
      </div>
    </footer>
  );
}
