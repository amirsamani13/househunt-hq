import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ScraperConfig {
  source: string;
  current_url: string;
  backup_urls: string[];
  current_selectors: any;
  backup_selectors: any[];
}

const serve_handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    console.log('🔧 Auto-Repair Scraper started');

    const { scraper_source, repair_type } = await req.json();

    if (!scraper_source) {
      throw new Error('scraper_source is required');
    }

    console.log(`🔧 Starting auto-repair for: ${scraper_source}`);

    // Get current scraper health data
    const { data: healthData, error: healthError } = await supabase
      .from('scraper_health')
      .select('*')
      .eq('source', scraper_source)
      .single();

    if (healthError) {
      throw new Error(`Failed to get scraper health data: ${healthError.message}`);
    }

    console.log(`📊 Current health data for ${scraper_source}:`, {
      consecutive_failures: healthData.consecutive_failures,
      is_in_repair_mode: healthData.is_in_repair_mode,
      repair_attempts: healthData.repair_attempts
    });

    let repairSuccess = false;
    let repairLog = [];

    // Mark scraper as in repair mode
    await supabase
      .from('scraper_health')
      .update({
        is_in_repair_mode: true,
        last_repair_attempt: new Date().toISOString()
      })
      .eq('source', scraper_source);

    // Repair Type 1: URL Health Check & Rotation
    if (!repair_type || repair_type === 'url_check') {
      console.log('🔧 Performing URL health check and rotation');
      
      const urlRepairResult = await repairUrlHealth(scraper_source, healthData);
      repairLog.push(urlRepairResult);
      
      if (urlRepairResult.success) {
        repairSuccess = true;
        console.log(`✅ URL repair successful for ${scraper_source}`);
      }
    }

    // Repair Type 2: Selector Validation & Update
    if (!repairSuccess && (!repair_type || repair_type === 'selector_check')) {
      console.log('🔧 Performing selector validation and update');
      
      const selectorRepairResult = await repairSelectors(scraper_source, healthData);
      repairLog.push(selectorRepairResult);
      
      if (selectorRepairResult.success) {
        repairSuccess = true;
        console.log(`✅ Selector repair successful for ${scraper_source}`);
      }
    }

    // Repair Type 3: Anti-Bot Mitigation
    if (!repairSuccess && (!repair_type || repair_type === 'anti_bot')) {
      console.log('🔧 Performing anti-bot mitigation');
      
      const antiBotResult = await repairAntiBotIssues(scraper_source, healthData);
      repairLog.push(antiBotResult);
      
      if (antiBotResult.success) {
        repairSuccess = true;
        console.log(`✅ Anti-bot repair successful for ${scraper_source}`);
      }
    }

    // Update scraper health with repair results
    const newRepairAttempts = (healthData.repair_attempts || 0) + 1;
    
    await supabase
      .from('scraper_health')
      .update({
        is_in_repair_mode: !repairSuccess,
        repair_attempts: newRepairAttempts,
        repair_status: repairSuccess ? 'healthy' : 'failed',
        consecutive_failures: repairSuccess ? 0 : healthData.consecutive_failures
      })
      .eq('source', scraper_source);

    console.log(`🔧 Auto-repair completed for ${scraper_source}: ${repairSuccess ? 'SUCCESS' : 'FAILED'}`);

    // Test the repair by running a quick scrape
    if (repairSuccess) {
      console.log('🧪 Testing repair with quick scrape...');
      
      try {
        const testResult = await supabase.functions.invoke('scrape-properties', {
          body: { test_mode: true, sources: [scraper_source] }
        });
        
        console.log('🧪 Test scrape result:', testResult);
        
        if (testResult.error) {
          repairSuccess = false;
          repairLog.push({
            step: 'validation_test',
            success: false,
            message: `Test scrape failed: ${testResult.error.message}`,
            timestamp: new Date().toISOString()
          });
        }
      } catch (testError: any) {
        console.error('🧪 Test scrape error:', testError);
        repairSuccess = false;
        repairLog.push({
          step: 'validation_test',
          success: false,
          message: `Test execution failed: ${testError.message}`,
          timestamp: new Date().toISOString()
        });
      }
    }

    return new Response(JSON.stringify({
      success: repairSuccess,
      scraper: scraper_source,
      repair_attempts: newRepairAttempts,
      repair_log: repairLog,
      next_action: repairSuccess ? 'monitor' : (newRepairAttempts >= 3 ? 'admin_alert' : 'retry')
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error: any) {
    console.error('❌ Auto-repair error:', error);

    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
};

async function repairUrlHealth(scraperSource: string, healthData: any): Promise<any> {
  const repairStep = {
    step: 'url_health_check',
    success: false,
    message: '',
    timestamp: new Date().toISOString(),
    details: {}
  };

  try {
    console.log(`🔗 Checking URL health for ${scraperSource}`);

    const currentUrl = healthData.current_url;
    const backupUrls = healthData.backup_urls || [];

    // Test current URL
    if (currentUrl) {
      try {
        const response = await fetch(currentUrl, {
          method: 'HEAD',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });

        if (response.ok) {
          repairStep.success = true;
          repairStep.message = 'Current URL is healthy';
          repairStep.details = { url: currentUrl, status: response.status };
          return repairStep;
        }

        console.log(`❌ Current URL failed: ${response.status}`);
      } catch (error: any) {
        console.log(`❌ Current URL error: ${error.message}`);
      }
    }

    // Try backup URLs
    for (const backupUrl of backupUrls) {
      try {
        console.log(`🔗 Testing backup URL: ${backupUrl}`);
        
        const response = await fetch(backupUrl, {
          method: 'HEAD',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });

        if (response.ok) {
          // Update scraper health with working backup URL
          const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
          );

          await supabase
            .from('scraper_health')
            .update({ current_url: backupUrl })
            .eq('source', scraperSource);

          repairStep.success = true;
          repairStep.message = `Switched to working backup URL: ${backupUrl}`;
          repairStep.details = { old_url: currentUrl, new_url: backupUrl, status: response.status };
          return repairStep;
        }

        console.log(`❌ Backup URL failed: ${backupUrl} - ${response.status}`);
      } catch (error: any) {
        console.log(`❌ Backup URL error: ${backupUrl} - ${error.message}`);
      }
    }

    repairStep.message = 'All URLs failed health check';
    repairStep.details = { current_url: currentUrl, backup_urls: backupUrls };

  } catch (error: any) {
    repairStep.message = `URL health check failed: ${error.message}`;
  }

  return repairStep;
}

async function repairSelectors(scraperSource: string, healthData: any): Promise<any> {
  const repairStep = {
    step: 'selector_validation',
    success: false,
    message: '',
    timestamp: new Date().toISOString(),
    details: {}
  };

  try {
    console.log(`🎯 Validating selectors for ${scraperSource}`);

    const currentUrl = healthData.current_url;
    const currentSelectors = healthData.current_selectors;
    const backupSelectors = healthData.backup_selectors || [];

    if (!currentUrl) {
      repairStep.message = 'No URL available for selector testing';
      return repairStep;
    }

    // Fetch page content
    const response = await fetch(currentUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      repairStep.message = `Failed to fetch page: ${response.status}`;
      return repairStep;
    }

    const html = await response.text();

    // Test current selectors
    if (currentSelectors) {
      const elementsFound = testSelectorsOnHTML(html, currentSelectors);
      
      if (elementsFound > 0) {
        repairStep.success = true;
        repairStep.message = `Current selectors are working (${elementsFound} elements found)`;
        repairStep.details = { selectors: currentSelectors, elements_found: elementsFound };
        return repairStep;
      }

      console.log(`❌ Current selectors failed: 0 elements found`);
    }

    // Try backup selectors
    for (let i = 0; i < backupSelectors.length; i++) {
      const backupSelector = backupSelectors[i];
      console.log(`🎯 Testing backup selectors set ${i + 1}`);
      
      const elementsFound = testSelectorsOnHTML(html, backupSelector);
      
      if (elementsFound > 0) {
        // Update scraper health with working backup selectors
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        await supabase
          .from('scraper_health')
          .update({ current_selectors: backupSelector })
          .eq('source', scraperSource);

        repairStep.success = true;
        repairStep.message = `Switched to working backup selectors (${elementsFound} elements found)`;
        repairStep.details = { 
          old_selectors: currentSelectors, 
          new_selectors: backupSelector, 
          elements_found: elementsFound 
        };
        return repairStep;
      }

      console.log(`❌ Backup selectors ${i + 1} failed: 0 elements found`);
    }

    repairStep.message = 'All selectors failed validation';
    repairStep.details = { 
      current_selectors: currentSelectors, 
      backup_selectors: backupSelectors,
      page_length: html.length
    };

  } catch (error: any) {
    repairStep.message = `Selector validation failed: ${error.message}`;
  }

  return repairStep;
}

async function repairAntiBotIssues(scraperSource: string, healthData: any): Promise<any> {
  const repairStep = {
    step: 'anti_bot_mitigation',
    success: false,
    message: '',
    timestamp: new Date().toISOString(),
    details: {}
  };

  try {
    console.log(`🤖 Checking for anti-bot measures on ${scraperSource}`);

    const currentUrl = healthData.current_url;
    
    if (!currentUrl) {
      repairStep.message = 'No URL available for anti-bot testing';
      return repairStep;
    }

    // Test with different user agents and headers
    const testConfigs = [
      {
        name: 'Standard Browser',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive'
        }
      },
      {
        name: 'Mobile Browser',
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      },
      {
        name: 'Alternative Browser',
        headers: {
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      }
    ];

    for (const config of testConfigs) {
      try {
        console.log(`🤖 Testing with ${config.name} configuration`);
        
        const response = await fetch(currentUrl, {
          headers: config.headers
        });

        const html = await response.text();

        // Check for anti-bot indicators
        const antiBotIndicators = [
          'cloudflare',
          'captcha',
          'bot detection',
          'access denied',
          'blocked',
          'rate limit',
          'suspicious activity'
        ];

        const hasAntiBotContent = antiBotIndicators.some(indicator => 
          html.toLowerCase().includes(indicator)
        );

        if (response.ok && !hasAntiBotContent && html.length > 1000) {
          // Update scraper health with working configuration
          const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
          );

          const updatedConfig = {
            ...healthData.current_selectors,
            user_agent: config.headers['User-Agent'],
            headers: config.headers
          };

          await supabase
            .from('scraper_health')
            .update({ current_selectors: updatedConfig })
            .eq('source', scraperSource);

          repairStep.success = true;
          repairStep.message = `Anti-bot mitigation successful with ${config.name}`;
          repairStep.details = { 
            config: config.name, 
            status: response.status,
            content_length: html.length,
            headers: config.headers
          };
          return repairStep;
        }

        console.log(`❌ ${config.name} failed: status ${response.status}, anti-bot: ${hasAntiBotContent}`);

      } catch (error: any) {
        console.log(`❌ ${config.name} error: ${error.message}`);
      }
    }

    repairStep.message = 'All anti-bot mitigation attempts failed';
    repairStep.details = { tested_configs: testConfigs.map(c => c.name) };

  } catch (error: any) {
    repairStep.message = `Anti-bot mitigation failed: ${error.message}`;
  }

  return repairStep;
}

function testSelectorsOnHTML(html: string, selectors: any): number {
  try {
    // Simple selector testing - count potential matches
    // In a real implementation, you would use a proper HTML parser
    
    if (!selectors || typeof selectors !== 'object') {
      return 0;
    }

    let elementsFound = 0;

    // Test common property listing selectors
    const testSelectors = [
      selectors.propertyContainer || '.property',
      selectors.titleSelector || '.title',
      selectors.priceSelector || '.price',
      selectors.urlSelector || 'a[href]'
    ];

    for (const selector of testSelectors) {
      if (selector && typeof selector === 'string') {
        // Simple count of potential matches (basic implementation)
        const classMatches = html.split(`class="${selector.replace('.', '')}`).length - 1;
        const idMatches = html.split(`id="${selector.replace('#', '')}`).length - 1;
        elementsFound += Math.max(classMatches, idMatches);
      }
    }

    return elementsFound;

  } catch (error: any) {
    console.error('Error testing selectors:', error);
    return 0;
  }
}

serve(serve_handler);