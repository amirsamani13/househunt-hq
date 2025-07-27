import { Bell, Search, Smartphone, Clock, TrendingUp, Shield } from "lucide-react";

const features = [
  {
    icon: Bell,
    title: "Instant Notifications",
    description: "Get alerted within seconds when properties matching your criteria hit the market"
  },
  {
    icon: Search,
    title: "Smart Search Filters",
    description: "Advanced filtering by location, price, size, amenities, and custom criteria"
  },
  {
    icon: Smartphone,
    title: "Mobile First",
    description: "Optimized mobile experience so you can respond instantly, anywhere"
  },
  {
    icon: Clock,
    title: "24/7 Monitoring",
    description: "Continuous scanning of multiple property websites and databases"
  },
  {
    icon: TrendingUp,
    title: "Market Insights",
    description: "Real-time price trends and neighborhood analytics to inform your decisions"
  },
  {
    icon: Shield,
    title: "Verified Listings",
    description: "Only genuine properties from trusted sources - no spam or duplicates"
  }
];

export const Features = () => {
  return (
    <section className="py-24 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-4">
            Everything You Need to
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              {" "}Win
            </span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Powerful features designed to give you the competitive edge in today's fast-moving property market
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => {
            const IconComponent = feature.icon;
            return (
              <div 
                key={index}
                className="group p-6 rounded-lg border border-border/50 hover:border-primary/30 transition-all duration-300 hover:shadow-lg bg-gradient-to-b from-white to-gray-50/50"
              >
                <div className="w-12 h-12 mb-4 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <IconComponent className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};