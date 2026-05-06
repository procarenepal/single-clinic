#!/usr/bin/env node

/**
 * SMS Tester Function Deployment Script
 * 
 * This script helps deploy the SMS tester function to Appwrite.
 * Run this after setting up your Appwrite CLI and configuring your project.
 * 
 * Prerequisites:
 * 1. Install Appwrite CLI: npm install -g appwrite-cli
 * 2. Login to Appwrite: appwrite login
 * 3. Initialize project: appwrite init project
 * 4. Configure environment variables
 * 
 * Usage:
 * node scripts/deploy-sms-function.js
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const PROJECT_CONFIG = {
  projectId: process.env.APPWRITE_PROJECT_ID || '',
  endpoint: process.env.APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1',
};

const FUNCTION_CONFIG = {
  name: 'sms-tester',
  runtime: 'node-18.0',
  source: './functions/sms-tester',
  entrypoint: 'src/main.js',
  timeout: 30,
  variables: {
    SMS_API_KEY: process.env.SMS_API_KEY || '',
    SMS_SENDER_ID: process.env.SMS_SENDER_ID || '',
    SMS_API_URL: process.env.SMS_API_URL || '',
    DATABASE_ID: process.env.DATABASE_ID || 'sms_tester_db',
    APPWRITE_ENDPOINT: process.env.APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1',
    APPWRITE_PROJECT_ID: process.env.APPWRITE_PROJECT_ID || '',
    APPWRITE_API_KEY: process.env.APPWRITE_API_KEY || '',
  }
};

// Utility functions
const logStep = (step, message) => {
  console.log(`\n🔸 Step ${step}: ${message}`);
};

const logSuccess = (message) => {
  console.log(`✅ ${message}`);
};

const logError = (message) => {
  console.error(`❌ ${message}`);
};

const logWarning = (message) => {
  console.warn(`⚠️  ${message}`);
};

const execAsync = (command) => {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject({ error, stderr });
      } else {
        resolve(stdout);
      }
    });
  });
};

// Validation functions
const validateEnvironment = () => {
  logStep(1, 'Validating environment');
  
  const required = ['APPWRITE_PROJECT_ID', 'SMS_API_KEY', 'SMS_SENDER_ID', 'SMS_API_URL'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    logError(`Missing required environment variables: ${missing.join(', ')}`);
    console.log('\nCreate a .env file with the following variables:');
    missing.forEach(key => {
      console.log(`${key}=your_${key.toLowerCase()}_here`);
    });
    return false;
  }
  
  logSuccess('Environment variables validated');
  return true;
};

const checkAppwriteCLI = async () => {
  logStep(2, 'Checking Appwrite CLI');
  
  try {
    await execAsync('appwrite --version');
    logSuccess('Appwrite CLI is installed');
    return true;
  } catch {
    logError('Appwrite CLI not found');
    console.log('Install it with: npm install -g appwrite-cli');
    return false;
  }
};

const checkProjectSetup = async () => {
  logStep(3, 'Checking project setup');
  
  if (!fs.existsSync('appwrite.json')) {
    logWarning('appwrite.json not found - make sure to run "appwrite init project" first');
    return false;
  }
  
  logSuccess('Project configuration found');
  return true;
};

// Deployment functions
const createDatabase = async () => {
  logStep(4, 'Creating database and collection');
  
  try {
    // Create database
    const createDbCommand = `appwrite databases create --databaseId="${FUNCTION_CONFIG.variables.DATABASE_ID}" --name="SMS Tester Database"`;
    await execAsync(createDbCommand);
    logSuccess('Database created');
    
    // Create collection
    const createCollectionCommand = `appwrite databases createCollection --databaseId="${FUNCTION_CONFIG.variables.DATABASE_ID}" --collectionId="sms_test_logs" --name="SMS Test Logs" --documentSecurity=true`;
    await execAsync(createCollectionCommand);
    logSuccess('Collection created');
    
    // Create attributes
    const attributes = [
      { key: 'phone_number', type: 'string', size: 20, required: true },
      { key: 'message', type: 'string', size: 1000, required: true },
      { key: 'status', type: 'string', size: 20, required: true },
      { key: 'response', type: 'string', size: 2000, required: false },
      { key: 'error_message', type: 'string', size: 500, required: false },
      { key: 'test_type', type: 'string', size: 50, required: true },
      { key: 'scheduled_time', type: 'string', size: 50, required: false },
      { key: 'timestamp', type: 'datetime', required: true }
    ];
    
    for (const attr of attributes) {
      const attrCommand = `appwrite databases createStringAttribute --databaseId="${FUNCTION_CONFIG.variables.DATABASE_ID}" --collectionId="sms_test_logs" --key="${attr.key}" --size=${attr.size} --required=${attr.required}`;
      await execAsync(attrCommand);
    }
    
    // Create datetime attribute separately
    const datetimeCommand = `appwrite databases createDatetimeAttribute --databaseId="${FUNCTION_CONFIG.variables.DATABASE_ID}" --collectionId="sms_test_logs" --key="timestamp" --required=true`;
    await execAsync(datetimeCommand);
    
    logSuccess('Attributes created');
    
  } catch (error) {
    if (error.stderr && error.stderr.includes('already exists')) {
      logWarning('Database/collection already exists, skipping creation');
    } else {
      logError(`Failed to create database: ${error.stderr || error.error}`);
      throw error;
    }
  }
};

const deployFunction = async () => {
  logStep(5, 'Deploying function');
  
  try {
    // Create function
    const createFunctionCommand = `appwrite functions create --functionId="${FUNCTION_CONFIG.name}" --name="${FUNCTION_CONFIG.name}" --runtime="${FUNCTION_CONFIG.runtime}" --timeout=${FUNCTION_CONFIG.timeout}`;
    await execAsync(createFunctionCommand);
    logSuccess('Function created');
    
    // Set environment variables
    for (const [key, value] of Object.entries(FUNCTION_CONFIG.variables)) {
      if (value) {
        const varCommand = `appwrite functions createVariable --functionId="${FUNCTION_CONFIG.name}" --key="${key}" --value="${value}"`;
        await execAsync(varCommand);
      }
    }
    logSuccess('Environment variables set');
    
    // Deploy code
    const deployCommand = `appwrite functions createDeployment --functionId="${FUNCTION_CONFIG.name}" --code="${FUNCTION_CONFIG.source}" --activate=true`;
    await execAsync(deployCommand);
    logSuccess('Function code deployed');
    
  } catch (error) {
    if (error.stderr && error.stderr.includes('already exists')) {
      logWarning('Function already exists, updating instead');
      try {
        const updateCommand = `appwrite functions createDeployment --functionId="${FUNCTION_CONFIG.name}" --code="${FUNCTION_CONFIG.source}" --activate=true`;
        await execAsync(updateCommand);
        logSuccess('Function updated');
      } catch (updateError) {
        logError(`Failed to update function: ${updateError.stderr || updateError.error}`);
        throw updateError;
      }
    } else {
      logError(`Failed to deploy function: ${error.stderr || error.error}`);
      throw error;
    }
  }
};

const testFunction = async () => {
  logStep(6, 'Testing function deployment');
  
  try {
    const testCommand = `appwrite functions createExecution --functionId="${FUNCTION_CONFIG.name}" --data="{}" --async=false`;
    const result = await execAsync(testCommand);
    logSuccess('Function test completed');
    console.log('Test result:', result);
  } catch (error) {
    logWarning(`Function test failed: ${error.stderr || error.error}`);
    console.log('This might be normal if the function requires specific input parameters');
  }
};

// Main deployment process
const main = async () => {
  console.log('🚀 SMS Tester Function Deployment\n');
  
  try {
    // Validation steps
    if (!validateEnvironment()) return;
    if (!(await checkAppwriteCLI())) return;
    if (!(await checkProjectSetup())) return;
    
    // Deployment steps
    await createDatabase();
    await deployFunction();
    await testFunction();
    
    console.log('\n🎉 Deployment completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Check your Appwrite console to verify the function is deployed');
    console.log('2. Test the SMS functionality at: https://your-domain.netlify.app/sms-tester');
    console.log('3. Configure your SMS provider settings in the environment variables');
    
  } catch (error) {
    console.log('\n💥 Deployment failed!');
    console.log('Error details:', error);
    console.log('\nTroubleshooting:');
    console.log('1. Make sure you are logged in to Appwrite CLI');
    console.log('2. Verify your project ID and endpoint');
    console.log('3. Check that all environment variables are set correctly');
    process.exit(1);
  }
};

// Run the deployment
if (require.main === module) {
  main();
}

module.exports = { main }; 