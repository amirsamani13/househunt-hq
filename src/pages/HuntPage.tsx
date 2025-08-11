import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MapPin, DollarSign, Home, Bed, Bath, Car } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export default function HuntPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    location: "",
    minPrice: "",
    maxPrice: "",
    bedrooms: "",
    bathrooms: "",
    propertyType: "Any",
    postalCodes: ""
  });
  const [loading, setLoading] = useState(false);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [notificationsPaused, setNotificationsPaused] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleStartMonitoring = async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to create property alerts.",
        variant: "destructive"
      });
      navigate("/auth");
      return;
    }

    setLoading(true);
    
    try {
      const alertData = {
        user_id: user.id,
        name: `${formData.location || "Any Location"} Search`,
        min_price: formData.minPrice ? parseFloat(formData.minPrice) : null,
        max_price: formData.maxPrice ? parseFloat(formData.maxPrice) : null,
        min_bedrooms: formData.bedrooms ? parseInt(formData.bedrooms) : null,
        property_types: formData.propertyType !== "Any" ? [formData.propertyType.toLowerCase()] : null,
        cities: formData.location ? [formData.location] : null,
        postal_codes: formData.postalCodes ? formData.postalCodes.split(/[,\s]+/).filter(Boolean) : null,
      };

      const { error } = await supabase
        .from('user_alerts')
        .insert([alertData]);

      if (error) throw error;

      toast({
        title: "Alert Created!",
        description: "Your property monitoring alert has been set up successfully.",
      });

      // Reset form
      setFormData({
        location: "",
        minPrice: "",
        maxPrice: "",
        bedrooms: "",
        bathrooms: "",
        propertyType: "Any",
        postalCodes: ""
      });

    } catch (error) {
      console.error('Error creating alert:', error);
      toast({
        title: "Error",
        description: "Failed to create property alert. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAlerts = async () => {
    if (!user) return;
    setLoadingAlerts(true);
    const { data, error } = await supabase
      .from('user_alerts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (!error && data) setAlerts(data);
    setLoadingAlerts(false);
  };

  const fetchPause = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('notifications_paused')
      .eq('user_id', user.id)
      .maybeSingle();
    setNotificationsPaused(!!data?.notifications_paused);
  };

  const togglePauseAll = async () => {
    if (!user) return;
    const { error } = await supabase
      .from('profiles')
      .update({ notifications_paused: !notificationsPaused })
      .eq('user_id', user.id);
    if (error) {
      toast({ title: 'Error', description: 'Failed to update notification settings.', variant: 'destructive' });
    } else {
      setNotificationsPaused(!notificationsPaused);
      toast({ 
        title: !notificationsPaused ? 'Notifications paused' : 'Notifications resumed', 
        description: !notificationsPaused ? 'All alerts are paused for your account.' : 'You will start receiving alerts again.' 
      });
    }
  };

  const toggleAlertActive = async (id: string, current: boolean) => {
    const { error } = await supabase
      .from('user_alerts')
      .update({ is_active: !current })
      .eq('id', id);
    if (error) {
      toast({ title: 'Error', description: 'Failed to update alert.', variant: 'destructive' });
    } else {
      fetchAlerts();
    }
  };
  const handleDeleteAlert = async (id: string) => {
    const { error } = await supabase.from('user_alerts').delete().eq('id', id);
    if (error) {
      toast({ title: 'Error', description: 'Failed to delete alert.', variant: 'destructive' });
    } else {
      toast({ title: 'Alert removed', description: 'You will no longer receive notifications for this alert.' });
      fetchAlerts();
    }
  };

  useEffect(() => { 
    if (user) { 
      fetchAlerts(); 
      fetchPause(); 
    }
    const channel = supabase
      .channel('properties-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'properties' }, (payload) => {
        const p: any = payload.new;
        toast({ title: 'New property detected', description: p.title || 'A new listing is available.' });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center text-primary hover:text-primary/80">
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back to Home
            </Link>
            <h1 className="text-2xl font-bold">Start Your Hunt</h1>
            <Button variant="outline">Save Search</Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Search Form */}
        <Card className="mb-8 shadow-lg">
          <CardHeader>
            <CardTitle>Set Up Your Property Alerts</CardTitle>
            <CardDescription>
              Configure your search criteria and we'll notify you instantly when matching properties become available
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="location">Location</Label>
                <Input 
                  id="location" 
                  placeholder="City, neighborhood, or zip code"
                  value={formData.location}
                  onChange={(e) => handleInputChange("location", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="postal-codes">Postcodes/Neighborhoods (comma or space separated)</Label>
                <Input 
                  id="postal-codes" 
                  placeholder="e.g. 9711 AA, Oosterpoort, 9722"
                  value={formData.postalCodes}
                  onChange={(e) => handleInputChange("postalCodes", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="min-price">Min Price</Label>
                <Input 
                  id="min-price" 
                  type="number" 
                  placeholder="100000"
                  value={formData.minPrice}
                  onChange={(e) => handleInputChange("minPrice", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="max-price">Max Price</Label>
                <Input 
                  id="max-price" 
                  type="number" 
                  placeholder="500000"
                  value={formData.maxPrice}
                  onChange={(e) => handleInputChange("maxPrice", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="bedrooms">Min Bedrooms</Label>
                <Input 
                  id="bedrooms" 
                  type="number" 
                  placeholder="2" 
                  min="1"
                  value={formData.bedrooms}
                  onChange={(e) => handleInputChange("bedrooms", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="bathrooms">Min Bathrooms</Label>
                <Input 
                  id="bathrooms" 
                  type="number" 
                  placeholder="1" 
                  min="1"
                  value={formData.bathrooms}
                  onChange={(e) => handleInputChange("bathrooms", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="property-type">Property Type</Label>
                <select 
                  className="w-full px-3 py-2 border border-input rounded-md"
                  value={formData.propertyType}
                  onChange={(e) => handleInputChange("propertyType", e.target.value)}
                >
                  <option>Any</option>
                  <option>Room</option>
                  <option>Studio</option>
                  <option>Apartment</option>
                  <option>House</option>
                  <option>Flat</option>
                </select>
              </div>
            </div>
            <Button 
              variant="hero" 
              size="lg" 
              className="w-full"
              onClick={handleStartMonitoring}
              disabled={loading}
            >
              {loading ? "Creating Alert..." : "Start Monitoring Properties"}
            </Button>
          </CardContent>
        </Card>

        {/* Manage Alerts */}
        <Card className="mb-8">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle>Your Alerts</CardTitle>
              <CardDescription>Manage your saved property alerts</CardDescription>
            </div>
            <Button variant={notificationsPaused ? 'secondary' : 'outline'} onClick={togglePauseAll}>
              {notificationsPaused ? 'Resume notifications' : 'Pause all notifications'}
            </Button>
          </CardHeader>
          <CardContent>
            {loadingAlerts ? (
              <div className="text-muted-foreground">Loading alerts...</div>
            ) : alerts.length === 0 ? (
              <div className="text-muted-foreground">No alerts yet. Create one above to start receiving emails.</div>
            ) : (
              <div className="space-y-3">
                {alerts.map((a) => (
                  <div key={a.id} className="flex items-center justify-between border border-border rounded-md p-3">
                    <div>
                      <div className="font-medium">{a.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {a.min_price ? `€${a.min_price}` : 'Any'} - {a.max_price ? `€${a.max_price}` : 'Any'}
                        {a.min_bedrooms ? ` • ${a.min_bedrooms}+ beds` : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={a.is_active ? 'secondary' : 'outline'}>
                        {a.is_active ? 'Active' : 'Paused'}
                      </Badge>
                      <Button variant="outline" onClick={() => toggleAlertActive(a.id, a.is_active)}>
                        {a.is_active ? 'Pause' : 'Resume'}
                      </Button>
                      <Button variant="destructive" onClick={() => handleDeleteAlert(a.id)}>
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sample Results */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">Recent Properties (Demo)</h2>
            <Badge variant="secondary" className="animate-pulse">
              Live Feed Active
            </Badge>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                image: "🏠",
                price: "$425,000",
                title: "Beautiful 3BR Family Home",
                location: "Oak Grove, Downtown",
                beds: 3,
                baths: 2,
                sqft: "1,850",
                status: "New",
                time: "3 min ago"
              },
              {
                image: "🏢",
                price: "$315,000",
                title: "Modern Apartment with Views",
                location: "Riverside District",
                beds: 2,
                baths: 1,
                sqft: "1,200",
                status: "Urgent",
                time: "8 min ago"
              },
              {
                image: "🏡",
                price: "$675,000",
                title: "Renovated Victorian Charm",
                location: "Historic Quarter",
                beds: 4,
                baths: 3,
                sqft: "2,400",
                status: "Featured",
                time: "15 min ago"
              }
            ].map((property, index) => (
              <Card key={index} className="hover:shadow-lg transition-all duration-300 cursor-pointer">
                <CardContent className="p-0">
                  <div className="relative">
                    <div className="h-48 bg-gradient-to-br from-blue-100 to-green-100 flex items-center justify-center text-6xl">
                      {property.image}
                    </div>
                    <Badge 
                      className={`absolute top-2 right-2 ${
                        property.status === 'Urgent' ? 'bg-red-500' : 
                        property.status === 'New' ? 'bg-green-500' : 'bg-blue-500'
                      }`}
                    >
                      {property.status}
                    </Badge>
                  </div>
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-2xl font-bold text-primary">{property.price}</span>
                      <span className="text-xs text-muted-foreground">{property.time}</span>
                    </div>
                    <h3 className="font-semibold mb-2">{property.title}</h3>
                    <div className="flex items-center text-sm text-muted-foreground mb-3">
                      <MapPin className="w-4 h-4 mr-1" />
                      {property.location}
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center">
                          <Bed className="w-4 h-4 mr-1" />
                          {property.beds}
                        </div>
                        <div className="flex items-center">
                          <Bath className="w-4 h-4 mr-1" />
                          {property.baths}
                        </div>
                        <div className="flex items-center">
                          <Home className="w-4 h-4 mr-1" />
                          {property.sqft} sq ft
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Next Steps & Scraper Info */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="bg-gradient-to-r from-primary/10 to-secondary/10">
            <CardContent className="p-6">
              <h3 className="text-xl font-bold mb-2">🎯 What happens next?</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li>• Our scraper bots will monitor 50+ property websites 24/7</li>
                <li>• You'll receive instant SMS + email alerts for matching properties</li>
                <li>• Get notifications within 30 seconds of properties going live</li>
                <li>• Access detailed property insights and market analysis</li>
              </ul>
              <div className="mt-4">
                <Link to="/signup">
                  <Button variant="hero">
                    Start 14-Day Free Trial
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-secondary/10 to-primary/10">
            <CardContent className="p-6">
              <h3 className="text-xl font-bold mb-2">🤖 Our Scraper Bots</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li>• <strong>Zillow Bot:</strong> Monitors new listings & price changes</li>
                <li>• <strong>Realtor.com Bot:</strong> Tracks MLS updates in real-time</li>
                <li>• <strong>Local MLS Bots:</strong> Direct feeds from 200+ MLS systems</li>
                <li>• <strong>FSBO Scrapers:</strong> Finds for-sale-by-owner properties</li>
                <li>• <strong>Auction Bots:</strong> Tracks foreclosure & auction sites</li>
              </ul>
              <div className="mt-4 text-xs text-muted-foreground">
                All scraping is done legally and ethically, respecting robots.txt and rate limits
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}