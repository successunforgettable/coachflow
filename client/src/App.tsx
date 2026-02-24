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
import AnalyticsDashboard from "./pages/AnalyticsDashboard";
import ComplianceAdmin from "./pages/admin/ComplianceAdmin";
import ComplianceAnalytics from "./pages/admin/ComplianceAnalytics";
import OnboardingPage from "./pages/OnboardingPage";
import Settings from "./pages/Settings";
import { Terms } from "./pages/Terms";
import { Privacy } from "./pages/Privacy";
import Integrations from "./pages/settings/Integrations";
import MetaCampaigns from "./pages/MetaCampaigns";
import CampaignAlerts from "./pages/CampaignAlerts";
import { VideoCredits } from "./pages/VideoCredits";
import VideoCreator from "./pages/VideoCreator";
import VideoScriptEditor from "./pages/VideoScriptEditor";
import VideoDetail from "./pages/VideoDetail";

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
      <Route path={"/ pricing"} component={Pricing} />
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
      <Route path={"/admin"} component={AdminDashboard} />
      <Route path="/admin/compliance" component={ComplianceAdmin} />
      <Route path="/admin/compliance/analytics" component={ComplianceAnalytics} />
      <Route path={"/analytics"} component={AnalyticsDashboard} />
      <Route path={"/onboarding"} component={OnboardingPage} />
      <Route path={"/settings"} component={Settings} />      <Route path={"/settings/integrations"} component={Integrations} />
      <Route path={"/video-creator"} component={VideoCreator} />
      <Route path={"/video-creator/script/:id"} component={VideoScriptEditor} />
      <Route path={"/video-creator/video/:id"} component={VideoDetail} />
      <Route path={"/meta/campaigns"} component={MetaCampaigns} />
      <Route path={"/meta/alerts"} component={CampaignAlerts} />
      <Route path={"/terms"} component={Terms} />
      <Route path={"/privacy"} component={Privacy} />
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
