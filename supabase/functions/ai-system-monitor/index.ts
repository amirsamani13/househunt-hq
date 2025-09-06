import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.1";

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SystemIssue {
  type: 'qa_failure' | 'scraper_health' | 'notification_system' | 'database_error';
  severity: 'critical' | 'high' | 'medium' | 'low';
  component: string;
  description: string;
  metadata: any;
}

interface AIAnalysis {
  rootCause: string;
  suggestedFixes: string[];
  stepByStepInstructions: string[];
  priorityLevel: number;
  estimatedComplexity: 'simple' | 'moderate' | 'complex';
  codeExamples?: string[];
  preventionTips: string[];
}

async function analyzeSystemHealth(): Promise<SystemIssue[]> {
  const issues: SystemIssue[] = [];

  // Check recent QA test failures
  const { data: recentTests } = await supabase
    .from('qa_test_results')
    .select('*')
    .eq('status', 'failed')
    .gte('started_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order('started_at', { ascending: false })
    .limit(10);

  if (recentTests && recentTests.length > 0) {
    const failurePatterns = recentTests.reduce((acc: any, test) => {
      acc[test.test_name] = (acc[test.test_name] || 0) + 1;
      return acc;
    }, {});

    for (const [testName, count] of Object.entries(failurePatterns)) {
      issues.push({
        type: 'qa_failure',
        severity: (count as number) >= 3 ? 'high' : 'medium',
        component: testName,
        description: `${testName} has failed ${count} times in the last 24 hours`,
        metadata: { 
          failureCount: count, 
          recentFailures: recentTests.filter(t => t.test_name === testName) 
        }
      });
    }
  }

  // Check scraper health issues
  const { data: scraperHealth } = await supabase
    .from('scraper_health')
    .select('*')
    .or('is_in_repair_mode.eq.true,consecutive_failures.gte.3,qa_failure_count.gte.2');

  if (scraperHealth && scraperHealth.length > 0) {
    scraperHealth.forEach(scraper => {
      let severity: 'critical' | 'high' | 'medium' | 'low' = 'medium';
      
      if (scraper.consecutive_failures >= 5 || scraper.is_in_repair_mode) {
        severity = 'critical';
      } else if (scraper.consecutive_failures >= 3) {
        severity = 'high';
      }

      issues.push({
        type: 'scraper_health',
        severity,
        component: scraper.source,
        description: `${scraper.source} scraper: ${scraper.consecutive_failures} failures, repair mode: ${scraper.is_in_repair_mode}`,
        metadata: scraper
      });
    });
  }

  // Check notification system issues
  const { data: pendingNotifications } = await supabase
    .from('notifications')
    .select('count')
    .eq('delivery_status', 'pending')
    .gte('sent_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString());

  if (pendingNotifications && pendingNotifications.length > 10) {
    issues.push({
      type: 'notification_system',
      severity: 'high',
      component: 'notification_delivery',
      description: `${pendingNotifications.length} notifications pending delivery for over 2 hours`,
      metadata: { pendingCount: pendingNotifications.length }
    });
  }

  // Check recent error logs
  const { data: errorLogs } = await supabase
    .from('scraping_logs')
    .select('*')
    .eq('status', 'failed')
    .gte('started_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
    .limit(5);

  if (errorLogs && errorLogs.length >= 3) {
    issues.push({
      type: 'database_error',
      severity: 'medium',
      component: 'scraping_system',
      description: `Multiple scraping failures in the last hour`,
      metadata: { errorLogs }
    });
  }

  return issues;
}

async function getAIAnalysis(issues: SystemIssue[]): Promise<Record<string, AIAnalysis>> {
  if (!openAIApiKey || issues.length === 0) {
    return {};
  }

  const systemPrompt = `You are an expert backend system analyst for a real estate property monitoring platform. 
  
  The system includes:
  - Property scrapers (pararius, kamernet, grunoverhuur)
  - QA testing system with continuous monitoring
  - Notification system for user alerts
  - Supabase database with RLS policies
  - Auto-repair mechanisms

  Analyze each issue and provide structured solutions. Focus on:
  1. Root cause identification
  2. Specific, actionable fixes
  3. Code examples when relevant
  4. Prevention strategies
  
  Return valid JSON only.`;

  const userPrompt = `Analyze these system issues and provide structured solutions:

  ${JSON.stringify(issues, null, 2)}

  For each issue, provide analysis in this exact JSON format:
  {
    "issue_key": {
      "rootCause": "Clear explanation of why this is happening",
      "suggestedFixes": ["Fix 1", "Fix 2", "Fix 3"],
      "stepByStepInstructions": ["Step 1", "Step 2", "Step 3"],
      "priorityLevel": 1-10,
      "estimatedComplexity": "simple|moderate|complex",
      "codeExamples": ["code snippet if relevant"],
      "preventionTips": ["Prevention tip 1", "Prevention tip 2"]
    }
  }`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    const data = await response.json();
    
    if (data.error) {
      console.error('OpenAI API error:', data.error);
      return {};
    }

    const analysisText = data.choices[0].message.content;
    return JSON.parse(analysisText);
  } catch (error) {
    console.error('Error getting AI analysis:', error);
    return {};
  }
}

async function createSystemReport(issues: SystemIssue[], analysis: Record<string, AIAnalysis>) {
  const reportId = crypto.randomUUID();
  
  const report = {
    id: reportId,
    timestamp: new Date().toISOString(),
    issueCount: issues.length,
    criticalIssues: issues.filter(i => i.severity === 'critical').length,
    highIssues: issues.filter(i => i.severity === 'high').length,
    issues: issues.map((issue, index) => ({
      ...issue,
      analysis: analysis[`issue_${index}`] || null
    })),
    summary: {
      systemHealthScore: Math.max(0, 100 - (issues.length * 10) - (issues.filter(i => i.severity === 'critical').length * 30)),
      recommendedActions: Object.values(analysis)
        .filter(a => a.priorityLevel >= 8)
        .flatMap(a => a.suggestedFixes)
        .slice(0, 5),
      nextCheckIn: new Date(Date.now() + 5 * 60 * 1000).toISOString()
    }
  };

  // Store the report
  const { error } = await supabase
    .from('qa_admin_alerts')
    .insert({
      title: `AI System Monitor Report - ${issues.length} Issues Detected`,
      message: `System health score: ${report.summary.systemHealthScore}/100. ${report.criticalIssues} critical, ${report.highIssues} high priority issues found.`,
      alert_type: 'ai_system_monitor',
      severity: report.criticalIssues > 0 ? 'critical' : report.highIssues > 0 ? 'high' : 'medium',
      details: report,
      status: 'pending'
    });

  if (error) {
    console.error('Error storing report:', error);
  }

  return report;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🤖 AI System Monitor started...');

    // Analyze current system health
    const issues = await analyzeSystemHealth();
    console.log(`📊 Found ${issues.length} issues`);

    if (issues.length === 0) {
      console.log('✅ System healthy - no issues detected');
      return new Response(JSON.stringify({ 
        status: 'healthy',
        message: 'No issues detected',
        timestamp: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get AI analysis of issues
    console.log('🧠 Getting AI analysis...');
    const analysis = await getAIAnalysis(issues);

    // Create comprehensive report
    const report = await createSystemReport(issues, analysis);
    console.log(`📝 Created report ${report.id}`);

    // For critical issues, create urgent alerts
    const criticalIssues = issues.filter(i => i.severity === 'critical');
    if (criticalIssues.length > 0) {
      console.log(`🚨 ${criticalIssues.length} critical issues detected`);
      
      // Trigger immediate admin alert for critical issues
      await supabase.functions.invoke('qa-admin-alerts', {
        body: { alert_id: 'latest' }
      });
    }

    return new Response(JSON.stringify({
      status: 'completed',
      reportId: report.id,
      issuesFound: issues.length,
      criticalIssues: criticalIssues.length,
      systemHealthScore: report.summary.systemHealthScore,
      recommendedActions: report.summary.recommendedActions
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ AI System Monitor error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
};

serve(handler);