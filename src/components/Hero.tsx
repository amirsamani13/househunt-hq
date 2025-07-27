import { Button } from "@/components/ui/button";
import { Bell, Zap, Target } from "lucide-react";
import { Link } from "react-router-dom";

export const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-green-50 overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute inset-0 bg-grid-pattern"></div>
      </div>
      
      <div className="container mx-auto px-4 text-center relative z-10">
        <div className="max-w-4xl mx-auto animate-fade-in">
          {/* Badge */}
          <div className="inline-flex items-center px-4 py-2 bg-white/80 backdrop-blur-sm rounded-full border border-primary/20 mb-8 shadow-lg">
            <Zap className="w-4 h-4 text-primary mr-2" />
            <span className="text-sm font-medium text-primary">First to know, first to move</span>
          </div>

          {/* Main headline */}
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-foreground mb-6 leading-tight">
            Never Miss Your
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              {" "}Dream Home
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto leading-relaxed">
            Get instant notifications when new properties hit the market. Be the first to respond and increase your chances of securing that perfect home.
          </p>

          {/* Feature highlights */}
          <div className="flex flex-wrap justify-center gap-6 mb-12">
            <div className="flex items-center bg-white/60 backdrop-blur-sm px-4 py-2 rounded-full border border-primary/10">
              <Bell className="w-5 h-5 text-primary mr-2" />
              <span className="text-sm font-medium">Instant Alerts</span>
            </div>
            <div className="flex items-center bg-white/60 backdrop-blur-sm px-4 py-2 rounded-full border border-secondary/10">
              <Target className="w-5 h-5 text-secondary mr-2" />
              <span className="text-sm font-medium">Smart Filtering</span>
            </div>
            <div className="flex items-center bg-white/60 backdrop-blur-sm px-4 py-2 rounded-full border border-primary/10">
              <Zap className="w-5 h-5 text-primary mr-2" />
              <span className="text-sm font-medium">Lightning Fast</span>
            </div>
          </div>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link to="/hunt">
              <Button variant="hero" size="lg" className="text-lg px-8 py-4">
                Start Your Hunt
              </Button>
            </Link>
            <Link to="/signup">
              <Button variant="outline" size="lg" className="text-lg px-8 py-4">
                See How It Works
              </Button>
            </Link>
          </div>

          {/* Social proof */}
          <div className="mt-12 pt-8 border-t border-border/50">
            <p className="text-sm text-muted-foreground mb-4">Trusted by home hunters nationwide</p>
            <div className="flex flex-wrap justify-center items-center gap-8 opacity-60">
              <div className="text-2xl font-bold text-primary">500+</div>
              <div className="text-sm text-muted-foreground">Happy Members</div>
              <div className="w-px h-8 bg-border"></div>
              <div className="text-2xl font-bold text-secondary">10k+</div>
              <div className="text-sm text-muted-foreground">Properties Tracked</div>
              <div className="w-px h-8 bg-border"></div>
              <div className="text-2xl font-bold text-primary">24/7</div>
              <div className="text-sm text-muted-foreground">Monitoring</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};