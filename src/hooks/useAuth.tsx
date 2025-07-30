import { useState, useEffect, createContext, useContext } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  subscriptionStatus: {
    subscribed: boolean;
    tier: string;
    isTrialActive: boolean;
    trialEndsAt: string | null;
  };
  signOut: () => Promise<void>;
  checkSubscription: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  subscriptionStatus: {
    subscribed: false,
    tier: 'free',
    isTrialActive: false,
    trialEndsAt: null,
  },
  signOut: async () => {},
  checkSubscription: async () => {},
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscriptionStatus, setSubscriptionStatus] = useState({
    subscribed: false,
    tier: 'free',
    isTrialActive: false,
    trialEndsAt: null,
  });

  const checkSubscription = async () => {
    if (!user) return;
    
    try {
      const { data: subscriber } = await supabase
        .from('subscribers')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (subscriber) {
        const now = new Date();
        const trialEnd = subscriber.trial_end ? new Date(subscriber.trial_end) : null;
        const isTrialActive = trialEnd ? now < trialEnd : false;
        
        setSubscriptionStatus({
          subscribed: subscriber.subscribed || isTrialActive,
          tier: subscriber.subscription_tier || 'free',
          isTrialActive,
          trialEndsAt: subscriber.trial_end,
        });
      }
    } catch (error) {
      console.error('Error checking subscription:', error);
    }
  };

  useEffect(() => {
    const checkSubscriptionForUser = async (userId: string) => {
      try {
        const { data: subscriber } = await supabase
          .from('subscribers')
          .select('*')
          .eq('user_id', userId)
          .single();
        
        if (subscriber) {
          const now = new Date();
          const trialEnd = subscriber.trial_end ? new Date(subscriber.trial_end) : null;
          const isTrialActive = trialEnd ? now < trialEnd : false;
          
          setSubscriptionStatus({
            subscribed: subscriber.subscribed || isTrialActive,
            tier: subscriber.subscription_tier || 'free',
            isTrialActive,
            trialEndsAt: subscriber.trial_end,
          });
        }
      } catch (error) {
        console.error('Error checking subscription:', error);
      }
    };

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        
        if (session?.user) {
          await checkSubscriptionForUser(session.user.id);
        } else {
          setSubscriptionStatus({
            subscribed: false,
            tier: 'free',
            isTrialActive: false,
            trialEndsAt: null,
          });
        }
      }
    );

    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      
      if (session?.user) {
        await checkSubscriptionForUser(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Sign out error:', error);
      }
      // Always reset state regardless of API call success
      setUser(null);
      setSession(null);
      setSubscriptionStatus({
        subscribed: false,
        tier: 'free',
        isTrialActive: false,
        trialEndsAt: null,
      });
      // Clear local storage to fix refresh token issues
      localStorage.removeItem('supabase.auth.token');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const value = {
    user,
    session,
    loading,
    subscriptionStatus,
    signOut,
    checkSubscription,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};