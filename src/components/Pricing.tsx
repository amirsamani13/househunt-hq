import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Zap, Star, Crown } from "lucide-react";
import { Link } from "react-router-dom";

const plans = [
  {
    name: "Basic",
    price: "$19",
    period: "/month",
    description: "Perfect for first-time home buyers",
    icon: Zap,
    features: [
      "Up to 5 saved searches",
      "Email notifications",
      "Basic property details",
      "Weekly market reports",
      "Standard support"
    ],
    badge: null,
    buttonVariant: "outline" as const
  },
  {
    name: "Premium",
    price: "$39",
    period: "/month",
    description: "Best for serious house hunters",
    icon: Star,
    features: [
      "Unlimited saved searches",
      "Instant SMS + Email alerts",
      "Detailed property insights",
      "Daily market reports",
      "Priority support",
      "Advanced filtering",
      "Price history analysis"
    ],
    badge: "Most Popular",
    buttonVariant: "hero" as const
  },
  {
    name: "Pro",
    price: "$79",
    period: "/month",
    description: "For real estate professionals",
    icon: Crown,
    features: [
      "Everything in Premium",
      "Multiple client accounts",
      "API access for integration",
      "Custom notification rules",
      "Dedicated account manager",
      "White-label options",
      "Market trend predictions"
    ],
    badge: "Enterprise",
    buttonVariant: "secondary" as const
  }
];

export const Pricing = () => {
  return (
    <section className="py-24 bg-gradient-to-b from-white to-gray-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-4">
            Choose Your
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              {" "}Advantage
            </span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Select the perfect plan to stay ahead in the competitive housing market
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan, index) => {
            const IconComponent = plan.icon;
            return (
              <Card 
                key={plan.name} 
                className={`relative transition-all duration-300 hover:shadow-xl ${
                  plan.badge === "Most Popular" 
                    ? "border-primary shadow-lg scale-105 bg-gradient-to-b from-primary/5 to-transparent" 
                    : "hover:scale-105"
                }`}
              >
                {plan.badge && (
                  <Badge 
                    className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-primary text-primary-foreground"
                  >
                    {plan.badge}
                  </Badge>
                )}
                
                <CardHeader className="text-center pb-4">
                  <div className="w-12 h-12 mx-auto mb-4 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-full flex items-center justify-center">
                    <IconComponent className="w-6 h-6 text-primary" />
                  </div>
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    {plan.description}
                  </CardDescription>
                  <div className="pt-4">
                    <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  {plan.features.map((feature, featureIndex) => (
                    <div key={featureIndex} className="flex items-center">
                      <Check className="w-5 h-5 text-secondary mr-3 flex-shrink-0" />
                      <span className="text-sm text-muted-foreground">{feature}</span>
                    </div>
                  ))}
                </CardContent>

                <CardFooter>
                  <Link to="/signup" className="w-full">
                    <Button 
                      variant={plan.buttonVariant} 
                      size="lg" 
                      className="w-full"
                    >
                      Get Started
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            );
          })}
        </div>

        <div className="text-center mt-12">
          <p className="text-sm text-muted-foreground mb-4">
            All plans include 14-day free trial • Cancel anytime • No setup fees
          </p>
          <Button variant="ghost" className="text-primary hover:text-primary/80">
            Compare all features →
          </Button>
        </div>
      </div>
    </section>
  );
};