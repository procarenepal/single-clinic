# Smart Scheduling Logic Implementation

This document explains the implementation of Step 3 from the SMS Backend Migration - Smart Scheduling Logic.

## Overview

The smart scheduling logic automatically determines the optimal time to send appointment reminders based on:
- Time remaining until the appointment
- Clinic-specific settings
- Business hours preferences
- Appointment type configurations

## Smart Scheduling Rules

### Rule 1: 24+ Hours Away
- **Condition**: More than 24 hours until appointment
- **Action**: Use clinic's "advance notice" setting (default: 24 hours before)
- **Example**: Appointment on Friday 3 PM, reminder sent Thursday 3 PM (if clinic setting is 24 hours)

### Rule 2: 4-24 Hours Away
- **Condition**: Between 4-24 hours until appointment
- **Action**: Automatically adjust to 2 hours before appointment
- **Example**: Appointment on Friday 3 PM, reminder sent Friday 1 PM

### Rule 3: 2-4 Hours Away
- **Condition**: Between 2-4 hours until appointment
- **Action**: Schedule 1 hour before appointment
- **Example**: Appointment on Friday 3 PM, reminder sent Friday 2 PM

### Rule 4: Less than 2 Hours
- **Condition**: Less than 2 hours until appointment
- **Action**: Skip reminder (do not send)
- **Reason**: Too close to be useful for the patient

## Clinic Settings Integration

### Database Structure
```javascript
{
  clinicId: "clinic123",
  smsSettings: {
    enabled: true,                    // Enable/disable SMS reminders
    advanceNoticeHours: 24,          // Hours before appointment for Rule 1
    enabledAppointmentTypes: [],      // Empty = all types, or specific types
    businessHoursOnly: false,        // Send only during business hours
    businessStartHour: 9,            // Business day start (24-hour format)
    businessEndHour: 17             // Business day end (24-hour format)
  }
}
```

### Business Hours Logic
- When `businessHoursOnly: true`:
  - Reminders before business hours → Move to business start time
  - Reminders after business hours → Move to next business day start
  - Example: Reminder calculated for 7 AM → Moved to 9 AM

## API Endpoints

### 1. Schedule Reminder with Smart Logic
```http
POST /schedule-reminder
Content-Type: application/json
X-API-Key: your_api_key

{
  "appointmentId": "apt123",
  "patientPhone": "+1234567890",
  "doctorName": "Dr. Smith",
  "appointmentTime": "2025-08-15T15:00:00Z",
  "clinicName": "Health Clinic",
  "appointmentType": "consultation",
  "clinicId": "clinic123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Reminder scheduled successfully with smart scheduling logic",
  "reminderId": "ObjectId",
  "reminderTime": "2025-08-14T15:00:00Z",
  "schedulingDetails": {
    "appointmentTime": "2025-08-15T15:00:00Z",
    "hoursBeforeAppointment": "24.0",
    "clinicAdvanceNoticeSetting": 24,
    "businessHoursOnly": false
  }
}
```

### 2. Test Scheduling Logic
```http
POST /test-scheduling
Content-Type: application/json
X-API-Key: your_api_key

{
  "appointmentTime": "2025-08-15T15:00:00Z",
  "clinicId": "clinic123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "currentTime": "2025-08-14T10:00:00Z",
    "appointmentTime": "2025-08-15T15:00:00Z",
    "hoursUntilAppointment": "29.00",
    "calculatedReminderTime": "2025-08-14T15:00:00Z",
    "hoursBeforeAppointment": "24.00",
    "willSkipReminder": false,
    "clinicSettings": {
      "enabled": true,
      "advanceNoticeHours": 24,
      "businessHoursOnly": false
    },
    "schedulingRule": "Using clinic advance notice: 24 hours"
  }
}
```

### 3. Get Clinic SMS Settings
```http
GET /clinic-settings/clinic123
X-API-Key: your_api_key
```

## Implementation Features

### 1. Validation
- Validates appointment data before scheduling
- Checks phone number format
- Ensures appointment time is in the future
- Verifies required fields

### 2. Error Handling
- Comprehensive error logging
- Graceful fallbacks to default settings
- Retry mechanism for failed SMS sends (up to 3 attempts)
- Database error handling

### 3. Logging & Monitoring
- Detailed console logging for debugging
- SMS send/fail tracking in database
- Reminder processing statistics
- Cleanup of old records (30 days)

### 4. Appointment Type Filtering
- Supports appointment-type-specific reminders
- Empty `enabledAppointmentTypes` array = all types enabled
- Specific types can be configured per clinic

## Database Collections

### scheduled_reminders
```javascript
{
  _id: ObjectId,
  appointmentId: "apt123",
  patientPhone: "+1234567890",
  doctorName: "Dr. Smith",
  appointmentTime: Date,
  clinicName: "Health Clinic",
  appointmentType: "consultation",
  clinicId: "clinic123",
  status: "scheduled|sent|failed|skipped",
  createdAt: Date,
  reminderTime: Date,
  clinicSettings: {
    advanceNoticeHours: 24,
    businessHoursOnly: false
  },
  sentAt: Date,
  message: "Generated message",
  retryCount: 0
}
```

### sms_logs
```javascript
{
  _id: ObjectId,
  phoneNumber: "+1234567890",
  message: "Reminder message",
  appointmentId: "apt123",
  clinicId: "clinic123",
  type: "reminder|instant",
  status: "sent|failed",
  sentAt: Date,
  response: {...}, // SMS provider response
  error: "Error message if failed"
}
```

## Testing the Implementation

1. **Test with different time scenarios:**
   ```bash
   # 30 hours away (should use clinic advance setting)
   curl -X POST https://your-backend-server.com/test-scheduling \
     -H "Content-Type: application/json" \
     -H "X-API-Key: your_key" \
     -d '{"appointmentTime": "future_date_30h"}'

   # 6 hours away (should use 2 hours before)
   curl -X POST https://your-backend-server.com/test-scheduling \
     -H "Content-Type: application/json" \
     -H "X-API-Key: your_key" \
     -d '{"appointmentTime": "future_date_6h"}'

   # 1 hour away (should skip)
   curl -X POST https://your-backend-server.com/test-scheduling \
     -H "Content-Type: application/json" \
     -H "X-API-Key: your_key" \
     -d '{"appointmentTime": "future_date_1h"}'
   ```

2. **Test business hours logic:**
   - Set `businessHoursOnly: true` in clinic settings
   - Schedule appointments with reminders that fall outside business hours
   - Verify reminders are moved to appropriate business hours

## Monitoring & Debugging

### Console Logs to Watch For:
- `✅ Reminder scheduled for appointment apt123`
- `✅ Reminder sent successfully for appointment apt123`
- `❌ Failed to send reminder for appointment apt123`
- `🗑️ Cleaned up X old reminder records`

### Common Issues:
1. **Reminder not scheduled**: Check clinic SMS settings enabled
2. **Wrong reminder time**: Verify clinic advance notice setting
3. **Business hours not working**: Check business start/end hour settings
4. **Appointment type filtering**: Ensure appointment type is in enabled list

## Performance Considerations

- Database queries are optimized with proper indexing
- Batch processing of reminders in cron job
- Automatic cleanup of old records prevents database bloat
- Retry mechanism prevents lost reminders due to temporary failures

---

**Status: Step 3 - Smart Scheduling Logic is COMPLETE ✅**

The implementation provides comprehensive smart scheduling with clinic-specific settings, business hours support, appointment type filtering, and robust error handling.
