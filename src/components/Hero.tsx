import { Button } from "@/components/ui/button";
import { Bell, Zap, Target, Search, Globe, Shield } from "lucide-react";
import { Link } from "react-router-dom";

export const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-green-50 overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute inset-0 bg-grid-pattern"></div>
      </div>
      
      <div className="container mx-auto px-4 text-center relative z-10">
        <div className="max-w-5xl mx-auto animate-fade-in">
          {/* Badge */}
          <div className="inline-flex items-center px-4 py-2 bg-white/80 backdrop-blur-sm rounded-full border border-primary/20 mb-8 shadow-lg">
            <Zap className="w-4 h-4 text-primary mr-2" />
            <span className="text-sm font-medium text-primary">Netherlands #1 Rental Hunter</span>
          </div>

          {/* Main headline */}
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-foreground mb-6 leading-tight">
            Never Miss a Rental Home
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              {" "}in the Netherlands
            </span>
            <span className="text-foreground"> Again</span>
          </h1>

          {/* Three step explanation */}
          <div className="grid md:grid-cols-3 gap-8 my-16 max-w-4xl mx-auto">
            <div className="bg-white/60 backdrop-blur-sm p-6 rounded-2xl border border-primary/10 shadow-lg">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-primary">1</span>
              </div>
              <h3 className="font-semibold text-lg mb-2">Create Your Alert</h3>
              <p className="text-muted-foreground text-sm">Set your preferences for location, price, size, and property type</p>
            </div>
            
            <div className="bg-white/60 backdrop-blur-sm p-6 rounded-2xl border border-secondary/10 shadow-lg">
              <div className="w-12 h-12 bg-secondary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-secondary">2</span>
              </div>
              <h3 className="font-semibold text-lg mb-2">We Scan 30+ Websites 24/7</h3>
              <p className="text-muted-foreground text-sm">Our bots monitor Funda, Pararius, Kamernet, and 27 other platforms</p>
            </div>
            
            <div className="bg-white/60 backdrop-blur-sm p-6 rounded-2xl border border-primary/10 shadow-lg">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-primary">3</span>
              </div>
              <h3 className="font-semibold text-lg mb-2">Get Instant Notifications</h3>
              <p className="text-muted-foreground text-sm">Receive email alerts within 30 seconds of new listings</p>
            </div>
          </div>

          {/* Main CTA */}
          <div className="mb-8">
            <Link to="/hunt">
              <Button variant="hero" size="lg" className="text-xl px-12 py-6 rounded-2xl">
                Create a Free Alert
              </Button>
            </Link>
          </div>

          {/* Feature highlights */}
          <div className="flex flex-wrap justify-center gap-6 mb-12">
            <div className="flex items-center bg-white/60 backdrop-blur-sm px-4 py-2 rounded-full border border-primary/10">
              <Bell className="w-5 h-5 text-primary mr-2" />
              <span className="text-sm font-medium">Instant Email + SMS</span>
            </div>
            <div className="flex items-center bg-white/60 backdrop-blur-sm px-4 py-2 rounded-full border border-secondary/10">
              <Globe className="w-5 h-5 text-secondary mr-2" />
              <span className="text-sm font-medium">30+ Websites Monitored</span>
            </div>
            <div className="flex items-center bg-white/60 backdrop-blur-sm px-4 py-2 rounded-full border border-primary/10">
              <Shield className="w-5 h-5 text-primary mr-2" />
              <span className="text-sm font-medium">Legal & Ethical</span>
            </div>
          </div>

          {/* Social proof */}
          <div className="mt-12 pt-8 border-t border-border/50">
            <p className="text-sm text-muted-foreground mb-4">Helping Dutch renters since 2024</p>
            <div className="flex flex-wrap justify-center items-center gap-8 opacity-60">
              <div className="text-2xl font-bold text-primary">1,200+</div>
              <div className="text-sm text-muted-foreground">Active Users</div>
              <div className="w-px h-8 bg-border"></div>
              <div className="text-2xl font-bold text-secondary">15k+</div>
              <div className="text-sm text-muted-foreground">Properties Found</div>
              <div className="w-px h-8 bg-border"></div>
              <div className="text-2xl font-bold text-primary">30+</div>
              <div className="text-sm text-muted-foreground">Websites Scanned</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};