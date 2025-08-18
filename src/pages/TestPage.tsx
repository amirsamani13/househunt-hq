import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Play, Database, AlertCircle, Mail, Search, Clock, TestTube, Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";

export default function TestPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [properties, setProperties] = useState<any[]>([]);
  const { toast } = useToast();
  const { user } = useAuth();

  const testScraping = async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to test scraping functionality.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setResults(null);
    
    try {
      toast({
        title: "Scraping Started",
        description: "Property scraping is now running in the background...",
      });

      // Call the scrape-properties edge function without blocking UI
      const scrapePromise = supabase.functions.invoke('scrape-properties');
      
      // Allow UI to update immediately
      setTimeout(async () => {
        try {
          const { data, error } = await scrapePromise;
          
          if (error) {
            throw error;
          }
          
          setResults(data);
          
          toast({
            title: "Scraping Complete! 🎉",
            description: `Found ${data.totalNewProperties || 0} new properties across all sources.`,
          });
          
        } catch (err: any) {
          console.error('Scraping error:', err);
          toast({
            title: "Scraping Failed",
            description: err.message || "An error occurred during scraping.",
            variant: "destructive",
          });
        } finally {
          setIsLoading(false);
        }
      }, 1000);
      
    } catch (err: any) {
      console.error('Scraping error:', err);
      setIsLoading(false);
      toast({
        title: "Scraping Failed",
        description: err.message || "An error occurred during scraping.",
        variant: "destructive",
      });
    }
  };

  const testScraperNotifications = async () => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please log in to test notifications",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      console.log('🧪 Starting SCRAPER TEST MODE...');
      
      const { data, error } = await supabase.functions.invoke('send-notifications', {
        body: {
          scraperTest: true, // This will find 1 property per source and send test emails
          force: true,
          windowHours: 24
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      console.log('Scraper test results:', data);
      
      toast({
        title: "Scraper Test Complete! 🧪",
        description: `Sent ${data.notificationsSent || 0} test emails. Check your inbox!`,
      });
      
    } catch (err: any) {
      console.error('Scraper test error:', err);
      toast({
        title: "Scraper test failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProperties = async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to view properties.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .eq('is_active', true)
        .order('first_seen_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      setProperties(data || []);
      toast({
        title: "Properties Loaded",
        description: `Found ${data?.length || 0} recent properties.`,
      });
    } catch (err: any) {
      console.error('Error fetching properties:', err);
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLast24h = async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to view properties.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const cutoff = new Date();
      cutoff.setHours(cutoff.getHours() - 24);

      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .eq('is_active', true)
        .gte('first_seen_at', cutoff.toISOString())
        .order('first_seen_at', { ascending: false });

      if (error) throw error;

      setProperties(data || []);
      toast({
        title: "24h Properties Loaded",
        description: `Found ${data?.length || 0} properties from the last 24 hours.`,
      });
    } catch (err: any) {
      console.error('Error fetching 24h properties:', err);
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const sendNotifications24hAll = async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to send notifications.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-notifications', {
        body: {
          windowHours: 24,
          testAll: false,
          force: false
        }
      });

      if (error) throw error;

      toast({
        title: "Notifications Sent",
        description: `Sent ${data.notificationsSent || 0} notifications successfully.`,
      });
    } catch (err: any) {
      console.error('Error sending notifications:', err);
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const testForceNotifications = async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to test notifications.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-notifications', {
        body: {
          windowHours: 6,
          force: true,
          testAll: true
        }
      });

      if (error) throw error;

      toast({
        title: "Force Test Complete!",
        description: `Sent ${data.notificationsSent || 0} forced notifications.`,
      });
    } catch (err: any) {
      console.error('Error with force notifications:', err);
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const runRepair = async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to run repair functions.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('repair-properties');

      if (error) throw error;

      toast({
        title: "Data Repair Complete! 🔧",
        description: `Scanned: ${data.scanned || 0}, Fixed: ${data.fixed || 0}, Purged: ${data.purged || 0}`,
      });
    } catch (err: any) {
      console.error('Error running repair:', err);
      toast({
        title: "Repair Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updatePause = async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to update pause status.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      // Get current pause status
      const { data: profile } = await supabase
        .from('profiles')
        .select('notifications_paused')
        .eq('user_id', user.id)
        .single();

      const newPauseStatus = !profile?.notifications_paused;

      const { error } = await supabase
        .from('profiles')
        .update({ notifications_paused: newPauseStatus })
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: newPauseStatus ? "Notifications Paused" : "Notifications Resumed",
        description: newPauseStatus 
          ? "You won't receive property notifications until you resume them."
          : "You'll now receive property notifications again.",
      });
    } catch (err: any) {
      console.error('Error updating pause status:', err);
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Authentication Required
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Please log in to access the testing features.
            </p>
            <Link to="/auth">
              <Button className="w-full">Go to Login</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold">Testing & Debugging</h1>
                <p className="text-muted-foreground">Test scrapers, notifications, and data integrity</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 space-y-8">
        
        {/* Scraping & Data Collection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Scraping & Data Collection
            </CardTitle>
            <CardDescription>
              Test property scrapers and data collection from various sources
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Button 
                onClick={testScraping} 
                disabled={isLoading}
                className="h-16 flex flex-col gap-2"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-6 w-6" />}
                <div>
                  <div className="font-semibold">Test Scraping</div>
                  <div className="text-xs opacity-70">Run all scrapers</div>
                </div>
              </Button>

              <Button 
                onClick={testScraperNotifications} 
                disabled={isLoading}
                variant="secondary"
                className="h-16 flex flex-col gap-2 bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-6 w-6" />}
                <div>
                  <div className="font-semibold">🧪 Scraper Test</div>
                  <div className="text-xs opacity-70">1 email per source</div>
                </div>
              </Button>

              <Button 
                onClick={fetchProperties} 
                disabled={isLoading}
                variant="outline"
                className="h-16 flex flex-col gap-2"
              >
                <Database className="h-6 w-6" />
                <div>
                  <div className="font-semibold">Fetch Properties</div>
                  <div className="text-xs opacity-70">View recent data</div>
                </div>
              </Button>

              <Button 
                onClick={fetchLast24h} 
                disabled={isLoading}
                variant="outline"
                className="h-16 flex flex-col gap-2"
              >
                <Clock className="h-6 w-6" />
                <div>
                  <div className="font-semibold">Last 24h</div>
                  <div className="text-xs opacity-70">Recent properties</div>
                </div>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Notifications & Testing */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Notifications & Testing
            </CardTitle>
            <CardDescription>
              Test notification systems and data management
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Button 
                onClick={sendNotifications24hAll} 
                disabled={isLoading}
                variant="secondary"
                className="h-16 flex flex-col gap-2"
              >
                <Mail className="h-6 w-6" />
                <div>
                  <div className="font-semibold">Send 24h Notifications</div>
                  <div className="text-xs opacity-70">Test notification system</div>
                </div>
              </Button>

              <Button 
                onClick={testForceNotifications} 
                disabled={isLoading}
                variant="outline"
                className="h-16 flex flex-col gap-2"
              >
                <TestTube className="h-6 w-6" />
                <div>
                  <div className="font-semibold">Force Test Notifications</div>
                  <div className="text-xs opacity-70">Bypass all restrictions</div>
                </div>
              </Button>

              <Button 
                onClick={runRepair} 
                disabled={isLoading}
                variant="destructive"
                className="h-16 flex flex-col gap-2"
              >
                <Trash2 className="h-6 w-6" />
                <div>
                  <div className="font-semibold">Repair & Purge Bad Data</div>
                  <div className="text-xs opacity-70">Fix corrupted properties</div>
                </div>
              </Button>

              <Button 
                onClick={updatePause} 
                disabled={isLoading}
                variant="outline"
                className="h-16 flex flex-col gap-2"
              >
                <AlertTriangle className="h-6 w-6" />
                <div>
                  <div className="font-semibold">Toggle Pause</div>
                  <div className="text-xs opacity-70">Pause/resume notifications</div>
                </div>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results Display */}
        {results && (
          <Card>
            <CardHeader>
              <CardTitle>Scraping Results</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Total New Properties:</span>
                  <Badge variant="secondary">{results.totalNewProperties || 0}</Badge>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(results.results || {}).map(([source, result]: [string, any]) => (
                    <Card key={source} className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium capitalize">{source}</span>
                        <Badge variant={result.success ? "default" : "destructive"}>
                          {result.success ? "✓" : "✗"}
                        </Badge>
                      </div>
                      <div className="text-sm space-y-1">
                        <div>Found: {result.total_found || 0}</div>
                        <div>New: {result.new_properties || 0}</div>
                        {result.error && (
                          <div className="text-destructive text-xs">{result.error}</div>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Properties Display */}
        {properties.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Recent Properties ({properties.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {properties.slice(0, 20).map((property) => (
                  <div key={property.id} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <h3 className="font-semibold">{property.title}</h3>
                      <div className="flex gap-2">
                        <Badge variant="outline">{property.source}</Badge>
                        {property.price && (
                          <Badge variant="secondary">€{property.price}</Badge>
                        )}
                      </div>
                    </div>
                    
                    {property.address && (
                      <p className="text-sm text-muted-foreground">{property.address}</p>
                    )}
                    
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      {property.bedrooms && <span>🛏️ {property.bedrooms} bed</span>}
                      {property.bathrooms && <span>🚿 {property.bathrooms} bath</span>}
                      {property.surface_area && <span>📐 {property.surface_area}m²</span>}
                      <span>🕒 {new Date(property.first_seen_at).toLocaleDateString()}</span>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => window.open(property.url, '_blank')}
                      >
                        View Property
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}