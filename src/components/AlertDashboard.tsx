import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Trash2, Edit, MapPin, Euro, Home, Bed, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface Alert {
  id: string;
  name: string;
  cities: string[] | null;
  min_price: number | null;
  max_price: number | null;
  min_bedrooms: number | null;
  max_bedrooms: number | null;
  min_surface_area: number | null;
  property_types: string[] | null;
  furnishing: string[] | null;
  sources: string[] | null;
  is_active: boolean;
  created_at: string;
}

export default function AlertDashboard() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchAlerts();
    }
  }, [user]);

  const fetchAlerts = async () => {
    try {
      const { data, error } = await supabase
        .from('user_alerts')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAlerts(data || []);
    } catch (error) {
      console.error('Error fetching alerts:', error);
      toast.error('Failed to load alerts');
    } finally {
      setLoading(false);
    }
  };

  const toggleAlert = async (alertId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('user_alerts')
        .update({ is_active: isActive })
        .eq('id', alertId);

      if (error) throw error;
      
      setAlerts(alerts.map(alert => 
        alert.id === alertId ? { ...alert, is_active: isActive } : alert
      ));
      
      toast.success(`Alert ${isActive ? 'activated' : 'paused'}`);
    } catch (error) {
      console.error('Error updating alert:', error);
      toast.error('Failed to update alert');
    }
  };

  const deleteAlert = async (alertId: string) => {
    if (!confirm('Are you sure you want to delete this alert?')) return;

    try {
      const { error } = await supabase
        .from('user_alerts')
        .delete()
        .eq('id', alertId);

      if (error) throw error;
      
      setAlerts(alerts.filter(alert => alert.id !== alertId));
      toast.success('Alert deleted');
    } catch (error) {
      console.error('Error deleting alert:', error);
      toast.error('Failed to delete alert');
    }
  };

  const formatPrice = (min?: number | null, max?: number | null) => {
    if (!min && !max) return 'Any price';
    if (min && max) return `€${min} - €${max}`;
    if (min) return `€${min}+`;
    if (max) return `Up to €${max}`;
    return 'Any price';
  };

  const formatBedrooms = (min?: number | null, max?: number | null) => {
    if (!min && !max) return 'Any bedrooms';
    if (min && max && min === max) return `${min} bedroom${min > 1 ? 's' : ''}`;
    if (min && max) return `${min}-${max} bedrooms`;
    if (min) return `${min}+ bedrooms`;
    if (max) return `Up to ${max} bedrooms`;
    return 'Any bedrooms';
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-4 bg-muted rounded w-1/3"></div>
              <div className="h-3 bg-muted rounded w-1/2"></div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="h-3 bg-muted rounded w-full"></div>
                <div className="h-3 bg-muted rounded w-3/4"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center">
            <Home className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-2 text-sm font-semibold">No alerts yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Create your first alert to start getting notified about new properties.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Your Alerts</h2>
        <Badge variant="secondary">{alerts.length} alert{alerts.length !== 1 ? 's' : ''}</Badge>
      </div>

      {alerts.map((alert) => (
        <Card key={alert.id} className={`transition-opacity ${!alert.is_active ? 'opacity-60' : ''}`}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {alert.name}
                  {alert.is_active ? (
                    <Badge variant="default">Active</Badge>
                  ) : (
                    <Badge variant="secondary">Paused</Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Created {new Date(alert.created_at).toLocaleDateString()}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={alert.is_active}
                  onCheckedChange={(checked) => toggleAlert(alert.id, checked)}
                />
                <Button variant="ghost" size="sm">
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteAlert(alert.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>
                  {alert.cities?.length ? alert.cities.join(', ') : 'All cities'}
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <Euro className="h-4 w-4 text-muted-foreground" />
                <span>{formatPrice(alert.min_price, alert.max_price)}</span>
              </div>
              
              <div className="flex items-center gap-2">
                <Bed className="h-4 w-4 text-muted-foreground" />
                <span>{formatBedrooms(alert.min_bedrooms, alert.max_bedrooms)}</span>
              </div>
              
              {alert.min_surface_area && (
                <div className="flex items-center gap-2">
                  <Home className="h-4 w-4 text-muted-foreground" />
                  <span>{alert.min_surface_area}+ m²</span>
                </div>
              )}
              
              {alert.property_types?.length && (
                <div className="flex items-center gap-2">
                  <Home className="h-4 w-4 text-muted-foreground" />
                  <span>{alert.property_types.join(', ')}</span>
                </div>
              )}
              
              {alert.furnishing?.length && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>{alert.furnishing.join(', ')}</span>
                </div>
              )}
            </div>
            
            {alert.sources?.length && (
              <div className="mt-3 pt-3 border-t">
                <p className="text-sm text-muted-foreground mb-2">Sources:</p>
                <div className="flex flex-wrap gap-1">
                  {alert.sources.map((source) => (
                    <Badge key={source} variant="outline" className="text-xs">
                      {source}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}