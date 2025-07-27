import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Check, Zap, Target, Bell } from "lucide-react";
import { Link } from "react-router-dom";

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <Link to="/" className="flex items-center text-primary hover:text-primary/80">
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to Home
          </Link>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 max-w-6xl mx-auto">
          {/* Left side - Benefits */}
          <div className="space-y-8">
            <div>
              <h1 className="text-4xl font-bold text-foreground mb-4">
                Join Thousands of
                <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                  {" "}Smart Hunters
                </span>
              </h1>
              <p className="text-xl text-muted-foreground">
                Start your 14-day free trial and never miss your dream home again
              </p>
            </div>

            <div className="space-y-6">
              <div className="flex items-start space-x-4">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <Bell className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">Instant Notifications</h3>
                  <p className="text-muted-foreground">Get alerted within 30 seconds when properties matching your criteria go live</p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="w-10 h-10 bg-secondary/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <Target className="w-5 h-5 text-secondary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">Smart Filtering</h3>
                  <p className="text-muted-foreground">Advanced AI-powered filters to find exactly what you're looking for</p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <Zap className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">24/7 Monitoring</h3>
                  <p className="text-muted-foreground">Our scraper bots never sleep, monitoring 50+ property websites continuously</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-primary/10 to-secondary/10 p-6 rounded-lg">
              <h4 className="font-semibold mb-2">What our members say:</h4>
              <blockquote className="text-muted-foreground italic">
                "I found my dream home in just 3 days! The instant alerts gave me the edge I needed in this competitive market."
              </blockquote>
              <div className="mt-2 text-sm text-muted-foreground">
                - Sarah K., Premium Member
              </div>
            </div>
          </div>

          {/* Right side - Signup Form */}
          <div className="flex items-center justify-center">
            <Card className="w-full max-w-md shadow-xl">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl">Start Your Free Trial</CardTitle>
                <CardDescription>
                  No credit card required • Cancel anytime
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="name">Full Name</Label>
                  <Input id="name" placeholder="John Doe" />
                </div>
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input id="email" type="email" placeholder="john@example.com" />
                </div>
                <div>
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input id="phone" type="tel" placeholder="+1 (555) 123-4567" />
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" placeholder="Create a secure password" />
                </div>

                <div className="space-y-3 pt-2">
                  <Button variant="hero" size="lg" className="w-full">
                    Start 14-Day Free Trial
                  </Button>
                  <p className="text-xs text-center text-muted-foreground">
                    By signing up, you agree to our Terms of Service and Privacy Policy
                  </p>
                </div>

                <div className="pt-4 border-t">
                  <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
                    <Check className="w-4 h-4 text-secondary" />
                    <span>Free for 14 days</span>
                  </div>
                  <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
                    <Check className="w-4 h-4 text-secondary" />
                    <span>Cancel anytime</span>
                  </div>
                  <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
                    <Check className="w-4 h-4 text-secondary" />
                    <span>No setup fees</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}