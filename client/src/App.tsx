import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import LandingPage from "./pages/LandingPage";
import Services from "./pages/Services";
import ICPGenerator from "./pages/ICPGenerator";
import Dashboard from "./pages/Dashboard";
import Pricing from "./pages/Pricing";
import AdCopyGenerator from "./pages/AdCopyGenerator";
import AdCopyDetail from "./pages/AdCopyDetail";
import AdCreativesGenerator from "./pages/AdCreativesGenerator";
import EmailSequenceGenerator from "./pages/EmailSequenceGenerator";
import WhatsAppSequenceGenerator from "./pages/WhatsAppSequenceGenerator";
import LandingPageGenerator from "./pages/LandingPageGenerator";
import LandingPageDetail from "./pages/LandingPageDetail";
import OffersGenerator from "./pages/OffersGenerator";
import OfferDetail from "./pages/OfferDetail";
import CampaignList from "./pages/CampaignList";
import CampaignBuilder from "./pages/CampaignBuilder";
import CampaignDashboard from "./pages/CampaignDashboard";
import SourceOfTruth from "./pages/SourceOfTruth";
import ServiceDetail from "./pages/ServiceDetail";
import Headlines from "./pages/Headlines";
import HeadlinesNew from "./pages/HeadlinesNew";
import HeadlinesDetail from "./pages/HeadlinesDetail";
import HVCOTitles from "./pages/HVCOTitles";
import HVCOTitlesNew from "./pages/HVCOTitlesNew";
import HVCOTitlesDetail from "./pages/HVCOTitlesDetail";
import HeroMechanisms from "./pages/HeroMechanisms";
import HeroMechanismsNew from "./pages/HeroMechanismsNew";
import HeroMechanismsDetail from "./pages/HeroMechanismsDetail";
import AdminDashboard from "./pages/AdminDashboard";
import AdminLayout from "./pages/admin/AdminLayout";
import AnalyticsDashboard from "./pages/AnalyticsDashboard";
import ComplianceAdmin from "./pages/admin/ComplianceAdmin";
import ComplianceAnalytics from "./pages/admin/ComplianceAnalytics";
import AdminUserDetail from "./pages/admin/AdminUserDetail";
import AdminAuditLog from "./pages/admin/AdminAuditLog";
import AdminContentModeration from "./pages/admin/AdminContentModeration";
import AdminSystemHealth from "./pages/admin/AdminSystemHealth";
import AdminTestCampaigns from "./pages/admin/AdminTestCampaigns";
import AdminAnalytics from "./pages/admin/AdminAnalytics";
import AdminRevenueReports from "./pages/admin/AdminRevenueReports";
import OnboardingPage from "./pages/OnboardingPage";
import Settings from "./pages/Settings";
import { Terms } from "./pages/Terms";
import { Privacy } from "./pages/Privacy";
import { GettingStarted } from "./pages/GettingStarted";
import Integrations from "./pages/settings/Integrations";
import MetaCampaigns from "./pages/MetaCampaigns";
import CampaignAlerts from "./pages/CampaignAlerts";
import { VideoCredits } from "./pages/VideoCredits";
import VideoCreator from "./pages/VideoCreator";
import VideoScriptEditor from "./pages/VideoScriptEditor";
import VideoDetail from "./pages/VideoDetail";
import Videos from "./pages/Videos";
import { DemoVideo } from "./pages/DemoVideo";
import CampaignICPSelection from "./pages/CampaignICPSelection";
import Signup from "./pages/Signup";
import V2Dashboard from "./v2/V2Dashboard";
import V2GeneratorWizardPage from "./v2/V2GeneratorWizardPage";
import V2CampaignKit from "./v2/V2CampaignKit";
import V2SourceOfTruth from "./v2/V2SourceOfTruth";
import V2AssetLibrary from "./v2/V2AssetLibrary";
import V2Settings from "./v2/V2Settings";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import OAuthCallback from "./pages/OAuthCallback";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={LandingPage} />
      <Route path="/home" component={Home} />
      <Route path={"/dashboard"} component={Dashboard} />
      <Route path={"/services"} component={Services} />
      <Route path={"/services/:id"} component={ServiceDetail} />
      <Route path={"/generators/icp"} component={ICPGenerator} />
      <Route path={"/pricing"} component={Pricing} />
      <Route path={"/video-credits"} component={VideoCredits} />      <Route path={"/ad-copy"} component={AdCopyGenerator} />
      <Route path={"/ad-copy/:adSetId"} component={AdCopyDetail} />
      <Route path={"/ad-creatives"} component={AdCreativesGenerator} />
      <Route path={"/generators/email"} component={EmailSequenceGenerator} />
      <Route path={"/generators/whatsapp"} component={WhatsAppSequenceGenerator} />
      <Route path={"/generators/landing-page"} component={LandingPageGenerator} />
      <Route path={"/landing-pages"} component={LandingPageGenerator} />
      <Route path={"/landing-pages/:id"} component={LandingPageDetail} />
      <Route path={"/generators/offers"} component={OffersGenerator} />
      <Route path={"/offers"} component={OffersGenerator} />
      <Route path={"/offers/:id"} component={OfferDetail} />
      <Route path={"/campaigns"} component={CampaignList} />
      <Route path={"/campaigns/:id"} component={CampaignDashboard} />
      <Route path={"/campaigns/:campaignId/icp"} component={CampaignICPSelection} />
      <Route path={"/campaigns/:id/builder"} component={CampaignBuilder} />
      <Route path={"/source-of-truth"} component={SourceOfTruth} />
      <Route path={"/headlines"} component={Headlines} />
      <Route path={"/headlines/new"} component={HeadlinesNew} />
      <Route path={"/headlines/:id"} component={HeadlinesDetail} />
      <Route path={"/hvco-titles"} component={HVCOTitles} />
      <Route path={"/hvco-titles/new"} component={HVCOTitlesNew} />
      <Route path={"/hvco-titles/:hvcoSetId"} component={HVCOTitlesDetail} />
      <Route path={"/hero-mechanisms"} component={HeroMechanisms} />
      <Route path={"/hero-mechanisms/new"} component={HeroMechanismsNew} />
      <Route path={"/hero-mechanisms/:mechanismSetId"} component={HeroMechanismsDetail} />
      <Route path={"/admin"} component={() => <AdminLayout><AdminDashboard /></AdminLayout>} />
      <Route path="/admin/users/:userId" component={() => <AdminLayout><AdminUserDetail /></AdminLayout>} />
      <Route path="/admin/audit-log" component={() => <AdminLayout><AdminAuditLog /></AdminLayout>} />
      <Route path="/admin/content-moderation" component={() => <AdminLayout><AdminContentModeration /></AdminLayout>} />
      <Route path="/admin/analytics" component={() => <AdminLayout><AdminAnalytics /></AdminLayout>} />
      <Route path="/admin/revenue" component={() => <AdminLayout><AdminRevenueReports /></AdminLayout>} />
      <Route path="/admin/system-health" component={() => <AdminLayout><AdminSystemHealth /></AdminLayout>} />
      <Route path="/admin/compliance" component={() => <AdminLayout><ComplianceAdmin /></AdminLayout>} />
      <Route path="/admin/compliance/analytics" component={() => <AdminLayout><ComplianceAnalytics /></AdminLayout>} />
      <Route path="/admin/test-campaigns" component={() => <AdminLayout><AdminTestCampaigns /></AdminLayout>} />
      <Route path={"/analytics"} component={AnalyticsDashboard} />
      <Route path={"/onboarding"} component={OnboardingPage} />
      <Route path={"/settings"} component={Settings} />      <Route path={"/settings/integrations"} component={Integrations} />
      <Route path={"/videos"} component={Videos} />
      <Route path={"/video-creator"} component={VideoCreator} />
      <Route path={"/video-creator/script/:id"} component={VideoScriptEditor} />
      <Route path={"/video-creator/video/:id"} component={VideoDetail} />
      <Route path={"/demo-video"} component={DemoVideo} />
      <Route path={"/meta/campaigns"} component={MetaCampaigns} />
      <Route path={"/meta/alerts"} component={CampaignAlerts} />
      <Route path={"/terms"} component={Terms} />
      <Route path={"/privacy"} component={Privacy} />
      <Route path={"/getting-started"} component={GettingStarted} />
      <Route path={"/signup"} component={Signup} />
      <Route path={"/login"} component={Login} />
      {/* OAuth callback shim: Manus platform sends /manus-oauth/callback to the static frontend.
          This component immediately redirects to /api/oauth/callback (which Express handles)
          preserving all query params so the session cookie gets set correctly. */}
      <Route path={"/manus-oauth/callback"} component={OAuthCallback} />
      <Route path={"/forgot-password"} component={ForgotPassword} />
      <Route path={"/reset-password"} component={ResetPassword} />
      {/* V2 Sandbox — specific routes first, base route last (wouter Switch matches first hit) */}
      <Route path={"/v2-dashboard/asset-library"} component={V2AssetLibrary} />
      <Route path={"/v2-dashboard/source-of-truth"} component={V2SourceOfTruth} />
      <Route path={"/v2-dashboard/wizard/:step"} component={V2GeneratorWizardPage} />
      <Route path={"/v2-dashboard/campaign-kit/:kitId"} component={V2CampaignKit} />
      <Route path={"/v2-dashboard/settings"} component={V2Settings} />
      <Route path={"/v2-dashboard"} component={V2Dashboard} />
      <Route path={"/404"} component={NotFound} />
      {/* Fallback route for 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="dark"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
