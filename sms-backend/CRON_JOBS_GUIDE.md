# Cron Job for Automated Reminders Implementation

This document explains the implementation of Step 5 from the SMS Backend Migration - Cron Job for Automated Reminders.

## Overview

The automated reminder system uses multiple cron jobs to:
- Process scheduled reminders and send SMS messages
- Discover upcoming appointments and create reminder schedules
- Perform daily cleanup of old records
- Monitor system health and performance

## Cron Job Schedule

| Job Type | Frequency | Purpose |
|----------|-----------|---------|
| **Reminder Processing** | Every 15 minutes | Send due SMS reminders |
| **Appointment Discovery** | Every hour | Find new appointments to schedule |
| **Daily Cleanup** | 2:00 AM daily | Remove old records and orphaned data |
| **Health Check** | Every 5 minutes | Monitor system health |

## Key Features

### 1. Multi-Job Architecture

```javascript
async function initializeCronJobs() {
  // Primary reminder processing - every 15 minutes
  cron.schedule('*/15 * * * *', processScheduledReminders);
  
  // Appointment discovery - every hour  
  cron.schedule('0 * * * *', discoverAndScheduleUpcomingAppointments);
  
  // Daily cleanup - 2 AM daily
  cron.schedule('0 2 * * *', performDailyCleanup);
  
  // Health monitoring - every 5 minutes
  cron.schedule('*/5 * * * *', performHealthCheck);
}
```

### 2. Idempotency Mechanisms

- **Duplicate Prevention**: Each appointment can only have one scheduled reminder
- **Status Tracking**: Reminders track `scheduled`, `sent`, `failed`, `skipped` states  
- **Retry Logic**: Failed reminders get up to 3 retry attempts with backoff
- **Database Constraints**: Unique indexes prevent duplicate reminder records

### 3. Smart Appointment Discovery

The system automatically discovers appointments from your main appointments collection and creates reminders:

```javascript
// Query upcoming appointments (next 48 hours)
const upcomingAppointments = await db.collection('appointments').find({
  appointmentTime: { $gte: now, $lte: next48Hours },
  status: { $nin: ['cancelled', 'completed'] }
}).toArray();
```

## API Endpoints

### 1. Manual Cron Job Triggers

Manually execute cron jobs for testing or emergency processing.

```http
POST /trigger-cron/:jobType
X-API-Key: your_api_key
```

**Available Job Types:**
- `process-reminders` - Process all due reminders
- `discover-appointments` - Find and schedule new appointments
- `daily-cleanup` - Perform cleanup tasks
- `health-check` - Run health diagnostics

**Example:**
```bash
curl -X POST https://your-backend-server.com/trigger-cron/process-reminders \
  -H "X-API-Key: your_key"
```

**Response:**
```json
{
  "success": true,
  "message": "Cron job 'process-reminders' executed successfully",
  "executionTime": "1250ms",
  "timestamp": "2025-08-14T10:00:00Z"
}
```

### 2. Cron Job Status Monitoring

Get comprehensive status and statistics for all cron jobs.

```http
GET /cron-status
X-API-Key: your_api_key
```

**Response:**
```json
{
  "success": true,
  "data": {
    "timestamp": "2025-08-14T10:00:00Z",
    "cronJobs": {
      "status": "running",
      "schedules": {
        "reminderProcessing": "Every 15 minutes",
        "appointmentDiscovery": "Every hour",
        "dailyCleanup": "2:00 AM daily",
        "healthCheck": "Every 5 minutes"
      }
    },
    "statistics": {
      "pendingReminders": 25,
      "upcomingReminders": 150,
      "todaysSms": {
        "sent": 45,
        "failed": 2
      }
    },
    "recentLogs": [
      {
        "type": "health_check",
        "timestamp": "2025-08-14T09:55:00Z",
        "status": "healthy",
        "metrics": {
          "stuckReminders": 0,
          "recentActivity": 45,
          "dbConnected": true
        }
      }
    ]
  }
}
```

## Cron Job Functions

### 1. Process Scheduled Reminders

**Function:** `processScheduledReminders()`
**Frequency:** Every 15 minutes

```javascript
// Find due reminders
const reminders = await db.collection('scheduled_reminders').find({
  status: 'scheduled',
  reminderTime: { $lte: now }
}).toArray();

// Process each reminder with:
// - Clinic settings validation
// - Appointment type filtering  
// - Smart scheduling logic
// - SMS sending with retry logic
```

**Features:**
- Validates clinic SMS settings are still enabled
- Checks appointment type filtering rules
- Sends SMS via configured provider
- Updates reminder status and logs results
- Implements retry logic for failed sends

### 2. Discover and Schedule Appointments

**Function:** `discoverAndScheduleUpcomingAppointments()`
**Frequency:** Every hour

```javascript
// Query appointments in next 48 hours
const upcomingAppointments = await db.collection('appointments').find({
  appointmentTime: { $gte: now, $lte: next48Hours },
  status: { $nin: ['cancelled', 'completed'] }
}).toArray();

// For each appointment:
// - Check if reminder already exists (idempotency)
// - Validate clinic settings and appointment type
// - Calculate optimal reminder time
// - Create reminder record
```

**Features:**
- Automatic appointment discovery from your database
- Idempotency checks prevent duplicate reminders
- Applies all SMS filtering rules (clinic settings, appointment types)
- Calculates reminder times using smart scheduling logic
- Comprehensive error handling and logging

### 3. Daily Cleanup

**Function:** `performDailyCleanup()`  
**Frequency:** 2:00 AM daily

```javascript
// Clean up old records
await db.collection('scheduled_reminders').deleteMany({
  $or: [
    { status: 'sent', sentAt: { $lt: thirtyDaysAgo } },
    { status: 'failed', attemptedAt: { $lt: sevenDaysAgo } },
    { status: 'skipped', processedAt: { $lt: sevenDaysAgo } }
  ]
});

// Remove orphaned reminders (appointments no longer exist)
// Log cleanup statistics
```

**Features:**
- Removes old processed reminders (30-day retention)
- Cleans up old SMS logs
- Finds and removes orphaned reminders
- Logs cleanup statistics for monitoring

### 4. Health Check

**Function:** `performHealthCheck()`
**Frequency:** Every 5 minutes

```javascript
// Check database connectivity
await db.admin().ping();

// Monitor for stuck reminders
const stuckReminders = await db.collection('scheduled_reminders').countDocuments({
  status: 'scheduled',
  reminderTime: { $lt: oneHourAgo }
});

// Track recent activity
// Log health metrics
```

**Features:**
- Database connectivity monitoring
- Detects stuck/overdue reminders
- Tracks recent SMS activity
- Stores health metrics in system logs
- Alerts on anomalies (>10 stuck reminders)

## Deployment Options

### Option 1: Integrated with Main Server

Default setup - cron jobs run within the main Express server:

```bash
npm start
# Starts server with integrated cron jobs
```

### Option 2: Standalone Cron Runner

Run cron jobs separately from the main server:

```bash
# Run all cron jobs continuously
npm run cron

# Run specific job once and exit
npm run cron:process      # Process reminders
npm run cron:discover     # Discover appointments  
npm run cron:cleanup      # Daily cleanup
npm run cron:health       # Health check
```

### Option 3: External Cron with API Calls

Use system cron to call API endpoints:

```bash
# Add to system crontab
*/15 * * * * curl -X POST http://your-server/trigger-cron/process-reminders -H "X-API-Key: your_key"
0 * * * * curl -X POST http://your-server/trigger-cron/discover-appointments -H "X-API-Key: your_key"
0 2 * * * curl -X POST http://your-server/trigger-cron/daily-cleanup -H "X-API-Key: your_key"
```

## Database Collections

### System Logs Collection

```javascript
{
  _id: ObjectId,
  type: "health_check|daily_cleanup",
  timestamp: Date,
  status: "healthy|failed",
  metrics: {
    stuckReminders: 0,
    recentActivity: 45,
    dbConnected: true
  },
  stats: {
    removedReminders: 12,
    removedLogs: 8,
    removedOrphaned: 1
  }
}
```

### Enhanced Scheduled Reminders

```javascript
{
  _id: ObjectId,
  appointmentId: "apt123",
  status: "scheduled|sent|failed|skipped",
  source: "api|auto-discovery",           // Track how reminder was created
  retryCount: 0,                          // For failed reminder retry logic
  lastFailedAt: Date,                     // Last failure timestamp
  // ... other fields
}
```

## Monitoring & Debugging

### Key Log Messages

```bash
# Startup
✅ SMS reminder cron jobs initialized with multiple schedules

# Processing
🔄 Running primary reminder processing cron job...
📋 Found 25 upcoming appointments to check
✅ Scheduled reminder for appointment apt123 at 2025-08-14T15:00:00Z

# Health & Maintenance  
💚 Health check: {"dbConnected":true,"stuckReminders":0}
🗑️ Cleaned up 15 old reminder records
⚠️ Warning: 12 stuck reminders detected
```

### Performance Monitoring

Monitor these metrics:
- **Processing Time**: How long each cron job takes to complete
- **Stuck Reminders**: Reminders past due but not processed
- **Success Rates**: SMS delivery success percentage
- **Database Performance**: Query execution times
- **Memory Usage**: Monitor for memory leaks in long-running processes

### Common Issues & Solutions

1. **Stuck Reminders**
   ```bash
   # Check for overdue reminders
   GET /cron-status
   
   # Manually process them
   POST /trigger-cron/process-reminders
   ```

2. **Discovery Not Finding Appointments**
   ```bash
   # Verify appointment collection structure matches expected format
   # Check appointment time range (only next 48 hours)
   # Ensure appointments have required fields
   ```

3. **High Memory Usage**
   ```bash
   # Restart cron runner periodically in production
   # Monitor cleanup job effectiveness
   # Adjust retention periods if needed
   ```

## Configuration

### Environment Variables

```bash
# Required for cron jobs
MONGODB_URI=mongodb://...
MONGODB_DB_NAME=your_database
SMS_API_KEY=your_sms_key
SMS_API_URL=your_sms_endpoint
SMS_SENDER_ID=your_sender_id
API_SECRET_KEY=your_api_key
```

### Cron Schedule Customization

Modify cron schedules in `scheduler.js`:

```javascript
// More frequent processing for high-volume clinics
cron.schedule('*/5 * * * *', processScheduledReminders);

// Less frequent discovery for smaller clinics  
cron.schedule('0 */4 * * *', discoverAndScheduleUpcomingAppointments);
```

## Testing

### Test Individual Functions

```bash
# Test reminder processing
npm run cron:process

# Test appointment discovery
npm run cron:discover

# Test cleanup
npm run cron:cleanup

# Test health check
npm run cron:health
```

### Test via API

```bash
# Process reminders manually
curl -X POST https://your-backend-server.com/trigger-cron/process-reminders \
  -H "X-API-Key: your_key"

# Check system status
curl -X GET https://your-backend-server.com/cron-status \
  -H "X-API-Key: your_key"
```

### Load Testing

1. Create test appointments in database
2. Monitor cron job performance under load
3. Verify idempotency under concurrent execution
4. Test error handling with invalid data

---

**Status: Step 5 - Cron Job for Automated Reminders is COMPLETE ✅**

The implementation provides a comprehensive automated reminder system with:
- ✅ **Multiple Specialized Cron Jobs** for different functions
- ✅ **Idempotency Mechanisms** to prevent duplicate reminders  
- ✅ **Smart Appointment Discovery** from your appointment database
- ✅ **Comprehensive Health Monitoring** and logging
- ✅ **Flexible Deployment Options** (integrated or standalone)
- ✅ **Manual Trigger Capabilities** for testing and emergency use
- ✅ **Automatic Cleanup** and maintenance
- ✅ **Performance Monitoring** and alerting
- ✅ **Complete Documentation** and testing instructions
