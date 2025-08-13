import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Play, Database, AlertCircle } from "lucide-react";
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
          
          // Fetch latest properties to show results
          const { data: propertiesData, error: propertiesError } = await supabase
            .from('properties')
            .select('*')
            .order('first_seen_at', { ascending: false })
            .limit(10);
            
          if (propertiesError) {
            console.error('Error fetching properties:', propertiesError);
          } else {
            setProperties(propertiesData || []);
          }
          
          toast({
            title: "Scraping Completed!",
            description: `Found ${data?.totalNewProperties || 0} new properties`,
          });
        } catch (error: any) {
          console.error('Scraping error:', error);
          toast({
            title: "Scraping Failed",
            description: error.message || "Failed to scrape properties",
            variant: "destructive",
          });
        } finally {
          setIsLoading(false);
        }
      }, 100);
      
    } catch (error: any) {
      console.error('Scraping error:', error);
      toast({
        title: "Scraping Failed",
        description: error.message || "Failed to start scraping",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  const fetchProperties = async () => {
    try {
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .order('first_seen_at', { ascending: false })
        .limit(20);
        
      if (error) {
        throw error;
      }
      
      setProperties(data || []);
      toast({
        title: "Properties Loaded",
        description: `Showing ${data?.length || 0} recent properties`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to fetch properties",
        variant: "destructive",
      });
    }
  };
  // Fetch properties from the last 24 hours (all sources)
  const fetchLast24h = async () => {
    try {
      const cutoffIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .gte('first_seen_at', cutoffIso)
        .eq('is_active', true)
        .order('first_seen_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      setProperties(data || []);
      toast({ title: 'Last 24h Loaded', description: `Showing ${data?.length || 0} properties from last 24 hours` });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to fetch last 24h', variant: 'destructive' });
    }
  };

  const sendNotifications24hAll = async () => {
    if (!user) {
      toast({ title: 'Login required', description: 'Please sign in to send test notifications', variant: 'destructive' });
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke('send-notifications', {
        body: { windowHours: 24, testAll: true, only_user_email: user.email }
      });
      if (error) throw error;
      toast({ title: 'Notifications sent', description: `Result: ${data?.message || 'Done'}` });
    } catch (error: any) {
      toast({ title: 'Failed', description: error.message || 'Could not send notifications', variant: 'destructive' });
    }
  };

  // One-click cleanup: repairs bad titles in DB
  const runRepair = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('repair-properties');
      if (error) throw error;
      toast({ title: 'Repair complete', description: `Scanned ${data?.scanned || 0}, fixed ${data?.fixed || 0}, purged ${data?.purged || 0}` });
      fetchProperties();
    } catch (error: any) {
      toast({ title: 'Repair failed', description: error.message || 'Could not repair properties', variant: 'destructive' });
    }
  };

  // Test force send notifications (bypasses duplicate detection)
  const testForceNotifications = async () => {
    if (!user) {
      toast({ title: 'Login required', description: 'Please sign in to test notifications', variant: 'destructive' });
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke('send-notifications', {
        body: { only_user_email: user.email, force: true, windowHours: 24 }
      });
      if (error) throw error;
      toast({ title: 'Force notifications sent', description: `Result: ${data?.message || 'Done'}` });
    } catch (error: any) {
      toast({ title: 'Failed', description: error.message || 'Could not send notifications', variant: 'destructive' });
    }
  };

  const updatePause = async (value: boolean) => {
    if (!user) {
      toast({ title: 'Authentication Required', description: 'Please log in first.', variant: 'destructive' });
      return;
    }
    const { error } = await supabase
      .from('profiles')
      .update({ notifications_paused: value })
      .eq('user_id', user.id);
    if (error) {
      toast({ title: 'Error', description: 'Failed to update notification settings.', variant: 'destructive' });
    } else {
      toast({ title: value ? 'Notifications paused' : 'Notifications resumed' });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center text-primary hover:text-primary/80">
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back to Home
            </Link>
            <h1 className="text-2xl font-bold">Test Scraping</h1>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={fetchProperties}
                  disabled={isLoading}
                >
                  <Database className="w-4 h-4 mr-2" />
                  View Properties
                </Button>
                <Button 
                  variant="outline" 
                  onClick={fetchLast24h}
                  disabled={isLoading}
                >
                  <Database className="w-4 h-4 mr-2" />
                  View Last 24h
                </Button>
                <Button onClick={sendNotifications24hAll} disabled={isLoading || !user}>
                  Send 24h to Me
                </Button>
                <Button variant="secondary" onClick={testForceNotifications} disabled={isLoading || !user}>
                  Force Test Notifications
                </Button>
                <Button variant="outline" onClick={runRepair} disabled={isLoading}>
                  Repair & Purge Bad Data
                </Button>
                <Button variant="destructive" onClick={() => updatePause(true)}>
                  Pause notifications
                </Button>
                <Button variant="secondary" onClick={() => updatePause(false)}>
                  Resume
                </Button>
              </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Test Controls */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Property Scraping Test</CardTitle>
            <CardDescription>
              Test the property scraping functionality for Pararius, Kamernet, and Grunoverhuur
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Button 
                onClick={testScraping} 
                disabled={isLoading || !user}
                size="lg"
                className="flex items-center gap-2"
              >
                <Play className="w-4 h-4" />
                {isLoading ? "Scraping..." : "Start Scraping Test"}
              </Button>
              
              {!user && (
                <div className="flex items-center gap-2 text-amber-600">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm">Please log in to test scraping</span>
                </div>
              )}
            </div>
            
            {isLoading && (
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-700">
                  Scraping in progress... This may take 30-60 seconds as we fetch data from multiple sources.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results Summary */}
        {results && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Scraping Results</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Object.entries(results.results || {}).map(([source, result]: [string, any]) => (
                  <div key={source} className="p-4 border rounded-lg">
                    <h3 className="font-semibold capitalize mb-2">{source}</h3>
                    {result.success ? (
                      <div className="space-y-1">
                        <p className="text-sm text-green-600">✓ Success</p>
                        <p className="text-xs">Total: {result.total}</p>
                        <p className="text-xs">New: {result.new}</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm text-red-600">✗ Failed</p>
                        <p className="text-xs text-red-500">{result.error}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              <div className="mt-4 p-4 bg-green-50 rounded-lg">
                <p className="font-semibold text-green-800">
                  Total New Properties: {results.totalNewProperties}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Properties List */}
        {properties.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Recent Properties ({properties.length})</CardTitle>
              <CardDescription>
                Latest properties from the database
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {properties.map((property) => (
                  <div key={property.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-semibold">{property.title}</h3>
                        <p className="text-sm text-muted-foreground">{property.address}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline">{property.source}</Badge>
                        {property.price && (
                          <p className="font-bold text-lg">€{property.price}</p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      {property.bedrooms && <span>{property.bedrooms} bed</span>}
                      {property.bathrooms && <span>{property.bathrooms} bath</span>}
                      {property.surface_area && <span>{property.surface_area}m²</span>}
                      <span>Added: {new Date(property.first_seen_at).toLocaleString()}</span>
                    </div>
                    
                    <div className="mt-2">
                      <a 
                        href={property.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline text-sm"
                      >
                        View Original →
                      </a>
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