import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, MapPin, Heart, DollarSign, Calendar, Wifi } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Live feed data is fetched from Supabase in the component

const stats = [
  { label: "Active Searches", value: "8", icon: Bell },
  { label: "Properties Found", value: "127", icon: MapPin },
  { label: "Saved Favorites", value: "15", icon: Heart },
  { label: "Avg. Response Time", value: "45s", icon: Calendar }
];

export const Dashboard = () => {
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProps = async () => {
      const { data, error } = await supabase
        .from('properties')
        .select('id,title,price,address,first_seen_at,source,url,city,image_urls')
        .eq('is_active', true)
        .order('first_seen_at', { ascending: false })
        .limit(10);
      if (!error) setProperties(data || []);
      setLoading(false);
    };
    fetchProps();
  }, []);

  const formatPrice = (value: any) => {
    if (value == null) return 'Price on request';
    const num = typeof value === 'number' ? value : parseFloat(value);
    return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num);
  };

  const timeAgo = (iso?: string) => {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} h ago`;
    const days = Math.floor(hrs / 24);
    return `${days} d ago`;
  };
  return (
    <section id="how-it-works" className="py-24 bg-gradient-to-b from-gray-50 to-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-4">
            Your Command
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              {" "}Center
            </span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            See how your personalized dashboard keeps you ahead of the competition
          </p>
        </div>

        <div className="max-w-6xl mx-auto">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {stats.map((stat, index) => {
              const IconComponent = stat.icon;
              return (
                <Card key={index} className="text-center">
                  <CardContent className="pt-6">
                    <div className="w-8 h-8 mx-auto mb-2 bg-primary/10 rounded-full flex items-center justify-center">
                      <IconComponent className="w-4 h-4 text-primary" />
                    </div>
                    <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                    <div className="text-sm text-muted-foreground">{stat.label}</div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Dashboard Preview */}
          <Card className="mb-8 shadow-xl">
            <CardHeader className="border-b bg-gradient-to-r from-primary/5 to-secondary/5">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center">
                    <Wifi className="w-5 h-5 text-secondary mr-2" />
                    Live Property Feed
                  </CardTitle>
                  <CardDescription>Real-time notifications from your saved searches</CardDescription>
                </div>
                <Badge variant="secondary" className="animate-pulse">
                  <div className="w-2 h-2 bg-secondary rounded-full mr-2"></div>
                  Live
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="space-y-0">
                {loading ? (
                  <div className="p-4 text-muted-foreground">Loading live properties...</div>
                ) : properties.length === 0 ? (
                  <div className="p-4 text-muted-foreground">No recent properties found.</div>
                ) : (
                  properties.map((p) => (
                    <div 
                      key={p.id}
                      className="flex items-center p-4 border-b last:border-b-0 hover:bg-gray-50/50 transition-colors duration-200"
                    >
                      <div className="text-3xl mr-4">🏠</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-semibold text-foreground truncate">{p.title}</h4>
                          <Badge variant="secondary" className="ml-2 flex-shrink-0">
                            {p.source}
                          </Badge>
                        </div>
                        <div className="flex items-center text-sm text-muted-foreground mb-2">
                          <MapPin className="w-4 h-4 mr-1" />
                          <span className="truncate">{p.address || p.city || 'Groningen'}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <DollarSign className="w-4 h-4 text-secondary mr-1" />
                            <span className="font-semibold text-secondary">{formatPrice(p.price)}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">{timeAgo(p.first_seen_at)}</span>
                        </div>
                      </div>
                      <div className="ml-4 flex-shrink-0">
                        <a href={p.url} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="outline">
                            View Details
                          </Button>
                        </a>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* CTA */}
          <div className="text-center">
            <Link to="/hunt">
              <Button variant="hero" size="lg" className="text-lg px-8 py-4">
                Try Your Dashboard Free
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};