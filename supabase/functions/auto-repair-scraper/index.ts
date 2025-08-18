import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RepairResult {
  success: boolean;
  newUrl?: string;
  newSelectors?: any;
  error?: string;
}

// Auto-repair system for broken scrapers
class ScraperAutoRepair {
  private supabase: any;

  constructor(supabaseClient: any) {
    this.supabase = supabaseClient;
  }

  // Step 1: Check if URL is accessible and contains property listings
  async checkUrlHealth(url: string, source: string): Promise<boolean> {
    try {
      console.log(`🔍 Checking URL health for ${source}: ${url}`);
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (!response.ok) {
        console.log(`❌ URL health check failed for ${source}: ${response.status}`);
        return false;
      }

      const html = await response.text();
      
      // Look for common property indicators
      const propertyIndicators = [
        /€\s*\d+/g, // Price in euros
        /\d+\s*m²/g, // Surface area
        /\d+\s*(bedroom|bed|kamer|room)/gi,
        /groningen/gi, // City name
        /(apartment|house|studio|room|woning|huis|kamer)/gi
      ];

      let indicatorCount = 0;
      for (const pattern of propertyIndicators) {
        if (pattern.test(html)) {
          indicatorCount++;
        }
      }

      console.log(`📊 Found ${indicatorCount}/5 property indicators for ${source}`);
      return indicatorCount >= 2; // Require at least 2 indicators
      
    } catch (error) {
      console.log(`❌ URL health check error for ${source}:`, error.message);
      return false;
    }
  }

  // Step 2: Auto-discover new URL by navigating homepage and searching
  async discoverNewUrl(source: string, homepageUrl: string): Promise<string | null> {
    try {
      console.log(`🔍 Auto-discovering new URL for ${source} from ${homepageUrl}`);
      
      const response = await fetch(homepageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (!response.ok) {
        console.log(`❌ Homepage access failed for ${source}: ${response.status}`);
        return null;
      }

      const html = await response.text();
      
      // Look for search forms or direct links to Groningen listings
      const searchPatterns = {
        kamernet: [
          /href="([^"]*groningen[^"]*)"[^>]*>/gi,
          /href="([^"]*huren[^"]*groningen[^"]*)"[^>]*>/gi,
          /href="([^"]*search[^"]*)"[^>]*>/gi
        ],
        pararius: [
          /href="([^"]*apartments[^"]*groningen[^"]*)"[^>]*>/gi,
          /href="([^"]*huren[^"]*groningen[^"]*)"[^>]*>/gi
        ],
        funda: [
          /href="([^"]*huur[^"]*groningen[^"]*)"[^>]*>/gi,
          /href="([^"]*rental[^"]*groningen[^"]*)"[^>]*>/gi
        ]
      };

      const patterns = searchPatterns[source] || [];
      
      for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(html)) !== null) {
          let potentialUrl = match[1];
          
          // Clean and normalize URL
          if (potentialUrl.startsWith('/')) {
            const baseUrl = new URL(homepageUrl).origin;
            potentialUrl = baseUrl + potentialUrl;
          }
          
          if (potentialUrl.includes('groningen')) {
            console.log(`✅ Found potential URL for ${source}: ${potentialUrl}`);
            
            // Verify this URL actually works
            if (await this.checkUrlHealth(potentialUrl, source)) {
              return potentialUrl;
            }
          }
        }
      }

      console.log(`❌ No valid URL discovered for ${source}`);
      return null;
      
    } catch (error) {
      console.log(`❌ URL discovery error for ${source}:`, error.message);
      return null;
    }
  }

  // Step 3: Auto-discover new CSS selectors by analyzing page structure
  async discoverNewSelectors(url: string, source: string): Promise<any | null> {
    try {
      console.log(`🔍 Auto-discovering new selectors for ${source}`);
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (!response.ok) {
        return null;
      }

      const html = await response.text();
      
      // Look for repeating container patterns that contain property data
      const containerPatterns = [
        /<article[^>]*>[\s\S]*?€[\s\S]*?<\/article>/gi,
        /<div[^>]*class="[^"]*property[^"]*"[^>]*>[\s\S]*?€[\s\S]*?<\/div>/gi,
        /<div[^>]*class="[^"]*listing[^"]*"[^>]*>[\s\S]*?€[\s\S]*?<\/div>/gi,
        /<div[^>]*class="[^"]*item[^"]*"[^>]*>[\s\S]*?€[\s\S]*?<\/div>/gi,
        /<li[^>]*>[\s\S]*?€[\s\S]*?<\/li>/gi
      ];

      let bestPattern = null;
      let maxCount = 0;

      for (const pattern of containerPatterns) {
        const matches = html.match(pattern);
        if (matches && matches.length > maxCount) {
          maxCount = matches.length;
          bestPattern = pattern;
        }
      }

      if (bestPattern && maxCount >= 3) {
        console.log(`✅ Found ${maxCount} potential property containers for ${source}`);
        
        // Extract a sample to analyze structure
        const sample = html.match(bestPattern)?.[0];
        if (sample) {
          // Try to identify price, title, and link patterns within the container
          const selectors = {
            containerPattern: bestPattern.source,
            pricePattern: /€\s*(\d+(?:[\.,]\d+)*)/g,
            titlePattern: /<h[1-6][^>]*>([^<]+)<\/h[1-6]>/gi,
            linkPattern: /href="([^"]+)"/gi,
            lastUpdated: new Date().toISOString()
          };

          return selectors;
        }
      }

      console.log(`❌ No valid selectors discovered for ${source}`);
      return null;
      
    } catch (error) {
      console.log(`❌ Selector discovery error for ${source}:`, error.message);
      return null;
    }
  }

  // Main repair function
  async repairScraper(source: string): Promise<RepairResult> {
    try {
      console.log(`🔧 Starting auto-repair for ${source}`);
      
      // Get current scraper configuration
      const { data: healthData } = await this.supabase
        .from('scraper_health')
        .select('*')
        .eq('source', source)
        .single();

      if (!healthData) {
        return { success: false, error: 'Scraper health record not found' };
      }

      const currentUrl = healthData.current_url;
      const homepageMap = {
        kamernet: 'https://kamernet.nl',
        pararius: 'https://www.pararius.com',
        funda: 'https://www.funda.nl',
        campusgroningen: 'https://www.campusgroningen.nl',
        rotsvast: 'https://www.rotsvast.nl',
        expatrentalholland: 'https://www.expatrentalholland.com',
        vandermeulen: 'https://www.vandermeulen.nl',
        housinganywhere: 'https://housinganywhere.com',
        studenthousing: 'https://www.studenthousing.com',
        roomspot: 'https://www.roomspot.nl',
        rentberry: 'https://rentberry.com'
      };

      // Step 1: Check if current URL is healthy
      const isCurrentUrlHealthy = await this.checkUrlHealth(currentUrl, source);
      
      let newUrl = currentUrl;
      let newSelectors = healthData.current_selectors;
      
      if (!isCurrentUrlHealthy) {
        console.log(`🔧 URL is unhealthy, attempting to discover new URL for ${source}`);
        
        // Step 2: Try to discover new URL
        const homepage = homepageMap[source];
        if (homepage) {
          const discoveredUrl = await this.discoverNewUrl(source, homepage);
          if (discoveredUrl) {
            newUrl = discoveredUrl;
            console.log(`✅ Discovered new URL for ${source}: ${newUrl}`);
          }
        }
      }

      // Step 3: Always try to update selectors to handle website changes
      const discoveredSelectors = await this.discoverNewSelectors(newUrl, source);
      if (discoveredSelectors) {
        newSelectors = discoveredSelectors;
        console.log(`✅ Discovered new selectors for ${source}`);
      }

      // Update health record with repair results
      await this.supabase
        .from('scraper_health')
        .update({
          current_url: newUrl,
          current_selectors: newSelectors,
          repair_attempts: (healthData.repair_attempts || 0) + 1,
          last_repair_attempt: new Date().toISOString(),
          repair_status: (newUrl !== currentUrl || discoveredSelectors) ? 'repaired' : 'repair_failed',
          is_in_repair_mode: false,
          updated_at: new Date().toISOString()
        })
        .eq('source', source);

      const success = newUrl !== currentUrl || discoveredSelectors !== null;
      
      return {
        success,
        newUrl: newUrl !== currentUrl ? newUrl : undefined,
        newSelectors: discoveredSelectors || undefined,
        error: success ? undefined : 'No improvements found'
      };
      
    } catch (error) {
      console.log(`❌ Auto-repair failed for ${source}:`, error.message);
      
      // Update health record to indicate repair failure
      await this.supabase
        .from('scraper_health')
        .update({
          repair_status: 'repair_failed',
          is_in_repair_mode: false,
          updated_at: new Date().toISOString()
        })
        .eq('source', source);

      return { success: false, error: error.message };
    }
  }

  // Health check function to determine if repair is needed
  async checkScraperHealth(source: string): Promise<boolean> {
    try {
      // Check recent scraping results
      const { data: recentLogs } = await this.supabase
        .from('scraping_logs')
        .select('*')
        .eq('source', source)
        .gte('started_at', new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()) // Last 3 hours
        .order('started_at', { ascending: false });

      if (!recentLogs || recentLogs.length === 0) {
        console.log(`⚠️ No recent scraping logs for ${source}`);
        return false; // No recent activity
      }

      // Count consecutive runs with 0 new properties
      let consecutiveZeroRuns = 0;
      for (const log of recentLogs) {
        if (log.new_properties === 0) {
          consecutiveZeroRuns++;
        } else {
          break; // Break on first non-zero result
        }
      }

      console.log(`📊 ${source} has ${consecutiveZeroRuns} consecutive zero-property runs`);

      // Update health tracking
      await this.supabase
        .from('scraper_health')
        .update({
          consecutive_hours_zero_properties: consecutiveZeroRuns,
          repair_status: consecutiveZeroRuns >= 3 ? 'needs_repair' : 'healthy',
          updated_at: new Date().toISOString()
        })
        .eq('source', source);

      return consecutiveZeroRuns < 3; // Healthy if less than 3 consecutive zero runs
      
    } catch (error) {
      console.log(`❌ Health check error for ${source}:`, error.message);
      return false;
    }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { source, action = 'repair' } = await req.json();
    
    const autoRepair = new ScraperAutoRepair(supabase);
    
    if (action === 'health_check') {
      const isHealthy = await autoRepair.checkScraperHealth(source);
      return new Response(JSON.stringify({ 
        source, 
        healthy: isHealthy,
        action: isHealthy ? 'none' : 'repair_needed'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    if (action === 'repair') {
      const result = await autoRepair.repairScraper(source);
      return new Response(JSON.stringify({ 
        source, 
        ...result 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Auto-repair function error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});