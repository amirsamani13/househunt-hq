import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MapPin, DollarSign, Home, Bed, Bath, Car } from "lucide-react";
import { Link } from "react-router-dom";

export default function HuntPage() {
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
                <Input id="location" placeholder="City, neighborhood, or zip code" />
              </div>
              <div>
                <Label htmlFor="min-price">Min Price</Label>
                <Input id="min-price" type="number" placeholder="$100,000" />
              </div>
              <div>
                <Label htmlFor="max-price">Max Price</Label>
                <Input id="max-price" type="number" placeholder="$500,000" />
              </div>
              <div>
                <Label htmlFor="bedrooms">Min Bedrooms</Label>
                <Input id="bedrooms" type="number" placeholder="2" min="1" />
              </div>
              <div>
                <Label htmlFor="bathrooms">Min Bathrooms</Label>
                <Input id="bathrooms" type="number" placeholder="1" min="1" />
              </div>
              <div>
                <Label htmlFor="property-type">Property Type</Label>
                <select className="w-full px-3 py-2 border border-input rounded-md">
                  <option>Any</option>
                  <option>House</option>
                  <option>Apartment</option>
                  <option>Condo</option>
                  <option>Townhouse</option>
                </select>
              </div>
            </div>
            <Button variant="hero" size="lg" className="w-full">
              Start Monitoring Properties
            </Button>
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