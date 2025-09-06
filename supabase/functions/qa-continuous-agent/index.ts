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

interface CircuitBreakerConfig {
  consecutive_failures: number;
  last_failure: string | null;
  paused_until: string | null;
  max_failures: number;
  pause_duration_minutes: number;
}

const serve_handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  console.log('🔍 Starting QA Continuous Agent...');

  // Check circuit breaker status
  const circuitBreaker = await checkCircuitBreaker(supabase);
  if (circuitBreaker.paused_until && new Date(circuitBreaker.paused_until) > new Date()) {
    console.log('⚡ Circuit breaker is active - QA paused until:', circuitBreaker.paused_until);
    return new Response(JSON.stringify({ 
      status: 'circuit_breaker_active',
      paused_until: circuitBreaker.paused_until,
      reason: 'Too many consecutive failures'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  let testRun: QATestRun | null = null;
  const results: TestResult[] = [];

  try {
    // Create test run record
    const { data: testRunData, error: testRunError } = await supabase
      .from('qa_test_runs')
      .insert({
        status: 'running',
        total_tests: 5  // Updated to include constraint validation
      })
      .select()
      .single();

    if (testRunError) {
      throw new Error(`Failed to create test run: ${testRunError.message}`);
    }

    testRun = testRunData;
    console.log(`📊 Created test run: ${testRun.id}`);

    // Test 0: Database Constraint Validation (new pre-test)
    console.log('🧪 Running Test 0: Database Constraint Validation');
    results.push(await validateDatabaseConstraints(supabase, testRun.id));

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

    // Update circuit breaker based on results
    await updateCircuitBreaker(supabase, failedTests > 0);

    // Handle auto-repair for failed tests with smart alerting
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

    // Update circuit breaker on error
    await updateCircuitBreaker(supabase, true);

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

// Circuit breaker functions
async function checkCircuitBreaker(supabase: any): Promise<CircuitBreakerConfig> {
  const { data } = await supabase
    .from('qa_system_config')
    .select('setting_value')
    .eq('setting_key', 'circuit_breaker')
    .single();
  
  return data?.setting_value || {
    consecutive_failures: 0,
    last_failure: null,
    paused_until: null,
    max_failures: 3,
    pause_duration_minutes: 60
  };
}

async function updateCircuitBreaker(supabase: any, hasFailed: boolean) {
  const current = await checkCircuitBreaker(supabase);
  
  if (hasFailed) {
    current.consecutive_failures += 1;
    current.last_failure = new Date().toISOString();
    
    // Activate circuit breaker if max failures reached
    if (current.consecutive_failures >= current.max_failures) {
      const pauseUntil = new Date();
      pauseUntil.setMinutes(pauseUntil.getMinutes() + current.pause_duration_minutes);
      current.paused_until = pauseUntil.toISOString();
      
      console.log(`⚡ Circuit breaker activated - pausing QA for ${current.pause_duration_minutes} minutes`);
      
      // Send circuit breaker alert
      await createAdminAlert(supabase, 'circuit_breaker', {
        title: 'QA Circuit Breaker Activated',
        message: `QA system paused due to ${current.consecutive_failures} consecutive failures`,
        alert_type: 'system_pause',
        severity: 'critical',
        details: {
          consecutive_failures: current.consecutive_failures,
          paused_until: current.paused_until,
          last_failure: current.last_failure
        }
      });
    }
  } else {
    // Reset on success
    current.consecutive_failures = 0;
    current.paused_until = null;
  }
  
  await supabase
    .from('qa_system_config')
    .upsert({
      setting_key: 'circuit_breaker',
      setting_value: current,
      updated_at: new Date().toISOString()
    });
}

// Database constraint validation test
async function validateDatabaseConstraints(supabase: any, testRunId: string): Promise<TestResult> {
  const startTime = Date.now();
  
  try {
    // Test if we can insert a property with source 'qa_test'
    const testProperty = {
      external_id: `constraint-test-${Date.now()}`,
      source: 'qa_test',
      title: 'Constraint Validation Test',
      url: 'https://test.constraint.example.com',
      city: 'Test City',
      price: 1000,
      is_active: false
    };
    
    const { error: insertError } = await supabase
      .from('properties')
      .insert(testProperty);
    
    if (insertError) {
      const result: TestResult = {
        test_name: 'constraint_validation',
        status: 'failed',
        error_message: `Database constraint validation failed: ${insertError.message}`,
        test_data: { constraint_error: insertError },
        response_time_ms: Date.now() - startTime
      };

      await supabase.from('qa_test_results').insert({
        test_run_id: testRunId,
        ...result,
        completed_at: new Date().toISOString()
      });

      return result;
    }
    
    // Clean up test property
    await supabase
      .from('properties')
      .delete()
      .eq('external_id', testProperty.external_id);
    
    const result: TestResult = {
      test_name: 'constraint_validation',
      status: 'passed',
      test_data: { validated_constraints: ['properties_source_check'] },
      response_time_ms: Date.now() - startTime
    };

    await supabase.from('qa_test_results').insert({
      test_run_id: testRunId,
      ...result,
      completed_at: new Date().toISOString()
    });

    return result;
    
  } catch (error: any) {
    const result: TestResult = {
      test_name: 'constraint_validation',
      status: 'failed',
      error_message: `Constraint validation error: ${error.message}`,
      test_data: { error: error },
      response_time_ms: Date.now() - startTime
    };

    await supabase.from('qa_test_results').insert({
      test_run_id: testRunId,
      ...result,
      completed_at: new Date().toISOString()
    });

    return result;
  }
}

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
      source: 'qa_test',
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
        // Max attempts reached, send admin alert with smart consolidation
        await createAdminAlert(supabase, testRunId, {
          alert_type: 'scraper_repair_failed',
          severity: 'critical',
          title: `Scraper Auto-Repair Failed: ${scraper}`,
          message: `The ${scraper} scraper has failed auto-repair after 3 attempts. Manual intervention required.`,
          details: {
            scraper: scraper,
            test_result: failedTest,
            repair_attempts: attemptCount
          }
        });
      }

    } else if (failedTest.test_name === 'notification_test') {
      // Handle notification system repair with smart alerting
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

    } else if (failedTest.test_name === 'constraint_validation') {
      // Critical database constraint issue
      await createAdminAlert(supabase, testRunId, {
        alert_type: 'database_constraint_failed',
        severity: 'critical',
        title: 'Database Constraint Validation Failed',
        message: 'Critical database constraint validation failed - QA tests cannot proceed.',
        details: {
          test_result: failedTest,
          constraint_error: failedTest.test_data?.constraint_error
        }
      });
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

// Create admin alert with smart consolidation
async function createAdminAlert(supabase: any, testRunId: string, alertData: any): Promise<void> {
  console.log(`🚨 Creating admin alert: ${alertData.title}`);
  
  // Check if we should consolidate alerts
  const shouldAlert = await shouldSendAlert(supabase, alertData);
  if (!shouldAlert) {
    console.log('⏳ Skipping alert - consolidation rules applied');
    return;
  }
  
  const { error } = await supabase
    .from('qa_admin_alerts')
    .insert({
      title: alertData.title,
      message: alertData.message,
      alert_type: alertData.alert_type,
      severity: alertData.severity || 'warning',
      test_run_id: testRunId,
      details: alertData.details || {},
      status: 'pending'
    });

  if (error) {
    console.error('❌ Error creating admin alert:', error);
    return;
  }

  // Trigger admin alert notification only for critical issues or new failure types
  if (alertData.severity === 'critical' || alertData.alert_type === 'circuit_breaker') {
    try {
      await supabase.functions.invoke('qa-admin-alerts', {
        body: { alert_id: 'latest' }
      });
    } catch (notifyError) {
      console.error('❌ Error triggering admin alert notification:', notifyError);
    }
  }
}

// Smart alert consolidation logic
async function shouldSendAlert(supabase: any, alertData: any): Promise<boolean> {
  // Always send critical alerts
  if (alertData.severity === 'critical') return true;
  
  // Check if we've already sent this type of alert recently (last 24 hours)
  const twentyFourHoursAgo = new Date();
  twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
  
  const { data: recentAlerts } = await supabase
    .from('qa_admin_alerts')
    .select('id')
    .eq('alert_type', alertData.alert_type)
    .gte('created_at', twentyFourHoursAgo.toISOString())
    .limit(1);
  
  if (recentAlerts && recentAlerts.length > 0) {
    console.log(`⏳ Skipping ${alertData.alert_type} alert - already sent within 24 hours`);
    return false;
  }
  
  return true;
}

serve(serve_handler);