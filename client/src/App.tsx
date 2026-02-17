import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Services from "./pages/Services";
import ICPGenerator from "./pages/ICPGenerator";
import Dashboard from "./pages/Dashboard";
import Pricing from "./pages/Pricing";
import AdCopyGenerator from "./pages/AdCopyGenerator";
import AdCopyDetail from "./pages/AdCopyDetail";
import AdCreatives from "./pages/AdCreatives";
import EmailSequenceGenerator from "./pages/EmailSequenceGenerator";
import WhatsAppSequenceGenerator from "./pages/WhatsAppSequenceGenerator";
import LandingPageGenerator from "./pages/LandingPageGenerator";
import OffersGenerator from "./pages/OffersGenerator";
import Campaigns from "./pages/Campaigns";
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

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/dashboard"} component={Dashboard} />
      <Route path={"/services"} component={Services} />
      <Route path={"/services/:id"} component={ServiceDetail} />
      <Route path={"/generators/icp"} component={ICPGenerator} />
      <Route path={"/pricing"} component={Pricing} />
      <Route path={"/ad-copy"} component={AdCopyGenerator} />
      <Route path={"/ad-copy/:adSetId"} component={AdCopyDetail} />
      <Route path={"/ad-creatives"} component={AdCreatives} />
      <Route path={"/generators/email"} component={EmailSequenceGenerator} />
      <Route path={"/generators/whatsapp"} component={WhatsAppSequenceGenerator} />
      <Route path={"/generators/landing-page"} component={LandingPageGenerator} />
      <Route path={"/generators/offers"} component={OffersGenerator} />
      <Route path={"/campaigns"} component={Campaigns} />
      <Route path={"/source-of-truth"} component={SourceOfTruth} />
      <Route path={"/headlines"} component={Headlines} />
      <Route path={"/headlines/new"} component={HeadlinesNew} />
      <Route path={"/headlines/:id"} component={HeadlinesDetail} />
      <Route path={"/hvco-titles"} component={HVCOTitles} />
      <Route path={"/hvco-titles/new"} component={HVCOTitlesNew} />      <Route path={"/hvco-titles/:hvcoSetId"} component={HVCOTitlesDetail} />
      <Route path={"/hero-mechanisms"} component={HeroMechanisms} />
      <Route path={"/hero-mechanisms/new"} component={HeroMechanismsNew} />
      <Route path={"/hero-mechanisms/:mechanismSetId"} component={HeroMechanismsDetail} />
      <Route path={"/hero-mechanisms"} component={HeroMechanisms} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
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
