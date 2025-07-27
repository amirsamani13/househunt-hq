import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, MapPin, Heart, DollarSign, Calendar, Wifi } from "lucide-react";

const notifications = [
  {
    id: 1,
    title: "New 3BR House in Downtown",
    price: "$450,000",
    location: "123 Oak Street, Downtown",
    time: "2 min ago",
    status: "new",
    image: "🏠"
  },
  {
    id: 2,
    title: "Modern Apartment with Garden",
    price: "$320,000",
    location: "456 Pine Ave, Riverside",
    time: "5 min ago",
    status: "urgent",
    image: "🏢"
  },
  {
    id: 3,
    title: "Renovated Victorian Home",
    price: "$680,000",
    location: "789 Elm Drive, Historic District",
    time: "12 min ago",
    status: "featured",
    image: "🏡"
  }
];

const stats = [
  { label: "Active Searches", value: "8", icon: Bell },
  { label: "Properties Found", value: "127", icon: MapPin },
  { label: "Saved Favorites", value: "15", icon: Heart },
  { label: "Avg. Response Time", value: "45s", icon: Calendar }
];

export const Dashboard = () => {
  return (
    <section className="py-24 bg-gradient-to-b from-gray-50 to-white">
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
                {notifications.map((notification, index) => (
                  <div 
                    key={notification.id}
                    className="flex items-center p-4 border-b last:border-b-0 hover:bg-gray-50/50 transition-colors duration-200"
                  >
                    <div className="text-3xl mr-4">{notification.image}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-semibold text-foreground truncate">{notification.title}</h4>
                        <Badge 
                          variant={notification.status === "urgent" ? "destructive" : "secondary"}
                          className="ml-2 flex-shrink-0"
                        >
                          {notification.status}
                        </Badge>
                      </div>
                      <div className="flex items-center text-sm text-muted-foreground mb-2">
                        <MapPin className="w-4 h-4 mr-1" />
                        <span className="truncate">{notification.location}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <DollarSign className="w-4 h-4 text-secondary mr-1" />
                          <span className="font-semibold text-secondary">{notification.price}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{notification.time}</span>
                      </div>
                    </div>
                    <div className="ml-4 flex-shrink-0">
                      <Button size="sm" variant="outline">
                        View Details
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* CTA */}
          <div className="text-center">
            <Button variant="hero" size="lg" className="text-lg px-8 py-4">
              Try Your Dashboard Free
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};