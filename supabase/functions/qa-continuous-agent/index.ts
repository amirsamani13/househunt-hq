import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TestResult {
  test_name: string;
  test_target?: string;
  status: 'passed' | 'failed' | 'skipped';
  error_message?: string;
  test_data?: any;
  quality_score?: number;
  response_time_ms?: number;
}

interface QATestRun {
  id: string;
  started_at: string;
  test_user_id?: string;
  test_property_id?: string;
}

const serve_handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  let testRun: QATestRun | null = null;
  const results: TestResult[] = [];

  try {
    console.log('🔍 Starting QA Continuous Agent...');

    // Create test run record
    const { data: testRunData, error: testRunError } = await supabase
      .from('qa_test_runs')
      .insert({
        status: 'running',
        total_tests: 4
      })
      .select()
      .single();

    if (testRunError) {
      throw new Error(`Failed to create test run: ${testRunError.message}`);
    }

    testRun = testRunData;
    console.log(`📊 Created test run: ${testRun.id}`);

    // Test A: User Registration & Alert Creation
    console.log('🧪 Running Test A: User Registration & Alert Creation');
    const userTest = await runUserRegistrationTest(supabase, testRun.id);
    results.push(userTest);

    if (userTest.status === 'passed' && userTest.test_data?.user_id && userTest.test_data?.alert_id) {
      // Update test run with user info
      await supabase
        .from('qa_test_runs')
        .update({ test_user_id: userTest.test_data.user_id })
        .eq('id', testRun.id);

      // Test B: End-to-End Notification Test
      console.log('🧪 Running Test B: End-to-End Notification Test');
      const notificationTest = await runNotificationTest(supabase, testRun.id, userTest.test_data);
      results.push(notificationTest);

      if (notificationTest.test_data?.property_id) {
        await supabase
          .from('qa_test_runs')
          .update({ test_property_id: notificationTest.test_data.property_id })
          .eq('id', testRun.id);
      }
    } else {
      results.push({
        test_name: 'notification_test',
        status: 'skipped',
        error_message: 'User registration failed'
      });
    }

    // Test C: Scraper Health Check
    console.log('🧪 Running Test C: Scraper Health Check');
    const scraperTests = await runScraperHealthChecks(supabase, testRun.id);
    results.push(...scraperTests);

    // Test D: Cleanup
    console.log('🧪 Running Test D: Cleanup');
    const cleanupTest = await runCleanupTest(supabase, testRun.id, testRun.test_user_id, testRun.test_property_id);
    results.push(cleanupTest);

    // Process results and handle failures
    const passedTests = results.filter(r => r.status === 'passed').length;
    const failedTests = results.filter(r => r.status === 'failed').length;

    console.log(`📈 Test Results: ${passedTests} passed, ${failedTests} failed`);

    // Handle auto-repair for failed tests
    for (const result of results.filter(r => r.status === 'failed')) {
      console.log(`🔧 Attempting auto-repair for failed test: ${result.test_name}`);
      await handleAutoRepair(supabase, testRun.id, result);
    }

    // Update test run completion
    await supabase
      .from('qa_test_runs')
      .update({
        status: failedTests > 0 ? 'failed' : 'completed',
        completed_at: new Date().toISOString(),
        passed_tests: passedTests,
        failed_tests: failedTests
      })
      .eq('id', testRun.id);

    console.log('✅ QA Continuous Agent completed');

    return new Response(JSON.stringify({
      success: true,
      test_run_id: testRun.id,
      results: {
        total: results.length,
        passed: passedTests,
        failed: failedTests
      }
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error: any) {
    console.error('❌ QA Agent error:', error);

    if (testRun) {
      await supabase
        .from('qa_test_runs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: error.message
        })
        .eq('id', testRun.id);
    }

    return new Response(JSON.stringify({
      error: error.message,
      test_run_id: testRun?.id
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
};

async function runUserRegistrationTest(supabase: any, testRunId: string): Promise<TestResult> {
  const startTime = Date.now();
  
  try {
    // Generate unique test user
    const timestamp = Date.now();
    const testEmail = `qa-agent-user-${timestamp}@test.com`;
    const testPassword = `TestPass123!${timestamp}`;

    console.log(`👤 Creating test user: ${testEmail}`);

    // Create test user using auth admin API
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true
    });

    if (authError) {
      throw new Error(`Auth user creation failed: ${authError.message}`);
    }

    // Record test user for cleanup
    await supabase
      .from('qa_test_users')
      .insert({
        user_id: authUser.user.id,
        email: testEmail,
        test_run_id: testRunId
      });

    // Create test alert for the user
    const { data: alertData, error: alertError } = await supabase
      .from('user_alerts')
      .insert({
        user_id: authUser.user.id,
        name: `QA Test Alert ${timestamp}`,
        cities: ['Groningen'],
        max_price: 9999,
        min_bedrooms: 1,
        is_active: true
      })
      .select()
      .single();

    if (alertError) {
      throw new Error(`Alert creation failed: ${alertError.message}`);
    }

    const responseTime = Date.now() - startTime;

    const result: TestResult = {
      test_name: 'user_registration',
      status: 'passed',
      test_data: {
        user_id: authUser.user.id,
        email: testEmail,
        alert_id: alertData.id
      },
      response_time_ms: responseTime
    };

    await supabase.from('qa_test_results').insert({
      test_run_id: testRunId,
      ...result,
      completed_at: new Date().toISOString()
    });

    return result;

  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    
    const result: TestResult = {
      test_name: 'user_registration',
      status: 'failed',
      error_message: error.message,
      response_time_ms: responseTime
    };

    await supabase.from('qa_test_results').insert({
      test_run_id: testRunId,
      ...result,
      completed_at: new Date().toISOString()
    });

    return result;
  }
}

async function runNotificationTest(supabase: any, testRunId: string, userData: any): Promise<TestResult> {
  const startTime = Date.now();
  
  try {
    const timestamp = Date.now();
    
    // Create fake property that matches the test alert
    const testProperty = {
      external_id: `qa-test-property-${timestamp}`,
      source: 'qa-test',
      title: `QA Test Property ${timestamp}`,
      description: 'This is a test property for QA validation',
      price: 1500, // Within the alert range
      bedrooms: 2, // Meets min bedrooms requirement
      city: 'Groningen', // Matches alert city
      address: 'Test Street 123, Groningen',
      url: `https://example.com/property/${timestamp}`,
      is_active: true,
      property_type: 'apartment',
      furnishing: 'furnished'
    };

    console.log(`🏠 Creating test property: ${testProperty.external_id}`);

    const { data: propertyData, error: propertyError } = await supabase
      .from('properties')
      .insert(testProperty)
      .select()
      .single();

    if (propertyError) {
      throw new Error(`Property creation failed: ${propertyError.message}`);
    }

    // Wait a moment for triggers to process
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check if notification was created
    const { data: notifications, error: notificationError } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userData.user_id)
      .eq('property_id', propertyData.id);

    if (notificationError) {
      throw new Error(`Notification check failed: ${notificationError.message}`);
    }

    if (!notifications || notifications.length === 0) {
      throw new Error('No notification was triggered for matching property');
    }

    const notification = notifications[0];

    // Validate notification quality
    const qualityIssues = [];
    let qualityScore = 100;

    if (!notification.message || notification.message.length < 10) {
      qualityIssues.push('Message too short or empty');
      qualityScore -= 30;
    }

    if (!notification.message.includes('€')) {
      qualityIssues.push('Price not properly formatted');
      qualityScore -= 20;
    }

    if (!notification.message.includes('Groningen')) {
      qualityIssues.push('City not mentioned in notification');
      qualityScore -= 15;
    }

    const responseTime = Date.now() - startTime;

    const result: TestResult = {
      test_name: 'notification_test',
      status: qualityScore >= 70 ? 'passed' : 'failed',
      test_data: {
        property_id: propertyData.id,
        notification_id: notification.id,
        quality_issues: qualityIssues
      },
      quality_score: qualityScore,
      response_time_ms: responseTime,
      error_message: qualityScore < 70 ? `Quality issues: ${qualityIssues.join(', ')}` : undefined
    };

    await supabase.from('qa_test_results').insert({
      test_run_id: testRunId,
      ...result,
      completed_at: new Date().toISOString()
    });

    // Update notification quality data
    await supabase
      .from('notifications')
      .update({
        quality_score: qualityScore,
        quality_issues: qualityIssues,
        qa_validated_at: new Date().toISOString()
      })
      .eq('id', notification.id);

    return result;

  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    
    const result: TestResult = {
      test_name: 'notification_test',
      status: 'failed',
      error_message: error.message,
      response_time_ms: responseTime
    };

    await supabase.from('qa_test_results').insert({
      test_run_id: testRunId,
      ...result,
      completed_at: new Date().toISOString()
    });

    return result;
  }
}

async function runScraperHealthChecks(supabase: any, testRunId: string): Promise<TestResult[]> {
  const scrapers = ['pararius', 'kamernet', 'grunoverhuur'];
  const results: TestResult[] = [];

  for (const scraper of scrapers) {
    const startTime = Date.now();
    
    try {
      console.log(`🔍 Checking scraper health: ${scraper}`);

      // Get scraper health data
      const { data: healthData, error: healthError } = await supabase
        .from('scraper_health')
        .select('*')
        .eq('source', scraper)
        .maybeSingle();

      let healthIssues = [];
      let healthScore = 100;

      // Check if scraper has recent successful runs
      const { data: recentLogs, error: logError } = await supabase
        .from('scraping_logs')
        .select('*')
        .eq('source', scraper)
        .eq('status', 'success')
        .gte('started_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('started_at', { ascending: false })
        .limit(1);

      if (logError || !recentLogs || recentLogs.length === 0) {
        healthIssues.push('No successful runs in last 24 hours');
        healthScore -= 50;
      }

      // Check if scraper is in repair mode
      if (healthData?.is_in_repair_mode) {
        healthIssues.push('Scraper is in repair mode');
        healthScore -= 30;
      }

      // Check consecutive failures
      if (healthData && healthData.consecutive_failures > 3) {
        healthIssues.push(`High consecutive failures: ${healthData.consecutive_failures}`);
        healthScore -= 20;
      }

      const responseTime = Date.now() - startTime;

      const result: TestResult = {
        test_name: 'scraper_health',
        test_target: scraper,
        status: healthScore >= 70 ? 'passed' : 'failed',
        test_data: {
          health_data: healthData,
          health_issues: healthIssues
        },
        quality_score: healthScore,
        response_time_ms: responseTime,
        error_message: healthScore < 70 ? `Health issues: ${healthIssues.join(', ')}` : undefined
      };

      await supabase.from('qa_test_results').insert({
        test_run_id: testRunId,
        ...result,
        completed_at: new Date().toISOString()
      });

      // Update scraper health QA data
      await supabase
        .from('scraper_health')
        .update({
          last_qa_check: new Date().toISOString(),
          qa_failure_count: healthScore < 70 ? (healthData?.qa_failure_count || 0) + 1 : 0
        })
        .eq('source', scraper);

      results.push(result);

    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      
      const result: TestResult = {
        test_name: 'scraper_health',
        test_target: scraper,
        status: 'failed',
        error_message: error.message,
        response_time_ms: responseTime
      };

      await supabase.from('qa_test_results').insert({
        test_run_id: testRunId,
        ...result,
        completed_at: new Date().toISOString()
      });

      results.push(result);
    }
  }

  return results;
}

async function runCleanupTest(supabase: any, testRunId: string, testUserId?: string, testPropertyId?: string): Promise<TestResult> {
  const startTime = Date.now();
  
  try {
    console.log('🧹 Running cleanup operations');

    let cleanupOperations = 0;
    let cleanupErrors = [];

    // Clean up test property
    if (testPropertyId) {
      const { error: propertyError } = await supabase
        .from('properties')
        .delete()
        .eq('id', testPropertyId);
      
      if (propertyError) {
        cleanupErrors.push(`Property cleanup failed: ${propertyError.message}`);
      } else {
        cleanupOperations++;
      }
    }

    // Clean up test user
    if (testUserId) {
      // Delete user alerts first
      await supabase
        .from('user_alerts')
        .delete()
        .eq('user_id', testUserId);

      // Delete auth user
      const { error: authError } = await supabase.auth.admin.deleteUser(testUserId);
      
      if (authError) {
        cleanupErrors.push(`User cleanup failed: ${authError.message}`);
      } else {
        cleanupOperations++;
      }

      // Mark test user as cleaned up
      await supabase
        .from('qa_test_users')
        .update({ cleaned_up_at: new Date().toISOString() })
        .eq('user_id', testUserId);
    }

    // Run general cleanup
    await supabase.rpc('cleanup_old_qa_data');
    cleanupOperations++;

    const responseTime = Date.now() - startTime;

    const result: TestResult = {
      test_name: 'cleanup',
      status: cleanupErrors.length === 0 ? 'passed' : 'failed',
      test_data: {
        operations_completed: cleanupOperations,
        cleanup_errors: cleanupErrors
      },
      response_time_ms: responseTime,
      error_message: cleanupErrors.length > 0 ? cleanupErrors.join('; ') : undefined
    };

    await supabase.from('qa_test_results').insert({
      test_run_id: testRunId,
      ...result,
      completed_at: new Date().toISOString()
    });

    return result;

  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    
    const result: TestResult = {
      test_name: 'cleanup',
      status: 'failed',
      error_message: error.message,
      response_time_ms: responseTime
    };

    await supabase.from('qa_test_results').insert({
      test_run_id: testRunId,
      ...result,
      completed_at: new Date().toISOString()
    });

    return result;
  }
}

async function handleAutoRepair(supabase: any, testRunId: string, failedTest: TestResult): Promise<void> {
  try {
    console.log(`🔧 Handling auto-repair for: ${failedTest.test_name}`);

    if (failedTest.test_name === 'scraper_health' && failedTest.test_target) {
      // Handle scraper auto-repair
      const scraper = failedTest.test_target;
      
      // Check current repair attempt count
      const { data: healthData } = await supabase
        .from('scraper_health')
        .select('repair_attempt_count, last_admin_alert')
        .eq('source', scraper)
        .single();

      const attemptCount = (healthData?.repair_attempt_count || 0) + 1;

      if (attemptCount <= 3) {
        console.log(`🔧 Attempting auto-repair for ${scraper} (attempt ${attemptCount})`);
        
        // Trigger auto-repair function with proper parameters
        try {
          const { error: repairError } = await supabase.functions.invoke('auto-repair-scraper', {
            body: { 
              scraper_source: scraper,
              repair_type: 'full_health_check'
            }
          });

          if (repairError) {
            console.error(`❌ Auto-repair invocation failed for ${scraper}:`, repairError);
          }
        } catch (invokeError) {
          console.error(`❌ Failed to invoke auto-repair for ${scraper}:`, invokeError);
        }

        await supabase
          .from('scraper_health')
          .update({
            repair_attempt_count: attemptCount,
            is_in_repair_mode: true,
            last_repair_attempt: new Date().toISOString()
          })
          .eq('source', scraper);

      } else {
        // Max attempts reached, check if we need to send admin alert (avoid spam)
        const lastAlert = healthData?.last_admin_alert;
        const now = new Date();
        const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        
        // Only send alert if no alert was sent in the last 24 hours
        if (!lastAlert || new Date(lastAlert) < twentyFourHoursAgo) {
          console.log(`🚨 Max repair attempts reached for ${scraper}, sending admin alert`);
          await createAdminAlert(supabase, testRunId, {
            alert_type: 'scraper_repair_failed',
            severity: 'critical',
            title: `Scraper Auto-Repair Failed: ${scraper}`,
            message: `The ${scraper} scraper has failed auto-repair after 3 attempts. Manual intervention required.`,
            details: {
              scraper: scraper,
              test_result: failedTest,
              repair_attempts: attemptCount,
              last_alert: lastAlert
            }
          });

          await supabase
            .from('scraper_health')
            .update({ last_admin_alert: new Date().toISOString() })
            .eq('source', scraper);
        } else {
          console.log(`⏳ Skipping admin alert for ${scraper} - already sent within 24 hours`);
        }
      }

    } else if (failedTest.test_name === 'notification_test') {
      // Handle notification system repair - only alert once per day
      const { data: recentAlert } = await supabase
        .from('qa_admin_alerts')
        .select('created_at')
        .eq('alert_type', 'notification_system_failed')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(1);

      if (!recentAlert || recentAlert.length === 0) {
        await createAdminAlert(supabase, testRunId, {
          alert_type: 'notification_system_failed',
          severity: 'warning',
          title: 'Notification System Quality Issue',
          message: 'The notification system failed quality checks.',
          details: {
            test_result: failedTest,
            quality_issues: failedTest.test_data?.quality_issues
          }
        });
      } else {
        console.log('⏳ Skipping notification system alert - already sent within 24 hours');
      }
    }

  } catch (error: any) {
    console.error(`❌ Auto-repair failed for ${failedTest.test_name}:`, error);
    
    // Create critical alert for repair system failure
    await createAdminAlert(supabase, testRunId, {
      alert_type: 'critical_failure',
      severity: 'emergency',
      title: 'QA Auto-Repair System Failure',
      message: 'The QA auto-repair system itself has failed.',
      details: {
        original_test: failedTest,
        repair_error: error.message
      }
    });
  }
}

async function createAdminAlert(supabase: any, testRunId: string, alertData: any): Promise<void> {
  try {
    const { error } = await supabase
      .from('qa_admin_alerts')
      .insert({
        test_run_id: testRunId,
        ...alertData
      });

    if (error) {
      console.error('Failed to create admin alert:', error);
    } else {
      console.log(`📧 Created admin alert: ${alertData.title}`);
      
      // Trigger immediate admin notification
      await supabase.functions.invoke('qa-admin-alerts', {
        body: { alert_id: 'latest' }
      });
    }
  } catch (error: any) {
    console.error('Error creating admin alert:', error);
  }
}

serve(serve_handler);