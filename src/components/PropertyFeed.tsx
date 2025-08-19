import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, Euro, Home, Bed, ExternalLink, Calendar, Filter } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Property {
  id: string;
  title: string;
  description: string | null;
  price: number | null;
  bedrooms: number | null;
  surface_area: number | null;
  city: string | null;
  address: string | null;
  property_type: string | null;
  furnishing: string | null;
  url: string;
  source: string;
  image_urls: string[] | null;
  first_seen_at: string;
}

export default function PropertyFeed() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    city: '',
    minPrice: '',
    maxPrice: '',
    source: '',
    propertyType: ''
  });

  useEffect(() => {
    fetchProperties();
  }, []);

  const fetchProperties = async () => {
    try {
      let query = supabase
        .from('properties')
        .select('*')
        .eq('is_active', true)
        .order('first_seen_at', { ascending: false })
        .limit(50);

      // Apply filters
      if (filters.city) {
        query = query.ilike('city', `%${filters.city}%`);
      }
      if (filters.minPrice) {
        query = query.gte('price', parseInt(filters.minPrice));
      }
      if (filters.maxPrice) {
        query = query.lte('price', parseInt(filters.maxPrice));
      }
      if (filters.source) {
        query = query.eq('source', filters.source);
      }
      if (filters.propertyType) {
        query = query.eq('property_type', filters.propertyType);
      }

      const { data, error } = await query;

      if (error) throw error;
      setProperties(data || []);
    } catch (error) {
      console.error('Error fetching properties:', error);
      toast.error('Failed to load properties');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const applyFilters = () => {
    setLoading(true);
    fetchProperties();
  };

  const clearFilters = () => {
    setFilters({
      city: '',
      minPrice: '',
      maxPrice: '',
      source: '',
      propertyType: ''
    });
    setLoading(true);
    setTimeout(() => {
      fetchProperties();
    }, 100);
  };

  const formatPrice = (price?: number | null) => {
    if (!price) return 'Price on request';
    return `€${price.toLocaleString()}/month`;
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    return `${Math.floor(diffInHours / 24)}d ago`;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i} className="animate-pulse">
            <div className="md:flex">
              <div className="md:w-48 h-48 bg-muted"></div>
              <div className="flex-1 p-6">
                <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-muted rounded w-1/2 mb-4"></div>
                <div className="space-y-2">
                  <div className="h-3 bg-muted rounded w-full"></div>
                  <div className="h-3 bg-muted rounded w-2/3"></div>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filter Properties
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <Input
              placeholder="City"
              value={filters.city}
              onChange={(e) => handleFilterChange('city', e.target.value)}
            />
            <Input
              placeholder="Min price"
              type="number"
              value={filters.minPrice}
              onChange={(e) => handleFilterChange('minPrice', e.target.value)}
            />
            <Input
              placeholder="Max price"
              type="number"
              value={filters.maxPrice}
              onChange={(e) => handleFilterChange('maxPrice', e.target.value)}
            />
            <Select value={filters.source} onValueChange={(value) => handleFilterChange('source', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All sources</SelectItem>
                <SelectItem value="funda">Funda</SelectItem>
                <SelectItem value="pararius">Pararius</SelectItem>
                <SelectItem value="kamernet">Kamernet</SelectItem>
                <SelectItem value="rotsvast">Rotsvast</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.propertyType} onValueChange={(value) => handleFilterChange('propertyType', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Property type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All types</SelectItem>
                <SelectItem value="apartment">Apartment</SelectItem>
                <SelectItem value="house">House</SelectItem>
                <SelectItem value="studio">Studio</SelectItem>
                <SelectItem value="room">Room</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={applyFilters}>Apply Filters</Button>
            <Button variant="outline" onClick={clearFilters}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Latest Properties</h2>
        <Badge variant="secondary">{properties.length} properties</Badge>
      </div>

      {properties.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Home className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-semibold">No properties found</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Try adjusting your filters or check back later for new listings.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {properties.map((property) => (
            <Card key={property.id} className="hover:shadow-md transition-shadow">
              <div className="md:flex">
                {property.image_urls && property.image_urls.length > 0 ? (
                  <div className="md:w-48 h-48 md:h-auto">
                    <img
                      src={property.image_urls[0]}
                      alt={property.title}
                      className="w-full h-full object-cover md:rounded-l-lg"
                      onError={(e) => {
                        e.currentTarget.src = '/placeholder.svg';
                      }}
                    />
                  </div>
                ) : (
                  <div className="md:w-48 h-48 md:h-auto bg-muted flex items-center justify-center">
                    <Home className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                
                <div className="flex-1 p-6">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <CardTitle className="line-clamp-2">{property.title}</CardTitle>
                      <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                        <Badge variant="outline" className="text-xs">
                          {property.source}
                        </Badge>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {getTimeAgo(property.first_seen_at)}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold">{formatPrice(property.price)}</div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
                    {property.city && (
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span>{property.city}</span>
                      </div>
                    )}
                    
                    {property.bedrooms && (
                      <div className="flex items-center gap-1">
                        <Bed className="h-4 w-4 text-muted-foreground" />
                        <span>{property.bedrooms} bedroom{property.bedrooms > 1 ? 's' : ''}</span>
                      </div>
                    )}
                    
                    {property.surface_area && (
                      <div className="flex items-center gap-1">
                        <Home className="h-4 w-4 text-muted-foreground" />
                        <span>{property.surface_area} m²</span>
                      </div>
                    )}
                    
                    {property.property_type && (
                      <div className="flex items-center gap-1">
                        <Home className="h-4 w-4 text-muted-foreground" />
                        <span className="capitalize">{property.property_type}</span>
                      </div>
                    )}
                  </div>
                  
                  {property.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                      {property.description}
                    </p>
                  )}
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {property.furnishing && (
                        <Badge variant="secondary" className="text-xs capitalize">
                          {property.furnishing}
                        </Badge>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(property.url, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      View Property
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}