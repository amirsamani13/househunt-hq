import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.1";
import { Resend } from "npm:resend@4.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));
const ADMIN_EMAIL = 'amirsamani13@gmail.com';

const serve_handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    console.log('📊 Generating daily QA summary...');

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    // Get QA test runs from last 24 hours
    const { data: testRuns, error: testRunsError } = await supabase
      .from('qa_test_runs')
      .select('*')
      .gte('started_at', yesterday.toISOString());

    if (testRunsError) {
      throw new Error(`Failed to fetch test runs: ${testRunsError.message}`);
    }

    // Get test results from last 24 hours
    const { data: testResults, error: testResultsError } = await supabase
      .from('qa_test_results')
      .select('*')
      .gte('started_at', yesterday.toISOString());

    if (testResultsError) {
      throw new Error(`Failed to fetch test results: ${testResultsError.message}`);
    }

    // Get scraper health status
    const { data: scraperHealth, error: scraperHealthError } = await supabase
      .from('scraper_health')
      .select('*');

    if (scraperHealthError) {
      throw new Error(`Failed to fetch scraper health: ${scraperHealthError.message}`);
    }

    // Get pending admin alerts
    const { data: pendingAlerts, error: alertsError } = await supabase
      .from('qa_admin_alerts')
      .select('*')
      .eq('status', 'pending')
      .gte('created_at', yesterday.toISOString());

    if (alertsError) {
      throw new Error(`Failed to fetch pending alerts: ${alertsError.message}`);
    }

    // Calculate metrics
    const totalRuns = testRuns?.length || 0;
    const completedRuns = testRuns?.filter(run => run.status === 'completed').length || 0;
    const avgPassedTests = completedRuns > 0 
      ? Math.round((testRuns?.reduce((sum, run) => sum + (run.passed_tests || 0), 0) || 0) / completedRuns)
      : 0;
    const avgFailedTests = completedRuns > 0 
      ? Math.round((testRuns?.reduce((sum, run) => sum + (run.failed_tests || 0), 0) || 0) / completedRuns)
      : 0;

    // Group test results by test name
    const testsByType = testResults?.reduce((acc: any, test) => {
      if (!acc[test.test_name]) {
        acc[test.test_name] = { passed: 0, failed: 0 };
      }
      if (test.status === 'passed') {
        acc[test.test_name].passed++;
      } else {
        acc[test.test_name].failed++;
      }
      return acc;
    }, {}) || {};

    // Generate HTML email
    const emailHTML = generateSummaryHTML({
      totalRuns,
      completedRuns,
      avgPassedTests,
      avgFailedTests,
      testsByType,
      scraperHealth: scraperHealth || [],
      pendingAlerts: pendingAlerts || [],
      period: '24 hours'
    });

    // Send email
    const { error: emailError } = await resend.emails.send({
      from: 'QA System <noreply@resend.dev>',
      to: [ADMIN_EMAIL],
      subject: `Daily QA Summary - ${new Date().toISOString().split('T')[0]}`,
      html: emailHTML,
    });

    if (emailError) {
      throw new Error(`Failed to send email: ${emailError.message}`);
    }

    console.log('✅ Daily QA summary sent successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Daily summary sent',
        metrics: {
          totalRuns,
          completedRuns,
          avgPassedTests,
          avgFailedTests,
          pendingAlertsCount: pendingAlerts?.length || 0
        }
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error('❌ Daily summary error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

function generateSummaryHTML(data: any) {
  const {
    totalRuns,
    completedRuns,
    avgPassedTests,
    avgFailedTests,
    testsByType,
    scraperHealth,
    pendingAlerts,
    period
  } = data;

  const healthyScrapers = scraperHealth.filter((s: any) => !s.is_in_repair_mode && s.consecutive_failures <= 2);
  const unhealthyScrapers = scraperHealth.filter((s: any) => s.is_in_repair_mode || s.consecutive_failures > 2);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; }
        .header { background: #1f2937; color: white; padding: 20px; margin: -30px -30px 30px -30px; border-radius: 8px 8px 0 0; }
        .metric { background: #f8fafc; padding: 15px; margin: 10px 0; border-radius: 6px; border-left: 4px solid #3b82f6; }
        .alert { background: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 10px 0; border-radius: 6px; }
        .healthy { color: #059669; }
        .unhealthy { color: #dc2626; }
        .warning { color: #d97706; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
        th { background-color: #f9fafb; font-weight: 600; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🤖 Daily QA System Summary</h1>
          <p>Report for the last ${period} • ${new Date().toLocaleDateString()}</p>
        </div>

        <h2>📊 Test Execution Metrics</h2>
        <div class="metric">
          <strong>Total Test Runs:</strong> ${totalRuns}<br>
          <strong>Completed Runs:</strong> ${completedRuns}<br>
          <strong>Average Passed Tests per Run:</strong> ${avgPassedTests}<br>
          <strong>Average Failed Tests per Run:</strong> ${avgFailedTests}
        </div>

        <h2>🧪 Test Results by Type</h2>
        <table>
          <thead>
            <tr>
              <th>Test Type</th>
              <th>Passed</th>
              <th>Failed</th>
              <th>Success Rate</th>
            </tr>
          </thead>
          <tbody>
            ${Object.entries(testsByType).map(([testName, results]: [string, any]) => {
              const total = results.passed + results.failed;
              const successRate = total > 0 ? Math.round((results.passed / total) * 100) : 0;
              const statusClass = successRate >= 80 ? 'healthy' : successRate >= 60 ? 'warning' : 'unhealthy';
              
              return `
                <tr>
                  <td><strong>${testName.replace('_', ' ').toUpperCase()}</strong></td>
                  <td class="healthy">${results.passed}</td>
                  <td class="unhealthy">${results.failed}</td>
                  <td class="${statusClass}">${successRate}%</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <h2>🔧 Scraper Health Status</h2>
        <div class="metric">
          <span class="healthy">✅ Healthy Scrapers: ${healthyScrapers.length}</span><br>
          <span class="unhealthy">❌ Unhealthy Scrapers: ${unhealthyScrapers.length}</span>
        </div>

        ${unhealthyScrapers.length > 0 ? `
          <h3>🚨 Scrapers Requiring Attention:</h3>
          ${unhealthyScrapers.map((scraper: any) => `
            <div class="alert">
              <strong>${scraper.source}</strong><br>
              • Consecutive Failures: ${scraper.consecutive_failures}<br>
              • In Repair Mode: ${scraper.is_in_repair_mode ? 'Yes' : 'No'}<br>
              • Repair Attempts: ${scraper.repair_attempt_count}<br>
              • Last Successful Run: ${scraper.last_successful_run ? new Date(scraper.last_successful_run).toLocaleString() : 'Never'}
            </div>
          `).join('')}
        ` : ''}

        <h2>🚨 Pending Alerts</h2>
        <div class="metric">
          <strong>Total Pending Alerts:</strong> ${pendingAlerts.length}
        </div>

        ${pendingAlerts.length > 0 ? `
          ${pendingAlerts.map((alert: any) => `
            <div class="alert">
              <strong>${alert.title}</strong> (${alert.severity})<br>
              <em>${alert.message}</em><br>
              <small>Created: ${new Date(alert.created_at).toLocaleString()}</small>
            </div>
          `).join('')}
        ` : '<p class="healthy">✅ No pending alerts</p>'}

        <div style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #e5e7eb; text-align: center; color: #6b7280;">
          <p>This is an automated daily summary from your QA system.<br>
          Generated on ${new Date().toLocaleString()}</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

serve(serve_handler);